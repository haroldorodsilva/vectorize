# Vectorizer

**Converta imagens raster em SVG vetorial com regiões editáveis.**

Vectorizer é uma ferramenta open source que transforma imagens (PNG, JPG, WEBP) em arquivos SVG com regiões fechadas, prontas para colorir e editar. Inclui um editor SVG completo no navegador.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Python](https://img.shields.io/badge/python-3.11+-green.svg)
![React](https://img.shields.io/badge/react-18-blue.svg)
![FastAPI](https://img.shields.io/badge/fastapi-0.104+-teal.svg)

---

## Features

- **Vetorizacao inteligente** — Pipeline com pre-processamento, deteccao de linhas, flood fill e extracao de contornos
- **Multiplos modos** — Lineart, Icon, VTracer (Rust) e Deep Edges
- **Editor SVG completo** — Layers, pen tool, freehand, shapes, text, gradients, effects
- **Pre-processamento avancado** — Remocao de fundo, upscale, OCR
- **Analise automatica** — Detecta tipo de imagem e sugere configuracoes ideais
- **Multi-paginas** — Trabalhe com varias paginas no mesmo projeto
- **Auto-save** — Salva automaticamente a cada 30s
- **Export** — SVG, PNG, PDF
- **CLI** — Use via linha de comando para automacao
- **API REST** — Integre em qualquer aplicacao
- **Docker** — Deploy facil com container

## Arquitetura

```
vectorizer-project/
├── backend/                 # API Python (FastAPI + OpenCV)
│   ├── server.py            # Servidor FastAPI
│   ├── main.py              # CLI
│   ├── Dockerfile
│   ├── requirements.txt
│   └── vectorizer/          # Pipeline de vetorizacao
│       ├── __init__.py      # Orquestrador principal
│       ├── config.py        # Configuracoes
│       ├── preprocess.py    # Redimensionar, denoise, grayscale
│       ├── binarize.py      # Deteccao de linhas
│       ├── regions.py       # Gap closing + flood fill
│       ├── contours.py      # Extracao de contornos SVG
│       ├── svg_builder.py   # Montagem do SVG final
│       ├── vtracer_mode.py  # Modo VTracer (Rust)
│       ├── deep_edges.py    # Deteccao avancada de bordas
│       ├── quantize.py      # Quantizacao de cores
│       ├── background_removal.py
│       ├── upscale.py
│       ├── image_classifier.py
│       └── ocr.py
├── frontend/                # UI React + TypeScript + Vite
│   ├── src/
│   │   ├── App.tsx
│   │   ├── features/
│   │   │   ├── vectorize/   # Controles de vetorizacao
│   │   │   ├── editor/      # Editor SVG completo
│   │   │   ├── upload/      # Drag & drop
│   │   │   ├── palette/     # Paleta de cores
│   │   │   ├── transforms/  # Toolbar de transformacoes
│   │   │   └── icons/       # Browser de icones
│   │   └── shared/          # Componentes UI reutilizaveis
│   └── vite.config.ts
└── docs/                    # GitHub Pages
```

## Quick Start

### Pre-requisitos

- Python 3.11+
- Node.js 18+
- pip e npm

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn server:app --reload --port 8080
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Acesse `http://localhost:5151` no navegador.

### CLI

```bash
cd backend
python main.py imagem.png
python main.py imagem.png -o resultado.svg
python main.py imagem.png --dilate 4 --threshold 150
python main.py imagem.png --no-lineart --no-smooth
```

### Docker

```bash
cd backend
docker build -t vectorizer .
docker run -p 8080:8080 vectorizer
```

## API

### `POST /vectorize`

Vetoriza uma imagem e retorna JSON com o SVG e metadados.

| Parametro | Tipo | Default | Descricao |
|-----------|------|---------|-----------|
| `file` | File | — | Imagem (PNG, JPG, WEBP, BMP, HEIC) |
| `mode` | string | `lineart` | `lineart`, `icon`, `vtracer`, `deep_edges` |
| `line_threshold` | int | `170` | Sensibilidade de deteccao de linhas |
| `dilate_radius` | int | `1` | Raio de dilatacao para fechar gaps |
| `min_area` | int | `10` | Area minima de regiao (px) |
| `max_dimension` | int | `800` | Dimensao maxima de saida |
| `include_lineart` | bool | `true` | Incluir line art no SVG |

**Resposta:**

```json
{
  "svg": "<svg ...>...</svg>",
  "regions": [{"id": 1, "area": 5000, "bbox": [10, 20, 100, 80]}],
  "width": 800,
  "height": 600,
  "processing_time_ms": 245.3
}
```

### `POST /vectorize/download`

Retorna o SVG como arquivo para download.

### `POST /preprocess/remove-bg`

Remove o fundo da imagem. Retorna PNG com transparencia.

### `POST /preprocess/upscale`

Aumenta resolucao da imagem (2x ou 4x). Retorna PNG.

### `POST /analyze`

Analisa a imagem e retorna tipo detectado + configuracoes recomendadas.

### `POST /extract-text`

Extrai texto da imagem via OCR.

### `GET /health`

Health check do servidor.

## Modos de Vetorizacao

| Modo | Melhor para | Descricao |
|------|-------------|-----------|
| **Lineart** | Desenhos com linhas claras | Detecta linhas pretas, cria regioes fechadas |
| **Icon** | Icones flat-color | Detecta bordas de cor entre regioes |
| **VTracer** | Fotos e arte complexa | Engine Rust de alta qualidade |
| **Deep Edges** | Imagens com bordas suaves | Deteccao avancada de bordas (Canny/Enhanced) |

## Pipeline de Vetorizacao

```
Imagem → Pre-processamento → Deteccao de Linhas → Fechamento de Gaps
       → Flood Fill (Regioes) → Extracao de Contornos → Montagem SVG
```

1. **Pre-processamento** — Redimensiona, aplica denoise bilateral, converte para grayscale, CLAHE
2. **Binarizacao** — Threshold adaptativo para detectar linhas/bordas
3. **Gap Closing** — Operacoes morfologicas (dilatacao + closing) para fechar gaps
4. **Flood Fill** — Connected components para encontrar regioes fechadas
5. **Contornos** — Douglas-Peucker + curvas Bezier quadraticas
6. **SVG Builder** — Monta SVG com regioes preenchiveis + line art

## Configuracao

### Backend (`VectorizerConfig`)

```python
from vectorizer.config import VectorizerConfig

cfg = VectorizerConfig(
    max_dimension=800,       # Dimensao maxima
    line_threshold=145,      # Sensibilidade de linhas
    dilate_radius=3,         # Raio de dilatacao
    min_region_area=50,      # Area minima de regiao
    simplify_tolerance=1.5,  # Tolerancia de simplificacao
    smooth_curves=True,      # Curvas Bezier
    include_lineart=True,    # Incluir line art
    mode="lineart",          # Modo de vetorizacao
)
```

### Frontend (`.env`)

```env
VITE_API_URL=http://localhost:8080
```

## Contributing

Veja [CONTRIBUTING.md](CONTRIBUTING.md) para detalhes sobre como contribuir.

## License

Este projeto esta licenciado sob a [MIT License](LICENSE).
