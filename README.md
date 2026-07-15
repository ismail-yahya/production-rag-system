# 🚀 Production-Grade RAG System

[![CI Pipeline](https://github.com/ismail-yahya/production-rag-system/actions/workflows/ci.yml/badge.svg)](https://github.com/ismail-yahya/production-rag-system/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python 3.12](https://img.shields.io/badge/python-3.12-blue.svg)](https://www.python.org/downloads/release/python-3120/)
[![Milestone 6](https://img.shields.io/badge/Milestone-6%20Completed-green.svg)](TASKS.md)

This is a production-grade, enterprise-ready Retrieval-Augmented Generation (RAG) system built with a focus on scalability, multi-user workspace isolation, secure JWT/Bcrypt authentication, and robust quality governance. It implements a layered, vendor-neutral provider abstraction architecture with hybrid retrieval, automated async ingestion, and a unified Next.js web application.

---

## 🏗️ Architecture Overview

The system follows a service-oriented architecture with four clearly bounded layers:

```mermaid
graph TD
    Client["Client\n(Next.js App)"]

    subgraph API["API Gateway Layer (FastAPI)"]
        Auth["JWT / Bcrypt Auth\n& Rate Limit Middleware"]
        RI["/v1/ingest endpoints"]
        RQ["/v1/query endpoints"]
        RA["/v1/admin endpoints"]
        RWS["/v1/workspaces endpoints"]
    end

    subgraph Processing["Processing Layer"]
        IW["Ingestion Worker\n(Celery)"]
        RP["RAG Pipeline\nService"]
        WS["Workspace / Access Service"]
    end

    subgraph Infra["Infrastructure Layer"]
        OS["Object Storage\n(MinIO / S3)"]
        MQ["Message Queue\n(Redis / Celery)"]
        VDB["Vector Store\n(Qdrant)"]
        PG["Relational DB\n(PostgreSQL)"]
        RC["Cache & Semantic Cache\n(Redis)"]
        LLM["LLM Provider\n(OpenAI / Anthropic / Gemini / Ollama)"]
        EMB["Embedding Provider\n(OpenAI / local)"]
        RR["Reranker\n(Cohere)"]
    end

    subgraph Obs["Observability Layer"]
        LS["LangSmith\n(Tracing)"]
        PM["Prometheus\n(Metrics)"]
        LOG["Structured Logs\n(structlog / stdout)"]
    end

    Client --> Auth
    Auth --> RI
    Auth --> RQ
    Auth --> RA
    Auth --> RWS

    RI --> OS
    RI --> MQ
    MQ --> IW
    IW --> OS
    IW --> EMB
    IW --> VDB
    IW --> PG

    RQ --> WS
    WS --> PG
    RQ --> RP
    RP --> RC
    RP --> EMB
    RP --> VDB
    RP --> RR
    RP --> LLM
    RP --> PG

    RP --> LS
    RP --> PM
    RP --> LOG
    IW --> LOG
```

### Modular Layers:

- **Frontend Interface**: Next.js client built with React, TypeScript, and Tailwind CSS. Supports user authentication, department workspace management, file uploads, persistent chat threads with sources, and compliance audit logs.
- **API Gateway Layer**: FastAPI-based RESTful API supporting JWT sessions, programmatic Bcrypt-hashed API keys, per-tenant rate limiters, and global exception mappings.
- **Workspaces & Access Control**: Filters retrieved documents dynamically by matching active user privileges and allowed document IDs before querying the vector store.
- **Ingestion Layer**: Asynchronous document parsing (PDF, Images), cleaning, and chunking enqueued via Celery background workers.
- **Retrieval Layer**: Combines dense vector search and BM25 keywords using Reciprocal Rank Fusion (RRF) and Cohere Reranking.
- **Observability**: End-to-end tracing with LangSmith, Prometheus metrics, and structured JSON logs (`structlog`).

---

## 🛠️ Tech Stack

| Component | Technology |
|---|---|
| **Frontend UI** | Next.js, React, Tailwind CSS, TypeScript |
| **Backend Framework** | FastAPI (Python 3.12) |
| **Vector Database** | Qdrant |
| **Relational DB** | PostgreSQL & SQLAlchemy |
| **Cache & Task Broker** | Redis |
| **Task Queue** | Celery |
| **Parsing** | PyMuPDF4LLM |
| **Evaluation** | RAGAS |
| **Deployment** | Docker & Docker Compose |

---

## 🚀 Getting Started

### 1️⃣ Environment Setup
```bash
# Install backend dependencies
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

### 3️⃣ Running the Backend
```bash
# Start API
uv run uvicorn src.api.main:app --reload
# Start Celery Worker
uv run celery -A src.workers.celery_app worker --loglevel=info
```

### 4️⃣ Launching the Next.js Frontend
```bash
cd frontend
# Install packages
npm install
# Start local dev server
npm run dev
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

This configuration includes resource limits, internal network isolation, and optimized worker concurrency.

---

## 📊 Benchmarks & Quality

- **Retrieval Latency**: < 200ms (P95) for collections up to 100k chunks.
- **Generation Quality**: Evaluated via RAGAS (Faithfulness, Answer Relevancy, Context Recall).
- **Security**: Regex-based prompt injection defense, JWT session verification, and user workspace dynamic document pre-filtering.

---

## ✅ Project Status: Milestone 6 Completed

| Milestone | Status | Key Deliverables |
|---|---|---|
| 1. Foundation | ✅ | Env setup, Docker, CI scaffold |
| 2. Provider Abstractions | ✅ | LLM/Embedder/VectorStore Factories |
| 3. Ingestion Pipeline | ✅ | Async PDF/Image processing |
| 4. Retrieval & RAG | ✅ | Hybrid search, Reranking, SSE Streaming |
| 4a. Observability | ✅ | LangSmith, Prometheus, Semantic Cache |
| 5. Evaluation | ✅ | RAGAS quality gate in CI |
| 6. Final Polish | ✅ | 100% coverage, Next.js web application, Prod Docker |

---
Developed and maintained by Ismail Yahya
