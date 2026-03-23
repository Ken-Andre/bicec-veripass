"""
Tâches Celery de démonstration pour comprendre le système VeriPass
"""
import time
import random
from datetime import datetime
from app.celery import celery_app


# ============================================================================
# QUEUE: glm_ocr_jobs (Worker: celery_ocr)
# Tâches lourdes, séquentielles (concurrency=1)
# ============================================================================

@celery_app.task(name="demo.ocr.extract_cni", queue="glm_ocr_jobs")
def demo_extract_cni(document_id: str, simulate_failure: bool = False):
    """
    Simule l'extraction OCR d'une CNI camerounaise
    Tâche lourde : 10-15 secondes (comme GLM-OCR en prod)
    """
    print(f"🔍 [OCR] Démarrage extraction CNI #{document_id}")
    
    # Simulation du chargement du modèle (première fois)
    time.sleep(2)
    print(f"📦 [OCR] Modèle GLM-OCR chargé")
    
    # Simulation du traitement OCR
    for i in range(1, 6):
        time.sleep(2)
        progress = i * 20
        print(f"⏳ [OCR] Extraction en cours... {progress}%")
    
    if simulate_failure:
        print(f"❌ [OCR] Échec extraction CNI #{document_id}")
        raise Exception("OCR confidence trop faible (< 85%)")
    
    # Listes pour génération aléatoire réaliste (Cameroun)
    noms = ["NGONO", "BEKONO", "MBARGA", "EYENGA", "EKOTTO", "ETOUNDI", "TCHATCHOUANG", "KAMGA", "FOTSO", "TALLA"]
    prenoms = ["Marie", "Jean", "Paul", "Alice", "Chantal", "Alain", "Dieudonné", "Symphorien", "Colette", "Blandine"]
    lieux = ["Yaoundé", "Douala", "Garoua", "Maroua", "Bafoussam", "Bamenda", "Bertoua", "Ebolowa"]
    
    # Résultat simulé avec diversité
    result = {
        "document_id": document_id,
        "extracted_data": {
            "nom": random.choice(noms),
            "prenom": random.choice(prenoms),
            "date_naissance": f"{random.randint(1970, 2005)}-{random.randint(1, 12):02d}-{random.randint(1, 28):02d}",
            "numero_cni": f"CM-{random.randint(100, 999)}-{random.randint(2000, 2024)}-{random.randint(100000, 999999)}",
            "lieu_naissance": random.choice(lieux),
        },
        "confidence": random.randint(87, 98),
        "processing_time_seconds": 10,
        "timestamp": datetime.utcnow().isoformat(),
    }
    
    print(f"✅ [OCR] Extraction réussie CNI #{document_id} - {result['extracted_data']['nom']} {result['extracted_data']['prenom']}")
    return result


@celery_app.task(name="demo.ocr.verify_liveness", queue="glm_ocr_jobs")
def demo_verify_liveness(selfie_id: str):
    """
    Simule la vérification de vivacité (anti-spoofing)
    Tâche moyenne : 5-8 secondes
    """
    print(f"🤳 [LIVENESS] Analyse selfie #{selfie_id}")
    
    time.sleep(3)
    print(f"🧠 [LIVENESS] MiniFASNet en cours...")
    time.sleep(2)
    
    liveness_score = random.randint(65, 95)
    is_live = liveness_score >= 70
    
    result = {
        "selfie_id": selfie_id,
        "is_live": is_live,
        "liveness_score": liveness_score,
        "timestamp": datetime.utcnow().isoformat(),
    }
    
    emoji = "✅" if is_live else "❌"
    print(f"{emoji} [LIVENESS] Score: {liveness_score}% - Vivant: {is_live}")
    return result


# ============================================================================
# QUEUE: notifications (Worker: celery_notifications)
# Tâches rapides, parallèles (concurrency=2)
# ============================================================================

@celery_app.task(name="demo.notif.send_otp", queue="notifications")
def demo_send_otp(phone: str, otp_code: str):
    """
    Simule l'envoi d'un OTP par SMS via Orange Cameroon
    Tâche rapide : 1-2 secondes
    """
    print(f"📱 [SMS] Envoi OTP vers {phone}")
    time.sleep(1)
    
    # Simulation appel API Orange
    success = random.choice([True, True, True, False])  # 75% succès
    
    if success:
        print(f"✅ [SMS] OTP {otp_code} envoyé à {phone}")
        return {"phone": phone, "status": "sent", "otp": otp_code}
    else:
        print(f"❌ [SMS] Échec envoi vers {phone}")
        raise Exception("Orange API timeout")


