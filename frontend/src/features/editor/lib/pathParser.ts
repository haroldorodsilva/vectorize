/**
 * Parse and serialize SVG path `d` strings into structured segments.
 * Supports: M, L, H, V, C, S, Q, T, A, Z (absolute and relative).
 * All parsed output is in absolute coordinates.
 */

export interface PathPoint { x: number; y: number }

export type PathSeg =
  | { cmd: 'M'; x: number; y: number }
  | { cmd: 'L'; x: number; y: number }
  | { cmd: 'C'; x1: number; y1: number; x2: number; y2: number; x: number; y: number }
  | { cmd: 'Q'; x1: number; y1: number; x: number; y: number }
  | { cmd: 'A'; rx: number; ry: number; rotation: number; largeArc: number; sweep: number; x: number; y: number }
  | { cmd: 'Z' }

// Tokenizer regex: splits into commands and numeric values
const TOKEN_RE = /([MmLlHhVvCcSsQqTtAaZz])|([+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?)/g

export function parsePath(d: string): PathSeg[] {
  const tokens: string[] = []
  let m: RegExpExecArray | null
  while ((m = TOKEN_RE.exec(d)) !== null) tokens.push(m[0])

  const segs: PathSeg[] = []
  let i = 0
  let cx = 0, cy = 0 // current point
  let sx = 0, sy = 0 // subpath start
  let prevCmd = ''
  let prevCp: PathPoint = { x: 0, y: 0 } // previous control point for S/T

  const num = () => parseFloat(tokens[i++])
  const hasMoreNums = () => i < tokens.length && !isNaN(parseFloat(tokens[i]))

  while (i < tokens.length) {
    let cmd = tokens[i]

    // If we encounter a number without a command, repeat the previous command
    if (!isNaN(parseFloat(cmd))) {
      if (prevCmd === 'M') cmd = 'L'
      else if (prevCmd === 'm') cmd = 'l'
      else cmd = prevCmd
    } else {
      i++
    }

    const abs = cmd === cmd.toUpperCase()

    switch (cmd.toUpperCase()) {
      case 'M': {
        const x = num(), y = num()
        cx = abs ? x : cx + x
        cy = abs ? y : cy + y
        sx = cx; sy = cy
        segs.push({ cmd: 'M', x: cx, y: cy })
        prevCmd = cmd
        // Subsequent coords are implicit LineTo
        while (hasMoreNums()) {
          const lx = num(), ly = num()
          cx = abs ? lx : cx + lx
          cy = abs ? ly : cy + ly
          segs.push({ cmd: 'L', x: cx, y: cy })
        }
        break
      }
      case 'L': {
        do {
          const x = num(), y = num()
          cx = abs ? x : cx + x
          cy = abs ? y : cy + y
          segs.push({ cmd: 'L', x: cx, y: cy })
        } while (hasMoreNums())
        prevCmd = cmd
        break
      }
      case 'H': {
        do {
          const x = num()
          cx = abs ? x : cx + x
          segs.push({ cmd: 'L', x: cx, y: cy })
        } while (hasMoreNums())
        prevCmd = cmd
        break
      }
      case 'V': {
        do {
          const y = num()
          cy = abs ? y : cy + y
          segs.push({ cmd: 'L', x: cx, y: cy })
        } while (hasMoreNums())
        prevCmd = cmd
        break
      }
      case 'C': {
        do {
          let x1 = num(), y1 = num(), x2 = num(), y2 = num(), x = num(), y = num()
          if (!abs) { x1 += cx; y1 += cy; x2 += cx; y2 += cy; x += cx; y += cy }
          segs.push({ cmd: 'C', x1, y1, x2, y2, x, y })
          prevCp = { x: x2, y: y2 }
          cx = x; cy = y
        } while (hasMoreNums())
        prevCmd = cmd
        break
      }
      case 'S': {
        do {
          // Reflected control point
          const rx = 2 * cx - prevCp.x, ry = 2 * cy - prevCp.y
          let x2 = num(), y2 = num(), x = num(), y = num()
          if (!abs) { x2 += cx; y2 += cy; x += cx; y += cy }
          segs.push({ cmd: 'C', x1: rx, y1: ry, x2, y2, x, y })
          prevCp = { x: x2, y: y2 }
          cx = x; cy = y
        } while (hasMoreNums())
        prevCmd = cmd
        break
      }
      case 'Q': {
        do {
          let x1 = num(), y1 = num(), x = num(), y = num()
          if (!abs) { x1 += cx; y1 += cy; x += cx; y += cy }
          segs.push({ cmd: 'Q', x1, y1, x, y })
          prevCp = { x: x1, y: y1 }
          cx = x; cy = y
        } while (hasMoreNums())
        prevCmd = cmd
        break
      }
      case 'T': {
        do {
          const rx = 2 * cx - prevCp.x, ry = 2 * cy - prevCp.y
          let x = num(), y = num()
          if (!abs) { x += cx; y += cy }
          segs.push({ cmd: 'Q', x1: rx, y1: ry, x, y })
          prevCp = { x: rx, y: ry }
          cx = x; cy = y
        } while (hasMoreNums())
        prevCmd = cmd
        break
      }
      case 'A': {
        do {
          const rx = num(), ry = num(), rotation = num(), la = num(), sw = num()
          let x = num(), y = num()
          if (!abs) { x += cx; y += cy }
          segs.push({ cmd: 'A', rx, ry, rotation, largeArc: la, sweep: sw, x, y })
          cx = x; cy = y
        } while (hasMoreNums())
        prevCmd = cmd
        break
      }
      case 'Z': {
        segs.push({ cmd: 'Z' })
        cx = sx; cy = sy
        prevCmd = cmd
        break
      }
    }
  }
  return segs
}

export function serializePath(segs: PathSeg[]): string {
  const parts: string[] = []
  const r = (n: number) => Math.round(n * 1000) / 1000

  for (const s of segs) {
    switch (s.cmd) {
      case 'M': parts.push(`M ${r(s.x)} ${r(s.y)}`); break
      case 'L': parts.push(`L ${r(s.x)} ${r(s.y)}`); break
      case 'C': parts.push(`C ${r(s.x1)} ${r(s.y1)} ${r(s.x2)} ${r(s.y2)} ${r(s.x)} ${r(s.y)}`); break
      case 'Q': parts.push(`Q ${r(s.x1)} ${r(s.y1)} ${r(s.x)} ${r(s.y)}`); break
      case 'A': parts.push(`A ${r(s.rx)} ${r(s.ry)} ${r(s.rotation)} ${s.largeArc} ${s.sweep} ${r(s.x)} ${r(s.y)}`); break
      case 'Z': parts.push('Z'); break
    }
  }
  return parts.join(' ')
}

/** Get the anchor points from a path (endpoint of each segment) */
export function getAnchors(segs: PathSeg[]): { segIdx: number; pt: PathPoint }[] {
  const anchors: { segIdx: number; pt: PathPoint }[] = []
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i]
    if (s.cmd === 'Z') continue
    anchors.push({ segIdx: i, pt: { x: s.x, y: s.y } })
  }
  return anchors
}

