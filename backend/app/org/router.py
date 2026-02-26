import random
import string
import time
from datetime import datetime, timezone
from typing import List, Optional

from boto3.dynamodb.conditions import Key
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.auth.dependencies import get_admin_user, get_current_user
from app.db.dynamodb import get_dynamodb

router = APIRouter(prefix="/api/org", tags=["org"])

ORG_TABLE = "org_units"


def get_org_table():
    return get_dynamodb().Table(ORG_TABLE)


def make_org_id() -> str:
    ts = int(time.time())
    rand = "".join(random.choices(string.ascii_lowercase + string.digits, k=5))
    return f"org_{ts}_{rand}"


def now_utc() -> str:
    return datetime.now(timezone.utc).isoformat()


class OrgCreate(BaseModel):
    name: str
    leader_id: str
    member_ids: List[str] = []
    parent_org_id: str = "ROOT"
    order: int = 0


class OrgUpdate(BaseModel):
    name: Optional[str] = None
    leader_id: Optional[str] = None
    member_ids: Optional[List[str]] = None
    parent_org_id: Optional[str] = None
    order: Optional[int] = None


def _collect_descendants(table, org_id: str) -> set:
    """org_id 하위의 모든 자손 org_id를 수집합니다."""
    ids: set = set()
    queue = [org_id]
    while queue:
        current = queue.pop()
        resp = table.query(
            IndexName="parent_org_id-index",
            KeyConditionExpression=Key("parent_org_id").eq(current),
        )
        for item in resp.get("Items", []):
            if item["org_id"] not in ids:
                ids.add(item["org_id"])
                queue.append(item["org_id"])
    return ids


def _delete_recursive(table, org_id: str) -> int:
    """조직과 모든 하위 조직을 재귀적으로 삭제합니다."""
    resp = table.query(
        IndexName="parent_org_id-index",
        KeyConditionExpression=Key("parent_org_id").eq(org_id),
    )
    count = 0
    for child in resp.get("Items", []):
        count += _delete_recursive(table, child["org_id"])
    table.delete_item(Key={"org_id": org_id})
    return count + 1


@router.get("")
async def list_orgs(current_user: dict = Depends(get_current_user)):
    table = get_org_table()
    orgs: list = []
    resp = table.scan()
    orgs.extend(resp.get("Items", []))
    while "LastEvaluatedKey" in resp:
        resp = table.scan(ExclusiveStartKey=resp["LastEvaluatedKey"])
        orgs.extend(resp.get("Items", []))

    # number 필드 Decimal → int/float 변환
    for org in orgs:
        if "order" in org:
            org["order"] = int(org["order"])

    orgs.sort(key=lambda x: (x.get("parent_org_id", ""), x.get("order", 0)))
    return {"orgs": orgs, "count": len(orgs)}


@router.post("", status_code=201)
async def create_org(body: OrgCreate, current_user: dict = Depends(get_admin_user)):
    if not body.name.strip():
        raise HTTPException(status_code=400, detail="조직 이름을 입력해주세요.")

    # leader_id 유효성 확인
    from app.db.dynamodb import get_users_table
    users_table = get_users_table()
    leader = users_table.get_item(Key={"user_id": body.leader_id}).get("Item")
    if not leader:
        raise HTTPException(status_code=400, detail="존재하지 않는 수장 사용자입니다.")
    if leader.get("status") == "inactive":
        raise HTTPException(status_code=400, detail="비활성 사용자는 수장으로 지정할 수 없습니다.")

    table = get_org_table()
    member_ids = list(set([body.leader_id] + body.member_ids))
    org_id = make_org_id()
    item = {
        "org_id": org_id,
        "name": body.name.strip(),
        "leader_id": body.leader_id,
        "member_ids": member_ids,
        "parent_org_id": body.parent_org_id,
        "order": body.order,
        "created_at": now_utc(),
        "updated_at": now_utc(),
    }
    table.put_item(Item=item)
    return {"message": "조직이 생성되었습니다.", "org_id": org_id}


@router.put("/{org_id}")
async def update_org(org_id: str, body: OrgUpdate, current_user: dict = Depends(get_admin_user)):
    table = get_org_table()
    existing = table.get_item(Key={"org_id": org_id}).get("Item")
    if not existing:
        raise HTTPException(status_code=404, detail="조직을 찾을 수 없습니다.")

    # 순환 참조 방지
    if body.parent_org_id and body.parent_org_id not in ("ROOT", org_id):
        descendants = _collect_descendants(table, org_id)
        if body.parent_org_id in descendants:
            raise HTTPException(
                status_code=400,
                detail="순환 참조: 하위 조직을 상위로 지정할 수 없습니다.",
            )

    updates: dict = {k: v for k, v in body.dict().items() if v is not None}
    if not updates:
        return {"message": "변경할 내용이 없습니다."}

    # member_ids에 leader_id 포함 보장
    if "member_ids" in updates:
        leader = updates.get("leader_id", existing.get("leader_id", ""))
        updates["member_ids"] = list(set([leader] + updates["member_ids"]))

    updates["updated_at"] = now_utc()

    expr_parts, expr_vals, expr_names = [], {}, {}
    for i, (k, v) in enumerate(updates.items()):
        expr_parts.append(f"#f{i} = :v{i}")
        expr_names[f"#f{i}"] = k
        expr_vals[f":v{i}"] = v

    table.update_item(
        Key={"org_id": org_id},
        UpdateExpression="SET " + ", ".join(expr_parts),
        ExpressionAttributeNames=expr_names,
        ExpressionAttributeValues=expr_vals,
    )
    return {"message": "조직이 수정되었습니다."}


@router.delete("/{org_id}")
async def delete_org(org_id: str, current_user: dict = Depends(get_admin_user)):
    table = get_org_table()
    if not table.get_item(Key={"org_id": org_id}).get("Item"):
        raise HTTPException(status_code=404, detail="조직을 찾을 수 없습니다.")
    count = _delete_recursive(table, org_id)
    return {"message": "조직이 삭제되었습니다.", "deleted_count": count}