@celery_app.task(name="demo.notif.send_kyc_result", queue="notifications")
def demo_send_kyc_result(email: str, status: str):
    """
    Simule l'envoi d'un email de résultat KYC
    Tâche rapide : 1-2 secondes
    """
    print(f"📧 [EMAIL] Envoi résultat KYC à {email}")
    time.sleep(1.5)
    
    emoji = "✅" if status == "approved" else "❌"
    print(f"{emoji} [EMAIL] Résultat '{status}' envoyé à {email}")
    
    # Simuler le déclenchement réel via aiosmtplib vers Mailpit si nécessaire
    # (Ici on reste sur du log pour la démo worker, mais le workflow réel utilise le core/email.py)
    
    return {
        "email": email,
        "status": status,
        "subject": f"Votre vérification BICEC VeriPass - {'Approuvée' if status == 'approved' else 'Action Requise'}",
        "sent_at": datetime.utcnow().isoformat(),
    }


@celery_app.task(name="demo.notif.batch_provision", queue="notifications")
def demo_batch_provision(user_ids: list):
    """
    Simule le provisionnement batch de comptes bancaires
    Tâche moyenne : 3-5 secondes
    """
    print(f"🏦 [BATCH] Provisionnement de {len(user_ids)} comptes")
    
    for user_id in user_ids:
        time.sleep(0.5)
        print(f"💳 [BATCH] Compte créé pour user #{user_id}")
    
    print(f"✅ [BATCH] {len(user_ids)} comptes provisionnés")
    return {"provisioned_count": len(user_ids), "user_ids": user_ids}


# ============================================================================
# TÂCHES PÉRIODIQUES (Celery Beat)
# Définies dans celerybeat-schedule.py
# ============================================================================

@celery_app.task(name="demo.cron.cleanup_expired_otps")
def demo_cleanup_expired_otps():
    """
    Nettoyage des OTP expirés (> 5 min)
    Exécuté toutes les 10 minutes par Celery Beat
    """
    print("🧹 [CRON] Nettoyage des OTP expirés")
    time.sleep(2)
    
    expired_count = random.randint(5, 50)
    print(f"✅ [CRON] {expired_count} OTP supprimés")
    
    return {"deleted_otps": expired_count}


@celery_app.task(name="demo.cron.daily_stats")
def demo_daily_stats():
    """
    Génération des stats quotidiennes
    Exécuté tous les jours à 23h par Celery Beat
    """
    print("📊 [CRON] Génération stats quotidiennes")
    time.sleep(3)
    
    stats = {
        "date": datetime.utcnow().date().isoformat(),
        "kyc_completed": random.randint(50, 200),
        "kyc_approved": random.randint(40, 180),
        "kyc_rejected": random.randint(5, 20),
        "sms_sent": random.randint(100, 500),
    }
    
    print(f"✅ [CRON] Stats générées: {stats['kyc_completed']} KYC traités")
    return stats


# ============================================================================
# TÂCHE DE DÉMO ORCHESTRÉE (Chaîne de tâches)
# ============================================================================

@celery_app.task(name="demo.workflow.complete_kyc", queue="notifications")
def demo_complete_kyc_workflow(user_id: str, phone: str, email: str):
    """
    Workflow KYC complet : OCR → Liveness → Notification
    Démontre l'orchestration de tâches entre différentes queues
    Note: utilise apply_async sans .get() pour éviter le deadlock Celery
    """
    from celery import chain
    
    print(f"🚀 [WORKFLOW] Démarrage KYC pour user #{user_id}")
    
    # Chaîne : OCR → Liveness → Notification (via chain Celery)
    workflow = chain(
        demo_extract_cni.si(f"doc_{user_id}").set(queue="glm_ocr_jobs"),
        demo_verify_liveness.si(f"selfie_{user_id}").set(queue="glm_ocr_jobs"),
        demo_send_kyc_result.si(email, "approved").set(queue="notifications"),
    )
    result = workflow.apply_async()
    
    print(f"✅ [WORKFLOW] Chaîne KYC lancée pour user #{user_id}, chain_id={result.id}")
    
    return {
        "user_id": user_id,
        "chain_id": result.id,
        "status": "chain_started",
        "message": "OCR → Liveness → Email en cours, suivre dans Flower"
    }
