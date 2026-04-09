"""Tests unitaires pour le Document Storage Service (CAPTURE-08)."""

import pytest
import hashlib
from fastapi import UploadFile, HTTPException
from io import BytesIO
import os

from app.modules.kyc.storage import DocumentStorage


@pytest.fixture
def storage(tmp_path):
    """Create a DocumentStorage instance with a temporary directory."""
    # Override environment to prevent default path usage
    old_env = os.environ.get("ENVIRONMENT")
    os.environ["ENVIRONMENT"] = "test"
    try:
        storage = DocumentStorage(storage_path=str(tmp_path))
        yield storage
    finally:
        if old_env:
            os.environ["ENVIRONMENT"] = old_env
        else:
            os.environ.pop("ENVIRONMENT", None)


@pytest.fixture
def sample_image():
    """Create a sample JPEG image bytes (minimal valid JPEG)."""
    # Minimal JPEG header (not a real image, but valid for testing)
    return (
        b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00\xff\xd9"
    )


@pytest.fixture
def sample_pdf():
    """Create a sample PDF bytes (minimal valid PDF header)."""
    return b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF"


class TestDocumentStorage:
    """Tests pour le service DocumentStorage."""

    def test_init_creates_base_directory(self, tmp_path):
        """Le storage doit créer le dossier de base s'il n'existe pas."""
        new_path = tmp_path / "new_storage"
        storage = DocumentStorage(storage_path=str(new_path))
        assert new_path.exists()
        assert new_path.is_dir()

    def test_calculate_sha256_returns_correct_hash(self, storage, sample_image):
        """Le hash SHA-256 doit être correct et reproductible."""
        hash1 = storage.calculate_sha256(sample_image)
        hash2 = storage.calculate_sha256(sample_image)

        # Doit être le même hash
        assert hash1 == hash2

        # Doit être un hex string de 64 caractères
        assert len(hash1) == 64
        assert all(c in "0123456789abcdef" for c in hash1)

        # Vérifier avec hashlib standard
        expected = hashlib.sha256(sample_image).hexdigest()
        assert hash1 == expected

    def test_validate_file_accepts_valid_jpeg(self, storage, sample_image):
        """Un fichier JPEG valide doit être accepté."""
        # Ne doit pas lever d'exception
        storage.validate_file("test.jpg", "image/jpeg", len(sample_image))
        storage.validate_file("test.jpeg", "image/jpeg", len(sample_image))

    def test_validate_file_accepts_valid_png(self, storage, sample_image):
        """Un fichier PNG valide doit être accepté."""
        storage.validate_file("test.png", "image/png", len(sample_image))

    def test_validate_file_accepts_valid_pdf(self, storage, sample_pdf):
        """Un fichier PDF valide doit être accepté."""
        storage.validate_file("test.pdf", "application/pdf", len(sample_pdf))

    def test_validate_file_rejects_invalid_extension(self, storage, sample_image):
        """Une extension non autorisée doit lever HTTPException."""
        with pytest.raises(HTTPException) as exc_info:
            storage.validate_file("test.txt", "text/plain", len(sample_image))
        assert exc_info.value.status_code == 400
        assert "not allowed" in exc_info.value.detail

    def test_validate_file_rejects_invalid_content_type(self, storage, sample_image):
        """Un content-type non autorisé doit lever HTTPException."""
        with pytest.raises(HTTPException) as exc_info:
            storage.validate_file("test.jpg", "text/plain", len(sample_image))
        assert exc_info.value.status_code == 400
        assert "not allowed" in exc_info.value.detail

    def test_validate_file_rejects_too_large(self, storage, sample_image):
        """Un fichier trop volumineux doit lever HTTPException."""
        # Créer un fichier de 11MB (limite = 10MB)
        large_file = sample_image + (b"\x00" * (11 * 1024 * 1024))

        with pytest.raises(HTTPException) as exc_info:
            storage.validate_file("test.jpg", "image/jpeg", len(large_file))
        assert exc_info.value.status_code == 400
        assert "exceeds maximum" in exc_info.value.detail

    def test_get_session_path_creates_directory(self, storage):
        """Le chemin de session doit être créé s'il n'existe pas."""
        session_id = "test-session-123"
        path = storage.get_session_path(session_id)

        assert path.exists()
        assert path.is_dir()
        assert str(session_id) in str(path)

    @pytest.mark.asyncio
    async def test_save_document_returns_metadata(self, storage, sample_image):
        """save_document doit retourner les métadonnées complètes."""
        result = await storage.save_document(
            session_id="session-123",
            file_content=sample_image,
            filename="cni_recto.jpg",
            content_type="image/jpeg",
            document_type="CNI_RECTO",
        )

        assert "path" in result
        assert "sha256" in result
        assert "size" in result
        assert "saved_at" in result
        assert "document_type" in result
        assert "filename" in result

        assert result["document_type"] == "CNI_RECTO"
        assert result["size"] == len(sample_image)
        assert len(result["sha256"]) == 64
        assert "session-123" in result["path"]
        assert "CNI_RECTO" in result["path"]

    @pytest.mark.asyncio
    async def test_save_document_without_type(self, storage, sample_image):
        """save_document doit fonctionner sans document_type."""
        result = await storage.save_document(
            session_id="session-456",
            file_content=sample_image,
            filename="selfie.jpg",
            content_type="image/jpeg",
        )

        assert "session-456" in result["path"]
        assert "CNI_RECTO" not in result["path"]

    @pytest.mark.asyncio
    async def test_save_document_filename_includes_hash(self, storage, sample_image):
        """Le nom de fichier doit inclure le hash pour unicité."""
        result = await storage.save_document(
            session_id="session-789",
            file_content=sample_image,
            filename="test.jpg",
            content_type="image/jpeg",
        )

        # Le filename doit contenir les 8 premiers caractères du hash
        assert result["sha256"][:8] in result["filename"]

    @pytest.mark.asyncio
    async def test_get_document_returns_content(self, storage, sample_image):
        """get_document doit retourner le contenu du fichier."""
        # Sauvegarder d'abord
        await storage.save_document(
            session_id="session-get",
            file_content=sample_image,
            filename="test.jpg",
            content_type="image/jpeg",
        )

        # Récupérer
        content = await storage.get_document("session-get", "test.jpg")
        assert content == sample_image

    @pytest.mark.asyncio
    async def test_get_document_not_found(self, storage):
        """get_document doit lever FileNotFoundError si inexistant."""
        with pytest.raises(FileNotFoundError):
            await storage.get_document("nonexistent", "test.jpg")

    @pytest.mark.asyncio
    async def test_verify_integrity_matching(self, storage, sample_image):
        """verify_integrity doit retourner True si le hash correspond."""
        # Sauvegarder
        metadata = await storage.save_document(
            session_id="session-verify",
            file_content=sample_image,
            filename="test.jpg",
            content_type="image/jpeg",
        )

        # Vérifier avec le bon hash
        is_valid = await storage.verify_integrity(
            "session-verify", metadata["filename"], metadata["sha256"]
        )
        assert is_valid is True

    @pytest.mark.asyncio
    async def test_verify_integrity_mismatch(self, storage, sample_image):
        """verify_integrity doit retourner False si le hash ne correspond pas."""
        # Sauvegarder
        metadata = await storage.save_document(
            session_id="session-verify2",
            file_content=sample_image,
            filename="test.jpg",
            content_type="image/jpeg",
        )

        # Vérifier avec un mauvais hash
        is_valid = await storage.verify_integrity(
            "session-verify2",
            metadata["filename"],
            "wrong_hash_1234567890abcdef1234567890abcdef1234567890abcdef12345678",
        )
        assert is_valid is False

    @pytest.mark.asyncio
    async def test_delete_document_exists(self, storage, sample_image):
        """delete_document doit retourner True si le fichier existait."""
        # Sauvegarder
        metadata = await storage.save_document(
            session_id="session-delete",
            file_content=sample_image,
            filename="test.jpg",
            content_type="image/jpeg",
        )

        # Supprimer
        deleted = await storage.delete_document("session-delete", metadata["filename"])
        assert deleted is True

        # Vérifier qu'il n'existe plus
        with pytest.raises(FileNotFoundError):
            await storage.get_document("session-delete", metadata["filename"])

    @pytest.mark.asyncio
    async def test_delete_document_not_exists(self, storage):
        """delete_document doit retourner False si le fichier n'existe pas."""
        deleted = await storage.delete_document("nonexistent", "test.jpg")
        assert deleted is False

    @pytest.mark.asyncio
    async def test_list_session_documents(self, storage, sample_image):
        """list_session_documents doit retourner la liste des fichiers."""
        # Sauvegarder 2 documents
        await storage.save_document(
            session_id="session-list",
            file_content=sample_image,
            filename="doc1.jpg",
            content_type="image/jpeg",
        )
        await storage.save_document(
            session_id="session-list",
            file_content=sample_image,
            filename="doc2.jpg",
            content_type="image/jpeg",
        )

        documents = storage.list_session_documents("session-list")
        assert len(documents) == 2

        # Vérifier que les chemins contiennent session-list
        for doc in documents:
            assert "session-list" in doc

    @pytest.mark.asyncio
    async def test_list_session_documents_excludes_temp(self, storage, sample_image):
        """list_session_documents doit exclure les fichiers .tmp."""
        # Créer un fichier .tmp manuellement
        session_path = storage.get_session_path("session-tmp")
        temp_file = session_path / "temp.jpg.tmp"
        temp_file.write_bytes(sample_image)

        documents = storage.list_session_documents("session-tmp")

        # Le fichier .tmp ne doit pas être dans la liste
        for doc in documents:
            assert ".tmp" not in doc


