from fastapi import APIRouter, Depends, HTTPException
from typing import List, Optional
from app.auth.dependencies import get_current_user
from app.db.dynamodb import get_users_table
from app.presence.schemas import (
    PresenceUpdateRequest,
    ManualStatusRequest,
    PresenceResponse,
    AllPresenceResponse,
    PresenceStatus,
)
from app.presence.service import (
    update_presence,
    set_manual_status,
    get_user_presence,
    get_all_presence,
    get_active_offices,
)

router = APIRouter(prefix="/api/presence", tags=["presence"])


@router.put("/update")
async def update_my_presence(
    req: PresenceUpdateRequest,
    current_user: dict = Depends(get_current_user),
):
    """앱에서 주기적으로 호출하여 상태 업데이트 (Wi-Fi/GPS 기반)"""
    if req.status in (PresenceStatus.ON_LEAVE,):
        raise HTTPException(
            status_code=400,
            detail="ON_LEAVE 상태는 수동 설정 API를 사용하세요.",
        )

    result = update_presence(
        user_id=current_user["user_id"],
        status=req.status.value,
        office_id=req.office_id,
        detection_method=req.detection_method.value,
        wifi_ssid=req.wifi_ssid,
    )
    return {"message": "상태가 업데이트되었습니다.", "presence": result}


@router.put("/manual")
async def set_manual_presence(
    req: ManualStatusRequest,
    current_user: dict = Depends(get_current_user),
):
    """사용자가 직접 상태를 변경 (휴가, 외근 등)"""
    result = set_manual_status(
        user_id=current_user["user_id"],
        status=req.status.value,
        manual_note=req.manual_note,
    )
    return {"message": "상태가 업데이트되었습니다.", "presence": result}


@router.get("/me")
async def get_my_presence(
    current_user: dict = Depends(get_current_user),
):
    """내 현재 상태 조회"""
    presence = get_user_presence(current_user["user_id"])
    if not presence:
        return {
            "user_id": current_user["user_id"],
            "name": current_user.get("name", ""),
            "department": current_user.get("department"),
            "status": "OFF_DUTY",
            "office_id": None,
            "office_name": None,
            "detection_method": None,
            "manual_note": None,
            "last_updated": None,
        }

    return {
        "user_id": presence["user_id"],
        "name": current_user.get("name", ""),
        "department": current_user.get("department"),
        "status": presence.get("status", "OFF_DUTY"),
        "office_id": presence.get("office_id"),
        "office_name": presence.get("office_name"),
        "detection_method": presence.get("detection_method"),
        "manual_note": presence.get("manual_note"),
        "last_updated": presence.get("last_updated"),
    }


@router.get("/all")
async def get_all_user_presence(
    current_user: dict = Depends(get_current_user),
):
    """전 직원 현재 상태 일람"""
    users_table = get_users_table()
    resp = users_table.scan(
        ProjectionExpression="user_id, #n, department, #s",
        ExpressionAttributeNames={"#n": "name", "#s": "status"},
    )
    all_users = resp.get("Items", [])
    active_users = {
        u["user_id"]: u
        for u in all_users
        if u.get("status", "active") == "active"
    }

    presence_items = get_all_presence()
    presence_map = {p["user_id"]: p for p in presence_items}

    result = []
    for uid, user in active_users.items():
        p = presence_map.get(uid, {})
        result.append({
            "user_id": uid,
            "name": user.get("name", ""),
            "department": user.get("department"),
            "status": p.get("status", "OFF_DUTY"),
            "office_id": p.get("office_id"),
            "office_name": p.get("office_name"),
            "detection_method": p.get("detection_method"),
            "manual_note": p.get("manual_note"),
            "last_updated": p.get("last_updated"),
        })

    result.sort(key=lambda x: (
        x["status"] == "OFF_DUTY",
        x["status"] == "ON_LEAVE",
        x.get("department", ""),
        x.get("name", ""),
    ))

    return {"users": result, "count": len(result)}


@router.get("/offices")
async def get_offices(
    current_user: dict = Depends(get_current_user),
):
    """사무실 목록 + 지오펜스/Wi-Fi 설정 (앱 초기화 시 사용)"""
    offices = get_active_offices()
    offices.sort(key=lambda o: o.get("name", ""))
    return {"offices": offices}
