import re
import unicodedata

import structlog

logger = structlog.get_logger(__name__)


class TextCleaner:
    """Processor for cleaning and normalizing raw text content extracted from documents.
    
    This class handles unicode normalization, whitespace cleanup, and removal 
    of common document extraction artifacts.
    """

    def clean(self, text: str) -> str:
        """Cleans and normalizes the input text.

        Args:
            text: The raw text string to be cleaned.

        Returns:
            str: The cleaned and normalized text.
        """
        if not text:
            return ""

        original_length = len(text)

        # 1. Unicode Normalization (NFKC - Compatibility Decomposition, followed by Canonical Composition)
        # This handles different ways of representing the same character.
        text = unicodedata.normalize("NFKC", text)

        # 2. Remove control characters except newline and tab
        # 'C' category includes control characters, surrogates, etc.
        text = "".join(
            ch for ch in text 
            if unicodedata.category(ch)[0] != "C" or ch in "\n\t"
        )

        # 3. Normalize whitespace
        # Replace multiple horizontal spaces (space, non-breaking space, etc.) with a single space
        text = re.sub(r"[ \t\u00A0]+", " ", text)
        
        # Replace 3 or more newlines with exactly 2 (preserves paragraph breaks but removes excessive gaps)
        text = re.sub(r"\n{3,}", "\n\n", text)

        # 4. Strip leading and trailing whitespace from the entire document
        text = text.strip()

        logger.debug(
            "Text cleaning complete", 
            original_length=original_length, 
            cleaned_length=len(text)
        )

        return text

    def __call__(self, text: str) -> str:
        """Allow the cleaner to be used as a callable."""
        return self.clean(text)
