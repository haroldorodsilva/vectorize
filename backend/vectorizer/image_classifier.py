"""
Auto-detect image type and recommend vectorization settings.
Uses heuristics: color count, edge density, aspect ratio.
"""
import cv2
import numpy as np
from .config import VectorizerConfig


def classify_image(image_bytes: bytes) -> dict:
    """
    Analyze image and return type + recommended settings.

    Returns:
        {
            "type": "photo" | "icon" | "sketch" | "logo",
            "confidence": float,
            "recommended_mode": str,
            "recommended_settings": dict,
            "analysis": { color_count, edge_density, aspect_ratio, ... }
        }
    """
    arr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        return {"type": "unknown", "confidence": 0, "recommended_mode": "lineart",
                "recommended_settings": {}, "analysis": {}}

    h, w = img.shape[:2]
    aspect = w / max(h, 1)

    # Resize for analysis
    scale = 256 / max(w, h)
    small = cv2.resize(img, None, fx=scale, fy=scale)

    # 1. Count unique colors (quantized to reduce noise)
    quantized = (small // 32) * 32  # Reduce to ~8 levels per channel
    pixels = quantized.reshape(-1, 3)
    unique_colors = len(np.unique(pixels, axis=0))

    # 2. Edge density
    gray = cv2.cvtColor(small, cv2.COLOR_BGR2GRAY)
    edges = cv2.Canny(gray, 50, 150)
    edge_density = np.count_nonzero(edges) / edges.size

    # 3. Saturation analysis
    hsv = cv2.cvtColor(small, cv2.COLOR_BGR2HSV)
    mean_saturation = np.mean(hsv[:, :, 1])
    mean_value = np.mean(hsv[:, :, 2])

    # 4. Is mostly B&W?
    is_bw = mean_saturation < 30

    # Classification heuristics
    analysis = {
        "unique_colors": int(unique_colors),
        "edge_density": round(float(edge_density), 4),
        "mean_saturation": round(float(mean_saturation), 1),
        "mean_value": round(float(mean_value), 1),
        "aspect_ratio": round(float(aspect), 2),
        "is_bw": is_bw,
        "width": w,
        "height": h,
    }

    if is_bw and edge_density > 0.08:
        img_type = "sketch"
        mode = "lineart"
        confidence = 0.8
        settings = {"mode": "lineart", "threshold": 150, "dilate": 2, "minArea": 10}
    elif unique_colors < 50 and edge_density < 0.15:
        img_type = "icon"
        mode = "icon"
        confidence = 0.7
        settings = {"mode": "icon", "dilate": 2, "minArea": 20}
    elif unique_colors < 150 and edge_density > 0.05:
        img_type = "logo"
        mode = "vtracer"
        confidence = 0.6
        settings = {"mode": "vtracer", "vtColormode": "color", "vtColorPrecision": 4, "vtFilterSpeckle": 4}
    else:
        img_type = "photo"
        mode = "vtracer"
        confidence = 0.7
        settings = {"mode": "vtracer", "vtColormode": "color", "vtColorPrecision": 6, "vtFilterSpeckle": 4}

    return {
        "type": img_type,
        "confidence": round(confidence, 2),
        "recommended_mode": mode,
        "recommended_settings": settings,
        "analysis": analysis,
    }
