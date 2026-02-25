import json
import re
from google import genai
from google.genai import types
from app.config import get_settings

RECEIPT_PROMPT = """
다음 이미지를 분석하여 카드 결제 정보를 JSON으로 추출하세요.

이 이미지는 다음 중 하나일 수 있습니다:
- 종이 영수증 (식당, 마트, 주유소, 주차장 등)
- 키오스크 결제 화면 사진
- 태블릿/스마트폰 주문·결제 화면
- 카드 단말기 화면
- 기타 결제 완료를 나타내는 모든 화면

어떤 형태든 아래 필드를 최대한 추출하세요.
추출할 수 없는 필드는 null로 표시합니다.
금액은 숫자만 (쉼표, 원 기호 제외).
날짜/시간이 없으면 null.

{
  "approval_number": "카드 승인번호 (숫자 또는 영숫자, 없으면 null)",
  "store_name": "상호명 또는 브랜드명 (키오스크라면 해당 매장명)",
  "total_amount": 총결제금액숫자,
  "transaction_date": "YYYY-MM-DD HH:mm 형식 (알 수 없으면 null)",
  "card_last4": "카드 뒤 4자리 숫자 (없으면 null)",
  "receipt_type": "RECEIPT | KIOSK | TABLET | SCREEN | UNKNOWN 중 하나",
  "order_details": [
    {"item": "상품/메뉴명", "quantity": 수량숫자, "price": 단가숫자}
  ]
}

주의사항:
- 주문 내역(order_details)에는 합계, 부가세, 봉사료, 할인 행 제외하고 실제 상품/메뉴만 포함
- 수량이 보이지 않으면 1로 기록
- 단가가 보이지 않으면 null 대신 0으로 기록
- 키오스크나 화면 사진도 동일하게 처리

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
            "receipt_type": "UNKNOWN",
            "order_details": [],
            "error": "GEMINI_API_KEY가 설정되지 않았습니다.",
        }

    client = genai.Client(api_key=settings.gemini_api_key)

    image_part = types.Part.from_bytes(data=image_bytes, mime_type=mime_type)
    response = client.models.generate_content(
        model=settings.gemini_model,
        contents=[RECEIPT_PROMPT, image_part],
    )

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
        result.setdefault("receipt_type", "UNKNOWN")
        result.setdefault("order_details", [])
        return result
    except json.JSONDecodeError:
        return {
            "approval_number": None,
            "store_name": None,
            "total_amount": None,
            "transaction_date": None,
            "card_last4": None,
            "receipt_type": "UNKNOWN",
            "order_details": [],
            "raw_text": raw_text,
            "error": "JSON 파싱 실패",
        }
