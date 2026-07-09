import structlog

from src.rag.security import SecurityGuard
from src.vectorstore.base import Document

logger = structlog.get_logger(__name__)


class ContextBuilder:
    """
    Orchestrates the construction of the context window for the LLM.

    This class takes retrieved documents, sanitizes them, and formats them
    into a single string while enforcing token budget limits.
    """

    def __init__(self, max_tokens: int = 4000) -> None:
        """
        Initialize the ContextBuilder.

        Args:
            max_tokens: The maximum number of tokens allowed in the context window.
                Uses a heuristic of 4 characters per token if exact counts aren't available.
        """
        self.max_tokens = max_tokens

    def build_context(self, documents: list[Document]) -> str:
        """
        Constructs a formatted context string from a list of retrieved documents.

        Each document is sanitized to prevent instruction injection and formatted
        with source labels to assist the LLM in attribution.

        Args:
            documents: A list of Document objects retrieved from the vector store.

        Returns:
            A single string containing the formatted and truncated context.
        """
        context_parts: list[str] = []
        current_tokens = 0

        for i, doc in enumerate(documents):
            # Sanitize content to neutralize embedded instructions
            sanitized_content = SecurityGuard.sanitize_context(doc.content)

            # Build source header — format must match the citation style in RAG_SYSTEM_PROMPT
            # so the LLM can reference it as [Source N] in its answer.
            source_id = i + 1
            file_name = doc.metadata.get("file_name", "Unknown Document")
            page_number = doc.metadata.get("page_number")
            section_title = doc.metadata.get("section_title")

            header = f"[Source {source_id}] {file_name}"
            if section_title:
                header += f" — {section_title}"
            if page_number:
                header += f" (p. {page_number})"

            # Construct the full block for this document
            block = f"{header}:\n{sanitized_content}\n"

            # Token limit enforcement (heuristic: 1 token ≈ 4 characters)
            # This is a safe baseline when tiktoken/tokenizers aren't explicitly required as dependencies.
            block_tokens = len(block) // 4

            if current_tokens + block_tokens > self.max_tokens:
                logger.warning(
                    "context_limit_reached",
                    max_tokens=self.max_tokens,
                    current_tokens=current_tokens,
                    remaining_docs=len(documents) - i,
                )
                break

            context_parts.append(block)
            current_tokens += block_tokens

        formatted_context = "\n".join(context_parts)

        logger.info(
            "context_built",
            doc_count=len(context_parts),
            estimated_tokens=current_tokens,
            limit=self.max_tokens,
        )

        return formatted_context
