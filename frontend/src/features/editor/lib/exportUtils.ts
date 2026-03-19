/**
 * Export utilities: SVGO optimization, multi-scale PNG, PDF, clipboard.
 */
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

/** Export SVG as PNG at given scale */
export async function exportPng(
  svgEl: SVGSVGElement,
  origVb: { x: number; y: number; w: number; h: number },
  curVb: { x: number; y: number; w: number; h: number },
  scale: number = 1,
  transparent: boolean = false,
): Promise<Blob> {
  // Clone and clean: remove CSS display styles that mess up export rendering
  const clone = svgEl.cloneNode(true) as SVGSVGElement
  clone.removeAttribute('style')
  clone.setAttribute('viewBox', `${curVb.x} ${curVb.y} ${curVb.w} ${curVb.h}`)
  clone.setAttribute('width', String(Math.round(curVb.w)))
  clone.setAttribute('height', String(Math.round(curVb.h)))
  clone.querySelector('[data-sel]')?.removeAttribute('data-sel')

  if (transparent) {
    clone.querySelectorAll('[data-region]').forEach(p => {
      const f = p.getAttribute('fill')
      if (!f || f === '#FFFFFF' || f === '#ffffff') p.setAttribute('fill', 'none')
    })
  }

  const data = new XMLSerializer().serializeToString(clone)
  const w = Math.round(curVb.w * scale)
  const h = Math.round(curVb.h * scale)

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

/** Export SVG as PDF using jsPDF */
export async function exportPdf(
  svgEl: SVGSVGElement,
  origVb: { x: number; y: number; w: number; h: number },
  curVb: { x: number; y: number; w: number; h: number },
): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const pngBlob = await exportPng(svgEl, origVb, curVb, 2, false)
  const pngUrl = URL.createObjectURL(pngBlob)

  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const landscape = origVb.w > origVb.h
      const doc = new jsPDF({
        orientation: landscape ? 'landscape' : 'portrait',
        unit: 'px',
        format: [origVb.w, origVb.h],
      })
      doc.addImage(img, 'PNG', 0, 0, origVb.w, origVb.h)
      const blob = doc.output('blob')
      URL.revokeObjectURL(pngUrl)
      resolve(blob)
    }
    img.onerror = reject
    img.src = pngUrl
  })
}

/** Copy SVG to clipboard */
export async function copySvgToClipboard(svgEl: SVGSVGElement, doOptimize: boolean = true): Promise<void> {
  const clone = svgEl.cloneNode(true) as SVGSVGElement
  clone.querySelector('[data-sel]')?.removeAttribute('data-sel')
  let svgStr = new XMLSerializer().serializeToString(clone)
  if (doOptimize) svgStr = await optimizeSvg(svgStr)
  await navigator.clipboard.writeText(svgStr)
}

/** Export only selected elements as SVG */
export function exportSelectedSvg(
  els: Element[],
  svgEl: SVGSVGElement,
  vb: { x: number; y: number; w: number; h: number },
): string {
  if (els.length === 0) return ''

  // Compute tight bounding box of selected elements
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

  // Build SVG with only selected elements
  const ns = 'http://www.w3.org/2000/svg'
  const svg = document.createElementNS(ns, 'svg') as SVGSVGElement
  svg.setAttribute('xmlns', ns)
  svg.setAttribute('viewBox', `${bx} ${by} ${bw} ${bh}`)
  svg.setAttribute('width', String(Math.round(bw)))
  svg.setAttribute('height', String(Math.round(bh)))

  // Copy defs if present
  const defs = svgEl.querySelector('defs')
  if (defs) svg.appendChild(defs.cloneNode(true))

  // Clone selected elements
  for (const el of els) {
    svg.appendChild(el.cloneNode(true))
  }

  return new XMLSerializer().serializeToString(svg)
}

/** Download a blob as a file */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}
