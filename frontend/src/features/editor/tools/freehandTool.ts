/**
 * Freehand Drawing Tool — records mouse/touch path, simplifies, and fits smooth Bézier curves.
 */

const NS = 'http://www.w3.org/2000/svg'

interface Point { x: number; y: number }

/** Ramer-Douglas-Peucker simplification */
function simplify(pts: Point[], tolerance: number): Point[] {
  if (pts.length <= 2) return pts
  let maxDist = 0, maxIdx = 0
  const first = pts[0], last = pts[pts.length - 1]
  const dx = last.x - first.x, dy = last.y - first.y
  const len = Math.hypot(dx, dy)

  for (let i = 1; i < pts.length - 1; i++) {
    let dist: number
    if (len < 1e-6) {
      dist = Math.hypot(pts[i].x - first.x, pts[i].y - first.y)
    } else {
      const t = ((pts[i].x - first.x) * dx + (pts[i].y - first.y) * dy) / (len * len)
      const px = first.x + t * dx, py = first.y + t * dy
      dist = Math.hypot(pts[i].x - px, pts[i].y - py)
    }
    if (dist > maxDist) { maxDist = dist; maxIdx = i }
  }

  if (maxDist > tolerance) {
    const left  = simplify(pts.slice(0, maxIdx + 1), tolerance)
    const right = simplify(pts.slice(maxIdx), tolerance)
    return [...left.slice(0, -1), ...right]
  }
  return [first, last]
}

/** Fit smooth cubic Bézier curves through simplified points */
function fitCurves(pts: Point[]): string {
  if (pts.length === 0) return ''
  if (pts.length === 1) return `M ${r(pts[0].x)} ${r(pts[0].y)}`

  const parts: string[] = [`M ${r(pts[0].x)} ${r(pts[0].y)}`]

  if (pts.length === 2) {
    parts.push(`L ${r(pts[1].x)} ${r(pts[1].y)}`)
    return parts.join(' ')
  }

  // Catmull-Rom to Bézier conversion
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[Math.min(pts.length - 1, i + 2)]

    const cp1x = p1.x + (p2.x - p0.x) / 6
    const cp1y = p1.y + (p2.y - p0.y) / 6
    const cp2x = p2.x - (p3.x - p1.x) / 6
    const cp2y = p2.y - (p3.y - p1.y) / 6

    parts.push(`C ${r(cp1x)} ${r(cp1y)} ${r(cp2x)} ${r(cp2y)} ${r(p2.x)} ${r(p2.y)}`)
  }

  return parts.join(' ')
}

const r = (n: number) => Math.round(n * 100) / 100

export interface FreehandState {
  points: Point[]
  previewEl: SVGPathElement | null
  active: boolean
}

export function createFreehandState(): FreehandState {
  return { points: [], previewEl: null, active: false }
}

export function freehandDown(
  state: FreehandState,
  svgX: number, svgY: number,
  svg: SVGSVGElement,
  color: string,
): FreehandState {
  const el = document.createElementNS(NS, 'path') as SVGPathElement
  el.setAttribute('fill', 'none')
  el.setAttribute('stroke', color)
  el.setAttribute('stroke-width', '2')
  el.setAttribute('stroke-linecap', 'round')
  el.setAttribute('stroke-linejoin', 'round')
  el.setAttribute('opacity', '0.7')
  svg.appendChild(el)

  return {
    points: [{ x: svgX, y: svgY }],
    previewEl: el,
    active: true,
  }
}

export function freehandMove(
  state: FreehandState,
  svgX: number, svgY: number,
): FreehandState {
  if (!state.active || !state.previewEl) return state
  const newPts = [...state.points, { x: svgX, y: svgY }]
  // Quick polyline preview
  const d = newPts.map((p, i) =>
    `${i === 0 ? 'M' : 'L'} ${r(p.x)} ${r(p.y)}`
  ).join(' ')
  state.previewEl.setAttribute('d', d)
  return { ...state, points: newPts }
}

export function freehandUp(
  state: FreehandState,
  color: string,
): FreehandState & { committed: SVGPathElement | null } {
  if (!state.previewEl || state.points.length < 3) {
    if (state.previewEl) state.previewEl.remove()
    return { points: [], previewEl: null, active: false, committed: null }
  }

  // Simplify then fit smooth curves
  const simplified = simplify(state.points, 2)
  const d = fitCurves(simplified)

  state.previewEl.setAttribute('d', d)
  state.previewEl.setAttribute('opacity', '1')
  state.previewEl.setAttribute('data-region', String(Date.now()))
  state.previewEl.setAttribute('data-drawn', '1')

  return {
    points: [],
    previewEl: null,
    active: false,
    committed: state.previewEl,
  }
}
