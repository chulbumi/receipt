from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from passlib.context import CryptContext
from boto3.dynamodb.conditions import Key, Attr
from decimal import Decimal
from datetime import datetime, timezone
from app.auth.dependencies import get_admin_user
from app.db.dynamodb import get_users_table, get_records_table
from app.receipts.s3_service import get_presigned_url

router = APIRouter(prefix="/api/admin", tags=["admin"])
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


class CreateUserRequest(BaseModel):
    user_id: str
    password: str
    name: str
    department: str = ""
    role: str = "user"


class UpdateUserRequest(BaseModel):
    name: Optional[str] = None
    department: Optional[str] = None
    role: Optional[str] = None
    status: Optional[str] = None  # "active" | "inactive" | "pending"
    password: Optional[str] = None


@router.get("/users")
async def list_users(
    admin: dict = Depends(get_admin_user),
    status: Optional[str] = Query(None, description="pending|active|inactive"),
):
    table = get_users_table()
    resp = table.scan(
        ProjectionExpression="user_id, #n, department, #r, #s, created_at, favorite_partners",
        ExpressionAttributeNames={"#n": "name", "#r": "role", "#s": "status"},
    )
    users = resp.get("Items", [])
    # status 미설정 기존 데이터는 active 처리
    for u in users:
        if "status" not in u:
            u["status"] = "active"
    if status:
        users = [u for u in users if u.get("status") == status]
    users.sort(key=lambda u: u.get("created_at", ""))
    return {"users": users, "count": len(users)}


@router.post("/users/{user_id}/approve")
async def approve_user(user_id: str, admin: dict = Depends(get_admin_user)):
    """가입 승인 (pending → active)"""
    table = get_users_table()
    existing = table.get_item(Key={"user_id": user_id}).get("Item")
    if not existing:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")
    table.update_item(
        Key={"user_id": user_id},
        UpdateExpression="SET #s = :s",
        ExpressionAttributeNames={"#s": "status"},
        ExpressionAttributeValues={":s": "active"},
    )
    return {"message": f"{user_id} 계정이 승인되었습니다."}


@router.post("/users/{user_id}/reject")
async def reject_user(user_id: str, admin: dict = Depends(get_admin_user)):
    """가입 반려 (pending → inactive)"""
    table = get_users_table()
    existing = table.get_item(Key={"user_id": user_id}).get("Item")
    if not existing:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")
    table.update_item(
        Key={"user_id": user_id},
        UpdateExpression="SET #s = :s",
        ExpressionAttributeNames={"#s": "status"},
        ExpressionAttributeValues={":s": "inactive"},
    )
    return {"message": f"{user_id} 가입이 반려되었습니다."}


@router.post("/users", status_code=201)
async def create_user(req: CreateUserRequest, admin: dict = Depends(get_admin_user)):
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
    return {"message": "사용자가 생성되었습니다.", "user_id": req.user_id}


@router.put("/users/{user_id}")
async def update_user(user_id: str, req: UpdateUserRequest, admin: dict = Depends(get_admin_user)):
    table = get_users_table()
    existing = table.get_item(Key={"user_id": user_id}).get("Item")
    if not existing:
        raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다.")

    updates = {}
    if req.name is not None:
        updates["name"] = req.name
    if req.department is not None:
        updates["department"] = req.department
    if req.role is not None:
        updates["role"] = req.role
    if req.status is not None:
        if req.status not in ("active", "inactive", "pending"):
            raise HTTPException(status_code=400, detail="유효하지 않은 status 값입니다.")
        updates["status"] = req.status
    if req.password is not None:
        updates["password_hash"] = pwd_context.hash(req.password)

    if updates:
        expr = "SET " + ", ".join(f"#{k} = :{k}" for k in updates)
        table.update_item(
            Key={"user_id": user_id},
            UpdateExpression=expr,
            ExpressionAttributeNames={f"#{k}": k for k in updates},
            ExpressionAttributeValues={f":{k}": v for k, v in updates.items()},
        )
    return {"message": "사용자 정보가 수정되었습니다."}


@router.get("/records")
async def list_all_records(
    admin: dict = Depends(get_admin_user),
    year_month: Optional[str] = Query(None, description="YYYY-MM"),
    user_id: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    limit: int = Query(100, le=500),
):
    table = get_records_table()
    if year_month:
        filter_expr = None
        if user_id:
            key_cond = Key("year_month").eq(year_month) & Key("registered_by_date").begins_with(user_id + "#")
        else:
            key_cond = Key("year_month").eq(year_month)
        if category:
            filter_expr = Attr("category").eq(category)
        kwargs = {
            "IndexName": "year_month-registered_by_date-index",
            "KeyConditionExpression": key_cond,
            "Limit": limit,
            "ScanIndexForward": False,
        }
        if filter_expr:
            kwargs["FilterExpression"] = filter_expr
        resp = table.query(**kwargs)
    else:
        filter_exprs = []
        if user_id:
            filter_exprs.append(Attr("registered_by").eq(user_id))
        if category:
            filter_exprs.append(Attr("category").eq(category))
        kwargs = {"Limit": limit}
        if filter_exprs:
            expr = filter_exprs[0]
            for fe in filter_exprs[1:]:
                expr = expr & fe
            kwargs["FilterExpression"] = expr
        resp = table.scan(**kwargs)

    items = resp.get("Items", [])
    for item in items:
        if item.get("image_key"):
            item["image_url"] = get_presigned_url(item["image_key"])
        _convert_decimal(item)

    return {"records": items, "count": len(items)}


