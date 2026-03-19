/**
 * Pen Tool — click to add anchor points, drag for Bézier handles.
 * Like Illustrator/Figma pen tool.
 */

interface PenPoint {
  x: number; y: number
  /** Control point created by dragging (outgoing handle) */
  handleOut?: { x: number; y: number }
}

export interface PenToolState {
  points: PenPoint[]
  previewEl: SVGPathElement | null
  cursorLineEl: SVGLineElement | null
  draggingHandle: boolean
}

const NS = 'http://www.w3.org/2000/svg'

export function createPenState(): PenToolState {
  return { points: [], previewEl: null, cursorLineEl: null, draggingHandle: false }
}

function buildPathD(points: PenPoint[], closePath: boolean): string {
  if (points.length === 0) return ''
  const parts: string[] = []
  const r = (n: number) => Math.round(n * 100) / 100

  parts.push(`M ${r(points[0].x)} ${r(points[0].y)}`)

  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1]
    const cur  = points[i]

    if (prev.handleOut) {
      // Cubic Bézier: use prev handleOut as cp1
      const cp1 = prev.handleOut
      const cp2 = { x: cur.x, y: cur.y }
      parts.push(`C ${r(cp1.x)} ${r(cp1.y)} ${r(cp2.x)} ${r(cp2.y)} ${r(cur.x)} ${r(cur.y)}`)
    } else {
      parts.push(`L ${r(cur.x)} ${r(cur.y)}`)
    }
  }

  if (closePath) parts.push('Z')
  return parts.join(' ')
}

export function penDown(
  state: PenToolState,
  svgX: number, svgY: number,
  svg: SVGSVGElement,
  color: string,
): PenToolState {
  const newState = { ...state }

  // Check if clicking near first point to close
  if (state.points.length >= 3) {
    const first = state.points[0]
    const dist = Math.hypot(svgX - first.x, svgY - first.y)
    if (dist < 8) {
      return commitPen(state, svg, color, true)
    }
  }

  const point: PenPoint = { x: svgX, y: svgY }
  newState.points = [...state.points, point]
  newState.draggingHandle = true

  // Create preview path
  if (!state.previewEl) {
    const el = document.createElementNS(NS, 'path') as SVGPathElement
    el.setAttribute('fill', 'none')
    el.setAttribute('stroke', color)
    el.setAttribute('stroke-width', '2')
    el.setAttribute('stroke-dasharray', '4 3')
    el.setAttribute('opacity', '0.7')
    svg.appendChild(el)
    newState.previewEl = el
  }

  // Create cursor line (from last point to cursor)
  if (!state.cursorLineEl) {
    const line = document.createElementNS(NS, 'line') as SVGLineElement
    line.setAttribute('stroke', color)
    line.setAttribute('stroke-width', '1')
    line.setAttribute('stroke-dasharray', '3 3')
    line.setAttribute('opacity', '0.4')
    svg.appendChild(line)
    newState.cursorLineEl = line
  }

  updatePreview(newState)
  return newState
}

/** Called during drag (handle creation) AND during hover (cursor preview) */
export function penMove(
  state: PenToolState,
  svgX: number, svgY: number,
): PenToolState {
  if (state.points.length === 0) return state

  if (state.draggingHandle) {
    // During drag: update handle of last point
    const newState = { ...state }
    const last = { ...state.points[state.points.length - 1] }
    last.handleOut = { x: svgX, y: svgY }
    newState.points = [...state.points.slice(0, -1), last]
    updatePreview(newState)
    return newState
  }

  // During hover (between clicks): update cursor line
  if (state.cursorLineEl && state.points.length > 0) {
    const last = state.points[state.points.length - 1]
    state.cursorLineEl.setAttribute('x1', String(last.x))
    state.cursorLineEl.setAttribute('y1', String(last.y))
    state.cursorLineEl.setAttribute('x2', String(svgX))
    state.cursorLineEl.setAttribute('y2', String(svgY))
  }

  return state
}

export function penUp(state: PenToolState): PenToolState {
  return { ...state, draggingHandle: false }
}

function updatePreview(state: PenToolState) {
  if (state.previewEl) {
    state.previewEl.setAttribute('d', buildPathD(state.points, false))
  }
}

export function commitPen(
  state: PenToolState,
  svg: SVGSVGElement,
  color: string,
  closePath: boolean,
): PenToolState & { committed: SVGPathElement | null } {
  // Remove preview elements
  if (state.previewEl) state.previewEl.remove()
  if (state.cursorLineEl) state.cursorLineEl.remove()

  if (state.points.length < 2) {
    return { points: [], previewEl: null, cursorLineEl: null, draggingHandle: false, committed: null }
  }

  // Create final path
  const el = document.createElementNS(NS, 'path') as SVGPathElement
  el.setAttribute('d', buildPathD(state.points, closePath))
  el.setAttribute('fill', closePath ? color : 'none')
  el.setAttribute('stroke', color)
  el.setAttribute('stroke-width', '2')
  el.setAttribute('data-region', String(Date.now()))
  el.setAttribute('data-drawn', '1')
  svg.appendChild(el)

  return { points: [], previewEl: null, cursorLineEl: null, draggingHandle: false, committed: el }
}

export function cancelPen(state: PenToolState): PenToolState {
  if (state.previewEl) state.previewEl.remove()
  if (state.cursorLineEl) state.cursorLineEl.remove()
  return { points: [], previewEl: null, cursorLineEl: null, draggingHandle: false }
}
