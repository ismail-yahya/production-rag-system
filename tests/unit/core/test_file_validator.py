"""
Unit tests for src/core/file_validator.py.

Tests cover:
  - Size limit enforcement
  - Extension whitelist
  - Detection of dangerous magic bytes (EXE, ELF, PHP, shell scripts)
  - Magic bytes format verification (file extension mismatch)
  - Valid files accepted correctly (PDF, PNG, JPEG, DOCX)
"""

import pytest

from src.core.exceptions import IngestionError
from src.core.file_validator import validate_file


# ---------------------------------------------------------------------------
# Helpers — minimal valid file content for each format
# ---------------------------------------------------------------------------

def _make_pdf(body: bytes = b"") -> bytes:
    return b"%PDF-1.4\n" + body


def _make_png(body: bytes = b"") -> bytes:
    return b"\x89PNG\r\n\x1a\n" + body


def _make_jpeg(body: bytes = b"") -> bytes:
    return b"\xff\xd8\xff\xe0" + body


def _make_docx(body: bytes = b"") -> bytes:
    # OOXML files start with the PK (ZIP) header
    return b"PK\x03\x04" + body


def _make_exe(body: bytes = b"") -> bytes:
    # Windows PE executable starts with MZ
    return b"MZ" + body


def _make_elf(body: bytes = b"") -> bytes:
    return b"\x7fELF" + body


def _make_php(body: bytes = b"") -> bytes:
    return b"<?php echo 'evil'; ?>"


def _make_shell(body: bytes = b"") -> bytes:
    return b"#!/bin/bash\nrm -rf /"


def _make_large_content(size_mb: int) -> bytes:
    """Generate `size_mb` megabytes of dummy content."""
    return b"A" * (size_mb * 1024 * 1024)


# ---------------------------------------------------------------------------
# Size validation
# ---------------------------------------------------------------------------

class TestSizeValidation:
    def test_file_under_limit_accepted(self) -> None:
        content = _make_pdf(b"small")
        result = validate_file(content, "doc.pdf", "application/pdf")
        assert result == "application/pdf"

    def test_file_exactly_at_limit_accepted(self) -> None:
        from src.core.config import settings

        # Build a PDF that is exactly at the size limit
        header = b"%PDF-1.4\n"
        padding = b"X" * (settings.MAX_UPLOAD_SIZE_BYTES - len(header))
        content = header + padding
        result = validate_file(content, "big.pdf", "application/pdf")
        assert result == "application/pdf"

    def test_file_over_limit_rejected(self) -> None:
        from src.core.config import settings

        # One byte over the limit
        content = b"%PDF-1.4\n" + b"X" * settings.MAX_UPLOAD_SIZE_BYTES
        with pytest.raises(IngestionError, match="exceeds the maximum"):
            validate_file(content, "toobig.pdf", "application/pdf")


# ---------------------------------------------------------------------------
# Extension whitelist
# ---------------------------------------------------------------------------

class TestExtensionWhitelist:
    @pytest.mark.parametrize(
        "filename",
        [
            "report.pdf",
            "image.png",
            "photo.jpg",
            "photo.jpeg",
            "notes.txt",
            "readme.md",
            "data.csv",
            "document.docx",
            "spreadsheet.xlsx",
            "presentation.pptx",
        ],
    )
    def test_allowed_extensions_pass_extension_check(self, filename: str) -> None:
        """Allowed extensions are not rejected by the extension whitelist step."""
        import os

        ext = os.path.splitext(filename)[1].lower()
        # Use correct magic bytes for PDF as a representative valid format
        # The extension check itself doesn't care about content
        content = b"%PDF-1.4\n" if ext == ".pdf" else b"\x89PNG\r\n\x1a\n" if ext == ".png" else b"\xff\xd8\xff"
        # Just test that the *extension* isn't rejected (we don't validate magic bytes here)
        # so we build content that matches what the validator expects for each type
        if ext in (".txt", ".md", ".csv"):
            content = b"some text content"
        elif ext == ".docx":
            content = b"PK\x03\x04"
        elif ext == ".xlsx":
            content = b"PK\x03\x04"
        elif ext == ".pptx":
            content = b"PK\x03\x04"
        validate_file(content, filename, None)  # Should not raise on allowed extensions

    @pytest.mark.parametrize(
        "filename",
        [
            "malware.exe",
            "script.sh",
            "virus.bat",
            "exploit.dll",
            "code.py",
            "payload.js",
            "hack.rb",
            "test.zip",
            "archive.tar",
        ],
    )
    def test_disallowed_extensions_rejected(self, filename: str) -> None:
        with pytest.raises(IngestionError, match="not supported"):
            validate_file(b"some content", filename, "application/octet-stream")


