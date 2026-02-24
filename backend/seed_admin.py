"""
초기 관리자 계정 생성 스크립트
실행: python seed_admin.py
"""
import sys
import os
sys.path.insert(0, os.path.dirname(__file__))

from dotenv import load_dotenv
load_dotenv(os.path.join(os.path.dirname(__file__), "../.env"))

import boto3
from passlib.context import CryptContext
from datetime import datetime, timezone

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

AWS_REGION = os.getenv("AWS_REGION", "ap-northeast-2")
USERS_TABLE = os.getenv("DYNAMODB_USERS_TABLE", "receipt_users")
ADMIN_USER_ID = os.getenv("ADMIN_USER_ID", "admin")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "admin1234!")
ADMIN_NAME = os.getenv("ADMIN_NAME", "시스템관리자")

dynamodb = boto3.resource("dynamodb", region_name=AWS_REGION)
table = dynamodb.Table(USERS_TABLE)

existing = table.get_item(Key={"user_id": ADMIN_USER_ID}).get("Item")
if existing:
    print(f"[INFO] 관리자 계정 '{ADMIN_USER_ID}' 이 이미 존재합니다.")
else:
    table.put_item(Item={
        "user_id": ADMIN_USER_ID,
        "name": ADMIN_NAME,
        "password_hash": pwd_context.hash(ADMIN_PASSWORD),
        "role": "admin",
        "department": "관리팀",
        "favorite_partners": [],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "is_active": True,
    })
    print(f"[OK] 관리자 계정 생성 완료: {ADMIN_USER_ID} / {ADMIN_PASSWORD}")
    print("[주의] 로그인 후 반드시 비밀번호를 변경하세요!")
