"""Warm up PaddleOCR inside the backend container.

Usage:
  /app/.venv/bin/python scripts/warmup_ocr.py [--image /path/to/image]
"""

from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np

from app.core.logging import logger
from app.modules.kyc.service import get_shared_paddle_ocr


def run_warmup(image_path: str | None) -> int:
    ocr = get_shared_paddle_ocr()
    if ocr is None:
        logger.error("PaddleOCR warmup failed: engine unavailable")
        return 1

    try:
        if image_path:
            target = Path(image_path)
            if not target.exists():
                logger.error("Warmup image not found: %s", target)
                return 2
            _ = ocr.ocr(str(target))
        else:
            dummy = np.zeros((64, 256, 3), dtype=np.uint8)
            _ = ocr.ocr(dummy)
    except Exception as exc:
        logger.error("PaddleOCR warmup failed: %s", exc, exc_info=True)
        return 3

    logger.info("PaddleOCR warmup completed successfully")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--image", help="Optional image path to validate OCR extraction")
    args = parser.parse_args()
    return run_warmup(args.image)


if __name__ == "__main__":
    raise SystemExit(main())
