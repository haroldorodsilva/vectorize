import { useEffect, useRef, useState } from 'react'
import { cn } from '@/shared/lib/utils'
import { usePaletteStore } from '@/features/palette/store'
import { useEditor } from '../hooks/useEditor'

// Custom SVG cursors
const CURSOR_PENCIL = `url("data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"><path fill="#222" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zm21.41-19.04a1 1 0 0 0-1.41 0l-4.59 4.59 3.75 3.75 4.59-4.59a1 1 0 0 0 0-1.41z"/></svg>')}") 0 20, crosshair`
const CURSOR_ERASER = `url("data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"><path fill="#aaa" d="M15.14 3c-.51 0-1.02.2-1.41.59L2.59 14.73a2 2 0 0 0 0 2.83L5.03 20H20v-2H9.41l8.18-8.18-5.83-5.83a2 2 0 0 0-1.41-.59h-.21z"/></svg>')}") 4 20, cell`

const DRAW_MODES = ['rect', 'ellipse', 'line', 'text'] as const

interface SvgEditorProps {
  svgContent: string | null
  editorRef: ReturnType<typeof useEditor>
  tpOn: boolean
  cropActive: boolean
  onCropConfirm: (sel: HTMLElement, ov: HTMLElement) => boolean
  onCropCancel: () => void
}

// ── Resize a SVG element to a new SVG-space bounding box ────────────────────
function applyElResize(
  el: Element,
  orig: { x: number; y: number; w: number; h: number },
  next: { x: number; y: number; w: number; h: number },
  savedTransform: string,
) {
  const tag = el.tagName.toLowerCase()
  const sx = next.w / orig.w
  const sy = next.h / orig.h

  if (tag === 'rect') {
    el.removeAttribute('transform')
    el.setAttribute('x',      String(next.x))
    el.setAttribute('y',      String(next.y))
    el.setAttribute('width',  String(next.w))
    el.setAttribute('height', String(next.h))
    return
  }
  if (tag === 'ellipse' || tag === 'circle') {
    el.removeAttribute('transform')
    el.setAttribute('cx', String(next.x + next.w / 2))
    el.setAttribute('cy', String(next.y + next.h / 2))
    el.setAttribute('rx', String(next.w / 2))
    el.setAttribute('ry', String(next.h / 2))
    return
  }
  // Universal: compose resize transform on top of saved transform
  const tf = [
    `translate(${next.x}, ${next.y})`,
    `scale(${sx.toFixed(6)}, ${sy.toFixed(6)})`,
    `translate(${(-orig.x).toFixed(4)}, ${(-orig.y).toFixed(4)})`,
    savedTransform,
  ].filter(Boolean).join(' ')
  el.setAttribute('transform', tf)
}

// ── Selection overlay (dashed rect + 8 resize handles) ───────────────────────
const HANDLES = [
  { dx: 0,   dy: 0,   cur: 'nw-resize' },
  { dx: 0.5, dy: 0,   cur: 'n-resize'  },
  { dx: 1,   dy: 0,   cur: 'ne-resize' },
  { dx: 1,   dy: 0.5, cur: 'e-resize'  },
  { dx: 1,   dy: 1,   cur: 'se-resize' },
  { dx: 0.5, dy: 1,   cur: 's-resize'  },
  { dx: 0,   dy: 1,   cur: 'sw-resize' },
  { dx: 0,   dy: 0.5, cur: 'w-resize'  },
]

interface SelOverlayProps {
  el: Element | null
  containerRef: React.RefObject<HTMLDivElement | null>
  editorRef: ReturnType<typeof useEditor>
}

