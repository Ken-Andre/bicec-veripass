# Guide de Démo Celery — BICEC VeriPass

Ce guide te permet de tester et comprendre les 3 workers Celery sans avoir besoin de l'API.

---

## Architecture des Workers

### 1. celery_ocr (Queue: glm_ocr_jobs)
- **Concurrency**: 1 (séquentiel)
- **Use case**: Tâches lourdes (OCR CNI, liveness, face matching)
- **Durée typique**: 5-30 secondes
- **Pourquoi séquentiel**: Les modèles IA (GLM-OCR, MiniFASNet) consomment beaucoup de RAM

### 2. celery_notifications (Queue: notifications)
- **Concurrency**: 2 (parallèle)
- **Use case**: Tâches rapides (SMS, email, provisioning)
- **Durée typique**: 1-5 secondes
- **Pourquoi parallèle**: Tâches I/O-bound, peuvent s'exécuter en même temps

### 3. celery_beat (Scheduler)
- **Rôle**: Planificateur de tâches périodiques (cron)
- **Use case**: Cleanup OTP, stats quotidiennes, sync sanctions
- **Pas de queue**: Envoie les tâches vers les autres workers

---

## Étape 1 : Vérifier que les workers tournent

```bash
docker compose ps
```

Tu devrais voir :
- `vp_celery_ocr` - Running
- `vp_celery_notif` - Running
- `vp_celery_beat` - Running
- `vp_flower` - Running

---

## Étape 2 : Ouvrir Flower

Ouvre ton navigateur : **http://localhost:5555**

Login : `admin` / `admin`

Tu verras 0 workers actifs car ils ne sont pas encore démarrés correctement.

---

## Étape 3 : Tester manuellement les tâches

### Test 1 : Tâche simple (Hello World)

Entre dans le container celery_ocr :
```bash
docker exec -it vp_celery_ocr sh
```

Lance une tâche Python simple :
```python
python3 -c "
from celery import Celery
import time

app = Celery('test', broker='redis://redis:6379/0')

@app.task
def hello(name):
    print(f'Hello {name}!')
    time.sleep(3)
    return f'Task completed for {name}'

# Envoyer la tâche
result = hello.apply_async(args=['Marie'])
print(f'Task ID: {result.id}')
print(f'Status: {result.status}')
"
```

### Test 2 : Simuler une extraction OCR

```python
python3 -c "
from celery import Celery
import time
import random

app = Celery('veripass', broker='redis://redis:6379/0')

@app.task(name='demo.ocr.extract_cni', queue='glm_ocr_jobs')
def extract_cni(doc_id):
    print(f'🔍 [OCR] Extraction CNI #{doc_id}')
    for i in range(1, 6):
        time.sleep(2)
        print(f'⏳ Progress: {i*20}%')
    
    confidence = random.randint(85, 98)
    print(f'✅ [OCR] Confiance: {confidence}%')
    return {'doc_id': doc_id, 'confidence': confidence}

# Lancer 3 tâches OCR (elles s'exécuteront séquentiellement)
for i in range(1, 4):
    result = extract_cni.apply_async(args=[f'CNI_{i:03d}'], queue='glm_ocr_jobs')
    print(f'Task {i} envoyée: {result.id}')
"
```

**Observe dans Flower** : Les 3 tâches s'exécutent une par une (concurrency=1)

### Test 3 : Simuler des notifications SMS

```python
python3 -c "
from celery import Celery
import time

app = Celery('veripass', broker='redis://redis:6379/0')

@app.task(name='demo.notif.send_sms', queue='notifications')
def send_sms(phone, message):
    print(f'📱 [SMS] Envoi vers {phone}')
    time.sleep(2)
    print(f'✅ [SMS] Envoyé: {message}')
    return {'phone': phone, 'status': 'sent'}

# Lancer 5 SMS (2 en parallèle grâce à concurrency=2)
phones = ['+237670123456', '+237671234567', '+237672345678', '+237673456789', '+237674567890']
for phone in phones:
    result = send_sms.apply_async(args=[phone, 'Votre OTP: 123456'], queue='notifications')
    print(f'SMS vers {phone}: {result.id}')
"
```

