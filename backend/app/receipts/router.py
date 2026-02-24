import io
from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from PIL import Image
from app.auth.dependencies import get_current_user
from app.receipts.gemini_service import analyze_receipt_image
from app.receipts.s3_service import upload_image_to_s3, get_presigned_url

router = APIRouter(prefix="/api/receipts", tags=["receipts"])

MAX_IMAGE_SIZE = 1280
JPEG_QUALITY = 75


def compress_image(image_bytes: bytes) -> bytes:
    img = Image.open(io.BytesIO(image_bytes))
    if img.mode in ("RGBA", "P"):
        img = img.convert("RGB")

    w, h = img.size
    if max(w, h) > MAX_IMAGE_SIZE:
        ratio = MAX_IMAGE_SIZE / max(w, h)
        new_w, new_h = int(w * ratio), int(h * ratio)
        img = img.resize((new_w, new_h), Image.LANCZOS)

    # EXIF orientation 처리
    try:
        import piexif
        exif = piexif.load(img.info.get("exif", b""))
        orientation = exif.get("0th", {}).get(piexif.ImageIFD.Orientation, 1)
        rotation_map = {3: 180, 6: 270, 8: 90}
        if orientation in rotation_map:
            img = img.rotate(rotation_map[orientation], expand=True)
    except Exception:
        pass

    output = io.BytesIO()
    img.save(output, format="JPEG", quality=JPEG_QUALITY, optimize=True)
    return output.getvalue()


@router.post("/analyze")
async def analyze_receipt(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user),
):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="이미지 파일만 업로드 가능합니다.")

    image_bytes = await file.read()
    if len(image_bytes) > 10 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="파일 크기는 10MB 이하이어야 합니다.")

    compressed = compress_image(image_bytes)

    image_key = upload_image_to_s3(compressed, current_user["user_id"])

    extracted = analyze_receipt_image(compressed)

    presigned_url = get_presigned_url(image_key)

    return {
        "image_key": image_key,
        "image_url": presigned_url,
        "extracted": extracted,
        "compressed_size_kb": round(len(compressed) / 1024, 1),
        "original_size_kb": round(len(image_bytes) / 1024, 1),
    }


@router.get("/image-url/{image_key:path}")
async def get_image_url(
    image_key: str,
    current_user: dict = Depends(get_current_user),
):
    url = get_presigned_url(image_key)
    return {"url": url}
