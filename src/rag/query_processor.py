import structlog
from src.core.exceptions import LLMError
from src.llm.base import BaseLLM, LLMMessage
from src.rag.prompt_templates import QUERY_CLASSIFICATION_PROMPT, QUERY_EXPANSION_PROMPT

logger = structlog.get_logger(__name__)


class QueryProcessor:
    """Handles query expansion and classification to improve RAG retrieval and response generation."""

    def __init__(self, llm: BaseLLM) -> None:
        self.llm = llm

    async def expand_query(self, query: str) -> list[str]:
        """
        Expands the user query into multiple search queries to improve retrieval recall.

        Args:
            query: The original user query.

        Returns:
            A list of expanded queries, including the original one.

        Raises:
            LLMError: If the LLM call fails.
        """
        logger.info("expanding_query", query=query[:100])

        prompt = QUERY_EXPANSION_PROMPT.format(query=query)
        messages = [LLMMessage(role="user", content=prompt)]

        try:
            response = await self.llm.generate(messages, temperature=0.0)
            expanded = [q.strip() for q in response.content.split("\n") if q.strip()]

            # Ensure the original query is included if not already there
            if query not in expanded:
                expanded.insert(0, query)

            logger.debug("query_expanded", count=len(expanded))
            return expanded
        except Exception as e:
            logger.error("query_expansion_failed", error=str(e), exc_info=True)
            raise LLMError(f"Failed to expand query: {str(e)}") from e

    async def classify_query(self, query: str) -> str:
        """
        Classifies the user query into a category to assist in prompt selection or routing.

        Args:
            query: The original user query.

        Returns:
            The classification category (e.g., 'factual', 'analytical').

        Raises:
            LLMError: If the LLM call fails.
        """
        logger.info("classifying_query", query=query[:100])

        prompt = QUERY_CLASSIFICATION_PROMPT.format(query=query)
        messages = [LLMMessage(role="user", content=prompt)]

        try:
            response = await self.llm.generate(messages, temperature=0.0)
            category = response.content.strip().lower()

            valid_categories = {"factual", "analytical", "comparative", "other"}
            if category not in valid_categories:
                logger.warning("invalid_category_detected", category=category)
                return "other"

            logger.debug("query_classified", category=category)
            return category
        except Exception as e:
            logger.error("query_classification_failed", error=str(e), exc_info=True)
            raise LLMError(f"Failed to classify query: {str(e)}") from e
