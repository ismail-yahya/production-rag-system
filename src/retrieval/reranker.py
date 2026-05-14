import structlog
from cohere import AsyncClientV2

from src.core.config import settings
from src.core.exceptions import RetrievalError
from src.vectorstore.base import Document

logger = structlog.get_logger(__name__)


class CohereReranker:
    """Reranker that uses Cohere's Rerank API to refine retrieval results.

    It takes a list of candidate documents and re-orders them based on their
    semantic relevance to the query, using a cross-encoder model.
    """

    def __init__(self, api_key: str | None = None, model: str | None = None) -> None:
        """
        Initialize the Cohere client.

        Args:
            api_key: Cohere API key. Defaults to settings.COHERE_API_KEY.
            model: Rerank model to use. Defaults to settings.COHERE_RERANK_MODEL.
        """
        self._api_key = api_key or (
            settings.COHERE_API_KEY.get_secret_value()
            if settings.COHERE_API_KEY
            else None
        )
        self._model = model or settings.COHERE_RERANK_MODEL

        if not self._api_key:
            logger.warning("cohere_reranker_missing_api_key")
            self._client = None
        else:
            self._client = AsyncClientV2(api_key=self._api_key)

    async def rerank(
        self, query: str, documents: list[Document], top_n: int | None = None
    ) -> list[Document]:
        """
        Rerank a list of documents using Cohere.

        Args:
            query: The natural language query.
            documents: List of Document objects to rerank.
            top_n: Number of top documents to return. Defaults to final_top_k.

        Returns:
            A list of Document objects sorted by relevance score.

        Raises:
            RetrievalError: If the Cohere API call fails.
        """
        if not documents:
            return []

        if not self._client:
            logger.warning("cohere_reranker_not_configured_falling_back")
            return documents[:top_n] if top_n else documents

        top_n = top_n or settings.RETRIEVAL_FINAL_TOP_K

        try:
            # Prepare documents for Cohere (list of strings)
            doc_texts = [doc.content for doc in documents]

            response = await self._client.rerank(
                model=self._model, query=query, documents=doc_texts, top_n=top_n
            )

            reranked_results = []
            for result in response.results:
                # Cohere returns results with 'index' pointing to original document
                original_doc = documents[result.index]
                reranked_results.append(
                    Document(
                        id=original_doc.id,
                        content=original_doc.content,
                        metadata=original_doc.metadata.copy(),
                        embedding=original_doc.embedding,
                        score=float(result.relevance_score),
                    )
                )

            # Rule: If CohereReranker returns fewer results than requested, log at WARNING level.
            # Never raise an exception for this condition.
            if len(reranked_results) < min(len(documents), top_n):
                logger.warning(
                    "cohere_reranker_returned_fewer_results",
                    expected=min(len(documents), top_n),
                    actual=len(reranked_results),
                )

            return reranked_results

        except Exception as e:
            logger.error("cohere_rerank_failed", error=str(e))
            # Rule: Cohere SDK exceptions must never propagate past CohereReranker.
            # Catch them and re-raise as RetrievalError.
            raise RetrievalError(f"Cohere rerank failed: {str(e)}") from e
