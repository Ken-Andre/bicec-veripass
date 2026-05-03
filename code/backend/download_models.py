import os
os.environ["PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK"] = "True"
os.environ["HF_HUB_OFFLINE"] = "0"

from paddleocr import PaddleOCR
import numpy as np

print("Initializing PaddleOCR...")
ocr = PaddleOCR(use_textline_orientation=False, lang="fr")

print("Running dummy OCR to load all models...")
dummy = np.zeros((100, 100, 3), dtype=np.uint8)
try:
    result = ocr.predict(dummy)
    print(f"Dummy OCR done: {result}")
except Exception as e:
    print(f"Error: {e}")

print("Checking cached models:")
for item in os.listdir("/home/vpuser/.paddlex/official_models"):
    print(f"  - {item}")

print("Done!")
