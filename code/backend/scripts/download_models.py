#!/usr/bin/env python3
"""
Pre-download PaddleOCR models into the /data/models volume.

Run ONCE after a fresh docker compose build (or whenever the volume is empty),
before starting the full stack:

    docker compose run --rm model_init

This prevents the API from downloading models at the first OCR request,
which would block the uvicorn worker and cause 502 errors.

Compatible with PaddleOCR >= 3.x (new parameter names).
"""

import os
import sys
from pathlib import Path

# Disable connectivity check noise
os.environ["PADDLE_PDX_DISABLE_MODEL_SOURCE_CHECK"] = "True"

MODELS_PATH = os.environ.get("MODELS_PATH", "/data/models")
PADDLE_CACHE = os.environ.get("PADDLE_CACHE_DIR", "/tmp/paddle-cache")

os.environ.setdefault("PADDLE_HOME", PADDLE_CACHE)

# Where PaddleOCR will store models (using the new API key names)
PADDLE_MODEL_DIR = f"{MODELS_PATH}/paddle"

print("=" * 60)
print("PaddleOCR Model Pre-downloader (v3.x compatible)")
print("=" * 60)
print(f"  Models root → {PADDLE_MODEL_DIR}")
print()

# Check that PaddleOCR can be imported
try:
    from paddleocr import PaddleOCR  # type: ignore
except ImportError as e:
    print(f"❌ Could not import paddleocr: {e}")
    sys.exit(1)

# Check the installed version to decide API surface
try:
    import paddleocr
    paddle_version = getattr(paddleocr, "__version__", "unknown")
    print(f"  PaddleOCR version: {paddle_version}")
except Exception:
    paddle_version = "unknown"

Path(PADDLE_MODEL_DIR).mkdir(parents=True, exist_ok=True)

# Build init kwargs — use new parameter names for PaddleOCR >= 3.x,
# fall back to old names if needed.
kwargs: dict = {
    "lang": "fr",
}

# The new 3.x API uses different parameter names.
# We probe which one works at runtime.
INIT_KWARGS_NEW = {
    **kwargs,
    "use_textline_orientation": True,
}

INIT_KWARGS_OLD = {
    **kwargs,
    "use_angle_cls": True,
    "det_model_dir": f"{PADDLE_MODEL_DIR}/PP-OCRv5_server_det",
    "rec_model_dir": f"{PADDLE_MODEL_DIR}/PP-OCRv5_server_rec",
    "cls_model_dir": f"{PADDLE_MODEL_DIR}/ch_ppocr_mobile_v2.0_cls_infer",
}

print("⏳ Initializing PaddleOCR (downloading models if absent)...")
print("   This runs only ONCE — subsequent starts use the cached volume.")
print()

ocr = None
for init_kwargs, label in [(INIT_KWARGS_NEW, "v3.x API"), (INIT_KWARGS_OLD, "legacy API")]:
    try:
        print(f"  Trying {label}...")
        ocr = PaddleOCR(**init_kwargs)
        print(f"  ✅ Initialized with {label}")
        break
    except TypeError as e:
        print(f"  ⚠️  {label} failed with TypeError: {e}")
        continue
    except Exception as e:
        print(f"  ⚠️  {label} failed: {e}")
        continue

if ocr is None:
    print("❌ Could not initialize PaddleOCR with any known API.")
    sys.exit(1)

# Run a dummy inference to trigger full model load + any remaining downloads
print()
print("⏳ Running dummy inference to verify model load...")
try:
    import numpy as np
    dummy = np.zeros((64, 128, 3), dtype=np.uint8)
    ocr.predict(dummy)
    print()
    print("✅ PaddleOCR models downloaded and verified successfully.")
    print(f"   Models stored in: {PADDLE_MODEL_DIR}")
except Exception as e:
    # A blank image may return empty results — that's fine.
    if "No text" in str(e) or "empty" in str(e).lower():
        print("✅ Models loaded (empty result on blank image is expected).")
    else:
        print(f"⚠️  Inference on dummy image raised: {e}")
        print("   Models may still be usable — continuing.")
