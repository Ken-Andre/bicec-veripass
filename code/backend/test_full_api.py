import httpx

BASE = "http://localhost:8000/api/v1"

passed = 0
failed = 0


def test(name, method, url, headers=None, json_body=None, expected=200):
    global passed, failed
    h = headers or {}
    if method == "GET":
        r = httpx.get(url, headers=h)
    elif method == "POST":
        r = httpx.post(url, headers=h, json=json_body)
    elif method == "PUT":
        r = httpx.put(url, headers=h, json=json_body)
    elif method == "DELETE":
        r = httpx.delete(url, headers=h)
    status = "PASS" if r.status_code == expected else "FAIL"
    path = url.replace(BASE, "")
    print(f"{status} | {r.status_code:3d} | {method:6s} {path}")
    if r.status_code != expected:
        print(f"       Expected {expected}, got {r.status_code}")
        print(f"       Body: {r.text[:200]}")
        failed += 1
    else:
        passed += 1
    return r


# Setup tokens
r = httpx.post(BASE + "/auth/otp/send", json={"phone": "+237690123456"})
mobile_otp = r.json().get("otp_debug", "")
r = httpx.post(
    BASE + "/auth/otp/verify", json={"phone": "+237690123456", "otp": mobile_otp}
)
MOBILE_TOKEN = r.json().get("access_token", "")


def agent_token(email):
    r = httpx.post(
        BASE + "/auth/agent/login", json={"email": email, "password": "password123"}
    )
    return r.json().get("access_token", "")


JEAN_TOKEN = agent_token("jean@bicec.cm")
THOMAS_TOKEN = agent_token("thomas@bicec.cm")
SYLVIE_TOKEN = agent_token("sylvie@bicec.cm")
ADMIN_TOKEN = agent_token("admin@bicec.cm")

print("=" * 60)
print("FULL API ENDPOINT TEST SUITE")
print("=" * 60)

# AUTH
print("\n--- AUTH MODULE ---")
test("OTP Send", "POST", BASE + "/auth/otp/send", json_body={"phone": "+237690000001"})
test(
    "Agent Login Jean",
    "POST",
    BASE + "/auth/agent/login",
    json_body={"email": "jean@bicec.cm", "password": "password123"},
)
test(
    "Agent Me",
    "GET",
    BASE + "/auth/agent/me",
    headers={"Authorization": "Bearer " + JEAN_TOKEN},
)
test(
    "Mobile Me",
    "GET",
    BASE + "/auth/me",
    headers={"Authorization": "Bearer " + MOBILE_TOKEN},
)
test(
    "Wrong Password",
    "POST",
    BASE + "/auth/agent/login",
    json_body={"email": "jean@bicec.cm", "password": "wrongpassword"},
    expected=401,
)

# KYC
print("\n--- KYC MODULE ---")
test("KYC Root", "GET", BASE + "/kyc/")
test(
    "KYC Session Start",
    "POST",
    BASE + "/kyc/session/start",
    headers={"Authorization": "Bearer " + MOBILE_TOKEN},
)
test(
    "KYC Session Current",
    "GET",
    BASE + "/kyc/session/current",
    headers={"Authorization": "Bearer " + MOBILE_TOKEN},
)
test("KYC Geo Regions", "GET", BASE + "/kyc/geo/regions")
test("KYC Geo Cities", "GET", BASE + "/kyc/geo/cities/CE")
test("KYC Geo Quartiers", "GET", BASE + "/kyc/geo/quartiers/YDE")

# BACKOFFICE
print("\n--- BACKOFFICE MODULE ---")
test("Backoffice Root", "GET", BASE + "/backoffice/")
test(
    "Queue (Jean)",
    "GET",
    BASE + "/backoffice/queue",
    headers={"Authorization": "Bearer " + JEAN_TOKEN},
)
test(
    "Queue (Thomas)",
    "GET",
    BASE + "/backoffice/queue",
    headers={"Authorization": "Bearer " + THOMAS_TOKEN},
)
test(
    "Queue (Sylvie)",
    "GET",
    BASE + "/backoffice/queue",
    headers={"Authorization": "Bearer " + SYLVIE_TOKEN},
)
test(
    "Queue (Admin)",
    "GET",
    BASE + "/backoffice/queue",
    headers={"Authorization": "Bearer " + ADMIN_TOKEN},
)
test(
    "Queue (Mobile 401)",
    "GET",
    BASE + "/backoffice/queue",
    headers={"Authorization": "Bearer " + MOBILE_TOKEN},
    expected=401,
)
test(
    "Audit (Thomas)",
    "GET",
    BASE + "/backoffice/audit-logs",
    headers={"Authorization": "Bearer " + THOMAS_TOKEN},
)
test(
    "Audit (Sylvie)",
    "GET",
    BASE + "/backoffice/audit-logs",
    headers={"Authorization": "Bearer " + SYLVIE_TOKEN},
)
test(
    "Audit (Jean 403)",
    "GET",
    BASE + "/backoffice/audit-logs",
    headers={"Authorization": "Bearer " + JEAN_TOKEN},
    expected=403,
)

# ADMIN
print("\n--- ADMIN MODULE ---")
test("Admin Root", "GET", BASE + "/admin/")

# AML
print("\n--- AML MODULE ---")
test("AML Root", "GET", BASE + "/aml/")
test(
    "AML Alerts (Thomas)",
    "GET",
    BASE + "/aml/alerts",
    headers={"Authorization": "Bearer " + THOMAS_TOKEN},
)
test(
    "AML Alerts (Sylvie)",
    "GET",
    BASE + "/aml/alerts",
    headers={"Authorization": "Bearer " + SYLVIE_TOKEN},
)
test(
    "AML Alerts (Jean 403)",
    "GET",
    BASE + "/aml/alerts",
    headers={"Authorization": "Bearer " + JEAN_TOKEN},
    expected=403,
)
test(
    "AML NIU Conflicts",
    "GET",
    BASE + "/aml/niu-conflicts",
    headers={"Authorization": "Bearer " + THOMAS_TOKEN},
)
test(
    "AML Agencies",
    "GET",
    BASE + "/aml/agencies",
    headers={"Authorization": "Bearer " + THOMAS_TOKEN},
)
test(
    "AML Batch Jobs",
    "GET",
    BASE + "/aml/batch-jobs",
    headers={"Authorization": "Bearer " + THOMAS_TOKEN},
)

# ANALYTICS
print("\n--- ANALYTICS MODULE ---")
test("Analytics Root", "GET", BASE + "/analytics/")

# NOTIFICATIONS
print("\n--- NOTIFICATIONS MODULE ---")
test("Notifications Root", "GET", BASE + "/notifications/")

# HEALTH
print("\n--- HEALTH ---")
test("Health", "GET", "http://localhost:8000/api/health")

print("\n" + "=" * 60)
print(f"RESULTS: {passed} passed, {failed} failed out of {passed + failed} tests")
print("=" * 60)
