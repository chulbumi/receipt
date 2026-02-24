import boto3
import uuid
from datetime import datetime, timezone
from app.config import get_settings


def get_s3_client():
    settings = get_settings()
    return boto3.client("s3", region_name=settings.aws_region)


def upload_image_to_s3(image_bytes: bytes, user_id: str, content_type: str = "image/jpeg") -> str:
    settings = get_settings()
    s3 = get_s3_client()
    now = datetime.now(timezone.utc)
    key = f"receipts/{now.strftime('%Y/%m/%d')}/{user_id}/{uuid.uuid4()}.jpg"
    s3.put_object(
        Bucket=settings.s3_images_bucket,
        Key=key,
        Body=image_bytes,
        ContentType=content_type,
    )
    return key


def get_presigned_url(image_key: str, expires_in: int = 3600) -> str:
    settings = get_settings()
    s3 = get_s3_client()
    url = s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.s3_images_bucket, "Key": image_key},
        ExpiresIn=expires_in,
    )
    return url


def delete_image_from_s3(image_key: str) -> None:
    settings = get_settings()
    s3 = get_s3_client()
    s3.delete_object(Bucket=settings.s3_images_bucket, Key=image_key)
