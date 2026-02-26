# ADR: Mapping PRD lifecycle states → UX v2 Access States

Date: 2026-02-23

Decision: Use `ux-design-specification-v2.md` (2026-02-18) as canonical source for post-submission access states and map PRD lifecycle states to these access states. Prototype must be updated to use the mapped enums.

Context
- PRD uses lifecycle states (DRAFT, SUBMITTED, PROCESSING, PENDING_VALIDATION, VALIDATED, ACCOUNT_CREATED, ACTIVE_FULL)
- UX v2 defines access tiers: RESTRICTED_ACCESS (pre-validation), LIMITED_ACCESS (account active but NIU missing/declarative), FULL_ACCESS (complete KYC + NIU)

Decision
- Map as follows:
  - DRAFT -> DRAFT
  - SUBMITTED -> SUBMITTED
  - PROCESSING -> PROCESSING
  - PENDING_VALIDATION -> PENDING_AGENT_REVIEW (system queue) and RESTRICTED_ACCESS (user-facing banner)
  - VALIDATED -> APPROVED (agent decision)
  - ACCOUNT_CREATED -> ACCOUNT_CREATED
  - ACCOUNT_CREATED + NIU missing/declarative -> LIMITED_ACCESS
  - ACCOUNT_CREATED + NIU validated -> FULL_ACCESS

Consequences
- Backend: expose both `lifecycle_state` and `access_tier` in APIs. `access_tier` is derived after provisioning.
- Prototype: normalize `status` values to include PRD lifecycle names and populate `access_tier` (`restricted|limited|full`) for UI.
- BackOffice: use PRD lifecycle for queueing and UX v2 access tiers for UI banners and permitted actions.

Rollback
- If product owner changes canonical doc, update ADR and run automated text replacements in prototype copy strings.
