"""
API de démonstration Celery pour VeriPass
Endpoints pour tester les différents workers
"""

import random
from fastapi import APIRouter
from pydantic import BaseModel
from app.tasks_demo import (
    demo_extract_cni,
    demo_verify_liveness,
    demo_send_otp,
    demo_send_kyc_result,
    demo_batch_provision,
    demo_cleanup_expired_otps,
    demo_complete_kyc_workflow,
)

router = APIRouter(prefix="/demo", tags=["Demo Celery"])


class TaskResponse(BaseModel):
    task_id: str
    task_name: str
    queue: str
    status: str
    message: str


# ============================================================================
# ENDPOINTS CELERY OCR (Queue: glm_ocr_jobs)
# ============================================================================


@router.post("/ocr/extract-cni", response_model=TaskResponse)
async def trigger_ocr_extraction(
    document_id: str = "CNI_001", simulate_failure: bool = False
):
    """
    🔍 Déclenche une extraction OCR de CNI

    - **Queue**: glm_ocr_jobs
    - **Worker**: celery_ocr (concurrency=1, séquentiel)
    - **Durée**: ~10 secondes
    - **Use case**: Extraction des données d'une CNI camerounaise
    """
    task = demo_extract_cni.apply_async(
        args=[document_id, simulate_failure], queue="glm_ocr_jobs"
    )

    return TaskResponse(
        task_id=task.id,
        task_name="demo.ocr.extract_cni",
        queue="glm_ocr_jobs",
        status="pending",
        message=f"Extraction OCR démarrée pour document {document_id}. Surveillez Flower!",
    )


@router.post("/ocr/verify-liveness", response_model=TaskResponse)
async def trigger_liveness_check(selfie_id: str = "SELFIE_001"):
    """
    🤳 Déclenche une vérification de vivacité (anti-spoofing)

    - **Queue**: glm_ocr_jobs
    - **Worker**: celery_ocr (concurrency=1, séquentiel)
    - **Durée**: ~5 secondes
    - **Use case**: Détection de fraude par photo/vidéo
    """
    task = demo_verify_liveness.apply_async(args=[selfie_id], queue="glm_ocr_jobs")

    return TaskResponse(
        task_id=task.id,
        task_name="demo.ocr.verify_liveness",
        queue="glm_ocr_jobs",
        status="pending",
        message=f"Vérification liveness démarrée pour selfie {selfie_id}",
    )


# ============================================================================
# ENDPOINTS NOTIFICATIONS (Queue: notifications)
# ============================================================================


@router.post("/notif/send-otp", response_model=TaskResponse)
async def trigger_otp_sms(phone: str = "+237670123456", otp_code: str = "123456"):
    """
    📱 Envoie un OTP par SMS via Orange Cameroon

    - **Queue**: notifications
    - **Worker**: celery_notifications (concurrency=2, parallèle)
    - **Durée**: ~1-2 secondes
    - **Use case**: Authentification 2FA lors de l'onboarding
    """
    task = demo_send_otp.apply_async(args=[phone, otp_code], queue="notifications")

    return TaskResponse(
        task_id=task.id,
        task_name="demo.notif.send_otp",
        queue="notifications",
        status="pending",
        message=f"OTP {otp_code} en cours d'envoi vers {phone}",
    )


@router.post("/notif/send-kyc-result", response_model=TaskResponse)
async def trigger_kyc_email(email: str = "marie@example.cm", status: str = "approved"):
    """
    📧 Envoie un email de résultat KYC

    - **Queue**: notifications
    - **Worker**: celery_notifications (concurrency=2, parallèle)
    - **Durée**: ~1-2 secondes
    - **Use case**: Notification du résultat de vérification KYC
    """
    task = demo_send_kyc_result.apply_async(args=[email, status], queue="notifications")

    return TaskResponse(
        task_id=task.id,
        task_name="demo.notif.send_kyc_result",
        queue="notifications",
        status="pending",
        message=f"Email de résultat '{status}' en cours d'envoi à {email}",
    )


@router.post("/notif/batch-provision", response_model=TaskResponse)
async def trigger_batch_provision(user_count: int = 5):
    """
    🏦 Provisionne des comptes bancaires en batch

    - **Queue**: notifications
    - **Worker**: celery_notifications (concurrency=2, parallèle)
    - **Durée**: ~3-5 secondes
    - **Use case**: Création de comptes BICEC après validation KYC
    """
    user_ids = [f"USER_{i:03d}" for i in range(1, user_count + 1)]

    task = demo_batch_provision.apply_async(args=[user_ids], queue="notifications")

    return TaskResponse(
        task_id=task.id,
        task_name="demo.notif.batch_provision",
        queue="notifications",
        status="pending",
        message=f"Provisionnement de {user_count} comptes démarré",
    )


# ============================================================================
# ENDPOINTS CRON (Celery Beat)
# ============================================================================


