"""
Vetorização por quantização de cor (modo foto/colorido).

Pipeline:
  1. Resize + Mean-shift para criar regiões de cor plana (pyrMeanShiftFiltering)
  2. K-means para quantizar em N cores globais
  3. Por cor: componentes conectadas → contornos → paths SVG com curvas Bézier
  4. Montagem do SVG
"""

import time
import cv2
import numpy as np


# ── Utilitários ────────────────────────────────────────────────────────────────

def _bgr_to_hex(bgr) -> str:
    return "#{:02x}{:02x}{:02x}".format(int(bgr[2]), int(bgr[1]), int(bgr[0]))


def _smooth_path(pts: np.ndarray) -> str:
    """
    Converte uma polilinha em path SVG suave usando curvas Bézier quadráticas.
    Técnica: usa os PONTOS MÉDIOS como âncoras e os vértices como pontos de controle.
    Produz curvas suaves sem artefatos.
    """
    pts = pts.reshape(-1, 2).astype(float)
    n = len(pts)
    if n < 3:
        # Linear para menos de 3 pontos
        d = f"M{pts[0][0]:.1f},{pts[0][1]:.1f}"
        for p in pts[1:]:
            d += f" L{p[0]:.1f},{p[1]:.1f}"
        return d + " Z"

    # Pontos médios entre vértices consecutivos
    mids = np.array([(pts[i] + pts[(i + 1) % n]) / 2 for i in range(n)])

    d = f"M{mids[0][0]:.1f},{mids[0][1]:.1f}"
    for i in range(n):
        ctrl = pts[i]
        nxt  = mids[(i + 1) % n]
        d += f" Q{ctrl[0]:.1f},{ctrl[1]:.1f} {nxt[0]:.1f},{nxt[1]:.1f}"
    return d + " Z"


def _build_path(outer: np.ndarray, holes: list | None = None) -> str:
    d = _smooth_path(outer)
    if holes:
        for h in holes:
            d += " " + _smooth_path(h)
    return d


def _simplify(contour: np.ndarray, tol: float) -> np.ndarray:
    """Douglas-Peucker com tolerância mínima de 0.3px."""
    eps = max(tol * cv2.arcLength(contour, True) / 200.0, 0.3)
    return cv2.approxPolyDP(contour, eps, True)


# ── Pipeline principal ─────────────────────────────────────────────────────────

