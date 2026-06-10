# KYC MVP Hardening Note

Date: 2026-05-25

## Scope Decision

DGI integration is removed from the KYC MVP roadmap. NIU is treated as local evidence only:

- `MISSING`: client has no NIU evidence.
- `DECLARATIVE`: client typed a NIU value, persisted locally as `kyc_sessions.niu_number`.
- `UPLOADED`: client uploaded NIU attestation evidence as `doc_type=NIU`.

No DGI endpoint, validation flag, background queue, or future hook is part of this sprint.

## Face Match Review Rule

Face match is persisted as a first-class biometric result. A failed face match does not block the client from submission after liveness succeeds, but it sets `priority_flag=true` so Jean handles the dossier in priority manual review.
