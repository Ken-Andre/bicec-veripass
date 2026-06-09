import uuid
from datetime import datetime, timezone

import pytest

from app.modules.audit.models import AuditLog
from app.modules.audit.service import export_audit_log_cobac


class _ScalarResult:
    def __init__(self, logs):
        self._logs = logs

    def all(self):
        return self._logs


class _ExecuteResult:
    def __init__(self, logs):
        self._logs = logs

    def scalars(self):
        return _ScalarResult(self._logs)


class _FakeSession:
    def __init__(self, logs):
        self.logs = logs
        self.added = []
        self.committed = False

    async def execute(self, _query):
        return _ExecuteResult(self.logs)

    def add(self, value):
        self.added.append(value)

    async def commit(self):
        self.committed = True


@pytest.mark.asyncio
async def test_cobac_export_writes_audit_log_after_building_report_entries():
    exported_log = AuditLog(
        id=uuid.uuid4(),
        action="KYC_SUBMIT",
        table_name="kyc_sessions",
        record_id="session-1",
        old_data={},
        new_data={"status": "PENDING_AGENT_REVIEW"},
        performed_by=uuid.uuid4(),
        performed_at=datetime(2026, 6, 1, tzinfo=timezone.utc),
    )
    performed_by = uuid.uuid4()
    db = _FakeSession([exported_log])

    entries = await export_audit_log_cobac(
        db,
        "2026-06-01",
        "2026-06-30",
        performed_by=performed_by,
        client_ip="127.0.0.1",
    )

    assert [entry["action"] for entry in entries] == ["KYC_SUBMIT"]
    assert db.committed is True
    assert len(db.added) == 1
    audit_log = db.added[0]
    assert audit_log.action == "AUDIT_EXPORT_COBAC"
    assert audit_log.table_name == "audit_log"
    assert audit_log.performed_by == performed_by
    assert audit_log.client_ip == "127.0.0.1"
    assert audit_log.new_data == {
        "date_from": "2026-06-01",
        "date_to": "2026-06-30",
        "exported_entries": 1,
    }
