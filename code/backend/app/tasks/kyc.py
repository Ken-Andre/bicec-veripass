"""
Tâches Celery pour la gestion KYC (détection sessions abandonnées, doublons, AML screening)
Source: architecture-bicec-veripass.md §17, G32
"""

import asyncio
import re
import uuid
from datetime import datetime, timedelta, timezone
from difflib import SequenceMatcher

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.celery_config import celery
from app.db.session import AsyncSessionLocal
from app.core.logging import logger
from app.modules.notifications.service import create_user_notification


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
            from app.modules.analytics.service import track_event_best_effort
            from app.modules.kyc.models import KYCSession

            now = datetime.now(timezone.utc)
            result = await db.execute(
                select(KYCSession).where(KYCSession.status.in_(["DRAFT", "PENDING_INFO"]))
            )
            candidates = result.scalars().all()
            abandoned = []
            abandoned_events = []
            for session in candidates:
                started_at = session.started_at
                if started_at is None:
                    continue
                if started_at.tzinfo is None:
                    started_at = started_at.replace(tzinfo=timezone.utc)
                max_age = timedelta(days=15) if session.status == "PENDING_INFO" else timedelta(hours=72)
                if now - started_at < max_age:
                    continue
                session.status = "ABANDONED"
                abandoned.append(session)
                abandoned_events.append(
                    {
                        "event_type": "SESSION_ABANDONED",
                        "session_id": session.id,
                        "user_id": session.user_id,
                        "agency_id": session.agency_id,
                        "occurred_at": now,
                        "step": session.last_step_completed,
                        "status": "ABANDONED",
                    }
                )

            for session in abandoned:
                logger.info(
                    f"[abandoned-sessions] Session {session.id} (user={session.user_id}) "
                    f"marked ABANDONED at step {session.last_step_completed}"
                )
                # Cascade-delete associated data for privacy
                await _cascade_delete_abandoned_session(db, session.id, session.user_id)
                # TODO: Envoyer notification à Marie avec lien de reprise

            await db.commit()
            for event in abandoned_events:
                await track_event_best_effort(db, **event)

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
            from app.modules.analytics.service import track_event_best_effort
            from app.modules.kyc.models import Document, DuplicateCheck, KYCSession

            session_uuid = uuid.UUID(session_id)
            result = await db.execute(
                select(KYCSession)
                .options(selectinload(KYCSession.documents).selectinload(Document.ocr_fields))
                .where(KYCSession.id == session_uuid)
            )
            target = result.scalar_one_or_none()
            if target is None:
                return 0

            target_name = _session_identity_name(target)
            target_niu = (target.niu_number or "").strip()
            candidates_result = await db.execute(
                select(KYCSession)
                .options(selectinload(KYCSession.documents).selectinload(Document.ocr_fields))
                .where(
                    KYCSession.id != session_uuid,
                    KYCSession.status.not_in(["REJECTED", "ABANDONED", "DISABLED"]),
                )
                .limit(200)
            )
            matches = []
            for candidate in candidates_result.scalars().all():
                candidate_niu = (candidate.niu_number or "").strip()
                niu_match = bool(target_niu and candidate_niu and target_niu == candidate_niu)
                name_score = _match_score(target_name, _session_identity_name(candidate))
                if not niu_match and name_score < 0.7:
                    continue

                match_score = 1.0 if niu_match else name_score
                match_type = "NIU" if niu_match else "NAME_FUZZY"
                existing = await db.execute(
                    select(DuplicateCheck).where(
                        DuplicateCheck.session_id_new == target.id,
                        DuplicateCheck.session_id_existing == candidate.id,
                    )
                )
                if existing.scalar_one_or_none() is not None:
                    continue

                db.add(
                    DuplicateCheck(
                        id=uuid.uuid4(),
                        session_id_new=target.id,
                        session_id_existing=candidate.id,
                        match_type=match_type,
                        niu_number=target_niu or candidate_niu or None,
                        similarity_score=round(match_score, 4),
                        status="OPEN",
                        justification=(
                            "Conflit NIU identique"
                            if niu_match
                            else f"Nom similaire ({match_score:.0%})"
                        ),
                    )
                )
                matches.append((candidate.id, match_type, match_score))

            await db.commit()
            for candidate_id, match_type, match_score in matches:
                if match_type == "NIU":
                    await track_event_best_effort(
                        db,
                        event_type="NIU_CONFLICT_DETECTED",
                        session_id=target.id,
                        user_id=target.user_id,
                        agency_id=target.agency_id,
                        step="duplicate_check",
                        status="OPEN",
                        metadata={
                            "existing_session_id": str(candidate_id),
                            "similarity_score": round(match_score, 4),
                            "match_type": match_type,
                        },
                    )

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


