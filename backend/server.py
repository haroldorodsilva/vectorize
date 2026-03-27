#!/usr/bin/env python3
"""
FastAPI — API de vetorização de imagens.

Dev:   uvicorn server:app --reload --port 8080
Prod:  uvicorn server:app --host 0.0.0.0 --port 8080
"""

import re
from pathlib import Path
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware


from vectorizer import vectorize
from vectorizer.config import VectorizerConfig
from vectorizer.ghostscript_convert import (
    GHOSTSCRIPT_MIMES,
    convert_to_png as gs_convert,
    convert_to_svg as gs_convert_svg,
    is_ghostscript_available,
)

app = FastAPI(
    title="Vectorizer API",
    description="Converte imagens em SVG com regiões fechadas para colorir",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

ALLOWED  = {
    "image/png", "image/jpeg", "image/webp", "image/bmp",
    "image/heic", "image/heif", "image/avif",
    # PDF / EPS / PS  (convertidos via Ghostscript)
    "application/pdf",
    "application/postscript",
    "image/x-eps",
    "application/eps",
    "application/x-eps",
}
MAX_SIZE = 20 * 1024 * 1024

# Register HEIF/HEIC support if available
try:
    from pillow_heif import register_heif_opener
    register_heif_opener()
except ImportError:
    pass


@app.get("/health")
async def health():
    return {"status": "ok", "version": "2.0.0", "ghostscript": is_ghostscript_available()}


def _maybe_convert_with_ghostscript(data: bytes, content_type: str | None) -> bytes:
    """Se o arquivo for PDF/EPS/PS, converte para PNG via Ghostscript."""
    if content_type in GHOSTSCRIPT_MIMES:
        try:
            return gs_convert(data)
        except RuntimeError as e:
            # Mensagem sanitizada — não expõe caminhos temporários internos
            msg = str(e).split(":")[-1].strip() if ":" in str(e) else str(e)
            raise HTTPException(422, f"Ghostscript: {msg}")
    return data


@app.post("/vectorize")
async def api_vectorize(
    file:            UploadFile = File(...),
    mode:            str   = Form("lineart"),   # "lineart" | "icon" | "vtracer" | "deep_edges"
    edge_detector:   str   = Form("enhanced_canny"),  # "canny" | "hed" | "enhanced_canny"
    line_threshold:  int   = Form(170),
    dilate_radius:   int   = Form(1),
    min_area:        int   = Form(10),
    simplify:        float = Form(1.5),
    max_dimension:   int   = Form(800),
    include_lineart: bool  = Form(True),
    num_colors:      int   = Form(16),
    # vtracer-specific
    vtracer_colormode:        str   = Form("color"),
    vtracer_filter_speckle:   int   = Form(4),
    vtracer_color_precision:  int   = Form(6),
    vtracer_layer_difference: int   = Form(16),
    vtracer_corner_threshold: int   = Form(60),
    vtracer_length_threshold: float = Form(4.0),
    vtracer_splice_threshold: int   = Form(45),
):
    if file.content_type not in ALLOWED:
        raise HTTPException(400, f"Tipo não suportado: {file.content_type}")

    data = await file.read()
    if len(data) > MAX_SIZE:
        raise HTTPException(400, "Arquivo muito grande (máx 20 MB)")

    # Converter PDF/EPS/PS para PNG via Ghostscript antes de vetorizar
    data = _maybe_convert_with_ghostscript(data, file.content_type)

    cfg = VectorizerConfig(
        max_dimension=max_dimension,
        line_threshold=line_threshold,
        dilate_radius=dilate_radius,
        min_region_area=min_area,
        simplify_tolerance=simplify,
        include_lineart=include_lineart,
        mode=mode,
        edge_detector=edge_detector,
        num_colors=num_colors,
        vtracer_colormode=vtracer_colormode,
        vtracer_filter_speckle=vtracer_filter_speckle,
        vtracer_color_precision=vtracer_color_precision,
        vtracer_layer_difference=vtracer_layer_difference,
        vtracer_corner_threshold=vtracer_corner_threshold,
        vtracer_length_threshold=vtracer_length_threshold,
        vtracer_splice_threshold=vtracer_splice_threshold,
    )
    try:
        return vectorize(data, cfg)
    except Exception as e:
        raise HTTPException(500, f"Erro na vetorização: {e}")


@app.post("/vectorize/download")
async def api_download(
    file: UploadFile = File(...),
    line_threshold: int = Form(170),
    dilate_radius:  int = Form(1),
    min_area:       int = Form(10),
    simplify:     float = Form(1.5),
    include_lineart: bool = Form(True),
):
    if file.content_type not in ALLOWED:
        raise HTTPException(400, f"Tipo não suportado: {file.content_type}")

    data = await file.read()
    if len(data) > MAX_SIZE:
        raise HTTPException(400, "Arquivo muito grande")

    # Converter PDF/EPS/PS para PNG via Ghostscript antes de vetorizar
    data = _maybe_convert_with_ghostscript(data, file.content_type)

    cfg = VectorizerConfig(
        line_threshold=line_threshold,
        dilate_radius=dilate_radius,
        min_region_area=min_area,
        simplify_tolerance=simplify,
        include_lineart=include_lineart,
    )
    result = vectorize(data, cfg)
    name = Path(file.filename or "output").stem + "_colorir.svg"

    return Response(
        content=result["svg"],
        media_type="image/svg+xml",
        headers={"Content-Disposition": f'attachment; filename="{name}"'},
    )


# ── EPS/PDF → SVG direct conversion ──────────────────────────────────────────


def _add_data_regions(svg: str) -> str:
    """Injeta data-region em cada <path>, <polygon>, <circle>, <rect>, <ellipse> para o editor."""
    counter = [0]
    def _replacer(m: re.Match) -> str:
        tag = m.group(0)
        if "data-region" not in tag:
            idx = counter[0]
            counter[0] += 1
            tag_name = m.group(1)
            tag = tag.replace(f"<{tag_name} ", f'<{tag_name} data-region="{idx}" ', 1)
        return tag
    return re.sub(r"<(path|polygon|circle|rect|ellipse)\s[^>]*?/?>", _replacer, svg)


def _ensure_viewbox(svg: str) -> str:
    """Garante que o SVG tenha viewBox. Extrai de width/height se necessário."""
    if "viewBox" in svg:
        return svg
    w_m = re.search(r'width="([^"]+)"', svg)
    h_m = re.search(r'height="([^"]+)"', svg)
    if w_m and h_m:
        w = w_m.group(1).replace("pt", "").replace("px", "").strip()
        h = h_m.group(1).replace("pt", "").replace("px", "").strip()
        try:
            wf, hf = float(w), float(h)
            svg = svg.replace(
                f'height="{h_m.group(1)}"',
                f'height="{h_m.group(1)}" viewBox="0 0 {wf} {hf}"',
                1,
            )
        except ValueError:
            pass
    return svg

EPS_MIMES = {
    "application/postscript",
    "image/x-eps",
    "application/eps",
    "application/x-eps",
    "application/pdf",
    "application/octet-stream",  # browsers often send this for .eps
}

EPS_EXTENSIONS = {".eps", ".ps", ".pdf"}


def _is_eps_file(file: UploadFile) -> bool:
    """Verifica se o arquivo é EPS/PS/PDF por MIME type ou extensão."""
    if file.content_type in EPS_MIMES:
        return True
    if file.filename:
        ext = Path(file.filename).suffix.lower()
        return ext in EPS_EXTENSIONS
    return False


@app.post("/convert/eps-to-svg")
async def api_eps_to_svg(file: UploadFile = File(...)):
    """Converte EPS/PS/PDF diretamente para SVG preservando dados vetoriais."""
    if not _is_eps_file(file):
        raise HTTPException(400, f"Tipo não suportado: {file.content_type}. Envie um arquivo EPS, PS ou PDF.")

    if not is_ghostscript_available():
        raise HTTPException(501, "Ghostscript não está disponível no servidor.")

    data = await file.read()
    if len(data) > MAX_SIZE:
        raise HTTPException(400, "Arquivo muito grande (máx 20 MB)")

    try:
        svg_content = gs_convert_svg(data)
    except RuntimeError as e:
        raise HTTPException(422, f"Erro na conversão: {e}")
    except Exception as e:
        raise HTTPException(500, f"Erro inesperado na conversão: {type(e).__name__}")

    # Adicionar data-region nos paths para o editor funcionar
    svg_content = _add_data_regions(svg_content)
    # Garantir viewBox
    svg_content = _ensure_viewbox(svg_content)

    name = Path(file.filename or "output").stem + ".svg"
    return Response(
        content=svg_content,
        media_type="image/svg+xml",
        headers={"Content-Disposition": f'inline; filename="{name}"'},
    )


# ── Phase 10: Advanced preprocessing endpoints ──────────────────────────────

@app.post("/preprocess/remove-bg")
async def api_remove_bg(file: UploadFile = File(...)):
    """Remove background from image. Returns PNG with transparency."""
    if file.content_type not in ALLOWED:
        raise HTTPException(400, f"Tipo não suportado: {file.content_type}")

    data = await file.read()
    if len(data) > MAX_SIZE:
        raise HTTPException(400, "Arquivo muito grande (máx 20 MB)")

    try:
        from vectorizer.background_removal import remove_background
        result = remove_background(data)
        return Response(content=result, media_type="image/png")
    except ImportError:
        raise HTTPException(501, "rembg não instalado. Execute: pip install rembg")
    except Exception as e:
        raise HTTPException(500, f"Erro na remoção de fundo: {e}")


@app.post("/preprocess/upscale")
async def api_upscale(
    file: UploadFile = File(...),
    scale: int = Form(2),
):
    """Upscale image by 2x or 4x using Real-ESRGAN (or Pillow fallback)."""
    if file.content_type not in ALLOWED:
        raise HTTPException(400, f"Tipo não suportado: {file.content_type}")

    data = await file.read()
    if len(data) > MAX_SIZE:
        raise HTTPException(400, "Arquivo muito grande (máx 20 MB)")

    try:
        from vectorizer.upscale import upscale_image
        result = upscale_image(data, scale)
        return Response(content=result, media_type="image/png")
    except Exception as e:
        raise HTTPException(500, f"Erro no upscale: {e}")


@app.post("/analyze")
async def api_analyze(file: UploadFile = File(...)):
    """Analyze image and return type + recommended vectorization settings."""
    if file.content_type not in ALLOWED:
        raise HTTPException(400, f"Tipo não suportado: {file.content_type}")

    data = await file.read()
    if len(data) > MAX_SIZE:
        raise HTTPException(400, "Arquivo muito grande (máx 20 MB)")

    try:
        from vectorizer.image_classifier import classify_image
        return classify_image(data)
    except Exception as e:
        raise HTTPException(500, f"Erro na análise: {e}")


@app.post("/extract-text")
async def api_extract_text(file: UploadFile = File(...)):
    """Extract text from image using OCR. Returns text regions with bounding boxes."""
    if file.content_type not in ALLOWED:
        raise HTTPException(400, f"Tipo não suportado: {file.content_type}")

    data = await file.read()
    if len(data) > MAX_SIZE:
        raise HTTPException(400, "Arquivo muito grande (máx 20 MB)")

    try:
        from vectorizer.ocr import extract_text
        regions = extract_text(data)
        return {"regions": regions, "count": len(regions)}
    except Exception as e:
        raise HTTPException(500, f"Erro no OCR: {e}")

