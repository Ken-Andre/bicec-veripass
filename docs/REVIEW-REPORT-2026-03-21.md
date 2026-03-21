# 🔥 Code Review Report — BICEC VeriPass Authentication Module

**Date:** 2026-03-21  
**Reviewer:** AI Adversarial Code Review  
**Scope:** Recent git changes (Authentication, OTP, Security, KYC modules)  
**Files Reviewed:** 16 modified files

---

## Executive Summary

**Issues Found:** 14 total
- 🔴 **HIGH:** 4 issues (must fix before merge)
- 🟡 **MEDIUM:** 7 issues (should fix)
- 🟢 **LOW:** 3 issues (nice to fix)

**Overall Assessment:** The authentication module shows solid architecture with good separation of concerns, but has **critical security gaps** in JWT handling, OTP security, and rate limiting that must be addressed before production deployment.

---

## 🔴 HIGH SEVERITY ISSUES

### H1: JWT Secret Key Not Validated in Production

**File:** `code/backend/app/core/config.py`  
**Line:** 17

**Issue:**
```python
JWT_SECRET: str = "dev-secret-change-in-production"
```

The default JWT secret is a well-known development value. There's no validation to ensure this is changed in production.

**Impact:**
- If deployed with default config, attackers can forge JWT tokens
- Complete authentication bypass possible
- Session hijacking trivial

**Fix Required:**
```python
@field_validator("JWT_SECRET", mode="after")
@classmethod
def validate_jwt_secret(cls, v: str, info) -> str:
    env = info.data.get("ENVIRONMENT", "development")
    if env == "production" and v == "dev-secret-change-in-production":
        raise ValueError("JWT_SECRET MUST be changed in production")
    if env == "production" and len(v) < 32:
        raise ValueError("JWT_SECRET must be at least 32 characters in production")
    return v
```

---

### H2: OTP Stored in Plain Text in Redis

**File:** `code/backend/app/modules/auth/utils.py`  
**Lines:** 22-27

**Issue:**
```python
async def store_otp(identifier: str, otp: str, expire_minutes: int = settings.OTP_EXPIRY_MINUTES) -> bool:
    redis = await get_redis()
    key = f"otp:{identifier}"
    await redis.setex(key, expire_minutes * 60, otp)  # ← PLAIN TEXT STORAGE
```

OTP is stored as plain text in Redis. If Redis is compromised, all active OTPs are exposed.

**Impact:**
- Redis compromise = all active OTPs leaked
- No defense-in-depth for OTP storage
- Violates security best practices for sensitive data

**Fix Required:**
```python
from app.core.security import hash_password

async def store_otp(identifier: str, otp: str, expire_minutes: int = settings.OTP_EXPIRY_MINUTES) -> bool:
    redis = await get_redis()
    key = f"otp:{identifier}"
    # Hash OTP before storing (use same hash_password as DB for consistency)
    otp_hash = hash_password(otp)
    await redis.setex(key, expire_minutes * 60, otp_hash)
    return True

async def verify_otp(identifier: str, otp_to_verify: str) -> bool:
    redis = await get_redis()
    key = f"otp:{identifier}"
    stored_hash = await redis.get(key)
    
    if stored_hash is None:
        return False
    
    # Verify against bcrypt hash (slower but secure)
    from app.core.security import verify_password
    return verify_password(otp_to_verify, stored_hash)
```

---

### H3: No Rate Limit Key Isolation by User/IP

**File:** `code/backend/app/core/rate_limit.py` (not shown, but usage in router.py)  
**Referenced in:** `code/backend/app/modules/auth/router.py`

**Issue:**
Rate limiter is applied but there's no evidence of proper key isolation. All OTP requests may share the same rate limit bucket.

**Impact:**
- Attackers can bypass rate limits by rotating IPs
- No per-user rate limiting for authenticated endpoints
- Distributed attacks not mitigated

**Fix Required:**
Ensure rate limiter uses composite keys:
```python
# Rate limit key should include endpoint + IP + user identifier
rate_limit_key = f"{endpoint}:{request.client.host}:{phone if phone else email}"
```

**Action:** Review `code/backend/app/core/rate_limit.py` implementation to confirm proper key isolation.

---

### H4: Missing Refresh Token Revocation List

**File:** `code/backend/app/core/security.py`  
**Lines:** 94-107

**Issue:**
```python
def create_refresh_token(subject: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(days=7)
    to_encode = {
        "exp": expire,
        "sub": str(subject),
        "type": "refresh",
        "jti": str(_uuid.uuid4()),  # ← jti generated but NEVER stored/checked
    }
```

The `jti` (JWT ID) is generated for refresh tokens but there's no revocation list implementation. Compromised refresh tokens remain valid until expiry (7 days).

**Impact:**
- Stolen refresh tokens valid for full 7-day window
- No way to revoke tokens on password change or suspicious activity
- Session management vulnerability

