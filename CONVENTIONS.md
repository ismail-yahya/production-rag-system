# Conventions & Standards: Production-Grade RAG System

> This document defines the non-negotiable standards for this project.
> All contributors — human and AI — must follow these rules precisely and consistently.

## 1. Project Structure

```
rag-system/
├── src/
│   ├── api/
│   │   ├── __init__.py
│   │   ├── main.py
│   │   ├── dependencies.py
│   │   ├── middleware.py
│   │   └── routers/
│   │       ├── __init__.py
│   │       ├── ingestion.py
│   │       ├── query.py
│   │       └── admin.py
│   ├── core/
│   │   ├── __init__.py
│   │   ├── config.py
│   │   ├── exceptions.py
│   │   └── logging.py
│   ├── ingestion/
│   │   ├── __init__.py
│   │   ├── pipeline.py
│   │   ├── loaders/
│   │   │   ├── __init__.py
│   │   │   ├── base.py
│   │   │   ├── pdf_loader.py
│   │   │   └── image_loader.py
│   │   ├── processors/
│   │   │   ├── __init__.py
│   │   │   └── cleaner.py
│   │   └── chunkers/
│   │       ├── __init__.py
│   │       ├── base.py
│   │       ├── character_chunker.py
│   │       ├── semantic_chunker.py
│   │       └── structure_chunker.py
│   ├── embeddings/
│   │   ├── __init__.py
│   │   ├── base.py
│   │   ├── openai_embedder.py
│   │   ├── local_embedder.py
│   │   └── factory.py
│   ├── vectorstore/
│   │   ├── __init__.py
│   │   ├── base.py
│   │   ├── qdrant_store.py
│   │   └── factory.py
│   ├── retrieval/
│   │   ├── __init__.py
│   │   ├── vector_retriever.py
│   │   ├── bm25_retriever.py
│   │   ├── hybrid_retriever.py
│   │   └── reranker.py
│   ├── rag/
│   │   ├── __init__.py
│   │   ├── pipeline.py
│   │   ├── query_processor.py
│   │   ├── context_builder.py
│   │   ├── prompt_templates.py
│   │   └── security.py
│   ├── llm/
│   │   ├── __init__.py
│   │   ├── base.py
│   │   ├── openai_llm.py
│   │   ├── anthropic_llm.py
│   │   ├── ollama_llm.py
│   │   └── factory.py
│   ├── evaluation/
│   │   ├── __init__.py
│   │   ├── ragas_evaluator.py
│   │   └── dataset_generator.py
│   ├── observability/
│   │   ├── __init__.py
│   │   ├── tracer.py
│   │   └── metrics_collector.py
│   └── workers/
│       ├── __init__.py
│       ├── celery_app.py
│       └── ingestion_worker.py
├── tests/
│   ├── unit/
│   │   ├── ingestion/
│   │   ├── embeddings/
│   │   ├── retrieval/
│   │   ├── rag/
│   │   └── llm/
│   ├── integration/
│   │   ├── api/
│   │   └── workers/
│   └── e2e/
├── scripts/
│   ├── seed_data.py
│   └── evaluate.py
├── infrastructure/
│   ├── docker-compose.yml
│   ├── docker-compose.prod.yml
│   └── migrations/
│       └── versions/
├── demo/
│   └── app.py
├── .env.example
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── eval.yml
├── pyproject.toml
├── Dockerfile
└── README.md
```

**Directory purposes:**

