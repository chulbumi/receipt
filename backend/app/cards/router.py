import uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from boto3.dynamodb.conditions import Key
from decimal import Decimal
from app.auth.dependencies import get_current_user
from app.db.dynamodb import get_cards_table, get_records_table

router = APIRouter(prefix="/api/cards", tags=["cards"])


class CreateCardRequest(BaseModel):
    card_name: str
    card_last4: str
    monthly_limit: float = 0


class UpdateCardRequest(BaseModel):
    card_name: Optional[str] = None
    card_last4: Optional[str] = None
    monthly_limit: Optional[float] = None


@router.get("")
async def get_my_cards(current_user: dict = Depends(get_current_user)):
    table = get_cards_table()
    resp = table.query(
        IndexName="user_id-index",
        KeyConditionExpression=Key("user_id").eq(current_user["user_id"]),
    )
    cards = resp.get("Items", [])
    for c in cards:
        _convert_decimal(c)
    return {"cards": cards}


@router.post("", status_code=201)
async def create_card(req: CreateCardRequest, current_user: dict = Depends(get_current_user)):
    table = get_cards_table()
    card_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    item = {
        "card_id": card_id,
        "user_id": current_user["user_id"],
        "card_name": req.card_name,
        "card_last4": req.card_last4,
        "monthly_limit": Decimal(str(req.monthly_limit)),
        "created_at": now,
    }
    table.put_item(Item=item)
    return {"message": "법인카드가 등록되었습니다.", "card_id": card_id}


@router.put("/{card_id}")
async def update_card(
    card_id: str,
    req: UpdateCardRequest,
    current_user: dict = Depends(get_current_user),
):
    table = get_cards_table()
    resp = table.get_item(Key={"card_id": card_id})
    card = resp.get("Item")
    if not card:
        raise HTTPException(status_code=404, detail="카드를 찾을 수 없습니다.")
    if card["user_id"] != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="수정 권한이 없습니다.")

    updates = {}
    if req.card_name is not None:
        updates["card_name"] = req.card_name
    if req.card_last4 is not None:
        updates["card_last4"] = req.card_last4
    if req.monthly_limit is not None:
        updates["monthly_limit"] = Decimal(str(req.monthly_limit))

    if updates:
        expr = "SET " + ", ".join(f"#{k} = :{k}" for k in updates)
        table.update_item(
            Key={"card_id": card_id},
            UpdateExpression=expr,
            ExpressionAttributeNames={f"#{k}": k for k in updates},
            ExpressionAttributeValues={f":{k}": v for k, v in updates.items()},
        )
    return {"message": "카드 정보가 수정되었습니다."}


@router.delete("/{card_id}")
async def delete_card(card_id: str, current_user: dict = Depends(get_current_user)):
    table = get_cards_table()
    resp = table.get_item(Key={"card_id": card_id})
    card = resp.get("Item")
    if not card:
        raise HTTPException(status_code=404, detail="카드를 찾을 수 없습니다.")
    if card["user_id"] != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="삭제 권한이 없습니다.")
    table.delete_item(Key={"card_id": card_id})
    return {"message": "카드가 삭제되었습니다."}


@router.get("/{card_id}/summary")
async def get_card_summary(
    card_id: str,
    year_month: str = Query(..., description="YYYY-MM"),
    current_user: dict = Depends(get_current_user),
):
    table = get_cards_table()
    resp = table.get_item(Key={"card_id": card_id})
    card = resp.get("Item")
    if not card or card["user_id"] != current_user["user_id"]:
        raise HTTPException(status_code=404, detail="카드를 찾을 수 없습니다.")

    records_table = get_records_table()
    from boto3.dynamodb.conditions import Key as DKey, Attr
    rec_resp = records_table.query(
        IndexName="registered_by-transaction_date-index",
        KeyConditionExpression=DKey("registered_by").eq(current_user["user_id"])
        & DKey("transaction_date").begins_with(year_month),
        FilterExpression=Attr("card_last4").eq(card["card_last4"]),
    )
    records = rec_resp.get("Items", [])
    used = sum(float(r.get("total_amount", 0)) for r in records)
    limit = float(card.get("monthly_limit", 0))

    _convert_decimal(card)
    return {
        "card": card,
        "year_month": year_month,
        "used_amount": used,
        "monthly_limit": limit,
        "remaining": max(0, limit - used) if limit > 0 else None,
        "record_count": len(records),
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