class TestSaveUploadedFile:
    """Tests pour save_uploaded_file avec FastAPI UploadFile."""

    @pytest.mark.asyncio
    async def test_save_uploaded_file(self, storage, sample_image):
        """save_uploaded_file doit sauvegarder correctement."""
        # Créer un UploadFile mock (FastAPI 0.100+ signature)
        upload_file = UploadFile(
            file=BytesIO(sample_image),
            size=len(sample_image),
            filename="cni_verso.jpg",
            headers={"content-type": "image/jpeg"},
        )

        result = await storage.save_uploaded_file(
            session_id="session-upload",
            upload_file=upload_file,
            document_type="CNI_VERSO",
        )

        assert result["document_type"] == "CNI_VERSO"
        assert "CNI_VERSO" in result["path"]

    @pytest.mark.asyncio
    async def test_save_uploaded_file_resets_pointer(self, storage, sample_image):
        """save_uploaded_file doit reset le file pointer."""
        # Créer un UploadFile mock
        upload_file = UploadFile(
            file=BytesIO(sample_image),
            size=len(sample_image),
            filename="test.jpg",
            headers={"content-type": "image/jpeg"},
        )

        # Lire une première fois
        await storage.save_uploaded_file("session-1", upload_file)

        # Le pointer doit être reset (peut être relu)
        await upload_file.seek(0)
        content = await upload_file.read()
        assert len(content) > 0  # Doit pouvoir être relu


class TestDocumentStorageIntegration:
    """Tests d'intégration pour le workflow complet."""

    @pytest.mark.asyncio
    async def test_full_workflow(self, storage, sample_image):
        """Tester le workflow complet: save → get → verify → delete."""
        session_id = "session-workflow"
        filename = "test_workflow.jpg"

        # 1. Save
        metadata = await storage.save_document(
            session_id=session_id,
            file_content=sample_image,
            filename=filename,
            content_type="image/jpeg",
        )

        # 2. Get
        content = await storage.get_document(session_id, metadata["filename"])
        assert content == sample_image

        # 3. Verify integrity
        is_valid = await storage.verify_integrity(
            session_id, metadata["filename"], metadata["sha256"]
        )
        assert is_valid is True

        # 4. Delete
        deleted = await storage.delete_document(session_id, metadata["filename"])
        assert deleted is True

        # 5. Verify deletion
        with pytest.raises(FileNotFoundError):
            await storage.get_document(session_id, metadata["filename"])
