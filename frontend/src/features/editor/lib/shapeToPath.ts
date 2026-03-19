/**
 * Convert SVG shape elements (rect, ellipse, circle, line, polygon) to path `d` strings.
 * Required before boolean operations since Paper.js works with paths only.
 */

/** Convert any shape element to a path d string */
export function shapeToPathD(el: Element): string | null {
  const tag = el.tagName.toLowerCase()

  if (tag === 'path') return el.getAttribute('d')

  if (tag === 'rect') {
    const x = parseFloat(el.getAttribute('x') ?? '0')
    const y = parseFloat(el.getAttribute('y') ?? '0')
    const w = parseFloat(el.getAttribute('width') ?? '0')
    const h = parseFloat(el.getAttribute('height') ?? '0')
    const rx = parseFloat(el.getAttribute('rx') ?? '0')
    const ry = parseFloat(el.getAttribute('ry') ?? '0')
    if (rx > 0 || ry > 0) {
      const r = Math.min(rx || ry, w / 2, h / 2)
      return `M ${x + r} ${y} L ${x + w - r} ${y} A ${r} ${r} 0 0 1 ${x + w} ${y + r} L ${x + w} ${y + h - r} A ${r} ${r} 0 0 1 ${x + w - r} ${y + h} L ${x + r} ${y + h} A ${r} ${r} 0 0 1 ${x} ${y + h - r} L ${x} ${y + r} A ${r} ${r} 0 0 1 ${x + r} ${y} Z`
    }
    return `M ${x} ${y} L ${x + w} ${y} L ${x + w} ${y + h} L ${x} ${y + h} Z`
  }

  if (tag === 'ellipse') {
    const cx = parseFloat(el.getAttribute('cx') ?? '0')
    const cy = parseFloat(el.getAttribute('cy') ?? '0')
    const rx = parseFloat(el.getAttribute('rx') ?? '0')
    const ry = parseFloat(el.getAttribute('ry') ?? '0')
    return `M ${cx - rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx + rx} ${cy} A ${rx} ${ry} 0 1 0 ${cx - rx} ${cy} Z`
  }

  if (tag === 'circle') {
    const cx = parseFloat(el.getAttribute('cx') ?? '0')
    const cy = parseFloat(el.getAttribute('cy') ?? '0')
    const r = parseFloat(el.getAttribute('r') ?? '0')
    return `M ${cx - r} ${cy} A ${r} ${r} 0 1 0 ${cx + r} ${cy} A ${r} ${r} 0 1 0 ${cx - r} ${cy} Z`
  }

  if (tag === 'line') {
    const x1 = parseFloat(el.getAttribute('x1') ?? '0')
    const y1 = parseFloat(el.getAttribute('y1') ?? '0')
    const x2 = parseFloat(el.getAttribute('x2') ?? '0')
    const y2 = parseFloat(el.getAttribute('y2') ?? '0')
    return `M ${x1} ${y1} L ${x2} ${y2}`
  }

  if (tag === 'polygon' || tag === 'polyline') {
    const pts = el.getAttribute('points')?.trim()
    if (!pts) return null
    const pairs = pts.split(/\s+|,/).reduce<number[]>((acc, v) => {
      const n = parseFloat(v)
      if (!isNaN(n)) acc.push(n)
      return acc
    }, [])
    if (pairs.length < 4) return null
    const parts = [`M ${pairs[0]} ${pairs[1]}`]
    for (let i = 2; i < pairs.length; i += 2) {
      parts.push(`L ${pairs[i]} ${pairs[i + 1]}`)
    }
    if (tag === 'polygon') parts.push('Z')
    return parts.join(' ')
  }

  return null
}

/** Convert shape element to a <path> element, preserving attributes */
export function shapeToPathEl(el: Element): SVGPathElement | null {
  const d = shapeToPathD(el)
  if (!d) return null

  const ns = 'http://www.w3.org/2000/svg'
  const path = document.createElementNS(ns, 'path') as SVGPathElement
  path.setAttribute('d', d)

  // Copy visual attributes
  for (const attr of ['fill', 'stroke', 'stroke-width', 'opacity', 'transform',
    'data-region', 'data-drawn', 'data-icon', 'class', 'style']) {
    const v = el.getAttribute(attr)
    if (v) path.setAttribute(attr, v)
  }

  return path
}
