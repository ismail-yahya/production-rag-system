from uuid import uuid4

from src.core.context import tenant_id_context


def test_tenant_id_context():
    """Verify tenant_id context variable behavior."""
    tenant_id = uuid4()
    
    # Test setting and getting
    token = tenant_id_context.set(tenant_id)
    assert tenant_id_context.get() == tenant_id
    
    # Test resetting
    tenant_id_context.reset(token)
    assert tenant_id_context.get() is None