- `src/api/` — FastAPI application entry point, route definitions, middleware, and dependency injection. Contains no business logic; delegates entirely to service layer.
- `src/core/` — Cross-cutting concerns: application config (Pydantic Settings), shared exception types, and logging setup. No imports from other `src/` subdirectories.
- `src/ingestion/` — All document ingestion logic: file loaders, text processors, and chunkers. Pipeline orchestrator is the only entry point from outside this module.
- `src/embeddings/` — Abstract embedder interface and all concrete provider implementations. Factory is the only entry point for consumers.
- `src/vectorstore/` — Abstract vector store interface and Qdrant implementation. Factory is the only entry point for consumers.
- `src/retrieval/` — Hybrid retrieval logic combining vector search and BM25, plus Cohere reranker. Depends on `embeddings` and `vectorstore` modules.
- `src/rag/` — RAG pipeline orchestration, query processing, context building, prompt templates, and input security guards. Depends on `retrieval` and `llm` modules.
- `src/llm/` — Abstract LLM interface and all concrete provider implementations (OpenAI, Anthropic, Ollama). Factory is the only entry point for consumers.
- `src/evaluation/` — RAGAS evaluation runner and automatic dataset generator. Not imported by any runtime path; used only by scripts and CI workflows.
- `src/observability/` — LangSmith tracing decorators and Prometheus metrics collectors. Imported by pipeline modules; never imports from them.
- `src/workers/` — Celery application definition and task implementations. Imports `ingestion.pipeline`; no other `src/` module imports from `workers/`.
- `tests/` — Mirrors `src/` structure. Unit tests are co-located by module; integration tests cover API routes and worker tasks; e2e tests cover full upload-to-query flows.
- `infrastructure/` — Docker Compose files and Alembic migration scripts. No Python application code.
- `demo/` — Single-file Streamlit application for end-to-end pipeline demonstration only.
- `scripts/` — Standalone CLI scripts for data seeding and evaluation runs. Not imported by application code.

---

## 2. Naming Conventions

| Artifact | Convention | Example |
|---|---|---|
| Python files | `snake_case` | `pdf_loader.py`, `hybrid_retriever.py` |
| Python modules (directories) | `snake_case` | `vectorstore/`, `ingestion/` |
| Classes | `PascalCase` | `QdrantVectorStore`, `RecursiveCharacterChunker` |
| Abstract base classes | `PascalCase` prefixed with `Base` | `BaseLLM`, `BaseEmbedder`, `BaseVectorStore` |
| Pydantic models | `PascalCase` | `LLMResponse`, `RAGResponse`, `HybridSearchConfig` |
| Functions / methods | `snake_case` | `embed_texts()`, `build_context()` |
| Async functions | `snake_case` — no special prefix | `async def retrieve()` not `async def async_retrieve()` |
| Variables | `snake_case` | `query_embedding`, `top_docs` |
| Constants (module-level) | `SCREAMING_SNAKE_CASE` | `RAG_SYSTEM_PROMPT`, `DEFAULT_SEPARATORS` |
| Factory classes | `PascalCase` suffixed with `Factory` | `LLMFactory`, `EmbedderFactory` |
| Enum classes | `PascalCase`; enum members `SCREAMING_SNAKE_CASE` | `class LLMProvider(str, Enum): OPENAI = "openai"` |
| PostgreSQL tables | `snake_case`, plural | `documents`, `ingestion_jobs`, `eval_datasets` |
| PostgreSQL columns | `snake_case` | `tenant_id`, `chunk_count`, `indexed_at` |
| Environment variables | `SCREAMING_SNAKE_CASE` | `OPENAI_API_KEY`, `QDRANT_URL`, `REDIS_BROKER_URL` |
| API endpoints | Lowercase, hyphen-separated path segments, versioned under `/v1/` | `/v1/ingest`, `/v1/query/stream` |
| Celery task names | Dot-namespaced string: `workers.<task_name>` | `workers.ingest_document` |
| Alembic migration files | `{revision_id}_{short_description}.py` | `a1b2c3d4_add_tenant_table.py` |

**Additional naming rules:**

- Test files must be named `test_<module_name>.py` and placed in the mirror path under `tests/`. Example: `tests/unit/ingestion/test_pdf_loader.py` mirrors `src/ingestion/loaders/pdf_loader.py`.
- Abstract base classes live exclusively in `base.py` within their module. Never define abstract classes in implementation files.
- Factory classes live exclusively in `factory.py` within their module. Never instantiate concrete provider classes directly outside a factory.
- Dataclasses used as value objects are named as nouns: `Chunk`, `RawDocument`, `Document`. Do not suffix them with `Data`, `Model`, or `DTO`.

