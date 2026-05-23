import hashlib
import io
import uuid
from types import SimpleNamespace

import pytest
from fastapi import HTTPException, UploadFile
from starlette.datastructures import Headers

from app.core.config import settings
from app.modules.support.router import _validate_and_store_attachment


def _pdf_with_pages(count: int) -> bytes:
    pages = "\n".join(
        f"{index + 1} 0 obj\n<< /Type /Page >>\nendobj" for index in range(count)
    )
    return f"%PDF-1.4\n{pages}\n%%EOF".encode()


def _upload_file(name: str, content_type: str, data: bytes) -> UploadFile:
    return UploadFile(
        file=io.BytesIO(data),
        filename=name,
        headers=Headers({"content-type": content_type}),
    )


@pytest.mark.asyncio
async def test_support_attachment_upload_enforces_type_size_and_sha256(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "STORAGE_PATH", str(tmp_path))
    monkeypatch.setattr(settings, "MAX_DOCUMENT_SIZE_MB", 10)
    current_user = SimpleNamespace(id=uuid.uuid4())
    data = _pdf_with_pages(1)
    digest = hashlib.sha256(data).hexdigest()

    saved = await _validate_and_store_attachment(
        file=_upload_file("justificatif.pdf", "application/pdf", data),
        current_user=current_user,
        client_sha256=digest,
    )

    assert saved.filename == "justificatif.pdf"
    assert saved.size == len(data)
    assert saved.sha256 == digest
    assert (tmp_path / "support" / str(current_user.id)).exists()


@pytest.mark.asyncio
async def test_support_attachment_upload_rejects_bad_type(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "STORAGE_PATH", str(tmp_path))
    current_user = SimpleNamespace(id=uuid.uuid4())

    with pytest.raises(HTTPException) as exc:
        await _validate_and_store_attachment(
            file=_upload_file("script.exe", "application/x-msdownload", b"x"),
            current_user=current_user,
            client_sha256=None,
        )

    assert exc.value.status_code == 415


@pytest.mark.asyncio
async def test_support_attachment_upload_rejects_hash_mismatch(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "STORAGE_PATH", str(tmp_path))
    monkeypatch.setattr(settings, "MAX_DOCUMENT_SIZE_MB", 10)
    current_user = SimpleNamespace(id=uuid.uuid4())

    with pytest.raises(HTTPException) as exc:
        await _validate_and_store_attachment(
            file=_upload_file("justificatif.png", "image/png", b"image"),
            current_user=current_user,
            client_sha256="0" * 64,
        )

    assert exc.value.status_code == 409


@pytest.mark.asyncio
async def test_support_attachment_upload_rejects_pdf_over_page_limit(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "STORAGE_PATH", str(tmp_path))
    monkeypatch.setattr(settings, "MAX_DOCUMENT_SIZE_MB", 10)
    current_user = SimpleNamespace(id=uuid.uuid4())
    data = _pdf_with_pages(6)

    with pytest.raises(HTTPException) as exc:
        await _validate_and_store_attachment(
            file=_upload_file("long.pdf", "application/pdf", data),
            current_user=current_user,
            client_sha256=hashlib.sha256(data).hexdigest(),
        )

    assert exc.value.status_code == 422
    assert "5 pages" in exc.value.detail


@pytest.mark.asyncio
async def test_support_attachment_upload_rejects_invalid_pdf_without_pages(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "STORAGE_PATH", str(tmp_path))
    monkeypatch.setattr(settings, "MAX_DOCUMENT_SIZE_MB", 10)
    current_user = SimpleNamespace(id=uuid.uuid4())
    data = b"%PDF-1.4 no page objects"

    with pytest.raises(HTTPException) as exc:
        await _validate_and_store_attachment(
            file=_upload_file("empty.pdf", "application/pdf", data),
            current_user=current_user,
            client_sha256=hashlib.sha256(data).hexdigest(),
        )

    assert exc.value.status_code == 422


@pytest.mark.asyncio
async def test_support_attachment_upload_rejects_image_over_support_limit(tmp_path, monkeypatch):
    monkeypatch.setattr(settings, "STORAGE_PATH", str(tmp_path))
    monkeypatch.setattr(settings, "MAX_DOCUMENT_SIZE_MB", 10)
    current_user = SimpleNamespace(id=uuid.uuid4())
    data = b"x" * (4 * 1024 * 1024 + 1)

    with pytest.raises(HTTPException) as exc:
        await _validate_and_store_attachment(
            file=_upload_file("photo.png", "image/png", data),
            current_user=current_user,
            client_sha256=hashlib.sha256(data).hexdigest(),
        )

    assert exc.value.status_code == 413
    assert "4 Mo" in exc.value.detail
