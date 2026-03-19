"""Etapa 5: Extração e suavização de contornos."""

import cv2
import numpy as np
from .config import VectorizerConfig
from .regions import Region


def extract_contour(region: Region, config: VectorizerConfig) -> str | None:
    """
    Extrai contorno externo da região e converte em path SVG.

    Usa cv2.findContours + Douglas-Peucker + curvas Bézier.
    """
    contours, _ = cv2.findContours(
        region.mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE
    )
    if not contours:
        return None

    contour = max(contours, key=cv2.contourArea)
    if len(contour) < 3:
        return None

    # Tolerância adaptativa: contornos pequenos/triangulares usam tolerância
    # menor para não colapsar vértices agudos.
    perimeter = cv2.arcLength(contour, True)
    tol = min(config.simplify_tolerance, max(perimeter * 0.01, 0.5))
    simplified = cv2.approxPolyDP(contour, tol, closed=True)
    pts = simplified.reshape(-1, 2)

    if len(pts) < 3:
        return None

    if config.smooth_curves:
        return _smooth_path(pts)
    return _linear_path(pts)


def _smooth_path(pts: np.ndarray) -> str:
    """Path SVG com curvas Bézier quadráticas."""
    n = len(pts)
    if n < 3:
        return _linear_path(pts)

    mx = (int(pts[-1][0]) + int(pts[0][0])) / 2
    my = (int(pts[-1][1]) + int(pts[0][1])) / 2
    d = f"M{mx:.1f},{my:.1f}"

    for i in range(n):
        x1, y1 = int(pts[i][0]), int(pts[i][1])
        x2, y2 = int(pts[(i + 1) % n][0]), int(pts[(i + 1) % n][1])
        ex, ey = (x1 + x2) / 2, (y1 + y2) / 2
        d += f"Q{x1},{y1},{ex:.1f},{ey:.1f}"

    return d + "Z"


def _linear_path(pts: np.ndarray) -> str:
    """Path SVG linear (sem curvas)."""
    d = f"M{int(pts[0][0])},{int(pts[0][1])}"
    for i in range(1, len(pts)):
        d += f"L{int(pts[i][0])},{int(pts[i][1])}"
    return d + "Z"


def lineart_to_path(line_mask: np.ndarray, config: VectorizerConfig) -> str:
    """
    Converte máscara de linhas em path SVG via findContours.
    Traça os contornos externos e buracos das linhas como paths fechados.
    """
    contours, _ = cv2.findContours(
        line_mask, cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE
    )
    if not contours:
        return ""

    parts = []
    for contour in contours:
        if len(contour) < 3:
            continue

        # Ignorar contornos minúsculos (ruído de 1-2px)
        if cv2.contourArea(contour) < 4:
            continue

        simplified = cv2.approxPolyDP(
            contour, config.simplify_tolerance, closed=True
        )
        pts = simplified.reshape(-1, 2)
        if len(pts) < 3:
            continue

        if config.smooth_curves:
            parts.append(_smooth_path(pts))
        else:
            parts.append(_linear_path(pts))

    return "".join(parts)
