from __future__ import annotations

import base64
import os
from io import BytesIO

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from PIL import Image


def _get_aes_key() -> bytes:
    raw = os.environ.get("OCR_CLOUD_KEY", "")
    if not raw:
        raise ValueError("OCR_CLOUD_KEY not set")
    return base64.b64decode(raw)


def compress_image(image_bytes: bytes, max_width: int = 600, quality: int = 85) -> bytes:
    img = Image.open(BytesIO(image_bytes))
    if img.width > max_width:
        ratio = max_width / img.width
        img = img.resize((max_width, int(img.height * ratio)), Image.LANCZOS)
    buf = BytesIO()
    img.save(buf, format="JPEG", quality=quality, optimize=True)
    return buf.getvalue()


def encrypt(plaintext: bytes) -> bytes:
    aesgcm = AESGCM(_get_aes_key())
    nonce = os.urandom(12)
    return nonce + aesgcm.encrypt(nonce, plaintext, None)


def decrypt(payload: bytes) -> bytes:
    aesgcm = AESGCM(_get_aes_key())
    nonce, ct = payload[:12], payload[12:]
    return aesgcm.decrypt(nonce, ct, None)
