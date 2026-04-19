"""KYC Module Pydantic Schemas."""

from typing import Optional, List
from pydantic import BaseModel, Field
from datetime import datetime


# === OCR Field ===
class OCRFieldResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: str
    field_name: str
    extracted_value: Optional[str] = None
    confidence_score: float
    human_corrected: bool = False
    corrected_value: Optional[str] = None


# === Document ===
class DocumentUploadRequest(BaseModel):
    doc_type: str = Field(
        ..., description="CNI_RECTO, CNI_VERSO, SELFIE, BILL_ENEO, BILL_CAMWATER, NIU"
    )


class DocumentResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: str
    doc_type: str
    file_path: str
    sha256_hash: str
    ocr_engine: Optional[str] = None
    confidence_per_field: Optional[dict] = None
    capture_quality_metrics: Optional[dict] = None
    captured_at: datetime
    ocr_fields: List[OCRFieldResponse] = []


# === Biometric Result ===
class BiometricResultResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: str
    face_match_score: Optional[float] = None
    liveness_score: Optional[float] = None
    anti_spoofing_score: Optional[float] = None
    processed_at: datetime


# === Consent Record ===
class ConsentSubmitRequest(BaseModel):
    cgu_accepted: bool
    privacy_accepted: bool
    data_processing_accepted: bool
    consent_method: str = Field(default="CHECKBOX_DIGITAL")


class ConsentRecordResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: str
    cgu_accepted: bool
    privacy_accepted: bool
    data_processing_accepted: bool
    consent_method: str
    cgu_version: str
    privacy_version: str
    signed_at: datetime


# === KYC Session ===
class KYCSessionResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: str
    status: str
    access_level: str
    niu_type: Optional[str] = None
    confidence_score_global: Optional[float] = None
    liveness_strike_count: int = 0
    last_step_completed: Optional[str] = None
    started_at: datetime
    submitted_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    documents: List[DocumentResponse] = []
    biometric_result: Optional[BiometricResultResponse] = None
    consent_record: Optional[ConsentRecordResponse] = None


class KYCSubmitRequest(BaseModel):
    """Submit KYC dossier for review."""

    pass


class KYCSubmitResponse(BaseModel):
    session_id: str
    status: str
    message: str


class KYCReadinessResponse(BaseModel):
    can_submit: bool
    blocking_reasons: list[str] = []
    warnings: list[str] = []
    required_missing_documents: list[str] = []
    has_ocr_review: bool
    has_consent: bool
    has_biometric_result: bool
    confidence_score_global: float | None = None


# === Address ===
class AddressSubmitRequest(BaseModel):
    region: str
    city: str
    commune: str
    quartier: str
    lieu_dit: Optional[str] = None
    gps_lat: Optional[float] = None
    gps_lng: Optional[float] = None


# === Liveness ===
class LivenessSubmitRequest(BaseModel):
    landmarks_json: List[dict] = Field(
        ..., description="Landmark frames from MediaPipe"
    )
    challenge_type: str = Field(..., description="smile, blink, turn_left, turn_right")


class LivenessResultResponse(BaseModel):
    is_alive: bool
    confidence: float
    attempts_remaining: int
    strikes_remaining: int
    face_match_score: float | None = None
    anti_spoofing_score: float | None = None
    is_locked: bool = False
    cooldown_seconds: int | None = None
    lockout_count_24h: int | None = None
    branch_fallback_available: bool = False


# === OCR Review ===
class OCRReviewSubmitRequest(BaseModel):
    fields: dict = Field(..., description="Field name → confirmed/corrected value")

class OCRConfirmSubmitRequest(BaseModel):
    corrected_fields: dict = Field(
        ..., description="Field name to corrected value mapping"
    )


# === NIU ===
class NIUSubmitRequest(BaseModel):
    niu_type: str = Field(..., description="DECLARATIVE, UPLOADED")
    niu_value: Optional[str] = None


# === Geo Data ===
class GeoRegionResponse(BaseModel):
    code: str
    name: str


class GeoCityResponse(BaseModel):
    code: str
    name: str
    region_code: str


class GeoQuartierResponse(BaseModel):
    code: str
    name: str
    city_code: str
    commune_name: str
