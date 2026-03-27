"""Document Storage Service with SHA-256 Integrity Verification.

This service handles secure document storage for KYC sessions with:
- SHA-256 hash calculation for integrity verification
- Organized folder structure: /data/documents/{session_id}/{filename}
- File type validation and size limits
- Atomic write operations to prevent corruption

Usage:
    from app.modules.kyc.storage import DocumentStorage
    
    storage = DocumentStorage()
    result = await storage.save_document(
        session_id="uuid-here",
        file_content=bytes,
        filename="cni_recto.jpg",
        content_type="image/jpeg"
    )
    # result = {path, sha256, size, saved_at}
"""
import os
import hashlib
import aiofiles
from datetime import datetime, timezone
from pathlib import Path
from typing import Optional
from fastapi import UploadFile, HTTPException, status

from app.core.config import settings
from app.core.logging import logger


class DocumentStorageError(Exception):
    """Custom exception for storage-related errors."""
    pass


class DocumentStorage:
    """Secure document storage with SHA-256 integrity verification."""
    
    def __init__(self, storage_path: str | None = None):
        """Initialize storage service.
        
        Args:
            storage_path: Base path for document storage. If provided, uses this path directly.
                         If None, uses STORAGE_PATH from settings.
        """
        # If explicit path provided (e.g., for tests), use it
        if storage_path is not None:
            self.base_path = Path(storage_path)
        # Use dev path in development/test, production path otherwise
        elif settings.ENVIRONMENT in ("development", "test"):
            self.base_path = Path(settings.STORAGE_PATH_DEV)
        else:
            self.base_path = Path(settings.STORAGE_PATH)
        
        # Ensure base directory exists
        self.base_path.mkdir(parents=True, exist_ok=True)
        logger.info(f"DocumentStorage initialized at {self.base_path}")
    
    def calculate_sha256(self, file_content: bytes) -> str:
        """Calculate SHA-256 hash of file content.
        
        Args:
            file_content: Raw bytes of the file
            
        Returns:
            Hexadecimal SHA-256 hash string
        """
        return hashlib.sha256(file_content).hexdigest()
    
    def validate_file(
        self,
        filename: str,
        content_type: str,
        file_size: int
    ) -> None:
        """Validate file type and size.
        
        Args:
            filename: Original filename
            content_type: MIME type of the file
            file_size: Size in bytes
            
        Raises:
            HTTPException: If file type or size is invalid
        """
        # Check file extension
        allowed_extensions = {".jpg", ".jpeg", ".png", ".pdf"}
        file_ext = Path(filename).suffix.lower()
        
        if file_ext not in allowed_extensions:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File type '{file_ext}' not allowed. Allowed: {allowed_extensions}"
            )
        
        # Check MIME type
        if content_type not in settings.ALLOWED_DOCUMENT_TYPES:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Content type '{content_type}' not allowed"
            )
        
        # Check file size
        max_size = settings.MAX_DOCUMENT_SIZE_MB * 1024 * 1024  # Convert to bytes
        if file_size > max_size:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"File size ({file_size} bytes) exceeds maximum ({max_size} bytes)"
            )
    
    def get_session_path(self, session_id: str) -> Path:
        """Get the storage path for a specific KYC session.
        
        Args:
            session_id: UUID of the KYC session
            
        Returns:
            Path object for the session directory
        """
        session_path = self.base_path / session_id
        session_path.mkdir(parents=True, exist_ok=True)
        return session_path
    
    async def save_document(
        self,
        session_id: str,
        file_content: bytes,
        filename: str,
        content_type: str,
        document_type: Optional[str] = None
    ) -> dict:
        """Save a document to storage with SHA-256 integrity hash.
        
        Args:
            session_id: UUID of the KYC session
            file_content: Raw bytes of the file
            filename: Original filename
            content_type: MIME type of the file
            document_type: Optional type identifier (e.g., "CNI_RECTO", "CNI_VERSO", "SELFIE")
            
        Returns:
            Dictionary with storage metadata:
            - path: Relative path within storage
            - sha256: SHA-256 hash of file content
            - size: File size in bytes
            - saved_at: ISO timestamp of save operation
            - document_type: Type identifier if provided
            
        Raises:
            DocumentStorageError: If save operation fails
        """
        try:
            # Validate file
            self.validate_file(filename, content_type, len(file_content))
            
            # Calculate hash BEFORE saving
            sha256_hash = self.calculate_sha256(file_content)
            
            # Generate unique filename with timestamp and hash prefix
            timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
            safe_filename = f"{timestamp}_{sha256_hash[:8]}_{filename}"
            
            # Get session directory
            session_path = self.get_session_path(session_id)
            
            # If document_type provided, create subdirectory
            if document_type:
                type_path = session_path / document_type
                type_path.mkdir(parents=True, exist_ok=True)
                file_path = type_path / safe_filename
                relative_path = f"{session_id}/{document_type}/{safe_filename}"
            else:
                file_path = session_path / safe_filename
                relative_path = f"{session_id}/{safe_filename}"
            
            # Atomic write: write to temp file first, then rename
            temp_path = file_path.with_suffix(file_path.suffix + ".tmp")
            
            async with aiofiles.open(temp_path, 'wb') as f:
                await f.write(file_content)
                await f.flush()
                os.fsync(f.fileno())  # Ensure data is written to disk
            
            # Rename temp file to final file (atomic operation)
            temp_path.rename(file_path)
            
            file_size = len(file_content)
            saved_at = datetime.now(timezone.utc).isoformat()
            
            logger.info(
                f"Document saved: session={session_id}, "
                f"path={relative_path}, size={file_size}, sha256={sha256_hash[:16]}..."
            )
            
            return {
                "path": relative_path,
                "sha256": sha256_hash,
                "size": file_size,
                "saved_at": saved_at,
                "document_type": document_type,
                "filename": safe_filename
            }
            
        except HTTPException:
            # Re-raise HTTP exceptions as-is
            raise
        except Exception as e:
            logger.error(f"Failed to save document: {e}")
            raise DocumentStorageError(f"Failed to save document: {str(e)}")
    
    async def save_uploaded_file(
        self,
        session_id: str,
        upload_file: UploadFile,
        document_type: Optional[str] = None
    ) -> dict:
        """Save an uploaded file from FastAPI request.
        
        Args:
            session_id: UUID of the KYC session
            upload_file: FastAPI UploadFile object
            document_type: Optional type identifier
            
        Returns:
            Same dictionary as save_document()
        """
        try:
            # Read file content
            file_content = await upload_file.read()
            
            # Save using standard method
            return await self.save_document(
                session_id=session_id,
                file_content=file_content,
                filename=upload_file.filename or "unnamed",
                content_type=upload_file.content_type or "application/octet-stream",
                document_type=document_type
            )
            
        finally:
            # Ensure file pointer is reset
            await upload_file.seek(0)
    
    async def get_document(self, session_id: str, filename: str) -> bytes:
        """Retrieve a document from storage.
        
        Args:
            session_id: UUID of the KYC session
            filename: Name of the file to retrieve (can be original filename or stored filename)
            
        Returns:
            Raw bytes of the file
            
        Raises:
            FileNotFoundError: If document doesn't exist
        """
        # First try direct path
        file_path = self.base_path / session_id / filename
        
        if file_path.exists():
            async with aiofiles.open(file_path, 'rb') as f:
                return await f.read()
        
        # If not found, search in subdirectories (document_type folders)
        session_path = self.base_path / session_id
        if session_path.exists():
            for root, dirs, files in os.walk(session_path):
                for file in files:
                    if file == filename or filename in file:
                        file_path = Path(root) / file
                        async with aiofiles.open(file_path, 'rb') as f:
                            return await f.read()
        
        raise FileNotFoundError(f"Document not found: {session_id}/{filename}")
    
    async def verify_integrity(self, session_id: str, filename: str, expected_hash: str) -> bool:
        """Verify document integrity by comparing SHA-256 hashes.
        
        Args:
            session_id: UUID of the KYC session
            filename: Name of the file to verify
            expected_hash: Expected SHA-256 hash
            
        Returns:
            True if hash matches, False otherwise
        """
        try:
            file_content = await self.get_document(session_id, filename)
            actual_hash = self.calculate_sha256(file_content)
            return actual_hash == expected_hash
        except FileNotFoundError:
            return False
    
    async def delete_document(self, session_id: str, filename: str) -> bool:
        """Delete a document from storage.
        
        Args:
            session_id: UUID of the KYC session
            filename: Name of the file to delete
            
        Returns:
            True if deleted, False if file didn't exist
        """
        file_path = self.base_path / session_id / filename
        
        if file_path.exists():
            file_path.unlink()
            logger.info(f"Document deleted: {session_id}/{filename}")
            return True
        return False
    
    def list_session_documents(self, session_id: str) -> list:
        """List all documents for a session.
        
        Args:
            session_id: UUID of the KYC session
            
        Returns:
            List of file paths relative to session directory
        """
        session_path = self.base_path / session_id
        
        if not session_path.exists():
            return []
        
        documents = []
        for root, dirs, files in os.walk(session_path):
            for file in files:
                if not file.endswith('.tmp'):  # Exclude temp files
                    full_path = Path(root) / file
                    relative_path = str(full_path.relative_to(self.base_path))
                    documents.append(relative_path)
        
        return documents


# Singleton instance for use across the application
document_storage = DocumentStorage()
