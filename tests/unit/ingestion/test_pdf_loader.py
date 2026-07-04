from unittest.mock import patch

import pytest
from src.core.exceptions import IngestionError
from src.ingestion.loaders.pdf_loader import PDFLoader


@pytest.mark.asyncio
async def test_pdf_loader_bytes_not_implemented():
    # Arrange
    loader = PDFLoader()

    # Act & Assert
    with pytest.raises(IngestionError, match="Byte-based loading for PDF not yet implemented"):
        await loader.load(b"some pdf bytes")


@pytest.mark.asyncio
async def test_pdf_loader_file_not_found():
    # Arrange
    loader = PDFLoader()

    # Act & Assert
    with pytest.raises(IngestionError, match="PDF file not found"):
        await loader.load("non_existent_file.pdf")


@pytest.mark.asyncio
async def test_pdf_loader_success(tmp_path):
    # Arrange
    loader = PDFLoader()
    temp_file = tmp_path / "test.pdf"
    temp_file.write_bytes(b"dummy pdf content")
    expected_markdown = "# Test PDF\nThis is a mock PDF content."

    # We mock to_markdown which runs inside asyncio.to_thread
    with patch("src.ingestion.loaders.pdf_loader.pymupdf4llm.to_markdown") as mock_to_markdown:
        mock_to_markdown.return_value = expected_markdown

        # Act
        doc = await loader.load(str(temp_file))

        # Assert
        assert doc.content == expected_markdown
        assert doc.metadata["source"] == str(temp_file)
        assert doc.metadata["file_type"] == "pdf"
        assert doc.metadata["file_name"] == "test.pdf"
        mock_to_markdown.assert_called_once_with(str(temp_file))


@pytest.mark.asyncio
async def test_pdf_loader_library_failure(tmp_path):
    # Arrange
    loader = PDFLoader()
    temp_file = tmp_path / "test.pdf"
    temp_file.write_bytes(b"dummy pdf content")

    # We mock to_markdown to raise an exception
    with patch("src.ingestion.loaders.pdf_loader.pymupdf4llm.to_markdown") as mock_to_markdown:
        mock_to_markdown.side_effect = RuntimeError("Low-level parsing error")

        # Act & Assert
        with pytest.raises(IngestionError, match="Failed to parse PDF: Low-level parsing error"):
            await loader.load(str(temp_file))
