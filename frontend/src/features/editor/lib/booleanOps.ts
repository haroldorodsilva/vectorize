/**
 * Boolean operations on SVG paths using Paper.js (headless).
 * Paper.js runs on an offscreen canvas — never renders to screen.
 */
import paper from 'paper'
import { shapeToPathD } from './shapeToPath'

// Initialize Paper.js headless (once)
let initialized = false
function ensurePaper() {
  if (initialized) return
  const canvas = document.createElement('canvas')
  canvas.width = 100; canvas.height = 100
  paper.setup(canvas)
  initialized = true
}

type BoolOp = 'unite' | 'subtract' | 'intersect' | 'exclude'

/**
 * Convert an SVG path d string to a Paper.js Path.
 * Handles arcs by importing as SVG (Paper.js can parse SVG paths natively).
 */
function pathFromD(d: string): paper.PathItem {
  // Use importSVG to properly handle arcs and complex paths
  const svgStr = `<svg><path d="${d}"/></svg>`
  const item = paper.project.importSVG(svgStr, { insert: false })
  // importSVG returns a Group → find the path inside
  let pathItem: paper.PathItem | null = null
  if (item instanceof paper.Group) {
    for (const child of item.children) {
      if (child instanceof paper.Path || child instanceof paper.CompoundPath) {
        pathItem = child as paper.PathItem
        break
      }
    }
  } else if (item instanceof paper.Path || item instanceof paper.CompoundPath) {
    pathItem = item as paper.PathItem
  }

  if (!pathItem) {
    // Fallback: try direct construction
    return new paper.Path(d)
  }
  return pathItem
}

/**
 * Perform a boolean operation on two SVG elements.
 * Returns the resulting path `d` string, or null on failure.
 */
export function booleanOp(el1: Element, el2: Element, op: BoolOp): string | null {
  ensurePaper()

  const d1 = shapeToPathD(el1)
  const d2 = shapeToPathD(el2)
  if (!d1 || !d2) {
    console.warn('[booleanOp] Could not extract path d from elements', el1.tagName, el2.tagName)
    return null
  }

  try {
    const p1 = pathFromD(d1)
    const p2 = pathFromD(d2)

    // Apply transforms if elements have them
    const t1 = el1.getAttribute('transform')
    const t2 = el2.getAttribute('transform')
    if (t1) applyTransformString(p1, t1)
    if (t2) applyTransformString(p2, t2)

    let result: paper.PathItem
    switch (op) {
      case 'unite':    result = p1.unite(p2); break
      case 'subtract': result = p1.subtract(p2); break
      case 'intersect': result = p1.intersect(p2); break
      case 'exclude':  result = p1.exclude(p2); break
    }

    const pathData = result.pathData
    // Cleanup
    p1.remove(); p2.remove(); result.remove()

    if (!pathData || pathData === 'M0,0') {
      console.warn('[booleanOp] Empty result')
      return null
    }

    return pathData
  } catch (err) {
    console.error('[booleanOp] Error:', err)
    return null
  }
}

/** Parse a simple SVG transform string and apply to a Paper.js item */
function applyTransformString(item: paper.Item, tf: string) {
  // Extract translate(x, y) values
  const translateMatch = tf.match(/translate\(\s*([^,\s]+)[\s,]+([^)]+)\)/)
  if (translateMatch) {
    item.translate(new paper.Point(parseFloat(translateMatch[1]), parseFloat(translateMatch[2])))
  }
  const scaleMatch = tf.match(/scale\(\s*([^,\s]+)(?:[\s,]+([^)]+))?\)/)
  if (scaleMatch) {
    const sx = parseFloat(scaleMatch[1])
    const sy = scaleMatch[2] ? parseFloat(scaleMatch[2]) : sx
    item.scale(sx, sy)
  }
}

/**
 * Perform boolean operation on two SVG elements in the DOM.
 * Replaces both elements with a single new <path> element.
 * Returns the new element or null.
 */
export function applyBooleanOp(
  el1: Element, el2: Element, op: BoolOp, _svg: SVGSVGElement,
): SVGPathElement | null {
  const d = booleanOp(el1, el2, op)
  if (!d) return null

  const ns = 'http://www.w3.org/2000/svg'
  const path = document.createElementNS(ns, 'path') as SVGPathElement
  path.setAttribute('d', d)
  path.setAttribute('fill', el1.getAttribute('fill') ?? '#ffffff')
  path.setAttribute('data-region', String(Date.now()))
  path.setAttribute('data-drawn', '1')

  // Copy stroke from first element
  const stroke = el1.getAttribute('stroke')
  if (stroke && stroke !== 'none') path.setAttribute('stroke', stroke)
  const sw = el1.getAttribute('stroke-width')
  if (sw) path.setAttribute('stroke-width', sw)

  // Insert before first element, then remove both
  el1.parentNode?.insertBefore(path, el1)
  el1.remove()
  el2.remove()

  return path
}
