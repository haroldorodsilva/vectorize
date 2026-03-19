/**
 * Manage SVG filters: drop shadow, blur, and blend modes.
 */
import { ensureDefs, genDefId } from './defsManager'

/** Create a drop shadow filter */
export function createDropShadowFilter(
  id: string,
  dx = 2, dy = 2, blur = 3, color = '#000000', opacity = 0.3,
): SVGFilterElement {
  const ns = 'http://www.w3.org/2000/svg'
  const filter = document.createElementNS(ns, 'filter') as SVGFilterElement
  filter.setAttribute('id', id)
  filter.setAttribute('x', '-50%'); filter.setAttribute('y', '-50%')
  filter.setAttribute('width', '200%'); filter.setAttribute('height', '200%')

  const shadow = document.createElementNS(ns, 'feDropShadow')
  shadow.setAttribute('dx', String(dx))
  shadow.setAttribute('dy', String(dy))
  shadow.setAttribute('stdDeviation', String(blur))
  shadow.setAttribute('flood-color', color)
  shadow.setAttribute('flood-opacity', String(opacity))
  filter.appendChild(shadow)
  return filter
}

/** Create a Gaussian blur filter */
export function createBlurFilter(id: string, radius = 3): SVGFilterElement {
  const ns = 'http://www.w3.org/2000/svg'
  const filter = document.createElementNS(ns, 'filter') as SVGFilterElement
  filter.setAttribute('id', id)

  const blur = document.createElementNS(ns, 'feGaussianBlur')
  blur.setAttribute('in', 'SourceGraphic')
  blur.setAttribute('stdDeviation', String(radius))
  filter.appendChild(blur)
  return filter
}

/** Apply a filter to an element */
export function applyFilter(el: Element, svg: SVGSVGElement, filterEl: SVGFilterElement): string {
  const defs = ensureDefs(svg)
  const id = filterEl.getAttribute('id')!
  const existing = defs.querySelector(`#${CSS.escape(id)}`)
  if (existing) existing.replaceWith(filterEl)
  else defs.appendChild(filterEl)
  el.setAttribute('filter', `url(#${id})`)
  return id
}

/** Remove filter from element and clean up defs */
export function removeFilter(el: Element, svg: SVGSVGElement) {
  const filterUrl = el.getAttribute('filter')
  if (!filterUrl) return
  const match = filterUrl.match(/url\(#(.+)\)/)
  if (match) {
    const defs = svg.querySelector('defs')
    defs?.querySelector(`#${CSS.escape(match[1])}`)?.remove()
  }
  el.removeAttribute('filter')
}

/** Get current filter ID for an element */
export function getFilterId(el: Element): string | null {
  const f = el.getAttribute('filter')
  if (!f) return null
  const m = f.match(/url\(#(.+)\)/)
  return m ? m[1] : null
}

/** Set blend mode on element */
export function setBlendMode(el: Element, mode: string) {
  if (mode === 'normal') {
    el.removeAttribute('style')
  } else {
    el.setAttribute('style', `mix-blend-mode: ${mode}`)
  }
}

export { genDefId }