---

## 3. Coding Standards

### 3.1 Streamlit (Demo Interface)

- The demo lives entirely in `demo/app.py` as a single file. Do not split it across multiple files.
- Use `st.session_state` for all state that persists across reruns. Never use module-level mutable variables as state.
- All API calls from the demo must use `httpx` with explicit timeout values. Never use `requests`.
- SSE streaming from `/v1/query/stream` must be consumed and rendered progressively using `st.write_stream` or an equivalent generator pattern. Do not buffer the full response before rendering.
- The demo must not import from `src/` directly. It communicates with the system exclusively via the HTTP API.

### 3.2 FastAPI (Backend)

- Every router function is `async def`. Synchronous route handlers are not permitted.
- Route handlers contain no business logic. They validate input, call a service or pipeline function, and return the result. Maximum 15 lines per route handler.
- All request and response bodies are defined as Pydantic `BaseModel` subclasses in a `schemas.py` file within the relevant router's scope. Never use raw `dict` as a request or response type.
- Use FastAPI's dependency injection (`Depends`) for all shared resources: database sessions, authenticated user context, service instances. Never instantiate services inside route handlers.
- Tenant context is injected via a `get_tenant` dependency that validates the Bearer token and returns the `Tenant` model. Every protected route must declare this dependency explicitly.
- All HTTP error responses use FastAPI's `HTTPException` with a `detail` field that is a plain string. Never return error information in a 200 response.
- Background tasks triggered from routes use Celery, not FastAPI's `BackgroundTasks`. `BackgroundTasks` is not used in this project.
- Rate limiting is applied at the middleware layer, not inside route handlers.

### 3.3 Pydantic & Configuration

- All application configuration is defined in a single `Settings` class in `src/core/config.py` using `pydantic-settings`. No other file reads environment variables directly.
- Every `Settings` field has an explicit type annotation and a default value or `...` (required). Never use bare `str` without validation constraints where applicable (e.g., use `SecretStr` for API keys).
- `Settings` is instantiated once at application startup and injected via dependency. Never call `Settings()` inside a function or loop.
- Pydantic models used for data exchange (request/response shapes, internal data structures) use `model_config = ConfigDict(frozen=True)` unless mutability is explicitly required and documented.

### 3.4 Abstract Interfaces & Factories

- Every provider category (LLM, Embedder, VectorStore, Chunker, Loader) has exactly one abstract base class in `base.py`. All abstract methods are decorated with `@abstractmethod`.
- Concrete implementations inherit from exactly one abstract base class. Multiple inheritance is not used.
- Factories use a `_registry` dict mapping an Enum value to a class. Adding a new provider requires only: implementing the interface, and adding one entry to the registry dict. No other file is modified.
- Factories return the abstract type, not the concrete type. Callers never reference concrete implementation classes.

```python
# Correct
def create(...) -> BaseLLM: ...

# Wrong
def create(...) -> OpenAILLM: ...
```

### 3.5 Async Patterns

- All I/O operations — HTTP calls, database queries, vector store operations, object storage reads/writes — must be `async`. Use `await` throughout; never call sync I/O from an async context.
- Never use `asyncio.run()` inside application code. It is permitted only in `scripts/` and test fixtures. In pipeline code that must call async from sync context (e.g., Celery tasks), use a dedicated event loop per task: `asyncio.get_event_loop().run_until_complete(...)`.
- Do not use `asyncio.gather()` for operations with side effects that must be individually retriable. Use sequential `await` calls instead.
- `asyncio.gather()` is permitted for read-only parallel operations (e.g., embedding multiple query expansions simultaneously).

### 3.6 Celery Workers

- Every Celery task is decorated with `bind=True`, `max_retries=3`, and `default_retry_delay=60`.
- Task functions are thin wrappers. All logic lives in `src/ingestion/pipeline.py`. The task function calls the pipeline and handles retry on exception; it contains no business logic itself.
- Tasks are always called with `.delay()` or `.apply_async()`. Never call task functions directly as Python functions in production code.
- Task results stored in Redis expire after 3600 seconds. Do not increase this value without explicit justification.