def vectorize_color(image_bytes: bytes, config) -> dict:
    """
    Vetorização colorida (modo foto).

    Usa Mean-Shift + K-means para produzir regiões de cor coerentes e suaves.
    """
    t0 = time.perf_counter()

    # ── 1. Decode ─────────────────────────────────────────────────────────────
    arr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        raise ValueError("Não foi possível decodificar a imagem")

    # ── 2. Resize ─────────────────────────────────────────────────────────────
    h, w = img.shape[:2]
    max_dim = max(100, getattr(config, "max_dimension", 800))
    if max(w, h) > max_dim:
        scale = max_dim / max(w, h)
        img = cv2.resize(img, (int(w * scale), int(h * scale)), interpolation=cv2.INTER_AREA)
        h, w = img.shape[:2]

    # ── 3. Mean-Shift para regiões planas coerentes espacialmente ─────────────
    # sp = spatial radius (pixels), sr = color range radius
    # Valores maiores = regiões maiores e mais planas
    ms = cv2.pyrMeanShiftFiltering(img, sp=8, sr=40, maxLevel=2)

    # ── 4. K-means na imagem mean-shift ───────────────────────────────────────
    num_colors = max(2, min(32, getattr(config, "num_colors", 16)))
    data = ms.reshape((-1, 3)).astype(np.float32)
    criteria = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 40, 0.5)
    _, labels, centers = cv2.kmeans(
        data, num_colors, None, criteria, 5, cv2.KMEANS_PP_CENTERS
    )
    centers = np.uint8(centers)
    labels_img = labels.reshape((h, w)).astype(np.uint8)

    # ── 5. Pós-processamento: suavizar mapa de labels ─────────────────────────
    # Aplicar mediana 2D para remover ruído pontual entre regiões
    labels_img = cv2.medianBlur(labels_img, 5)

    # ── 6. Extrair regiões por cor ────────────────────────────────────────────
    min_area   = max(1, getattr(config, "min_region_area", 50))
    simplify_t = max(0.3, getattr(config, "simplify_tolerance", 1.5))
    k3 = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (3, 3))
    k5 = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))

    total_pixels = float(h * w)
    regions_out: list[dict] = []

    for ci in range(num_colors):
        mask = (labels_img == ci).astype(np.uint8) * 255

        # Fechar lacunas pequenas
        mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, k5)
        # Suavizar bordas da máscara
        mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN,  k3)

        hex_color = _bgr_to_hex(centers[ci])

        num_comp, comp_lbl, stats, _ = cv2.connectedComponentsWithStats(mask, connectivity=8)

        for comp_id in range(1, num_comp):
            area = int(stats[comp_id, cv2.CC_STAT_AREA])
            # Ignorar regiões muito pequenas (< min_area e < 0.02% da imagem)
            if area < min_area or area < total_pixels * 0.0002:
                continue

            comp_mask = (comp_lbl == comp_id).astype(np.uint8) * 255

            # Suavizar a máscara do componente antes de extrair contorno
            comp_mask = cv2.GaussianBlur(comp_mask, (5, 5), 0)
            _, comp_mask = cv2.threshold(comp_mask, 127, 255, cv2.THRESH_BINARY)

            contours, hierarchy = cv2.findContours(
                comp_mask, cv2.RETR_CCOMP, cv2.CHAIN_APPROX_TC89_KCOS
            )
            if not contours or hierarchy is None:
                continue

            hier = hierarchy[0]
            outers: list[tuple[int, np.ndarray]] = []
            holes_map: dict[int, list[np.ndarray]] = {}

            for i, cnt in enumerate(contours):
                if len(cnt) < 3:
                    continue
                approx = _simplify(cnt, simplify_t)
                if len(approx) < 3:
                    continue
                parent = hier[i][3]
                if parent == -1:
                    outers.append((i, approx))
                else:
                    holes_map.setdefault(parent, []).append(approx)

            for idx, oc in outers:
                path_d = _build_path(oc, holes_map.get(idx))
                bbox = [
                    int(stats[comp_id, cv2.CC_STAT_LEFT]),
                    int(stats[comp_id, cv2.CC_STAT_TOP]),
                    int(stats[comp_id, cv2.CC_STAT_WIDTH]),
                    int(stats[comp_id, cv2.CC_STAT_HEIGHT]),
                ]
                regions_out.append({
                    "path":  path_d,
                    "color": hex_color,
                    "area":  area,
                    "bbox":  bbox,
                })

    # Maior área primeiro (fundo renderizado primeiro, detalhes na frente)
    regions_out.sort(key=lambda r: r["area"], reverse=True)

    # ── 7. Montar SVG ─────────────────────────────────────────────────────────
    lines = [
        f'<svg xmlns="http://www.w3.org/2000/svg" '
        f'viewBox="0 0 {w} {h}" width="{w}" height="{h}">'
    ]
    for i, r in enumerate(regions_out):
        bbox_str = ",".join(str(v) for v in r["bbox"])
        lines.append(
            f'  <path data-region="{i}" data-area="{r["area"]}" data-bbox="{bbox_str}" '
            f'fill="{r["color"]}" fill-rule="evenodd" d="{r["path"]}"/>'
        )
    lines.append("</svg>")
    svg = "\n".join(lines)

    elapsed = (time.perf_counter() - t0) * 1000

    return {
        "svg": svg,
        "regions": [
            {"id": i, "area": r["area"], "bbox": r["bbox"]}
            for i, r in enumerate(regions_out)
        ],
        "width":  w,
        "height": h,
        "processing_time_ms": round(elapsed, 1),
    }