# ---------------------------------------------------------------------------
# Dangerous magic bytes detection
# ---------------------------------------------------------------------------

class TestDangerousMagicBytes:
    def test_exe_disguised_as_pdf_rejected(self) -> None:
        """MZ header inside a .pdf file must be caught and rejected."""
        content = _make_exe(b" extra bytes to make it look like a PDF")
        with pytest.raises(IngestionError, match="disallowed file signature"):
            validate_file(content, "invoice.pdf", "application/pdf")

    def test_elf_disguised_as_txt_rejected(self) -> None:
        """ELF binary hidden as text file must be rejected."""
        content = _make_elf(b" some elf binary")
        with pytest.raises(IngestionError, match="disallowed file signature"):
            validate_file(content, "notes.txt", "text/plain")

    def test_php_file_rejected(self) -> None:
        """PHP content must be rejected regardless of extension."""
        with pytest.raises(IngestionError):
            validate_file(_make_php(), "report.txt", "text/plain")

    def test_shell_script_rejected(self) -> None:
        """Shell scripts (#!) must be rejected."""
        with pytest.raises(IngestionError, match="disallowed file signature"):
            validate_file(_make_shell(), "readme.txt", "text/plain")


# ---------------------------------------------------------------------------
# Magic bytes format verification (content must match declared extension)
# ---------------------------------------------------------------------------

class TestMagicBytesFormatVerification:
    def test_pdf_with_correct_magic_accepted(self) -> None:
        content = _make_pdf()
        result = validate_file(content, "report.pdf", "application/pdf")
        assert result == "application/pdf"

    def test_png_disguised_as_jpeg_rejected(self) -> None:
        """PNG content with .jpg extension: magic bytes mismatch."""
        content = _make_png()
        with pytest.raises(IngestionError, match="does not match the expected format"):
            validate_file(content, "photo.jpg", "image/jpeg")

    def test_jpeg_disguised_as_png_rejected(self) -> None:
        """JPEG content with .png extension: magic bytes mismatch."""
        content = _make_jpeg()
        with pytest.raises(IngestionError, match="does not match the expected format"):
            validate_file(content, "image.png", "image/png")

    def test_random_bytes_as_pdf_rejected(self) -> None:
        """Random bytes claiming to be a PDF must be rejected."""
        content = b"\x00\x01\x02\x03\x04\x05\x06\x07"
        with pytest.raises(IngestionError, match="does not match the expected format"):
            validate_file(content, "doc.pdf", "application/pdf")


# ---------------------------------------------------------------------------
# Valid files — end-to-end happy path
# ---------------------------------------------------------------------------

class TestValidFilesAccepted:
    def test_valid_pdf_accepted(self) -> None:
        content = _make_pdf(b"Hello PDF world")
        result = validate_file(content, "annual_report.pdf", "application/pdf")
        assert result == "application/pdf"

    def test_valid_png_accepted(self) -> None:
        content = _make_png(b"png body data")
        result = validate_file(content, "logo.png", "image/png")
        assert result == "image/png"

    def test_valid_jpeg_accepted(self) -> None:
        content = _make_jpeg(b"jpeg body data")
        result = validate_file(content, "photo.jpeg", "image/jpeg")
        assert result == "image/jpeg"

    def test_valid_docx_accepted(self) -> None:
        content = _make_docx(b"docx body data")
        result = validate_file(content, "contract.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document")
        assert "wordprocessingml" in result

    def test_valid_xlsx_accepted(self) -> None:
        content = _make_docx(b"xlsx body data")  # same PK header
        result = validate_file(content, "data.xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
        assert "spreadsheetml" in result

    def test_plain_text_accepted(self) -> None:
        content = b"This is a plain text file with no magic bytes."
        result = validate_file(content, "notes.txt", "text/plain")
        assert result == "text/plain"

    def test_csv_accepted(self) -> None:
        content = b"id,name,value\n1,Alice,100\n2,Bob,200\n"
        result = validate_file(content, "data.csv", "text/csv")
        assert result == "text/csv"

    def test_claimed_mime_overridden_by_extension(self) -> None:
        """Even if the client sends wrong MIME type, the validated canonical MIME is returned."""
        content = _make_pdf()
        result = validate_file(content, "report.pdf", "application/octet-stream")
        # Extension .pdf → canonical MIME = application/pdf
        assert result == "application/pdf"

    def test_none_claimed_mime_accepted(self) -> None:
        """claimed_mime=None must not crash (client may omit Content-Type)."""
        content = _make_pdf()
        result = validate_file(content, "report.pdf", None)
        assert result == "application/pdf"
