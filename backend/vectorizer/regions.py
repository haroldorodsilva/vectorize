"""Etapas 3-4: Fechamento de gaps + Flood fill de regiões."""

import cv2
import numpy as np
from dataclasses import dataclass
from .config import VectorizerConfig


@dataclass
class Region:
    id: int
    area: int
    bbox: tuple[int, int, int, int]  # x, y, w, h
    mask: np.ndarray


def close_gaps(line_mask: np.ndarray, config: VectorizerConfig) -> np.ndarray:
    """
    Fecha gaps nas linhas com operações morfológicas.

    1. Dilatação com kernel circular
    2. Closing morfológico (dilata + erode)
    """
    r = config.dilate_radius

    # Kernel circular
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (r * 2 + 1, r * 2 + 1))
    dilated = cv2.dilate(line_mask, kernel, iterations=1)

    # Closing: fecha aberturas pequenas
    close_k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (r * 2 + 3, r * 2 + 3))
    closed = cv2.morphologyEx(dilated, cv2.MORPH_CLOSE, close_k)

    return closed


def find_regions(
    closed_lines: np.ndarray,
    original_lines: np.ndarray,
    config: VectorizerConfig,
) -> list[Region]:
    """
    Encontra regiões fechadas via connected components nas áreas não-linha.

    Retorna: lista de Region, ordenada por área (maior primeiro).
    """
    h, w = closed_lines.shape

    # Passe extra de selamento: usa kernel mínimo de 2px para fechar gaps
    # sem destruir espaços triangulares pequenos.
    seal_r = max(config.dilate_radius, 2)
    seal_k = cv2.getStructuringElement(
        cv2.MORPH_ELLIPSE, (seal_r * 2 + 1, seal_r * 2 + 1)
    )
    sealed = cv2.morphologyEx(closed_lines, cv2.MORPH_CLOSE, seal_k)

    # Inverter: áreas não-linha = branco
    fillable = (sealed == 0).astype(np.uint8) * 255

    # Connected components
    num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(
        fillable, connectivity=4
    )

    # Kernel para recuar 1px das bordas (fill não toca a linha preta)
    shrink_k = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))

    regions = []
    for i in range(1, num_labels):
        area = stats[i, cv2.CC_STAT_AREA]
        if area < config.min_region_area:
            continue

        x = stats[i, cv2.CC_STAT_LEFT]
        y = stats[i, cv2.CC_STAT_TOP]
        bw = stats[i, cv2.CC_STAT_WIDTH]
        bh = stats[i, cv2.CC_STAT_HEIGHT]

        mask = (labels == i).astype(np.uint8) * 255

        # Ignorar regiões que tocam a borda da imagem (são o fundo/background)
        if (mask[0, :].any() or mask[-1, :].any() or
                mask[:, 0].any() or mask[:, -1].any()):
            continue

        # Só recua se a região for grande o suficiente para sobreviver a erosão
        if area > config.min_region_area * 4:
            eroded = cv2.erode(mask, shrink_k, iterations=1)
            if cv2.countNonZero(eroded) >= config.min_region_area:
                mask = eroded

        regions.append(Region(id=i, area=area, bbox=(x, y, bw, bh), mask=mask))

    regions.sort(key=lambda r: r.area, reverse=True)
    return regions