_CNI_DATE_PATTERNS = ("%d/%m/%Y", "%d-%m-%Y", "%d.%m.%Y")
_SANCTIONS_HIGH_THRESHOLD = 0.70
_SANCTIONS_CRITICAL_THRESHOLD = 0.85


def parse_cni_expiry_date(value: str | None):
    """Parse supported CNI expiry date formats."""
    if not value:
        return None
    cleaned = value.strip()
    match = re.search(r"\b\d{1,2}[./-]\d{1,2}[./-]\d{2,4}\b", cleaned)
    if match:
        cleaned = match.group(0)
    for fmt in _CNI_DATE_PATTERNS:
        try:
            parsed = datetime.strptime(cleaned, fmt).date()
            if parsed.year < 100:
                parsed = parsed.replace(year=parsed.year + 2000)
            return parsed
        except ValueError:
            continue
    return None


def ocr_field_effective_value(field) -> str | None:
    """Prefer human corrections over raw OCR extraction."""
    corrected = (field.corrected_value or "").strip() if field.corrected_value else ""
    if corrected:
        return corrected
    extracted = (field.extracted_value or "").strip() if field.extracted_value else ""
    return extracted or None


def _normalize_name(value: str | None) -> str:
    value = (value or "").upper()
    return re.sub(r"[^A-Z0-9 ]+", " ", value).strip()


def _match_score(left: str, right: str) -> float:
    left_norm = _normalize_name(left)
    right_norm = _normalize_name(right)
    if not left_norm or not right_norm:
        return 0.0
    return SequenceMatcher(None, left_norm, right_norm).ratio()


def _session_identity_name(session) -> str:
    if session.client_name:
        return session.client_name
    names: dict[str, str] = {}
    for document in session.documents:
        if document.doc_type not in {"CNI_RECTO", "CNI_VERSO"}:
            continue
        for field in document.ocr_fields:
            if field.field_name in {"nom", "prenom", "surname", "given_names"}:
                value = ocr_field_effective_value(field)
                if value:
                    names[field.field_name] = value
    return " ".join(
        value for key, value in names.items() if key in {"nom", "prenom", "surname", "given_names"}
    ).strip()


async def check_document_expiry(expiring_within_days: int = 30) -> int:
    """Mark CNI documents as expired/expiring and notify affected clients."""
    from app.modules.kyc.models import Document, KYCSession

    today = datetime.now(timezone.utc).date()
    expiring_cutoff = today + timedelta(days=expiring_within_days)
    notified = 0

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(KYCSession)
            .options(selectinload(KYCSession.documents).selectinload(Document.ocr_fields))
            .where(KYCSession.status.in_(["APPROVED", "PENDING_AGENT_REVIEW", "PENDING_INFO"]))
        )
        sessions = result.scalars().all()

        for session in sessions:
            expiry_date = None
            for document in session.documents:
                if document.doc_type not in {"CNI_RECTO", "CNI_VERSO"}:
                    continue
                for field in document.ocr_fields:
                    if field.field_name != "date_expiration":
                        continue
                    candidate = parse_cni_expiry_date(ocr_field_effective_value(field))
                    if candidate and (expiry_date is None or candidate < expiry_date):
                        expiry_date = candidate

            if expiry_date is None or expiry_date > expiring_cutoff:
                if session.doc_expiry_flag:
                    session.doc_expiry_flag = False
                    session.doc_expiry_deadline = None
                continue

            old_deadline = session.doc_expiry_deadline
            deadline_dt = datetime.combine(expiry_date, datetime.min.time(), tzinfo=timezone.utc)
            session.doc_expiry_flag = True
            session.doc_expiry_deadline = deadline_dt

            event_state = "expired" if expiry_date < today else "expiring"
            event_key = f"cni-expiry:{session.id}:{expiry_date.isoformat()}:{event_state}"
            if session.doc_expiry_notified_at and old_deadline == deadline_dt:
                continue

            if event_state == "expired":
                message = (
                    "Votre piece d'identite est expiree. Veuillez contacter le support "
                    "BICEC VeriPass pour renouveler vos informations."
                )
            else:
                message = (
                    "Votre piece d'identite arrive bientot a expiration. Veuillez preparer "
                    "son renouvellement pour conserver l'acces a vos services."
                )

            await create_user_notification(
                db,
                user_id=session.user_id,
                notification_type="COMPLIANCE_DOCUMENT_EXPIRY",
                message=message,
                payload={
                    "event_key": event_key,
                    "session_id": str(session.id),
                    "expiry_date": expiry_date.isoformat(),
                    "state": event_state,
                },
                official=True,
                subject="Renouvellement de piece d'identite",
            )
            session.doc_expiry_notified_at = datetime.now(timezone.utc)
            notified += 1

        await db.commit()
    return notified


