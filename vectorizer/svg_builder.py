"""Etapa 6: Montagem do SVG final."""

from .config import VectorizerConfig
from .regions import Region


def build_svg(
    regions_paths: list[tuple[Region, str]],
    lineart_path: str | None,
    width: int,
    height: int,
    config: VectorizerConfig,
) -> str:
    """
    Monta SVG com regiões preenchíveis + line art.
    """
    lines = [
        '<?xml version="1.0" encoding="UTF-8"?>',
        f'<svg xmlns="http://www.w3.org/2000/svg"'
        f' viewBox="0 0 {width} {height}"'
        f' width="{width}" height="{height}">',
        "",
        "  <!-- Regiões preenchíveis -->",
    ]

    for region, path_d in regions_paths:
        x, y, bw, bh = region.bbox
        lines.append(
            f'  <path d="{path_d}" fill="#FFFFFF" stroke="none"'
            f' data-region="{region.id}" data-area="{region.area}"'
            f' data-bbox="{x},{y},{bw},{bh}"/>'
        )

    if config.include_lineart and lineart_path:
        lines.append("")
        lines.append("  <!-- Line art -->")
        lines.append(
            f'  <path d="{lineart_path}" fill="#000000" stroke="none"/>'
        )

    lines.append("</svg>")
    return "\n".join(lines)
