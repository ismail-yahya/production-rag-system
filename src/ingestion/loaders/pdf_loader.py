import asyncio
from pathlib import Path
from typing import Any

import pymupdf4llm
import structlog

from src.core.exceptions import IngestionError
from src.ingestion.loaders.base import BaseLoader, RawDocument

logger = structlog.get_logger(__name__)


class PDFLoader(BaseLoader):
    """Loader for PDF documents using pymupdf4llm.

    This loader extracts text content in Markdown format, which is better
    suited for LLM context windows as it preserves some structural information.
    """

    async def load(self, source: str | bytes) -> RawDocument:
        """Loads and parses a PDF document.

        Args:
            source: Path to the PDF file (str) or raw bytes.

        Returns:
            RawDocument: The extracted Markdown content and metadata.

        Raises:
            IngestionError: If the PDF cannot be loaded or parsed.
        """
        try:
            if isinstance(source, bytes):
                # pymupdf4llm.to_markdown can take a stream/bytes if supported,
                # but often it's easier to handle via a temporary file or
                # direct bytes if the library supports it.
                # In current versions, to_markdown usually takes a file path.
                # We'll handle bytes by writing to a temporary location if needed,
                # but first we check if we can pass it directly.
                logger.debug("Parsing PDF from bytes", size=len(source))
                # For simplicity and reliability with pymupdf4llm, we'll assume
                # a path is preferred. If bytes are passed, we might need a temp file.
                # However, many implementations use a path in this RAG system.
                raise IngestionError(
                    "Byte-based loading for PDF not yet implemented. Please provide a file path."
                )

            file_path = Path(source)
            if not file_path.exists():
                raise IngestionError(f"PDF file not found: {source}")

            logger.info("Loading PDF document", path=str(file_path))

            # pymupdf4llm.to_markdown is synchronous, so we run it in a thread
            # to avoid blocking the event loop.
            content = await asyncio.to_thread(pymupdf4llm.to_markdown, str(file_path))

            metadata: dict[str, Any] = {
                "source": str(file_path),
                "file_type": "pdf",
                "file_name": file_path.name,
            }

            logger.info(
                "PDF document loaded successfully", path=str(file_path), content_length=len(content)
            )

            return RawDocument(content=content, metadata=metadata)

        except IngestionError:
            raise
        except Exception as e:
            logger.error("Failed to load PDF document", error=str(e), source=str(source))
            raise IngestionError(f"Failed to parse PDF: {str(e)}") from e
