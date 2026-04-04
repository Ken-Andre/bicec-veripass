# Import all models here for Alembic detected
# This file is what Alembic env.py should target for target_metadata
from app.db.base_class import Base  # noqa
from app.modules.auth.models import User, Agent, OTPSession, TokenRevocation  # noqa
from app.modules.kyc.models import (  # noqa
    KYCSession, Document, OCRField, BiometricResult, 
    ValidationDecision, DossierAssignment, AmlAlert, 
    PEPSanctions, DuplicateCheck, ConsentRecord, 
    SupportThread, SupportMessage, Notification
)
from app.modules.admin.models import Agency, ProvisioningBatch, ProvisioningBatchItem  # noqa
from app.modules.audit.models import AuditLog  # noqa
from app.modules.aml.models import BatchJob  # noqa