### 3.7 PostgreSQL & Alembic

- All database access uses SQLAlchemy async sessions (`AsyncSession`). Never use synchronous SQLAlchemy in this project.
- Raw SQL is not permitted. Use SQLAlchemy ORM or Core expression language exclusively.
- Every table has a UUID primary key generated at the application layer (not the database layer) using `uuid.uuid4()`.
- All timestamp columns are `TIMESTAMPTZ` (timezone-aware). Never use `TIMESTAMP WITHOUT TIME ZONE`.
- Every schema change requires an Alembic migration. Never modify the database schema manually or outside of a migration.
- Migration files include both `upgrade()` and `downgrade()` functions. A migration without a working `downgrade()` is not accepted.
- Add a database index for every foreign key column and every column used in a `WHERE` clause in a high-frequency query.

### 3.8 Qdrant

- Every vector search call must include a `tenant_id` filter. A search call without tenant scoping is a bug, not a missing feature.
- The collection name is derived from the environment config, never hardcoded.
- Upsert operations are always batched. Never upsert a single point in a loop; accumulate points and upsert as a batch.
- Embedding vectors are not returned in search results (`with_vectors=False`). Retrieve vectors only when explicitly required for a documented purpose.

### 3.9 General Rules (All Layers)

- No magic numbers or magic strings. All literal values used more than once, or that carry semantic meaning, are defined as named constants or config values.
- No dead code. Remove commented-out code before merging. Use Git history to recover removed code.
- Every function does one thing. If a function name requires "and" to describe it, split it.
- Maximum function length is 40 lines. Exceeding this is a signal to extract a helper function.
- No `print()` statements in `src/`. Use `structlog` for all output.
- All `TODO` comments must include a GitHub issue reference: `# TODO(#42): replace with async implementation`.
- Type annotations are required on all function signatures (parameters and return types). `Any` is permitted only when interfacing with untyped third-party libraries and must be accompanied by an inline comment explaining why.
- Use `dataclasses.dataclass` for simple value objects with no validation logic. Use `pydantic.BaseModel` for objects that cross API or service boundaries and require validation.

---

## 4. Error Handling & Logging

### Error Handling

**Exception hierarchy:** All application-specific exceptions inherit from a single base class defined in `src/core/exceptions.py`:

```python
class RAGSystemError(Exception): ...
class IngestionError(RAGSystemError): ...
class RetrievalError(RAGSystemError): ...
class EmbeddingError(RAGSystemError): ...
class LLMError(RAGSystemError): ...
class SecurityError(RAGSystemError): ...
```

**Backend (FastAPI):**
- Route handlers catch `RAGSystemError` subclasses and map them to appropriate HTTP status codes via a registered exception handler in `main.py`. Route handlers do not contain `try/except` blocks.
- `SecurityError` maps to `400 Bad Request`. `IngestionError` maps to `422 Unprocessable Entity`. `RetrievalError` and `LLMError` map to `503 Service Unavailable`.
- Unhandled exceptions propagate to FastAPI's default handler, which returns `500`. This is intentional — unexpected errors must not be silently swallowed.
- Never catch `Exception` as a broad catch in route handlers or service functions. Catch only the specific exception type you can meaningfully handle.

**Celery Workers:**
- Tasks catch all exceptions, log the full traceback at `ERROR` level, and call `self.retry(exc=exc)`. After `max_retries` is exceeded, Celery marks the task as `FAILURE` and the exception is not re-raised.
- Update `INGESTION_JOB.status = "failed"` and populate `error_message` before calling `self.retry()` on the final retry attempt.

**LLM & External API calls:**
- Wrap all external provider calls (OpenAI, Cohere, Anthropic) in a `try/except` that catches provider-specific exceptions and re-raises as the appropriate `RAGSystemError` subclass. Provider SDK exceptions must never propagate past the provider implementation class.

