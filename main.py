#!/usr/bin/env python3
"""
CLI para vetorização de imagens.

Uso:
    python main.py imagem.png
    python main.py imagem.png -o resultado.svg
    python main.py imagem.png --dilate 4 --threshold 150
    python main.py imagem.png --no-lineart --no-smooth
"""

import argparse
import sys
from pathlib import Path

from vectorizer import vectorize
from vectorizer.config import VectorizerConfig


def main():
    p = argparse.ArgumentParser(
        description="Vetoriza imagens em SVG com regiões fechadas para colorir"
    )
    p.add_argument("input", help="Imagem de entrada (PNG, JPG, WEBP)")
    p.add_argument("-o", "--output", default=None, help="SVG de saída")
    p.add_argument("--threshold", type=int, default=145)
    p.add_argument("--dilate", type=int, default=3)
    p.add_argument("--min-area", type=int, default=50)
    p.add_argument("--simplify", type=float, default=1.5)
    p.add_argument("--max-dim", type=int, default=800)
    p.add_argument("--no-lineart", action="store_true")
    p.add_argument("--no-smooth", action="store_true")
    args = p.parse_args()

    src = Path(args.input)
    if not src.exists():
        print(f"Erro: {src} não encontrado")
        sys.exit(1)

    dst = args.output or str(src.with_suffix(".svg"))

    cfg = VectorizerConfig(
        max_dimension=args.max_dim,
        line_threshold=args.threshold,
        dilate_radius=args.dilate,
        min_region_area=args.min_area,
        simplify_tolerance=args.simplify,
        include_lineart=not args.no_lineart,
        smooth_curves=not args.no_smooth,
    )

    print(f"Processando: {src}")
    print(f"  threshold={cfg.line_threshold}  dilate={cfg.dilate_radius}  min_area={cfg.min_region_area}")

    result = vectorize(src.read_bytes(), cfg)

    Path(dst).write_text(result["svg"], encoding="utf-8")

    print(f"\nResultado:")
    print(f"  Regiões:  {len(result['regions'])}")
    print(f"  Dimensão: {result['width']}x{result['height']}")
    print(f"  Tempo:    {result['processing_time_ms']:.0f}ms")
    print(f"  Arquivo:  {dst}")


if __name__ == "__main__":
    main()