**Fix Required:**
```python
# Add to models.py
class TokenRevocation(Base):
    __tablename__ = "token_revocations"
    jti = Column(UUID(as_uuid=True), primary_key=True)
    revoked_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    expires_at = Column(DateTime(timezone=True), nullable=False)

# Add to security.py
async def is_token_revoked(jti: str, db: AsyncSession) -> bool:
    result = await db.execute(select(TokenRevocation).where(TokenRevocation.jti == jti))
    return result.scalar_one_or_none() is not None

async def revoke_token(jti: str, expires_at: datetime, db: AsyncSession):
    revocation = TokenRevocation(jti=jti, expires_at=expires_at)
    db.add(revocation)
    await db.commit()

# Update decode_token to check revocation
async def decode_token_with_revocation(token: str, db: AsyncSession) -> Optional[dict]:
    payload = decode_token(token)
    if payload and payload.get("type") == "refresh":
        jti = payload.get("jti")
        if await is_token_revoked(jti, db):
            return None
    return payload
```

---

## 🟡 MEDIUM SEVERITY ISSUES

### M1: OTP Expiry Not Enforced Server-Side

**File:** `code/backend/app/modules/auth/models.py`  
**Line:** 42

**Issue:**
```python
expires_at = Column(DateTime(timezone=True), nullable=False)
```

The `expires_at` field exists but there's no evidence of server-side expiry validation in `verify_otp_endpoint`.

**Impact:**
- Expired OTPs in DB could theoretically be verified if Redis TTL fails
- Audit trail shows expired OTPs as valid

**Fix:**
Add explicit expiry check in `verify_otp_endpoint`:
```python
from datetime import datetime, timezone

# In verify_otp_endpoint, before verifying:
if otp_session.expires_at < datetime.now(timezone.utc):
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="OTP has expired",
    )
```

---

### M2: Weak PIN Validation

**File:** `code/backend/app/modules/auth/schemas.py`  
**Lines:** 20-25

**Issue:**
```python
ConstrainedPin = Annotated[
    str,
    StringConstraints(
        strip_whitespace=True,
        pattern=r"^\d{4,6}$",  # ← Allows 4-digit PIN
        min_length=4,
        max_length=6
    )
]
```

4-digit PINs are trivially brute-forceable (10,000 combinations).

**Impact:**
- 4-digit PIN can be brute-forced in minutes
- No lockout policy for PIN attempts visible in code

**Fix Required:**
```python
# Minimum 6 digits for PIN
pattern=r"^\d{6}$",
min_length=6,
max_length=6
```

Also add PIN attempt lockout similar to OTP:
```python
# In models.py, add to User:
pin_failed_attempts = Column(Integer, default=0)
pin_locked_until = Column(DateTime(timezone=True), nullable=True)
```

---

### M3: No Email Format Validation for OTP

**File:** `code/backend/app/modules/auth/utils.py`

**Issue:**
The `store_otp` function accepts any string as identifier. No validation that email addresses are properly formatted.

**Impact:**
- Malformed emails could be stored
- OTP could be sent to invalid addresses

**Fix:**
Add email validation before storing OTP for email:
```python
from pydantic import EmailStr

async def store_otp_for_email(email: str, otp: str, ...) -> bool:
    try:
        # Validate email format
        valid_email = EmailStr(email)
    except ValueError:
        logger.error(f"Invalid email format: {email}")
        return False
    return await store_otp(email, otp, ...)
```

---

### M4: Missing Error Handling in Celery Task

**File:** `code/backend/app/modules/auth/tasks.py`  
**Lines:** 14-25

**Issue:**
```python
@shared_task(
    name="app.modules.auth.tasks.send_otp_task",
    autoretry_for=(Exception,),
    retry_kwargs={'max_retries': 3},
    retry_backoff=True
)
def send_otp_task(phone: str, otp: str, email: Optional[str] = None):
```

The task retries on ALL exceptions, including non-retryable errors (e.g., invalid phone number, API auth failure).

**Impact:**
- Wastes resources retrying non-transient failures
- Delays proper error reporting to user
- Could spam Orange API on auth failures

**Fix:**
```python
# Define specific retryable exceptions
class RetryableException(Exception):
    pass

@shared_task(
    autoretry_for=(RetryableException, httpx.TimeoutException, httpx.NetworkError),
    ...
)
def send_otp_task(phone: str, otp: str, email: Optional[str] = None):
    # Only retry on network/timeout issues
```

---

### M5: No Audit Log for Token Refresh

**File:** `code/backend/app/modules/auth/router.py`  
**Lines:** 267-285

**Issue:**
```python
@router.post("/refresh", response_model=TokenResponse)
async def refresh_token(request: Request, body: RefreshTokenRequest):
    # No logging of refresh activity
```

Token refresh is a security-sensitive operation but isn't logged.

