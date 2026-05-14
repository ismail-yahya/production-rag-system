from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class RawDocument:
    """Value object representing a document before processing and chunking.

    Attributes:
        content: The raw text content extracted from the document.
        metadata: Key-value pairs containing document metadata (e.g., source, page count, etc.).
    """

    content: str
    metadata: dict[str, Any] = field(default_factory=dict)


class BaseLoader(ABC):
    """Abstract base class for all document loaders.

    All concrete loaders must implement the `load` method to extract text
    and metadata from a specific file type or source.
    """

    @abstractmethod
    async def load(self, source: str | bytes) -> RawDocument:
        """Loads and parses a document into a RawDocument.

        Args:
            source: The source to load from. This could be a file path (str)
                   or raw bytes.

        Returns:
            RawDocument: The extracted content and metadata.

        Raises:
            IngestionError: If the document cannot be loaded or parsed.
        """
        pass
