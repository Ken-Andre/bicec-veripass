"""Schema-level contract tests for milestone #3 KYC API responses/requests."""

from app.modules.kyc.schemas import OCRConfirmSubmitRequest, LivenessResultResponse


def test_ocr_confirm_submit_request_accepts_corrected_fields_dict():
    payload = OCRConfirmSubmitRequest(
        corrected_fields={"nom": "DUPONT", "date_naissance": "1990-01-01"}
    )
    assert payload.corrected_fields["nom"] == "DUPONT"
    assert payload.corrected_fields["date_naissance"] == "1990-01-01"


def test_liveness_result_response_exposes_lockout_contract_fields():
    response = LivenessResultResponse(
        is_alive=False,
        confidence=0.0,
        attempts_remaining=0,
        strikes_remaining=0,
        is_locked=True,
        cooldown_seconds=60,
        lockout_count_24h=2,
        branch_fallback_available=True,
    )
    assert response.is_locked is True
    assert response.cooldown_seconds == 60
    assert response.lockout_count_24h == 2
    assert response.branch_fallback_available is True
