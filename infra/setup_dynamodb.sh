#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="$SCRIPT_DIR/../.env"
if [ -f "$ENV_FILE" ]; then
  while IFS='=' read -r key value; do
    [[ "$key" =~ ^#.*$ ]] && continue
    [[ -z "$key" ]] && continue
    key=$(echo "$key" | tr -d '[:space:]')
    [[ -z "$key" ]] && continue
    export "$key=$value"
  done < "$ENV_FILE"
fi

REGION="${AWS_REGION:-ap-northeast-2}"
USERS_TABLE="${DYNAMODB_USERS_TABLE:-receipt_users}"
RECORDS_TABLE="${DYNAMODB_RECORDS_TABLE:-receipt_records}"
CARDS_TABLE="${DYNAMODB_CARDS_TABLE:-receipt_cards}"

echo "===== DynamoDB 테이블 생성 시작 ====="
echo "리전: $REGION"

# ---- 1. receipt_users 테이블 ----
echo ""
echo "[1/3] 테이블 생성: $USERS_TABLE"
if aws dynamodb describe-table --table-name "$USERS_TABLE" --region "$REGION" 2>/dev/null | grep -q "TableName"; then
  echo "  -> 이미 존재합니다. 건너뜁니다."
else
  aws dynamodb create-table \
    --table-name "$USERS_TABLE" \
    --attribute-definitions \
      AttributeName=user_id,AttributeType=S \
    --key-schema \
      AttributeName=user_id,KeyType=HASH \
    --billing-mode PAY_PER_REQUEST \
    --region "$REGION"
  echo "  -> 생성 요청 완료. 활성화 대기 중..."
  aws dynamodb wait table-exists --table-name "$USERS_TABLE" --region "$REGION"
  echo "  -> 활성화 완료"
fi

# ---- 2. receipt_records 테이블 (GSI 포함) ----
echo ""
echo "[2/3] 테이블 생성: $RECORDS_TABLE"
if aws dynamodb describe-table --table-name "$RECORDS_TABLE" --region "$REGION" 2>/dev/null | grep -q "TableName"; then
  echo "  -> 이미 존재합니다. 건너뜁니다."
else
  aws dynamodb create-table \
    --table-name "$RECORDS_TABLE" \
    --attribute-definitions \
      AttributeName=record_id,AttributeType=S \
      AttributeName=year_month,AttributeType=S \
      AttributeName=registered_by_date,AttributeType=S \
      AttributeName=registered_by,AttributeType=S \
      AttributeName=transaction_date,AttributeType=S \
    --key-schema \
      AttributeName=record_id,KeyType=HASH \
    --global-secondary-indexes \
      '[
        {
          "IndexName": "year_month-registered_by_date-index",
          "KeySchema": [
            {"AttributeName": "year_month", "KeyType": "HASH"},
            {"AttributeName": "registered_by_date", "KeyType": "RANGE"}
          ],
          "Projection": {"ProjectionType": "ALL"}
        },
        {
          "IndexName": "registered_by-transaction_date-index",
          "KeySchema": [
            {"AttributeName": "registered_by", "KeyType": "HASH"},
            {"AttributeName": "transaction_date", "KeyType": "RANGE"}
          ],
          "Projection": {"ProjectionType": "ALL"}
        }
      ]' \
    --billing-mode PAY_PER_REQUEST \
    --region "$REGION"
  echo "  -> 생성 요청 완료. 활성화 대기 중..."
  aws dynamodb wait table-exists --table-name "$RECORDS_TABLE" --region "$REGION"
  echo "  -> 활성화 완료"
fi

# ---- 3. receipt_cards 테이블 ----
echo ""
echo "[3/3] 테이블 생성: $CARDS_TABLE"
if aws dynamodb describe-table --table-name "$CARDS_TABLE" --region "$REGION" 2>/dev/null | grep -q "TableName"; then
  echo "  -> 이미 존재합니다. 건너뜁니다."
else
  aws dynamodb create-table \
    --table-name "$CARDS_TABLE" \
    --attribute-definitions \
      AttributeName=card_id,AttributeType=S \
      AttributeName=user_id,AttributeType=S \
    --key-schema \
      AttributeName=card_id,KeyType=HASH \
    --global-secondary-indexes \
      '[
        {
          "IndexName": "user_id-index",
          "KeySchema": [
            {"AttributeName": "user_id", "KeyType": "HASH"}
          ],
          "Projection": {"ProjectionType": "ALL"}
        }
      ]' \
    --billing-mode PAY_PER_REQUEST \
    --region "$REGION"
  echo "  -> 생성 요청 완료. 활성화 대기 중..."
  aws dynamodb wait table-exists --table-name "$CARDS_TABLE" --region "$REGION"
  echo "  -> 활성화 완료"
fi

echo ""
echo "===== DynamoDB 테이블 생성 완료 ====="
echo "- $USERS_TABLE"
echo "- $RECORDS_TABLE (GSI: year_month, registered_by)"
echo "- $CARDS_TABLE (GSI: user_id)"
