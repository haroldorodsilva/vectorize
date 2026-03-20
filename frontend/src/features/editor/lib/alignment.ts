/**
 * Alignment and distribution utilities for multi-selected SVG elements.
 * All computations happen in SVG coordinate space.
 */

interface SvgBBox { x: number; y: number; w: number; h: number }

/** Get the bounding box of an element in SVG coordinates */
export function getElSvgBBox(
  el: Element,
  svgEl: SVGSVGElement,
  vb: { x: number; y: number; w: number; h: number },
): SvgBBox {
  const svgR = svgEl.getBoundingClientRect()
  const er   = el.getBoundingClientRect()
  const scX  = vb.w / svgR.width
  const scY  = vb.h / svgR.height
  return {
    x: vb.x + (er.left - svgR.left) * scX,
    y: vb.y + (er.top  - svgR.top)  * scY,
    w: er.width  * scX,
    h: er.height * scY,
  }
}

/** Combined bounding box for multiple elements */
export function getCombinedBBox(boxes: SvgBBox[]): SvgBBox {
  if (boxes.length === 0) return { x: 0, y: 0, w: 0, h: 0 }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const b of boxes) {
    if (b.x < minX) minX = b.x
    if (b.y < minY) minY = b.y
    if (b.x + b.w > maxX) maxX = b.x + b.w
    if (b.y + b.h > maxY) maxY = b.y + b.h
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}

/** Apply a translate(dx,dy) composing with existing transform */
function moveEl(el: Element, dx: number, dy: number) {
  if (Math.abs(dx) < 0.01 && Math.abs(dy) < 0.01) return
  const old = el.getAttribute('transform') ?? ''
  const tf = old
    ? `translate(${dx.toFixed(2)}, ${dy.toFixed(2)}) ${old}`
    : `translate(${dx.toFixed(2)}, ${dy.toFixed(2)})`
  el.setAttribute('transform', tf)
}

export function alignLeft(
  els: Element[], svgEl: SVGSVGElement, vb: { x: number; y: number; w: number; h: number },
) {
  const boxes = els.map(el => ({ el, box: getElSvgBBox(el, svgEl, vb) }))
  const minX = Math.min(...boxes.map(b => b.box.x))
  for (const { el, box } of boxes) moveEl(el, minX - box.x, 0)
}

export function alignRight(
  els: Element[], svgEl: SVGSVGElement, vb: { x: number; y: number; w: number; h: number },
) {
  const boxes = els.map(el => ({ el, box: getElSvgBBox(el, svgEl, vb) }))
  const maxR = Math.max(...boxes.map(b => b.box.x + b.box.w))
  for (const { el, box } of boxes) moveEl(el, maxR - (box.x + box.w), 0)
}

export function alignTop(
  els: Element[], svgEl: SVGSVGElement, vb: { x: number; y: number; w: number; h: number },
) {
  const boxes = els.map(el => ({ el, box: getElSvgBBox(el, svgEl, vb) }))
  const minY = Math.min(...boxes.map(b => b.box.y))
  for (const { el, box } of boxes) moveEl(el, 0, minY - box.y)
}

export function alignBottom(
  els: Element[], svgEl: SVGSVGElement, vb: { x: number; y: number; w: number; h: number },
) {
  const boxes = els.map(el => ({ el, box: getElSvgBBox(el, svgEl, vb) }))
  const maxB = Math.max(...boxes.map(b => b.box.y + b.box.h))
  for (const { el, box } of boxes) moveEl(el, 0, maxB - (box.y + box.h))
}

export function alignCenterH(
  els: Element[], svgEl: SVGSVGElement, vb: { x: number; y: number; w: number; h: number },
) {
  const boxes = els.map(el => ({ el, box: getElSvgBBox(el, svgEl, vb) }))
  const combined = getCombinedBBox(boxes.map(b => b.box))
  const centerX = combined.x + combined.w / 2
  for (const { el, box } of boxes) moveEl(el, centerX - (box.x + box.w / 2), 0)
}

export function alignCenterV(
  els: Element[], svgEl: SVGSVGElement, vb: { x: number; y: number; w: number; h: number },
) {
  const boxes = els.map(el => ({ el, box: getElSvgBBox(el, svgEl, vb) }))
  const combined = getCombinedBBox(boxes.map(b => b.box))
  const centerY = combined.y + combined.h / 2
  for (const { el, box } of boxes) moveEl(el, 0, centerY - (box.y + box.h / 2))
}

export function distributeH(
  els: Element[], svgEl: SVGSVGElement, vb: { x: number; y: number; w: number; h: number },
) {
  if (els.length < 3) return
  const items = els.map(el => ({ el, box: getElSvgBBox(el, svgEl, vb) }))
  items.sort((a, b) => a.box.x - b.box.x)
  const first = items[0].box.x
  const last  = items[items.length - 1].box.x + items[items.length - 1].box.w
  const totalW = items.reduce((s, i) => s + i.box.w, 0)
  const gap = (last - first - totalW) / (items.length - 1)
  let cx = first
  for (const item of items) {
    moveEl(item.el, cx - item.box.x, 0)
    cx += item.box.w + gap
  }
}

export function distributeV(
  els: Element[], svgEl: SVGSVGElement, vb: { x: number; y: number; w: number; h: number },
) {
  if (els.length < 3) return
  const items = els.map(el => ({ el, box: getElSvgBBox(el, svgEl, vb) }))
  items.sort((a, b) => a.box.y - b.box.y)
  const first = items[0].box.y
  const last  = items[items.length - 1].box.y + items[items.length - 1].box.h
  const totalH = items.reduce((s, i) => s + i.box.h, 0)
  const gap = (last - first - totalH) / (items.length - 1)
  let cy = first
  for (const item of items) {
    moveEl(item.el, 0, cy - item.box.y)
    cy += item.box.h + gap
  }
}
