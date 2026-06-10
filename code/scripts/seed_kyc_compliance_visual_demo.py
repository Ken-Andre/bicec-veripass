"""Seed one visual-demo dossier for KYC compliance proof screenshots.

Run inside the API container:
    python /tmp/seed_kyc_compliance_visual_demo.py
"""

import asyncio
import base64
import hashlib
import uuid
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import delete, select

from app.core.config import settings
from app.db.session import AsyncSessionLocal
from app.modules.audit.models import AuditLog
from app.modules.auth.models import Agent, User
from app.modules.kyc.models import (
    AmlAlert,
    BiometricResult,
    ConsentRecord,
    Document,
    DossierAssignment,
    KYCSession,
    OCRField,
    PEPSanctions,
    ValidationDecision,
)

DEMO_PHONE = "+237699880026"
DEMO_EMAIL = "visual-demo-kyc@bicec-veripass.local"

PNG_1X1 = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII="
)


def write_demo_file(session_id: uuid.UUID, name: str, content: bytes = PNG_1X1) -> tuple[str, str, int]:
    relative = Path("visual-demo") / str(session_id) / name
    target = Path(settings.STORAGE_PATH) / relative
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_bytes(content)
    return str(relative), hashlib.sha256(content).hexdigest(), len(content)


async def get_agent(email: str) -> Agent:
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(Agent).where(Agent.email == email))
        agent = result.scalar_one()
        return agent


