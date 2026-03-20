# Celery Quick Start — Test Rapide

## ✅ Ce qui fonctionne maintenant

- ✅ Flower : http://localhost:5555 (admin/admin)
- ✅ Redis : localhost:16379
- ✅ API : http://localhost:8001/api/v1/docs

## 🎯 Test Rapide (5 minutes)

### 1. Ouvre Flower
```
http://localhost:5555
Login: admin / admin
```

### 2. Entre dans un worker
```bash
docker exec -it vp_celery_ocr sh
```

### 3. Lance une tâche de test
```python
python3 << 'EOF'
from celery import Celery
import time

# Créer l'app Celery
app = Celery('test', broker='redis://redis:6379/0', backend='redis://redis:6379/0')

# Définir une tâche
@app.task(name='test.hello')
def hello(name):
    print(f'🚀 Début tâche pour {name}')
    time.sleep(5)
    print(f'✅ Fin tâche pour {name}')
    return f'Hello {name}!'

# Lancer 3 tâches
for i in range(1, 4):
    result = hello.apply_async(args=[f'User{i}'])
    print(f'Task {i} ID: {result.id}')

print('\n👀 Regarde Flower pour voir les tâches!')
EOF
```

### 4. Observe dans Flower

Tu verras les 3 tâches s'exécuter **séquentiellement** (une par une) car `concurrency=1`.

---

## 🔥 Test Parallèle

### 1. Entre dans le worker notifications
```bash
docker exec -it vp_celery_notif sh
```

### 2. Lance des tâches parallèles
```python
python3 << 'EOF'
from celery import Celery
import time

app = Celery('test', broker='redis://redis:6379/0', backend='redis://redis:6379/0')

@app.task(name='test.send_sms')
def send_sms(phone):
    print(f'📱 SMS vers {phone}')
    time.sleep(3)
    print(f'✅ SMS envoyé à {phone}')
    return f'Sent to {phone}'

# Lancer 5 SMS
phones = ['+237670000001', '+237670000002', '+237670000003', '+237670000004', '+237670000005']
for phone in phones:
    result = send_sms.apply_async(args=[phone])
    print(f'SMS {phone}: {result.id}')

print('\n👀 Regarde Flower: 2 tâches en parallèle!')
EOF
```

Tu verras **2 tâches en parallèle** car `concurrency=2`.

---

## 📊 Différence Clé

### Worker OCR (concurrency=1)
```
Tâche 1: [=====>] 5s
Tâche 2:        [=====>] 5s
Tâche 3:               [=====>] 5s
Total: 15 secondes
```

### Worker Notifications (concurrency=2)
```
Tâche 1: [==>] 3s
Tâche 2: [==>] 3s
Tâche 3:      [==>] 3s
Tâche 4:      [==>] 3s
Tâche 5:           [==>] 3s
Total: 9 secondes (au lieu de 15s)
```

---

## 🎓 Concepts Importants

| Concept | Explication |
|---------|-------------|
| **Queue** | File d'attente des tâches (`glm_ocr_jobs`, `notifications`) |
| **Worker** | Processus qui exécute les tâches |
| **Concurrency** | Nombre de tâches simultanées (1 = séquentiel, 2+ = parallèle) |
| **Broker** | Redis stocke les tâches en attente |
| **Backend** | Redis stocke les résultats |

---

## 🔗 Liens Utiles

- **Flower**: http://localhost:5555
- **API Docs**: http://localhost:8001/api/v1/docs
- **RedisInsight**: https://redis.io/insight/ (à installer)

---

## 📚 Guide Complet

Pour plus de détails, voir `CELERY_DEMO_GUIDE.md`

---

**C'est tout ! Tu maîtrises maintenant les bases de Celery 🎉**
