#!/usr/bin/env python3
"""
FastAPI — API de vetorização de imagens.

Dev:   uvicorn server:app --reload --port 8080
Prod:  uvicorn server:app --host 0.0.0.0 --port 8080
"""

from pathlib import Path
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import Response
from fastapi.middleware.cors import CORSMiddleware


from vectorizer import vectorize
from vectorizer.config import VectorizerConfig

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

ALLOWED  = {"image/png", "image/jpeg", "image/webp", "image/bmp"}
MAX_SIZE = 20 * 1024 * 1024


@app.get("/health")
async def health():
    return {"status": "ok", "version": "2.0.0"}


@app.post("/vectorize")
async def api_vectorize(
    file:            UploadFile = File(...),
    mode:            str   = Form("lineart"),   # "lineart" | "icon" | "vtracer"
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

    cfg = VectorizerConfig(
        max_dimension=max_dimension,
        line_threshold=line_threshold,
        dilate_radius=dilate_radius,
        min_region_area=min_area,
        simplify_tolerance=simplify,
        include_lineart=include_lineart,
        mode=mode,
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

