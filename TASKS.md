# TASKS.md — Project Execution Plan: Production-Grade RAG System

> This document is the single source of truth for building this project from zero to production.
> Work proceeds milestone by milestone. A milestone must meet its Definition of Done before the next begins.
> All tasks must conform to the standards in `CONVENTIONS.md` and be executed by the appropriate agent defined in `AGENTS.md`.

---

## Milestone 1: Foundation

**Goal:** A fully running local development environment with clean project structure, tooling, and all infrastructure services verified.

**Definition of Done:** `docker compose up` starts all six services (api, worker, qdrant, postgres, redis, minio) with zero errors. `ruff check`, `ruff format --check`, and `mypy` all pass on the empty scaffolded codebase. PostgreSQL connection is verified and the base Alembic migration applies cleanly. Pre-commit hooks reject a deliberately malformed commit.

- [x] **1.1** — Initialize repository with directory structure (`src/`, `tests/`, `infrastructure/`, `scripts/`, `demo/`, `.github/workflows/`) → `/` `[Agent: Infrastructure & DevOps Engineer]`
- [x] **1.2** — Configure `pyproject.toml` with `ruff` and `mypy` settings → `pyproject.toml` `[Agent: Infrastructure & DevOps Engineer]`
      ↳ Depends on: 1.1
- [x] **1.3** — Create `.pre-commit-config.yaml` with `ruff format`, `ruff check`, and `mypy` hooks → `.pre-commit-config.yaml` `[Agent: Infrastructure & DevOps Engineer]`
      ↳ Depends on: 1.2
- [x] **1.4** — Create `.env.example` with all environment variables placeholder values → `.env.example` `[Agent: Infrastructure & DevOps Engineer]`
- [x] **1.5** — Define `docker-compose.yml` with api, worker, qdrant, postgres, redis, and minio services → `infrastructure/docker-compose.yml` `[Agent: Infrastructure & DevOps Engineer]`
      ↳ Depends on: 1.4
- [x] **1.6** — Create all `__init__.py` files for every module under `src/` → `src/**/__init__.py` `[Agent: Infrastructure & DevOps Engineer]`
      ↳ Depends on: 1.1
- [x] **1.7** — Scaffold empty `Settings` class using `pydantic-settings` → `src/core/config.py` `[Agent: API Engineer]`
      ↳ Depends on: 1.6
- [x] **1.8** — Scaffold exception hierarchy (`RAGSystemError` and subclasses) → `src/core/exceptions.py` `[Agent: API Engineer]`
      ↳ Depends on: 1.6
- [x] **1.9** — Scaffold `structlog` JSON configuration → `src/core/logging.py` `[Agent: API Engineer]`
      ↳ Depends on: 1.6
- [x] **1.10** — Initialize Alembic and connect to PostgreSQL DSN from Settings → `infrastructure/migrations/` `[Agent: Data Engineer]`
      ↳ Depends on: 1.5, 1.7
- [x] **1.11** — Generate and apply base (empty) Alembic migration → `infrastructure/migrations/versions/` `[Agent: Data Engineer]`
      ↳ Depends on: 1.10
- [x] **1.12** — Write `Dockerfile` for the api/worker image → `Dockerfile` `[Agent: Infrastructure & DevOps Engineer]`
      ↳ Depends on: 1.1

---

## Milestone 2: Provider Abstraction Layer & Core Infrastructure

**Goal:** All abstract interfaces, factory classes, and the complete PostgreSQL schema are in place. Every provider contract is defined and all core infrastructure modules are fully operational.

**Definition of Done:** All abstract base classes and factories exist with 100% unit test coverage. All five ORM models are created with correct types and constraints. All Alembic migrations apply and roll back cleanly. `Settings` loads all required variables from `.env` with type validation. The exception hierarchy maps correctly to HTTP status codes in a smoke test.

