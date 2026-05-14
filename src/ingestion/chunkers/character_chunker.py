from typing import Any

import structlog

from src.core.config import settings
from src.ingestion.chunkers.base import BaseChunker, Chunk

logger = structlog.get_logger(__name__)


class RecursiveCharacterChunker(BaseChunker):
    """Chunker that splits text recursively using a list of separators.

    This implementation tries to split text by a sequence of separators
    (e.g., double newlines, single newlines, spaces) to keep chunks
    semantically coherent while staying within size limits.
    """

    def __init__(
        self,
        chunk_size: int | None = None,
        chunk_overlap: int | None = None,
        separators: list[str] | None = None,
    ) -> None:
        """Initializes the chunker with size and overlap settings.

        Args:
            chunk_size: Maximum characters per chunk. Defaults to settings.CHUNK_SIZE.
            chunk_overlap: Overlap between consecutive chunks. Defaults to settings.CHUNK_OVERLAP.
            separators: List of separators to try in order.
        """
        self.chunk_size = chunk_size or settings.CHUNK_SIZE
        self.chunk_overlap = chunk_overlap or settings.CHUNK_OVERLAP
        self.separators = separators or ["\n\n", "\n", " ", ""]

    async def chunk(self, text: str, metadata: dict[str, Any] | None = None) -> list[Chunk]:
        """Splits the input text into overlapping chunks.

        Args:
            text: The raw text content to split.
            metadata: Base metadata to attach to every chunk.

        Returns:
            list[Chunk]: The list of generated chunks.
        """
        if not text:
            return []

        logger.debug(
            "Starting recursive character chunking",
            text_length=len(text),
            chunk_size=self.chunk_size,
            overlap=self.chunk_overlap,
        )

        final_chunks: list[Chunk] = []
        raw_text_chunks = self._recursive_split(text, self.separators)

        # Merge the small pieces into actual chunks with overlap
        merged_contents = self._merge_splits(raw_text_chunks)

        for i, content in enumerate(merged_contents):
            chunk_metadata = (metadata or {}).copy()
            final_chunks.append(
                Chunk(
                    content=content,
                    metadata=chunk_metadata,
                    index=i,
                )
            )

        logger.info(
            "Chunking complete",
            chunk_count=len(final_chunks),
            original_length=len(text),
        )

        return final_chunks

    def _recursive_split(self, text: str, separators: list[str]) -> list[str]:
        """Split text into pieces using the provided separators recursively."""
        final_chunks: list[str] = []

        # Get the current separator to try
        separator = separators[0] if separators else ""
        next_separators = separators[1:] if len(separators) > 1 else []

        # Split the text
        splits = text.split(separator) if separator else list(text)

        for s in splits:
            if len(s) <= self.chunk_size:
                final_chunks.append(s)
            elif next_separators:
                # Recurse with the remaining separators
                final_chunks.extend(self._recursive_split(s, next_separators))
            else:
                # No more separators, force split by size
                for i in range(0, len(s), self.chunk_size):
                    final_chunks.append(s[i : i + self.chunk_size])

        return final_chunks

    def _merge_splits(self, splits: list[str]) -> list[str]:
        """Merge small splits into chunks of chunk_size with chunk_overlap."""
        merged: list[str] = []
        current_doc: list[str] = []
        total_len = 0

        for s in splits:
            if total_len + len(s) > self.chunk_size and current_doc:
                merged.append("".join(current_doc))

                # Handle overlap: backtrack from the current_doc
                # to start the next chunk with some context
                overlap_doc: list[str] = []
                overlap_len = 0
                for prev_s in reversed(current_doc):
                    if overlap_len + len(prev_s) <= self.chunk_overlap:
                        overlap_doc.insert(0, prev_s)
                        overlap_len += len(prev_s)
                    else:
                        break
                current_doc = overlap_doc
                total_len = overlap_len

            current_doc.append(s)
            total_len += len(s)

        if current_doc:
            merged.append("".join(current_doc))

        return merged