@router.post("/cron/cleanup-otps", response_model=TaskResponse)
async def trigger_cleanup_otps():
    """
    🧹 Déclenche manuellement le nettoyage des OTP expirés

    - **Normalement**: Exécuté automatiquement toutes les 10 min par Celery Beat
    - **Durée**: ~2 secondes
    - **Use case**: Maintenance Redis, suppression des OTP > 5 min
    """
    task = demo_cleanup_expired_otps.apply_async()

    return TaskResponse(
        task_id=task.id,
        task_name="demo.cron.cleanup_expired_otps",
        queue="celery",  # Queue par défaut
        status="pending",
        message="Nettoyage des OTP expirés démarré",
    )


# ============================================================================
# WORKFLOW ORCHESTRÉ
# ============================================================================


@router.post("/workflow/complete-kyc", response_model=TaskResponse)
async def trigger_complete_kyc(
    user_id: str = "DEMO_USER_001",
    phone: str = "+237670123456",
    email: str = "client.demo@gmail.com",
):
    """
    🚀 Déclenche un workflow KYC complet (OCR → Liveness → Notification)

    - **Note**: Le système de démo va maintenant générer des données CNI aléatoires (Nom, Prénom, Date)
      pour simuler différents profils d'utilisateurs camerounais.
    """
    task = demo_complete_kyc_workflow.apply_async(
        args=[user_id, phone, email], queue="notifications"
    )

    return TaskResponse(
        task_id=task.id,
        task_name="demo.workflow.complete_kyc",
        queue="notifications",
        status="pending",
        message=f"Workflow KYC complet démarré pour {user_id}. Les données seront diversifiées.",
    )


@router.post("/populate/bulk-kyc", response_model=list[TaskResponse])
async def populate_bulk_kyc(count: int = 5):
    """
    🌪️ Stress Test & Audit : Génère N workflows KYC complets en parallèle

    Permet de vérifier la montée en charge des workers OCR et Notifications.
    Les sorties seront diversifiées (différents noms, numéros CNI et résultats).
    """
    tasks = []
    for i in range(count):
        user_id = f"BULK_TEST_{random.randint(1000, 9999)}"
        email = f"test_audit_{i}@bicec-veripass.cm"
        phone = f"+2376{random.randint(70, 99)}{random.randint(100000, 999999)}"

        task = demo_complete_kyc_workflow.apply_async(
            args=[user_id, phone, email], queue="notifications"
        )
        tasks.append(
            TaskResponse(
                task_id=task.id,
                task_name="demo.workflow.complete_kyc",
                queue="notifications",
                status="pending",
                message=f"Tâche de stress-test #{i + 1} lancée. User: {user_id}",
            )
        )

    return tasks


# ============================================================================
# ENDPOINT DE STATUT
# ============================================================================


@router.get("/task/{task_id}")
async def get_task_status(task_id: str):
    """
    📊 Récupère le statut d'une tâche Celery

    - **PENDING**: En attente dans la queue
    - **STARTED**: En cours d'exécution
    - **SUCCESS**: Terminée avec succès
    - **FAILURE**: Échec
    - **RETRY**: En cours de retry
    """
    from celery.result import AsyncResult
    from app.celery import celery_app

    result = AsyncResult(task_id, app=celery_app)

    response = {
        "task_id": task_id,
        "status": result.status,
        "result": result.result if result.ready() else None,
    }

    if result.failed():
        response["error"] = str(result.info)

    return response


@router.get("/info")
async def demo_info():
    """
    ℹ️ Informations sur la démo Celery
    """
    return {
        "message": "Démo Celery VeriPass - Système de monitoring des workers",
        "workers": {
            "celery_ocr": {
                "queue": "glm_ocr_jobs",
                "concurrency": 1,
                "description": "Tâches lourdes séquentielles (OCR, liveness)",
                "use_cases": ["Extraction CNI", "Anti-spoofing", "Face matching"],
            },
            "celery_notifications": {
                "queue": "notifications",
                "concurrency": 2,
                "description": "Tâches rapides parallèles (SMS, email, provisioning)",
                "use_cases": ["OTP SMS", "Email KYC", "Batch provisioning"],
            },
            "celery_beat": {
                "description": "Scheduler de tâches périodiques",
                "use_cases": ["Cleanup OTP", "Stats quotidiennes", "Sync sanctions"],
            },
        },
        "flower_url": "http://localhost:5555",
        "redis_url": "localhost:16379",
        "tips": [
            "1. Ouvre Flower (localhost:5555) pour voir les workers en temps réel",
            "2. Lance plusieurs tâches OCR pour voir la queue séquentielle",
            "3. Lance plusieurs tâches notifications pour voir le parallélisme",
            "4. Utilise /demo/workflow/complete-kyc pour voir l'orchestration",
        ],
    }
