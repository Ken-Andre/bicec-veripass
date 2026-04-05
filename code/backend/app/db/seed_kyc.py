"""Seed KYC test data for development.

Creates KYC sessions in various states for testing the validation flow.
All data comes from the database via Python seeds — NO hardcoded mocks in frontend.

Usage:
    uv run python app/db/seed_kyc.py
"""
import asyncio
import uuid
from datetime import datetime, timezone, timedelta
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select

from app.core.config import settings
from app.db.base import Base, User
from app.modules.kyc.models import KYCSession, Document, OCRField, BiometricResult, ConsentRecord


async def seed_kyc_sessions(db: AsyncSession):
    """Create KYC sessions in various states for testing."""

    # Get test users
    result = await db.execute(select(User).where(User.phone == "+237612345678"))
    marie = result.scalar_one_or_none()

    result = await db.execute(select(User).where(User.phone == "+237699999999"))
    returning_user = result.scalar_one_or_none()

    if not marie:
        print("⚠ Test user Marie not found. Run seed_test_users.py first.")
        return

    sessions_data = [
        {
            "user": marie,
            "status": "DRAFT",
            "access_level": "RESTRICTED",
            "last_step_completed": "welcome",
            "description": "Marie - New onboarding, just started",
        },
        {
            "user": marie,
            "status": "DRAFT",
            "access_level": "RESTRICTED",
            "last_step_completed": "ocr_review",
            "description": "Marie - CNI captured, OCR reviewed",
            "add_documents": True,
            "add_ocr_fields": True,
        },
        {
            "user": marie,
            "status": "DRAFT",
            "access_level": "RESTRICTED",
            "last_step_completed": "liveness",
            "description": "Marie - Liveness completed",
            "add_documents": True,
            "add_ocr_fields": True,
            "add_biometric": True,
        },
        {
            "user": marie,
            "status": "PENDING_KYC",
            "access_level": "RESTRICTED",
            "last_step_completed": "submission",
            "description": "Marie - Submitted, awaiting Jean validation",
            "add_documents": True,
            "add_ocr_fields": True,
            "add_biometric": True,
            "add_consent": True,
            "submitted": True,
        },
    ]

    for session_data in sessions_data:
        # Check if session already exists
        result = await db.execute(
            select(KYCSession).where(
                KYCSession.user_id == session_data["user"].id,
                KYCSession.status == session_data["status"],
            )
        )
        existing = result.scalars().first()
        if existing:
            print(f"⚠ Session already exists: {session_data['description']}")
            continue

        # Create session
        session = KYCSession(
            id=uuid.uuid4(),
            user_id=session_data["user"].id,
            status=session_data["status"],
            access_level=session_data["access_level"],
            last_step_completed=session_data["last_step_completed"],
            started_at=datetime.now(timezone.utc) - timedelta(hours=2),
            submitted_at=datetime.now(timezone.utc) if session_data.get("submitted") else None,
        )
        db.add(session)
        await db.flush()

        # Add documents if requested
        if session_data.get("add_documents"):
            docs = [
                {"type": "CNI_RECTO", "path": f"/uploads/{session.id}/cni_recto.jpg"},
                {"type": "CNI_VERSO", "path": f"/uploads/{session.id}/cni_verso.jpg"},
                {"type": "SELFIE", "path": f"/uploads/{session.id}/selfie.jpg"},
            ]
            for doc_data in docs:
                doc = Document(
                    id=uuid.uuid4(),
                    session_id=session.id,
                    doc_type=doc_data["type"],
                    file_path=doc_data["path"],
                    sha256_hash=uuid.uuid4().hex,
                    captured_at=datetime.now(timezone.utc),
                    file_size_bytes=102400,
                )
                db.add(doc)

                # Add OCR fields for CNI documents
                if session_data.get("add_ocr_fields") and doc_data["type"] in ("CNI_RECTO", "CNI_VERSO"):
                    ocr_fields = [
                        {"field": "nom", "value": "NGUEMO", "confidence": 0.95},
                        {"field": "prenom", "value": "Marie Claire", "confidence": 0.92},
                        {"field": "date_naissance", "value": "15/03/1992", "confidence": 0.88},
                        {"field": "lieu_naissance", "value": "Douala", "confidence": 0.72},
                        {"field": "numero_cni", "value": "123456789", "confidence": 0.96},
                    ]
                    for ocr_data in ocr_fields:
                        ocr = OCRField(
                            id=uuid.uuid4(),
                            document_id=doc.id,
                            field_name=ocr_data["field"],
                            extracted_value=ocr_data["value"],
                            confidence_score=ocr_data["confidence"],
                        )
                        db.add(ocr)

        # Add biometric result if requested
        if session_data.get("add_biometric"):
            biometric = BiometricResult(
                id=uuid.uuid4(),
                session_id=session.id,
                face_match_score=0.92,
                liveness_score=0.95,
                anti_spoofing_score=0.98,
                processed_at=datetime.now(timezone.utc),
            )
            db.add(biometric)

        # Add consent record if requested
        if session_data.get("add_consent"):
            consent = ConsentRecord(
                id=uuid.uuid4(),
                session_id=session.id,
                cgu_accepted=True,
                privacy_accepted=True,
                data_processing_accepted=True,
                consent_method="CHECKBOX_DIGITAL",
                cgu_version="1.0.0",
                privacy_version="1.0.0",
                signed_at=datetime.now(timezone.utc),
            )
            db.add(consent)

        print(f"✓ Created: {session_data['description']} (status={session_data['status']})")

    await db.commit()
    print("\n✓ KYC seed completed successfully!")


async def main():
    """Main entry point."""
    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as session:
        await seed_kyc_sessions(session)

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(main())