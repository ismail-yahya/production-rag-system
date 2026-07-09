"""
Phase 2 Integration Test — Authentication System
يختبر: JWT, bcrypt, API Keys بدون الحاجة لـ Docker أو DB حقيقية

الاختبارات:
  1. hash_password / verify_password
  2. generate_api_key / verify_api_key
  3. create_access_token / decode_access_token
  4. create_refresh_token / decode_refresh_token
  5. رفض token مزيف
  6. رفض refresh token في مكان access token
  7. permissions: require_role hierarchy check
"""
import os
import sys
import uuid

# ضبط JWT_SECRET_KEY في بيئة الاختبار
os.environ["JWT_SECRET_KEY"] = "cf44cc0a93390299ff7315229360154801b43614160a177c9751159f9e206c87"
os.environ.setdefault("OPENAI_API_KEY", "test-key")
os.environ.setdefault("QDRANT_URL", "http://localhost:6333")
os.environ.setdefault("QDRANT_COLLECTION_NAME", "test")
os.environ.setdefault("REDIS_BROKER_URL", "redis://localhost:6379/0")
os.environ.setdefault("REDIS_BACKEND_URL", "redis://localhost:6379/1")
os.environ.setdefault("POSTGRES_DSN", "postgresql+asyncpg://user:pass@localhost:5432/testdb")
os.environ.setdefault("MINIO_ENDPOINT", "localhost:9000")
os.environ.setdefault("MINIO_BUCKET_NAME", "test")

# ─────────────────────────────────────────────────────────────
PASS = "\033[92m✓\033[0m"
FAIL = "\033[91m✗\033[0m"
errors = []

def check(label: str, condition: bool, detail: str = "") -> None:
    if condition:
        print(f"  {PASS} {label}")
    else:
        print(f"  {FAIL} {label}" + (f" — {detail}" if detail else ""))
        errors.append(label)

# ─────────────────────────────────────────────────────────────
print("\n" + "═"*55)
print("  Phase 2 Authentication Tests")
print("═"*55)

# ─────────────────────────────────────────────────────────────
print("\n[1] Password Hashing (bcrypt)")
from src.api.auth import hash_password, verify_password

h = hash_password("SecurePass123!")
check("hash is not plaintext", h != "SecurePass123!")
check("hash starts with $2b$ (bcrypt)", h.startswith("$2"))
check("correct password verifies", verify_password("SecurePass123!", h))
check("wrong password rejected", not verify_password("WrongPass!", h))
check("empty password rejected", not verify_password("", h))

# ─────────────────────────────────────────────────────────────
print("\n[2] API Key Generation (bcrypt)")
from src.api.auth import generate_api_key, verify_api_key

raw, key_hash = generate_api_key()
check("raw key is 64 hex chars", len(raw) == 64)
check("hash differs from raw", raw != key_hash)
check("correct raw key verifies", verify_api_key(raw, key_hash))
check("wrong raw key rejected", not verify_api_key("0" * 64, key_hash))

# Two keys should never be identical
raw2, hash2 = generate_api_key()
check("two keys are unique", raw != raw2)

# ─────────────────────────────────────────────────────────────
print("\n[3] JWT Access Token")
from src.api.auth import create_access_token, decode_access_token, ACCESS_TOKEN_TYPE

user_id = uuid.uuid4()
tenant_id = uuid.uuid4()
role = "ADMIN"

token = create_access_token(user_id, tenant_id, role)
check("token is non-empty string", isinstance(token, str) and len(token) > 0)
check("token has 3 JWT segments", token.count(".") == 2)

payload = decode_access_token(token)
check("sub = user_id", payload["sub"] == str(user_id))
check("tid = tenant_id", payload["tid"] == str(tenant_id))
check("role = ADMIN", payload["role"] == role)
check("type = access", payload["type"] == ACCESS_TOKEN_TYPE)
check("exp present", "exp" in payload)
check("iat present", "iat" in payload)

# ─────────────────────────────────────────────────────────────
print("\n[4] JWT Refresh Token")
from src.api.auth import create_refresh_token, decode_refresh_token, REFRESH_TOKEN_TYPE

refresh = create_refresh_token(user_id)
ref_payload = decode_refresh_token(refresh)
check("sub = user_id", ref_payload["sub"] == str(user_id))
check("type = refresh", ref_payload["type"] == REFRESH_TOKEN_TYPE)
check("no role in refresh token", "role" not in ref_payload)
check("no tid in refresh token", "tid" not in ref_payload)

# ─────────────────────────────────────────────────────────────
print("\n[5] Token Security")
from src.core.exceptions import SecurityError

# Forged token
try:
    decode_access_token("eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJoYWNrIn0.INVALID_SIG")
    check("forged token rejected", False, "should have raised SecurityError")
except SecurityError:
    check("forged token rejected", True)

# Wrong token type: refresh used as access
try:
    decode_access_token(refresh)
    check("refresh-as-access rejected", False, "should have raised SecurityError")
except SecurityError:
    check("refresh-as-access rejected", True)

# Wrong token type: access used as refresh
try:
    decode_refresh_token(token)
    check("access-as-refresh rejected", False, "should have raised SecurityError")
except SecurityError:
    check("access-as-refresh rejected", True)

# Completely garbage token
try:
    decode_access_token("not.a.jwt")
    check("garbage token rejected", False)
except SecurityError:
    check("garbage token rejected", True)

# ─────────────────────────────────────────────────────────────
print("\n[6] Role Hierarchy (permissions module)")
from src.api.permissions import _role_level, ROLE_HIERARCHY, ALL_ROLES

check("USER < MANAGER", _role_level("USER") < _role_level("MANAGER"))
check("MANAGER < ADMIN", _role_level("MANAGER") < _role_level("ADMIN"))
check("ADMIN < SUPER_ADMIN", _role_level("ADMIN") < _role_level("SUPER_ADMIN"))
check("unknown role = -1", _role_level("GHOST") == -1)
check("hierarchy has 4 levels", len(ROLE_HIERARCHY) == 4)
check("all roles defined", ALL_ROLES == {"USER", "MANAGER", "ADMIN", "SUPER_ADMIN"})

# ─────────────────────────────────────────────────────────────
print("\n[7] Router Registration")
from src.api.main import app

paths = [r.path for r in app.routes if hasattr(r, "path")]
auth_endpoints = [
    "/v1/auth/login",
    "/v1/auth/refresh",
    "/v1/auth/api-keys",
    "/v1/users/me",
    "/v1/users",
    "/v1/users/{user_id}",
]
for ep in auth_endpoints:
    check(f"route exists: {ep}", ep in paths)

# ─────────────────────────────────────────────────────────────
print("\n" + "═"*55)
total = 35  # approximate total checks
if errors:
    print(f"\033[91m  FAILED: {len(errors)} check(s) failed\033[0m")
    for e in errors:
        print(f"    ✗ {e}")
    sys.exit(1)
else:
    print(f"\033[92m  ALL CHECKS PASSED ✓\033[0m")
    print(f"  {total}+ assertions verified")
print("═"*55 + "\n")
