#!/bin/bash
set -e

# .env 로드
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
IMAGES_BUCKET="${S3_IMAGES_BUCKET:-receipt-images-493162620368}"
FRONTEND_BUCKET="${S3_FRONTEND_BUCKET:-receipt-frontend-493162620368}"

echo "===== S3 버킷 생성 시작 ====="
echo "리전: $REGION"
echo "이미지 버킷: $IMAGES_BUCKET"
echo "프론트 버킷: $FRONTEND_BUCKET"

# ---- 이미지 저장용 S3 버킷 ----
echo ""
echo "[1/2] 이미지 저장 버킷 생성: $IMAGES_BUCKET"
if aws s3api head-bucket --bucket "$IMAGES_BUCKET" 2>/dev/null; then
  echo "  -> 이미 존재합니다. 건너뜁니다."
else
  if [ "$REGION" = "us-east-1" ]; then
    aws s3api create-bucket --bucket "$IMAGES_BUCKET" --region "$REGION"
  else
    aws s3api create-bucket --bucket "$IMAGES_BUCKET" --region "$REGION" \
      --create-bucket-configuration LocationConstraint="$REGION"
  fi
  echo "  -> 생성 완료"
fi

# 퍼블릭 액세스 차단 (이미지는 presigned URL로만 접근)
aws s3api put-public-access-block \
  --bucket "$IMAGES_BUCKET" \
  --public-access-block-configuration \
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
echo "  -> 퍼블릭 액세스 차단 설정 완료"

# CORS 설정 (API Gateway에서 presigned URL 사용)
aws s3api put-bucket-cors --bucket "$IMAGES_BUCKET" --cors-configuration '{
  "CORSRules": [
    {
      "AllowedHeaders": ["*"],
      "AllowedMethods": ["GET", "PUT", "POST", "DELETE", "HEAD"],
      "AllowedOrigins": ["*"],
      "ExposeHeaders": ["ETag"],
      "MaxAgeSeconds": 3000
    }
  ]
}'
echo "  -> CORS 설정 완료"

# 수명 주기 정책 (미완성 멀티파트 업로드 자동 삭제)
aws s3api put-bucket-lifecycle-configuration --bucket "$IMAGES_BUCKET" \
  --lifecycle-configuration '{
    "Rules": [
      {
        "ID": "AbortIncompleteMultipartUpload",
        "Status": "Enabled",
        "AbortIncompleteMultipartUpload": {"DaysAfterInitiation": 1},
        "Filter": {"Prefix": ""}
      }
    ]
  }'
echo "  -> 수명주기 정책 설정 완료"

# ---- 프론트엔드 정적 호스팅용 S3 버킷 ----
echo ""
echo "[2/2] 프론트엔드 버킷 생성: $FRONTEND_BUCKET"
if aws s3api head-bucket --bucket "$FRONTEND_BUCKET" 2>/dev/null; then
  echo "  -> 이미 존재합니다. 건너뜁니다."
else
  if [ "$REGION" = "us-east-1" ]; then
    aws s3api create-bucket --bucket "$FRONTEND_BUCKET" --region "$REGION"
  else
    aws s3api create-bucket --bucket "$FRONTEND_BUCKET" --region "$REGION" \
      --create-bucket-configuration LocationConstraint="$REGION"
  fi
  echo "  -> 생성 완료"
fi

# 퍼블릭 액세스 차단 (CloudFront OAC로만 접근)
aws s3api put-public-access-block \
  --bucket "$FRONTEND_BUCKET" \
  --public-access-block-configuration \
    "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
echo "  -> 퍼블릭 액세스 차단 설정 완료"

echo ""
echo "===== S3 버킷 생성 완료 ====="
echo "이미지 버킷: s3://$IMAGES_BUCKET"
echo "프론트 버킷: s3://$FRONTEND_BUCKET"