**Observe dans Flower** : 2 tâches s'exécutent en parallèle, les autres attendent

---

## Étape 4 : Comprendre les différences

### Scénario A : Queue séquentielle (celery_ocr)

```
Tâche 1 (OCR) : [=========>] 10s
Tâche 2 (OCR) :             [=========>] 10s
Tâche 3 (OCR) :                         [=========>] 10s

Temps total : 30 secondes
```

**Pourquoi ?** Les modèles IA sont gourmands en RAM. Si on lance 3 OCR en parallèle, le serveur crashe.

### Scénario B : Queue parallèle (celery_notifications)

```
Tâche 1 (SMS) : [==>] 2s
Tâche 2 (SMS) : [==>] 2s
Tâche 3 (SMS) :       [==>] 2s
Tâche 4 (SMS) :       [==>] 2s
Tâche 5 (SMS) :             [==>] 2s

Temps total : 6 secondes (au lieu de 10s si séquentiel)
```

**Pourquoi ?** Les SMS sont des appels API externes (I/O-bound). Pendant qu'on attend la réponse d'Orange, on peut envoyer un autre SMS.

---

## Étape 5 : Tester Celery Beat (tâches périodiques)

Celery Beat est déjà configuré pour exécuter des tâches automatiquement.

Voir la config dans `code/backend/app/core/celery_config.py` :

```python
celery.conf.beat_schedule = {
    "prune-disk-daily": {
        "task": "app.tasks.maintenance.check_disk_usage",
        "schedule": crontab(hour=3, minute=0),  # Tous les jours à 3h
    },
}
```

Pour tester manuellement une tâche cron :

```bash
docker exec -it vp_celery_beat sh
```

```python
python3 -c "
from celery import Celery

app = Celery('veripass', broker='redis://redis:6379/0')

@app.task(name='demo.cron.cleanup')
def cleanup_otps():
    print('🧹 Nettoyage des OTP expirés')
    import time
    time.sleep(2)
    print('✅ 42 OTP supprimés')
    return {'deleted': 42}

result = cleanup_otps.apply_async()
print(f'Cleanup task: {result.id}')
"
```

---

## Étape 6 : Monitoring dans Flower

Dans Flower (http://localhost:5555), tu peux :

1. **Workers** : Voir les workers actifs, leur charge CPU/RAM
2. **Tasks** : Liste de toutes les tâches (pending, success, failure)
3. **Broker** : Stats Redis (connexions, mémoire)
4. **Monitor** : Graphiques temps réel

---

## Étape 7 : Inspecter Redis

Installe RedisInsight : **https://redis.io/insight/**

Connecte-toi à `localhost:16379`

Tu verras les clés Celery :
- `celery-task-meta-*` : Résultats des tâches
- `_kombu.binding.*` : Queues Celery

---

## Résumé des Concepts

| Worker | Queue | Concurrency | Use Case | Exemple |
|--------|-------|-------------|----------|---------|
| celery_ocr | glm_ocr_jobs | 1 | Tâches lourdes IA | OCR CNI, liveness, face matching |
| celery_notifications | notifications | 2 | Tâches rapides I/O | SMS OTP, email, provisioning |
| celery_beat | - | - | Scheduler cron | Cleanup, stats, sync sanctions |

---

## Troubleshooting

### Les workers n'apparaissent pas dans Flower

```bash
# Vérifier les logs
docker logs vp_celery_ocr --tail 50
docker logs vp_celery_notif --tail 50

# Redémarrer les workers
docker compose restart celery_ocr celery_notifications celery_beat
```

### Tâche bloquée en "PENDING"

- Vérifie que le worker de la bonne queue tourne
- Vérifie que Redis est accessible : `docker exec vp_redis redis-cli ping`

### Worker crashe

- Vérifie la RAM disponible : `docker stats`
- Réduis la concurrency si nécessaire

---

## Prochaines Étapes

Une fois que tu maîtrises les concepts :

1. Implémente les vraies tâches OCR dans `app/tasks/ocr.py`
2. Implémente les notifications dans `app/tasks/notifications.py`
3. Configure les tâches périodiques dans `celery_config.py`
4. Ajoute des endpoints API pour déclencher les tâches depuis le frontend

---

**Bon test ! 🚀**