- [x] **2.1** — Define all `Settings` fields with types, defaults, and `SecretStr` for credentials → `src/core/config.py` `[Agent: API Engineer]`
- [x] **2.2** — Finalize full exception hierarchy classes → `src/core/exceptions.py` `[Agent: API Engineer]`
- [x] **2.3** — Create `BaseLLM` abstract class with abstract methods and Pydantic models → `src/llm/base.py` `[Agent: LLM & Embeddings Engineer]`
- [x] **2.4** — Implement `OpenAILLM` concrete class → `src/llm/openai_llm.py` `[Agent: LLM & Embeddings Engineer]`
      ↳ Depends on: 2.3
- [x] **2.5** — Implement `AnthropicLLM` concrete class → `src/llm/anthropic_llm.py` `[Agent: LLM & Embeddings Engineer]`
      ↳ Depends on: 2.3
- [x] **2.6** — Implement `OllamaLLM` concrete class → `src/llm/ollama_llm.py` `[Agent: LLM & Embeddings Engineer]`
      ↳ Depends on: 2.3
- [x] **2.7** — Create `LLMFactory` with `LLMProvider` enum and registry → `src/llm/factory.py` `[Agent: LLM & Embeddings Engineer]`
      ↳ Depends on: 2.4, 2.5, 2.6
- [ ] **2.8** — Create `BaseEmbedder` abstract class → `src/embeddings/base.py` `[Agent: LLM & Embeddings Engineer]`
- [ ] **2.9** — Implement `OpenAIEmbedder` with batched embedding logic → `src/embeddings/openai_embedder.py` `[Agent: LLM & Embeddings Engineer]`
      ↳ Depends on: 2.8
- [ ] **2.10** — Implement `LocalEmbedder` using sentence-transformers → `src/embeddings/local_embedder.py` `[Agent: LLM & Embeddings Engineer]`
      ↳ Depends on: 2.8
- [ ] **2.11** — Create `EmbedderFactory` with registry → `src/embeddings/factory.py` `[Agent: LLM & Embeddings Engineer]`
      ↳ Depends on: 2.9, 2.10
- [ ] **2.12** — Create `BaseVectorStore` abstract class and `Document` dataclass → `src/vectorstore/base.py` `[Agent: LLM & Embeddings Engineer]`
- [ ] **2.13** — Implement `QdrantVectorStore` with batch upsert and tenant scoping → `src/vectorstore/qdrant_store.py` `[Agent: LLM & Embeddings Engineer]`
      ↳ Depends on: 2.12
- [ ] **2.14** — Create `VectorStoreFactory` with registry → `src/vectorstore/factory.py` `[Agent: LLM & Embeddings Engineer]`
      ↳ Depends on: 2.13
- [ ] **2.15** — Define `Tenant` ORM model → `src/core/models.py` `[Agent: Data Engineer]`
- [ ] **2.16** — Define `Document` ORM model with JSONB metadata → `src/core/models.py` `[Agent: Data Engineer]`
      ↳ Depends on: 2.15
- [ ] **2.17** — Define `Chunk` ORM model → `src/core/models.py` `[Agent: Data Engineer]`
      ↳ Depends on: 2.15, 2.16
- [ ] **2.18** — Define `IngestionJob` ORM model → `src/core/models.py` `[Agent: Data Engineer]`
      ↳ Depends on: 2.16
- [ ] **2.19** — Define `EvalDataset` ORM model → `src/core/models.py` `[Agent: Data Engineer]`
      ↳ Depends on: 2.16
- [ ] **2.20** — Generate Alembic migration for all 5 tables with UUID PKs and TIMESTAMPTZ → `infrastructure/migrations/versions/` `[Agent: Data Engineer]`
      ↳ Depends on: 2.15, 2.16, 2.17, 2.18, 2.19
- [ ] **2.21** — Write unit tests for LLM, Embedder, and VectorStore base classes and factories → `tests/unit/` `[Agent: LLM & Embeddings Engineer]`
      ↳ Depends on: 2.7, 2.11, 2.14

---

## Milestone 3: Ingestion Pipeline

**Goal:** The complete document ingestion path is operational — from file upload through parsing, cleaning, chunking, embedding, and indexing — running asynchronously via Celery.