async def seed() -> None:
    async with AsyncSessionLocal() as db:
        jean_result = await db.execute(select(Agent).where(Agent.email == "jean@bicec.cm"))
        jean = jean_result.scalar_one()

        user_result = await db.execute(select(User).where(User.phone == DEMO_PHONE))
        user = user_result.scalar_one_or_none()
        if user:
            session_ids = (
                await db.execute(select(KYCSession.id).where(KYCSession.user_id == user.id))
            ).scalars().all()
            if session_ids:
                document_ids = (
                    await db.execute(select(Document.id).where(Document.session_id.in_(session_ids)))
                ).scalars().all()
                if document_ids:
                    await db.execute(delete(OCRField).where(OCRField.document_id.in_(document_ids)))
                await db.execute(delete(AuditLog).where(AuditLog.record_id.in_([str(item) for item in session_ids])))
                await db.execute(delete(ValidationDecision).where(ValidationDecision.session_id.in_(session_ids)))
                await db.execute(delete(DossierAssignment).where(DossierAssignment.session_id.in_(session_ids)))
                await db.execute(delete(AmlAlert).where(AmlAlert.session_id.in_(session_ids)))
                await db.execute(delete(BiometricResult).where(BiometricResult.session_id.in_(session_ids)))
                await db.execute(delete(ConsentRecord).where(ConsentRecord.session_id.in_(session_ids)))
                await db.execute(delete(Document).where(Document.session_id.in_(session_ids)))
                await db.execute(delete(KYCSession).where(KYCSession.id.in_(session_ids)))
        else:
            user = User(
                phone=DEMO_PHONE,
                email=DEMO_EMAIL,
                role="CLIENT",
                language="fr",
                biometric_opt_in=False,
                is_deleted=False,
            )
            db.add(user)
            await db.flush()

        user.phone = DEMO_PHONE
        user.email = DEMO_EMAIL
        user.role = "CLIENT"
        user.is_deleted = False

        now = datetime.now(timezone.utc)
        session = KYCSession(
            user_id=user.id,
            agency_id=jean.agency_id,
            status="PENDING_AGENT_REVIEW",
            access_level="RESTRICTED",
            client_name="Client Demo Biometrie AML",
            last_step_completed="SUBMITTED",
            priority_flag=True,
            started_at=now,
            submitted_at=now,
            confidence_score_global=0.62,
            address_city="Douala",
            address_commune="Douala 1",
            address_quartier="Bonanjo",
            utility_provider="ENEO",
            niu_type="DECLARATIVE",
            niu_number="M012345678901A",
            niu_declarative=True,
        )
        db.add(session)
        await db.flush()

        doc_specs = [
            ("CNI_RECTO", "cni-recto-demo.png"),
            ("CNI_VERSO", "cni-verso-demo.png"),
            ("SELFIE", "selfie-demo.png"),
            ("BILL_ENEO", "eneo-demo.png"),
        ]
        for doc_type, filename in doc_specs:
            file_path, digest, size = write_demo_file(session.id, filename)
            document = Document(
                session_id=session.id,
                doc_type=doc_type,
                file_path=file_path,
                sha256_hash=digest,
                ocr_status="SUCCESS" if doc_type.startswith("CNI") else "PENDING",
                ocr_engine="VISUAL_DEMO",
                confidence_per_field={"visual_demo": True},
                file_size_bytes=size,
            )
            db.add(document)
            await db.flush()
            if doc_type == "CNI_RECTO":
                db.add_all(
                    [
                        OCRField(document_id=document.id, field_name="Nom", extracted_value="AML", confidence_score=0.98),
                        OCRField(document_id=document.id, field_name="Prénom", extracted_value="Client Demo Biometrie", confidence_score=0.98),
                        OCRField(document_id=document.id, field_name="numero_cni", extracted_value="CNI-DEMO-2026", confidence_score=0.96),
                    ]
                )
            if doc_type == "CNI_VERSO":
                db.add_all(
                    [
                        OCRField(document_id=document.id, field_name="adresse", extracted_value="Bonanjo, Douala", confidence_score=0.92),
                        OCRField(document_id=document.id, field_name="date_expiration", extracted_value="2031-12-31", confidence_score=0.95),
                    ]
                )

        db.add(
            BiometricResult(
                session_id=session.id,
                face_match_score=0.42,
                face_match_status="FAILED",
                face_match_reason="Visual demo: face match failed and anti-spoofing below threshold.",
                face_match_threshold=0.80,
                liveness_score=0.91,
                anti_spoofing_score=0.31,
                model_version_face="visual-demo-face-v1",
                model_version_liveness="visual-demo-liveness-v1",
            )
        )

        pep = PEPSanctions(
            source="BICEC_VISUAL_DEMO",
            entity_type="INDIVIDUAL",
            full_name="Client Demo Biometrie AML",
            aliases=["DEMO AML"],
            nationality="CM",
            programs=["INTERNAL_WATCHLIST"],
            is_active=True,
        )
        db.add(pep)
        await db.flush()
        db.add(
            AmlAlert(
                session_id=session.id,
                pep_sanctions_id=pep.id,
                alert_type="PEP",
                match_score=0.87,
                status="OPEN",
            )
        )

        db.add(
            ConsentRecord(
                session_id=session.id,
                cgu_accepted=True,
                privacy_accepted=True,
                data_processing_accepted=True,
                consent_method="CHECKBOX_DIGITAL",
            )
        )
        db.add(
            DossierAssignment(
                session_id=session.id,
                agent_id=jean.id,
                is_current=True,
            )
        )
        db.add_all(
            [
                AuditLog(
                    action="KYC_SUBMIT",
                    table_name="kyc_sessions",
                    record_id=str(session.id),
                    new_data={"status": session.status, "visual_demo": True},
                    performed_by=user.id,
                ),
                AuditLog(
                    action="KYC_BIOMETRIC_RISK_FLAGGED",
                    table_name="kyc_sessions",
                    record_id=str(session.id),
                    new_data={
                        "biometric_risk_flags": [
                            "FACE_MATCH_FAILED",
                            "ANTI_SPOOFING_BELOW_THRESHOLD",
                        ],
                        "visual_demo": True,
                    },
                    performed_by=user.id,
                ),
            ]
        )
        await db.commit()
        print(str(session.id))


if __name__ == "__main__":
    asyncio.run(seed())
