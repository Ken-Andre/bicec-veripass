from datetime import datetime, timezone
from types import SimpleNamespace
from uuid import uuid4

from app.modules.aml.service import _alert_response
from app.tasks.kyc import ocr_field_effective_value, parse_cni_expiry_date


def test_parse_cni_expiry_date_accepts_supported_formats():
    assert parse_cni_expiry_date("31/12/2030").isoformat() == "2030-12-31"
    assert parse_cni_expiry_date("31-12-2030").isoformat() == "2030-12-31"
    assert parse_cni_expiry_date("31.12.2030").isoformat() == "2030-12-31"


def test_ocr_field_effective_value_prefers_human_correction():
    field = SimpleNamespace(extracted_value="01/01/2024", corrected_value="02/01/2024")

    assert ocr_field_effective_value(field) == "02/01/2024"


def test_aml_alert_response_exposes_real_hit_and_normalizes_open_status():
    sanction = SimpleNamespace(
        id=uuid4(),
        source="OpenSanctions",
        full_name="MARIE DUPONT",
        nationality="CM",
        programs=["sanctions"],
    )
    session = SimpleNamespace(client_name="Marie Dupont", niu_number="M123")
    alert = SimpleNamespace(
        id=uuid4(),
        session_id=uuid4(),
        pep_sanctions=sanction,
        match_score=0.91,
        status="OPEN",
        created_at=datetime.now(timezone.utc),
        cleared_by=None,
        resolved_at=None,
        justification=None,
    )

    response = _alert_response(alert, session)

    assert response["status"] == "OPEN"
    assert response["severity"] == "CRITICAL"
    assert response["clientName"] == "Marie Dupont"
    assert response["hits"][0]["matchedName"] == "MARIE DUPONT"
    assert response["hits"][0]["listType"] == "SANCTIONS"
