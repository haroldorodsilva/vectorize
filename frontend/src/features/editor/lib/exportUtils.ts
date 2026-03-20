/**
 * Export utilities: SVG, optimized SVG, multi-scale PNG, PDF, clipboard.
 */

type ViewBox = { x: number; y: number; w: number; h: number }

/** Download a blob as a file (appends <a> to DOM for cross-browser compat) */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/** Clone SVG element cleaned for export (no inline styles, no selection markers) */
function cloneForExport(svgEl: SVGSVGElement, vb: ViewBox): SVGSVGElement {
  const clone = svgEl.cloneNode(true) as SVGSVGElement
  clone.removeAttribute('style')
  clone.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.w} ${vb.h}`)
  clone.setAttribute('width', String(Math.round(vb.w)))
  clone.setAttribute('height', String(Math.round(vb.h)))
  clone.querySelector('[data-sel]')?.removeAttribute('data-sel')
  // Remove editor-only attributes
  clone.querySelectorAll('[data-base-transform]').forEach(el => el.removeAttribute('data-base-transform'))
  return clone
}

/** Serialize SVG element to string */
function serializeSvg(svgEl: SVGSVGElement): string {
  return new XMLSerializer().serializeToString(svgEl)
}

/** Optimize SVG string with SVGO (lazy loaded) */
export async function optimizeSvg(svgString: string): Promise<string> {
  try {
    const { optimize } = await import('svgo')
    const result = optimize(svgString, {
      multipass: true,
      plugins: [
        'removeDoctype', 'removeXMLProcInst', 'removeComments', 'removeMetadata',
        'cleanupAttrs', 'mergeStyles', 'minifyStyles', 'removeUselessDefs',
        'cleanupNumericValues', 'convertColors', 'removeEmptyText',
        'removeEmptyContainers', 'convertPathData', 'convertTransform',
        'removeEmptyAttrs', 'sortAttrs',
      ],
    })
    return result.data
  } catch {
    return svgString
  }
}

/** Export raw SVG */
export function exportSvg(svgEl: SVGSVGElement, vb: ViewBox, filename = 'vetorizado.svg') {
  const clone = cloneForExport(svgEl, vb)
  const blob = new Blob([serializeSvg(clone)], { type: 'image/svg+xml' })
  downloadBlob(blob, filename)
}

/** Export optimized SVG */
export async function exportSvgOptimized(svgEl: SVGSVGElement, vb: ViewBox, filename = 'otimizado.svg') {
  const clone = cloneForExport(svgEl, vb)
  const optimized = await optimizeSvg(serializeSvg(clone))
  downloadBlob(new Blob([optimized], { type: 'image/svg+xml' }), filename)
}

/** Export SVG as PNG at given scale */
export async function exportPng(
  svgEl: SVGSVGElement,
  vb: ViewBox,
  scale: number = 1,
  transparent: boolean = false,
): Promise<Blob> {
  const clone = cloneForExport(svgEl, vb)

  if (transparent) {
    clone.querySelectorAll('[data-region]').forEach(p => {
      const f = p.getAttribute('fill')
      if (!f || f === '#FFFFFF' || f === '#ffffff') p.setAttribute('fill', 'none')
    })
  }

  const data = serializeSvg(clone)
  const w = Math.round(vb.w * scale)
  const h = Math.round(vb.h * scale)

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(new Blob([data], { type: 'image/svg+xml;charset=utf-8' }))
    const img = new Image()
    img.onload = () => {
      const cv = document.createElement('canvas')
      cv.width = w; cv.height = h
      const ctx = cv.getContext('2d')!
      if (!transparent) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h) }
      ctx.drawImage(img, 0, 0, w, h)
      URL.revokeObjectURL(url)
      cv.toBlob(blob => blob ? resolve(blob) : reject(new Error('Canvas toBlob failed')), 'image/png')
    }
    img.onerror = reject
    img.src = url
  })
}

/** Export and download PNG at given scale */
export async function exportPngDownload(
  svgEl: SVGSVGElement,
  vb: ViewBox,
  scale: number = 1,
  transparent: boolean = false,
) {
  const blob = await exportPng(svgEl, vb, scale, transparent)
  const name = transparent ? 'transparente.png' : `vetorizado-${scale}x.png`
  downloadBlob(blob, name)
}

/** Export SVG as PDF using jsPDF */
export async function exportPdf(
  svgEl: SVGSVGElement,
  vb: ViewBox,
) {
  const { jsPDF } = await import('jspdf')
  const pngBlob = await exportPng(svgEl, vb, 2, false)
  const pngUrl = URL.createObjectURL(pngBlob)

  return new Promise<void>((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const landscape = vb.w > vb.h
      const doc = new jsPDF({
        orientation: landscape ? 'landscape' : 'portrait',
        unit: 'px',
        format: [vb.w, vb.h],
      })
      doc.addImage(img, 'PNG', 0, 0, vb.w, vb.h)
      const blob = doc.output('blob')
      URL.revokeObjectURL(pngUrl)
      downloadBlob(blob, 'vetorizado.pdf')
      resolve()
    }
    img.onerror = reject
    img.src = pngUrl
  })
}

/** Copy SVG to clipboard */
export async function copySvgToClipboard(svgEl: SVGSVGElement, doOptimize: boolean = true): Promise<void> {
  const clone = svgEl.cloneNode(true) as SVGSVGElement
  clone.querySelector('[data-sel]')?.removeAttribute('data-sel')
  let svgStr = serializeSvg(clone)
  if (doOptimize) svgStr = await optimizeSvg(svgStr)
  await navigator.clipboard.writeText(svgStr)
}

/** Export only selected elements as SVG */
export function exportSelectedSvg(
  els: Element[],
  svgEl: SVGSVGElement,
  vb: ViewBox,
): string {
  if (els.length === 0) return ''

  const svgR = svgEl.getBoundingClientRect()
  const scX = vb.w / svgR.width, scY = vb.h / svgR.height
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const el of els) {
    const r = el.getBoundingClientRect()
    const ex = vb.x + (r.left - svgR.left) * scX
    const ey = vb.y + (r.top - svgR.top) * scY
    const ew = r.width * scX, eh = r.height * scY
    if (ex < minX) minX = ex
    if (ey < minY) minY = ey
    if (ex + ew > maxX) maxX = ex + ew
    if (ey + eh > maxY) maxY = ey + eh
  }
  const pad = 2
  const bx = minX - pad, by = minY - pad
  const bw = maxX - minX + pad * 2, bh = maxY - minY + pad * 2

  const ns = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(ns, 'svg') as SVGSVGElement
  svg.setAttribute('xmlns', ns)
  svg.setAttribute('viewBox', `${bx} ${by} ${bw} ${bh}`)
  svg.setAttribute('width', String(Math.round(bw)))
  svg.setAttribute('height', String(Math.round(bh)))

  const defs = svgEl.querySelector('defs')
  if (defs) svg.appendChild(defs.cloneNode(true))

  for (const el of els) {
    svg.appendChild(el.cloneNode(true))
  }

  return serializeSvg(svg)
}
