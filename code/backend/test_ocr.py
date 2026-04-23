import time
start = time.time()
from app.services.ocr_service import ocr_service

result = ocr_service.extract_from_path("/tmp/test_cni_valid.png")
elapsed = time.time() - start

print(f"Time: {elapsed:.2f}s")
print(f"Fields: {result.get('fields', {})}")
print(f"Engine: {result.get('engine')}")
print(f"Block count: {len(result.get('blocks', []))}")
print(f"Avg confidence: {result.get('avg_confidence', 0):.2f}")