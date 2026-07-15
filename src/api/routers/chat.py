import json
import uuid
from typing import Annotated

import structlog
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.dependencies import get_current_user, get_rag_pipeline
from src.api.repositories import ChatRepository
from src.core.database import async_session_factory, get_session
from src.core.models import User
from src.rag.pipeline import RAGPipeline

logger = structlog.get_logger(__name__)

router = APIRouter(prefix="/v1/chat", tags=["chat"])


# ---------------------------------------------------------------------------
# Request / Response schemas
# ---------------------------------------------------------------------------


class ChatThreadResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tenant_id: uuid.UUID
    user_id: uuid.UUID
    workspace_id: uuid.UUID | None
    title: str
    created_at: str
    updated_at: str


class ChatThreadCreate(BaseModel):
    model_config = ConfigDict(frozen=True)

    title: str = Field(..., min_length=1, max_length=255)
    workspace_id: uuid.UUID | None = None


class ChatMessageResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    thread_id: uuid.UUID
    role: str
    content: str
    sources: list[dict] | None = None
    created_at: str


class ChatQueryRequest(BaseModel):
    model_config = ConfigDict(frozen=True)

    question: str = Field(..., min_length=1, max_length=1000)
    mode: str = Field(default="standard", description="standard | strict")


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------


@router.get("/threads", response_model=list[ChatThreadResponse])
async def list_threads(
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
    workspace_id: uuid.UUID | None = None,
) -> list[ChatThreadResponse]:
    """Retrieve all chat threads for the current user."""
    repo = ChatRepository(session)
    threads = await repo.list_threads(
        tenant_id=current_user.tenant_id,
        user_id=current_user.id,
        workspace_id=workspace_id,
    )
    return [
        ChatThreadResponse(
            id=t.id,
            tenant_id=t.tenant_id,
            user_id=t.user_id,
            workspace_id=t.workspace_id,
            title=t.title,
            created_at=t.created_at.isoformat(),
            updated_at=t.updated_at.isoformat(),
        )
        for t in threads
    ]


@router.post("/threads", response_model=ChatThreadResponse, status_code=status.HTTP_201_CREATED)
async def create_thread(
    body: ChatThreadCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> ChatThreadResponse:
    """Create a new chat conversation thread."""
    repo = ChatRepository(session)
    thread = await repo.create_thread(
        tenant_id=current_user.tenant_id,
        user_id=current_user.id,
        title=body.title,
        workspace_id=body.workspace_id,
    )
    await session.commit()
    return ChatThreadResponse(
        id=thread.id,
        tenant_id=thread.tenant_id,
        user_id=thread.user_id,
        workspace_id=thread.workspace_id,
        title=thread.title,
        created_at=thread.created_at.isoformat(),
        updated_at=thread.updated_at.isoformat(),
    )


@router.delete("/threads/{thread_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_thread(
    thread_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> None:
    """Delete a chat conversation thread and all associated messages."""
    repo = ChatRepository(session)
    success = await repo.delete_thread(
        thread_id=thread_id,
        tenant_id=current_user.tenant_id,
        user_id=current_user.id,
    )
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat thread not found or access denied.",
        )
    await session.commit()


@router.get("/threads/{thread_id}/messages", response_model=list[ChatMessageResponse])
async def get_thread_messages(
    thread_id: uuid.UUID,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> list[ChatMessageResponse]:
    """Retrieve all messages in a specific chat conversation thread."""
    repo = ChatRepository(session)
    thread = await repo.get_thread_by_id(
        thread_id=thread_id,
        tenant_id=current_user.tenant_id,
        user_id=current_user.id,
    )
    if not thread:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat thread not found or access denied.",
        )

    messages = await repo.get_messages(thread_id)
    return [
        ChatMessageResponse(
            id=m.id,
            thread_id=m.thread_id,
            role=m.role,
            content=m.content,
            sources=m.sources,
            created_at=m.created_at.isoformat(),
        )
        for m in messages
    ]


@router.post("/threads/{thread_id}/stream")
async def stream_chat(
    thread_id: uuid.UUID,
    body: ChatQueryRequest,
    current_user: Annotated[User, Depends(get_current_user)],
    pipeline: Annotated[RAGPipeline, Depends(get_rag_pipeline)],
    session: Annotated[AsyncSession, Depends(get_session)],
) -> StreamingResponse:
    """
    Submit a user question to a chat thread, stream the assistant's answer via SSE,
    and save both the query and answer to the database on completion.
    """
    repo = ChatRepository(session)
    thread = await repo.get_thread_by_id(
        thread_id=thread_id,
        tenant_id=current_user.tenant_id,
        user_id=current_user.id,
    )
    if not thread:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Chat thread not found or access denied.",
        )

    # Resolve document constraints: limit search to documents inside the thread's workspace (if configured)
    query_filters = {}
    if thread.workspace_id:
        from src.api.services.workspace_service import WorkspaceService
        workspace_service = WorkspaceService(session)
        # Fetch only documents accessible to the user in this workspace
        allowed_ids = await workspace_service.get_accessible_document_ids(current_user)
        # Cross reference with document access for this specific workspace
        doc_accesses = await workspace_service.doc_access_repo.list_by_workspace(thread.workspace_id)
        workspace_doc_ids = {access.document_id for access in doc_accesses}
        intersected = allowed_ids & workspace_doc_ids
        query_filters["document_id"] = [str(uid) for uid in intersected]
    else:
        from src.api.services.workspace_service import WorkspaceService
        workspace_service = WorkspaceService(session)
        allowed_ids = await workspace_service.get_accessible_document_ids(current_user)
        query_filters["document_id"] = [str(uid) for uid in allowed_ids]

    async def event_generator():
        accumulated_answer = ""
        sources = []

        try:
            async for event in pipeline.stream_query(
                question=body.question,
                tenant_id=current_user.tenant_id,
                mode=body.mode,
                filters=query_filters,
                search_type="hybrid",
            ):
                if event["type"] == "token":
                    accumulated_answer += event["content"]
                elif event["type"] == "sources":
                    sources = event["sources"]

                yield f"data: {json.dumps(event)}\n\n"

            # 1. Yield terminal SSE event
            yield f"data: {json.dumps({'type': 'done'})}\n\n"

            # 2. Persist user and assistant responses to DB inside a separate session
            async with async_session_factory() as write_session:
                write_repo = ChatRepository(write_session)
                # Save user prompt message
                await write_repo.add_message(
                    thread_id=thread_id,
                    role="user",
                    content=body.question,
                    sources=None,
                )
                # Save assistant response message
                await write_repo.add_message(
                    thread_id=thread_id,
                    role="assistant",
                    content=accumulated_answer,
                    sources=sources,
                )
                await write_session.commit()

        except Exception as e:
            logger.error("chat_streaming_failed", thread_id=str(thread_id), error=str(e))
            yield f"data: {json.dumps({'type': 'error', 'content': 'Internal server error occurred.'})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
