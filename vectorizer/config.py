"""Configurações do pipeline de vetorização."""

from dataclasses import dataclass


@dataclass
class VectorizerConfig:
    max_dimension: int = 800
    line_threshold: int = 145
    dilate_radius: int = 3
    min_region_area: int = 50
    simplify_tolerance: float = 1.5
    smooth_curves: bool = True
    include_lineart: bool = True
    denoise_strength: int = 7
    adaptive_block_size: int = 0  # 0 = auto
    output_format: str = "svg"
