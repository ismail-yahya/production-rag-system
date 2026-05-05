import uuid
from datetime import datetime
from src.core.models import Tenant, Document, Chunk, IngestionJob, QueryLog, EvalDataset

def test_tenant_repr():
    tenant_id = uuid.uuid4()
    tenant = Tenant(id=tenant_id, name="Test")
    assert f"id='{tenant_id}'" in repr(tenant)
    assert "name='Test'" in repr(tenant)

def test_document_repr():
    doc_id = uuid.uuid4()
    doc = Document(id=doc_id, file_name="test.pdf")
    assert f"id='{doc_id}'" in repr(doc)
    assert "name='test.pdf'" in repr(doc)

def test_model_instantiation():
    """Verify basic instantiation of all models."""
    tenant = Tenant(name="T", api_key_hash="H")
    doc = Document(tenant_id=tenant.id, file_name="F", file_type="T", storage_path="P")
    chunk = Chunk(document_id=doc.id, tenant_id=tenant.id, chunk_index=0, total_chunks=1)
    job = IngestionJob(document_id=doc.id, status="pending")
    log = QueryLog(tenant_id=tenant.id, query_text="Q")
    eval_data = EvalDataset(question="Q", ground_truth_answer="A", question_type="T")
    
    assert tenant.name == "T"
    assert doc.file_name == "F"
    assert chunk.chunk_index == 0
    assert job.status == "pending"
    assert log.query_text == "Q"
    assert eval_data.question == "Q"