**Definition of Done:** A PDF uploaded via `POST /v1/ingest` is accepted, persisted to MinIO, enqueued as a Celery task, and fully indexed in Qdrant with chunk metadata in PostgreSQL. `GET /v1/documents/{id}` reflects status transitions from `pending` → `processing` → `indexed`. A failed ingestion retries up to 3 times and sets status to `failed` with an `error_message`.

- [ ] **3.1** — Create `BaseLoader` abstract class and `RawDocument` dataclass → `src/ingestion/loaders/base.py` `[Agent: Ingestion Engineer]`
- [ ] **3.2** — Implement `PDFLoader` using pymupdf4llm → `src/ingestion/loaders/pdf_loader.py` `[Agent: Ingestion Engineer]`
      ↳ Depends on: 3.1
- [ ] **3.3** — Implement `ImageLoader` using OpenAI Vision API → `src/ingestion/loaders/image_loader.py` `[Agent: Ingestion Engineer]`
      ↳ Depends on: 3.1
- [ ] **3.4** — Implement `TextCleaner` with unicode normalization and artifact removal → `src/ingestion/processors/cleaner.py` `[Agent: Ingestion Engineer]`
- [ ] **3.5** — Create `BaseChunker` abstract class and `Chunk` dataclass → `src/ingestion/chunkers/base.py` `[Agent: Ingestion Engineer]`
- [ ] **3.6** — Implement `RecursiveCharacterChunker` → `src/ingestion/chunkers/character_chunker.py` `[Agent: Ingestion Engineer]`
      ↳ Depends on: 3.5
- [ ] **3.7** — Implement `IngestionPipeline` orchestrator → `src/ingestion/pipeline.py` `[Agent: Ingestion Engineer]`
      ↳ Depends on: 3.2, 3.3, 3.4, 3.6
- [ ] **3.8** — Configure Celery app with Redis broker and JSON serialization → `src/workers/celery_app.py` `[Agent: Infrastructure & DevOps Engineer]`
- [ ] **3.9** — Implement `ingest_document` Celery task wrapping `IngestionPipeline` → `src/workers/ingestion_worker.py` `[Agent: Infrastructure & DevOps Engineer]`
      ↳ Depends on: 3.7, 3.8
- [ ] **3.10** — Create repository functions for Document and IngestionJob CRUD → `src/api/repositories.py` `[Agent: Data Engineer]`
- [ ] **3.11** — Define Pydantic schemas for ingestion request/response → `src/api/routers/schemas.py` `[Agent: API Engineer]`
- [ ] **3.12** — Implement `POST /v1/ingest`, `GET /v1/documents`, `GET /v1/documents/{id}`, `DELETE /v1/documents/{id}` routes → `src/api/routers/ingestion.py` `[Agent: API Engineer]`
      ↳ Depends on: 3.9, 3.10, 3.11
- [ ] **3.13** — Implement `get_tenant` dependency validating Bearer token → `src/api/dependencies.py` `[Agent: API Engineer]`
- [ ] **3.14** — Implement rate limiting middleware → `src/api/middleware.py` `[Agent: API Engineer]`
- [ ] **3.15** — Instantiate FastAPI app, register routers, and add global exception handler → `src/api/main.py` `[Agent: API Engineer]`
      ↳ Depends on: 3.12, 3.13, 3.14
- [ ] **3.16** — Write unit tests for loaders, chunkers, cleaner, and pipeline → `tests/unit/ingestion/` `[Agent: Ingestion Engineer]`
      ↳ Depends on: 3.7
- [ ] **3.17** — Write integration tests for ingestion routes → `tests/integration/api/` `[Agent: API Engineer]`
      ↳ Depends on: 3.15

---

## Milestone 4: Retrieval & RAG Pipeline

**Goal:** The complete RAG query path is operational — hybrid retrieval, reranking, context construction, prompt security, and streaming LLM response — exposed through the query API.

**Definition of Done:** `POST /v1/query` returns a grounded, source-cited answer with `retrieval_count`, `model`, `latency_ms`, and a `sources` array. `POST /v1/query/stream` streams tokens as SSE events and emits a final `sources` event followed by `done`. Every retrieval call is filtered by `tenant_id`. Detected prompt injection returns `400`. Empty retrieval returns a graceful no-results response, not an error.

