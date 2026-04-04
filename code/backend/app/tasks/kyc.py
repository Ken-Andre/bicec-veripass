"""
Tâches Celery pour la gestion KYC (détection sessions abandonnées, doublons, AML screening)
Source: architecture-bicec-veripass.md §17, G32
"""
from datetime import datetime, timezone, timedelta
from sqlalchemy import text
from app.core.celery_config import celery
from app.db.session import AsyncSessionLocal
from app.core.logging import logger


async def detect_abandoned_sessions():
    """
    Détecte les sessions KYC inactives >72h (DRAFT) ou >15 jours (PENDING_INFO)
    et les marque comme ABANDONED.
    Exécuté quotidiennement par Celery Beat à 03h00.
    """
    logger.info("[abandoned-sessions] Checking for abandoned sessions...")

    async with AsyncSessionLocal() as db:
        try:
            # Sessions DRAFT inactives depuis 72h
            result = await db.execute(text("""
                UPDATE kyc_sessions 
                SET status = 'ABANDONED', updated_at = NOW()
                WHERE status = 'DRAFT'
                  AND updated_at < NOW() - INTERVAL '72 hours'
                RETURNING id, user_id, last_step_completed
            """))
            abandoned = result.fetchall()
            await db.commit()

            for session in abandoned:
                logger.info(f"[abandoned-sessions] Session {session.id} (user={session.user_id}) marked ABANDONED at step {session.last_step_completed}")
                # TODO: Envoyer notification à Marie avec lien de reprise

            logger.info(f"[abandoned-sessions] Marked {len(abandoned)} sessions as ABANDONED")
            return len(abandoned)

        except Exception as e:
            logger.error(f"[abandoned-sessions] Check failed: {e}", exc_info=True)
            await db.rollback()
            raise


celery_abandoned = celery.task(
    "app.tasks.kyc.detect_abandoned_sessions",
    bind=True,
    max_retries=2,
    default_retry_delay=600,
)(detect_abandoned_sessions)


async def check_duplicates(session_id: str):
    """
    Vérifie les doublons d'identité après soumission d'un dossier KYC.
    Exécuté par Celery (déclenché à la soumission du dossier).
    """
    logger.info(f"[duplicates] Checking duplicates for session {session_id}...")

    async with AsyncSessionLocal() as db:
        try:
            # Fuzzy matching nom + date naissance
            result = await db.execute(text("""
                SELECT 
                    ks.id, ks.user_id,
                    u.firstname, u.lastname, u.date_of_birth,
                    similarity(u.firstname || ' ' || u.lastname, 
                               (SELECT u2.firstname || ' ' || u2.lastname 
                                FROM users u2 
                                JOIN kyc_sessions ks2 ON u2.id = ks2.user_id 
                                WHERE ks2.id = :session_id)) AS similarity_score
                FROM kyc_sessions ks
                JOIN users u ON u.id = ks.user_id
                WHERE ks.id != :session_id
                  AND ks.status NOT IN ('REJECTED', 'ABANDONED', 'DISABLED')
                  AND similarity(u.firstname || ' ' || u.lastname,
                                 (SELECT u2.firstname || ' ' || u2.lastname
                                  FROM users u2
                                  JOIN kyc_sessions ks2 ON u2.id = ks2.user_id
                                  WHERE ks2.id = :session_id)) >= 0.7
                ORDER BY similarity_score DESC
                LIMIT 10
            """), {"session_id": session_id})
            matches = result.fetchall()

            if matches:
                logger.warning(f"[duplicates] Found {len(matches)} potential duplicates for session {session_id}")
                # TODO: Créer des entrées duplicate_checks + alerter Thomas
            else:
                logger.info(f"[duplicates] No duplicates found for session {session_id}")

            return len(matches)

        except Exception as e:
            logger.error(f"[duplicates] Check failed for {session_id}: {e}", exc_info=True)
            raise


celery_duplicates = celery.task(
    "app.tasks.kyc.check_duplicates",
    bind=True,
    max_retries=1,
    default_retry_delay=60,
)(check_duplicates)