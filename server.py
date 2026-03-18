#!/usr/bin/env python3
"""
API FastAPI para vetorização de imagens.

Executar:
    make dev          # desenvolvimento
    make run          # produção
    uvicorn server:app --reload --port 8080
"""

from pathlib import Path
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.responses import Response, HTMLResponse
from fastapi.middleware.cors import CORSMiddleware

from vectorizer import vectorize
from vectorizer.config import VectorizerConfig

app = FastAPI(
    title="Vectorizer API",
    description="Converte imagens em SVG com regiões fechadas para colorir",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

ALLOWED = {"image/png", "image/jpeg", "image/webp", "image/bmp"}
MAX_SIZE = 20 * 1024 * 1024


@app.get("/health")
async def health():
    return {"status": "ok", "version": "1.0.0"}


@app.post("/vectorize")
async def api_vectorize(
    file: UploadFile = File(...),
    line_threshold: int = Form(145),
    dilate_radius: int = Form(3),
    min_area: int = Form(50),
    simplify: float = Form(1.5),
    max_dimension: int = Form(800),
    include_lineart: bool = Form(True),
):
    if file.content_type not in ALLOWED:
        raise HTTPException(400, f"Tipo não suportado: {file.content_type}")

    data = await file.read()
    if len(data) > MAX_SIZE:
        raise HTTPException(400, "Arquivo muito grande (máx 20MB)")

    cfg = VectorizerConfig(
        max_dimension=max_dimension,
        line_threshold=line_threshold,
        dilate_radius=dilate_radius,
        min_region_area=min_area,
        simplify_tolerance=simplify,
        include_lineart=include_lineart,
    )

    try:
        return vectorize(data, cfg)
    except Exception as e:
        raise HTTPException(500, f"Erro: {e}")


@app.post("/vectorize/download")
async def api_download(
    file: UploadFile = File(...),
    line_threshold: int = Form(145),
    dilate_radius: int = Form(3),
    min_area: int = Form(50),
    simplify: float = Form(1.5),
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
    name = Path(file.filename).stem + "_colorir.svg"

    return Response(
        content=result["svg"],
        media_type="image/svg+xml",
        headers={"Content-Disposition": f'attachment; filename="{name}"'},
    )


@app.get("/", response_class=HTMLResponse)
async def index():
    return """<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Vetorizador de Imagens</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,sans-serif;max-width:900px;margin:0 auto;padding:20px;background:#fafafa;color:#222}
h1{font-size:1.4rem;margin-bottom:4px}
.sub{color:#666;font-size:.9rem;margin-bottom:20px}
.drop{border:2px dashed #ccc;border-radius:12px;padding:48px 16px;text-align:center;cursor:pointer;margin-bottom:16px;transition:border-color .2s}
.drop:hover,.drop.over{border-color:#666}
.row{display:flex;gap:16px;flex-wrap:wrap;margin-bottom:16px;align-items:end}
.ctl label{display:block;font-size:.8rem;color:#666;margin-bottom:4px}
.ctl input[type=range]{width:140px}
.btn{padding:10px 24px;border:none;border-radius:8px;background:#111;color:#fff;font-size:.9rem;cursor:pointer;font-weight:500}
.btn:disabled{background:#999;cursor:wait}
.btn2{padding:8px 16px;border:1px solid #ddd;border-radius:8px;background:#fff;font-size:.85rem;cursor:pointer}
.grid{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:16px 0}
.grid img,.svgbox{width:100%;border:1px solid #eee;border-radius:8px;background:#fff}
.svgbox{overflow:auto;max-height:600px;padding:4px}
.svgbox svg{width:100%;height:auto;display:block}
.stats{display:flex;gap:10px;flex-wrap:wrap;font-size:.85rem;color:#555;margin-top:10px}
.stats span{background:#f0f0f0;padding:4px 10px;border-radius:6px}
.lbl{font-size:.8rem;color:#999;margin-bottom:4px}
</style>
</head>
<body>
<h1>Vetorizador de Imagens</h1>
<p class="sub">Regiões fechadas para colorir &mdash; upload, ajuste e baixe o SVG</p>

<div class="drop" id="dz" onclick="fi.click()">
  <input type="file" id="fi" accept="image/*" hidden>
  <p style="font-size:.95rem;font-weight:500">Clique ou arraste uma imagem</p>
  <p style="font-size:.8rem;color:#999;margin-top:4px">PNG, JPG, WEBP</p>
</div>

<div class="row">
  <div class="ctl"><label>Sensibilidade: <b id="tv">145</b></label>
    <input type="range" id="thr" min="80" max="210" value="145" oninput="tv.textContent=this.value"></div>
  <div class="ctl"><label>Fechamento gaps: <b id="dv">3</b></label>
    <input type="range" id="dil" min="1" max="6" value="3" oninput="dv.textContent=this.value"></div>
  <div class="ctl"><label>Área mínima: <b id="av">50</b></label>
    <input type="range" id="area" min="10" max="500" value="50" oninput="av.textContent=this.value"></div>
  <button class="btn" id="go" onclick="run()" disabled>Vetorizar</button>
  <button class="btn2" onclick="dl()">Baixar SVG</button>
</div>

<div class="grid" id="grid" style="display:none">
  <div><p class="lbl">Original</p><img id="orig"></div>
  <div><p class="lbl">Vetorizado</p><div class="svgbox" id="sb"></div></div>
</div>
<div class="stats" id="st"></div>

<script>
let svg='';
fi.onchange=()=>{if(fi.files[0]){go.disabled=false;orig.src=URL.createObjectURL(fi.files[0]);grid.style.display='grid';}};
dz.ondragover=e=>{e.preventDefault();dz.classList.add('over')};
dz.ondragleave=()=>dz.classList.remove('over');
dz.ondrop=e=>{e.preventDefault();dz.classList.remove('over');const f=e.dataTransfer.files[0];if(f){orig.src=URL.createObjectURL(f);go.disabled=false;grid.style.display='grid';dz._file=f;}};

async function run(){
  const file=fi.files[0]||dz._file;
  if(!file)return;
  go.disabled=true;go.textContent='Processando...';
  const fd=new FormData();
  fd.append('file',file);
  fd.append('line_threshold',thr.value);
  fd.append('dilate_radius',dil.value);
  fd.append('min_area',area.value);
  try{
    const r=await fetch('/vectorize',{method:'POST',body:fd});
    const d=await r.json();
    svg=d.svg;sb.innerHTML=svg;
    st.innerHTML=`<span>Regiões: ${d.regions.length}</span><span>${d.width}×${d.height}</span><span>${d.processing_time_ms}ms</span>`;
  }catch(e){alert('Erro: '+e.message);}
  go.disabled=false;go.textContent='Vetorizar';
}

function dl(){
  if(!svg)return;
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([svg],{type:'image/svg+xml'}));
  a.download='colorir.svg';a.click();
}
</script>
</body>
</html>"""