**Impact:**
- Can't detect token theft patterns
- No audit trail for session extension
- Compliance gap for financial services

**Fix:**
```python
logger.info(f"Token refresh: subject={subject}, ip={request.client.host}, user_agent={request.headers.get('user-agent')}")
```

---

### M6: Hardcoded CORS Origins

**File:** `code/backend/app/core/config.py`  
**Line:** 29

**Issue:**
```python
CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:3001"]
```

CORS origins are hardcoded. Production likely needs different domains.

**Impact:**
- Production deployments may have CORS issues
- Security risk if not properly configured per environment

**Fix:**
Add environment-specific CORS validation:
```python
@field_validator("CORS_ORIGINS", mode="before")
@classmethod
def assemble_cors_origins(cls, v: Union[str, List[str]]) -> List[str]:
    if isinstance(v, str):
        origins = [i.strip() for i in v.split(",") if i.strip()]
        # Validate no wildcards in production
        env = os.getenv("ENVIRONMENT", "development")
        if env == "production" and "*" in origins:
            raise ValueError("CORS wildcards not allowed in production")
        return origins
    return v
```

---

### M7: No Validation on Agent Role Assignment

**File:** `code/backend/app/modules/auth/models.py`  
**Line:** 30

**Issue:**
```python
role = Column(String(20), nullable=False) # JEAN, THOMAS, SYLVIE
```

No enum constraint or validation on agent roles. Any string can be inserted.

**Impact:**
- Invalid roles could be assigned
- RBAC bypass if role names don't match expected values
- No database-level integrity

**Fix:**
```python
from enum import Enum

class AgentRole(str, Enum):
    JEAN = "JEAN"      # KYC Validator
    THOMAS = "THOMAS"  # AML Supervisor
    SYLVIE = "SYLVIE"  # Operations Director
    ADMIN_IT = "ADMIN_IT"

# In model:
role = Column(Enum(AgentRole), nullable=False)
```

---

## 🟢 LOW SEVERITY ISSUES

### L1: Inconsistent Logging Format

**Files:** Multiple

**Issue:**
Some logs use `logger.info()`, others use `logger.warning()`, `logger.error()` without consistent structure.

**Impact:**
- Harder to parse logs programmatically
- Inconsistent alerting thresholds

**Recommendation:**
Standardize log format:
```python
logger.info("[AUTH] OTP sent", extra={"phone": phone, "method": "SMS"})
```

---

### L2: Missing Type Hints in Some Functions

**File:** `code/backend/app/modules/auth/utils.py`

**Issue:**
Some functions lack complete type hints.

**Impact:**
- Harder to maintain
- Type checkers can't catch errors

**Recommendation:**
Add complete type hints to all functions.

---

### L3: No Health Check Endpoint for Auth Module

**Issue:**
No `/health` endpoint in auth router to verify module status.

**Impact:**
- Can't monitor auth service health independently
- Kubernetes can't perform readiness probes

**Recommendation:**
```python
@router.get("/health")
async def health_check():
    return {"status": "healthy", "module": "auth"}
```

---

## Summary of Required Actions

### Must Fix Before Merge (HIGH):
1. ✅ **H1:** Add JWT secret validation for production
2. ✅ **H2:** Hash OTPs before storing in Redis
3. ✅ **H3:** Verify rate limiter has proper key isolation
4. ✅ **H4:** Implement refresh token revocation list

### Should Fix (MEDIUM):
5. ⏳ **M1:** Add server-side OTP expiry validation
6. ⏳ **M2:** Increase minimum PIN to 6 digits + add lockout
7. ⏳ **M3:** Add email format validation
8. ⏳ **M4:** Fix Celery retry logic for specific exceptions
9. ⏳ **M5:** Add audit logging for token refresh
10. ⏳ **M6:** Add CORS validation for production
11. ⏳ **M7:** Add enum constraint for agent roles

### Nice to Fix (LOW):
12. 📋 **L1:** Standardize logging format
13. 📋 **L2:** Add complete type hints
14. 📋 **L3:** Add health check endpoint

---

## Git vs Story Discrepancies

**Note:** No story file was provided for this review. The review was performed on git-detected changes:
- 16 files modified
- 1 file deleted (`code/test_celery.py`)
- 7 new untracked files

**Discrepancy:** No documentation of what changes were made or why. This is a **process violation** — all code changes should be linked to a story or issue.

---

## Compliance Notes

**COBAC R-2019/01 Compliance:**
- ✅ Audit trail partially implemented (OTPSession table)
- ❌ Token revocation missing (security gap)
- ❌ No evidence of transaction logging for authentication events

**Loi 2024-017 (Data Protection):**
- ✅ Password hashing with bcrypt
- ❌ OTP not hashed in Redis (defense-in-depth gap)
- ⚠️ PIN security could be stronger

---

**Review Status:** 🔴 **CHANGES REQUIRED** — Do not merge until HIGH issues are resolved.
