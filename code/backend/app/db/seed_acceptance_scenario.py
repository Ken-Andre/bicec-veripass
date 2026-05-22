"""Seed deterministic acceptance data for final-stage evidence runs.

Usage inside the API container:
    python -m app.db.seed_acceptance_scenario
"""

import asyncio
import hashlib
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
from app.core.security import hash_password
from app.modules.auth.models import Agent, AgentRole, User
from app.modules.kyc.models import (
    BiometricResult,
    Document,
    KYCSession,
    Notification,
    OCRField,
    SupportMessage,
    SupportThread,
    ValidationDecision,
)

PHONE = "+237699000001"
EMAIL = "marie_test@bicec-veripass.local"


async def _ensure_agent(db: AsyncSession) -> Agent:
    result = await db.execute(select(Agent).where(Agent.email == "jean@bicec.cm"))
    agent = result.scalar_one_or_none()
    if agent:
        return agent

    agent = Agent(
        name="Jean Demo",
        email="jean@bicec.cm",
        password_hash=hash_password("Password123!"),
        role=AgentRole.JEAN,
        is_available=True,
    )
    db.add(agent)
    await db.flush()
    return agent


def _write_placeholder_file(session_id: uuid.UUID, name: str, content: bytes) -> tuple[str, str, int]:
    base_dir = Path(settings.STORAGE_PATH) / "acceptance" / str(session_id)
    base_dir.mkdir(parents=True, exist_ok=True)
    target = base_dir / name
    target.write_bytes(content)
    return str(target), hashlib.sha256(content).hexdigest(), len(content)


async def _add_documents(db: AsyncSession, session: KYCSession) -> None:
    docs = [
        ("CNI_RECTO", "cni_recto.txt", b"ACCEPTANCE CNI RECTO MARIE TEST"),
        ("CNI_VERSO", "cni_verso.txt", b"ACCEPTANCE CNI VERSO MARIE TEST"),
    ]
    for doc_type, filename, content in docs:
        path, digest, size = _write_placeholder_file(session.id, filename, content)
        document = Document(
            session_id=session.id,
            doc_type=doc_type,
            file_path=path,
            sha256_hash=digest,
            ocr_status="SUCCESS",
            ocr_engine="ACCEPTANCE_SEED",
            confidence_per_field={"full_name": 0.99, "document_number": 0.98},
            capture_quality_metrics={"seeded": True, "sharpness": 0.95},
            file_size_bytes=size,
        )
        db.add(document)
        await db.flush()
        db.add_all(
            [
                OCRField(
                    document_id=document.id,
                    field_name="full_name",
                    extracted_value="Marie Test",
                    confidence_score=0.99,
                ),
                OCRField(
                    document_id=document.id,
                    field_name="document_number",
                    extracted_value="CNI-ACCEPT-001",
                    confidence_score=0.98,
                ),
            ]
        )


async def seed() -> None:
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as db:
        result = await db.execute(select(User).where(User.phone == PHONE))
        user = result.scalar_one_or_none()
        if user:
            existing = await db.execute(select(KYCSession.id).where(KYCSession.user_id == user.id))
            session_ids = [row[0] for row in existing.all()]
            if session_ids:
                thread_ids = (
                    await db.execute(select(SupportThread.id).where(SupportThread.session_id.in_(session_ids)))
                ).scalars().all()
                if thread_ids:
                    await db.execute(delete(SupportMessage).where(SupportMessage.thread_id.in_(thread_ids)))
                    await db.execute(delete(SupportThread).where(SupportThread.id.in_(thread_ids)))
                await db.execute(delete(Notification).where(Notification.user_id == user.id))
                await db.execute(delete(ValidationDecision).where(ValidationDecision.session_id.in_(session_ids)))
                await db.execute(delete(BiometricResult).where(BiometricResult.session_id.in_(session_ids)))
                await db.execute(delete(OCRField).where(OCRField.document_id.in_(select(Document.id).where(Document.session_id.in_(session_ids)))))
                await db.execute(delete(Document).where(Document.session_id.in_(session_ids)))
                await db.execute(delete(KYCSession).where(KYCSession.id.in_(session_ids)))
        else:
            user = User(
                phone=PHONE,
                email=EMAIL,
                pin_hash=hash_password("123456"),
                biometric_opt_in=False,
                role="CLIENT",
                language="fr",
            )
            db.add(user)
            await db.flush()

        user.phone = PHONE
        user.email = EMAIL
        user.pin_hash = hash_password("123456")
        user.is_deleted = False

        agent = await _ensure_agent(db)
        now = datetime.now(timezone.utc)
        scenarios = [
            ("PENDING_AGENT_REVIEW", "RESTRICTED", "SUBMITTED", None),
            ("PENDING_INFO", "RESTRICTED", "INFO_REQUESTED", "Veuillez renvoyer un justificatif lisible."),
            ("APPROVED", "LIMITED_ACCESS", "APPROVED", "Dossier valide."),
        ]

        for index, (status, access_level, decision, reason) in enumerate(scenarios):
            session = KYCSession(
                user_id=user.id,
                status=status,
                access_level=access_level,
                client_name="Marie Test",
                last_step_completed="SUBMITTED",
                started_at=now - timedelta(days=3 - index),
                submitted_at=now - timedelta(days=2 - index),
                completed_at=now if status == "APPROVED" else None,
                confidence_score_global=0.96,
            )
            db.add(session)
            await db.flush()
            await _add_documents(db, session)
            db.add(
                BiometricResult(
                    session_id=session.id,
                    face_match_score=0.97,
                    liveness_score=0.96,
                    anti_spoofing_score=0.94,
                    model_version_face="acceptance-seed",
                    model_version_liveness="acceptance-seed",
                )
            )

            if decision != "SUBMITTED":
                db.add(
                    ValidationDecision(
                        session_id=session.id,
                        agent_id=agent.id,
                        decision=decision,
                        reason=reason,
                    )
                )

            notification_type = {
                "PENDING_AGENT_REVIEW": "KYC_SUBMITTED",
                "PENDING_INFO": "KYC_INFO_REQUESTED",
                "APPROVED": "KYC_APPROVED",
            }[status]
            db.add(
                Notification(
                    user_id=user.id,
                    type=notification_type,
                    message=reason or "Votre dossier est en cours de revue.",
                    payload={"session_id": str(session.id), "status": status},
                    is_read=False,
                )
            )

            if status == "PENDING_INFO":
                thread = SupportThread(session_id=session.id, status="OPEN")
                db.add(thread)
                await db.flush()
                db.add_all(
                    [
                        SupportMessage(
                            thread_id=thread.id,
                            sender_type="JEAN",
                            sender_id=agent.id,
                            content="Merci de renvoyer un justificatif clair depuis ce fil.",
                        ),
                        SupportMessage(
                            thread_id=thread.id,
                            sender_type="MARIE",
                            sender_id=user.id,
                            content="Bien recu, je prepare le fichier complementaire.",
                        ),
                    ]
                )

        await db.commit()
        print("Acceptance seed complete")
        print(f"User phone: {PHONE}")
        print("PIN: 123456")
        print("Dossiers: PENDING_AGENT_REVIEW, PENDING_INFO, APPROVED")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed())