/** Get the control point handles for a segment (for C and Q commands) */
export interface HandleInfo {
  segIdx: number
  /** 'cp1' = first control point, 'cp2' = second (C only) */
  which: 'cp1' | 'cp2'
  pt: PathPoint
  /** The anchor this handle connects to */
  anchorPt: PathPoint
}

export function getHandles(segs: PathSeg[]): HandleInfo[] {
  const handles: HandleInfo[] = []
  let px = 0, py = 0
  for (let i = 0; i < segs.length; i++) {
    const s = segs[i]
    if (s.cmd === 'C') {
      handles.push({ segIdx: i, which: 'cp1', pt: { x: s.x1, y: s.y1 }, anchorPt: { x: px, y: py } })
      handles.push({ segIdx: i, which: 'cp2', pt: { x: s.x2, y: s.y2 }, anchorPt: { x: s.x, y: s.y } })
    } else if (s.cmd === 'Q') {
      handles.push({ segIdx: i, which: 'cp1', pt: { x: s.x1, y: s.y1 }, anchorPt: { x: px, y: py } })
    }
    if (s.cmd !== 'Z') { px = s.x; py = s.y }
  }
  return handles
}

/** Move an anchor point and update adjacent handles proportionally */
export function moveAnchor(segs: PathSeg[], segIdx: number, dx: number, dy: number): PathSeg[] {
  const result = segs.map(s => ({ ...s }))
  const s = result[segIdx]
  if (s.cmd === 'Z') return result

  s.x += dx; s.y += dy

  // Move outgoing handle of this segment (cp2 for C)
  if (s.cmd === 'C') { s.x2 += dx; s.y2 += dy }

  // Move incoming handle of next segment (cp1)
  const next = result[segIdx + 1]
  if (next && next.cmd === 'C') { next.x1 += dx; next.y1 += dy }
  if (next && next.cmd === 'Q') { next.x1 += dx; next.y1 += dy }

  return result
}

