from datetime import datetime, timezone, timedelta
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from boto3.dynamodb.conditions import Key
from app.auth.dependencies import get_admin_user
from app.db.dynamodb import (
    get_users_table,
    get_presence_table,
    get_attendance_table,
    get_offices_table,
)

router = APIRouter(prefix="/api/admin/presence", tags=["admin-presence"])

KST = timezone(timedelta(hours=9))


class CreateOfficeRequest(BaseModel):
    office_id: str = Field(..., min_length=1, max_length=50)
    name: str = Field(..., min_length=1, max_length=100)
    address: str = ""
    latitude: float = 0.0
    longitude: float = 0.0
    radius_meters: int = Field(200, ge=50, le=5000)
    wifi_ssids: List[str] = []


class UpdateOfficeRequest(BaseModel):
    name: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    radius_meters: Optional[int] = Field(None, ge=50, le=5000)
    wifi_ssids: Optional[List[str]] = None
    is_active: Optional[bool] = None


@router.get("/dashboard")
async def presence_dashboard(
    admin: dict = Depends(get_admin_user),
):
    """전 직원 상태 대시보드 (부서별 그룹핑)"""
    users_table = get_users_table()
    presence_table = get_presence_table()

    users_resp = users_table.scan(
        ProjectionExpression="user_id, #n, department, #s",
        ExpressionAttributeNames={"#n": "name", "#s": "status"},
    )
    all_users = users_resp.get("Items", [])
    active_users = {
        u["user_id"]: u
        for u in all_users
        if u.get("status", "active") == "active"
    }

    presence_resp = presence_table.scan()
    presence_map = {p["user_id"]: p for p in presence_resp.get("Items", [])}

    by_department: dict = {}
    status_summary = {
        "IN_OFFICE": 0,
        "IN_BUILDING": 0,
        "OUT_OF_OFFICE": 0,
        "ON_LEAVE": 0,
        "OFF_DUTY": 0,
    }

    for uid, user in active_users.items():
        dept = user.get("department", "미지정")
        if dept not in by_department:
            by_department[dept] = []

        p = presence_map.get(uid, {})
        current_status = p.get("status", "OFF_DUTY")
        status_summary[current_status] = status_summary.get(current_status, 0) + 1

        by_department[dept].append({
            "user_id": uid,
            "name": user.get("name", ""),
            "status": current_status,
            "office_id": p.get("office_id"),
            "office_name": p.get("office_name"),
            "detection_method": p.get("detection_method"),
            "manual_note": p.get("manual_note"),
            "last_updated": p.get("last_updated"),
        })

    for dept in by_department:
        by_department[dept].sort(key=lambda x: (
            x["status"] == "OFF_DUTY",
            x["status"] == "ON_LEAVE",
            x.get("name", ""),
        ))

    return {
        "total_users": len(active_users),
        "status_summary": status_summary,
        "by_department": by_department,
    }


@router.get("/attendance")
async def admin_attendance(
    admin: dict = Depends(get_admin_user),
    date: Optional[str] = Query(None, description="YYYY-MM-DD (기본: 오늘)"),
):
    """특정 일자 전체 출퇴근 기록"""
    if not date:
        date = datetime.now(KST).strftime("%Y-%m-%d")

    attendance_table = get_attendance_table()
    users_table = get_users_table()

    resp = attendance_table.query(
        IndexName="date-user_id-index",
        KeyConditionExpression=Key("date").eq(date),
    )
    records = resp.get("Items", [])

    users_resp = users_table.scan(
        ProjectionExpression="user_id, #n, department, #s",
        ExpressionAttributeNames={"#n": "name", "#s": "status"},
    )
    user_map = {
        u["user_id"]: u
        for u in users_resp.get("Items", [])
        if u.get("status", "active") == "active"
    }

    checked_in_ids = set()
    result = []
    for record in records:
        uid = record["user_id"]
        checked_in_ids.add(uid)
        user = user_map.get(uid, {})
        result.append({
            "user_id": uid,
            "name": user.get("name", uid),
            "department": user.get("department", ""),
            "check_in": record.get("check_in"),
            "check_out": record.get("check_out"),
            "check_in_method": record.get("check_in_method"),
            "check_out_method": record.get("check_out_method"),
            "office_id": record.get("office_id"),
        })

    absent = []
    for uid, user in user_map.items():
        if uid not in checked_in_ids:
            absent.append({
                "user_id": uid,
                "name": user.get("name", uid),
                "department": user.get("department", ""),
                "check_in": None,
                "check_out": None,
            })

    return {
        "date": date,
        "checked_in": result,
        "checked_in_count": len(result),
        "absent": absent,
        "absent_count": len(absent),
    }


@router.post("/offices", status_code=201)
async def create_office(
    req: CreateOfficeRequest,
    admin: dict = Depends(get_admin_user),
):
    """사무실 등록"""
    table = get_offices_table()

    existing = table.get_item(Key={"office_id": req.office_id}).get("Item")
    if existing:
        raise HTTPException(status_code=400, detail="이미 존재하는 사무실 ID입니다.")

    now = datetime.now(timezone.utc).isoformat()
    item = {
        "office_id": req.office_id,
        "name": req.name,
        "address": req.address,
        "latitude": str(req.latitude),
        "longitude": str(req.longitude),
        "radius_meters": req.radius_meters,
        "wifi_ssids": req.wifi_ssids,
        "is_active": True,
        "created_at": now,
    }
    table.put_item(Item=item)
    return {"message": "사무실이 등록되었습니다.", "office_id": req.office_id}


@router.put("/offices/{office_id}")
async def update_office(
    office_id: str,
    req: UpdateOfficeRequest,
    admin: dict = Depends(get_admin_user),
):
    """사무실 정보 수정"""
    table = get_offices_table()
    existing = table.get_item(Key={"office_id": office_id}).get("Item")
    if not existing:
        raise HTTPException(status_code=404, detail="사무실을 찾을 수 없습니다.")

    updates = {}
    if req.name is not None:
        updates["name"] = req.name
    if req.address is not None:
        updates["address"] = req.address
    if req.latitude is not None:
        updates["latitude"] = str(req.latitude)
    if req.longitude is not None:
        updates["longitude"] = str(req.longitude)
    if req.radius_meters is not None:
        updates["radius_meters"] = req.radius_meters
    if req.wifi_ssids is not None:
        updates["wifi_ssids"] = req.wifi_ssids
    if req.is_active is not None:
        updates["is_active"] = req.is_active

    if not updates:
        return {"message": "변경 사항이 없습니다."}

    expr = "SET " + ", ".join(f"#{k} = :{k}" for k in updates)
    table.update_item(
        Key={"office_id": office_id},
        UpdateExpression=expr,
        ExpressionAttributeNames={f"#{k}": k for k in updates},
        ExpressionAttributeValues={f":{k}": v for k, v in updates.items()},
    )
    return {"message": "사무실 정보가 수정되었습니다."}


@router.delete("/offices/{office_id}")
async def delete_office(
    office_id: str,
    admin: dict = Depends(get_admin_user),
):
    """사무실 삭제 (soft delete: is_active=False)"""
    table = get_offices_table()
    existing = table.get_item(Key={"office_id": office_id}).get("Item")
    if not existing:
        raise HTTPException(status_code=404, detail="사무실을 찾을 수 없습니다.")

    table.update_item(
        Key={"office_id": office_id},
        UpdateExpression="SET is_active = :f",
        ExpressionAttributeValues={":f": False},
    )
    return {"message": "사무실이 삭제되었습니다."}
