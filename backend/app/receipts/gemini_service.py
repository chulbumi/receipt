import json
import re
import google.generativeai as genai
from app.config import get_settings

RECEIPT_PROMPT = """
다음 영수증 이미지를 분석하여 아래 JSON 형식으로 정보를 추출해주세요.
추출할 수 없는 필드는 null로 표시합니다.
금액은 숫자만 (쉼표, 원 기호 제외).

{
  "approval_number": "카드 승인번호 (숫자/영문)",
  "store_name": "상호명",
  "total_amount": 총결제금액숫자,
  "transaction_date": "YYYY-MM-DD HH:mm",
  "card_last4": "카드 뒷4자리",
  "order_details": [
    {"item": "메뉴/상품명", "quantity": 수량숫자, "price": 단가숫자}
  ]
}

반드시 JSON만 응답하세요. 마크다운 코드블록(```) 없이 순수 JSON만 출력하세요.
"""


def analyze_receipt_image(image_bytes: bytes, mime_type: str = "image/jpeg") -> dict:
    settings = get_settings()
    if not settings.gemini_api_key or settings.gemini_api_key == "CHANGE_ME_YOUR_GEMINI_API_KEY":
        return {
            "approval_number": None,
            "store_name": "Gemini API 키 미설정",
            "total_amount": None,
            "transaction_date": None,
            "card_last4": None,
            "order_details": [],
            "error": "GEMINI_API_KEY가 설정되지 않았습니다.",
        }

    genai.configure(api_key=settings.gemini_api_key)
    model = genai.GenerativeModel(settings.gemini_model)

    image_part = {"mime_type": mime_type, "data": image_bytes}
    response = model.generate_content([RECEIPT_PROMPT, image_part])

    raw_text = response.text.strip()
    raw_text = re.sub(r"^```(?:json)?\s*", "", raw_text)
    raw_text = re.sub(r"\s*```$", "", raw_text)

    try:
        result = json.loads(raw_text)
        result.setdefault("approval_number", None)
        result.setdefault("store_name", None)
        result.setdefault("total_amount", None)
        result.setdefault("transaction_date", None)
        result.setdefault("card_last4", None)
        result.setdefault("order_details", [])
        return result
    except json.JSONDecodeError:
        return {
            "approval_number": None,
            "store_name": None,
            "total_amount": None,
            "transaction_date": None,
            "card_last4": None,
            "order_details": [],
            "raw_text": raw_text,
            "error": "JSON 파싱 실패",
        }
