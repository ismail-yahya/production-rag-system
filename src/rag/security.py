import re

import structlog

from src.core.config import settings
from src.core.exceptions import SecurityError

logger = structlog.get_logger(__name__)

# ---------------------------------------------------------------------------
# Prompt injection detection patterns
#
# Categories:
#   1. Direct override — classic "ignore/disregard" variants
#   2. Role-playing attacks — persona hijacking via "act as", "pretend to be"
#   3. Jailbreak vocabulary — DAN, developer mode, unrestricted mode
#   4. Data exfiltration probes — asking the model to repeat its context/prompt
#   5. LLM-specific token injection — raw special tokens from training formats
#   6. Context override instructions — embedded commands in injected content
# ---------------------------------------------------------------------------
INJECTION_PATTERNS: list[str] = [
    # Category 1: Direct override
    r"(?i)ignore (all )?previous instructions",
    r"(?i)disregard (all )?previous instructions",
    r"(?i)forget everything",
    r"(?i)override (all )?instructions",
    r"(?i)new (set of )?instructions",
    # Category 2: Role-playing / persona hijacking
    r"(?i)you are (now )?an? (assistant|agent|hacker|unrestricted|expert|villain)",
    r"(?i)act as (an? )?(unrestricted|uncensored|evil|jailbroken)",
    r"(?i)pretend (to be|you are)",
    r"(?i)roleplay as",
    r"(?i)new role",
    r"(?i)take on the (persona|role|character) of",
    # Category 3: Jailbreak vocabulary
    r"(?i)dan mode",
    r"(?i)developer mode",
    r"(?i)jailbreak",
    r"(?i)do anything now",
    r"(?i)bypass (all )?(restrictions|guidelines|filters|safety)",
    r"(?i)disable (your )?(safety|filters|restrictions)",
    # Category 4: Data exfiltration probes
    r"(?i)system prompt",
    r"(?i)output (the )?(full |entire )?(system )?prompt",
    r"(?i)reveal your (internal|hidden|original|actual) instructions",
    r"(?i)repeat (everything|the above|your instructions|your prompt)",
    r"(?i)print (your|the) (instructions|prompt|context)",
    r"(?i)show (me )?(your |the )?(full )?(system |hidden )?prompt",
    r"(?i)what (are|were) your (original |exact )?instructions",
    # Category 5: LLM-specific token injection
    r"<\|im_start\|>",
    r"<\|im_end\|>",
    r"<\|endoftext\|>",
    r"\{\{.*?\}\}",    # Template injection patterns like {{system}}
    r"\[INST\]",
    r"\[\/INST\]",
    # Category 6: Context override instructions embedded in content
    r"(?i)---.*?new instruction.*?---",
    r"(?i)###\s*(system|instruction|context):",
]

# Patterns that might indicate instruction leakage in document content (context sanitization)
CONTEXT_SANITIZATION_PATTERNS: list[str] = [
    r"(?i)\[system\]",
    r"(?i)\[user\]",
    r"(?i)\[assistant\]",
    r"(?i)---.*new instruction.*---",
    r"<\|im_start\|>",
    r"<\|im_end\|>",
    r"<\|endoftext\|>",
]


class SecurityGuard:
    """Provides security functions to protect the RAG pipeline from injection attacks.

    This class implements regex-based detection for prompt injection in queries
    and sanitizes document content to prevent context-embedded instruction injection.

    Query constraints:
      - Maximum length: settings.MAX_QUERY_LENGTH characters (default 2000)
      - All patterns in INJECTION_PATTERNS are evaluated before processing

    Context constraints:
      - CONTEXT_SANITIZATION_PATTERNS are replaced with [SANITIZED]
    """

    @staticmethod
    def sanitize_query(query: str) -> str:
        """
        Check a user query for potential prompt injection patterns and enforce
        length constraints.

        Args:
            query: The user's natural language question.

        Returns:
            The original query if no injection is detected.

        Raises:
            SecurityError: If the query exceeds MAX_QUERY_LENGTH or matches
                           any injection pattern.
        """
        # Length check first — cheap O(1) operation
        if len(query) > settings.MAX_QUERY_LENGTH:
            logger.warning(
                "query_too_long",
                length=len(query),
                max_length=settings.MAX_QUERY_LENGTH,
            )
            raise SecurityError(
                f"Query exceeds maximum allowed length of {settings.MAX_QUERY_LENGTH} characters."
            )

        for pattern in INJECTION_PATTERNS:
            if re.search(pattern, query):
                logger.warning(
                    "prompt_injection_detected",
                    pattern=pattern,
                    query=query[:100],
                )
                raise SecurityError("Potential prompt injection detected. Query rejected.")

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

        sanitized = context
        for pattern in CONTEXT_SANITIZATION_PATTERNS:
            sanitized = re.sub(pattern, "[SANITIZED]", sanitized)

        return sanitized

