from contextvars import ContextVar
from uuid import UUID

# Context variable to store the tenant_id for the current request context.
# This allows the retrieval layer to access the tenant_id without it being
# passed explicitly through every function call.
tenant_id_context: ContextVar[UUID | None] = ContextVar("tenant_id", default=None)

# Context variable to store the user_id for the current request context.
# This allows mock database queries in tests to access the active user_id.
user_id_context: ContextVar[UUID | None] = ContextVar("user_id", default=None)