@router.get("/reports/daily")
async def daily_report(
    admin: dict = Depends(get_admin_user),
    year_month: str = Query(..., description="YYYY-MM"),
):
    table = get_records_table()
    resp = table.query(
        IndexName="year_month-registered_by_date-index",
        KeyConditionExpression=Key("year_month").eq(year_month),
    )
    items = resp.get("Items", [])
    daily: dict = {}
    for item in items:
        date_str = item["transaction_date"][:10]
        amt = float(item.get("total_amount", 0))
        if date_str not in daily:
            daily[date_str] = {"date": date_str, "total": 0, "count": 0, "by_category": {}}
        daily[date_str]["total"] += amt
        daily[date_str]["count"] += 1
        cat = item.get("category", "OTHER")
        daily[date_str]["by_category"][cat] = daily[date_str]["by_category"].get(cat, 0) + amt

    return {
        "year_month": year_month,
        "daily": sorted(daily.values(), key=lambda x: x["date"]),
        "monthly_total": sum(d["total"] for d in daily.values()),
    }


@router.get("/reports/monthly")
async def monthly_report(
    admin: dict = Depends(get_admin_user),
    year: int = Query(...),
):
    table = get_records_table()
    monthly: dict = {}
    for m in range(1, 13):
        ym = f"{year}-{m:02d}"
        resp = table.query(
            IndexName="year_month-registered_by_date-index",
            KeyConditionExpression=Key("year_month").eq(ym),
        )
        items = resp.get("Items", [])
        if items:
            total = sum(float(i.get("total_amount", 0)) for i in items)
            monthly[ym] = {"year_month": ym, "total": total, "count": len(items)}

    return {"year": year, "monthly": list(monthly.values())}


@router.get("/reports/users-summary")
async def users_summary_report(
    admin: dict = Depends(get_admin_user),
    year_month: str = Query(..., description="YYYY-MM"),
):
    """월별 전체 직원 식대 집계 — 참여자 기준 개인 부담액 합산"""
    records_table = get_records_table()
    users_table = get_users_table()

    # 해당 월 전체 영수증 조회
    resp = records_table.query(
        IndexName="year_month-registered_by_date-index",
        KeyConditionExpression=Key("year_month").eq(year_month),
    )
    all_items = resp.get("Items", [])

    # 직원별 집계 딕셔너리: {user_id: {amount, count, records}}
    user_stats: dict = {}

    def ensure_user(uid: str):
        if uid not in user_stats:
            user_stats[uid] = {"user_id": uid, "name": "", "department": "", "amount": 0.0, "count": 0}

    for item in all_items:
        total = float(item.get("total_amount", 0))
        registered_by = item["registered_by"]
        participants = item.get("participants", [])

        if participants:
            # 참여자가 기록된 경우 → 각자 부담액 사용
            for p in participants:
                uid = p.get("user_id", "")
                amt = float(p.get("amount", 0))
                if uid:
                    ensure_user(uid)
                    user_stats[uid]["amount"] += amt
                    user_stats[uid]["count"] += 1
        else:
            # 참여자 없음 → 등록자 전액 부담
            ensure_user(registered_by)
            user_stats[registered_by]["amount"] += total
            user_stats[registered_by]["count"] += 1

    if not user_stats:
        return {"year_month": year_month, "users": [], "total": 0}

    # 사용자 이름/부서 일괄 조회
    for uid in user_stats:
        try:
            u = users_table.get_item(
                Key={"user_id": uid},
                ProjectionExpression="user_id, #n, department",
                ExpressionAttributeNames={"#n": "name"},
            ).get("Item", {})
            user_stats[uid]["name"] = u.get("name", uid)
            user_stats[uid]["department"] = u.get("department", "")
        except Exception:
            user_stats[uid]["name"] = uid

    result = sorted(user_stats.values(), key=lambda x: -x["amount"])
    grand_total = sum(u["amount"] for u in result)

    return {
        "year_month": year_month,
        "users": result,
        "total": grand_total,
    }


@router.get("/reports/user/{user_id}")
async def user_report(
    user_id: str,
    admin: dict = Depends(get_admin_user),
    year_month: str = Query(..., description="YYYY-MM"),
):
    table = get_records_table()
    resp = table.query(
        IndexName="year_month-registered_by_date-index",
        KeyConditionExpression=Key("year_month").eq(year_month),
    )
    all_items = resp.get("Items", [])

    user_total = 0
    records_paid = []
    records_participated = []

    for item in all_items:
        participants = item.get("participants", [])
        if item["registered_by"] == user_id:
            amt = float(item.get("total_amount", 0))
            my_share = amt
            if participants:
                for p in participants:
                    if p.get("user_id") == user_id:
                        my_share = float(p.get("amount", 0))
                        break
            _convert_decimal(item)
            item["my_amount"] = my_share
            records_paid.append(item)
            user_total += my_share
        else:
            for p in participants:
                if p.get("user_id") == user_id:
                    my_share = float(p.get("amount", 0))
                    _convert_decimal(item)
                    item["my_amount"] = my_share
                    records_participated.append(item)
                    user_total += my_share
                    break

    users_table = get_users_table()
    user = users_table.get_item(
        Key={"user_id": user_id},
        ProjectionExpression="user_id, #n, department",
        ExpressionAttributeNames={"#n": "name"},
    ).get("Item", {})

    return {
        "user": user,
        "year_month": year_month,
        "total_amount": user_total,
        "records_paid": records_paid,
        "records_participated": records_participated,
    }


def _convert_decimal(obj):
    if isinstance(obj, dict):
        for k, v in obj.items():
            if isinstance(v, Decimal):
                obj[k] = float(v)
            elif isinstance(v, (dict, list)):
                _convert_decimal(v)
    elif isinstance(obj, list):
        for i, v in enumerate(obj):
            if isinstance(v, Decimal):
                obj[i] = float(v)
            elif isinstance(v, (dict, list)):
                _convert_decimal(v)
