"""
카테고리 설정을 categories.json에서 읽어 제공하는 모듈.
Lambda 환경에서는 /var/task/categories.json 위치를 우선 탐색.
"""
import json
import os
from functools import lru_cache
from typing import List

SEARCH_PATHS = [
    os.path.join(os.path.dirname(__file__), "..", "..", "categories.json"),  # 로컬 개발: backend/../categories.json
    "/var/task/categories.json",  # Lambda: zip 루트
]


@lru_cache(maxsize=1)
def load_categories() -> List[dict]:
    for path in SEARCH_PATHS:
        resolved = os.path.normpath(path)
        if os.path.exists(resolved):
            with open(resolved, "r", encoding="utf-8") as f:
                return json.load(f)
    # 파일을 찾지 못한 경우 기본값 반환
    return [
        {"id": "LUNCH",         "label": "중식",   "icon": "🍱",  "description": "점심 식사",   "is_meal": True},
        {"id": "DINNER",        "label": "석식",   "icon": "🍽️", "description": "저녁 식사",   "is_meal": True},
        {"id": "BEVERAGE",      "label": "음료",   "icon": "☕",  "description": "커피·음료",   "is_meal": False},
        {"id": "ENTERTAINMENT", "label": "접대비", "icon": "🤝",  "description": "거래처 접대", "is_meal": True},
        {"id": "FUEL",          "label": "주유비", "icon": "⛽",  "description": "주유·충전",   "is_meal": False},
        {"id": "PURCHASE",      "label": "구매",   "icon": "🛒",  "description": "물품 구매",   "is_meal": False},
        {"id": "TAXI",          "label": "택시",   "icon": "🚕",  "description": "택시·승차",   "is_meal": False},
        {"id": "RAIL",          "label": "철도",   "icon": "🚆",  "description": "기차·KTX",   "is_meal": False},
        {"id": "TRANSPORT",     "label": "교통",   "icon": "🚌",  "description": "버스·지하철", "is_meal": False},
        {"id": "PARKING",       "label": "주차비", "icon": "🅿️", "description": "주차비",     "is_meal": False},
        {"id": "OTHER",         "label": "기타",   "icon": "📋",  "description": "기타",       "is_meal": False},
    ]


def get_valid_category_ids() -> List[str]:
    return [c["id"] for c in load_categories()]
