"""
Vetorizador de Imagens - Pipeline principal.

Converte imagens raster em SVG com regiões fechadas para colorir.
"""

import time
from .config import VectorizerConfig
from .preprocess import preprocess
from .binarize import binarize
from .regions import close_gaps, find_regions
from .contours import extract_contour, lineart_to_path
from .svg_builder import build_svg


def vectorize(image_bytes: bytes, config: VectorizerConfig | None = None) -> dict:  # noqa: C901
    """
    Pipeline completo de vetorização.

    Args:
        image_bytes: bytes da imagem (PNG, JPG, WEBP)
        config: configurações (usa padrão se None)

    Retorna:
        dict com svg, regions, width, height, processing_time_ms
    """
    if config is None:
        config = VectorizerConfig()

    mode = getattr(config, "mode", "lineart")

    # ── Modo vtracer (Rust, melhor qualidade) ─────────────────────────────────
    if mode == "vtracer":
        from .vtracer_mode import vectorize_vtracer
        return vectorize_vtracer(image_bytes, config)

    t0 = time.perf_counter()

    # Etapa 1: Pré-processamento
    gray, color_img, w, h = preprocess(image_bytes, config)

    # ── Modo ícone: detecta bordas de cor (melhor para ícones flat-color) ─────
    if mode == "icon":
        from .binarize import binarize_color_edges
        line_mask = binarize_color_edges(color_img, config)
    elif mode == "deep_edges":
        from .deep_edges import detect_edges_deep
        edge_method = getattr(config, "edge_detector", "enhanced_canny")
        line_mask = detect_edges_deep(color_img, edge_method)
    else:
        # Etapa 2: Detecção de linhas (lineart padrão)
        line_mask = binarize(gray, config)

    # Etapa 3: Fechamento de gaps
    closed = close_gaps(line_mask, config)

    # Etapa 4: Flood fill / rotulação de regiões
    regions = find_regions(closed, line_mask, config)

    # Etapa 5: Extração de contornos por região
    regions_paths = []
    for region in regions:
        path_d = extract_contour(region, config)
        if path_d:
            regions_paths.append((region, path_d))

    # Line art path
    lineart = lineart_to_path(line_mask, config) if config.include_lineart else None

    # Etapa 6: Montagem do SVG
    svg = build_svg(regions_paths, lineart, w, h, config)

    elapsed = (time.perf_counter() - t0) * 1000

    return {
        "svg": svg,
        "regions": [
            {"id": int(r.id), "area": int(r.area), "bbox": [int(v) for v in r.bbox]}
            for r, _ in regions_paths
        ],
        "width": int(w),
        "height": int(h),
        "processing_time_ms": round(elapsed, 1),
    }