- [ ] **4.1** — Implement `VectorRetriever` wrapping vector store search → `src/retrieval/vector_retriever.py` `[Agent: Retrieval Engineer]`
- [ ] **4.2** — Implement `BM25Retriever` using rank_bm25 → `src/retrieval/bm25_retriever.py` `[Agent: Retrieval Engineer]`
- [ ] **4.3** — Implement `HybridRetriever` with RRF fusion → `src/retrieval/hybrid_retriever.py` `[Agent: Retrieval Engineer]`
      ↳ Depends on: 4.1, 4.2
- [ ] **4.4** — Implement `CohereReranker` wrapping Cohere SDK → `src/retrieval/reranker.py` `[Agent: Retrieval Engineer]`
- [ ] **4.5** — Implement `SecurityGuard` with injection regex patterns → `src/rag/security.py` `[Agent: RAG Pipeline Engineer]`
- [ ] **4.6** — Implement `QueryProcessor` for query expansion and classification → `src/rag/query_processor.py` `[Agent: RAG Pipeline Engineer]`
- [ ] **4.7** — Implement `ContextBuilder` enforcing token limits → `src/rag/context_builder.py` `[Agent: RAG Pipeline Engineer]`
- [ ] **4.8** — Define prompt templates as module constants → `src/rag/prompt_templates.py` `[Agent: RAG Pipeline Engineer]`
- [ ] **4.9** — Define `RAGResponse` frozen Pydantic model → `src/rag/schemas.py` `[Agent: RAG Pipeline Engineer]`
- [ ] **4.10** — Implement `RAGPipeline` blocking and streaming methods → `src/rag/pipeline.py` `[Agent: RAG Pipeline Engineer]`
      ↳ Depends on: 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9
- [ ] **4.11** — Define Pydantic schemas for query endpoints → `src/api/routers/schemas.py` `[Agent: API Engineer]`
- [ ] **4.12** — Implement `POST /v1/query` and `POST /v1/query/stream` routes → `src/api/routers/query.py` `[Agent: API Engineer]`
      ↳ Depends on: 4.10, 4.11
- [ ] **4.13** — Implement stub admin routes (`/v1/admin/stats`, `/v1/admin/eval/*`) → `src/api/routers/admin.py` `[Agent: API Engineer]`
- [ ] **4.14** — Add `/health` and `/ready` endpoints to FastAPI app → `src/api/main.py` `[Agent: API Engineer]`
- [ ] **4.15** — Write unit tests for retrieval and RAG pipeline components → `tests/unit/retrieval/`, `tests/unit/rag/` `[Agent: Retrieval Engineer, RAG Pipeline Engineer]`
      ↳ Depends on: 4.10
- [ ] **4.16** — Write integration tests for query routes → `tests/integration/api/` `[Agent: API Engineer]`
      ↳ Depends on: 4.12

---

## Milestone 4a: Security, Observability & Semantic Cache

**Goal:** The full observability stack is instrumented, tenant isolation is architecturally enforced at the middleware layer, and the semantic cache reduces redundant LLM calls for repeated queries.

**Definition of Done:** LangSmith receives traces for every query. Prometheus `/metrics` endpoint exposes required metrics. The semantic cache returns a cached response for semantically similar queries. The tenant isolation middleware injects `tenant_id` into request state and retrieval respects it.

- [ ] **4a.1** — Implement LangSmith `@traceable` decorator utility → `src/observability/tracer.py` `[Agent: RAG Pipeline Engineer]`
- [ ] **4a.2** — Implement `MetricsCollector` with Prometheus metrics → `src/observability/metrics_collector.py` `[Agent: API Engineer]`
- [ ] **4a.3** — Register `/metrics` route in FastAPI app → `src/api/main.py` `[Agent: API Engineer]`
      ↳ Depends on: 4a.2
