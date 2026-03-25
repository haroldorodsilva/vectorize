"""Conversão de PDF/EPS/PS para PNG usando Ghostscript."""

import io
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
