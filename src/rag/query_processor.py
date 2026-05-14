import json

import structlog

from src.core.exceptions import LLMError
from src.llm.base import BaseLLM, LLMMessage
from src.rag.prompt_templates import QUERY_PROCESSING_PROMPT
from src.rag.schemas import QueryProcessingResult

logger = structlog.get_logger(__name__)


class QueryProcessor:
    """Handles query expansion and classification to improve RAG retrieval and response generation."""

    def __init__(self, llm: BaseLLM) -> None:
        self.llm = llm

    async def process_query(self, query: str) -> tuple[list[str], str]:
        """
        Expands the user query and classifies it in a single LLM request.

        Args:
            query: The original user query.

        Returns:
            A tuple of (expanded_queries, category).

        Raises:
            LLMError: If the LLM call fails or parsing fails.
        """
        logger.info("processing_query", query=query[:100])

        prompt = QUERY_PROCESSING_PROMPT.format(query=query)
        messages = [LLMMessage(role="user", content=prompt)]

        try:
            response = await self.llm.generate(messages, temperature=0.0)

            # Clean up the response in case the model added markdown blocks like ```json ... ```
            content = response.content.strip()
            if content.startswith("```json"):
                content = content[7:]
            if content.startswith("```"):
                content = content[3:]
            if content.endswith("```"):
                content = content[:-3]
            content = content.strip()

            parsed_data = json.loads(content)
            result = QueryProcessingResult(**parsed_data)

            expanded = result.expanded_queries.copy()
            # Ensure the original query is included if not already there
            if query not in expanded:
                expanded.insert(0, query)

            category = result.category.lower()
            valid_categories = {"factual", "analytical", "comparative", "other"}
            if category not in valid_categories:
                logger.warning("invalid_category_detected", category=category)
                category = "other"

            logger.debug("query_processed", count=len(expanded), category=category)
            return expanded, category
        except Exception as e:
            logger.error("query_processing_failed", error=str(e), exc_info=True)
            raise LLMError(f"Failed to process query: {str(e)}") from e
