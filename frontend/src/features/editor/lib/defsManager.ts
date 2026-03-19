/**
 * Manage <defs> section in the SVG for gradients, filters, patterns, etc.
 */

/** Ensure the SVG has a <defs> element, return it */
export function ensureDefs(svg: SVGSVGElement): SVGDefsElement {
  let defs = svg.querySelector('defs')
  if (!defs) {
    defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs')
    svg.insertBefore(defs, svg.firstChild)
  }
  return defs as SVGDefsElement
}

/** Add or update an element in <defs> by ID */
export function upsertDef(svg: SVGSVGElement, el: SVGElement): void {
  const defs = ensureDefs(svg)
  const id = el.getAttribute('id')
  if (id) {
    const existing = defs.querySelector(`#${CSS.escape(id)}`)
    if (existing) existing.replaceWith(el)
    else defs.appendChild(el)
  } else {
    defs.appendChild(el)
  }
}

/** Remove a def by ID */
export function removeDef(svg: SVGSVGElement, id: string): void {
  const defs = svg.querySelector('defs')
  if (!defs) return
  const el = defs.querySelector(`#${CSS.escape(id)}`)
  if (el) el.remove()
}

/** Generate unique ID for gradient/filter/pattern */
let counter = 0
export function genDefId(prefix: string = 'def'): string {
  return `${prefix}-${Date.now().toString(36)}-${(counter++).toString(36)}`
}

/** Create a linear gradient definition */
export function createLinearGradient(
  id: string,
  stops: Array<{ offset: number; color: string; opacity?: number }>,
  angle: number = 0,
): SVGLinearGradientElement {
  const ns = 'http://www.w3.org/2000/svg'
  const grad = document.createElementNS(ns, 'linearGradient') as SVGLinearGradientElement
  grad.setAttribute('id', id)
  grad.setAttribute('gradientUnits', 'objectBoundingBox')

  // Convert angle to x1,y1,x2,y2
  const rad = (angle * Math.PI) / 180
  const x1 = 0.5 - Math.cos(rad) * 0.5
  const y1 = 0.5 - Math.sin(rad) * 0.5
  const x2 = 0.5 + Math.cos(rad) * 0.5
  const y2 = 0.5 + Math.sin(rad) * 0.5
  grad.setAttribute('x1', x1.toFixed(4))
  grad.setAttribute('y1', y1.toFixed(4))
  grad.setAttribute('x2', x2.toFixed(4))
  grad.setAttribute('y2', y2.toFixed(4))

  for (const s of stops) {
    const stop = document.createElementNS(ns, 'stop')
    stop.setAttribute('offset', `${Math.round(s.offset * 100)}%`)
    stop.setAttribute('stop-color', s.color)
    if (s.opacity !== undefined && s.opacity !== 1) stop.setAttribute('stop-opacity', String(s.opacity))
    grad.appendChild(stop)
  }
  return grad
}

/** Create a radial gradient definition */
export function createRadialGradient(
  id: string,
  stops: Array<{ offset: number; color: string; opacity?: number }>,
  cx = 0.5, cy = 0.5, r = 0.5,
): SVGRadialGradientElement {
  const ns = 'http://www.w3.org/2000/svg'
  const grad = document.createElementNS(ns, 'radialGradient') as SVGRadialGradientElement
  grad.setAttribute('id', id)
  grad.setAttribute('gradientUnits', 'objectBoundingBox')
  grad.setAttribute('cx', cx.toFixed(4))
  grad.setAttribute('cy', cy.toFixed(4))
  grad.setAttribute('r', r.toFixed(4))

  for (const s of stops) {
    const stop = document.createElementNS(ns, 'stop')
    stop.setAttribute('offset', `${Math.round(s.offset * 100)}%`)
    stop.setAttribute('stop-color', s.color)
    if (s.opacity !== undefined && s.opacity !== 1) stop.setAttribute('stop-opacity', String(s.opacity))
    grad.appendChild(stop)
  }
  return grad
}
