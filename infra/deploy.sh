#!/bin/bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$SCRIPT_DIR/.."
ENV_FILE="$ROOT_DIR/.env"

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
ACCOUNT_ID="${AWS_ACCOUNT_ID:-493162620368}"
IMAGES_BUCKET="${S3_IMAGES_BUCKET:-receipt-images-$ACCOUNT_ID}"
FRONTEND_BUCKET="${S3_FRONTEND_BUCKET:-receipt-frontend-$ACCOUNT_ID}"
JWT_SECRET="${JWT_SECRET_KEY:-changeme}"
GEMINI_KEY="${GEMINI_API_KEY:-}"
ADMIN_PW="${ADMIN_PASSWORD:-admin1234!}"

SAM_BUCKET="receipt-sam-artifacts-$ACCOUNT_ID"

echo "============================================"
echo " 영수증 관리 시스템 배포 시작"
echo "============================================"
echo "리전: $REGION"
echo "계정 ID: $ACCOUNT_ID"
echo ""

# ---- 1. SAM 아티팩트 버킷 생성 ----
echo "[1/6] SAM 아티팩트 버킷 확인..."
if ! aws s3api head-bucket --bucket "$SAM_BUCKET" 2>/dev/null; then
  aws s3api create-bucket --bucket "$SAM_BUCKET" --region "$REGION" \
    --create-bucket-configuration LocationConstraint="$REGION"
  echo "  -> SAM 버킷 생성: $SAM_BUCKET"
fi

# ---- 2. 백엔드 Python 의존성 설치 ----
echo "[2/6] 백엔드 의존성 설치..."
cd "$ROOT_DIR/backend"
pip3 install -r requirements.txt -t ./dependencies --quiet
echo "  -> 완료"

# ---- 3. SAM 빌드 및 패키징 ----
echo "[3/6] SAM 패키징..."
# SAM이 없는 경우 pip로 Lambda 패키지를 수동 생성
LAMBDA_PKG_DIR="/tmp/receipt-lambda-pkg"
rm -rf "$LAMBDA_PKG_DIR"
mkdir -p "$LAMBDA_PKG_DIR"

