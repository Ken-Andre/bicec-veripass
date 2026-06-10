# Project timeline date corrections - 2026-06-10

This report corrects overly broad GitHub Project dates that were produced by
matching generic back-office terms instead of task-specific implementation
evidence.

Rule used for corrections:

- `Debut` = first commit that introduced a meaningful implementation surface for
  the issue.
- `Fin` = last commit that made the issue substantially demonstrable or closed
  the missing acceptance gap.
- Issues are not closed.
- Docker was not started.

## Corrected group: back-office dates previously set to 2026-03-14 -> 2026-06-04

| Issue | Old dates | Corrected dates | Commit evidence | Rationale |
| --- | --- | --- | --- | --- |
| #102 `[BO-04] Side-by-Side "Zoom + Compare" viewer logic` | 2026-03-14 -> 2026-06-04 | 2026-04-05 -> 2026-05-29 | `2068cdf` -> `eb1ffbc` | Shared `ImageViewer` and evidence workflow components started on 2026-04-05; EvidenceViewer v3 completed document tabs, OCR aliases and image download on 2026-05-29. |
| #103 `[BO-05] Dossier Detail view (images + OCR fields)` | 2026-03-14 -> 2026-06-04 | 2026-04-27 -> 2026-05-29 | `f1eefc4` -> `eb1ffbc` | Dossier support/file access and EvidenceViewer route started on 2026-04-27; OCR/document detail was completed through EvidenceViewer v3 on 2026-05-29. |
| #104 `[BO-06] Face match similarity screen (BO panel)` | 2026-03-14 -> 2026-06-04 | 2026-05-26 -> 2026-05-28 | `84b873a` -> `a7e3324` | `FaceComparisonCard` biometric metadata arrived on 2026-05-26; EvidenceViewer v2 wired FaceComparison metadata on 2026-05-28. |
| #108 `[BO-10] SLA tracking & escalation flags logic` | 2026-03-14 -> 2026-06-04 | 2026-03-20 -> 2026-05-29 | `c192475` -> `eb1ffbc` | Queue pagination and priority/date ordering were introduced on 2026-03-20; priority/biometric flags were exposed in the queue on 2026-05-29. |
| #109 `[BO-11] SLA visual indicators (R/Y/G) in queue` | 2026-03-14 -> 2026-06-04 | 2026-05-29 -> 2026-05-29 | `eb1ffbc` | Queue risk/priority visual flags were added in the 2026-05-29 ValidationQueuePage update. |
| #110 `[BO-12] PENDING_INFO mobile notification trigger` | 2026-03-14 -> 2026-06-04 | 2026-05-22 -> 2026-05-28 | `3208976` -> `dc0ca1e` | Support/notification contract foundations were added on 2026-05-22; `KYC_INFO_REQUESTED` and back-office decision flow were present by 2026-05-28. |
| #111 `[BO-13] Multi-agent concurrency control (Dossier locking)` | 2026-03-14 -> 2026-06-04 | 2026-04-25 -> 2026-06-06 | `8ccf8f3` -> `18c7e01` | Assignment models/router surfaces appeared on 2026-04-25; access-control hardening around assignments landed on 2026-06-06. |
| #112 `[BO-14] Agent Dashboard (SLA, Dossiers processed)` | 2026-03-14 -> 2026-06-04 | 2026-04-26 -> 2026-05-28 | `6be325a` -> `dc0ca1e` | Live API dashboard stats started on 2026-04-26; connected/load/completed agent counts were enriched on 2026-05-28. |
| #114 `[BO-16] Intranet file server connection (Read images)` | 2026-03-14 -> 2026-06-04 | 2026-04-27 -> 2026-05-28 | `f1eefc4` -> `c762cfa` | File access for dossiers started on 2026-04-27; `apiGetBlob` and document serving fixes landed on 2026-05-28. |
| #115 `[BO-17] Rejection reason modal` | 2026-03-14 -> 2026-06-04 | 2026-04-27 -> 2026-05-28 | `f1eefc4` -> `a7e3324` | Agent decision reason handling was present on 2026-04-27; EvidenceViewer v2 stabilized the review/action UI on 2026-05-28. |
| #116 `[BO-18] Back-office session management & logout` | 2026-03-14 -> 2026-06-04 | 2026-03-13 -> 2026-04-25 | `61ce703` -> `057f1bd` | Initial SPA auth/RBAC structure was created on 2026-03-13; session warning/banner tests landed on 2026-04-25. |
| #117 `[BO-19] Load balancing: Smooth WRR implementation` | 2026-03-14 -> 2026-06-04 | 2026-05-28 -> 2026-06-06 | `dc0ca1e` -> `18c7e01` | Least-loaded connected agent selection and load counters were added on 2026-05-28; assignment/access hardening followed on 2026-06-06. |

