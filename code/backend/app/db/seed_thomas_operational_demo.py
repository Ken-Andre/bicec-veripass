"""Seed operational AML/CFT demo data for Thomas.

This script is intentionally idempotent. It creates one AML alert linked to an
existing KYC session and one NIU conflict when a second session exists, so the
back-office compliance screens have real records to process in Docker demos.

Usage inside Docker:
    python -m app.db.seed_thomas_operational_demo
"""

from __future__ import annotations

import asyncio
import uuid
from datetime import datetime, timezone
from decimal import Decimal

from sqlalchemy import select

from app.db.session import AsyncSessionLocal
from app.modules.kyc.models import AmlAlert, DuplicateCheck, KYCSession, PEPSanctions

DEFAULT_SESSION_ID = uuid.UUID("0a9816e8-7824-4cad-97e5-f99aa62ce4f5")


async def _target_session(db) -> KYCSession | None:
    result = await db.execute(select(KYCSession).where(KYCSession.id == DEFAULT_SESSION_ID))
    session = result.scalar_one_or_none()
    if session:
        return session

    result = await db.execute(select(KYCSession).order_by(KYCSession.started_at.desc()).limit(1))
    return result.scalar_one_or_none()


async def seed() -> None:
    async with AsyncSessionLocal() as db:
        session = await _target_session(db)
        if not session:
            print("[seed-thomas] No KYC session found; skipping.")
            return

        sanctions_result = await db.execute(
            select(PEPSanctions).where(
                PEPSanctions.source == "DEMO_OPEN_SANCTIONS",
                PEPSanctions.full_name == "EYEBE SIMPLICE NADGE",
            )
        )
        sanctions = sanctions_result.scalar_one_or_none()
        if not sanctions:
            sanctions = PEPSanctions(
                id=uuid.uuid4(),
                source="DEMO_OPEN_SANCTIONS",
                entity_type="INDIVIDUAL",
                full_name="EYEBE SIMPLICE NADGE",
                aliases=["SIMPLICE NADGE EYEBE"],
                nationality="CM",
                programs=["PEP", "DEMO_COMPLIANCE_REVIEW"],
                is_active=True,
            )
            db.add(sanctions)
            await db.flush()

        alert_result = await db.execute(
            select(AmlAlert).where(
                AmlAlert.session_id == session.id,
                AmlAlert.pep_sanctions_id == sanctions.id,
                AmlAlert.status.in_(["OPEN", "ESCALATED", "CONFIRMED"]),
            )
        )
        if not alert_result.scalar_one_or_none():
            db.add(
                AmlAlert(
                    id=uuid.uuid4(),
                    session_id=session.id,
                    pep_sanctions_id=sanctions.id,
                    alert_type="PEP",
                    match_score=Decimal("0.9100"),
                    status="OPEN",
                )
            )
            session.priority_flag = True

        other_result = await db.execute(
            select(KYCSession)
            .where(KYCSession.id != session.id)
            .order_by(KYCSession.started_at.desc())
            .limit(1)
        )
        other = other_result.scalar_one_or_none()
        if not other:
            other = KYCSession(
                id=uuid.uuid4(),
                user_id=session.user_id,
                agency_id=session.agency_id,
                status="PENDING_AGENT_REVIEW",
                access_level="RESTRICTED_ACCESS",
                niu_type=session.niu_type,
                niu_number=session.niu_number or "DEMO-NIU-THOMAS",
                niu_declarative=session.niu_declarative,
                client_name="Demo doublon Thomas",
                confidence_score_global=Decimal("0.7600"),
                priority_flag=True,
                last_step_completed="demo_duplicate_review",
                started_at=datetime.now(timezone.utc),
                submitted_at=datetime.now(timezone.utc),
            )
            db.add(other)
            await db.flush()

        if other:
            conflict_result = await db.execute(
                select(DuplicateCheck).where(
                    DuplicateCheck.session_id_new == session.id,
                    DuplicateCheck.session_id_existing == other.id,
                    DuplicateCheck.status == "OPEN",
                )
            )
            if not conflict_result.scalar_one_or_none():
                db.add(
                    DuplicateCheck(
                        id=uuid.uuid4(),
                        session_id_new=session.id,
                        session_id_existing=other.id,
                        match_type="NIU_OR_IDENTITY_SIMILARITY",
                        niu_number=session.niu_number or other.niu_number or "DEMO-NIU-THOMAS",
                        similarity_score=Decimal("0.8700"),
                        status="OPEN",
                    )
                )

        await db.commit()
        print(f"[seed-thomas] Seeded AML/CFT demo data for session {session.id}.")


if __name__ == "__main__":
    asyncio.run(seed())
