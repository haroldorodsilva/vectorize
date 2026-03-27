"""Conversão de PDF/EPS/PS para PNG ou SVG usando Ghostscript."""

import subprocess
import tempfile
from pathlib import Path


# MIME types suportados por esta conversão
GHOSTSCRIPT_MIMES = {
    "application/pdf",
    "application/postscript",
    "image/x-eps",
    "application/eps",
    "application/x-eps",
}


def is_ghostscript_available() -> bool:
    """Verifica se o binário 'gs' está disponível no sistema."""
    try:
        subprocess.run(
            ["gs", "--version"],
            check=True,
            capture_output=True,
        )
        return True
    except (FileNotFoundError, subprocess.CalledProcessError):
        return False


def convert_to_png(data: bytes, dpi: int = 300) -> bytes:
    """
    Converte PDF/EPS/PS para PNG de alta qualidade usando Ghostscript.

    Retorna bytes do PNG resultante (primeira página apenas).
    """
    with tempfile.TemporaryDirectory() as tmp:
        src = Path(tmp) / "input.pdf"
        dst = Path(tmp) / "output.png"
        src.write_bytes(data)

        cmd = [
            "gs",
            "-dBATCH",
            "-dNOPAUSE",
            "-dSAFER",
            "-dQUIET",
            f"-r{dpi}",
            "-sDEVICE=png16m",
            "-dFirstPage=1",
            "-dLastPage=1",
            "-dTextAlphaBits=4",
            "-dGraphicsAlphaBits=4",
            f"-sOutputFile={dst}",
            str(src),
        ]
        result = subprocess.run(cmd, capture_output=True, timeout=60)
        if result.returncode != 0:
            stderr = result.stderr.decode(errors="replace")
            raise RuntimeError(f"Ghostscript falhou (código {result.returncode}): {stderr}")

        if not dst.exists():
            raise RuntimeError("Ghostscript não gerou arquivo de saída")

        return dst.read_bytes()


def _is_inkscape_available() -> bool:
    """Verifica se o Inkscape está disponível."""
    try:
        subprocess.run(["inkscape", "--version"], capture_output=True, timeout=10)
        return True
    except (FileNotFoundError, subprocess.CalledProcessError, subprocess.TimeoutExpired):
        return False


def _gs_has_svg_device() -> bool:
    """Verifica se o Ghostscript tem o dispositivo SVG disponível."""
    try:
        result = subprocess.run(
            ["gs", "-h"],
            capture_output=True, timeout=10,
        )
        return "svg" in result.stdout.decode(errors="replace").lower()
    except (FileNotFoundError, subprocess.CalledProcessError, subprocess.TimeoutExpired):
        return False


def convert_to_svg(data: bytes) -> str:
    """
    Converte PDF/EPS/PS para SVG preservando dados vetoriais.

    Estratégia (do melhor para o aceitável):
    1. Inkscape — preserva paths vetoriais originais do EPS
    2. Ghostscript svg device — boa qualidade vetorial
    3. Fallback: Ghostscript PNG → vtracer — re-vetoriza (perde qualidade original)
    """
    # 1. Inkscape: melhor resultado, preserva vetores originais
    if _is_inkscape_available():
        try:
            return _inkscape_convert(data)
        except RuntimeError:
            pass

    # 2. Ghostscript svg device
    if _gs_has_svg_device():
        try:
            return _gs_svg_device(data)
        except RuntimeError:
            pass

    # 3. Fallback: EPS → PNG (alta res) → SVG via vtracer
    png_data = convert_to_png(data, dpi=300)
    return _png_to_svg_vtracer(png_data)


def _inkscape_convert(data: bytes) -> str:
    """Converte EPS/PS/PDF para SVG usando Inkscape (preserva vetores)."""
    with tempfile.TemporaryDirectory() as tmp:
        src = Path(tmp) / "input.eps"
        dst = Path(tmp) / "output.svg"
        src.write_bytes(data)

        cmd = [
            "inkscape",
            str(src),
            "--export-type=svg",
            f"--export-filename={dst}",
        ]
        result = subprocess.run(cmd, capture_output=True, timeout=120)
        if result.returncode != 0:
            stderr = result.stderr.decode(errors="replace")
            raise RuntimeError(f"Inkscape falhou (código {result.returncode}): {stderr}")

        if not dst.exists():
            raise RuntimeError("Inkscape não gerou arquivo SVG")

        return dst.read_text(encoding="utf-8")


def _gs_svg_device(data: bytes) -> str:
    """Converte usando Ghostscript svg device diretamente."""
    with tempfile.TemporaryDirectory() as tmp:
        src = Path(tmp) / "input.eps"
        dst = Path(tmp) / "output.svg"
        src.write_bytes(data)

        cmd = [
            "gs",
            "-dBATCH",
            "-dNOPAUSE",
            "-dSAFER",
            "-dQUIET",
            "-sDEVICE=svg",
            "-dFirstPage=1",
            "-dLastPage=1",
            f"-sOutputFile={dst}",
            str(src),
        ]
        result = subprocess.run(cmd, capture_output=True, timeout=60)
        if result.returncode != 0:
            stderr = result.stderr.decode(errors="replace")
            raise RuntimeError(f"Ghostscript svg device falhou (código {result.returncode}): {stderr}")

        if not dst.exists():
            raise RuntimeError("Ghostscript não gerou arquivo SVG")

        return dst.read_text(encoding="utf-8")


def _png_to_svg_vtracer(png_data: bytes) -> str:
    """Converte PNG para SVG usando vtracer."""
    import vtracer

    svg_str = vtracer.convert_raw_image_to_svg(
        png_data,
        colormode="color",
        hierarchical="stacked",
        filter_speckle=4,
        color_precision=8,
        layer_difference=16,
        corner_threshold=60,
        length_threshold=4.0,
        max_iterations=10,
        splice_threshold=45,
        path_precision=5,
    )
    return svg_str
