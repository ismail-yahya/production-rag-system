import re
import structlog
from src.core.exceptions import SecurityError

logger = structlog.get_logger(__name__)

# Common prompt injection patterns
INJECTION_PATTERNS = [
    r"(?i)ignore (all )?previous instructions",
    r"(?i)disregard (all )?previous instructions",
    r"(?i)you are (now )?an? (assistant|agent|hacker|unrestricted|expert)",
    r"(?i)system prompt",
    r"(?i)new role",
    r"(?i)dan mode",
    r"(?i)developer mode",
    r"(?i)output the (full )?system prompt",
    r"(?i)forget everything",
    r"(?i)reveal your (internal|hidden) instructions",
]

# Patterns that might indicate instruction leakage in document content
CONTEXT_SANITIZATION_PATTERNS = [
    r"(?i)\[system\]",
    r"(?i)\[user\]",
    r"(?i)\[assistant\]",
    r"(?i)---.*new instruction.*---",
]


class SecurityGuard:
    """Provides security functions to protect the RAG pipeline from injection attacks.

    This class implements regex-based detection for prompt injection in queries
    and sanitizes document content to prevent context-embedded instruction injection.
    """

    @staticmethod
    def sanitize_query(query: str) -> str:
        """
        Check a user query for potential prompt injection patterns.

        Args:
            query: The user's natural language question.

        Returns:
            The original query if no injection is detected.

        Raises:
            SecurityError: If a potential injection pattern is found.
        """
        for pattern in INJECTION_PATTERNS:
            if re.search(pattern, query):
                logger.warning(
                    "prompt_injection_detected", pattern=pattern, query=query[:100]
                )
                raise SecurityError(
                    "Potential prompt injection detected. Query rejected."
                )

        return query

    @staticmethod
    def sanitize_context(context: str) -> str:
        """
        Sanitize document content to neutralize embedded instructions.

        Args:
            context: The text content retrieved from the vector store.

        Returns:
            The sanitized context text.
        """
        if not context:
            return ""

        # Neutralize specific markers that could confuse the LLM
        sanitized = context
        for pattern in CONTEXT_SANITIZATION_PATTERNS:
            sanitized = re.sub(pattern, "[SANITIZED]", sanitized)

        return sanitized
