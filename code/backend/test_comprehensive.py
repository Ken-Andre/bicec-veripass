"""
COMPREHENSIVE SYSTEM TEST SUITE - BICEC VeriPass
Tests: All personas, all modules, all infrastructure
"""

import httpx

BASE = "http://localhost:8000/api/v1"
passed = 0
failed = 0
results = []


def test(category, name, method, url, headers=None, json_body=None, expected=200):
    global passed, failed
    h = headers or {}
    try:
        if method == "GET":
            r = httpx.get(url, headers=h, timeout=10)
        elif method == "POST":
            r = httpx.post(url, headers=h, json=json_body, timeout=10)
        elif method == "PUT":
            r = httpx.put(url, headers=h, json=json_body, timeout=10)
        elif method == "DELETE":
            r = httpx.delete(url, headers=h, timeout=10)
        status = "PASS" if r.status_code == expected else "FAIL"
        path = url.replace(BASE, "")
        results.append(f"{status} | {r.status_code:3d} | {method:6s} {path} | {name}")
        if r.status_code != expected:
            results.append(f"       Expected {expected}, got {r.status_code}")
            results.append(f"       Body: {r.text[:150]}")
            failed += 1
        else:
            passed += 1
        return r
    except Exception as e:
        results.append(f"FAIL |  --- | {method:6s} {url} | {name}")
        results.append(f"       Error: {str(e)[:150]}")
        failed += 1
        return None


def section(title):
    results.append("")
    results.append("=" * 70)
    results.append(title)
    results.append("=" * 70)


# ===== SETUP =====
section("SETUP")

# Mobile user
r = httpx.post(BASE + "/auth/otp/send", json={"phone": "+237691000001"})
mobile_otp = r.json().get("otp_debug", "")
r = httpx.post(
    BASE + "/auth/otp/verify", json={"phone": "+237691000001", "otp": mobile_otp}
)
MOBILE_TOKEN = r.json().get("access_token", "")
results.append("Mobile user created, token obtained")

# Set email on mobile user
r = httpx.post(
    BASE + "/auth/email/send",
    json={"email": "marie@test.cm"},
    headers={"Authorization": "Bearer " + MOBILE_TOKEN},
)
email_otp = r.json().get("otp_debug", "")
r = httpx.post(
    BASE + "/auth/email/verify",
    json={"otp": email_otp},
    headers={"Authorization": "Bearer " + MOBILE_TOKEN},
)
results.append("Email set on mobile user, email OTP verified")


# Agent tokens
def agent_token(email):
    r = httpx.post(
        BASE + "/auth/agent/login", json={"email": email, "password": "password123"}
    )
    return r.json().get("access_token", "")


JEAN_TOKEN = agent_token("jean@bicec.cm")
THOMAS_TOKEN = agent_token("thomas@bicec.cm")
SYLVIE_TOKEN = agent_token("sylvie@bicec.cm")
ADMIN_TOKEN = agent_token("admin@bicec.cm")
results.append("All agent tokens obtained")

# ===== MARIE (MOBILE USER) JOURNEY =====
section("MARIE JOURNEY - Mobile User")

test(
    "Marie",
    "OTP Send",
    "POST",
    BASE + "/auth/otp/send",
    json_body={"phone": "+237691000002"},
)
test(
    "Marie",
    "OTP Verify",
    "POST",
    BASE + "/auth/otp/verify",
    json_body={"phone": "+237691000002", "otp": "123456"},
)
test(
    "Marie",
    "Get Profile",
    "GET",
    BASE + "/auth/me",
    headers={"Authorization": "Bearer " + MOBILE_TOKEN},
)
test(
    "Marie",
    "KYC Session Start",
    "POST",
    BASE + "/kyc/session/start",
    headers={"Authorization": "Bearer " + MOBILE_TOKEN},
)
test(
    "Marie",
    "KYC Session Current",
    "GET",
    BASE + "/kyc/session/current",
    headers={"Authorization": "Bearer " + MOBILE_TOKEN},
)
test("Marie", "KYC Geo Regions", "GET", BASE + "/kyc/geo/regions")
test("Marie", "KYC Geo Cities", "GET", BASE + "/kyc/geo/cities/CE")
test("Marie", "KYC Geo Quartiers", "GET", BASE + "/kyc/geo/quartiers/YDE")

# ===== JEAN (KYC VALIDATOR) JOURNEY =====
section("JEAN JOURNEY - KYC Validator")

test(
    "Jean",
    "Login",
    "POST",
    BASE + "/auth/agent/login",
    json_body={"email": "jean@bicec.cm", "password": "password123"},
)
test(
    "Jean",
    "Get Profile",
    "GET",
    BASE + "/auth/agent/me",
    headers={"Authorization": "Bearer " + JEAN_TOKEN},
)
test(
    "Jean",
    "View Queue",
    "GET",
    BASE + "/backoffice/queue",
    headers={"Authorization": "Bearer " + JEAN_TOKEN},
)
test(
    "Jean",
    "View Audit (403)",
    "GET",
    BASE + "/backoffice/audit-logs",
    headers={"Authorization": "Bearer " + JEAN_TOKEN},
    expected=403,
)
test(
    "Jean",
    "View AML (403)",
    "GET",
    BASE + "/aml/alerts",
    headers={"Authorization": "Bearer " + JEAN_TOKEN},
    expected=403,
)

