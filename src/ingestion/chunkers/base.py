from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any


@dataclass(frozen=True)
class Chunk:
    """Value object representing a piece of a document.
    
    Attributes:
        content: The text content of the chunk.
        metadata: Metadata inherited from the parent document or specific to the chunk.
        index: The position of the chunk within the original document (0-indexed).
    """
    content: str
    metadata: dict[str, Any] = field(default_factory=dict)
    index: int = 0


class BaseChunker(ABC):
    """Abstract base class for all document chunking strategies.
    
    Chunking is the process of splitting a document into smaller, 
    meaningful pieces for embedding and retrieval.
    """

    @abstractmethod
    async def chunk(self, text: str, metadata: dict[str, Any] | None = None) -> list[Chunk]:
        """Splits the input text into a list of Chunks.

        Args:
            text: The raw text content to split.
            metadata: Optional base metadata to attach to every chunk.

        Returns:
            list[Chunk]: The list of generated chunks.
            
        Raises:
            IngestionError: If the chunking process fails.
        """
        pass