function SelectionOverlay({ el, containerRef, editorRef }: SelOverlayProps) {
  const [box, setBox] = useState({ left: 0, top: 0, w: 0, h: 0 })
  const rafRef = useRef<number>()

  useEffect(() => {
    if (!el) return
    const update = () => {
      const ctr = containerRef.current
      if (!ctr || !el) return
      const er = el.getBoundingClientRect()
      const cr = ctr.getBoundingClientRect()
      setBox({
        left: er.left - cr.left,
        top:  er.top  - cr.top,
        w:    er.width,
        h:    er.height,
      })
      rafRef.current = requestAnimationFrame(update)
    }
    rafRef.current = requestAnimationFrame(update)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [el, containerRef])

  if (!el) return null

  const onHandleDown = (e: React.MouseEvent, dx: number, dy: number) => {
    e.preventDefault()
    e.stopPropagation()

    const svgEl = editorRef.getSvg()
    const vb = editorRef.vbRef.current
    if (!svgEl || !vb) return

    const svgR = svgEl.getBoundingClientRect()
    const er   = el.getBoundingClientRect()
    const scX  = vb.w / svgR.width
    const scY  = vb.h / svgR.height

    const orig = {
      x: vb.x + (er.left - svgR.left) * scX,
      y: vb.y + (er.top  - svgR.top)  * scY,
      w: Math.max(er.width  * scX, 1),
      h: Math.max(er.height * scY, 1),
    }
    const savedTransform = el.getAttribute('transform') ?? ''
    const startClient = { x: e.clientX, y: e.clientY }

    // Capture pre-resize attrs for undo
    const resizeUndoAttrs: Array<[string, string | null]> =
      ['x', 'y', 'width', 'height', 'cx', 'cy', 'rx', 'ry', 'transform'].map(
        a => [a, el.getAttribute(a)] as [string, string | null]
      )
    let didResize = false

    const onMove = (ev: MouseEvent) => {
      didResize = true
      const svgR2 = svgEl.getBoundingClientRect()
      const vb2   = editorRef.vbRef.current
      if (!vb2) return
      const dsx = (ev.clientX - startClient.x) / svgR2.width  * vb2.w
      const dsy = (ev.clientY - startClient.y) / svgR2.height * vb2.h

      const nx = orig.x + (dx === 0 ? dsx : 0)
      const ny = orig.y + (dy === 0 ? dsy : 0)
      let   nw = orig.w + (dx === 0 ? -dsx : dx === 1 ? dsx : 0)
      let   nh = orig.h + (dy === 0 ? -dsy : dy === 1 ? dsy : 0)
      nw = Math.max(4, nw)
      nh = Math.max(4, nh)

      applyElResize(el, orig, { x: nx, y: ny, w: nw, h: nh }, savedTransform)
    }
    const onUp = () => {
      if (didResize) editorRef.pushUndoAttrs(el, resizeUndoAttrs)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  return (
    <div
      className="absolute pointer-events-none"
      style={{ left: box.left, top: box.top, width: box.w, height: box.h }}
    >
      {/* Dashed border */}
      <div className="absolute inset-0 border-2 border-blue-500"
           style={{ outline: '1px solid rgba(255,255,255,0.6)' }} />

      {/* 8 resize handles */}
      {HANDLES.map(({ dx, dy, cur }, i) => (
        <div
          key={i}
          className="absolute w-2.5 h-2.5 bg-white border-2 border-blue-500 rounded-[2px] pointer-events-auto z-10 shadow-sm"
          style={{
            left: dx * box.w - 5,
            top:  dy * box.h - 5,
            cursor: cur,
          }}
          onMouseDown={e => onHandleDown(e, dx, dy)}
        />
      ))}
    </div>
  )
}

export function SvgEditor({
  svgContent, editorRef, tpOn, cropActive, onCropConfirm, onCropCancel,
}: SvgEditorProps) {
  const { boxRef, zoomAt, resetZoom, paint, clientToSvg, pushUndo } = editorRef
  const { selectedColor, mode, selectedEl, setSelectedEl } = usePaletteStore()

  const outerRef     = useRef<HTMLDivElement>(null)
  const cropOvRef    = useRef<HTMLDivElement>(null)
  const cropSelRef   = useRef<HTMLDivElement>(null)
  const cdotRef      = useRef<HTMLDivElement>(null)
  const [cropSelVisible, setCropSelVisible] = useState(false)
  const [showCropOk, setShowCropOk]         = useState(false)
  const cropAnchor = useRef<{ x: number; y: number } | null>(null)

  // Text tool overlay
  const [textOverlay, setTextOverlay] = useState<{ clientX: number; clientY: number; svgX: number; svgY: number } | null>(null)
  const [textValue, setTextValue]     = useState('')

  // Selection indicator via CSS `data-sel`
  const prevSelRef = useRef<Element | null>(null)

  useEffect(() => {
    const prev = prevSelRef.current
    if (prev && prev !== selectedEl) {
      prev.removeAttribute('data-sel')
    }
    if (selectedEl) {
      selectedEl.setAttribute('data-sel', '1')
    }
    prevSelRef.current = selectedEl
  }, [selectedEl])

  // ── Cursor style ──────────────────────────────────────────────────────────
  const isDrawMode = (DRAW_MODES as readonly string[]).includes(mode)
  const cursorStyle =
    mode === 'paint' ? { cursor: CURSOR_PENCIL } :
    mode === 'erase' ? { cursor: CURSOR_ERASER } :
    isDrawMode       ? { cursor: 'crosshair' }   :
    undefined

  // ── Wheel zoom ────────────────────────────────────────────────────────────
  useEffect(() => {
    const box = boxRef.current
    if (!box) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      zoomAt(e.clientX, e.clientY, e.deltaY > 0 ? 1.12 : 1 / 1.12)
    }
    box.addEventListener('wheel', onWheel, { passive: false })
    return () => box.removeEventListener('wheel', onWheel)
  }, [boxRef, zoomAt])

  // ── Drawing modes ─────────────────────────────────────────────────────────
  useEffect(() => {
    const box = boxRef.current
    if (!box || !isDrawMode || cropActive) return

    const ns = 'http://www.w3.org/2000/svg'
    let drawActive = false
    let startSvg = { x: 0, y: 0 }
    let previewEl: SVGElement | null = null
    let drawCounter = Date.now()

    const onDown = (e: MouseEvent) => {
      if (e.button !== 0) return
      e.preventDefault(); e.stopPropagation()
      const svg = editorRef.getSvg()
      if (!svg) return
      startSvg = clientToSvg(e.clientX, e.clientY)

      if (mode === 'text') {
        setTextOverlay({ clientX: e.clientX, clientY: e.clientY, svgX: startSvg.x, svgY: startSvg.y })
        setTextValue('')
        return
      }
      drawActive = true
      if (mode === 'rect') {
        const el = document.createElementNS(ns, 'rect') as SVGRectElement
        el.setAttribute('x', String(startSvg.x)); el.setAttribute('y', String(startSvg.y))
        el.setAttribute('width', '0'); el.setAttribute('height', '0')
        el.setAttribute('fill', selectedColor)
        el.setAttribute('stroke', selectedColor === '#FFFFFF' ? '#999' : 'none')
        el.setAttribute('stroke-width', '1'); el.setAttribute('opacity', '0.75')
        svg.appendChild(el); previewEl = el
      } else if (mode === 'ellipse') {
        const el = document.createElementNS(ns, 'ellipse') as SVGEllipseElement
        el.setAttribute('cx', String(startSvg.x)); el.setAttribute('cy', String(startSvg.y))
        el.setAttribute('rx', '0'); el.setAttribute('ry', '0')
        el.setAttribute('fill', selectedColor)
        el.setAttribute('stroke', selectedColor === '#FFFFFF' ? '#999' : 'none')
        el.setAttribute('stroke-width', '1'); el.setAttribute('opacity', '0.75')
        svg.appendChild(el); previewEl = el
      } else if (mode === 'line') {
        const el = document.createElementNS(ns, 'line') as SVGLineElement
        el.setAttribute('x1', String(startSvg.x)); el.setAttribute('y1', String(startSvg.y))
        el.setAttribute('x2', String(startSvg.x)); el.setAttribute('y2', String(startSvg.y))
        el.setAttribute('fill', 'none'); el.setAttribute('stroke', selectedColor)
        el.setAttribute('stroke-width', '2'); el.setAttribute('stroke-linecap', 'round')
        el.setAttribute('opacity', '0.75')
        svg.appendChild(el); previewEl = el
      }
    }

    const onMove = (e: MouseEvent) => {
      if (!drawActive || !previewEl) return
      const cur = clientToSvg(e.clientX, e.clientY)
      if (mode === 'rect') {
        previewEl.setAttribute('x', String(Math.min(startSvg.x, cur.x)))
        previewEl.setAttribute('y', String(Math.min(startSvg.y, cur.y)))
        previewEl.setAttribute('width',  String(Math.abs(cur.x - startSvg.x)))
        previewEl.setAttribute('height', String(Math.abs(cur.y - startSvg.y)))
      } else if (mode === 'ellipse') {
        previewEl.setAttribute('cx', String((startSvg.x + cur.x) / 2))
        previewEl.setAttribute('cy', String((startSvg.y + cur.y) / 2))
        previewEl.setAttribute('rx', String(Math.abs(cur.x - startSvg.x) / 2))
        previewEl.setAttribute('ry', String(Math.abs(cur.y - startSvg.y) / 2))
      } else if (mode === 'line') {
        previewEl.setAttribute('x2', String(cur.x))
        previewEl.setAttribute('y2', String(cur.y))
      }
    }

    const onUp = () => {
      if (!drawActive || !previewEl) { drawActive = false; return }
      drawActive = false
      previewEl.setAttribute('data-region', String(drawCounter++))
      previewEl.setAttribute('data-drawn', '1')
      previewEl.setAttribute('opacity', '1')
      pushUndo(previewEl, null)
      previewEl = null
    }

    box.addEventListener('mousedown', onDown, true)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      box.removeEventListener('mousedown', onDown, true)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [isDrawMode, mode, selectedColor, cropActive, boxRef, clientToSvg, pushUndo, editorRef])

  // ── Text commit ───────────────────────────────────────────────────────────
  const commitText = () => {
    if (!textOverlay || !textValue.trim()) { setTextOverlay(null); return }
    const svg = editorRef.getSvg()
    if (!svg) { setTextOverlay(null); return }
    const ns = 'http://www.w3.org/2000/svg'
    const el = document.createElementNS(ns, 'text') as SVGTextElement
    el.setAttribute('x', String(textOverlay.svgX))
    el.setAttribute('y', String(textOverlay.svgY))
    el.setAttribute('fill', selectedColor)
    el.setAttribute('font-size', '16')
    el.setAttribute('font-family', 'system-ui, sans-serif')
    el.setAttribute('data-region', String(Date.now()))
    el.setAttribute('data-drawn', '1')
    el.textContent = textValue
    svg.appendChild(el)
    pushUndo(el, null)
    setTextOverlay(null)
    setTextValue('')
  }

  // ── Mouse (pan + paint/erase/select + move) ───────────────────────────────
  useEffect(() => {
    if (isDrawMode) return
    const box = boxRef.current
    if (!box) return
    let md = false, mTgt: Element | null = null
    let mStart = { x: 0, y: 0 }, mMoved = false
    let panL: { x: number; y: number } | null = null

    // Drag-move state
    let movingEl: Element | null = null
    let moveStartClient = { x: 0, y: 0 }
    let savedTransformMove = ''
    let moveUndoAttrs: Array<[string, string | null]> = []

    const onDown = (e: MouseEvent) => {
      if (e.button !== 0 || cropActive) return
      md = true; mTgt = e.target as Element
      mStart = { x: e.clientX, y: e.clientY }; mMoved = false
      panL = { x: e.clientX, y: e.clientY }; e.preventDefault()

      if (mode === 'select' && selectedEl && mTgt === selectedEl) {
        movingEl = selectedEl
        moveStartClient = { x: e.clientX, y: e.clientY }
        savedTransformMove = selectedEl.getAttribute('transform') ?? ''
        // Capture pre-move transform for undo (pushed only if user actually drags)
        moveUndoAttrs = [['transform', selectedEl.getAttribute('transform')]]
      }
    }
    const onMove = (e: MouseEvent) => {
      const cdot = cdotRef.current
      if (box.matches(':hover') && !cropActive && cdot && (mode === 'paint' || mode === 'erase')) {
        cdot.style.display = 'block'; cdot.style.left = e.clientX + 'px'; cdot.style.top = e.clientY + 'px'
      } else if (cdot) { cdot.style.display = 'none' }
      if (!md || !panL) return
      if (Math.hypot(e.clientX - mStart.x, e.clientY - mStart.y) > 3) mMoved = true
      if (!mMoved) return

      if (movingEl) {
        // Compose move delta on top of saved transform (works after resize too)
        const svgEl = editorRef.getSvg()
        const vbCur = editorRef.vbRef.current
        if (!svgEl || !vbCur) return
        const svgR = svgEl.getBoundingClientRect()
        const dx = (e.clientX - moveStartClient.x) / svgR.width  * vbCur.w
        const dy = (e.clientY - moveStartClient.y) / svgR.height * vbCur.h
        const tf = savedTransformMove
          ? `translate(${dx.toFixed(2)}, ${dy.toFixed(2)}) ${savedTransformMove}`
          : `translate(${dx.toFixed(2)}, ${dy.toFixed(2)})`
        movingEl.setAttribute('transform', tf)
        return
      }

      // Pan canvas via display offset (moves the SVG "page")
      const d = editorRef.displayRef?.current
      if (d) {
        d.tx += e.clientX - panL.x
        d.ty += e.clientY - panL.y
        editorRef.applyDisplay()
      }
      panL = { x: e.clientX, y: e.clientY }
    }
    const onUp = () => {
      if (!md) return; md = false

      if (movingEl && mMoved) {
        editorRef.pushUndoAttrs(movingEl, moveUndoAttrs)
        movingEl = null; mTgt = null; panL = null; moveUndoAttrs = []
        return
      }
      movingEl = null; moveUndoAttrs = []

      if (!mMoved && mTgt) {
        const region = mTgt.getAttribute('data-region') ? mTgt : null
        if (region) {
          if (mode === 'paint')        paint(region, selectedColor, false)
          else if (mode === 'erase')   paint(region, selectedColor, true)
          else if (mode === 'select')  setSelectedEl(region === selectedEl ? null : region)
        } else if (mode === 'select') {
          setSelectedEl(null)
        }
      }
      mTgt = null; panL = null
    }
    const onLeave = () => { if (cdotRef.current) cdotRef.current.style.display = 'none' }

    box.addEventListener('mousedown', onDown)
    box.addEventListener('dblclick', e => { if (!(e.target as Element).getAttribute('data-region')) resetZoom() })
    box.addEventListener('mouseleave', onLeave)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      box.removeEventListener('mousedown', onDown)
      box.removeEventListener('mouseleave', onLeave)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [isDrawMode, cropActive, selectedColor, mode, selectedEl, clientToSvg, editorRef])

  // ── Touch ─────────────────────────────────────────────────────────────────
  useEffect(() => {
    const box = boxRef.current
    if (!box) return
    let tTgt: Element | null = null, tStart = { x: 0, y: 0 }
    let tMoved = false, panLT: { x: number; y: number } | null = null, pinchD: number | null = null

    const onStart = (e: TouchEvent) => {
      if (cropActive) return; e.preventDefault()
      if (e.touches.length === 1) {
        const t = e.touches[0]; tTgt = e.target as Element
        tStart = { x: t.clientX, y: t.clientY }; tMoved = false
        panLT = { x: t.clientX, y: t.clientY }; pinchD = null
      } else if (e.touches.length === 2) {
        tTgt = null
        pinchD = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY)
      }
    }
    const onMove = (e: TouchEvent) => {
      if (cropActive) return; e.preventDefault()
      if (e.touches.length === 1 && panLT) {
        const t = e.touches[0]
        if (Math.hypot(t.clientX - tStart.x, t.clientY - tStart.y) > 8) {
          tMoved = true
          const d = editorRef.displayRef?.current
          if (d) {
            d.tx += t.clientX - panLT.x
            d.ty += t.clientY - panLT.y
            editorRef.applyDisplay()
          }
        }
        panLT = { x: t.clientX, y: t.clientY }
      } else if (e.touches.length === 2 && pinchD !== null) {
        const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY)
        zoomAt((e.touches[0].clientX + e.touches[1].clientX) / 2, (e.touches[0].clientY + e.touches[1].clientY) / 2, pinchD / d)
        pinchD = d
      }
    }
    const onEnd = (e: TouchEvent) => {
      if (cropActive) return
      if (e.touches.length === 0) {
        if (!tMoved && tTgt?.getAttribute('data-region')) {
          if (mode === 'paint')        paint(tTgt, selectedColor, false)
          else if (mode === 'erase')   paint(tTgt, selectedColor, true)
          else if (mode === 'select')  setSelectedEl(tTgt === selectedEl ? null : tTgt)
        }
        tTgt = null; panLT = null; pinchD = null
      } else if (e.touches.length === 1) {
        pinchD = null; panLT = { x: e.touches[0].clientX, y: e.touches[0].clientY }
      }
    }
    box.addEventListener('touchstart', onStart, { passive: false })
    box.addEventListener('touchmove',  onMove,  { passive: false })
    box.addEventListener('touchend',   onEnd)
    return () => {
      box.removeEventListener('touchstart', onStart)
      box.removeEventListener('touchmove',  onMove)
      box.removeEventListener('touchend',   onEnd)
    }
  }, [cropActive, selectedColor, mode, selectedEl])

  // ── Crop drag ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!cropActive) return
    const ov = cropOvRef.current, sel = cropSelRef.current
    if (!ov || !sel) return
    const onDown = (e: MouseEvent) => {
      const r = ov.getBoundingClientRect()
      cropAnchor.current = { x: e.clientX - r.left, y: e.clientY - r.top }
      Object.assign(sel.style, { display: 'block', left: cropAnchor.current.x + 'px', top: cropAnchor.current.y + 'px', width: '0', height: '0', boxShadow: '0 0 0 9999px rgba(0,0,0,.5)' })
      setShowCropOk(false); setCropSelVisible(true); e.preventDefault()
    }
    const onMove = (e: MouseEvent) => {
      if (!cropAnchor.current) return
      const r = ov.getBoundingClientRect()
      const cx = e.clientX - r.left, cy = e.clientY - r.top
      sel.style.left   = Math.min(cropAnchor.current.x, cx) + 'px'
      sel.style.top    = Math.min(cropAnchor.current.y, cy) + 'px'
      sel.style.width  = Math.abs(cx - cropAnchor.current.x) + 'px'
      sel.style.height = Math.abs(cy - cropAnchor.current.y) + 'px'
    }
    const onUp = () => {
      if (!cropAnchor.current) return
      cropAnchor.current = null
      if (parseFloat(sel.style.width) > 5 && parseFloat(sel.style.height) > 5) setShowCropOk(true)
    }
    ov.addEventListener('mousedown', onDown)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      ov.removeEventListener('mousedown', onDown)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [cropActive])

  return (
    <div ref={outerRef} className="relative h-full w-full overflow-hidden">
      {/* SVG canvas — the boxRef div is the gray "stage", SVG is the white "page" inside */}
      <div
        ref={boxRef}
        className={cn(
          'svgbox w-full h-full overflow-hidden',
          `mode-${mode}`,
          tpOn && 'checker',
        )}
        style={cursorStyle}
        dangerouslySetInnerHTML={svgContent ? { __html: svgContent } : undefined}
      />

      {/* Selection overlay — only in select mode */}
      {mode === 'select' && !cropActive && (
        <SelectionOverlay el={selectedEl} containerRef={outerRef} editorRef={editorRef} />
      )}

      {/* Crop overlay */}
      {cropActive && (
        <div ref={cropOvRef} className="absolute inset-0 z-30 cursor-crosshair overflow-hidden">
          <div
            ref={cropSelRef}
            className={cn('absolute border-2 border-dashed border-white pointer-events-none', !cropSelVisible && 'hidden')}
          />
          <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 bg-black/70 text-white text-xs px-3 py-1 rounded-full pointer-events-none whitespace-nowrap">
            Arraste para selecionar — depois clique em Confirmar
          </div>
          {showCropOk && (
            <div className="absolute top-2 left-1/2 -translate-x-1/2 flex gap-2 z-10">
              <button
                className="px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg font-semibold"
                onClick={() => {
                  if (cropSelRef.current && cropOvRef.current) {
                    const ok = onCropConfirm(cropSelRef.current, cropOvRef.current)
                    if (ok) { setCropSelVisible(false); setShowCropOk(false) }
                  }
                }}
              >✓ Confirmar</button>
              <button
                className="px-3 py-1.5 bg-white border border-gray-300 text-xs rounded-lg"
                onClick={() => { onCropCancel(); setCropSelVisible(false); setShowCropOk(false) }}
              >✕ Cancelar</button>
            </div>
          )}
        </div>
      )}

      {/* Text input overlay */}
      {textOverlay && (
        <div className="fixed z-[9999]" style={{ left: textOverlay.clientX, top: textOverlay.clientY }}>
          <input
            autoFocus
            type="text"
            value={textValue}
            onChange={e => setTextValue(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') commitText()
              if (e.key === 'Escape') setTextOverlay(null)
            }}
            onBlur={commitText}
            placeholder="Digite o texto…"
            className="border border-blue-400 rounded px-2 py-1 text-sm shadow-lg bg-white outline-none min-w-[120px]"
            style={{ color: selectedColor === '#FFFFFF' ? '#000' : selectedColor }}
          />
        </div>
      )}

      {/* Cursor dot (paint/erase only) */}
      <div
        ref={cdotRef}
        className={cn(
          'fixed pointer-events-none hidden z-[9999] -translate-x-1/2 -translate-y-1/2',
          mode === 'erase' ? 'w-5 h-5 rounded-sm border-2 border-gray-400 bg-white' : 'w-4 h-4 rounded-full border-2 border-black/30',
        )}
        style={mode === 'erase' ? {} : { background: selectedColor, boxShadow: '0 1px 3px rgba(0,0,0,.25)' }}
      />
    </div>
  )
}