# ===== THOMAS (AML/CFT) JOURNEY =====
section("THOMAS JOURNEY - AML/CFT Supervisor")

test(
    "Thomas",
    "Login",
    "POST",
    BASE + "/auth/agent/login",
    json_body={"email": "thomas@bicec.cm", "password": "password123"},
)
test(
    "Thomas",
    "Get Profile",
    "GET",
    BASE + "/auth/agent/me",
    headers={"Authorization": "Bearer " + THOMAS_TOKEN},
)
test(
    "Thomas",
    "View AML Alerts",
    "GET",
    BASE + "/aml/alerts",
    headers={"Authorization": "Bearer " + THOMAS_TOKEN},
)
test(
    "Thomas",
    "View NIU Conflicts",
    "GET",
    BASE + "/aml/niu-conflicts",
    headers={"Authorization": "Bearer " + THOMAS_TOKEN},
)
test(
    "Thomas",
    "View Agencies",
    "GET",
    BASE + "/aml/agencies",
    headers={"Authorization": "Bearer " + THOMAS_TOKEN},
)
test(
    "Thomas",
    "View Batch Jobs",
    "GET",
    BASE + "/aml/batch-jobs",
    headers={"Authorization": "Bearer " + THOMAS_TOKEN},
)
test(
    "Thomas",
    "View Audit Logs",
    "GET",
    BASE + "/backoffice/audit-logs",
    headers={"Authorization": "Bearer " + THOMAS_TOKEN},
)

# ===== SYLVIE (OPERATIONS) JOURNEY =====
section("SYLVIE JOURNEY - Operations Manager")

test(
    "Sylvie",
    "Login",
    "POST",
    BASE + "/auth/agent/login",
    json_body={"email": "sylvie@bicec.cm", "password": "password123"},
)
test(
    "Sylvie",
    "Get Profile",
    "GET",
    BASE + "/auth/agent/me",
    headers={"Authorization": "Bearer " + SYLVIE_TOKEN},
)
test(
    "Sylvie",
    "View AML Alerts",
    "GET",
    BASE + "/aml/alerts",
    headers={"Authorization": "Bearer " + SYLVIE_TOKEN},
)
test(
    "Sylvie",
    "View Analytics",
    "GET",
    BASE + "/analytics/",
    headers={"Authorization": "Bearer " + SYLVIE_TOKEN},
)
test(
    "Sylvie",
    "View Audit Logs",
    "GET",
    BASE + "/backoffice/audit-logs",
    headers={"Authorization": "Bearer " + SYLVIE_TOKEN},
)
test(
    "Sylvie",
    "View Queue",
    "GET",
    BASE + "/backoffice/queue",
    headers={"Authorization": "Bearer " + SYLVIE_TOKEN},
)

# ===== ADMIN IT JOURNEY =====
section("ADMIN IT JOURNEY - System Admin")

test(
    "Admin",
    "Login",
    "POST",
    BASE + "/auth/agent/login",
    json_body={"email": "admin@bicec.cm", "password": "password123"},
)
test(
    "Admin",
    "Get Profile",
    "GET",
    BASE + "/auth/agent/me",
    headers={"Authorization": "Bearer " + ADMIN_TOKEN},
)
test(
    "Admin",
    "View Admin",
    "GET",
    BASE + "/admin/",
    headers={"Authorization": "Bearer " + ADMIN_TOKEN},
)
test(
    "Admin",
    "View Queue",
    "GET",
    BASE + "/backoffice/queue",
    headers={"Authorization": "Bearer " + ADMIN_TOKEN},
)

# ===== RBAC ISOLATION TESTS =====
section("RBAC ISOLATION")

test(
    "RBAC",
    "Mobile cannot access queue",
    "GET",
    BASE + "/backoffice/queue",
    headers={"Authorization": "Bearer " + MOBILE_TOKEN},
    expected=401,
)
test(
    "RBAC",
    "Mobile cannot access admin",
    "GET",
    BASE + "/admin/",
    headers={"Authorization": "Bearer " + MOBILE_TOKEN},
    expected=401,
)
test(
    "RBAC",
    "Jean cannot access audit",
    "GET",
    BASE + "/backoffice/audit-logs",
    headers={"Authorization": "Bearer " + JEAN_TOKEN},
    expected=403,
)
test(
    "RBAC",
    "Jean cannot access AML",
    "GET",
    BASE + "/aml/alerts",
    headers={"Authorization": "Bearer " + JEAN_TOKEN},
    expected=403,
)
test(
    "RBAC",
    "Wrong password",
    "POST",
    BASE + "/auth/agent/login",
    json_body={"email": "jean@bicec.cm", "password": "wrongpassword"},
    expected=401,
)

# ===== HEALTH & INFRASTRUCTURE =====
section("HEALTH & INFRASTRUCTURE")

test("API", "Health Check", "GET", "http://localhost:8000/api/health")

# ===== PRINT RESULTS =====
print("\n".join(results))
print("\n" + "=" * 70)
print(f"FINAL RESULTS: {passed} passed, {failed} failed out of {passed + failed} tests")
print("=" * 70)
