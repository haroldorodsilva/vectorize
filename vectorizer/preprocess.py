"""Etapa 1: Pré-processamento da imagem."""

import cv2
import numpy as np
from .config import VectorizerConfig


def preprocess(
    image_bytes: bytes, config: VectorizerConfig
) -> tuple[np.ndarray, np.ndarray, int, int]:
    """
    Decodifica, redimensiona, aplica denoise e converte para grayscale.

    Retorna: (grayscale, color_resized, width, height)
    """
    arr = np.frombuffer(image_bytes, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Não foi possível decodificar a imagem")

    h, w = img.shape[:2]

    # Redimensionar mantendo proporção
    max_dim = config.max_dimension
    if max(w, h) > max_dim:
        scale = max_dim / max(w, h)
        w = int(w * scale)
        h = int(h * scale)
        img = cv2.resize(img, (w, h), interpolation=cv2.INTER_AREA)

    # Denoise bilateral (preserva bordas)
    denoised = cv2.bilateralFilter(img, config.denoise_strength, 75, 75)

    # Grayscale
    gray = cv2.cvtColor(denoised, cv2.COLOR_BGR2GRAY)

    # CLAHE para melhorar contraste local
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    gray = clahe.apply(gray)

    return gray, img, w, h