## Corrected group: generic planning/doc dates removed

These issues had dates pulled from generic planning, documentation, or very broad
symbol matches. They were corrected with feature-specific files and commits.

| Issue | Old dates | Corrected dates | Commit evidence | Rationale |
| --- | --- | --- | --- | --- |
| #57 `[CAPTURE-03] Multipart upload handler for documents` | 2026-02-27 -> 2026-06-03 | 2026-04-18 -> 2026-04-25 | `e2a7e62` -> `6078276` | The KYC router/storage implementation for document capture became substantial on 2026-04-18; the backend KYC router update on 2026-04-25 completed the handler surface used by the mobile flow. |
| #79 `[BIO-10] Deduplication logic (pg_trgm)` | 2026-02-02 -> 2026-05-29 | 2026-04-04 -> 2026-05-28 | `d54ed0f` -> `960982b` | AML/DuplicateCheck models and APIs started on 2026-04-04; the async duplicate task with `SequenceMatcher`/NIU conflict handling landed on 2026-05-28. |
| #91 `[OFFLINE-01] Service Worker strategy for app shell` | 2026-02-28 -> 2026-05-31 | 2026-03-12 -> 2026-05-05 | `0dfd39e` -> `57d3f9d` | The PWA skeleton and Service Worker were introduced on 2026-03-12; the update strategy became explicit and user-safe on 2026-05-05. |
| #94 `[OFFLINE-04] Progressive sync logic (Upload resume)` | 2026-02-02 -> 2026-06-06 | 2026-04-25 -> 2026-05-26 | `0e36ba7` -> `9c97af9` | Offline sync context/store/service started on 2026-04-25; upload retry/reupload handling was refined in the 2026-05-26 mobile KYC sync fix. |
| #107 `[BO-09] Agent activity audit logging` | 2026-03-27 -> 2026-05-28 | 2026-04-25 -> 2026-05-28 | `8ccf8f3` -> `e6343c6` | Back-office/admin router surfaces started on 2026-04-25; explicit agent activity tracking landed on 2026-05-28. |
| #120 `[KYC-ADDR-03] GPS coordinate capture & proximity check` | 2026-02-02 -> 2026-06-06 | 2026-04-25 -> 2026-05-29 | `2c16272` -> `e6c6452` | Address/GPS capture entered the mobile KYC screens on 2026-04-25; cascading geo-select and explicit GPS capture were completed on 2026-05-29. |
| #126 `[KYC-CONS-01] Consent checkboxes & Legal policy modals` | 2026-02-23 -> 2026-05-29 | 2026-04-25 -> 2026-06-06 | `2c16272` -> `5d93282` | The consent screen and mandatory checkboxes were part of the 2026-04-25 KYC screen update; legal document versions and mobile document-backed policy rendering landed on 2026-06-06. |
| #127 `[KYC-CONS-02] Consent timestamping & IP logging` | 2026-02-02 -> 2026-05-29 | 2026-04-24 -> 2026-05-28 | `c9065a2` -> `e6343c6` | The backend consent submit logic became concrete on 2026-04-24; `signed_at`/`client_ip` model hardening and KYC router updates were present by 2026-05-28. |
| #128 `[KYC-CONS-03] Loi 2024-017 compliance pack metadata` | 2026-04-05 -> 2026-05-28 | 2026-06-06 -> 2026-06-06 | `5d93282` | The real implementation is the versioned legal document pack: migration, legal module, hash/version verification, and mobile legal document consumption all landed in one commit on 2026-06-06. |

## Remaining long spans after correction

The remaining long spans are not default placeholders; they reflect broad issues
whose first implementation and last substantial hardening were separated in git:

| Issue | Current dates | Why it remains long |
| --- | --- | --- |
| #108 `[BO-10] SLA tracking & escalation flags` | 2026-03-20 -> 2026-05-29 | Queue priority/date ordering started with paginated back-office queue support; risk/priority flags were exposed in the final queue work on 2026-05-29. |
| #79 `[BIO-10] Deduplication logic` | 2026-04-04 -> 2026-05-28 | Database/API scaffolding and the async duplicate matching engine arrived in separate commits. |
| #102 `[BO-04] Zoom + Compare viewer` | 2026-04-05 -> 2026-05-29 | Shared viewer primitives existed early; the final EvidenceViewer document tabs/OCR/image download work arrived on 2026-05-29. |
| #91 `[OFFLINE-01] Service Worker strategy` | 2026-03-12 -> 2026-05-05 | Initial SW registration and later update strategy were separate pieces of the same operational feature. |

## Notes

- These corrections still need human review if the desired planning semantic is
  "first prototype screen" instead of "first meaningful implementation commit".
- #111 remains a longer span because the assignment model and the later access
  hardening are both relevant to multi-agent locking.
- No issue was closed during this correction pass.
