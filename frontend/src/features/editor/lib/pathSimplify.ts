/**
 * Path simplification: reduce number of nodes in a path.
 * Uses Ramer-Douglas-Peucker algorithm on path segments.
 */
import { parsePath, serializePath, type PathSeg } from './pathParser'

interface Point { x: number; y: number }

/** Perpendicular distance from point to line segment */
function perpDist(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x, dy = b.y - a.y
  const len = Math.hypot(dx, dy)
  if (len < 1e-10) return Math.hypot(p.x - a.x, p.y - a.y)
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (len * len)))
  return Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy))
}

/** RDP simplification on a list of points */
function rdpSimplify(points: Point[], tolerance: number): Point[] {
  if (points.length <= 2) return points

  let maxDist = 0, maxIdx = 0
  const first = points[0], last = points[points.length - 1]

  for (let i = 1; i < points.length - 1; i++) {
    const d = perpDist(points[i], first, last)
    if (d > maxDist) { maxDist = d; maxIdx = i }
  }

  if (maxDist > tolerance) {
    const left = rdpSimplify(points.slice(0, maxIdx + 1), tolerance)
    const right = rdpSimplify(points.slice(maxIdx), tolerance)
    return [...left.slice(0, -1), ...right]
  }
  return [first, last]
}

/**
 * Simplify a path by reducing the number of segments.
 * Converts curves to points, simplifies, and rebuilds as lines.
 * @param d SVG path d string
 * @param tolerance Higher = fewer points (default 2)
 * @returns Simplified path d string
 */
export function simplifyPath(d: string, tolerance: number = 2): string {
  const segs = parsePath(d)
  if (segs.length < 3) return d

  // Extract subpaths (split at M and Z)
  const subpaths: PathSeg[][] = []
  let current: PathSeg[] = []

  for (const s of segs) {
    if (s.cmd === 'M' && current.length > 0) {
      subpaths.push(current)
      current = []
    }
    current.push(s)
    if (s.cmd === 'Z') {
      subpaths.push(current)
      current = []
    }
  }
  if (current.length > 0) subpaths.push(current)

  // Simplify each subpath
  const simplified: PathSeg[] = []
  for (const sub of subpaths) {
    // Extract anchor points
    const points: Point[] = []
    for (const s of sub) {
      if (s.cmd !== 'Z') points.push({ x: s.x, y: s.y })
    }

    if (points.length < 3) {
      simplified.push(...sub)
      continue
    }

    const isClosed = sub[sub.length - 1].cmd === 'Z'
    const simple = rdpSimplify(points, tolerance)

    // Rebuild as M...L...Z
    for (let i = 0; i < simple.length; i++) {
      simplified.push(i === 0
        ? { cmd: 'M', x: simple[i].x, y: simple[i].y }
        : { cmd: 'L', x: simple[i].x, y: simple[i].y }
      )
    }
    if (isClosed) simplified.push({ cmd: 'Z' })
  }

  return serializePath(simplified)
}

/**
 * Simplify path element in place.
 * Returns the number of segments removed.
 */
export function simplifyPathElement(el: Element, tolerance: number = 2): number {
  if (el.tagName.toLowerCase() !== 'path') return 0
  const d = el.getAttribute('d')
  if (!d) return 0

  const origSegs = parsePath(d)
  const newD = simplifyPath(d, tolerance)
  const newSegs = parsePath(newD)

  el.setAttribute('d', newD)
  return origSegs.length - newSegs.length
}
