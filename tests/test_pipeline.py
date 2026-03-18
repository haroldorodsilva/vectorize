"""Testes básicos do pipeline."""

import pytest
import numpy as np
from vectorizer.config import VectorizerConfig
from vectorizer.binarize import binarize
from vectorizer.regions import close_gaps, find_regions


def _make_test_image(w=100, h=100):
    """Cria imagem de teste: quadrado preto sobre fundo branco."""
    img = np.full((h, w), 255, dtype=np.uint8)
    # Quadrado preto (linha)
    img[20:80, 20] = 0
    img[20:80, 79] = 0
    img[20, 20:80] = 0
    img[79, 20:80] = 0
    return img


def test_binarize():
    gray = _make_test_image()
    cfg = VectorizerConfig(line_threshold=128)
    result = binarize(gray, cfg)
    assert result.shape == gray.shape
    assert result.dtype == np.uint8
    # Centro do quadrado deve ser branco (não-linha)
    assert result[50, 50] == 0
    # Borda deve ser preta (linha)
    assert result[20, 20] == 255


def test_find_regions():
    gray = _make_test_image()
    cfg = VectorizerConfig(line_threshold=128, dilate_radius=1, min_region_area=10)
    lines = binarize(gray, cfg)
    closed = close_gaps(lines, cfg)
    regions = find_regions(closed, lines, cfg)
    # Deve encontrar pelo menos 2 regiões: dentro e fora do quadrado
    assert len(regions) >= 2


def test_config_defaults():
    cfg = VectorizerConfig()
    assert cfg.max_dimension == 800
    assert cfg.dilate_radius == 3
    assert cfg.smooth_curves is True
