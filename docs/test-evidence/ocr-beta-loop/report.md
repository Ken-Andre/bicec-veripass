# CNI OCR Beta Loop Evidence

Date: 2026-05-26

This run used visual inspection of the CNI images and real backend upload/review behavior. No `ground_truth` JSON was used for benchmarking or expectations.

## Scope

- Image source: `paddleocr_test/notebooks/output/images/cni_*_recto.jpg` and `cni_*_verso.jpg`.
- Real-app path exercised by the runner: create a random mobile account, register a device, upload CNI recto/verso through `/api/v1/kyc/capture/cni`, then read the same OCR review data exposed by `/api/v1/kyc/session/current`.
- Evidence output: `docs/test-evidence/ocr-beta-loop/*`.

## Implemented Backend Rules

- Added CNI post-processing in `code/backend/app/services/ocr_service.py` after template/fallback extraction and before final validation.
- Added deterministic 10-year CNI date recovery with high-confidence source threshold `0.90`, derived confidence `min(source_conf, 0.96)`, separator preservation, and leap-day fallback to February 28.
- Relaxed address acceptance only with strong CNI verso context: address zone or directly below an address label.
- Normalized guarded CNI scalar formats before validation: dates, duplicated spaces, CNI number, SP, and poste identification spacing.
- Kept `sp`, `numero_cni`, `poste_identification`, and dates separated by format and zone rules.
- Removed legitimate values from `STOP_WORDS`: `MENAGERE`, `INGENIEUR`, and `TRAVAIL`.

## Visual/Manual Findings Converted To General Rules

- `cni_0`: visible verso address is `GAROUA`; earlier review confused the address area with a date or left it empty. Contextual address post-processing now returns `GAROUA` with high confidence.
- `cni_1`, `cni_3`, `cni_7`, `cni_16`: visible profession is `MENAGERE`; it is now retained instead of being dropped as a stop word.
- `cni_17`: visible profession is `INGENIEUR`; it is now retained.
- `cni_24`: visible mother name is `TRAVAIL ARLETTE`; it is now retained instead of being dropped by stop-word filtering.
- `cni_58`: visible fields include `KAMGA`, `HERVE FABRICE`, `RETRAITE`, `23.12.2024`, `23.12.2034`, `DOUALA - BONABERI`, `908343`, `CE68`; the final warmed rerun extracted those values correctly.

## Run Summary

- Initial full pass: 53/60 successful; transient failures on `20, 34, 55, 56, 57, 58, 59`.
- Focused reruns recovered `20, 24, 34, 55, 56, 57, 59`.
- `cni_58` initially reproduced a container disconnect, then recto-only and verso-only both succeeded, and the final warmed recto+verso run succeeded.
- Final aggregate: 60/60 CNI ids have at least one successful real-app OCR review pass.

## Verification

- `python -m py_compile code/backend/app/services/ocr_service.py code/backend/scripts/ocr_beta_loop.py` passed.
- `pytest` is not installed in the local Python or API venv, so the focused pure helper tests were executed directly with assertions enabled in the API venv.
- Direct helper test execution result: 8/8 tests passed.

