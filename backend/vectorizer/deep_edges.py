"""
Deep learning edge detection using OpenCV DNN (HED model).
Falls back to enhanced Canny if model not available.

To use HED model, download:
  - deploy.prototxt from: https://github.com/s9xie/hed
  - hed_pretrained_bsds.caffemodel
Place in backend/models/ directory.
"""
import cv2
import numpy as np
from pathlib import Path


MODELS_DIR = Path(__file__).parent.parent / "models"


def detect_edges_deep(color_img: np.ndarray, method: str = "hed") -> np.ndarray:
    """
    Detect edges using deep learning methods.

    Args:
        color_img: BGR image (OpenCV format)
        method: "hed" (Holistically-Nested Edge Detection) or "enhanced_canny"

    Returns:
        Binary edge mask (255=edge, 0=background)
    """
    if method == "hed":
        return _detect_hed(color_img)
    else:
        return _detect_enhanced_canny(color_img)


def _detect_hed(color_img: np.ndarray) -> np.ndarray:
    """HED edge detection using OpenCV DNN module."""
    proto_path = MODELS_DIR / "deploy.prototxt"
    model_path = MODELS_DIR / "hed_pretrained_bsds.caffemodel"

    if not proto_path.exists() or not model_path.exists():
        # Fallback to enhanced Canny
        print("[deep_edges] HED model not found, falling back to enhanced Canny")
        return _detect_enhanced_canny(color_img)

    h, w = color_img.shape[:2]
    net = cv2.dnn.readNetFromCaffe(str(proto_path), str(model_path))

    # Prepare input blob
    blob = cv2.dnn.blobFromImage(
        color_img, scalefactor=1.0, size=(w, h),
        mean=(104.00698793, 116.66876762, 122.67891434),
        swapRB=False, crop=False,
    )
    net.setInput(blob)
    hed_output = net.forward()

    # Convert to binary mask
    hed_map = hed_output[0, 0]
    hed_map = cv2.resize(hed_map, (w, h))
    hed_map = (255 * hed_map).clip(0, 255).astype(np.uint8)

    # Threshold to binary
    _, binary = cv2.threshold(hed_map, 50, 255, cv2.THRESH_BINARY)
    return binary


def _detect_enhanced_canny(color_img: np.ndarray) -> np.ndarray:
    """
    Enhanced Canny edge detection:
    - Multi-scale Canny (3 scales, merged)
    - Bilateral filter for noise reduction
    - LAB color space for color-aware edges
    """
    h, w = color_img.shape[:2]

    # Bilateral filter to smooth while preserving edges
    smooth = cv2.bilateralFilter(color_img, 9, 75, 75)

    # Convert to LAB for color-aware edges
    lab = cv2.cvtColor(smooth, cv2.COLOR_BGR2LAB)
    gray = cv2.cvtColor(smooth, cv2.COLOR_BGR2GRAY)

    edges = np.zeros((h, w), dtype=np.uint8)

    # Multi-scale Canny on grayscale
    for low, high in [(30, 80), (50, 150), (80, 200)]:
        e = cv2.Canny(gray, low, high)
        edges = cv2.bitwise_or(edges, e)

    # Canny on LAB channels (detects color boundaries)
    for ch in range(3):
        e = cv2.Canny(lab[:, :, ch], 20, 60)
        edges = cv2.bitwise_or(edges, e)

    # Light morphological close to connect near-edges
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2, 2))
    edges = cv2.morphologyEx(edges, cv2.MORPH_CLOSE, kernel)

    return edges
