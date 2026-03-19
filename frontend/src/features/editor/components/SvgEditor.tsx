import { useEffect, useRef, useState, useCallback } from 'react'
import { cn } from '@/shared/lib/utils'
import { usePaletteStore } from '@/features/palette/store'
import { useEditor } from '../hooks/useEditor'
import { NodeEditOverlay } from './NodeEditOverlay'
import { InlineTextEditor } from './InlineTextEditor'
import { GridOverlay } from './GridOverlay'
import { SmartGuides } from './SmartGuides'
import { ZoomBar } from './ZoomBar'
import { Rulers } from './Rulers'
import { Minimap } from './Minimap'
import { ContextMenu } from './ContextMenu'
import { createPenState, penDown, penMove, penUp, commitPen, cancelPen, type PenToolState } from '../tools/penTool'
import { createPolygon } from '../tools/polygonTool'
import { createFreehandState, freehandDown, freehandMove, freehandUp, type FreehandState } from '../tools/freehandTool'

// Custom SVG cursors
const CURSOR_PENCIL = `url("data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"><path fill="#222" d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zm21.41-19.04a1 1 0 0 0-1.41 0l-4.59 4.59 3.75 3.75 4.59-4.59a1 1 0 0 0 0-1.41z"/></svg>')}") 0 20, crosshair`
const CURSOR_ERASER = `url("data:image/svg+xml,${encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24"><path fill="#aaa" d="M15.14 3c-.51 0-1.02.2-1.41.59L2.59 14.73a2 2 0 0 0 0 2.83L5.03 20H20v-2H9.41l8.18-8.18-5.83-5.83a2 2 0 0 0-1.41-.59h-.21z"/></svg>')}") 4 20, cell`

const DRAW_MODES = ['rect', 'ellipse', 'line', 'text', 'pen', 'polygon', 'freehand', 'arrow'] as const

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
  els: Element[]
  containerRef: React.RefObject<HTMLDivElement | null>
  editorRef: ReturnType<typeof useEditor>
}

