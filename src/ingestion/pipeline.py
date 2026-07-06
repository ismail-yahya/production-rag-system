import asyncio
import time
import uuid
from pathlib import Path
from typing import TYPE_CHECKING, Any

import structlog

from src.core.exceptions import IngestionError
from src.embeddings.base import BaseEmbedder
from src.ingestion.chunkers.base import BaseChunker
from src.ingestion.loaders.pdf_loader import PDFLoader
from src.ingestion.processors.cleaner import TextCleaner
from src.vectorstore.base import BaseVectorStore
from src.vectorstore.base import Document as VectorDocument

if TYPE_CHECKING:
    from src.ingestion.loaders.base import BaseLoader

logger = structlog.get_logger(__name__)


class IngestionPipeline:
    """Orchestrator for the document ingestion process.

    This class coordinates loaders, cleaners, chunkers, embedders, and
    vector stores to process a document from a raw file to indexed vectors.

    Attributes:
        chunker: Chunker strategy to use.
        embedder: Embedder provider to use.
        vector_store: Vector store provider to use.
        cleaner: Text cleaning processor.
        loaders: Dictionary mapping file extensions to loader instances.
    """

    def __init__(
        self,
        chunker: BaseChunker,
        embedder: BaseEmbedder,
        vector_store: BaseVectorStore,
        cleaner: TextCleaner | None = None,
    ) -> None:
        """Initializes the pipeline with required service objects.

        Args:
            chunker: Concrete BaseChunker implementation.
            embedder: Concrete BaseEmbedder implementation.
            vector_store: Concrete BaseVectorStore implementation.
            cleaner: Optional TextCleaner instance.
        """
        self.chunker = chunker
        self.embedder = embedder
        self.vector_store = vector_store
        self.cleaner = cleaner or TextCleaner()

        # Registry of supported loaders
        self.loaders: dict[str, BaseLoader] = {
            ".pdf": PDFLoader(),
        }

    async def run(
        self,
        file_path: str,
        tenant_id: str,
        document_id: uuid.UUID,
        metadata: dict[str, Any] | None = None,
    ) -> int:
        """Executes the ingestion pipeline for a single document.

        Args:
            file_path: Path to the document on disk.
            tenant_id: Unique identifier for the tenant.
            document_id: Unique identifier for the document.
            metadata: Additional metadata to attach to all chunks.

        Returns:
            int: The number of chunks indexed.

        Raises:
            IngestionError: If any step in the pipeline fails.
        """
        start_time = time.perf_counter()
        logger.info(
            "Starting ingestion pipeline",
            document_id=str(document_id),
            tenant_id=tenant_id,
            file_path=file_path,
        )

        try:
            # 1. Select appropriate loader based on file extension
            ext = Path(file_path).suffix.lower()
            loader = self.loaders.get(ext)
            if not loader:
                logger.error("Unsupported file type", extension=ext)
                raise IngestionError(f"Unsupported file type: {ext}")

            # 2. Extract raw text and metadata
            raw_doc = await loader.load(file_path)
            logger.info(
                "Stage 1: Document loaded successfully",
                extension=ext,
                content_length=len(raw_doc.content),
            )

            # 3. Clean and normalize text
            cleaned_content = await asyncio.to_thread(self.cleaner.clean, raw_doc.content)
            logger.info(
                "Stage 2: Text cleaning completed",
                original_length=len(raw_doc.content),
                cleaned_length=len(cleaned_content),
            )

            # 4. Generate semantic chunks
            # Merge provided metadata with loader-extracted metadata
            base_metadata = (metadata or {}).copy()
            base_metadata.update(raw_doc.metadata)
            base_metadata["tenant_id"] = tenant_id
            base_metadata["document_id"] = str(document_id)

            chunks = await self.chunker.chunk(cleaned_content, metadata=base_metadata)
            logger.info("Stage 3: Text chunking completed", chunk_count=len(chunks))
            if not chunks:
                logger.warning("Document yielded no chunks", document_id=str(document_id))
                return 0

            # 5. Generate embeddings for all chunks in a single batch
            texts = [c.content for c in chunks]
            embeddings = await self.embedder.embed_texts(texts)
            logger.info(
                "Stage 4: Embeddings generated successfully", embedding_count=len(embeddings)
            )

            # 6. Construct vector store documents and upsert
            logger.info("Purging old document chunks from vector store", document_id=str(document_id))
            await self.vector_store.delete(filters={"document_id": str(document_id), "tenant_id": tenant_id})

            vector_docs = []
            for _i, (chunk, embedding) in enumerate(zip(chunks, embeddings, strict=False)):
                vector_docs.append(
                    VectorDocument(
                        id=uuid.uuid5(document_id, f"chunk_{_i}"),
                        content=chunk.content,
                        metadata={**chunk.metadata, "document_id": str(document_id), "chunk_index": _i},
                        embedding=embedding,
                    )
                )

            await self.vector_store.upsert(vector_docs)
            logger.info(
                "Stage 5: Vector database indexing completed", indexed_count=len(vector_docs)
            )

            latency_ms = int((time.perf_counter() - start_time) * 1000)
            logger.info(
                "Ingestion pipeline completed successfully",
                document_id=str(document_id),
                chunk_count=len(vector_docs),
                latency_ms=latency_ms,
            )

            return len(vector_docs)

        except Exception as e:
            # Re-wrap any unexpected exceptions as IngestionError
            if isinstance(e, IngestionError):
                raise

            logger.error(
                "Unexpected failure in ingestion pipeline",
                document_id=str(document_id),
                error=str(e),
                exc_info=True,
            )
            raise IngestionError(f"Ingestion pipeline failed: {str(e)}") from e
