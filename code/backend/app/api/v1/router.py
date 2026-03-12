from fastapi import APIRouter
from app.modules.auth.router import router as auth_router
from app.modules.kyc.router import router as kyc_router
from app.modules.backoffice.router import router as backoffice_router
from app.modules.admin.router import router as admin_router
from app.modules.aml.router import router as aml_router
from app.modules.analytics.router import router as analytics_router
from app.modules.notifications.router import router as notifications_router

api_router = APIRouter()

api_router.include_router(auth_router, prefix="/auth", tags=["auth"])
api_router.include_router(kyc_router, prefix="/kyc", tags=["kyc"])
api_router.include_router(backoffice_router, prefix="/backoffice", tags=["backoffice"])
api_router.include_router(admin_router, prefix="/admin", tags=["admin"])
api_router.include_router(aml_router, prefix="/aml", tags=["aml"])
api_router.include_router(analytics_router, prefix="/analytics", tags=["analytics"])
api_router.include_router(notifications_router, prefix="/notifications", tags=["notifications"])
