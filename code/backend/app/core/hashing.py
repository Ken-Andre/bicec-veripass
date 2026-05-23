import hashlib
import logging
from typing import Union, BinaryIO
from pathlib import Path

logger = logging.getLogger(__name__)


async def calculate_sha256(
    file_input: Union[str, Path, bytes, BinaryIO], chunk_size: int = 65536
) -> str:
    """
    Calculates the SHA-256 hash of a file or byte stream for integrity verification.

    Args:
        file_input: Path to the file, bytes, or a file-like object.
        chunk_size: Size of chunks to read into memory (default 64KB).

    Returns:
        The hex string representation of the SHA-256 hash.
    """
    sha256_hash = hashlib.sha256()

    try:
        if isinstance(file_input, bytes):
            sha256_hash.update(file_input)
        elif isinstance(file_input, (str, Path)):
            with open(file_input, "rb") as f:
                for byte_block in iter(lambda: f.read(chunk_size), b""):
                    sha256_hash.update(byte_block)
        else:  # File-like object
            for byte_block in iter(lambda: file_input.read(chunk_size), b""):
                sha256_hash.update(byte_block)

        return sha256_hash.hexdigest()
    except Exception as e:
        logger.error(f"Error calculating hash: {str(e)}")
        raise


async def verify_integrity(
    file_input: Union[str, Path, bytes, BinaryIO], expected_hash: str
) -> bool:
    """
    Verifies that the SHA-256 hash of a file matches the expected hash.
    """
    actual_hash = await calculate_sha256(file_input)
    return actual_hash.lower() == expected_hash.lower()
