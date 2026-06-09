# Import all models here for Alembic detected
# This file is what Alembic env.py should target for target_metadata
from app.db.base_class import Base  # noqa
from app.modules.auth.models import (  # noqa
    User,
    Agent,
    OTPSession,
    TokenRevocation,
    WebAuthnCredential,
    WebAuthnChallenge,
)
from app.modules.kyc.models import (  # noqa
    KYCSession,
    Document,
    OCRField,
    BiometricResult,
    ValidationDecision,
    DossierAssignment,
    AmlAlert,
    PEPSanctions,
    DuplicateCheck,
    ConsentRecord,
    SupportThread,
    SupportMessage,
    Notification,
    ATM,
)
from app.modules.admin.models import Agency, ProvisioningBatch, ProvisioningBatchItem  # noqa
from app.modules.audit.models import AuditLog  # noqa
from app.modules.aml.models import AmlListImport, BatchJob  # noqa
from app.modules.banking.models import BankCard, Transfer, Transaction, SavingsPocket  # noqa
from app.modules.devices.models import DeviceRegistration  # noqa
from app.modules.notifications.models import PushSubscription, NotificationPreference  # noqa
from app.modules.analytics.models import BusinessMetricBaseline  # noqa
from app.modules.legal.models import LegalDocumentVersion  # noqa