function SelectionOverlay({ els, containerRef, editorRef }: SelOverlayProps) {
  const [box, setBox] = useState({ left: 0, top: 0, w: 0, h: 0 })
  const rafRef = useRef<number>()
  const singleEl = els.length === 1 ? els[0] : null

  useEffect(() => {
    if (els.length === 0) return
    const update = () => {
      const ctr = containerRef.current
      if (!ctr) return
      const cr = ctr.getBoundingClientRect()
      // Combined bounding box of all selected elements
      let minL = Infinity, minT = Infinity, maxR = -Infinity, maxB = -Infinity
      for (const el of els) {
        const er = el.getBoundingClientRect()
        if (er.left < minL) minL = er.left
        if (er.top  < minT) minT = er.top
        if (er.right  > maxR) maxR = er.right
        if (er.bottom > maxB) maxB = er.bottom
      }
      setBox({
        left: minL - cr.left,
        top:  minT - cr.top,
        w:    maxR - minL,
        h:    maxB - minT,
      })
      rafRef.current = requestAnimationFrame(update)
    }
    rafRef.current = requestAnimationFrame(update)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [els, containerRef])

  if (els.length === 0) return null
  // Use first element for resize handles (only for single selection)
  const el = singleEl

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

      {/* 8 resize handles (only for single selection) */}
      {el && HANDLES.map(({ dx, dy, cur }, i) => (
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
      {/* Rotation handle (single selection only) */}
      {el && (
        <>
          {/* Stem line from top-center to rotation handle */}
          <div className="absolute pointer-events-none"
            style={{ left: box.w / 2, top: -28, width: 1, height: 22, background: '#3b82f6' }} />
          {/* Rotation grip */}
          <div
            className="absolute w-4 h-4 rounded-full bg-white border-2 border-blue-500 pointer-events-auto z-10 shadow-md cursor-grab"
            style={{ left: box.w / 2 - 8, top: -36 }}
            onMouseDown={e => {
              e.preventDefault(); e.stopPropagation()
              const svgEl = editorRef.getSvg()
              const vb = editorRef.vbRef.current
              if (!svgEl || !vb || !el) return
              const svgR = svgEl.getBoundingClientRect()
              const er = el.getBoundingClientRect()
              // Center of element in screen coords
              const ccx = er.left + er.width / 2
              const ccy = er.top + er.height / 2
              // Center in SVG coords
              const scX = vb.w / svgR.width, scY = vb.h / svgR.height
              const svgCx = vb.x + (er.left + er.width / 2 - svgR.left) * scX
              const svgCy = vb.y + (er.top + er.height / 2 - svgR.top) * scY
              const startAngle = Math.atan2(e.clientY - ccy, e.clientX - ccx)
              const savedTf = el.getAttribute('transform') ?? ''
              editorRef.pushUndoAttrs(el, [['transform', savedTf]])

              const onMove = (ev: MouseEvent) => {
                const curAngle = Math.atan2(ev.clientY - ccy, ev.clientX - ccx)
                const deg = ((curAngle - startAngle) * 180 / Math.PI)
                const rounded = ev.shiftKey ? Math.round(deg / 15) * 15 : Math.round(deg)
                const tf = `rotate(${rounded}, ${svgCx.toFixed(1)}, ${svgCy.toFixed(1)}) ${savedTf}`.trim()
                el.setAttribute('transform', tf)
              }
              const onUp = () => {
                window.removeEventListener('mousemove', onMove)
                window.removeEventListener('mouseup', onUp)
              }
              window.addEventListener('mousemove', onMove)
              window.addEventListener('mouseup', onUp)
            }}
          />
        </>
      )}
      {/* Dimension label (bottom of selection) */}
      {(() => {
        const vb = editorRef.vbRef.current
        const svgEl = editorRef.getSvg()
        if (!vb || !svgEl || box.w < 10) return null
        const svgR = svgEl.getBoundingClientRect()
        const wSvg = Math.round(box.w / svgR.width * vb.w)
        const hSvg = Math.round(box.h / svgR.height * vb.h)
        return (
          <div className="absolute left-1/2 -translate-x-1/2 bg-gray-800 text-white text-[0.55rem] font-mono px-1.5 py-0.5 rounded-sm pointer-events-none whitespace-nowrap"
            style={{ top: box.h + 4 }}>
            {wSvg} × {hSvg}
          </div>
        )
      })()}
      {/* Multi-select count badge */}
      {els.length > 1 && (
        <div className="absolute -top-5 left-0 bg-blue-500 text-white text-[0.6rem] font-bold px-1.5 py-0.5 rounded-sm pointer-events-none">
          {els.length} selecionados
        </div>
      )}
    </div>
  )
}

export function SvgEditor({
  svgContent, editorRef, tpOn, cropActive, onCropConfirm, onCropCancel,
}: SvgEditorProps) {
  const { boxRef, zoomAt, resetZoom, paint, clientToSvg, pushUndo } = editorRef
  const { selectedColor, mode, selectedEl, selectedEls, setSelectedEl, setSelectedEls, toggleSelectedEl, gridEnabled, gridSize, guidesEnabled } = usePaletteStore()

  // Track which elements are being moved (for smart guides)
  const [movingElsForGuides, setMovingElsForGuides] = useState<Element[]>([])
  const [allRegionEls, setAllRegionEls] = useState<Element[]>([])

  const outerRef     = useRef<HTMLDivElement>(null)
  const marqueeRef   = useRef<HTMLDivElement>(null)
  const cropOvRef    = useRef<HTMLDivElement>(null)
  const cropSelRef   = useRef<HTMLDivElement>(null)
  const cdotRef      = useRef<HTMLDivElement>(null)
  const [cropSelVisible, setCropSelVisible] = useState(false)
  const [showCropOk, setShowCropOk]         = useState(false)
  const cropAnchor = useRef<{ x: number; y: number } | null>(null)

  // Node-edit mode: double-click a path to edit its nodes
  const [nodeEditEl, setNodeEditEl] = useState<Element | null>(null)
  const exitNodeEdit = useCallback(() => setNodeEditEl(null), [])

  // Inline text editing: double-click a text element
  const [textEditEl, setTextEditEl] = useState<SVGTextElement | null>(null)

  // Text tool overlay
  const [textOverlay, setTextOverlay] = useState<{ clientX: number; clientY: number; svgX: number; svgY: number } | null>(null)
  const [textValue, setTextValue]     = useState('')

  // Selection indicator via CSS `data-sel` — supports multi-select
  const prevSelEls = useRef<Element[]>([])

  useEffect(() => {
    for (const el of prevSelEls.current) {
      if (!selectedEls.includes(el)) el.removeAttribute('data-sel')
    }
    for (const el of selectedEls) {
      el.setAttribute('data-sel', '1')
    }
    prevSelEls.current = [...selectedEls]
  }, [selectedEls])

  // ── Cursor style ──────────────────────────────────────────────────────────
  const isDrawMode = (DRAW_MODES as readonly string[]).includes(mode)
  const cursorStyle =
    mode === 'paint' ? { cursor: CURSOR_PENCIL } :
    mode === 'erase' ? { cursor: CURSOR_ERASER } :
    mode === 'eyedropper' ? { cursor: 'crosshair' } :
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

    // Pen tool state
    let penState: PenToolState = createPenState()
    // Freehand tool state
    let fhState: FreehandState = createFreehandState()
    // Polygon tool state
    let polyPreview: SVGPathElement | null = null

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

      // Pen tool: each click adds a point
      if (mode === 'pen') {
        penState = penDown(penState, startSvg.x, startSvg.y, svg, selectedColor)
        return
      }

      // Freehand tool
      if (mode === 'freehand') {
        fhState = freehandDown(fhState, startSvg.x, startSvg.y, svg, selectedColor)
        return
      }

      // Polygon tool: drag from center
      if (mode === 'polygon') {
        drawActive = true
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
      } else if (mode === 'line' || mode === 'arrow') {
        // Ensure arrowhead marker exists for arrow mode
        if (mode === 'arrow') {
          let defs = svg.querySelector('defs')
          if (!defs) { defs = document.createElementNS(ns, 'defs'); svg.insertBefore(defs, svg.firstChild) }
          if (!defs.querySelector('#arrowhead')) {
            const marker = document.createElementNS(ns, 'marker')
            marker.setAttribute('id', 'arrowhead'); marker.setAttribute('markerWidth', '10')
            marker.setAttribute('markerHeight', '7'); marker.setAttribute('refX', '9')
            marker.setAttribute('refY', '3.5'); marker.setAttribute('orient', 'auto')
            const poly = document.createElementNS(ns, 'polygon')
            poly.setAttribute('points', '0 0, 10 3.5, 0 7'); poly.setAttribute('fill', selectedColor)
            marker.appendChild(poly); defs.appendChild(marker)
          }
        }
        const el = document.createElementNS(ns, 'line') as SVGLineElement
        el.setAttribute('x1', String(startSvg.x)); el.setAttribute('y1', String(startSvg.y))
        el.setAttribute('x2', String(startSvg.x)); el.setAttribute('y2', String(startSvg.y))
        el.setAttribute('fill', 'none'); el.setAttribute('stroke', selectedColor)
        el.setAttribute('stroke-width', '2'); el.setAttribute('stroke-linecap', 'round')
        el.setAttribute('opacity', '0.75')
        if (mode === 'arrow') el.setAttribute('marker-end', 'url(#arrowhead)')
        svg.appendChild(el); previewEl = el
      }
    }

    const onMove = (e: MouseEvent) => {
      const cur = clientToSvg(e.clientX, e.clientY)

      // Pen tool: update handle (during drag) or cursor line (during hover)
      if (mode === 'pen' && penState.points.length > 0) {
        penState = penMove(penState, cur.x, cur.y)
        if (penState.draggingHandle) return
      }

      // Freehand tool
      if (mode === 'freehand' && fhState.active) {
        fhState = freehandMove(fhState, cur.x, cur.y)
        return
      }

      // Polygon: live preview during drag
      if (mode === 'polygon' && drawActive) {
        const svg = editorRef.getSvg()
        if (!svg) return
        const radius = Math.hypot(cur.x - startSvg.x, cur.y - startSvg.y)
        if (polyPreview) polyPreview.remove()
        polyPreview = createPolygon(startSvg.x, startSvg.y, radius, 6, 0, selectedColor)
        polyPreview.setAttribute('opacity', '0.75')
        svg.appendChild(polyPreview)
        return
      }

      if (!drawActive || !previewEl) return
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
      } else if (mode === 'line' || mode === 'arrow') {
        previewEl.setAttribute('x2', String(cur.x))
        previewEl.setAttribute('y2', String(cur.y))
      }
    }

    const onUp = () => {
      // Pen tool: finish handle drag
      if (mode === 'pen') {
        penState = penUp(penState)
        return
      }

      // Freehand: commit
      if (mode === 'freehand' && fhState.active) {
        const result = freehandUp(fhState, selectedColor)
        fhState = result
        if (result.committed) pushUndo(result.committed, null)
        return
      }

      // Polygon: commit
      if (mode === 'polygon' && polyPreview) {
        polyPreview.setAttribute('opacity', '1')
        pushUndo(polyPreview, null)
        polyPreview = null
        drawActive = false
        return
      }

      if (!drawActive || !previewEl) { drawActive = false; return }
      drawActive = false
      previewEl.setAttribute('data-region', String(drawCounter++))
      previewEl.setAttribute('data-drawn', '1')
      previewEl.setAttribute('opacity', '1')
      pushUndo(previewEl, null)
      previewEl = null
    }

    // Pen tool: Escape to cancel, Enter to commit open path
    const onKey = (e: KeyboardEvent) => {
      if (mode === 'pen') {
        if (e.key === 'Escape') { penState = cancelPen(penState) }
        if (e.key === 'Enter') {
          const svg = editorRef.getSvg()
          if (svg) {
            const result = commitPen(penState, svg, selectedColor, false)
            penState = result
            if (result.committed) pushUndo(result.committed, null)
          }
        }
      }
    }

    box.addEventListener('mousedown', onDown, true)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    window.addEventListener('keydown', onKey)
    return () => {
      box.removeEventListener('mousedown', onDown, true)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('keydown', onKey)
      // Cleanup on mode switch
      if (penState.previewEl) penState.previewEl.remove()
      if (fhState.previewEl) fhState.previewEl.remove()
      if (polyPreview) polyPreview.remove()
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

  // ── Mouse (pan + paint/erase/select + move + marquee) ────────────────────
  useEffect(() => {
    if (isDrawMode) return
    const box = boxRef.current
    if (!box) return
    let md = false, mTgt: Element | null = null
    let mStart = { x: 0, y: 0 }, mMoved = false
    let panL: { x: number; y: number } | null = null
    let shiftDown = false

    // Drag-move state (supports multi-element move)
    let movingEls: Element[] = []
    let moveStartClient = { x: 0, y: 0 }
    let savedTransforms: string[] = []

    // Marquee state
    let marqueeActive = false

    const onDown = (e: MouseEvent) => {
      if (e.button !== 0 || cropActive) return
      md = true; mTgt = e.target as Element
      mStart = { x: e.clientX, y: e.clientY }; mMoved = false
      panL = { x: e.clientX, y: e.clientY }; e.preventDefault()
      shiftDown = e.shiftKey

      if (mode === 'select') {
        const clickedRegion = mTgt.getAttribute('data-region') ? mTgt : null
        // If clicking on a selected element: start move of all selected elements
        if (clickedRegion && usePaletteStore.getState().selectedEls.includes(clickedRegion)) {
          const els = usePaletteStore.getState().selectedEls
          movingEls = els
          moveStartClient = { x: e.clientX, y: e.clientY }
          savedTransforms = els.map(el => el.getAttribute('transform') ?? '')
          // Populate all elements for smart guides
          const svg = editorRef.getSvg()
          if (svg) setAllRegionEls(Array.from(svg.querySelectorAll('[data-region]')))
        }
        // If clicking on a non-selected region without shift: handled in onUp (select it)
        // If clicking on empty space: will start marquee in onMove
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

      // Multi-element move
      if (movingEls.length > 0) {
        const svgEl = editorRef.getSvg()
        const vbCur = editorRef.vbRef.current
        if (!svgEl || !vbCur) return
        const svgR = svgEl.getBoundingClientRect()
        let dx = (e.clientX - moveStartClient.x) / svgR.width  * vbCur.w
        let dy = (e.clientY - moveStartClient.y) / svgR.height * vbCur.h

        // Snap to grid
        if (usePaletteStore.getState().gridEnabled) {
          const gs = usePaletteStore.getState().gridSize
          dx = Math.round(dx / gs) * gs
          dy = Math.round(dy / gs) * gs
        }

        for (let i = 0; i < movingEls.length; i++) {
          const saved = savedTransforms[i]
          const tf = saved
            ? `translate(${dx.toFixed(2)}, ${dy.toFixed(2)}) ${saved}`
            : `translate(${dx.toFixed(2)}, ${dy.toFixed(2)})`
          movingEls[i].setAttribute('transform', tf)
        }
        setMovingElsForGuides([...movingEls])
        return
      }

      // Marquee selection (drag on empty space in select mode)
      if (mode === 'select' && !mTgt?.getAttribute('data-region')) {
        marqueeActive = true
        const mq = marqueeRef.current
        if (mq) {
          const cr = outerRef.current?.getBoundingClientRect()
          if (cr) {
            const x1 = mStart.x - cr.left, y1 = mStart.y - cr.top
            const x2 = e.clientX - cr.left, y2 = e.clientY - cr.top
            mq.style.display = 'block'
            mq.style.left   = Math.min(x1, x2) + 'px'
            mq.style.top    = Math.min(y1, y2) + 'px'
            mq.style.width  = Math.abs(x2 - x1) + 'px'
            mq.style.height = Math.abs(y2 - y1) + 'px'
          }
        }
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
    const onUp = (e: MouseEvent) => {
      if (!md) return; md = false

      // Finish multi-element move
      if (movingEls.length > 0 && mMoved) {
        for (let i = 0; i < movingEls.length; i++) {
          editorRef.pushUndoAttrs(movingEls[i], [['transform', savedTransforms[i] || null]])
        }
        movingEls = []; savedTransforms = []; mTgt = null; panL = null
        setMovingElsForGuides([])
        return
      }
      movingEls = []; savedTransforms = []
      setMovingElsForGuides([])

      // Finish marquee selection
      if (marqueeActive) {
        marqueeActive = false
        const mq = marqueeRef.current
        if (mq) {
          const mqR = mq.getBoundingClientRect()
          mq.style.display = 'none'
          // Find all [data-region] elements intersecting the marquee rect
          const svg = editorRef.getSvg()
          if (svg && mqR.width > 5 && mqR.height > 5) {
            const hits: Element[] = []
            svg.querySelectorAll('[data-region]').forEach(el => {
              const er = el.getBoundingClientRect()
              if (er.right > mqR.left && er.left < mqR.right &&
                  er.bottom > mqR.top && er.top < mqR.bottom) {
                hits.push(el)
              }
            })
            if (hits.length > 0) {
              if (shiftDown) {
                // Add to existing selection
                const cur = usePaletteStore.getState().selectedEls
                const merged = [...cur]
                for (const h of hits) { if (!merged.includes(h)) merged.push(h) }
                setSelectedEls(merged)
              } else {
                setSelectedEls(hits)
              }
            } else {
              setSelectedEls([])
            }
          }
        }
        mTgt = null; panL = null
        return
      }

      if (!mMoved && mTgt) {
        const region = mTgt.getAttribute('data-region') ? mTgt : null
        if (region) {
          if (mode === 'paint')        paint(region, selectedColor, false)
          else if (mode === 'erase')   paint(region, selectedColor, true)
          else if (mode === 'eyedropper') {
            const fill = region.getAttribute('fill')
            if (fill && fill !== 'none') usePaletteStore.getState().setColor(fill)
          }
          else if (mode === 'select') {
            if (shiftDown) {
              toggleSelectedEl(region)
            } else {
              setSelectedEl(region === selectedEl ? null : region)
            }
          }
        } else if (mode === 'select') {
          setSelectedEls([])
        }
      }
      mTgt = null; panL = null
    }
    const onLeave = () => { if (cdotRef.current) cdotRef.current.style.display = 'none' }

    box.addEventListener('mousedown', onDown)
    box.addEventListener('dblclick', e => {
      const tgt = e.target as Element
      if (tgt.getAttribute('data-region') && mode === 'select') {
        const tag = tgt.tagName.toLowerCase()
        if (tag === 'path') setNodeEditEl(tgt)
        else if (tag === 'text') setTextEditEl(tgt as SVGTextElement)
      } else if (!tgt.getAttribute('data-region')) {
        setNodeEditEl(null); setTextEditEl(null)
        resetZoom()
      }
    })
    box.addEventListener('mouseleave', onLeave)
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      box.removeEventListener('mousedown', onDown)
      box.removeEventListener('mouseleave', onLeave)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
  }, [isDrawMode, cropActive, selectedColor, mode, selectedEl, selectedEls, clientToSvg, editorRef, setSelectedEls, toggleSelectedEl])

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
  }, [cropActive, selectedColor, mode, selectedEl, setSelectedEl])

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
        <SelectionOverlay els={selectedEls} containerRef={outerRef} editorRef={editorRef} />
      )}

      {/* Rulers */}
      <Rulers editorRef={editorRef} />

      {/* Grid overlay */}
      {gridEnabled && <GridOverlay editorRef={editorRef} gridSize={gridSize} />}

      {/* Smart guides during drag */}
      <SmartGuides
        containerRef={outerRef}
        movingEls={movingElsForGuides}
        allEls={allRegionEls}
        enabled={guidesEnabled && movingElsForGuides.length > 0}
      />

      {/* Inline text editor (double-click text to edit) */}
      {textEditEl && mode === 'select' && (
        <InlineTextEditor
          el={textEditEl}
          containerRef={outerRef}
          editorRef={editorRef}
          onDone={() => setTextEditEl(null)}
        />
      )}

      {/* Node edit overlay (double-click path to edit nodes) */}
      {nodeEditEl && mode === 'select' && (
        <NodeEditOverlay
          el={nodeEditEl}
          containerRef={outerRef}
          editorRef={editorRef}
          onExit={exitNodeEdit}
        />
      )}

      {/* Marquee selection rectangle */}
      <div
        ref={marqueeRef}
        className="absolute border border-blue-400 bg-blue-400/10 pointer-events-none hidden z-20"
      />

      {/* Crop overlay — drag area */}
      {cropActive && (
        <div ref={cropOvRef} className="absolute inset-0 z-30 cursor-crosshair">
          <div
            ref={cropSelRef}
            className={cn('absolute border-2 border-dashed border-white', !cropSelVisible && 'hidden')}
            style={{ pointerEvents: 'none' }}
          />
          <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 bg-black/70 text-white text-xs px-3 py-1 rounded-full pointer-events-none whitespace-nowrap">
            Arraste para selecionar — depois clique em Confirmar
          </div>
        </div>
      )}
      {/* Crop buttons — rendered ABOVE the crop overlay so box-shadow can't cover them */}
      {cropActive && showCropOk && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 flex gap-2 z-[50] pointer-events-auto">
          <button
            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-xs rounded-lg font-semibold shadow-lg transition-colors"
            onClick={() => {
              if (cropSelRef.current && cropOvRef.current) {
                const ok = onCropConfirm(cropSelRef.current, cropOvRef.current)
                if (ok) { setCropSelVisible(false); setShowCropOk(false) }
              }
            }}
          >✓ Confirmar recorte</button>
          <button
            className="px-4 py-2 bg-white hover:bg-gray-100 border border-gray-300 text-xs rounded-lg shadow-lg transition-colors"
            onClick={() => { onCropCancel(); setCropSelVisible(false); setShowCropOk(false) }}
          >✕ Cancelar</button>
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

      {/* Context menu (right-click) */}
      <ContextMenu editorRef={editorRef} containerRef={outerRef} />

      {/* Minimap */}
      <Minimap editorRef={editorRef} />

      {/* Zoom bar */}
      <ZoomBar editorRef={editorRef} />

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
