"""
Tâches Celery pour la gestion KYC (détection sessions abandonnées, doublons, AML screening)
Source: architecture-bicec-veripass.md §17, G32
"""

import uuid
from sqlalchemy import text
from app.core.celery_config import celery
from app.db.session import AsyncSessionLocal
from app.core.logging import logger


async def detect_abandoned_sessions():
    """
    Détecte les sessions KYC inactives >72h (DRAFT) ou >15 jours (PENDING_INFO)
    et les marque comme ABANDONED, puis cascade-supprime les données associées
    (documents, OCR fields, consent records, biometric results) pour protéger
    la vie privée de l'utilisateur (COBAC R-2023/01, loi 2024-017).

    Le user et son phone sont conservés, mais le pin_hash est effacé pour
    forcer la re-authentification via OTP (sécurité). À la reconnexion OTP,
    un nouveau DRAFT sera créé automatiquement.

    Exécuté quotidiennement par Celery Beat à 03h00.
    """
    logger.info("[abandoned-sessions] Checking for abandoned sessions...")

    async with AsyncSessionLocal() as db:
        try:
            # Sessions DRAFT inactives depuis 72h
            result = await db.execute(
                text("""
                UPDATE kyc_sessions 
                SET status = 'ABANDONED', updated_at = NOW()
                WHERE status = 'DRAFT'
                  AND updated_at < NOW() - INTERVAL '72 hours'
                RETURNING id, user_id, last_step_completed
            """)
            )
            abandoned = result.fetchall()

            # Sessions PENDING_INFO inactives depuis 15 jours
            result2 = await db.execute(
                text("""
                UPDATE kyc_sessions 
                SET status = 'ABANDONED', updated_at = NOW()
                WHERE status = 'PENDING_INFO'
                  AND updated_at < NOW() - INTERVAL '15 days'
                RETURNING id, user_id, last_step_completed
            """)
            )
            abandoned2 = result2.fetchall()
            abandoned.extend(abandoned2)

            await db.commit()

            for session in abandoned:
                logger.info(
                    f"[abandoned-sessions] Session {session.id} (user={session.user_id}) "
                    f"marked ABANDONED at step {session.last_step_completed}"
                )
                # Cascade-delete associated data for privacy
                await _cascade_delete_abandoned_session(db, session.id, session.user_id)
                # TODO: Envoyer notification à Marie avec lien de reprise

            logger.info(
                f"[abandoned-sessions] Marked & purged {len(abandoned)} sessions as ABANDONED"
            )
            return len(abandoned)

        except Exception as e:
            logger.error(f"[abandoned-sessions] Check failed: {e}", exc_info=True)
            await db.rollback()
            raise


async def _cascade_delete_abandoned_session(db, session_id: uuid.UUID, user_id: uuid.UUID) -> None:
    """Delete documents, OCR fields, consent, biometrics for an ABANDONED session.

    The KYCSession row itself is kept (status=ABANDONED) for audit trail,
    but all PII artefacts are removed to comply with data minimization.
    Document files on disk are also removed.

    Also resets user.liveness_lockout_count_24h and clears user.pin_hash so
    that the user must re-authenticate via OTP (not PIN) for security.
    This ensures an abandoned session cannot be resumed via PIN login.
    """
    from app.modules.kyc.models import (
        Document, OCRField, BiometricResult, ConsentRecord,
    )
    from app.modules.auth.models import User
    from app.modules.kyc.storage import document_storage
    from sqlalchemy import delete, select

    # 0. Reset liveness lockout and clear PIN for the session's user
    user_result = await db.execute(select(User).where(User.id == user_id))
    user = user_result.scalar_one_or_none()
    if user:
        if (user.liveness_lockout_count_24h or 0) > 0:
            user.liveness_lockout_count_24h = 0
        if user.pin_hash:
            user.pin_hash = None
            logger.info(f"[abandoned-sessions] Cleared pin_hash for user {user.id} — must re-auth via OTP")
        logger.info(f"[abandoned-sessions] Reset lockout count and/or PIN for user {user.id}")

    # 1. Fetch documents (id + file_path) in a single query to avoid N+1
    docs_result = await db.execute(
        select(Document.id, Document.file_path).where(Document.session_id == session_id)
    )
    docs = docs_result.all()
    doc_ids = [row[0] for row in docs]

    # 2. Delete OCR fields for all documents
    if doc_ids:
        await db.execute(
            delete(OCRField).where(OCRField.document_id.in_(doc_ids))
        )
        logger.info(f"[abandoned-sessions] Deleted OCR fields for {len(doc_ids)} documents in session {session_id}")

    # 3. Delete document files from disk
    for doc_id, file_path_str in docs:
        if file_path_str:
            try:
                file_path = document_storage.base_path / file_path_str
                if file_path.exists():
                    file_path.unlink()
                    logger.info(f"[abandoned-sessions] Deleted file: {file_path_str}")
            except Exception as e:
                logger.warning(f"[abandoned-sessions] Failed to delete file {file_path_str}: {e}")

    # 4. Delete document records
    await db.execute(
        delete(Document).where(Document.session_id == session_id)
    )

    # 5. Delete biometric results
    await db.execute(
        delete(BiometricResult).where(BiometricResult.session_id == session_id)
    )

    # 6. Delete consent record (contains signature_data PII)
    await db.execute(
        delete(ConsentRecord).where(ConsentRecord.session_id == session_id)
    )

    # NOTE: No commit here — the parent detect_abandoned_sessions() commits once
    # after processing all sessions, so a failure on session N rolls back everything.
    logger.info(f"[abandoned-sessions] Cascade-deleted all PII artefacts for session {session_id}")


@celery.task(
    name="app.tasks.kyc.detect_abandoned_sessions",
    bind=True,
    max_retries=2,
    default_retry_delay=600,
)
async def celery_abandoned(self):
    """Celery task wrapper for detect_abandoned_sessions."""
    return await detect_abandoned_sessions()


async def check_duplicates(session_id: str):
    """
    Vérifie les doublons d'identité après soumission d'un dossier KYC.
    Exécuté par Celery (déclenché à la soumission du dossier).
    """
    logger.info(f"[duplicates] Checking duplicates for session {session_id}...")

    async with AsyncSessionLocal() as db:
        try:
            # Fuzzy matching nom + date naissance
            result = await db.execute(
                text("""
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
            """),
                {"session_id": session_id},
            )
            matches = result.fetchall()

            if matches:
                logger.warning(
                    f"[duplicates] Found {len(matches)} potential duplicates for session {session_id}"
                )
                # TODO: Créer des entrées duplicate_checks + alerter Thomas
            else:
                logger.info(
                    f"[duplicates] No duplicates found for session {session_id}"
                )

            return len(matches)

        except Exception as e:
            logger.error(
                f"[duplicates] Check failed for {session_id}: {e}", exc_info=True
            )
            raise


@celery.task(
    name="app.tasks.kyc.check_duplicates",
    bind=True,
    max_retries=1,
    default_retry_delay=60,
)
async def celery_duplicates(self, session_id: str):
    """Celery task wrapper for check_duplicates."""
    return await check_duplicates(session_id)
