import { useCallback, useRef } from 'react'
import type { ViewBox, ColorMapEntry, UndoEntry } from '@/shared/types'

// Display state: CSS-based zoom/pan (page scales with zoom)
interface DisplayState { baseW: number; baseH: number; scale: number; tx: number; ty: number }

export function useEditor() {
  const boxRef      = useRef<HTMLDivElement>(null)
  const vbRef       = useRef<ViewBox | null>(null)
  const origVbRef   = useRef<ViewBox | null>(null)
  const displayRef  = useRef<DisplayState | null>(null)
  const undoStack   = useRef<UndoEntry[]>([])
  const redoStack   = useRef<UndoEntry[]>([])

  const getSvg = (): SVGSVGElement | null =>
    boxRef.current?.querySelector('svg') ?? null

  // Apply CSS position/size to SVG element (zoom = element size change, not viewBox)
  const applyDisplay = useCallback(() => {
    const el = getSvg(), d = displayRef.current, box = boxRef.current
    if (!el || !d || !box) return
    const dispW = d.baseW * d.scale
    const dispH = d.baseH * d.scale
    el.style.position = 'absolute'
    el.style.width    = dispW + 'px'
    el.style.height   = dispH + 'px'
    el.style.left     = (box.clientWidth  / 2 - dispW / 2 + d.tx) + 'px'
    el.style.top      = (box.clientHeight / 2 - dispH / 2 + d.ty) + 'px'
  }, [])

  // viewBox is kept fixed; only used for coordinate math and export
  const applyVb = useCallback(() => {
    const el = getSvg(), vb = vbRef.current
    if (el && vb) el.setAttribute('viewBox', `${vb.x} ${vb.y} ${vb.w} ${vb.h}`)
  }, [])

  const clientToSvg = useCallback((cx: number, cy: number) => {
    const el = getSvg(), vb = vbRef.current
    if (!el || !vb) return { x: 0, y: 0 }
    const r = el.getBoundingClientRect()
    return { x: (cx - r.left) / r.width * vb.w + vb.x, y: (cy - r.top) / r.height * vb.h + vb.y }
  }, [])

  // Zoom at screen cursor by scaling SVG element size
  const zoomAt = useCallback((cx: number, cy: number, factor: number) => {
    const el = getSvg(), d = displayRef.current, box = boxRef.current
    if (!el || !d || !box) return
    const svgR  = el.getBoundingClientRect()
    const boxR  = box.getBoundingClientRect()
    const fracX = svgR.width  > 0 ? (cx - svgR.left) / svgR.width  : 0.5
    const fracY = svgR.height > 0 ? (cy - svgR.top)  / svgR.height : 0.5
    const newScale = Math.max(0.04, Math.min(d.scale * factor, 60))
    const newDispW = d.baseW * newScale
    const newDispH = d.baseH * newScale
    // Keep cursor point fixed: newSvgLeft + fracX * newDispW = cx
    const newSvgLeft = cx - fracX * newDispW
    const newSvgTop  = cy - fracY * newDispH
    d.tx    = newSvgLeft - boxR.left - boxR.width  / 2 + newDispW / 2
    d.ty    = newSvgTop  - boxR.top  - boxR.height / 2 + newDispH / 2
    d.scale = newScale
    applyDisplay()
  }, [applyDisplay])

  const resetZoom = useCallback(() => {
    const d = displayRef.current
    if (!d) return
    d.scale = 1; d.tx = 0; d.ty = 0
    applyDisplay()
  }, [applyDisplay])

  // Called after SVG is inserted into DOM
  const initViewBox = useCallback(() => {
    const el = getSvg()
    if (el) {
      // Disable letterboxing so clientToSvg coordinate mapping is always exact
      el.setAttribute('preserveAspectRatio', 'none')

      const bv = el.viewBox.baseVal
      let w = bv.width, h = bv.height, x = bv.x, y = bv.y

      // Fallback: if viewBox is missing or zero, read from width/height attrs
      if (!w || !h) {
        w = parseFloat(el.getAttribute('width')  ?? '0') || el.clientWidth  || 800
        h = parseFloat(el.getAttribute('height') ?? '0') || el.clientHeight || 600
        el.setAttribute('viewBox', `0 0 ${w} ${h}`)
        x = 0; y = 0
      }

      vbRef.current     = { x, y, w, h }
      origVbRef.current = { x, y, w, h }

      // Compute initial fit scale
      const box = boxRef.current
      if (box && w && h) {
        const pad = 80
        const scale = Math.min(
          (box.clientWidth  - pad) / w,
          (box.clientHeight - pad) / h,
          3,
        )
        displayRef.current = { baseW: w, baseH: h, scale, tx: 0, ty: 0 }
        el.removeAttribute('width')
        el.removeAttribute('height')
        applyDisplay()
      }
    }
    undoStack.current = []
    redoStack.current = []
  }, [applyDisplay])

  // ── Undo stack ─────────────────────────────────────────────────────────────
  /** Push undo for a newly-drawn element (undo = remove it). */
  const pushUndo = useCallback((el: Element, prev: string | null) => {
    redoStack.current = [] // New action clears redo
    if (prev === null) {
      undoStack.current.push({ type: 'add', el })
    } else {
      undoStack.current.push({ type: 'attrs', el, attrs: [['fill', prev]] })
    }
  }, [])

  /** Push undo for arbitrary attribute changes (pass attrs snapshot BEFORE the change). */
  const pushUndoAttrs = useCallback((el: Element, attrs: Array<[string, string | null]>) => {
    redoStack.current = [] // New action clears redo
    undoStack.current.push({ type: 'attrs', el, attrs })
  }, [])

  // ── Paint ──────────────────────────────────────────────────────────────────
  const paint = useCallback((el: Element, color: string, erasing: boolean) => {
    const prev = el.getAttribute('fill')
    const next = erasing ? 'none' : color
    if (prev === next) return
    redoStack.current = []
    undoStack.current.push({ type: 'attrs', el, attrs: [['fill', prev ?? '#FFFFFF']] })
    el.setAttribute('fill', next)
    // When erasing, add a thin stroke so the element boundary remains visible
    if (erasing && (!el.getAttribute('stroke') || el.getAttribute('stroke') === 'none')) {
      el.setAttribute('stroke', '#cccccc')
      el.setAttribute('stroke-width', '0.5')
    }
  }, [])

  const undo = useCallback(() => {
    const last = undoStack.current.pop()
    if (!last) return
    if (last.type === 'add') {
      const parent = last.el.parentElement
      const before = last.el.nextElementSibling
      last.el.parentNode?.removeChild(last.el)
      // Push inverse to redo: re-insert
      redoStack.current.push({ type: 'remove', el: last.el, parent: parent!, before })
    } else if (last.type === 'remove') {
      last.parent.insertBefore(last.el, last.before)
      // Push inverse to redo: re-remove
      redoStack.current.push({ type: 'add', el: last.el })
    } else {
      // Save current values for redo before restoring
      const curAttrs: Array<[string, string | null]> = last.attrs.map(
        ([a]) => [a, last.el.getAttribute(a)] as [string, string | null]
      )
      redoStack.current.push({ type: 'attrs', el: last.el, attrs: curAttrs })
      for (const [a, v] of last.attrs) {
        if (v === null) last.el.removeAttribute(a)
        else last.el.setAttribute(a, v)
      }
    }
  }, [])

  const redo = useCallback(() => {
    const last = redoStack.current.pop()
    if (!last) return
    if (last.type === 'add') {
      const parent = last.el.parentElement
      const before = last.el.nextElementSibling
      last.el.parentNode?.removeChild(last.el)
      undoStack.current.push({ type: 'remove', el: last.el, parent: parent!, before })
    } else if (last.type === 'remove') {
      last.parent.insertBefore(last.el, last.before)
      undoStack.current.push({ type: 'add', el: last.el })
    } else {
      const curAttrs: Array<[string, string | null]> = last.attrs.map(
        ([a]) => [a, last.el.getAttribute(a)] as [string, string | null]
      )
      undoStack.current.push({ type: 'attrs', el: last.el, attrs: curAttrs })
      for (const [a, v] of last.attrs) {
        if (v === null) last.el.removeAttribute(a)
        else last.el.setAttribute(a, v)
      }
    }
  }, [])

  const clearColors = useCallback(() => {
    const el = getSvg()
    if (!el) return
    el.querySelectorAll('[data-region]').forEach(p => {
      const prev = p.getAttribute('fill')
      if (prev && prev !== '#FFFFFF') {
        undoStack.current.push({ type: 'attrs', el: p, attrs: [['fill', prev]] })
        p.setAttribute('fill', '#FFFFFF')
      }
    })
  }, [])

  const deleteSelected = useCallback((el: Element) => {
    const parent = el.parentElement
    if (!parent) return
    undoStack.current.push({ type: 'remove', el, parent, before: el.nextElementSibling })
    el.remove()
  }, [])

  // ── Element ordering ───────────────────────────────────────────────────────
  const bringForward = useCallback((el: Element) => {
    const next = el.nextElementSibling
    if (next) next.after(el)
  }, [])

  const sendBack = useCallback((el: Element) => {
    const prev = el.previousElementSibling
    if (prev) prev.before(el)
  }, [])

  const bringToFront = useCallback((el: Element) => {
    el.parentNode?.appendChild(el)
  }, [])

  const sendToBack = useCallback((el: Element) => {
    const parent = el.parentNode
    if (parent) parent.insertBefore(el, parent.firstChild)
  }, [])

  // ── Duplicate ─────────────────────────────────────────────────────────────
  const duplicate = useCallback((el: Element): Element => {
    const clone = el.cloneNode(true) as Element
    clone.removeAttribute('data-sel')
    const tx = parseFloat(clone.getAttribute('data-tx') || '0') + 10
    const ty = parseFloat(clone.getAttribute('data-ty') || '0') + 10
    clone.setAttribute('data-tx', String(tx))
    clone.setAttribute('data-ty', String(ty))
    const existing = clone.getAttribute('transform') ?? ''
    const noTranslate = existing.replace(/translate\s*\([^)]*\)/, '').trim()
    clone.setAttribute('transform', (noTranslate ? noTranslate + ' ' : '') + `translate(${tx}, ${ty})`)
    const svg = getSvg()
    const maxR = Math.max(-1, ...Array.from(svg?.querySelectorAll('[data-region]') ?? [])
      .map(e => parseInt(e.getAttribute('data-region') ?? '-1', 10)))
    clone.setAttribute('data-region', String(maxR + 1))
    el.parentNode?.insertBefore(clone, el.nextSibling)
    return clone
  }, [])

  // ── Background ────────────────────────────────────────────────────────────
  const setBackground = useCallback((color: string) => {
    const el = getSvg()
    if (!el) return
    let bg = el.querySelector<SVGRectElement>('#svg-bg')
    if (color === 'none' || color === 'transparent') {
      bg?.remove()
      // Also set CSS background to transparent so the checkerboard or stage shows through
      el.style.background = 'transparent'
      return
    }
    el.style.background = color
    if (!bg) {
      bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect') as SVGRectElement
      bg.id = 'svg-bg'
      bg.setAttribute('width', '100%')
      bg.setAttribute('height', '100%')
      el.insertBefore(bg, el.firstChild)
    }
    bg.setAttribute('fill', color)
  }, [])

  const getBackground = useCallback((): string => {
    const el = getSvg()
    return el?.querySelector('#svg-bg')?.getAttribute('fill') ?? 'none'
  }, [])

  // ── Group / Ungroup ───────────────────────────────────────────────────────
  const groupElements = useCallback((els: Element[]): SVGGElement | null => {
    if (els.length < 2) return null
    const parent = els[0].parentNode
    if (!parent) return null
    const svg = getSvg()
    const maxR = Math.max(-1, ...Array.from(svg?.querySelectorAll('[data-region]') ?? [])
      .map(e => parseInt(e.getAttribute('data-region') ?? '-1', 10)))
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g') as SVGGElement
    g.setAttribute('data-region', String(maxR + 1))
    // Insert g where the first element is
    parent.insertBefore(g, els[0])
    els.forEach(e => g.appendChild(e))
    return g
  }, [])

  const ungroupElement = useCallback((g: Element): Element[] => {
    const parent = g.parentNode
    if (!parent) return []
    const children = Array.from(g.children)
    children.forEach(child => parent.insertBefore(child, g))
    g.remove()
    return children
  }, [])

  // ── Combine paths ─────────────────────────────────────────────────────────
  const combinePaths = useCallback((els: Element[]): SVGPathElement | null => {
    const paths = els.filter(e => e.tagName === 'path')
    if (paths.length < 2) return null
    const parent = paths[0].parentNode
    if (!parent) return null
    const combined = paths.map(p => p.getAttribute('d') ?? '').filter(Boolean).join(' ')
    const svg = getSvg()
    const maxR = Math.max(-1, ...Array.from(svg?.querySelectorAll('[data-region]') ?? [])
      .map(e => parseInt(e.getAttribute('data-region') ?? '-1', 10)))
    const p = document.createElementNS('http://www.w3.org/2000/svg', 'path') as SVGPathElement
    p.setAttribute('d', combined)
    p.setAttribute('fill', paths[0].getAttribute('fill') ?? '#FFFFFF')
    p.setAttribute('data-region', String(maxR + 1))
    parent.insertBefore(p, paths[0])
    paths.forEach(e => e.remove())
    return p
  }, [])

  // ── Color map preservation ─────────────────────────────────────────────────
  const saveColorMap = useCallback((): ColorMapEntry[] => {
    const el = getSvg()
    if (!el) return []
    const map: ColorMapEntry[] = []
    el.querySelectorAll('[data-region]').forEach(p => {
      const f = p.getAttribute('fill')
      if (f && f !== '#FFFFFF' && f !== 'none') {
        const b = (p.getAttribute('data-bbox') ?? '').split(',').map(Number)
        if (b.length === 4) map.push({ cx: b[0] + b[2] / 2, cy: b[1] + b[3] / 2, color: f })
      }
    })
    return map
  }, [])

  const restoreColorMap = useCallback((map: ColorMapEntry[]) => {
    if (!map.length) return
    const el = getSvg()
    if (!el) return
    el.querySelectorAll('[data-region]').forEach(p => {
      const b = (p.getAttribute('data-bbox') ?? '').split(',').map(Number)
      if (b.length < 4) return
      const cx = b[0] + b[2] / 2, cy = b[1] + b[3] / 2
      let best: ColorMapEntry | null = null, bestD = Infinity
      map.forEach(m => { const d = Math.hypot(cx - m.cx, cy - m.cy); if (d < bestD) { bestD = d; best = m } })
      if (best && bestD < 30) p.setAttribute('fill', (best as ColorMapEntry).color)
    })
  }, [])

  // ── Rotate ────────────────────────────────────────────────────────────────
  const tfRotRef = useRef(0)

  const getOrMakeTfg = () => {
    const el = getSvg()
    if (!el) return null
    let g = el.querySelector<SVGGElement>('#tfg')
    if (!g) {
      g = document.createElementNS('http://www.w3.org/2000/svg', 'g') as SVGGElement
      g.id = 'tfg'
      while (el.firstChild) g.appendChild(el.firstChild)
      el.appendChild(g)
    }
    return g
  }

  const applyRot = useCallback(() => {
    const el = getSvg(), origVb = origVbRef.current
    if (!el || !origVb) return
    const g = getOrMakeTfg()
    if (!g) return
    const cx = origVb.x + origVb.w / 2, cy = origVb.y + origVb.h / 2
    const rot = tfRotRef.current
    if (rot === 0) {
      g.removeAttribute('transform')
      vbRef.current = { ...origVb }
    } else {
      g.setAttribute('transform', `rotate(${rot},${cx},${cy})`)
      vbRef.current = rot % 180 !== 0
        ? { x: cx - origVb.h / 2, y: cy - origVb.w / 2, w: origVb.h, h: origVb.w }
        : { ...origVb }
    }
    applyVb()
  }, [applyVb])

  const rotate = useCallback((deg: number) => {
    tfRotRef.current = (tfRotRef.current + deg + 360) % 360
    applyRot()
  }, [applyRot])

  // ── Resize ────────────────────────────────────────────────────────────────
  const getResInputs = () => ({
    rw: document.getElementById('resW') as HTMLInputElement | null,
    rh: document.getElementById('resH') as HTMLInputElement | null,
  })

  const syncResInputs = useCallback(() => {
    const el = getSvg(), origVb = origVbRef.current
    if (!el || !origVb) return
    const { rw, rh } = getResInputs()
    if (rw) rw.value = String(Math.round(parseFloat(el.getAttribute('width')  ?? '') || origVb.w))
    if (rh) rh.value = String(Math.round(parseFloat(el.getAttribute('height') ?? '') || origVb.h))
  }, [])

  const applyResize = useCallback((w: number, h: number) => {
    const el = getSvg()
    if (!el) return
    el.setAttribute('width',  String(w))
    el.setAttribute('height', String(h))
  }, [])

  // ── Crop ──────────────────────────────────────────────────────────────────
  const confirmCrop = useCallback((
    sel: HTMLElement, ovEl: HTMLElement,
  ) => {
    const sl = parseFloat(sel.style.left),  st = parseFloat(sel.style.top)
    const sw = parseFloat(sel.style.width), sh = parseFloat(sel.style.height)
    const el = getSvg(), vb = vbRef.current, box = boxRef.current
    if (!el || !vb || !box || sw < 5 || sh < 5) return false
    const svgR = el.getBoundingClientRect(), ovR = ovEl.getBoundingClientRect()
    const scX = vb.w / svgR.width, scY = vb.h / svgR.height
    const newVb: ViewBox = {
      x: vb.x + (sl - (svgR.left - ovR.left)) * scX,
      y: vb.y + (st  - (svgR.top  - ovR.top))  * scY,
      w: sw * scX,
      h: sh * scY,
    }
    vbRef.current    = newVb
    origVbRef.current = { ...newVb }
    applyVb()

    // Recalculate display to fit the new cropped viewBox
    const bw = box.clientWidth, bh = box.clientHeight
    const fitScale = Math.min((bw * 0.85) / newVb.w, (bh * 0.85) / newVb.h, 2)
    const baseW = newVb.w, baseH = newVb.h
    displayRef.current = { baseW, baseH, scale: fitScale, tx: 0, ty: 0 }
    applyDisplay()

    syncResInputs()
    return true
  }, [applyVb, applyDisplay, syncResInputs])

  // ── Reset transforms ──────────────────────────────────────────────────────
  const resetTransforms = useCallback(() => {
    tfRotRef.current = 0
    const el = getSvg()
    if (!el) return
    el.querySelector('#tfg')?.removeAttribute('transform')
    el.removeAttribute('width')
    el.removeAttribute('height')
    const bv = el.viewBox.baseVal
    origVbRef.current = { x: bv.x, y: bv.y, w: bv.width, h: bv.height }
    vbRef.current     = { ...origVbRef.current }
    applyVb()
    syncResInputs()
  }, [applyVb, syncResInputs])

  // ── Boolean operations ────────────────────────────────────────────────────
  const booleanOp = useCallback(async (els: Element[], op: 'unite' | 'subtract' | 'intersect' | 'exclude') => {
    if (els.length < 2) return null
    const svg = getSvg()
    if (!svg) return null
    const { applyBooleanOp } = await import('../lib/booleanOps')
    let current = els[0]
    for (let i = 1; i < els.length; i++) {
      const result = applyBooleanOp(current, els[i], op, svg)
      if (!result) return null
      current = result
    }
    undoStack.current.push({ type: 'add', el: current })
    return current
  }, [])

  // ── Zoom to fit elements ──────────────────────────────────────────────────
  const zoomToElements = useCallback((els: Element[]) => {
    const svgEl = getSvg(), vb = vbRef.current, d = displayRef.current, box = boxRef.current
    if (!svgEl || !vb || !d || !box || els.length === 0) return
    const svgR = svgEl.getBoundingClientRect()
    const scX = vb.w / svgR.width, scY = vb.h / svgR.height
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const el of els) {
      const r = el.getBoundingClientRect()
      const ex = vb.x + (r.left - svgR.left) * scX
      const ey = vb.y + (r.top - svgR.top) * scY
      if (ex < minX) minX = ex
      if (ey < minY) minY = ey
      if (ex + r.width * scX > maxX) maxX = ex + r.width * scX
      if (ey + r.height * scY > maxY) maxY = ey + r.height * scY
    }
    const ew = maxX - minX, eh = maxY - minY
    if (ew < 1 || eh < 1) return
    const boxR = box.getBoundingClientRect()
    const pad = 40
    const scale = Math.min((boxR.width - pad * 2) / ew, (boxR.height - pad * 2) / eh, 4)
    d.scale = scale / (vb.w / d.baseW)
    d.tx = 0; d.ty = 0
    applyDisplay()
  }, [applyDisplay])

  return {
    boxRef, vbRef, origVbRef, displayRef,
    getSvg, clientToSvg, zoomAt, resetZoom, initViewBox, applyDisplay,
    pushUndo, pushUndoAttrs, paint, undo, redo, clearColors, deleteSelected,
    saveColorMap, restoreColorMap,
    rotate, applyRot, syncResInputs, applyResize, confirmCrop, resetTransforms,
    bringForward, sendBack, bringToFront, sendToBack,
    duplicate, setBackground, getBackground,
    groupElements, ungroupElement, combinePaths,
    booleanOp, zoomToElements,
  }
}
