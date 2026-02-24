import uuid
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from boto3.dynamodb.conditions import Key, Attr
from app.auth.dependencies import get_current_user
from app.db.dynamodb import get_records_table
from app.receipts.s3_service import get_presigned_url, delete_image_from_s3
from decimal import Decimal

router = APIRouter(prefix="/api/records", tags=["records"])

CATEGORIES = [
    "LUNCH", "DINNER", "BEVERAGE", "ENTERTAINMENT",
    "PARKING", "TAXI", "RAIL", "TRANSPORT", "PURCHASE", "OTHER"
]


class Participant(BaseModel):
    user_id: str
    name: str
    amount: float


class OrderDetail(BaseModel):
    item: str
    quantity: int = 1
    price: float = 0


class CreateRecordRequest(BaseModel):
    category: str
    approval_number: Optional[str] = None
    store_name: Optional[str] = None
    total_amount: float
    transaction_date: str
    order_details: List[OrderDetail] = []
    image_key: Optional[str] = None
    participants: List[Participant] = []
    memo: Optional[str] = None
    card_last4: Optional[str] = None


class UpdateRecordRequest(BaseModel):
    category: Optional[str] = None
    store_name: Optional[str] = None
    total_amount: Optional[float] = None
    transaction_date: Optional[str] = None
    memo: Optional[str] = None
    participants: Optional[List[Participant]] = None


def to_decimal(val):
    if isinstance(val, float):
        return Decimal(str(val))
    if isinstance(val, list):
        return [to_decimal(v) for v in val]
    if isinstance(val, dict):
        return {k: to_decimal(v) for k, v in val.items()}
    return val


@router.post("", status_code=201)
async def create_record(req: CreateRecordRequest, current_user: dict = Depends(get_current_user)):
    if req.category not in CATEGORIES:
        raise HTTPException(status_code=400, detail=f"유효하지 않은 카테고리입니다. 허용: {CATEGORIES}")

    record_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    try:
        dt = datetime.strptime(req.transaction_date[:16], "%Y-%m-%d %H:%M")
    except ValueError:
        raise HTTPException(status_code=400, detail="transaction_date 형식: YYYY-MM-DD HH:MM")

    year_month = dt.strftime("%Y-%m")
    registered_by_date = f"{current_user['user_id']}#{dt.strftime('%Y-%m-%d')}"

    item = {
        "record_id": record_id,
        "registered_by": current_user["user_id"],
        "registered_by_name": current_user["name"],
        "category": req.category,
        "approval_number": req.approval_number,
        "store_name": req.store_name,
        "total_amount": to_decimal(req.total_amount),
        "transaction_date": req.transaction_date,
        "order_details": to_decimal([od.model_dump() for od in req.order_details]),
        "image_key": req.image_key,
        "participants": to_decimal([p.model_dump() for p in req.participants]),
        "memo": req.memo,
        "card_last4": req.card_last4,
        "created_at": now,
        "year_month": year_month,
        "registered_by_date": registered_by_date,
    }

    table = get_records_table()
    table.put_item(Item=item)
    return {"message": "등록되었습니다.", "record_id": record_id}


@router.get("/me")
async def get_my_records(
    current_user: dict = Depends(get_current_user),
    year_month: Optional[str] = Query(None, description="YYYY-MM"),
    category: Optional[str] = Query(None),
    limit: int = Query(50, le=200),
    last_key: Optional[str] = Query(None),
):
    table = get_records_table()
    kwargs: dict = {
        "IndexName": "registered_by-transaction_date-index",
        "KeyConditionExpression": Key("registered_by").eq(current_user["user_id"]),
        "Limit": limit,
        "ScanIndexForward": False,
    }
    if year_month:
        kwargs["KeyConditionExpression"] &= Key("transaction_date").begins_with(year_month)
    if category:
        kwargs["FilterExpression"] = Attr("category").eq(category)

    resp = table.query(**kwargs)
    items = resp.get("Items", [])

    for item in items:
        if item.get("image_key"):
            item["image_url"] = get_presigned_url(item["image_key"])
        _convert_decimal(item)

    return {
        "records": items,
        "count": len(items),
        "last_key": resp.get("LastEvaluatedKey"),
    }


