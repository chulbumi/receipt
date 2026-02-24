import os
from functools import lru_cache
from pydantic_settings import BaseSettings
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), "../../.env"))


class Settings(BaseSettings):
    aws_region: str = "ap-northeast-2"
    aws_account_id: str = "493162620368"

    s3_images_bucket: str = "receipt-images-493162620368"
    s3_frontend_bucket: str = "receipt-frontend-493162620368"

    dynamodb_users_table: str = "receipt_users"
    dynamodb_records_table: str = "receipt_records"
    dynamodb_cards_table: str = "receipt_cards"

    jwt_secret_key: str = "changeme"
    jwt_algorithm: str = "HS256"
    jwt_expiration_hours: int = 24
    jwt_refresh_expiration_days: int = 30

    gemini_api_key: str = ""
    gemini_model: str = "gemini-2.0-flash-lite"

    admin_user_id: str = "admin"
    admin_password: str = "admin1234"
    admin_name: str = "시스템관리자"

    class Config:
        env_file = "../../.env"
        env_file_encoding = "utf-8"
        extra = "ignore"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
