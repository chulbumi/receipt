import time
from datetime import datetime, timezone, timedelta
from typing import Optional
from boto3.dynamodb.conditions import Attr
from app.db.dynamodb import get_presence_table, get_attendance_table, get_offices_table

KST = timezone(timedelta(hours=9))
TTL_SECONDS = 86400  # 24 hours


def _now_utc() -> str:
    return datetime.now(timezone.utc).isoformat()


def _now_kst() -> str:
    return datetime.now(KST).isoformat()


def _today_kst() -> str:
    return datetime.now(KST).strftime("%Y-%m-%d")


def _resolve_office(office_id: Optional[str]) -> Optional[dict]:
    if not office_id:
        return None
    table = get_offices_table()
    resp = table.get_item(Key={"office_id": office_id})
    return resp.get("Item")


def update_presence(user_id: str, status: str, office_id: Optional[str],
                    detection_method: str, wifi_ssid: Optional[str] = None) -> dict:
    table = get_presence_table()

    office_name = None
    resolved_office_id = office_id

    if wifi_ssid and not office_id:
        offices = get_offices_table()
        resp = offices.scan(
            FilterExpression=Attr("is_active").eq(True)
        )
        for office in resp.get("Items", []):
            ssids = office.get("wifi_ssids", [])
            if wifi_ssid in ssids:
                resolved_office_id = office["office_id"]
                office_name = office.get("name")
                break

    if resolved_office_id and not office_name:
        office = _resolve_office(resolved_office_id)
        if office:
            office_name = office.get("name")

    now = _now_utc()
    ttl = int(time.time()) + TTL_SECONDS

    item = {
        "user_id": user_id,
        "status": status,
        "detection_method": detection_method,
        "last_updated": now,
        "ttl": ttl,
    }
    if resolved_office_id:
        item["office_id"] = resolved_office_id
    if office_name:
        item["office_name"] = office_name

    table.put_item(Item=item)

    _update_attendance(user_id, status, detection_method, resolved_office_id)

    return item


def set_manual_status(user_id: str, status: str, manual_note: Optional[str]) -> dict:
    table = get_presence_table()
    now = _now_utc()
    ttl = int(time.time()) + TTL_SECONDS

    item = {
        "user_id": user_id,
        "status": status,
        "detection_method": "manual",
        "manual_note": manual_note or "",
        "last_updated": now,
        "ttl": ttl,
    }
    table.put_item(Item=item)

    _update_attendance(user_id, status, "manual", None)

    return item


def get_user_presence(user_id: str) -> Optional[dict]:
    table = get_presence_table()
    resp = table.get_item(Key={"user_id": user_id})
    return resp.get("Item")


def get_all_presence() -> list:
    table = get_presence_table()
    resp = table.scan()
    return resp.get("Items", [])


def get_active_offices() -> list:
    table = get_offices_table()
    resp = table.scan(
        FilterExpression=Attr("is_active").eq(True)
    )
    return resp.get("Items", [])


def _update_attendance(user_id: str, status: str, method: str,
                       office_id: Optional[str]):
    """Update attendance log: create check-in on first IN_OFFICE/IN_BUILDING,
    update check-out on OFF_DUTY/OUT_OF_OFFICE transitions."""
    table = get_attendance_table()
    today = _today_kst()
    now_kst = _now_kst()

    resp = table.get_item(Key={"user_id": user_id, "date": today})
    existing = resp.get("Item")

    history_entry = {
        "status": status,
        "timestamp": now_kst,
        "method": method,
    }

    if not existing:
        if status in ("IN_OFFICE", "IN_BUILDING"):
            item = {
                "user_id": user_id,
                "date": today,
                "check_in": now_kst,
                "check_in_method": method,
                "office_id": office_id or "",
                "status_history": [history_entry],
                "created_at": _now_utc(),
            }
            table.put_item(Item=item)
    else:
        update_expr = "SET status_history = list_append(if_not_exists(status_history, :empty), :entry)"
        expr_values = {
            ":entry": [history_entry],
            ":empty": [],
        }

        if status == "OFF_DUTY":
            update_expr += ", check_out = :co, check_out_method = :com"
            expr_values[":co"] = now_kst
            expr_values[":com"] = method
        elif status in ("IN_OFFICE", "IN_BUILDING") and not existing.get("check_in"):
            update_expr += ", check_in = :ci, check_in_method = :cim"
            expr_values[":ci"] = now_kst
            expr_values[":cim"] = method
            if office_id:
                update_expr += ", office_id = :oid"
                expr_values[":oid"] = office_id

        table.update_item(
            Key={"user_id": user_id, "date": today},
            UpdateExpression=update_expr,
            ExpressionAttributeValues=expr_values,
        )
