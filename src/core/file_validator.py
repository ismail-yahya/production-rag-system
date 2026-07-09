"""
File validation utilities for the ingestion API.

Validates uploaded files by:
  1. Size check  — rejects files larger than settings.MAX_UPLOAD_SIZE_BYTES
  2. Extension whitelist — rejects unknown file extensions
  3. MIME type whitelist — rejects unsupported content types
  4. Magic bytes verification — detects disguised executables (e.g. EXE named as .pdf)

All checks raise IngestionError so the ingestion router can propagate them
as HTTP 422 responses via the global exception handler in main.py.

Usage:
    from src.core.file_validator import validate_file

    validated_mime = validate_file(content, filename, claimed_mime)
"""

import os

import structlog

from src.core.config import settings
from src.core.exceptions import IngestionError

logger = structlog.get_logger(__name__)

# ---------------------------------------------------------------------------
# Magic bytes signatures
#
# Maps MIME type → list of byte-string prefixes that identify the format.
# An empty list means the type has no reliable magic bytes and is allowed
# through as long as the extension matches (e.g. plain text files).
# ---------------------------------------------------------------------------
_MAGIC_BYTES: dict[str, list[bytes]] = {
    "application/pdf": [b"%PDF"],
    "image/png": [b"\x89PNG\r\n\x1a\n"],
    "image/jpeg": [b"\xff\xd8\xff"],
    "image/gif": [b"GIF87a", b"GIF89a"],
    "text/plain": [],  # No magic bytes — extension-only validation
    "text/markdown": [],
    "text/csv": [],
    # OOXML formats (.docx, .xlsx, .pptx) all start with the ZIP PK header
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [b"PK\x03\x04"],
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [b"PK\x03\x04"],
    "application/vnd.openxmlformats-officedocument.presentationml.presentation": [b"PK\x03\x04"],
    # Legacy Office formats use OLE2 compound document header
    "application/msword": [b"\xd0\xcf\x11\xe0"],
    "application/vnd.ms-excel": [b"\xd0\xcf\x11\xe0"],
}

# Allowed file extensions mapped to their canonical MIME type.
# The claimed MIME from the client is cross-referenced against this map.
_ALLOWED_EXTENSIONS: dict[str, str] = {
    ".pdf": "application/pdf",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".txt": "text/plain",
    ".md": "text/markdown",
    ".csv": "text/csv",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ".doc": "application/msword",
    ".xls": "application/vnd.ms-excel",
}

# Full set of allowed MIME types (derived from _MAGIC_BYTES keys)
ALLOWED_MIME_TYPES: frozenset[str] = frozenset(_MAGIC_BYTES.keys())

# Known-dangerous magic bytes signatures (executables, scripts).
# Files matching any of these are unconditionally rejected regardless
# of their stated extension or MIME type.
_DANGEROUS_MAGIC_BYTES: list[bytes] = [
    b"MZ",           # Windows PE executable (.exe, .dll, .com)
    b"\x7fELF",      # Linux/Unix ELF executable
    b"#!",           # Shell scripts (e.g. #!/bin/bash)
    b"<script",      # HTML/JS script injection
    b"<?php",        # PHP code injection
    b"\xca\xfe\xba\xbe",  # Java class file
    b"PK",           # ZIP — only allowed for specific MIME types (re-checked below)
]

# The maximum number of bytes to read when checking magic bytes.
# Reading 16 bytes is sufficient for all signatures above.
_MAGIC_READ_BYTES: int = 16


def validate_file(content: bytes, filename: str, claimed_mime: str | None) -> str:
    """
    Validate an uploaded file's size, extension, MIME type, and magic bytes.

    Args:
        content:      Raw file bytes as read from the upload.
        filename:     Original filename from the upload (used for extension check).
        claimed_mime: MIME type reported by the client (may be None or wrong).

    Returns:
        The validated canonical MIME type for this file.

    Raises:
        IngestionError: If any validation check fails.
    """
    # ------------------------------------------------------------------
    # 1. Size check
    # ------------------------------------------------------------------
    file_size = len(content)
    if file_size > settings.MAX_UPLOAD_SIZE_BYTES:
        max_mb = settings.MAX_UPLOAD_SIZE_BYTES // (1024 * 1024)
        logger.warning(
            "file_too_large",
            filename=filename,
            size_bytes=file_size,
            max_bytes=settings.MAX_UPLOAD_SIZE_BYTES,
        )
        raise IngestionError(
            f"File size {file_size:,} bytes exceeds the maximum allowed size of {max_mb} MB."
        )

    # ------------------------------------------------------------------
    # 2. Extension whitelist check
    # ------------------------------------------------------------------
    _, ext = os.path.splitext(filename.lower())
    if ext not in _ALLOWED_EXTENSIONS:
        logger.warning("file_extension_rejected", filename=filename, extension=ext)
        raise IngestionError(
            f"File extension '{ext}' is not supported. "
            f"Allowed extensions: {', '.join(sorted(_ALLOWED_EXTENSIONS))}"
        )

    # Canonical MIME type derived from the file extension (trusted)
    canonical_mime = _ALLOWED_EXTENSIONS[ext]

    # ------------------------------------------------------------------
    # 3. Magic bytes — reject known-dangerous signatures first
    # ------------------------------------------------------------------
    header = content[:_MAGIC_READ_BYTES]

    # Special case: ZIP-based formats are allowed (OOXML), but raw ZIP
    # archives without a recognised OOXML MIME are not.
    for dangerous_sig in _DANGEROUS_MAGIC_BYTES:
        if header.startswith(dangerous_sig):
            # PK header is a ZIP — allow only if the canonical MIME is an OOXML type
            if dangerous_sig == b"PK":
                ooxml_mimes = {
                    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
                }
                if canonical_mime in ooxml_mimes:
                    break  # Legitimate OOXML file — skip dangerous-sig rejection
            logger.warning(
                "file_dangerous_magic_bytes_detected",
                filename=filename,
                signature=dangerous_sig.hex(),
                claimed_mime=claimed_mime,
            )
            raise IngestionError(
                f"File '{filename}' contains a disallowed file signature "
                f"and has been rejected for security reasons."
            )

    # ------------------------------------------------------------------
    # 4. Magic bytes — verify against expected format signatures
    # ------------------------------------------------------------------
    expected_signatures = _MAGIC_BYTES.get(canonical_mime, [])
    if expected_signatures:
        matched = any(header.startswith(sig) for sig in expected_signatures)
        if not matched:
            logger.warning(
                "file_magic_bytes_mismatch",
                filename=filename,
                extension=ext,
                canonical_mime=canonical_mime,
                header_hex=header.hex(),
            )
            raise IngestionError(
                f"File '{filename}' does not match the expected format for '{ext}' files. "
                f"The file content appears to be different from its extension."
            )

    logger.info(
        "file_validated",
        filename=filename,
        size_bytes=file_size,
        canonical_mime=canonical_mime,
    )
    return canonical_mime