# 의존성 복사
cp -r ./dependencies/* "$LAMBDA_PKG_DIR/" 2>/dev/null || true
# 앱 코드 복사
cp -r ./app "$LAMBDA_PKG_DIR/"

# 패키지 생성
cd "$LAMBDA_PKG_DIR"
zip -r /tmp/receipt-lambda.zip . -q
echo "  -> Lambda 패키지 생성: /tmp/receipt-lambda.zip ($(du -sh /tmp/receipt-lambda.zip | cut -f1))"

# ---- 4. Lambda 함수 배포 ----
echo "[4/6] Lambda 함수 배포..."
cd "$ROOT_DIR"

# Lambda 실행 Role 확인/생성
ROLE_NAME="receipt-lambda-role"
ROLE_ARN=$(aws iam get-role --role-name "$ROLE_NAME" --query 'Role.Arn' --output text 2>/dev/null || echo "")

if [ -z "$ROLE_ARN" ]; then
  echo "  -> IAM Role 생성 중..."
  ROLE_ARN=$(aws iam create-role \
    --role-name "$ROLE_NAME" \
    --assume-role-policy-document '{
      "Version": "2012-10-17",
      "Statement": [{
        "Effect": "Allow",
        "Principal": {"Service": "lambda.amazonaws.com"},
        "Action": "sts:AssumeRole"
      }]
    }' \
    --query 'Role.Arn' --output text)

  aws iam attach-role-policy --role-name "$ROLE_NAME" \
    --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
  aws iam attach-role-policy --role-name "$ROLE_NAME" \
    --policy-arn arn:aws:iam::aws:policy/AmazonDynamoDBFullAccess
  aws iam attach-role-policy --role-name "$ROLE_NAME" \
    --policy-arn arn:aws:iam::aws:policy/AmazonS3FullAccess

  echo "  -> IAM Role 생성: $ROLE_ARN"
  echo "  -> Role 활성화 대기 (10초)..."
  sleep 10
fi

echo "  -> IAM Role: $ROLE_ARN"

# Lambda 함수 생성 또는 업데이트
FUNCTION_NAME="receipt-api"
EXISTING=$(aws lambda get-function --function-name "$FUNCTION_NAME" --region "$REGION" 2>/dev/null || echo "")

# S3를 통해 Lambda 코드 업로드 (50MB 직접 업로드 제한 우회)
LAMBDA_S3_KEY="lambda/receipt-lambda.zip"
echo "  -> Lambda 패키지를 S3에 업로드 중..."
aws s3 cp /tmp/receipt-lambda.zip "s3://$SAM_BUCKET/$LAMBDA_S3_KEY" --region "$REGION"
echo "  -> S3 업로드 완료"

ENV_VARS="Variables={DYNAMODB_USERS_TABLE=${DYNAMODB_USERS_TABLE:-receipt_users},DYNAMODB_RECORDS_TABLE=${DYNAMODB_RECORDS_TABLE:-receipt_records},DYNAMODB_CARDS_TABLE=${DYNAMODB_CARDS_TABLE:-receipt_cards},S3_IMAGES_BUCKET=$IMAGES_BUCKET,JWT_SECRET_KEY=$JWT_SECRET,JWT_ALGORITHM=HS256,JWT_EXPIRATION_HOURS=24,JWT_REFRESH_EXPIRATION_DAYS=30,GEMINI_API_KEY=$GEMINI_KEY,GEMINI_MODEL=gemini-2.0-flash-lite,AWS_REGION_NAME=$REGION}"

if [ -z "$EXISTING" ]; then
  echo "  -> Lambda 함수 생성 중..."
  aws lambda create-function \
    --function-name "$FUNCTION_NAME" \
    --runtime python3.11 \
    --role "$ROLE_ARN" \
    --handler app.main.handler \
    --code "S3Bucket=$SAM_BUCKET,S3Key=$LAMBDA_S3_KEY" \
    --timeout 60 \
    --memory-size 512 \
    --region "$REGION" \
    --environment "$ENV_VARS" \
    --output text --query 'FunctionArn'
  echo "  -> Lambda 함수 생성 완료"
else
  echo "  -> Lambda 코드 업데이트..."
  aws lambda update-function-code \
    --function-name "$FUNCTION_NAME" \
    --s3-bucket "$SAM_BUCKET" \
    --s3-key "$LAMBDA_S3_KEY" \
    --region "$REGION" --output text --query 'FunctionArn'

  echo "  -> Lambda 업데이트 대기..."
  aws lambda wait function-updated --function-name "$FUNCTION_NAME" --region "$REGION" 2>/dev/null || sleep 5

  echo "  -> Lambda 환경변수 업데이트..."
  aws lambda update-function-configuration \
    --function-name "$FUNCTION_NAME" \
    --environment "$ENV_VARS" \
    --region "$REGION" --output text --query 'FunctionArn'
fi

# Lambda 활성화 대기
echo "  -> Lambda 완료 대기..."
aws lambda wait function-updated --function-name "$FUNCTION_NAME" --region "$REGION" 2>/dev/null || sleep 5

# ---- 5. API Gateway 설정 ----
echo "[5/6] API Gateway 설정..."
API_ID=$(aws apigateway get-rest-apis --region "$REGION" \
  --query "items[?name=='receipt-api'].id | [0]" --output text 2>/dev/null)

if [ -z "$API_ID" ] || [ "$API_ID" = "None" ]; then
  echo "  -> API Gateway 생성 중..."
  API_ID=$(aws apigateway create-rest-api \
    --name "receipt-api" \
    --description "영수증 관리 시스템 API" \
    --region "$REGION" \
    --query 'id' --output text)
  echo "  -> API ID: $API_ID"

  # Root 리소스 가져오기
  ROOT_ID=$(aws apigateway get-resources --rest-api-id "$API_ID" --region "$REGION" \
    --query 'items[?path==`/`].id | [0]' --output text)

  # {proxy+} 리소스 생성
  PROXY_ID=$(aws apigateway create-resource \
    --rest-api-id "$API_ID" \
    --parent-id "$ROOT_ID" \
    --path-part '{proxy+}' \
    --region "$REGION" \
    --query 'id' --output text)

  LAMBDA_ARN="arn:aws:lambda:$REGION:$ACCOUNT_ID:function:$FUNCTION_NAME"

  # ANY 메서드 생성 (proxy)
  aws apigateway put-method \
    --rest-api-id "$API_ID" \
    --resource-id "$PROXY_ID" \
    --http-method ANY \
    --authorization-type NONE \
    --region "$REGION" > /dev/null

  aws apigateway put-integration \
    --rest-api-id "$API_ID" \
    --resource-id "$PROXY_ID" \
    --http-method ANY \
    --type AWS_PROXY \
    --integration-http-method POST \
    --uri "arn:aws:apigateway:$REGION:lambda:path/2015-03-31/functions/$LAMBDA_ARN/invocations" \
    --region "$REGION" > /dev/null

  # Root ANY 메서드
  aws apigateway put-method \
    --rest-api-id "$API_ID" \
    --resource-id "$ROOT_ID" \
    --http-method ANY \
    --authorization-type NONE \
    --region "$REGION" > /dev/null

  aws apigateway put-integration \
    --rest-api-id "$API_ID" \
    --resource-id "$ROOT_ID" \
    --http-method ANY \
    --type AWS_PROXY \
    --integration-http-method POST \
    --uri "arn:aws:apigateway:$REGION:lambda:path/2015-03-31/functions/$LAMBDA_ARN/invocations" \
    --region "$REGION" > /dev/null

  # Lambda 권한 부여
  aws lambda add-permission \
    --function-name "$FUNCTION_NAME" \
    --statement-id "apigateway-invoke" \
    --action "lambda:InvokeFunction" \
    --principal "apigateway.amazonaws.com" \
    --source-arn "arn:aws:execute-api:$REGION:$ACCOUNT_ID:$API_ID/*/*" \
    --region "$REGION" > /dev/null

  # 배포
  aws apigateway create-deployment \
    --rest-api-id "$API_ID" \
    --stage-name "prod" \
    --region "$REGION" > /dev/null

  echo "  -> API Gateway 생성 및 배포 완료"