**Propagation rule:** Catch exceptions at the layer that can meaningfully handle or transform them. Let everything else propagate.

### Logging

**Library:** `structlog` with JSON renderer. Configured once in `src/core/logging.py`; never reconfigured elsewhere.

**Log levels:**
- `DEBUG` — Detailed pipeline internals (chunk counts, embedding batch sizes, cache hit/miss). Disabled in production by default.
- `INFO` — Significant pipeline events: document ingestion started/completed, query received, retrieval count, LLM call completed.
- `WARNING` — Recoverable unexpected states: empty retrieval results, cache write failure, reranker returning fewer results than requested.
- `ERROR` — Exceptions that result in a failed operation. Always include the full exception via `exc_info=True`.

**What must always be logged at INFO:**
- Every ingestion job start and completion, with `document_id`, `chunk_count`, and `latency_ms`.
- Every RAG query completion, with `question` (truncated to 100 chars), `retrieval_count`, `model`, and `latency_ms`.
- Every Celery task retry, with `task_id`, `retry_number`, and `exc` type.

**What must never be logged:**
- API keys, tokens, or any credential — at any log level.
- Full document content or full query text beyond 100 characters.
- User PII of any kind.
- Full LLM prompt or response content (log metadata only: token counts, model, latency).

---

## 5. State Management & Data Fetching

### State Ownership Rules

**Demo (Streamlit):**
- UI state (selected mode, active document filter, upload status) lives in `st.session_state`.
- Server state (list of indexed documents, query results) is fetched from the API and stored in `st.session_state` with an explicit TTL or invalidation trigger. It is never computed client-side.
- There is no global mutable state outside `st.session_state`.

**Backend (FastAPI / Workers):**
- Request-scoped state (authenticated tenant, parsed request body) is passed explicitly as function parameters. Never stored as instance variables on shared service objects.
- Application-scoped state (Settings, DB connection pool, Celery app) is instantiated once at startup and accessed via dependency injection or module-level singletons in `core/`.
- Pipeline instances (RAGPipeline, IngestionPipeline) are stateless. They hold references to stateless service objects (LLM, Embedder, VectorStore) and produce new output on every invocation.

### Data Fetching Rules

**Demo:**
- All API calls use `httpx.AsyncClient` with a 30-second timeout. Never use blocking `httpx.get/post`.
- Loading and error states must be explicitly handled for every API call. A pending API call renders a spinner; a failed call renders an error message. Silent failures are not permitted.

**Backend:**
- All database access is encapsulated in repository functions. Route handlers and pipeline functions call repository functions; they never construct SQLAlchemy queries directly.
- All vector store access is encapsulated in `BaseVectorStore` implementations. Pipeline functions never call the Qdrant client directly.
- Redis cache reads use a try/except; a cache miss or Redis connection failure must be handled gracefully by falling through to the uncached path. Cache failures must never cause a query failure.

---

## 6. Testing Standards

### Coverage Requirements

- `src/ingestion/` — minimum 80% line coverage.
- `src/retrieval/` — minimum 80% line coverage.
- `src/rag/` — minimum 75% line coverage.
- `src/llm/`, `src/embeddings/`, `src/vectorstore/` — abstract base classes and factories: 100% coverage; concrete implementations: mocked in unit tests, covered in integration tests.
- `src/api/routers/` — 100% of routes covered by integration tests.
- `src/core/` — 100% line coverage.

### Testing Rules

- Unit tests mock all external I/O: LLM API calls, embedding API calls, Qdrant, PostgreSQL, Redis, and MinIO. Never make real network calls in unit tests.
- Integration tests run against real Docker services (Qdrant, PostgreSQL, Redis) spun up via `docker compose` in the CI environment. They do not mock infrastructure.
- E2E tests call the live FastAPI application via HTTP, upload a real test document, and assert on query response content. They run only in the CI `eval.yml` workflow, not in `ci.yml`.
- Never test framework internals (e.g., FastAPI request parsing, Pydantic validation behavior). Test the application's behavior, not the library's.
- Never assert on log output in unit tests. Test return values and side effects only.
- Every test that exercises a provider abstraction (LLM, Embedder, VectorStore) must test through the abstract interface, not the concrete implementation, to validate substitutability.

