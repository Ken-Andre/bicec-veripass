"""Warm up PaddleOCR inside the backend container.

Runs a predict() call to trigger internal JIT compilation and memory
allocation. Without this, the first real OCR request returns garbage results.

Usage:
  /app/.venv/bin/python scripts/warmup_ocr.py [--image /path/to/image]
"""

from __future__ import annotations

import argparse
from pathlib import Path

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
            _ = ocr.predict(str(target))
        else:
            # Use synthetic text image so both detection AND recognition run.
            # A pure-black/noise image short-circuits detection, leaving recognition unwarmed.
            from app.services.ocr_service import generate_warmup_image
            dummy = generate_warmup_image()
            logger.info("Warmup: using synthetic text image")
            _ = ocr.predict(dummy)
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
