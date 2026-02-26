import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from mangum import Mangum

from app.auth.router import router as auth_router
from app.users.router import router as users_router
from app.receipts.router import router as receipts_router
from app.records.router import router as records_router
from app.cards.router import router as cards_router
from app.admin.router import router as admin_router
from app.presence.router import router as presence_router
from app.attendance.router import router as attendance_router
from app.admin.presence_router import router as admin_presence_router
from app.org.router import router as org_router
from app.categories import load_categories

app = FastAPI(
    title="영수증 관리 시스템 API",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(users_router)
app.include_router(receipts_router)
app.include_router(records_router)
app.include_router(cards_router)
app.include_router(admin_router)
app.include_router(presence_router)
app.include_router(attendance_router)
app.include_router(admin_presence_router)
app.include_router(org_router)


@app.get("/api/health")
async def health():
    return {"status": "ok", "service": "receipt-manager"}


@app.get("/api/categories")
async def get_categories():
    """categories.json 기반 카테고리 목록 반환 (인증 불필요)"""
    return {"categories": load_categories()}


# Lambda 핸들러 (Mangum)
handler = Mangum(app, lifespan="off")
