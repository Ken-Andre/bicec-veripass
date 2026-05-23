# Day 3 Device-Tag Enforcement Live API Proof

Generated: 2026-05-23 01:34 +02:00

## Runtime

Command:

```powershell
docker compose -f code/docker-compose.yml up -d api nginx
docker compose -f code/docker-compose.yml restart nginx
docker compose -f code/docker-compose.yml ps api nginx pwa backoffice
```

Result:

```text
vp_api        code-api          Up (healthy)   0.0.0.0:8001->8000/tcp
vp_nginx      code-nginx        Up (healthy)   0.0.0.0:80->8080/tcp, 0.0.0.0:443->8443/tcp
vp_pwa        code-pwa          Up (healthy)   0.0.0.0:3000->8080/tcp
vp_backoffice code-backoffice   Up (healthy)   0.0.0.0:3001->8080/tcp
```

API startup logs showed Alembic migration check, application startup complete, OCR warmup complete, and health check `200 OK`.

## Test Command

Command shape:

```powershell
# Auth and device registration through https://localhost/api/v1
# Protected route checks through curl.exe -k against https://localhost/api/v1
GET  https://localhost/api/health
POST https://localhost/api/v1/auth/otp/send
POST https://localhost/api/v1/auth/otp/verify
POST https://localhost/api/v1/devices/register with X-Device-Fingerprint
GET  https://localhost/api/v1/banking/account without X-Device-Tag
GET  https://localhost/api/v1/banking/account with wrong X-Device-Tag
GET  https://localhost/api/v1/banking/account with registered X-Device-Tag
GET  https://localhost/api/v1/kyc/session/current without X-Device-Tag
GET  https://localhost/api/v1/kyc/session/current with wrong X-Device-Tag
GET  https://localhost/api/v1/kyc/session/current with registered X-Device-Tag
```

## Response Proof

```json
{
  "generated_at": "2026-05-23T01:34:46.0519863+02:00",
  "base_url": "https://localhost",
  "phone": "+237671349880",
  "health": {
    "status": 200,
    "body": "{\"status\":\"ok\",\"version\":\"0.1.0\",\"db\":\"ok\",\"redis\":\"ok\"}"
  },
  "otp_send": {
    "status": 200
  },
  "otp_verify": {
    "status": 200,
    "token_prefix": "eyJhbGciOiJI"
  },
  "device_register": {
    "status": 200,
    "device_tag": "vp_dev_5dde4eb8926aa27709d5126660e798ce0b5dd930f4aae1c9",
    "response": "{\"id\":\"a22da194-8a60-4ca4-a56c-98735818c910\",\"device_tag\":\"vp_dev_5dde4eb8926aa27709d5126660e798ce0b5dd930f4aae1c9\",\"created_at\":\"2026-05-22T23:34:49.348071Z\",\"last_seen_at\":\"2026-05-22T23:34:49.348071Z\"}"
  },
  "banking_without_device_tag": {
    "status": 428,
    "body": "{\"detail\":\"Device tag required. Register this device before continuing.\",\"status_code\":428}"
  },
  "banking_wrong_device_tag": {
    "status": 403,
    "body": "{\"detail\":\"Device tag is not registered for this user.\",\"status_code\":403}"
  },
  "banking_correct_device_tag": {
    "status": 200,
    "body": "{\"user_id\":\"2f4d8d14-9088-4178-9ff7-485df32a6ed4\",\"iban\":\"CM211000100023596769502282\",\"bic\":\"BICECMCX\",\"holder_name\":\"Client BICEC\",\"balance\":0.0,\"currency\":\"XAF\",\"access_level\":\"RESTRICTED\"}"
  },
  "kyc_without_device_tag": {
    "status": 428,
    "body": "{\"detail\":\"Device tag required. Register this device before continuing.\",\"status_code\":428}"
  },
  "kyc_wrong_device_tag": {
    "status": 403,
    "body": "{\"detail\":\"Device tag is not registered for this user.\",\"status_code\":403}"
  },
  "kyc_correct_device_tag": {
    "status": 200,
    "body": "{\"id\":\"6a8dc78ad998868f78b1440b27ac2b9db68884edb2712de9aef5d507cea74089\",\"status\":\"DRAFT\",\"access_level\":\"RESTRICTED\",\"niu_type\":null,\"confidence_score_global\":null,\"liveness_strike_count\":0,\"last_step_completed\":\"PHONE_VERIFIED\",\"started_at\":\"2026-05-22T23:34:49.284625Z\",\"submitted_at\":null,\"completed_at\":null,\"documents\":[],\"biometric_result\":null,\"consent_record\":null}"
  }
}
```

## Verdict

`X-Device-Tag` enforcement is live on high-risk KYC and banking routes:

- Missing registered device tag: blocked with `428`.
- Unknown device tag: blocked with `403`.
- Registered device tag: request proceeds to business response.
