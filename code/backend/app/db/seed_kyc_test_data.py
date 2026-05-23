"""Seed script pour données de test KYC/AML
Génère des données complètes dans la DB PostgreSQL (no hardcode mocks dans le frontend).
Usage:
    cd code/backend
    docker exec vp_api python -m app.db.seed_kyc_test_data
    # ou en local:
    uv run python -m app.db.seed_kyc_test_data
"""

import asyncio
import uuid
from datetime import datetime, timedelta, timezone
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings
import app.modules.kyc.models  # noqa: F401
import app.modules.auth.models  # noqa: F401
import app.modules.aml.models  # noqa: F401


async def seed():
    """Seed données de test KYC/AML."""
    print("[seed-kyc] Connexion à la DB...")

    engine = create_async_engine(settings.DATABASE_URL, echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with async_session() as db:
        # --- Récupérer les agents existants ---
        from app.modules.auth.models import Agent
        from app.modules.kyc.models import KYCSession
        from app.modules.aml.models import AmlAlert, NiuConflict, BatchJob
        from sqlalchemy import select

        agents = (await db.execute(select(Agent))).scalars().all()
        if not agents:
            print(
                "[seed-kyc] ⚠ Aucun agent trouvé. Exécutez seed_admin_it.py et seed_agencies.py d'abord."
            )
            return

        jean = next((a for a in agents if a.role == "JEAN"), None)
        thomas = next((a for a in agents if a.role == "THOMAS"), None)
        next((a for a in agents if a.role == "SYLVIE"), None)

        if not jean:
            print("[seed-kyc] ⚠ Aucun agent JEAN trouvé.")
            return

        # --- Créer des sessions KYC de test dans différents états ---
        test_sessions = [
            {
                "status": "PENDING_KYC",
                "access_level": "RESTRICTED",
                "last_step": "submission",
            },
            {
                "status": "PENDING_REVIEW",
                "access_level": "RESTRICTED",
                "last_step": "aml_clear",
            },
            {
                "status": "MANUAL_REVIEW",
                "access_level": "RESTRICTED",
                "last_step": "assigned",
            },
            {
                "status": "APPROVED",
                "access_level": "LIMITED_ACCESS",
                "last_step": "activated",
            },
        ]

        session_ids = []
        for i, cfg in enumerate(test_sessions):
            sid = uuid.uuid4()
            session = KYCSession(
                id=sid,
                user_id=uuid.uuid4(),  # Simulé
                status=cfg["status"],
                access_level=cfg["access_level"],
                last_step_completed=cfg["last_step"],
                updated_at=datetime.now(timezone.utc) - timedelta(hours=i),
            )
            db.add(session)
            session_ids.append(sid)

        await db.commit()

        # --- Créer alertes AML de test ---
        for sid in session_ids[:2]:
            alert = AmlAlert(
                id=uuid.uuid4(),
                session_id=sid,
                alert_type="PEP",
                match_score=0.72,
                status="PENDING",
            )
            db.add(alert)

        # --- Créer conflits NIU de test ---
        conflict = NiuConflict(
            id=uuid.uuid4(),
            niu="M1234567890123",
            session_id_new=session_ids[0] if session_ids else uuid.uuid4(),
            session_id_existing=session_ids[1]
            if len(session_ids) > 1
            else uuid.uuid4(),
            similarity_score=0.85,
            status="PENDING",
        )
        db.add(conflict)

        # --- Créer batch job de test ---
        batch = BatchJob(
            id=uuid.uuid4(),
            job_type="AMPLITUDE_PROVISIONING",
            status="PENDING",
            total_items=len(session_ids),
            created_by=thomas.id if thomas else None,
        )
        db.add(batch)

        await db.commit()
        print(f"[seed-kyc] ✅ {len(session_ids)} sessions KYC créées")
        print("[seed-kyc] ✅ 2 alertes AML créées")
        print("[seed-kyc] ✅ 1 conflit NIU créé")
        print("[seed-kyc] ✅ 1 batch job créé")
        print("[seed-kyc] ✅ Terminé")

    await engine.dispose()


if __name__ == "__main__":
    asyncio.run(seed())