/** Move a control point handle */
export function moveHandle(
  segs: PathSeg[], segIdx: number, which: 'cp1' | 'cp2', dx: number, dy: number,
): PathSeg[] {
  const result = segs.map(s => ({ ...s }))
  const s = result[segIdx]
  if (s.cmd === 'C') {
    if (which === 'cp1') { s.x1 += dx; s.y1 += dy }
    else                 { s.x2 += dx; s.y2 += dy }
  } else if (s.cmd === 'Q') {
    if (which === 'cp1') { s.x1 += dx; s.y1 += dy }
  }
  return result
}

/** Delete an anchor point by removing the segment (connects neighbors) */
export function deleteAnchor(segs: PathSeg[], segIdx: number): PathSeg[] {
  if (segs.length <= 2) return segs // Don't delete if too few points
  const result = [...segs]
  const s = result[segIdx]
  if (s.cmd === 'M') {
    // Deleting the starting point: make next segment into M
    if (result.length > 1 && result[1].cmd !== 'Z') {
      const next = result[1]
      result.splice(0, 2, { cmd: 'M', x: next.x, y: next.y })
    }
  } else {
    result.splice(segIdx, 1)
  }
  return result
}

/** Insert a point on a line segment (splits L into two L's, or C into two C's) */
export function splitSegment(segs: PathSeg[], segIdx: number, t: number = 0.5): PathSeg[] {
  const result = [...segs]
  const s = result[segIdx]

  // Find previous endpoint
  let px = 0, py = 0
  for (let i = 0; i < segIdx; i++) {
    const p = segs[i]
    if (p.cmd !== 'Z') { px = p.x; py = p.y }
  }

  if (s.cmd === 'L') {
    const mx = px + (s.x - px) * t
    const my = py + (s.y - py) * t
    result.splice(segIdx, 1,
      { cmd: 'L', x: mx, y: my },
      { cmd: 'L', x: s.x, y: s.y },
    )
  } else if (s.cmd === 'C') {
    // De Casteljau split
    const { x1, y1, x2, y2, x, y } = s
    const ax = px + (x1 - px) * t, ay = py + (y1 - py) * t
    const bx = x1 + (x2 - x1) * t, by = y1 + (y2 - y1) * t
    const cx = x2 + (x - x2) * t, cy2 = y2 + (y - y2) * t
    const dx = ax + (bx - ax) * t, dy = ay + (by - ay) * t
    const ex = bx + (cx - bx) * t, ey = by + (cy2 - by) * t
    const fx = dx + (ex - dx) * t, fy = dy + (ey - dy) * t

    result.splice(segIdx, 1,
      { cmd: 'C', x1: ax, y1: ay, x2: dx, y2: dy, x: fx, y: fy },
      { cmd: 'C', x1: ex, y1: ey, x2: cx, y2: cy2, x, y },
    )
  } else if (s.cmd === 'Q') {
    const { x1, y1, x, y } = s
    const ax = px + (x1 - px) * t, ay = py + (y1 - py) * t
    const bx = x1 + (x - x1) * t, by = y1 + (y - y1) * t
    const mx = ax + (bx - ax) * t, my = ay + (by - ay) * t

    result.splice(segIdx, 1,
      { cmd: 'Q', x1: ax, y1: ay, x: mx, y: my },
      { cmd: 'Q', x1: bx, y1: by, x, y },
    )
  }
  return result
}

/** Convert a smooth node to corner (disconnect handles) or vice versa */
export function toggleNodeType(segs: PathSeg[], segIdx: number): PathSeg[] {
  const result = segs.map(s => ({ ...s }))
  const s = result[segIdx]

  if (s.cmd === 'L') {
    // Convert L to C with default handles
    let px = 0, py = 0
    for (let i = 0; i < segIdx; i++) {
      const p = segs[i]; if (p.cmd !== 'Z') { px = p.x; py = p.y }
    }
    const dx = s.x - px, dy = s.y - py
    result[segIdx] = {
      cmd: 'C',
      x1: px + dx * 0.33, y1: py + dy * 0.33,
      x2: px + dx * 0.67, y2: py + dy * 0.67,
      x: s.x, y: s.y,
    }
  } else if (s.cmd === 'C') {
    // Convert C to L (remove handles)
    result[segIdx] = { cmd: 'L', x: s.x, y: s.y }
  }
  return result
}
