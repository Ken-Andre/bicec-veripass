#!/usr/bin/env python3
"""
Script de test Celery - À exécuter dans le container vp_api
"""
import redis
import json
import uuid
import time

def test_redis_queue():
    """Test 1: Vérifier que Redis fonctionne et simuler des tâches"""
    print("=" * 60)
    print("TEST 1: Redis Queue Simulation")
    print("=" * 60)
    
    # Connexion Redis
    r = redis.Redis(host='redis', port=6379, db=0, decode_responses=True)
    print(f"✅ Redis connecté: {r.ping()}")
    
    # Vider la queue pour commencer propre
    r.delete('celery')
    
    # Simuler l'envoi de 3 tâches
    print("\n📤 Envoi de 3 tâches simulées...")
    for i in range(1, 4):
        task_id = str(uuid.uuid4())
        task = {
            'id': task_id,
            'task': 'demo.ocr.extract_cni',
            'args': [f'CNI_{i:03d}'],
            'kwargs': {},
            'retries': 0,
        }
        
        # Format Celery
        message = json.dumps([
            task['args'],
            task['kwargs'],
            {
                'callbacks': None,
                'errbacks': None,
                'chain': None,
                'chord': None,
            }
        ])
        
        # Publier dans la queue
        r.lpush('celery', message)
        print(f"  Task {i}: {task_id[:8]}... → Queue 'celery'")
    
    print(f"\n📊 Tâches en attente: {r.llen('celery')}")
    print("👀 Ouvre Flower pour voir les tâches: http://localhost:5555")
    
    return r

def test_redis_keys():
    """Test 2: Explorer les clés Redis utilisées par Celery"""
    print("\n" + "=" * 60)
    print("TEST 2: Redis Keys Exploration")
    print("=" * 60)
    
    r = redis.Redis(host='redis', port=6379, db=0, decode_responses=True)
    
    # Lister toutes les clés
    keys = r.keys('*')
    print(f"\n📋 Clés Redis trouvées ({len(keys)}):")
    for key in sorted(keys)[:20]:  # Limiter à 20
        key_type = r.type(key)
        print(f"  - {key} ({key_type})")
    
    if len(keys) > 20:
        print(f"  ... et {len(keys) - 20} autres")
    
    return r

def test_flower_stats():
    """Test 3: Afficher les stats pour Flower"""
    print("\n" + "=" * 60)
    print("TEST 3: Stats pour Flower")
    print("=" * 60)
    
    r = redis.Redis(host='redis', port=6379, db=0, decode_responses=True)
    
    stats = {
        'celery_queue': r.llen('celery'),
        'glm_ocr_jobs_queue': r.llen('glm_ocr_jobs'),
        'notifications_queue': r.llen('notifications'),
        'total_keys': len(r.keys('*')),
    }
    
    print("\n📊 Statistiques:")
    for key, value in stats.items():
        print(f"  {key}: {value}")
    
    print("\n💡 Pour voir les workers actifs dans Flower:")
    print("   1. Ouvre http://localhost:5555")
    print("   2. Login: admin / admin")
    print("   3. Clique sur 'Workers' dans le menu")
    
    return stats

if __name__ == '__main__':
    print("\n🚀 Test Celery + Flower + Redis\n")
    
    # Test 1: Simuler des tâches
    r = test_redis_queue()
    
    # Test 2: Explorer Redis
    test_redis_keys()
    
    # Test 3: Stats
    test_flower_stats()
    
    print("\n" + "=" * 60)
    print("✅ Tests terminés!")
    print("=" * 60)
    print("\n📝 Prochaines étapes:")
    print("  1. Ouvre Flower: http://localhost:5555")
    print("  2. Vérifie l'onglet 'Broker' pour voir Redis")
    print("  3. Les workers n'apparaîtront que quand Celery sera installé")
    print()
