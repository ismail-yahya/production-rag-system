import uuid
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from src.core.exceptions import IngestionError
from src.embeddings.base import BaseEmbedder
from src.ingestion.chunkers.base import BaseChunker, Chunk
from src.ingestion.loaders.base import BaseLoader, RawDocument
from src.ingestion.pipeline import IngestionPipeline
from src.ingestion.processors.cleaner import TextCleaner
from src.vectorstore.base import BaseVectorStore


@pytest.fixture
def mock_loader():
    loader = MagicMock(spec=BaseLoader)
    loader.load = AsyncMock()
    return loader


@pytest.fixture
def mock_cleaner():
    cleaner = MagicMock(spec=TextCleaner)
    cleaner.clean = MagicMock()
    return cleaner


@pytest.fixture
def mock_chunker():
    chunker = MagicMock(spec=BaseChunker)
    chunker.chunk = AsyncMock()
    return chunker


@pytest.fixture
def mock_embedder():
    embedder = MagicMock(spec=BaseEmbedder)
    embedder.embed_texts = AsyncMock()
    return embedder


@pytest.fixture
def mock_vector_store():
    vector_store = MagicMock(spec=BaseVectorStore)
    vector_store.upsert = AsyncMock()
    return vector_store


@pytest.mark.asyncio
async def test_pipeline_unsupported_file_extension(
    mock_chunker, mock_embedder, mock_vector_store
):
    # Arrange
    pipeline = IngestionPipeline(
        chunker=mock_chunker,
        embedder=mock_embedder,
        vector_store=mock_vector_store,
    )
    doc_id = uuid.uuid4()

    # Act & Assert
    with pytest.raises(IngestionError, match="Unsupported file type: .txt"):
        await pipeline.run("test.txt", tenant_id="tenant-1", document_id=doc_id)


@pytest.mark.asyncio
async def test_pipeline_successful_run(
    mock_chunker, mock_embedder, mock_vector_store, mock_cleaner, mock_loader
):
    # Arrange
    pipeline = IngestionPipeline(
        chunker=mock_chunker,
        embedder=mock_embedder,
        vector_store=mock_vector_store,
        cleaner=mock_cleaner,
    )
    # Inject our mock loader for .pdf
    pipeline.loaders[".pdf"] = mock_loader

    doc_id = uuid.uuid4()
    raw_content = "Raw document text"
    cleaned_content = "Cleaned document text"
    mock_loader.load.return_value = RawDocument(
        content=raw_content, metadata={"author": "Test Author"}
    )
    mock_cleaner.clean.return_value = cleaned_content

    chunk_a = Chunk(content="Cleaned document", metadata={}, index=0)
    chunk_b = Chunk(content="text", metadata={}, index=1)
    mock_chunker.chunk.return_value = [chunk_a, chunk_b]

    mock_embedder.embed_texts.return_value = [[0.1, 0.2], [0.3, 0.4]]
    mock_vector_store.upsert.return_value = None

    # Act
    chunk_count = await pipeline.run(
        "test.pdf", tenant_id="tenant-1", document_id=doc_id, metadata={"tag": "finance"}
    )

    # Assert
    assert chunk_count == 2
    mock_loader.load.assert_called_once_with("test.pdf")
    mock_cleaner.clean.assert_called_once_with(raw_content)

    # Verify chunker is called with correct metadata merged
    expected_chunker_metadata = {
        "tag": "finance",
        "author": "Test Author",
        "tenant_id": "tenant-1",
        "document_id": str(doc_id),
    }
    mock_chunker.chunk.assert_called_once_with(cleaned_content, metadata=expected_chunker_metadata)

    mock_embedder.embed_texts.assert_called_once_with(["Cleaned document", "text"])
    mock_vector_store.upsert.assert_called_once()


@pytest.mark.asyncio
async def test_pipeline_empty_chunks(
    mock_chunker, mock_embedder, mock_vector_store, mock_cleaner, mock_loader
):
    # Arrange
    pipeline = IngestionPipeline(
        chunker=mock_chunker,
        embedder=mock_embedder,
        vector_store=mock_vector_store,
        cleaner=mock_cleaner,
    )
    pipeline.loaders[".pdf"] = mock_loader

    mock_loader.load.return_value = RawDocument(content="Short", metadata={})
    mock_cleaner.clean.return_value = "Short"
    mock_chunker.chunk.return_value = []  # No chunks generated

    # Act
    chunk_count = await pipeline.run("test.pdf", tenant_id="tenant-1", document_id=uuid.uuid4())

    # Assert
    assert chunk_count == 0
    mock_embedder.embed_texts.assert_not_called()
    mock_vector_store.upsert.assert_not_called()


@pytest.mark.asyncio
async def test_pipeline_component_failure(
    mock_chunker, mock_embedder, mock_vector_store, mock_loader
):
    # Arrange
    pipeline = IngestionPipeline(
        chunker=mock_chunker,
        embedder=mock_embedder,
        vector_store=mock_vector_store,
    )
    pipeline.loaders[".pdf"] = mock_loader

    # Mock load to fail with standard exception
    mock_loader.load.side_effect = Exception("File read error")

    # Act & Assert
    with pytest.raises(IngestionError, match="Ingestion pipeline failed: File read error"):
        await pipeline.run("test.pdf", tenant_id="tenant-1", document_id=uuid.uuid4())
