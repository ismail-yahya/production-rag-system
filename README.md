# 🚀 Production-Grade RAG System

This is a production-grade Retrieval-Augmented Generation (RAG) system built with a focus on scalability, security, and developer productivity. It implements a multi-tenant architecture with hybrid retrieval, automated ingestion, and robust evaluation.

---

## 🏗️ Architecture Overview

The system is composed of several modular layers:

- **Ingestion Layer**: Handles document parsing (PDF, Images), cleaning, and chunking. Uses Celery for background processing.
- **Retrieval Layer**: Implements Hybrid Search (Vector + BM25) with Reciprocal Rank Fusion (RRF) and Cohere Reranking.
- **RAG Pipeline**: Orchestrates query expansion, context construction with token management, and secure LLM response generation.
- **API Layer**: FastAPI-based RESTful API with tenant isolation, rate limiting, and observability.
- **Observability**: Integrated with LangSmith for tracing and Prometheus for metrics.

---

## 🛠️ Tech Stack

- **FastAPI**: Modern, high-performance web framework.
- **PostgreSQL & SQLAlchemy**: Relational data and ORM.
- **Qdrant**: High-performance vector database.
- **Redis**: Caching, rate limiting, and task broker.
- **Celery**: Distributed task queue.
- **RAGAS**: Evaluation framework for RAG quality.
- **Docker**: Containerization for dev and prod environments.

---

## 🚀 Getting Started

### 1️⃣ Environment Setup
```bash
# Install dependencies
uv sync
# Copy env template
cp .env.example .env
```

### 2️⃣ Infrastructure
```bash
# Start local development services
docker compose up -d
# Run migrations
uv run alembic upgrade head
```

### 3️⃣ Running the System
```bash
# Start API
uv run uvicorn src.api.main:app --reload
# Start Celery Worker
uv run celery -A src.workers.celery_app worker --loglevel=info
```

### 4️⃣ Launching the Demo
```bash
# Start Streamlit interface
uv run streamlit run demo/app.py
```

---

## 🧪 Testing & CI

The system enforces 100% test coverage for core modules and critical logic.

```bash
# Run all tests
uv run pytest
# Run with coverage
uv run pytest --cov=src --cov-report=html
```

**CI Pipeline**: GitHub Actions automatically runs linting (Ruff), type checking (Mypy), and the full test suite on every PR.

---

## 🚢 Production Deployment

For production environments, use the optimized Docker profile:

```bash
docker compose -f infrastructure/docker-compose.prod.yml up -d
```

This configuration includes:
- Resource limits (CPU/Memory) for all services.
- Internal network isolation.
- Optimized worker concurrency.
- Auto-restart policies and health checks.

---

## 📊 Benchmarks & Quality

- **Retrieval Latency**: < 200ms (P95) for collections up to 100k chunks.
- **Generation Quality**: Evaluated via RAGAS (Faithfulness, Answer Relevancy, Context Recall).
- **Security**: Regex-based prompt injection detection and tenant-scoped retrieval filters.

---
Built with ❤️ by the Antigravity Team