### Test Structure

All tests follow the **Arrange / Act / Assert** pattern with explicit blank-line separation between phases. No exceptions.

```python
# test_hybrid_retriever.py

async def test_retriever_returns_fused_results():
    # Arrange
    mock_vector_store = MockVectorStore(returns=[doc_a, doc_b])
    mock_embedder = MockEmbedder(returns=[0.1, 0.2, ...])
    retriever = HybridRetriever(mock_vector_store, mock_embedder)

    # Act
    results = await retriever.retrieve("test query")

    # Assert
    assert len(results) == 2
    assert results[0].score > results[1].score
```

- `describe` blocks map to classes (optional); `it`/`test_` functions map to individual behaviors.
- Test function names follow: `test_<unit>_<condition>_<expected_outcome>`. Example: `test_cleaner_removes_page_numbers_from_pdf_text`.
- Fixtures are defined in `conftest.py` at the appropriate scope level. Module-level fixtures live in `tests/unit/<module>/conftest.py`; shared fixtures live in `tests/conftest.py`.

---

## 7. Git Workflow

### Branch Naming

```
<type>/<short-description>
```

Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`, `eval`

Examples:
- `feat/hybrid-retriever`
- `fix/tenant-filter-missing-in-search`
- `chore/update-qdrant-client`
- `eval/add-arabic-test-dataset`

Branch names are lowercase, hyphen-separated. No slashes beyond the type prefix. No ticket numbers in branch names.

### Commit Message Format

Follows [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <short description>

[optional body]

[optional footer: e.g., Closes #42]
```

**Types:** `feat` | `fix` | `docs` | `refactor` | `test` | `chore` | `eval`

**Scopes** map to `src/` module names: `api`, `ingestion`, `retrieval`, `rag`, `llm`, `embeddings`, `vectorstore`, `workers`, `evaluation`, `observability`, `core`, `infra`, `demo`

**Rules:**
- Short description is imperative, lowercase, no period: `add cohere reranker` not `Added Cohere Reranker.`
- Maximum 72 characters in the subject line.
- Body is required when the change is non-obvious. Explain *why*, not *what*.

**Examples:**
```
feat(retrieval): add reciprocal rank fusion to hybrid retriever

fix(workers): update ingestion job status to failed before retry

test(rag): add unit tests for prompt injection detection

chore(infra): pin qdrant-client to 1.9.0
```

### Pull Request Rules

- Maximum 400 lines changed per PR. Large changes must be decomposed into sequential PRs.
- Every PR must pass: `ruff check`, `ruff format --check`, `mypy`, and the full `pytest` unit and integration suite before merge.
- Every PR that adds or modifies a functional requirement must include corresponding tests. A PR that adds functionality without tests is not mergeable.
- The PR description must include: a one-sentence summary of what changed and why, a link to the relevant issue or PRD requirement (e.g., `FR-7`), and a note on whether evaluation scores were re-run if retrieval logic changed.
- Self-merge is permitted on solo projects. On multi-person teams, one approval is required.
- Merge strategy: **squash and merge** for feature branches. **merge commit** for release branches.

---

## 8. Environment & Configuration

- All environment variables are defined in `.env` (gitignored) for local development. `.env.example` is committed and kept up to date with every new variable added.
- Every environment variable used by the application is declared as a field in `src/core/config.py:Settings`. Variables not declared there are not read.
- The following must never be hardcoded anywhere in `src/`: API keys, database URLs, service hostnames, collection names, model identifiers, or threshold values. All must be sourced from `Settings`.
- `SecretStr` is used for all credential fields in `Settings`. Access their values via `.get_secret_value()` only at the point of use (inside provider constructors). Never pass `SecretStr` objects as strings.
- Environment variable naming convention: `SCREAMING_SNAKE_CASE`, prefixed by service where ambiguous.

