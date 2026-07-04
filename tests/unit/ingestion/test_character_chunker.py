import pytest
from src.ingestion.chunkers.character_chunker import RecursiveCharacterChunker


@pytest.mark.asyncio
async def test_chunker_empty_input():
    # Arrange
    chunker = RecursiveCharacterChunker(chunk_size=100, chunk_overlap=20)

    # Act
    chunks = await chunker.chunk("")

    # Assert
    assert chunks == []


@pytest.mark.asyncio
async def test_chunker_basic_splitting():
    # Arrange
    chunker = RecursiveCharacterChunker(chunk_size=20, chunk_overlap=0)
    text = "Paragraph one.\n\nParagraph two."

    # Act
    chunks = await chunker.chunk(text)

    # Assert
    assert len(chunks) == 2
    assert chunks[0].content == "Paragraph one."
    assert chunks[1].content == "Paragraph two."
    assert chunks[0].index == 0
    assert chunks[1].index == 1


@pytest.mark.asyncio
async def test_chunker_metadata_propagation():
    # Arrange
    chunker = RecursiveCharacterChunker(chunk_size=50, chunk_overlap=10)
    text = "Some long document text that will split."
    base_metadata = {"source": "test_doc", "author": "John"}

    # Act
    chunks = await chunker.chunk(text, metadata=base_metadata)

    # Assert
    assert len(chunks) > 0
    for chunk in chunks:
        assert chunk.metadata["source"] == "test_doc"
        assert chunk.metadata["author"] == "John"


@pytest.mark.asyncio
async def test_chunker_overlap_handling():
    # Arrange
    # Splitting with chunk_size=15 and chunk_overlap=10
    chunker = RecursiveCharacterChunker(chunk_size=15, chunk_overlap=10, separators=[" "])
    text = "abcdefghij klmnopqrst uvwxyz"

    # Act
    chunks = await chunker.chunk(text)

    # Assert
    assert len(chunks) == 3
    assert chunks[0].content == "abcdefghij"
    assert chunks[1].content == "abcdefghijklmnopqrst"
    assert chunks[2].content == "klmnopqrstuvwxyz"


@pytest.mark.asyncio
async def test_chunker_force_split_by_size():
    # Arrange
    # A single very long word with no separators
    chunker = RecursiveCharacterChunker(chunk_size=5, chunk_overlap=0)
    text = "abcdefghij"

    # Act
    chunks = await chunker.chunk(text)

    # Assert
    assert len(chunks) == 2
    assert chunks[0].content == "abcde"
    assert chunks[1].content == "fghij"
