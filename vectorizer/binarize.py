"""Etapa 2: Detecção de linhas (binarização)."""

import cv2
import numpy as np
from .config import VectorizerConfig


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

    # Votação: pixel é linha se ≥2 métodos concordam
    vote = (
        (adaptive > 0).astype(np.uint8)
        + (otsu > 0).astype(np.uint8)
        + (fixed > 0).astype(np.uint8)
    )
    combined = np.zeros_like(gray, dtype=np.uint8)
    combined[vote >= 2] = 255

    # Limpar ruído
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (2, 2))
    combined = cv2.morphologyEx(combined, cv2.MORPH_OPEN, kernel)

    return combined
