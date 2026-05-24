import asyncio
import time
import uuid

import httpx
import pytest
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from src.core.config import settings
from src.core.models import Tenant

# This E2E test assumes the RAG system is running (API, Worker, DB, etc.)
# It is designed to be run in a CI environment where `docker compose up` has been executed.

API_URL = "http://localhost:8000"
TEST_TENANT_NAME = "E2E Test Tenant"
TEST_API_KEY = "e2e-test-key"


async def seed_tenant():
    """Seeds a test tenant directly in the database."""
    engine = create_async_engine(settings.POSTGRES_DSN.get_secret_value())
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        tenant_id = uuid.uuid4()
        tenant = Tenant(
            id=tenant_id, name=TEST_TENANT_NAME, api_key_hash=TEST_API_KEY, is_active=True
        )
        session.add(tenant)
        await session.commit()
        return tenant_id


def test_full_rag_flow():
    """
    E2E flow:
    1. Seed tenant (via DB)
    2. Upload PDF
    3. Poll for indexing completion
    4. Query the system
    5. Assert on response quality
    """
    # Skip E2E test if API is not running or healthy
    try:
        resp = httpx.get(f"{API_URL}/ready", timeout=1.0)
        if resp.status_code != 200:
            pytest.skip("RAG API is not healthy/ready")
    except Exception:
        pytest.skip("RAG API is not running")

    # 1. Seed Tenant
    asyncio.run(seed_tenant())
    headers = {"Authorization": f"Bearer {TEST_API_KEY}"}

    # 2. Upload Document
    # Creating a dummy PDF content that pymupdf4llm can parse
    # A minimal PDF header
    pdf_content = b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>\nendobj\n4 0 obj\n<< /Length 51 >>\nstream\nBT /F1 12 Tf 70 700 Td (Hello E2E Test Content) Tj ET\nendstream\nendobj\nxref\n0 5\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n0000000115 00000 n\n0000000213 00000 n\ntrailer\n<< /Size 5 /Root 1 0 R >>\nstartxref\n314\n%%EOF"

    files = {"file": ("e2e_test.pdf", pdf_content, "application/pdf")}
    upload_resp = httpx.post(f"{API_URL}/v1/ingest", files=files, headers=headers, timeout=30)
    assert upload_resp.status_code == 202
    doc_id = upload_resp.json()["document_id"]

    # 3. Poll for status
    max_retries = 12  # 60 seconds total
    indexed = False
    for _ in range(max_retries):
        status_resp = httpx.get(f"{API_URL}/v1/documents/{doc_id}", headers=headers)
        if status_resp.status_code == 200 and status_resp.json()["status"] == "indexed":
            indexed = True
            break
        time.sleep(5)

    assert indexed, f"Document {doc_id} failed to reach 'indexed' status in time"

    # 4. Perform Query
    query_payload = {"question": "What is the content of the E2E test?", "mode": "vector"}
    query_resp = httpx.post(f"{API_URL}/v1/query", json=query_payload, headers=headers, timeout=30)
    assert query_resp.status_code == 200
    data = query_resp.json()

    assert "answer" in data
    assert len(data["sources"]) > 0
    # In a real E2E we might check for specific keywords in the answer
    # but since it's an LLM, we just check it returned something plausible.
    assert "E2E" in data["answer"] or "test" in data["answer"].lower()


if __name__ == "__main__":
    # This allows running the test standalone if needed
    try:
        test_full_rag_flow()
        print("E2E Test Passed!")
    except Exception as e:
        print(f"E2E Test Failed: {e}")
        exit(1)