- [ ] **4a.4** — Implement `TenantIsolationMiddleware` injecting `tenant_id` → `src/api/middleware.py` `[Agent: API Engineer]`
- [ ] **4a.5** — Update `HybridRetriever` to enforce `tenant_id` filter from request state → `src/retrieval/hybrid_retriever.py` `[Agent: Retrieval Engineer]`
      ↳ Depends on: 4a.4
- [ ] **4a.6** — Implement Redis `SemanticCache` → `src/core/cache.py` `[Agent: RAG Pipeline Engineer]`
- [ ] **4a.7** — Update `RAGPipeline` to check and write to `SemanticCache` → `src/rag/pipeline.py` `[Agent: RAG Pipeline Engineer]`
      ↳ Depends on: 4a.6
- [ ] **4a.8** — Verify structured JSON logging across ingestion and query flows without leaking PII/credentials → `src/core/logging.py` `[Agent: API Engineer]`

---

## Milestone 5: Evaluation Pipeline & Quality Gate

**Goal:** The RAGAS evaluation pipeline is operational and enforced as a CI quality gate that blocks deployment on regression.

**Definition of Done:** `scripts/evaluate.py` runs end-to-end against the committed evaluation dataset and prints per-metric scores. The `eval.yml` GitHub Actions workflow triggers on merge to `main`, runs the full evaluation, and fails the pipeline if metrics are below thresholds.

- [ ] **5.1** — Implement `RAGASEvaluator` wrapping RAGAS `evaluate()` → `src/evaluation/ragas_evaluator.py` `[Agent: RAG Pipeline Engineer]`
- [ ] **5.2** — Implement `EvalDatasetGenerator` → `src/evaluation/dataset_generator.py` `[Agent: RAG Pipeline Engineer]`
- [ ] **5.3** — Commit baseline evaluation dataset JSON → `tests/eval_dataset.json` `[Agent: RAG Pipeline Engineer]`
- [ ] **5.4** — Implement async evaluation script `evaluate.py` → `scripts/evaluate.py` `[Agent: Infrastructure & DevOps Engineer]`
      ↳ Depends on: 5.1, 5.3
- [ ] **5.5** — Implement GitHub Actions evaluation workflow → `.github/workflows/eval.yml` `[Agent: Infrastructure & DevOps Engineer]`
      ↳ Depends on: 5.4
- [ ] **5.6** — Fully implement `POST /v1/admin/eval/run` endpoint → `src/api/routers/admin.py` `[Agent: API Engineer]`
      ↳ Depends on: 5.4
- [ ] **5.7** — Fully implement `GET /v1/admin/eval/results` endpoint → `src/api/routers/admin.py` `[Agent: API Engineer]`

---

## Milestone 6: Testing, CI & Deployment

**Goal:** The codebase meets all coverage thresholds, all CI checks pass, the full system is containerized for production, and the demo interface is operational.

**Definition of Done:** `pytest --cov` passes all module coverage thresholds. `ci.yml` passes on a clean branch. The Streamlit demo loads, accepts file uploads, polls status, and streams query responses. `docker-compose.prod.yml` starts the system with production limits.

- [ ] **6.1** — Implement CI GitHub Actions workflow → `.github/workflows/ci.yml` `[Agent: Infrastructure & DevOps Engineer]`
- [ ] **6.2** — Create production Docker Compose profile → `infrastructure/docker-compose.prod.yml` `[Agent: Infrastructure & DevOps Engineer]`
- [ ] **6.3** — Write E2E testing flows for upload-to-query → `tests/e2e/test_flow.py` `[Agent: API Engineer]`
- [ ] **6.4** — Achieve 100% test coverage for `src/core/` and provider factories → `tests/unit/` `[Agent: LLM & Embeddings Engineer]`
- [ ] **6.5** — Achieve 100% integration test coverage for API routes → `tests/integration/api/` `[Agent: API Engineer]`
- [ ] **6.6** — Implement Streamlit demo interface → `demo/app.py` `[Agent: API Engineer]`
- [ ] **6.7** — Finalize `README.md` with architecture diagram, benchmarks, and setup instructions → `README.md` `[Agent: Infrastructure & DevOps Engineer]`
      ↳ Depends on: 6.6