@router.get("/calendar")
async def get_calendar_data(
    current_user: dict = Depends(get_current_user),
    year_month: str = Query(..., description="YYYY-MM"),
):
    table = get_records_table()
    resp = table.query(
        IndexName="year_month-registered_by_date-index",
        KeyConditionExpression=Key("year_month").eq(year_month)
        & Key("registered_by_date").begins_with(current_user["user_id"] + "#"),
    )
    items = resp.get("Items", [])

    daily: dict = {}
    for item in items:
        date_str = item["transaction_date"][:10]
        amt = float(item.get("total_amount", 0))
        participants = item.get("participants", [])

        my_amount = amt
        if participants:
            for p in participants:
                if p.get("user_id") == current_user["user_id"]:
                    my_amount = float(p.get("amount", 0))
                    break

        if date_str not in daily:
            daily[date_str] = {"date": date_str, "total": 0, "count": 0}
        daily[date_str]["total"] += my_amount
        daily[date_str]["count"] += 1

    return {
        "year_month": year_month,
        "daily": list(daily.values()),
        "monthly_total": sum(d["total"] for d in daily.values()),
    }


@router.get("/{record_id}")
async def get_record(record_id: str, current_user: dict = Depends(get_current_user)):
    table = get_records_table()
    resp = table.get_item(Key={"record_id": record_id})
    item = resp.get("Item")
    if not item:
        raise HTTPException(status_code=404, detail="내역을 찾을 수 없습니다.")
    if item["registered_by"] != current_user["user_id"] and current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="접근 권한이 없습니다.")
    if item.get("image_key"):
        item["image_url"] = get_presigned_url(item["image_key"])
    _convert_decimal(item)
    return item


@router.put("/{record_id}")
async def update_record(
    record_id: str,
    req: UpdateRecordRequest,
    current_user: dict = Depends(get_current_user),
):
    table = get_records_table()
    resp = table.get_item(Key={"record_id": record_id})
    item = resp.get("Item")
    if not item:
        raise HTTPException(status_code=404, detail="내역을 찾을 수 없습니다.")
    if item["registered_by"] != current_user["user_id"] and current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="수정 권한이 없습니다.")

    updates = {}
    if req.category is not None:
        updates["category"] = req.category
    if req.store_name is not None:
        updates["store_name"] = req.store_name
    if req.total_amount is not None:
        updates["total_amount"] = to_decimal(req.total_amount)
    if req.transaction_date is not None:
        updates["transaction_date"] = req.transaction_date
    if req.memo is not None:
        updates["memo"] = req.memo
    if req.participants is not None:
        updates["participants"] = to_decimal([p.model_dump() for p in req.participants])

    if not updates:
        return {"message": "변경 사항 없음"}

    expr = "SET " + ", ".join(f"#{k} = :{k}" for k in updates)
    names = {f"#{k}": k for k in updates}
    values = {f":{k}": v for k, v in updates.items()}

    table.update_item(
        Key={"record_id": record_id},
        UpdateExpression=expr,
        ExpressionAttributeNames=names,
        ExpressionAttributeValues=values,
    )
    return {"message": "수정되었습니다."}


@router.delete("/{record_id}")
async def delete_record(record_id: str, current_user: dict = Depends(get_current_user)):
    table = get_records_table()
    resp = table.get_item(Key={"record_id": record_id})
    item = resp.get("Item")
    if not item:
        raise HTTPException(status_code=404, detail="내역을 찾을 수 없습니다.")
    if item["registered_by"] != current_user["user_id"] and current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="삭제 권한이 없습니다.")
    if item.get("image_key"):
        try:
            delete_image_from_s3(item["image_key"])
        except Exception:
            pass
    table.delete_item(Key={"record_id": record_id})
    return {"message": "삭제되었습니다."}


def _convert_decimal(obj):
    from decimal import Decimal
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