else
  echo "  -> 기존 API Gateway 재배포: $API_ID"
  aws apigateway create-deployment \
    --rest-api-id "$API_ID" \
    --stage-name "prod" \
    --region "$REGION" > /dev/null
fi

API_URL="https://$API_ID.execute-api.$REGION.amazonaws.com/prod"
echo "  -> API URL: $API_URL"

# .env 업데이트
sed -i "s|VITE_API_BASE_URL=.*|VITE_API_BASE_URL=$API_URL|g" "$ROOT_DIR/.env"
sed -i "s|VITE_API_BASE_URL=.*|VITE_API_BASE_URL=$API_URL|g" "$ROOT_DIR/frontend/.env"

# ---- 6. 프론트엔드 빌드 및 배포 ----
echo "[6/6] 프론트엔드 빌드 및 S3 배포..."
cd "$ROOT_DIR/frontend"

# .env 반영
echo "VITE_API_BASE_URL=$API_URL" > .env
echo "VITE_APP_NAME=영수증 관리" >> .env

npm run build 2>&1 | tail -5

# S3 업로드
aws s3 sync dist/ "s3://$FRONTEND_BUCKET/" --delete --region "$REGION"
echo "  -> S3 업로드 완료"

# CloudFront 확인/생성
CF_ID=$(aws cloudfront list-distributions \
  --query "DistributionList.Items[?Origins.Items[0].DomainName=='$FRONTEND_BUCKET.s3.$REGION.amazonaws.com'].Id | [0]" \
  --output text 2>/dev/null)

