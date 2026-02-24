from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List
from app.auth.dependencies import get_current_user
from app.db.dynamodb import get_users_table
from boto3.dynamodb.conditions import Attr

router = APIRouter(prefix="/api/users", tags=["users"])


class UpdatePartnersRequest(BaseModel):
    partner_ids: List[str]


class ToggleFavoriteRequest(BaseModel):
    partner_id: str


@router.get("")
async def get_users(current_user: dict = Depends(get_current_user)):
    """활성 사용자 목록 + 즐겨찾기 여부 포함"""
    table = get_users_table()
    resp = table.scan(
        ProjectionExpression="user_id, #n, department, #s",
        ExpressionAttributeNames={"#n": "name", "#s": "status"},
    )
    all_users = resp.get("Items", [])
    # active 상태인 사용자만 반환 (status 미설정 기존 데이터는 active 처리)
    users = [u for u in all_users if u.get("status", "active") == "active"]
    # 본인 즐겨찾기 목록
    my_favorites = set(current_user.get("favorite_partners", []))
    for u in users:
        u.pop("status", None)
        u["is_favorite"] = u["user_id"] in my_favorites
    # 즐겨찾기 먼저, 이름 순 정렬
    users.sort(key=lambda u: (not u["is_favorite"], u.get("name", "")))
    return {"users": users}


@router.post("/me/partners/toggle")
async def toggle_favorite(
    req: ToggleFavoriteRequest,
    current_user: dict = Depends(get_current_user),
):
    """즐겨찾기 토글 — 없으면 추가, 있으면 제거"""
    table = get_users_table()
    current_favorites: List[str] = list(current_user.get("favorite_partners", []))
    if req.partner_id == current_user["user_id"]:
        raise HTTPException(status_code=400, detail="자신은 즐겨찾기에 추가할 수 없습니다.")
    if req.partner_id in current_favorites:
        current_favorites.remove(req.partner_id)
        is_favorite = False
    else:
        current_favorites.append(req.partner_id)
        is_favorite = True
    table.update_item(
        Key={"user_id": current_user["user_id"]},
        UpdateExpression="SET favorite_partners = :p",
        ExpressionAttributeValues={":p": current_favorites},
    )
    return {"partner_id": req.partner_id, "is_favorite": is_favorite, "partner_ids": current_favorites}


@router.put("/me/partners")
async def update_partners(
    req: UpdatePartnersRequest,
    current_user: dict = Depends(get_current_user),
):
    table = get_users_table()
    table.update_item(
        Key={"user_id": current_user["user_id"]},
        UpdateExpression="SET favorite_partners = :p",
        ExpressionAttributeValues={":p": req.partner_ids},
    )
    return {"message": "즐겨찾기 동료가 업데이트되었습니다.", "partner_ids": req.partner_ids}


@router.get("/me/partners")
async def get_my_partners(current_user: dict = Depends(get_current_user)):
    partner_ids = current_user.get("favorite_partners", [])
    if not partner_ids:
        return {"partners": []}
    table = get_users_table()
    partners = []
    for pid in partner_ids:
        resp = table.get_item(
            Key={"user_id": pid},
            ProjectionExpression="user_id, #n, department",
            ExpressionAttributeNames={"#n": "name"},
        )
        item = resp.get("Item")
        if item:
            partners.append(item)
    return {"partners": partners}