| Variable | Example value | Notes |
|---|---|---|
| `OPENAI_API_KEY` | `sk-...` | `SecretStr` |
| `ANTHROPIC_API_KEY` | `sk-ant-...` | `SecretStr` |
| `COHERE_API_KEY` | `...` | `SecretStr` |
| `QDRANT_URL` | `http://localhost:6333` | |
| `QDRANT_COLLECTION_NAME` | `rag_chunks` | |
| `REDIS_BROKER_URL` | `redis://localhost:6379/0` | |
| `REDIS_BACKEND_URL` | `redis://localhost:6379/1` | |
| `POSTGRES_DSN` | `postgresql+asyncpg://...` | `SecretStr` |
| `MINIO_ENDPOINT` | `localhost:9000` | |
| `MINIO_ACCESS_KEY` | `...` | `SecretStr` |
| `LANGSMITH_API_KEY` | `ls__...` | `SecretStr` |
| `LLM_PROVIDER` | `openai` | Maps to `LLMProvider` enum |
| `EMBEDDING_PROVIDER` | `openai` | Maps to `EmbeddingProvider` enum |
| `LOG_LEVEL` | `INFO` | |

- Secrets in CI (GitHub Actions) are stored as repository secrets and injected as environment variables into the workflow. They are never echoed in logs.

### 8.1 Package Manager: `uv`

`uv` is the **canonical package manager** for this project. `pip` is not used directly anywhere — not locally, not in Dockerfiles, not in CI.

| Command | Purpose |
|---|---|
| `uv pip install .` | Install project + all dependencies from `pyproject.toml` |
| `uv pip install --editable .` | Editable install for local development |
| `uv pip compile pyproject.toml -o requirements.lock` | Generate a deterministic lock file |
| `uv venv .venv` | Create a virtual environment |

**Docker:** The `uv` binary is copied from `ghcr.io/astral-sh/uv:<version>` into the builder stage via `COPY --from`. It is **not** present in the runtime image, keeping the final image minimal.

**Version pinning:** The `uv` image tag in the `Dockerfile` must be an explicit semver tag (e.g., `0.7.2`), never `latest`, to ensure reproducible builds.

---

## 9. Code Formatting & Linting

| Tool | Purpose | Enforcement |
|---|---|---|
| `ruff` (formatter) | Code formatting — replaces Black | Pre-commit hook + CI `ci.yml` check |
| `ruff` (linter) | Linting — replaces Flake8, isort, pyupgrade | Pre-commit hook + CI `ci.yml` check |
| `mypy` | Static type checking | CI `ci.yml` check |
| `pytest` | Test runner | CI `ci.yml` check |
| `pytest-cov` | Coverage reporting | CI `ci.yml`; fails below module thresholds |

**Ruff configuration (in `pyproject.toml`):**

```toml
[tool.ruff]
line-length = 100
target-version = "py312"

[tool.ruff.lint]
select = ["E", "F", "I", "UP", "B", "C4", "SIM", "TCH"]
ignore = ["E501"]  # line length enforced by formatter, not linter

[tool.ruff.lint.isort]
known-first-party = ["src"]
```

**Key rules:**
- Line length: 100 characters maximum.
- Import ordering: standard library → third-party → first-party (`src/`). Enforced by `ruff` isort rules.
- All imports are absolute. Relative imports (`from .base import ...`) are not permitted.
- `UP` rules enforce Python 3.12+ syntax. Use `list[str]` not `List[str]`; use `X | Y` not `Optional[X]`.

**mypy configuration (in `pyproject.toml`):**

```toml
[tool.mypy]
python_version = "3.12"
strict = true
ignore_missing_imports = true
```

`strict = true` enforces: no untyped functions, no implicit `Any`, no untyped decorators. Exceptions require an inline `# type: ignore[<code>]` with a comment explaining why.

**Pre-commit hooks** (`.pre-commit-config.yaml`): run `ruff format`, `ruff check --fix`, and `mypy` on every commit. A commit that fails any hook is rejected. The hooks are installed via `pre-commit install` as part of the project setup documented in the README.
