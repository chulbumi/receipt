import boto3
from functools import lru_cache
from app.config import get_settings


@lru_cache()
def get_dynamodb():
    settings = get_settings()
    return boto3.resource("dynamodb", region_name=settings.aws_region)


def get_users_table():
    settings = get_settings()
    return get_dynamodb().Table(settings.dynamodb_users_table)


def get_records_table():
    settings = get_settings()
    return get_dynamodb().Table(settings.dynamodb_records_table)


def get_cards_table():
    settings = get_settings()
    return get_dynamodb().Table(settings.dynamodb_cards_table)


def get_presence_table():
    settings = get_settings()
    return get_dynamodb().Table(settings.dynamodb_presence_table)


def get_attendance_table():
    settings = get_settings()
    return get_dynamodb().Table(settings.dynamodb_attendance_table)


def get_offices_table():
    settings = get_settings()
    return get_dynamodb().Table(settings.dynamodb_offices_table)
