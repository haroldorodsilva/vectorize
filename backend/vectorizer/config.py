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
    # Color quantization mode
    mode: str = "lineart"   # "lineart" | "icon" | "vtracer"
    num_colors: int = 16    # used in color mode (4–32)
    # vtracer-specific params
    vtracer_colormode: str    = "color"    # "color" | "binary"
    vtracer_hierarchical: str = "stacked"  # "stacked" | "cutout"
    vtracer_filter_speckle: int    = 4
    vtracer_color_precision: int   = 6
    vtracer_layer_difference: int  = 16
    vtracer_corner_threshold: int  = 60
    vtracer_length_threshold: float = 4.0
    vtracer_max_iterations: int    = 10
    vtracer_splice_threshold: int  = 45
    vtracer_path_precision: int    = 3
