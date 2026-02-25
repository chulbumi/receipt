from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, Query
from typing import Optional
from app.auth.dependencies import get_current_user
from app.db.dynamodb import get_attendance_table
from boto3.dynamodb.conditions import Key

router = APIRouter(prefix="/api/attendance", tags=["attendance"])

KST = timezone(timedelta(hours=9))


@router.get("/me")
async def get_my_attendance(
    start_date: Optional[str] = Query(None, description="시작일 YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="종료일 YYYY-MM-DD"),
    current_user: dict = Depends(get_current_user),
):
    """내 출퇴근 기록 조회 (날짜 범위 필터)"""
    table = get_attendance_table()
    user_id = current_user["user_id"]

    if start_date and end_date:
        resp = table.query(
            KeyConditionExpression=Key("user_id").eq(user_id) & Key("date").between(start_date, end_date),
            ScanIndexForward=False,
        )
    elif start_date:
        resp = table.query(
            KeyConditionExpression=Key("user_id").eq(user_id) & Key("date").gte(start_date),
            ScanIndexForward=False,
        )
    else:
        today = datetime.now(KST).strftime("%Y-%m-%d")
        month_start = today[:7] + "-01"
        resp = table.query(
            KeyConditionExpression=Key("user_id").eq(user_id) & Key("date").between(month_start, today),
            ScanIndexForward=False,
        )

    records = resp.get("Items", [])
    return {"records": records, "count": len(records)}


@router.get("/today")
async def get_today_attendance(
    current_user: dict = Depends(get_current_user),
):
    """오늘 출퇴근 상태"""
    table = get_attendance_table()
    today = datetime.now(KST).strftime("%Y-%m-%d")

    resp = table.get_item(Key={"user_id": current_user["user_id"], "date": today})
    item = resp.get("Item")

    if not item:
        return {
            "date": today,
            "checked_in": False,
            "check_in": None,
            "check_out": None,
            "status_history": [],
        }

    return {
        "date": today,
        "checked_in": True,
        "check_in": item.get("check_in"),
        "check_out": item.get("check_out"),
        "check_in_method": item.get("check_in_method"),
        "check_out_method": item.get("check_out_method"),
        "office_id": item.get("office_id"),
        "status_history": item.get("status_history", []),
    }
