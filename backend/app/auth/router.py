from fastapi import APIRouter, HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
from passlib.context import CryptContext
from app.db.dynamodb import get_users_table
from app.auth.jwt_handler import create_access_token, create_refresh_token, verify_token
from app.auth.dependencies import get_current_user, get_admin_user
from datetime import datetime, timezone

router = APIRouter(prefix="/api/auth", tags=["auth"])
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

# 사용자 status: "pending" | "active" | "inactive"


class LoginRequest(BaseModel):
    user_id: str
    password: str


class SelfRegisterRequest(BaseModel):
    """직원 자체 회원가입 (관리자 승인 필요)"""
    user_id: str
    password: str
    name: str
    department: str = ""


class AdminRegisterRequest(BaseModel):
    """관리자가 직접 계정 생성 (즉시 활성)"""
    user_id: str
    password: str
    name: str
    department: str = ""
    role: str = "user"


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str


@router.post("/login")
async def login(req: LoginRequest):
    table = get_users_table()
    resp = table.get_item(Key={"user_id": req.user_id})
    user = resp.get("Item")

    # 존재하지 않거나 비밀번호 불일치
    if not user or not pwd_context.verify(req.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="아이디 또는 비밀번호가 올바르지 않습니다.",
        )

    user_status = user.get("status", "active")  # 기존 데이터 호환

    if user_status == "pending":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="관리자 승인 대기 중입니다. 관리자에게 문의하세요.",
        )
    if user_status == "inactive":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="비활성화된 계정입니다. 관리자에게 문의하세요.",
        )

    access_token = create_access_token({"sub": user["user_id"]})
    refresh_token = create_refresh_token({"sub": user["user_id"]})
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
        "user": {
            "user_id": user["user_id"],
            "name": user["name"],
            "role": user["role"],
            "department": user.get("department", ""),
        },
    }


@router.post("/refresh")
async def refresh_token(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    payload = verify_token(token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="유효하지 않은 갱신 토큰입니다.")
    user_id = payload.get("sub")
    # 갱신 시에도 계정 상태 확인
    table = get_users_table()
    user = table.get_item(Key={"user_id": user_id}).get("Item")
    if not user or user.get("status", "active") != "active":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="계정이 비활성화되었습니다.")
    access_token = create_access_token({"sub": user_id})
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/signup", status_code=201)
async def self_signup(req: SelfRegisterRequest):
    """직원 자체 회원가입 — 관리자 승인 후 로그인 가능"""
    table = get_users_table()
    existing = table.get_item(Key={"user_id": req.user_id}).get("Item")
    if existing:
        raise HTTPException(status_code=400, detail="이미 존재하는 아이디입니다.")
    now = datetime.now(timezone.utc).isoformat()
    item = {
        "user_id": req.user_id,
        "name": req.name,
        "password_hash": pwd_context.hash(req.password),
        "role": "user",
        "department": req.department,
        "favorite_partners": [],
        "created_at": now,
        "status": "pending",  # 관리자 승인 필요
    }
    table.put_item(Item=item)
    return {"message": "가입 신청이 완료되었습니다. 관리자 승인 후 로그인 가능합니다."}


@router.post("/register", status_code=201)
async def register(req: AdminRegisterRequest, admin: dict = Depends(get_admin_user)):
    """관리자가 직접 계정 생성 — 즉시 활성"""
    table = get_users_table()
    existing = table.get_item(Key={"user_id": req.user_id}).get("Item")
    if existing:
        raise HTTPException(status_code=400, detail="이미 존재하는 아이디입니다.")
    now = datetime.now(timezone.utc).isoformat()
    item = {
        "user_id": req.user_id,
        "name": req.name,
        "password_hash": pwd_context.hash(req.password),
        "role": req.role,
        "department": req.department,
        "favorite_partners": [],
        "created_at": now,
        "status": "active",
    }
    table.put_item(Item=item)
    return {"message": "사용자가 등록되었습니다.", "user_id": req.user_id}


@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return {
        "user_id": current_user["user_id"],
        "name": current_user["name"],
        "role": current_user["role"],
        "department": current_user.get("department", ""),
        "favorite_partners": current_user.get("favorite_partners", []),
        "status": current_user.get("status", "active"),
    }


@router.post("/change-password")
async def change_password(req: ChangePasswordRequest, current_user: dict = Depends(get_current_user)):
    if not pwd_context.verify(req.current_password, current_user["password_hash"]):
        raise HTTPException(status_code=400, detail="현재 비밀번호가 올바르지 않습니다.")
    table = get_users_table()
    table.update_item(
        Key={"user_id": current_user["user_id"]},
        UpdateExpression="SET password_hash = :h",
        ExpressionAttributeValues={":h": pwd_context.hash(req.new_password)},
    )
    return {"message": "비밀번호가 변경되었습니다."}
