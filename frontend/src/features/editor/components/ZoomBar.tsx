import { useState, useEffect, useRef } from 'react'
import { ZoomIn, ZoomOut, Maximize2 } from 'lucide-react'
import type { useEditor } from '../hooks/useEditor'

interface ZoomBarProps {
  editorRef: ReturnType<typeof useEditor>
}

export function ZoomBar({ editorRef }: ZoomBarProps) {
  const [zoom, setZoom] = useState(100)
  const rafRef = useRef<number>()

  useEffect(() => {
    const update = () => {
      const d = editorRef.displayRef?.current
      if (d) setZoom(Math.round(d.scale * 100))
      rafRef.current = requestAnimationFrame(update)
    }
    rafRef.current = requestAnimationFrame(update)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [editorRef])

  const zoomTo = (pct: number) => {
    const d = editorRef.displayRef?.current
    const box = editorRef.boxRef.current
    if (!d || !box) return
    const r = box.getBoundingClientRect()
    const cx = r.left + r.width / 2
    const cy = r.top + r.height / 2
    const factor = (pct / 100) / d.scale
    editorRef.zoomAt(cx, cy, factor)
  }

  return (
    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-lg px-2 py-1 shadow-sm z-20">
      <button onClick={() => zoomTo(zoom / 1.25)}
        className="p-0.5 rounded hover:bg-gray-100 text-gray-500 transition-colors">
        <ZoomOut size={14} />
      </button>

      <div className="flex items-center gap-0.5">
        {[25, 50, 100, 200].map(p => (
          <button key={p} onClick={() => zoomTo(p)}
            className={`text-[0.6rem] px-1.5 py-0.5 rounded transition-colors ${
              Math.abs(zoom - p) < 5
                ? 'bg-blue-100 text-blue-700 font-bold'
                : 'text-gray-400 hover:bg-gray-100'
            }`}
          >{p}%</button>
        ))}
      </div>

      <span className="text-[0.65rem] font-mono text-gray-600 w-10 text-center font-medium">
        {zoom}%
      </span>

      <button onClick={() => zoomTo(zoom * 1.25)}
        className="p-0.5 rounded hover:bg-gray-100 text-gray-500 transition-colors">
        <ZoomIn size={14} />
      </button>

      <div className="w-px h-4 bg-gray-200 mx-0.5" />

      <button onClick={() => editorRef.resetZoom()}
        className="p-0.5 rounded hover:bg-gray-100 text-gray-500 transition-colors"
        title="Ajustar à tela">
        <Maximize2 size={14} />
      </button>
    </div>
  )
}
