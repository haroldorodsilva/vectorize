"""Etapa 2: Detecção de linhas (binarização)."""

import cv2
import numpy as np
from .config import VectorizerConfig


def binarize_color_edges(color_img: np.ndarray, config: VectorizerConfig) -> np.ndarray:
    """
    Detect color boundaries in a flat-color image (icons, illustrations).
    Uses Canny edge detection on the LAB color space so boundaries between
    equally-bright colors of different hues are still detected.

    Returns: uint8 mask, 255 = edge, 0 = interior.
    """
    # Work in LAB: separates luminance from color channels
    lab = cv2.cvtColor(color_img, cv2.COLOR_BGR2LAB)
    edges = np.zeros(lab.shape[:2], dtype=np.uint8)
    for ch in range(3):
        e = cv2.Canny(lab[:, :, ch], 20, 60)
        edges = cv2.bitwise_or(edges, e)

    # Also check plain grayscale for any remaining lines
    gray = cv2.cvtColor(color_img, cv2.COLOR_BGR2GRAY)
    e_gray = cv2.Canny(gray, 30, 80)
    edges = cv2.bitwise_or(edges, e_gray)

    # Dilate to close micro-gaps between Canny segments
    k = max(1, config.dilate_radius)
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (k, k))
    edges = cv2.dilate(edges, kernel, iterations=1)

    # Remove tiny speckles
    open_k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2, 2))
    edges = cv2.morphologyEx(edges, cv2.MORPH_OPEN, open_k)

    return edges


def binarize(gray: np.ndarray, config: VectorizerConfig) -> np.ndarray:
    """
    Converte grayscale em máscara binária de linhas.
    Combina threshold adaptativo + Otsu + fixo (votação).

    Retorna: uint8 array, 255 = linha, 0 = fundo.
    """
    h, w = gray.shape

    # Tamanho do bloco adaptativo (auto ou manual)
    block = config.adaptive_block_size
    if block == 0:
        block = max(15, int(min(w, h) / 12))
        if block % 2 == 0:
            block += 1

    # Método 1: Adaptativo gaussiano
    adaptive = cv2.adaptiveThreshold(
        gray, 255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY_INV,
        blockSize=block, C=10,
    )

    # Método 2: Otsu automático
    _, otsu = cv2.threshold(
        gray, 0, 255, cv2.THRESH_BINARY_INV + cv2.THRESH_OTSU
    )

    # Método 3: Threshold fixo
    _, fixed = cv2.threshold(
        gray, config.line_threshold, 255, cv2.THRESH_BINARY_INV
    )

    # Método 4: Gradiente morfológico (robusto a variações de espessura e iluminação)
    grad_k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    gradient = cv2.morphologyEx(gray, cv2.MORPH_GRADIENT, grad_k)
    _, morph = cv2.threshold(gradient, 20, 255, cv2.THRESH_BINARY)

    # Votação: pixel é linha se ≥2 de 4 métodos concordam
    vote = (
        (adaptive > 0).astype(np.uint8)
        + (otsu > 0).astype(np.uint8)
        + (fixed > 0).astype(np.uint8)
        + (morph > 0).astype(np.uint8)
    )
    combined = np.zeros_like(gray, dtype=np.uint8)
    combined[vote >= 2] = 255

    # Limpar ruído
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2, 2))
    combined = cv2.morphologyEx(combined, cv2.MORPH_OPEN, kernel)

    return combined
