import { useEffect, useRef, useState, useCallback } from 'react'
import type { useEditor } from '../hooks/useEditor'
import {
  parsePath, serializePath, getAnchors, getHandles,
  moveAnchor, moveHandle, deleteAnchor, splitSegment, toggleNodeType,
  type PathSeg,
} from '../lib/pathParser'

interface NodeEditOverlayProps {
  el: Element
  containerRef: React.RefObject<HTMLDivElement | null>
  editorRef: ReturnType<typeof useEditor>
  onExit: () => void
}

/** Map an SVG-space point to screen-relative pixels (relative to container) */
function svgToScreen(
  pt: { x: number; y: number },
  svgEl: SVGSVGElement,
  ctr: HTMLDivElement,
  vb: { x: number; y: number; w: number; h: number },
) {
  const svgR = svgEl.getBoundingClientRect()
  const crR  = ctr.getBoundingClientRect()
  return {
    x: (pt.x - vb.x) / vb.w * svgR.width  + svgR.left - crR.left,
    y: (pt.y - vb.y) / vb.h * svgR.height + svgR.top  - crR.top,
  }
}

function screenToSvg(
  sx: number, sy: number,
  svgEl: SVGSVGElement,
  vb: { x: number; y: number; w: number; h: number },
) {
  const svgR = svgEl.getBoundingClientRect()
  return {
    x: vb.x + (sx - svgR.left) / svgR.width  * vb.w,
    y: vb.y + (sy - svgR.top)  / svgR.height * vb.h,
  }
}

