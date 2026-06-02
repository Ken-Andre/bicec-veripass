# KYC Happy Path Live API Proof

- Generated at: `2026-05-26T04:08:27.655124+00:00`
- Base URL: `https://localhost`
- Client phone: `+237699040827`
- Raw backoffice session id: `2c4b5701-2dff-4edf-b380-458a20ecb8d9`
- Full JSON proof: `docs/test-evidence/latest/kyc-happy-path/kyc-happy-path-live-api-proof.json`

## Input Images

- cni_recto: `docs/test-evidence/latest/kyc-happy-path/input-images/cni_recto.jpg`
- cni_verso: `docs/test-evidence/latest/kyc-happy-path/input-images/cni_verso.jpg`

## Generated Acceptance Documents

- bill_pdf: `docs/test-evidence/latest/kyc-happy-path/generated-documents/bill_eneo_acceptance.pdf`
- support_address_proof_pdf: `docs/test-evidence/latest/kyc-happy-path/generated-documents/support_address_proof_acceptance.pdf`

## Key Results

- CNI recto OCR status: `PARTIAL`
- CNI verso OCR status: `PARTIAL`
- Bill PDF OCR status: `PARTIAL`
- Liveness alive: `True`
- Readiness can_submit: `True`
- Submitted status: `PENDING_AGENT_REVIEW`
- Info-request status: `PENDING_INFO`
- Support image limit: `4 Mo`
- Support PDF limit: `6 Mo / 5 pages`
- Classified doc type: `ADDRESS_PROOF`
- Approval status: `APPROVED`
- Client final status: `APPROVED`

## API Step Statuses

| Step | Method | Status | Elapsed |
| --- | --- | --- | ---: |
| health | `GET` | `200` | 93 ms |
| mobile otp send | `POST` | `200` | 740 ms |
| mobile otp verify | `POST` | `200` | 361 ms |
| device register | `POST` | `200` | 54 ms |
| kyc session start | `POST` | `200` | 61 ms |
| upload cni recto notebook image | `POST` | `200` | 18342 ms |
| upload cni verso notebook image | `POST` | `200` | 19217 ms |
| upload bill acceptance pdf | `POST` | `200` | 169 ms |
| upload selfie evidence | `POST` | `200` | 67 ms |
| ocr correction review | `POST` | `200` | 109 ms |
| liveness submit | `POST` | `200` | 22380 ms |
| address submit | `POST` | `200` | 68 ms |
| consent submit | `POST` | `200` | 61 ms |
| niu submit | `POST` | `200` | 58 ms |
| signature submit | `POST` | `200` | 67 ms |
| readiness before submit | `GET` | `200` | 61 ms |
| kyc submit | `POST` | `200` | 83 ms |
| jean agent login | `POST` | `200` | 452 ms |
| jean queue lookup | `GET` | `200` | 68 ms |
| jean dossier open | `GET` | `200` | 57 ms |
| jean auto assign | `POST` | `200` | 54 ms |
| jean request complementary file | `POST` | `200` | 41 ms |
| client sees info requested | `GET` | `200` | 37 ms |
| support attachment limits | `GET` | `200` | 13 ms |
| support current thread | `GET` | `200` | 62 ms |
| support text message | `POST` | `201` | 43 ms |
| support attachment upload address proof pdf | `POST` | `201` | 53 ms |
| jean classify complementary file | `POST` | `200` | 48 ms |
| jean approve dossier | `POST` | `200` | 74 ms |
| client sees approved status | `GET` | `200` | 58 ms |