if [ -z "$CF_ID" ] || [ "$CF_ID" = "None" ]; then
  echo "  -> CloudFront 배포 생성 중..."

  # OAC 생성
  OAC_ID=$(aws cloudfront create-origin-access-control \
    --origin-access-control-config '{
      "Name": "receipt-frontend-oac",
      "Description": "OAC for receipt frontend",
      "SigningProtocol": "sigv4",
      "SigningBehavior": "always",
      "OriginAccessControlOriginType": "s3"
    }' \
    --query 'OriginAccessControl.Id' --output text 2>/dev/null || echo "")

  CF_DIST=$(aws cloudfront create-distribution \
    --distribution-config "{
      \"CallerReference\": \"receipt-$(date +%s)\",
      \"Comment\": \"영수증 관리 시스템\",
      \"DefaultRootObject\": \"index.html\",
      \"Origins\": {
        \"Quantity\": 1,
        \"Items\": [{
          \"Id\": \"S3-$FRONTEND_BUCKET\",
          \"DomainName\": \"$FRONTEND_BUCKET.s3.$REGION.amazonaws.com\",
          \"S3OriginConfig\": {\"OriginAccessIdentity\": \"\"},
          \"OriginAccessControlId\": \"${OAC_ID:-}\"
        }]
      },
      \"DefaultCacheBehavior\": {
        \"TargetOriginId\": \"S3-$FRONTEND_BUCKET\",
        \"ViewerProtocolPolicy\": \"redirect-to-https\",
        \"AllowedMethods\": {\"Quantity\": 2, \"Items\": [\"GET\",\"HEAD\"]},
        \"CachePolicyId\": \"658327ea-f89d-4fab-a63d-7e88639e58f6\",
        \"Compress\": true
      },
      \"CustomErrorResponses\": {
        \"Quantity\": 1,
        \"Items\": [{
          \"ErrorCode\": 403,
          \"ResponsePagePath\": \"/index.html\",
          \"ResponseCode\": \"200\",
          \"ErrorCachingMinTTL\": 0
        }]
      },
      \"Enabled\": true,
      \"HttpVersion\": \"http2\",
      \"PriceClass\": \"PriceClass_200\"
    }" \
    --query 'Distribution.{Id:Id,Domain:DomainName}' --output json 2>/dev/null)

  CF_ID=$(echo "$CF_DIST" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('Id',''))" 2>/dev/null || echo "")
  CF_DOMAIN=$(echo "$CF_DIST" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('Domain',''))" 2>/dev/null || echo "")

  # S3 버킷 정책 업데이트 (OAC 허용)
  if [ -n "$OAC_ID" ]; then
    aws s3api put-bucket-policy --bucket "$FRONTEND_BUCKET" --policy "{
      \"Version\": \"2012-10-17\",
      \"Statement\": [{
        \"Effect\": \"Allow\",
        \"Principal\": {\"Service\": \"cloudfront.amazonaws.com\"},
        \"Action\": \"s3:GetObject\",
        \"Resource\": \"arn:aws:s3:::$FRONTEND_BUCKET/*\",
        \"Condition\": {
          \"StringEquals\": {
            \"AWS:SourceArn\": \"arn:aws:cloudfront::$ACCOUNT_ID:distribution/$CF_ID\"
          }
        }
      }]
    }" 2>/dev/null || true
  fi

  echo "  -> CloudFront 배포 생성: $CF_ID"
  echo "  -> CloudFront 도메인: https://$CF_DOMAIN"
  echo "  -> (배포 완료까지 약 5~15분 소요)"
else
  CF_DOMAIN=$(aws cloudfront get-distribution --id "$CF_ID" --query 'Distribution.DomainName' --output text 2>/dev/null || echo "")
  echo "  -> 기존 CloudFront: $CF_ID"
  # 캐시 무효화
  aws cloudfront create-invalidation --distribution-id "$CF_ID" --paths "/*" > /dev/null 2>&1 || true
  echo "  -> CloudFront 캐시 무효화 완료"
  echo "  -> 접속 URL: https://$CF_DOMAIN"
fi

echo ""
echo "============================================"
echo " 배포 완료!"
echo "============================================"
echo " API URL: $API_URL"
echo " 프론트 S3: s3://$FRONTEND_BUCKET"
[ -n "$CF_DOMAIN" ] && echo " 프론트 URL: https://$CF_DOMAIN"
echo ""
echo " 다음 단계:"
echo " 1. python3 backend/seed_admin.py  (관리자 계정 생성)"
echo " 2. .env 의 GEMINI_API_KEY 를 실제 키로 변경 후 재배포"
echo " 3. https://$CF_DOMAIN 에서 앱 접속"
echo "============================================"