export function NodeEditOverlay({ el, containerRef, editorRef, onExit }: NodeEditOverlayProps) {
  const [segs, setSegs] = useState<PathSeg[]>([])
  const [, forceRender] = useState(0)
  const savedD = useRef<string>('')
  const rafRef = useRef<number>()

  // Parse the path on mount
  useEffect(() => {
    const d = el.getAttribute('d') ?? ''
    savedD.current = d
    setSegs(parsePath(d))
  }, [el])

  // Apply segs back to DOM
  const applySegs = useCallback((newSegs: PathSeg[]) => {
    setSegs(newSegs)
    el.setAttribute('d', serializePath(newSegs))
  }, [el])

  // RAF loop to stay in sync with zoom/pan
  useEffect(() => {
    const tick = () => {
      forceRender(n => n + 1)
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [])

  // Keyboard: Delete selected node, Escape to exit
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onExit(); return }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onExit])

  // Push undo on exit if path changed
  useEffect(() => {
    return () => {
      const curD = el.getAttribute('d') ?? ''
      if (curD !== savedD.current) {
        editorRef.pushUndoAttrs(el, [['d', savedD.current]])
      }
    }
  }, [el, editorRef])

  const svgEl = editorRef.getSvg()
  const vb = editorRef.vbRef.current
  const ctr = containerRef.current
  if (!svgEl || !vb || !ctr || segs.length === 0) return null

  const anchors = getAnchors(segs)
  const handles = getHandles(segs)

  // ── Drag handlers ────────────────────────────────────────────────────────

  const onAnchorDown = (e: React.MouseEvent, segIdx: number) => {
    e.preventDefault(); e.stopPropagation()
    const startX = e.clientX, startY = e.clientY
    const origSegs = segs.map(s => ({ ...s }))

    const onMove = (ev: MouseEvent) => {
      if (!svgEl || !vb) return
      const svgR = svgEl.getBoundingClientRect()
      const dx = (ev.clientX - startX) / svgR.width  * vb.w
      const dy = (ev.clientY - startY) / svgR.height * vb.h
      applySegs(moveAnchor(origSegs, segIdx, dx, dy))
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const onHandleDown = (e: React.MouseEvent, segIdx: number, which: 'cp1' | 'cp2') => {
    e.preventDefault(); e.stopPropagation()
    const startX = e.clientX, startY = e.clientY
    const origSegs = segs.map(s => ({ ...s }))

    const onMove = (ev: MouseEvent) => {
      if (!svgEl || !vb) return
      const svgR = svgEl.getBoundingClientRect()
      const dx = (ev.clientX - startX) / svgR.width  * vb.w
      const dy = (ev.clientY - startY) / svgR.height * vb.h
      applySegs(moveHandle(origSegs, segIdx, which, dx, dy))
    }
    const onUp = () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const onAnchorRightClick = (e: React.MouseEvent, segIdx: number) => {
    e.preventDefault(); e.stopPropagation()
    // Right-click: toggle node type (smooth ↔ corner)
    applySegs(toggleNodeType(segs, segIdx))
  }

  const onAnchorDblClick = (e: React.MouseEvent, segIdx: number) => {
    e.preventDefault(); e.stopPropagation()
    // Double-click: delete node
    applySegs(deleteAnchor(segs, segIdx))
  }

  // Click on the path segment line to add a node
  const onSegmentClick = (e: React.MouseEvent, segIdx: number) => {
    e.preventDefault(); e.stopPropagation()
    applySegs(splitSegment(segs, segIdx, 0.5))
  }

  return (
    <div className="absolute inset-0 pointer-events-none z-20">
      <svg
        className="absolute inset-0 w-full h-full pointer-events-none"
        style={{ overflow: 'visible' }}
      >
        {/* Handle lines (connecting anchor to control point) */}
        {handles.map((h, i) => {
          const hp = svgToScreen(h.pt, svgEl, ctr, vb)
          const ap = svgToScreen(h.anchorPt, svgEl, ctr, vb)
          return (
            <line key={`hl-${i}`}
              x1={ap.x} y1={ap.y} x2={hp.x} y2={hp.y}
              stroke="#888" strokeWidth={1} strokeDasharray="3 2"
            />
          )
        })}
      </svg>

      {/* Clickable segment zones (for adding nodes) */}
      {anchors.map((a, idx) => {
        if (idx === 0) return null // Can't add before M
        const prev = anchors[idx - 1]
        const p1 = svgToScreen(prev.pt, svgEl, ctr, vb)
        const p2 = svgToScreen(a.pt, svgEl, ctr, vb)
        const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2
        return (
          <div key={`seg-${idx}`}
            className="absolute w-3 h-3 rounded-full bg-green-400/0 hover:bg-green-400/70 border border-transparent hover:border-green-600 pointer-events-auto cursor-cell transition-colors"
            style={{ left: mx - 6, top: my - 6 }}
            onClick={e => onSegmentClick(e, a.segIdx)}
            title="Adicionar nó"
          />
        )
      })}

      {/* Control point handles (circles) */}
      {handles.map((h, i) => {
        const sp = svgToScreen(h.pt, svgEl, ctr, vb)
        return (
          <div key={`cp-${i}`}
            className="absolute w-2.5 h-2.5 rounded-full bg-white border-2 border-orange-500 pointer-events-auto cursor-move shadow-sm"
            style={{ left: sp.x - 5, top: sp.y - 5 }}
            onMouseDown={e => onHandleDown(e, h.segIdx, h.which)}
          />
        )
      })}

      {/* Anchor points (squares) */}
      {anchors.map((a, i) => {
        const sp = svgToScreen(a.pt, svgEl, ctr, vb)
        return (
          <div key={`a-${i}`}
            className="absolute w-3 h-3 bg-white border-2 border-blue-600 pointer-events-auto cursor-move shadow-sm"
            style={{ left: sp.x - 6, top: sp.y - 6 }}
            onMouseDown={e => onAnchorDown(e, a.segIdx)}
            onContextMenu={e => onAnchorRightClick(e, a.segIdx)}
            onDoubleClick={e => onAnchorDblClick(e, a.segIdx)}
          />
        )
      })}
    </div>
  )
}
