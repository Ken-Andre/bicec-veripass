# Story: Fix Synthetic CNI Generation Regression & NameError

## Context
Recent changes to `ocr_utils.py` and `02_synthetic_cni_generation.py` introduced a `NameError` and broke the calibration of synthetic CNI generation. 
The user wants to revert to the stable, verified state for generation and fix the import issue.

## Proposed Changes

### [ocr_utils.py](file:///c:/Users/yoann/Documents/School/Xp-X5/Stage/bicec-veripass/paddleocr_test/notebooks/ocr_utils.py)
- Re-verify constant definitions.
- Ensure `DEFAULT_GLM_KYC_PROMPT` is defined and used correctly.
- Move it even higher if necessary to be absolutely safe.

### [02_synthetic_cni_generation.py](file:///c:/Users/yoann/Documents/School/Xp-X5/Stage/bicec-veripass/paddleocr_test/notebooks/02_synthetic_cni_generation.py)
- Remove `layout_type` parameter from all cells.
- Force 800x500 resolution for all CNI templates.
- Ensure `render_side` uses the flat `CNI_FIELD_CONFIG` correctly.
- Restore the `manifest = []` initialization (already done but double check).

## Validation Plan
- Run `test_import_v2.py` to confirm `ocr_utils` is clean.
- Manually check `02_synthetic_cni_generation.py` code for any remaining `layout_type` references.
- The user will verify the visual output in Marimo.
