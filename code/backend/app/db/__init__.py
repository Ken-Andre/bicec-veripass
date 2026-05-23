"""Database initialization and model registration."""

# Import all models here to register them with SQLAlchemy
# This ensures all mappers are configured before any ORM operations
from app.modules.kyc import models as kyc_models  # noqa: F401
from app.modules.auth import models as auth_models  # noqa: F401
from app.modules.admin import models as admin_models  # noqa: F401
from app.modules.audit import models as audit_models  # noqa: F401
from app.modules.aml import models as aml_models  # noqa: F401
from app.modules.analytics import models as analytics_models  # noqa: F401
from app.modules.backoffice import models as backoffice_models  # noqa: F401
from app.modules.notifications import models as notifications_models  # noqa: F401

__all__ = [
    "kyc_models",
    "auth_models",
    "admin_models",
    "audit_models",
    "aml_models",
    "analytics_models",
    "backoffice_models",
    "notifications_models",
]
