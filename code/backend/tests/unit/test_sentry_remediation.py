import uuid
from datetime import datetime, timezone
from pathlib import Path
from types import SimpleNamespace

from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.v1.sentry_proxy import _allowed_envelope_url_for_project, _extract_allowed_envelope_url
from app.core.sentry import before_send
from app.modules.admin.router import _agent_to_response
from app.modules.auth.models import AgentRole
from app.modules.backoffice.router import ALLOWED_DOC_CATEGORIES, _agent_load_to_response
from app.modules.backoffice.schemas import AuditLogSchema
from app.modules.kyc.models import KYCSession
from app.modules.kyc.router import _session_start_response
from app.services.ocr_service import OCRService


def _envelope(project_id: str) -> bytes:
    return (
        b'{"dsn":"https://public@o4511113586409472.ingest.de.sentry.io/'
        + project_id.encode()
        + b'"}\n{"type":"event"}\n{}'
    )


def test_sentry_before_send_drops_expected_http_and_validation_errors():
    assert before_send({}, {"original_exception": StarletteHTTPException(status_code=401)}) is None
    assert before_send({}, {"original_exception": RequestValidationError([])}) is None
    assert before_send({"message": "HTTP error: Invalid or expired token"}, {}) is None


def test_sentry_before_send_keeps_server_errors():
    event = {"message": "Unexpected server failure"}
    assert before_send(event, {"original_exception": RuntimeError("boom")}) is event


def test_sentry_proxy_routes_only_known_frontend_projects():
    assert _extract_allowed_envelope_url(_envelope("4511114011410512")).endswith(
        "/api/4511114011410512/envelope/"
    )
    assert _extract_allowed_envelope_url(_envelope("4511114014949456")).endswith(
        "/api/4511114014949456/envelope/"
    )
    assert _extract_allowed_envelope_url(_envelope("999")) is None
    assert _extract_allowed_envelope_url(b"not-json\n{}") is None
    assert _allowed_envelope_url_for_project("4511114014949456").endswith(
        "/api/4511114014949456/envelope/"
    )
    assert _allowed_envelope_url_for_project("999") is None


def test_admin_agent_response_serialization_normalizes_enum_and_dates():
    agent = SimpleNamespace(
        id=uuid.uuid4(),
        name="Jean",
        email="jean@example.test",
        role=AgentRole.JEAN,
        agency_id=None,
        is_available=True,
        active_dossier_count=0,
        last_activity_at=datetime(2026, 5, 23, tzinfo=timezone.utc),
    )
    response = _agent_to_response(agent)
    assert response.role == "JEAN"
    assert response.last_activity_at == "2026-05-23T00:00:00+00:00"


def test_command_center_agent_load_separates_live_load_from_history():
    agent = SimpleNamespace(
        id=uuid.uuid4(),
        name="Jean",
        email="jean@example.test",
        role=AgentRole.JEAN,
        agency_id=None,
        agency=None,
        is_available=True,
        active_dossier_count=99,
        last_activity_at=datetime.now(timezone.utc),
    )
    response = _agent_load_to_response(
        agent,
        {
            "active_queue_count": 0,
            "completed_dossier_count": 4,
            "total_assigned_count": 4,
        },
    )
    assert response.active_dossier_count == 0
    assert response.active_queue_count == 0
    assert response.completed_dossier_count == 4
    assert response.total_assigned_count == 4
    assert response.is_connected is True


def test_db_registration_configures_banking_relationships():
    import app.db  # noqa: F401
    from sqlalchemy.orm import configure_mappers

    configure_mappers()


def test_audit_log_schema_tolerates_missing_jsonb_fields():
    payload = {
        "id": uuid.uuid4(),
        "performed_at": datetime(2026, 5, 23, tzinfo=timezone.utc),
        "performed_by": None,
        "action": "DOSSIER_ASSIGN",
        "record_id": str(uuid.uuid4()),
        "new_data": {"agent_name": None, "rationale": None, "status": None},
        "old_data": {"status": None},
    }
    schema = AuditLogSchema.model_validate(payload)
    assert schema.agentName == ""
    assert schema.rationale == ""
    assert schema.previousState == ""
    assert schema.newState == ""


def test_kyc_session_created_at_aliases_started_at():
    started_at = datetime(2026, 5, 23, tzinfo=timezone.utc)
    session = KYCSession(user_id=uuid.uuid4(), started_at=started_at)
    assert session.created_at == started_at


def test_session_start_response_uses_existing_session_message():
    session = KYCSession(id=uuid.uuid4(), user_id=uuid.uuid4(), status="DRAFT")
    response = _session_start_response(session, existing=True)
    assert response["status"] == "DRAFT"
    assert response["message"] == "Existing session found"


def test_backoffice_accepts_identity_proof_classification():
    assert "IDENTITY_PROOF" in ALLOWED_DOC_CATEGORIES


def test_ocr_pdf_upload_is_skipped_without_sentry_error(tmp_path):
    pdf_path = Path(tmp_path) / "bill_eneo_acceptance.pdf"
    pdf_path.write_bytes(b"%PDF-1.4\n%%EOF\n")

    result = OCRService().extract_from_path(pdf_path, doc_type="BILL_ENEO")

    assert result["engine"] == "UNSUPPORTED_FILE_TYPE"
    assert result["needs_glm_fallback"] is False
