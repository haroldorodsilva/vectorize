/**
 * Clipping mask: use one shape to clip another.
 * The first selected element is the content, the second is the mask shape.
 */
import { ensureDefs } from './defsManager'

let clipCounter = 0

/**
 * Apply a clipping mask: el1 (content) is clipped by el2 (mask shape).
 * Creates a <clipPath> in defs and applies it to el1.
 * el2 is moved into the clipPath definition.
 */
export function applyClipMask(
  content: Element,
  mask: Element,
  svg: SVGSVGElement,
): boolean {
  const ns = 'http://www.w3.org/2000/svg'
  const defs = ensureDefs(svg)

  const id = `clip-${Date.now().toString(36)}-${clipCounter++}`
  const clipPath = document.createElementNS(ns, 'clipPath')
  clipPath.setAttribute('id', id)

  // Clone mask into clipPath (keep original position)
  const maskClone = mask.cloneNode(true) as Element
  // Remove visual attributes that don't apply to clip
  maskClone.removeAttribute('fill')
  maskClone.removeAttribute('stroke')
  maskClone.removeAttribute('stroke-width')
  maskClone.removeAttribute('opacity')
  maskClone.removeAttribute('data-sel')
  clipPath.appendChild(maskClone)
  defs.appendChild(clipPath)

  // Apply clip to content
  content.setAttribute('clip-path', `url(#${id})`)

  // Remove the mask element from canvas
  mask.remove()

  return true
}

/**
 * Remove clipping mask from an element.
 */
export function removeClipMask(el: Element, svg: SVGSVGElement): boolean {
  const clipAttr = el.getAttribute('clip-path')
  if (!clipAttr) return false

  const match = clipAttr.match(/url\(#(.+)\)/)
  if (match) {
    const defs = svg.querySelector('defs')
    defs?.querySelector(`#${CSS.escape(match[1])}`)?.remove()
  }

  el.removeAttribute('clip-path')
  return true
}
