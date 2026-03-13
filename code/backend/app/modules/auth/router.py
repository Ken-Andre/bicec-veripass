from fastapi import APIRouter

router = APIRouter()

@router.get("/")
async def get_root():
    return {"module": "auth", "status": "initialized"}