async def screen_session_against_sanctions(session_id: str) -> int:
    """Create AML alerts for a submitted KYC session when sanctions match."""
    from app.modules.analytics.service import track_event_best_effort
    from app.modules.kyc.models import AmlAlert, Document, KYCSession, PEPSanctions

    session_uuid = uuid.UUID(session_id)
    created = 0

    async with AsyncSessionLocal() as db:
        session_result = await db.execute(
            select(KYCSession)
            .options(selectinload(KYCSession.documents).selectinload(Document.ocr_fields))
            .where(KYCSession.id == session_uuid)
        )
        session = session_result.scalar_one_or_none()
        if session is None:
            return 0

        identity_name = _session_identity_name(session)
        if not identity_name:
            return 0

        sanctions_result = await db.execute(
            select(PEPSanctions).where(PEPSanctions.is_active == True)  # noqa: E712
        )
        sanctions = sanctions_result.scalars().all()

        for entry in sanctions:
            score = _match_score(identity_name, entry.full_name)
            if score < _SANCTIONS_HIGH_THRESHOLD:
                continue

            existing_result = await db.execute(
                select(AmlAlert).where(
                    AmlAlert.session_id == session.id,
                    AmlAlert.pep_sanctions_id == entry.id,
                    AmlAlert.status.in_(["OPEN", "CONFIRMED", "ESCALATED"]),
                )
            )
            if existing_result.scalar_one_or_none() is not None:
                continue

            programs = " ".join(entry.programs or []).upper()
            alert_type = "SANCTIONS" if "SANCTION" in programs else "PEP"
            alert_id = uuid.uuid4()
            db.add(
                AmlAlert(
                    id=alert_id,
                    session_id=session.id,
                    pep_sanctions_id=entry.id,
                    alert_type=alert_type,
                    match_score=score,
                    status="OPEN",
                )
            )
            await track_event_best_effort(
                db,
                event_type="AML_ALERT_OPENED",
                session_id=session.id,
                user_id=session.user_id,
                agency_id=session.agency_id,
                step="aml_screening",
                status="OPEN",
                metadata={"alert_id": str(alert_id), "alert_type": alert_type},
            )
            session.priority_flag = True
            created += 1

        await db.commit()
    return created


async def screen_active_clients_against_sanctions() -> int:
    """Run sanctions screening on active/reviewable KYC sessions."""
    from app.modules.kyc.models import KYCSession

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(KYCSession.id).where(
                KYCSession.status.in_(["PENDING_AGENT_REVIEW", "APPROVED", "PENDING_INFO"])
            )
        )
        session_ids = [str(row[0]) for row in result.all()]

    total = 0
    for session_id in session_ids:
        total += await screen_session_against_sanctions(session_id)
    return total


@celery.task(name="app.tasks.kyc.check_document_expiry", bind=True, max_retries=2)
def celery_check_document_expiry(self):
    return asyncio.run(check_document_expiry())


@celery.task(name="app.tasks.kyc.screen_session_against_sanctions", bind=True, max_retries=2)
def celery_screen_session_against_sanctions(self, session_id: str):
    return asyncio.run(screen_session_against_sanctions(session_id))


@celery.task(name="app.tasks.kyc.screen_active_clients_against_sanctions", bind=True, max_retries=2)
def celery_screen_active_clients_against_sanctions(self):
    return asyncio.run(screen_active_clients_against_sanctions())
