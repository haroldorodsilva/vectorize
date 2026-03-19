"""
Vetorização via vtracer (Rust) — melhor qualidade raster→vetor.

vtracer é uma biblioteca Rust exposta como pacote Python.
Suporta dois modos:
  - color: preserva as cores originais (ideal para fotos)
  - binary: preto e branco (ideal para lineart/sketches)
"""

import re
import time


def _resize_bytes(image_bytes: bytes, max_dim: int) -> bytes:
    """Resize image so the longest side is at most max_dim pixels."""
    import cv2
    import numpy as np
    arr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        return image_bytes
    h, w = img.shape[:2]
    if max(w, h) <= max_dim:
        return image_bytes
    scale = max_dim / max(w, h)
    img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
    _, buf = cv2.imencode('.png', img)
    return bytes(buf)


def vectorize_vtracer(image_bytes: bytes, config) -> dict:
    """
    Vetorização usando vtracer.
    Requer: pip install vtracer
    """
    try:
        import vtracer  # type: ignore
    except ImportError:
        raise RuntimeError(
            "vtracer não está instalado. Execute: pip install vtracer"
        )

    t0 = time.perf_counter()

    # Resize before vectorizing — vtracer processes at full resolution otherwise
    max_dim = max(100, getattr(config, "max_dimension", 800))
    image_bytes = _resize_bytes(image_bytes, max_dim)

    colormode    = getattr(config, "vtracer_colormode",    "color")
    hierarchical = getattr(config, "vtracer_hierarchical", "stacked")
    filter_speckle   = max(1, getattr(config, "vtracer_filter_speckle",   4))
    color_precision  = max(1, min(8, getattr(config, "vtracer_color_precision",  6)))
    layer_difference = max(0, getattr(config, "vtracer_layer_difference", 16))
    corner_threshold = max(0, getattr(config, "vtracer_corner_threshold", 60))
    length_threshold = max(0.5, getattr(config, "vtracer_length_threshold", 4.0))
    max_iterations   = max(1, getattr(config, "vtracer_max_iterations",   10))
    splice_threshold = max(0, getattr(config, "vtracer_splice_threshold", 45))
    path_precision   = max(1, min(8, getattr(config, "vtracer_path_precision",   3)))

    svg_str: str = vtracer.convert_raw_image_to_svg(
        image_bytes,
        colormode=colormode,
        hierarchical=hierarchical,
        filter_speckle=filter_speckle,
        color_precision=color_precision,
        layer_difference=layer_difference,
        corner_threshold=corner_threshold,
        length_threshold=length_threshold,
        max_iterations=max_iterations,
        splice_threshold=splice_threshold,
        path_precision=path_precision,
    )

    elapsed = (time.perf_counter() - t0) * 1000

    # Parse width/height from SVG attributes
    w_m = re.search(r'width="(\d+)"',  svg_str)
    h_m = re.search(r'height="(\d+)"', svg_str)
    w = int(w_m.group(1)) if w_m else 800
    h = int(h_m.group(1)) if h_m else 600

    # vtracer doesn't add a viewBox — the frontend editor requires it
    if 'viewBox' not in svg_str:
        svg_str = svg_str.replace(
            f'width="{w}" height="{h}"',
            f'width="{w}" height="{h}" viewBox="0 0 {w} {h}"',
            1,
        )

    # Add data-region attributes so the frontend editor can work with paths
    svg_str = _add_data_regions(svg_str)

    return {
        "svg": svg_str,
        "regions": [],
        "width": w,
        "height": h,
        "processing_time_ms": round(elapsed, 1),
    }


def _add_data_regions(svg_str: str) -> str:
    """Inject data-region="N" into every <path> element (if not already there)."""
    counter = [0]

    def _replacer(m: re.Match) -> str:
        tag = m.group(0)
        if "data-region" not in tag:
            idx = counter[0]
            counter[0] += 1
            tag = tag.replace("<path ", f'<path data-region="{idx}" ', 1)
        return tag

    return re.sub(r"<path [^>]+/?>", _replacer, svg_str)
