"""
OCR text extraction from images.
Uses PaddleOCR if available, falls back to pytesseract.
Returns text regions with bounding boxes for SVG <text> element creation.
"""
import io
import numpy as np
import cv2


def extract_text(image_bytes: bytes) -> list[dict]:
    """
    Extract text from image.

    Returns:
        List of dicts: { text, bbox: [x, y, w, h], confidence }
    """
    try:
        return _extract_paddleocr(image_bytes)
    except ImportError:
        try:
            return _extract_tesseract(image_bytes)
        except ImportError:
            return []


def _extract_paddleocr(image_bytes: bytes) -> list[dict]:
    """Extract text using PaddleOCR."""
    from paddleocr import PaddleOCR

    arr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        return []

    ocr = PaddleOCR(use_angle_cls=True, lang='pt', show_log=False)
    results = ocr.ocr(img, cls=True)

    text_regions = []
    if results and results[0]:
        for line in results[0]:
            bbox_points = line[0]  # [[x1,y1],[x2,y2],[x3,y3],[x4,y4]]
            text = line[1][0]
            confidence = float(line[1][1])

            # Convert 4-point bbox to x, y, w, h
            xs = [p[0] for p in bbox_points]
            ys = [p[1] for p in bbox_points]
            x = min(xs)
            y = min(ys)
            w = max(xs) - x
            h = max(ys) - y

            text_regions.append({
                "text": text,
                "bbox": [round(x), round(y), round(w), round(h)],
                "confidence": round(confidence, 3),
            })

    return text_regions


def _extract_tesseract(image_bytes: bytes) -> list[dict]:
    """Extract text using pytesseract (fallback)."""
    import pytesseract
    from PIL import Image

    img = Image.open(io.BytesIO(image_bytes))
    data = pytesseract.image_to_data(img, output_type=pytesseract.Output.DICT)

    text_regions = []
    for i, text in enumerate(data['text']):
        text = text.strip()
        if not text or data['conf'][i] < 30:
            continue
        text_regions.append({
            "text": text,
            "bbox": [
                data['left'][i],
                data['top'][i],
                data['width'][i],
                data['height'][i],
            ],
            "confidence": round(float(data['conf'][i]) / 100, 3),
        })

    return text_regions
