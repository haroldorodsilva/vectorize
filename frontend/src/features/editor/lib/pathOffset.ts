/**
 * Convert stroke to filled path (outline stroke).
 * Takes a path with stroke and creates a new path that is the filled outline.
 * Uses SVG's built-in stroke-to-path via a temporary SVG + getComputedStyle.
 */

/**
 * Convert element's stroke to a filled outline path.
 * Creates a temporary SVG, renders the element, and extracts the outline.
 */
export function outlineStroke(el: Element, _svg: SVGSVGElement): SVGPathElement | null {
  const tag = el.tagName.toLowerCase()
  if (tag !== 'path' && tag !== 'line' && tag !== 'polyline' && tag !== 'polygon'
    && tag !== 'rect' && tag !== 'ellipse' && tag !== 'circle') return null

  const stroke = el.getAttribute('stroke')
  const sw = parseFloat(el.getAttribute('stroke-width') ?? '0')
  if (!stroke || stroke === 'none' || sw <= 0) return null

  // Clone the element and place in a temp SVG for measurement
  const ns = 'http://www.w3.org/2000/svg'

  // For simple shapes, we can create an expanded/contracted copy
  if (tag === 'rect') {
    const x = parseFloat(el.getAttribute('x') ?? '0')
    const y = parseFloat(el.getAttribute('y') ?? '0')
    const w = parseFloat(el.getAttribute('width') ?? '0')
    const h = parseFloat(el.getAttribute('height') ?? '0')
    const half = sw / 2

    // Create outer and inner rects as a compound path
    const outer = `M ${x - half} ${y - half} L ${x + w + half} ${y - half} L ${x + w + half} ${y + h + half} L ${x - half} ${y + h + half} Z`
    const inner = `M ${x + half} ${y + half} L ${x + w - half} ${y + half} L ${x + w - half} ${y + h - half} L ${x + half} ${y + h - half} Z`

    const path = document.createElementNS(ns, 'path') as SVGPathElement
    path.setAttribute('d', `${outer} ${inner}`)
    path.setAttribute('fill', stroke)
    path.setAttribute('fill-rule', 'evenodd')
    path.setAttribute('data-region', String(Date.now()))
    path.setAttribute('data-drawn', '1')
    return path
  }

  if (tag === 'ellipse' || tag === 'circle') {
    const cx = parseFloat(el.getAttribute('cx') ?? '0')
    const cy = parseFloat(el.getAttribute('cy') ?? '0')
    let rx = parseFloat(el.getAttribute('rx') ?? el.getAttribute('r') ?? '0')
    let ry = parseFloat(el.getAttribute('ry') ?? el.getAttribute('r') ?? '0')
    const half = sw / 2

    const outerRx = rx + half, outerRy = ry + half
    const innerRx = Math.max(0, rx - half), innerRy = Math.max(0, ry - half)

    const outer = `M ${cx - outerRx} ${cy} A ${outerRx} ${outerRy} 0 1 0 ${cx + outerRx} ${cy} A ${outerRx} ${outerRy} 0 1 0 ${cx - outerRx} ${cy} Z`
    const inner = innerRx > 0 && innerRy > 0
      ? `M ${cx - innerRx} ${cy} A ${innerRx} ${innerRy} 0 1 0 ${cx + innerRx} ${cy} A ${innerRx} ${innerRy} 0 1 0 ${cx - innerRx} ${cy} Z`
      : ''

    const path = document.createElementNS(ns, 'path') as SVGPathElement
    path.setAttribute('d', `${outer} ${inner}`.trim())
    path.setAttribute('fill', stroke)
    path.setAttribute('fill-rule', 'evenodd')
    path.setAttribute('data-region', String(Date.now()))
    path.setAttribute('data-drawn', '1')
    return path
  }

  // For paths/lines: approximate by duplicating with thicker stroke converted to fill
  // This is a simplified approach - a full implementation would use Paper.js offset
  return null
}

/**
 * Expand or contract a shape by a given offset distance.
 * Positive = expand, Negative = contract.
 */
export function offsetShape(el: Element, offset: number, _svg: SVGSVGElement): SVGPathElement | null {
  const tag = el.tagName.toLowerCase()
  const ns = 'http://www.w3.org/2000/svg'

  if (tag === 'rect') {
    const x = parseFloat(el.getAttribute('x') ?? '0') - offset
    const y = parseFloat(el.getAttribute('y') ?? '0') - offset
    const w = parseFloat(el.getAttribute('width') ?? '0') + offset * 2
    const h = parseFloat(el.getAttribute('height') ?? '0') + offset * 2
    if (w <= 0 || h <= 0) return null

    const path = document.createElementNS(ns, 'path') as SVGPathElement
    path.setAttribute('d', `M ${x} ${y} L ${x + w} ${y} L ${x + w} ${y + h} L ${x} ${y + h} Z`)
    path.setAttribute('fill', el.getAttribute('fill') ?? '#ffffff')
    const stroke = el.getAttribute('stroke')
    if (stroke && stroke !== 'none') { path.setAttribute('stroke', stroke); path.setAttribute('stroke-width', el.getAttribute('stroke-width') ?? '1') }
    path.setAttribute('data-region', String(Date.now()))
    path.setAttribute('data-drawn', '1')
    return path
  }

  if (tag === 'ellipse' || tag === 'circle') {
    const cx = parseFloat(el.getAttribute('cx') ?? '0')
    const cy = parseFloat(el.getAttribute('cy') ?? '0')
    const rx = parseFloat(el.getAttribute('rx') ?? el.getAttribute('r') ?? '0') + offset
    const ry = parseFloat(el.getAttribute('ry') ?? el.getAttribute('r') ?? '0') + offset
    if (rx <= 0 || ry <= 0) return null

    const path = document.createElementNS(ns, 'path') as SVGPathElement
    path.setAttribute('d', `M ${cx - rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx - rx} ${cy} Z`)
    path.setAttribute('fill', el.getAttribute('fill') ?? '#ffffff')
    path.setAttribute('data-region', String(Date.now()))
    path.setAttribute('data-drawn', '1')
    return path
  }

  return null
}
