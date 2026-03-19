import { useState, useEffect } from 'react'
import { FlipHorizontal2, FlipVertical2, Lock, Unlock } from 'lucide-react'
import type { useEditor } from '../hooks/useEditor'
import { getElSvgBBox } from '../lib/alignment'

interface TransformPanelProps {
  el: Element
  editorRef: ReturnType<typeof useEditor>
}

export function TransformPanel({ el, editorRef }: TransformPanelProps) {
  const [x, setX] = useState(0)
  const [y, setY] = useState(0)
  const [w, setW] = useState(0)
  const [h, setH] = useState(0)
  const [locked, setLocked] = useState(false)

  // Read position from element
  useEffect(() => {
    const svg = editorRef.getSvg()
    const vb = editorRef.vbRef.current
    if (!svg || !vb) return
    const box = getElSvgBBox(el, svg, vb)
    setX(Math.round(box.x))
    setY(Math.round(box.y))
    setW(Math.round(box.w))
    setH(Math.round(box.h))
  }, [el, editorRef])

  const applyPosition = (nx: number, ny: number) => {
    const svg = editorRef.getSvg()
    const vb = editorRef.vbRef.current
    if (!svg || !vb) return
    const box = getElSvgBBox(el, svg, vb)
    const dx = nx - box.x
    const dy = ny - box.y
    if (Math.abs(dx) < 0.1 && Math.abs(dy) < 0.1) return
    editorRef.pushUndoAttrs(el, [['transform', el.getAttribute('transform')]])
    const old = el.getAttribute('transform') ?? ''
    el.setAttribute('transform', `translate(${dx.toFixed(1)}, ${dy.toFixed(1)}) ${old}`.trim())
  }

  const flipH = () => {
    const svg = editorRef.getSvg()
    const vb = editorRef.vbRef.current
    if (!svg || !vb) return
    const box = getElSvgBBox(el, svg, vb)
    const cx = box.x + box.w / 2
    const cy = box.y + box.h / 2
    editorRef.pushUndoAttrs(el, [['transform', el.getAttribute('transform')]])
    const old = el.getAttribute('transform') ?? ''
    el.setAttribute('transform',
      `translate(${cx.toFixed(1)}, ${cy.toFixed(1)}) scale(-1, 1) translate(${(-cx).toFixed(1)}, ${(-cy).toFixed(1)}) ${old}`.trim())
  }

  const flipV = () => {
    const svg = editorRef.getSvg()
    const vb = editorRef.vbRef.current
    if (!svg || !vb) return
    const box = getElSvgBBox(el, svg, vb)
    const cx = box.x + box.w / 2
    const cy = box.y + box.h / 2
    editorRef.pushUndoAttrs(el, [['transform', el.getAttribute('transform')]])
    const old = el.getAttribute('transform') ?? ''
    el.setAttribute('transform',
      `translate(${cx.toFixed(1)}, ${cy.toFixed(1)}) scale(1, -1) translate(${(-cx).toFixed(1)}, ${(-cy).toFixed(1)}) ${old}`.trim())
  }

  const toggleLock = () => {
    const next = !locked
    setLocked(next)
    if (next) {
      el.setAttribute('data-locked', '1')
    } else {
      el.removeAttribute('data-locked')
    }
  }

  return (
    <div className="space-y-1.5">
      {/* Position */}
      <div className="grid grid-cols-2 gap-1.5">
        <div className="flex items-center gap-1">
          <span className="text-[0.6rem] text-gray-400 w-3">X</span>
          <input type="number" value={x}
            onChange={e => { const v = parseInt(e.target.value) || 0; setX(v); applyPosition(v, y) }}
            className="w-full text-[0.65rem] border border-gray-200 rounded px-1.5 py-0.5 text-center" />
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[0.6rem] text-gray-400 w-3">Y</span>
          <input type="number" value={y}
            onChange={e => { const v = parseInt(e.target.value) || 0; setY(v); applyPosition(x, v) }}
            className="w-full text-[0.65rem] border border-gray-200 rounded px-1.5 py-0.5 text-center" />
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[0.6rem] text-gray-400 w-3">W</span>
          <input type="number" value={w} readOnly
            className="w-full text-[0.65rem] border border-gray-100 rounded px-1.5 py-0.5 text-center bg-gray-50 text-gray-400" />
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[0.6rem] text-gray-400 w-3">H</span>
          <input type="number" value={h} readOnly
            className="w-full text-[0.65rem] border border-gray-100 rounded px-1.5 py-0.5 text-center bg-gray-50 text-gray-400" />
        </div>
      </div>

      {/* Flip + Lock */}
      <div className="flex gap-1">
        <button onClick={flipH}
          className="p-1.5 rounded border border-gray-200 hover:bg-gray-50 transition-colors" title="Espelhar horizontal">
          <FlipHorizontal2 size={13} />
        </button>
        <button onClick={flipV}
          className="p-1.5 rounded border border-gray-200 hover:bg-gray-50 transition-colors" title="Espelhar vertical">
          <FlipVertical2 size={13} />
        </button>
        <button onClick={toggleLock}
          className={`p-1.5 rounded border transition-colors ${locked ? 'border-red-300 bg-red-50 text-red-600' : 'border-gray-200 hover:bg-gray-50'}`}
          title={locked ? 'Desbloquear' : 'Bloquear'}>
          {locked ? <Lock size={13} /> : <Unlock size={13} />}
        </button>
      </div>
    </div>
  )
}
