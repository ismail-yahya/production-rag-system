# syntax=docker/dockerfile:1.4
# ── uv installer image (single source of truth for the binary version) ────────
FROM ghcr.io/astral-sh/uv:0.7.2 AS uv-bin

# ── Builder stage ─────────────────────────────────────────────────────────────
FROM python:3.12-slim-bookworm AS builder

# Bring uv in from the dedicated image — no pip/curl required
COPY --from=uv-bin /uv /usr/local/bin/uv

# uv runtime settings
ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /build

# Install build dependencies (libpq-dev needed to compile asyncpg/psycopg2)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy only the dependency manifest first → cache-friendly layer
COPY pyproject.toml .

# Create venv and install all dependencies declared in pyproject.toml.
# --mount=type=cache keeps the uv download cache across rebuilds (BuildKit).
RUN --mount=type=cache,target=/root/.cache/uv \
    uv venv /build/.venv && \
    uv pip install --python /build/.venv/bin/python .

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM python:3.12-slim-bookworm AS runtime

LABEL maintainer="AI Engineering Team"
LABEL description="Production-ready RAG System"

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app \
    PATH="/app/.venv/bin:$PATH"

WORKDIR /app

# Only runtime system libs — no build tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Non-root user
RUN groupadd -g 10001 appgroup && \
    useradd -u 10001 -g appgroup -m -s /bin/bash appuser

# Copy the fully-built venv from builder (no pip, no uv needed at runtime)
COPY --from=builder /build/.venv /app/.venv

# Copy source with correct ownership
COPY --chown=appuser:appgroup src/ /app/src/
COPY --chown=appuser:appgroup infrastructure/ /app/infrastructure/

USER appuser

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

EXPOSE 8000

CMD ["uvicorn", "src.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
