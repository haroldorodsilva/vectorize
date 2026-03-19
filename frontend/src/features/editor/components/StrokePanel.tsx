import { useState, useEffect } from 'react'
import type { useEditor } from '../hooks/useEditor'

interface StrokePanelProps {
  el: Element
  editorRef: ReturnType<typeof useEditor>
}

const DASH_PRESETS = [
  { label: 'Sólido', value: '' },
  { label: 'Tracejado', value: '8 4' },
  { label: 'Pontilhado', value: '2 4' },
  { label: 'Traço-ponto', value: '8 4 2 4' },
]

const CAPS = ['butt', 'round', 'square'] as const
const JOINS = ['miter', 'round', 'bevel'] as const

export function StrokePanel({ el, editorRef }: StrokePanelProps) {
  const [color, setColor] = useState('#000000')
  const [width, setWidth] = useState(0)
  const [dash, setDash] = useState('')
  const [cap, setCap] = useState<string>('butt')
  const [join, setJoin] = useState<string>('miter')
  const [opacity, setOpacity] = useState(1)

  useEffect(() => {
    setColor(el.getAttribute('stroke') ?? '#000000')
    setWidth(parseFloat(el.getAttribute('stroke-width') ?? '0'))
    setDash(el.getAttribute('stroke-dasharray') ?? '')
    setCap(el.getAttribute('stroke-linecap') ?? 'butt')
    setJoin(el.getAttribute('stroke-linejoin') ?? 'miter')
    setOpacity(parseFloat(el.getAttribute('stroke-opacity') ?? '1'))
  }, [el])

  const apply = (attr: string, value: string) => {
    editorRef.pushUndoAttrs(el, [[attr, el.getAttribute(attr)]])
    if (value) el.setAttribute(attr, value)
    else el.removeAttribute(attr)
    // Ensure stroke is visible
    if (attr === 'stroke-width' && parseFloat(value) > 0) {
      const cur = el.getAttribute('stroke')
      if (!cur || cur === 'none') el.setAttribute('stroke', color)
    }
  }

  return (
    <div className="space-y-1.5">
      {/* Color + Width */}
      <div className="flex items-center gap-2">
        <input type="color" value={color === 'none' ? '#000000' : color}
          onChange={e => { setColor(e.target.value); apply('stroke', e.target.value); if (width === 0) { setWidth(1); apply('stroke-width', '1') } }}
          className="w-6 h-6 rounded border border-gray-200 cursor-pointer" />
        <input type="number" min={0} max={50} step={0.5} value={width}
          onChange={e => { const v = parseFloat(e.target.value) || 0; setWidth(v); apply('stroke-width', String(v)) }}
          className="w-12 text-[0.65rem] border border-gray-200 rounded px-1.5 py-0.5 text-center" />
        <button onClick={() => { setWidth(0); setColor('none'); apply('stroke', 'none'); apply('stroke-width', '0') }}
          className="text-[0.6rem] text-gray-400 hover:text-red-500 px-1">Sem</button>
      </div>

      {width > 0 && (
        <>
          {/* Dash pattern */}
          <div className="flex items-center gap-1.5">
            <span className="text-[0.6rem] text-gray-400 w-8">Traço</span>
            <div className="flex gap-0.5 flex-1">
              {DASH_PRESETS.map(d => (
                <button key={d.value || 'solid'}
                  onClick={() => { setDash(d.value); apply('stroke-dasharray', d.value) }}
                  className={`flex-1 text-[0.55rem] py-0.5 rounded border transition-colors ${
                    dash === d.value ? 'bg-blue-100 border-blue-300 text-blue-700' : 'border-gray-200 hover:bg-gray-50 text-gray-500'
                  }`}>
                  {d.label}
                </button>
              ))}
            </div>
          </div>

          {/* Cap */}
          <div className="flex items-center gap-1.5">
            <span className="text-[0.6rem] text-gray-400 w-8">Ponta</span>
            <div className="flex gap-0.5 flex-1">
              {CAPS.map(c => (
                <button key={c}
                  onClick={() => { setCap(c); apply('stroke-linecap', c) }}
                  className={`flex-1 text-[0.55rem] py-0.5 rounded border transition-colors ${
                    cap === c ? 'bg-blue-100 border-blue-300 text-blue-700' : 'border-gray-200 hover:bg-gray-50 text-gray-500'
                  }`}>
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Join */}
          <div className="flex items-center gap-1.5">
            <span className="text-[0.6rem] text-gray-400 w-8">Junção</span>
            <div className="flex gap-0.5 flex-1">
              {JOINS.map(j => (
                <button key={j}
                  onClick={() => { setJoin(j); apply('stroke-linejoin', j) }}
                  className={`flex-1 text-[0.55rem] py-0.5 rounded border transition-colors ${
                    join === j ? 'bg-blue-100 border-blue-300 text-blue-700' : 'border-gray-200 hover:bg-gray-50 text-gray-500'
                  }`}>
                  {j}
                </button>
              ))}
            </div>
          </div>

          {/* Opacity */}
          <div className="flex items-center gap-1.5">
            <span className="text-[0.6rem] text-gray-400 w-8">Opac.</span>
            <input type="range" min={0} max={1} step={0.05} value={opacity}
              onChange={e => { const v = parseFloat(e.target.value); setOpacity(v); apply('stroke-opacity', String(v)) }}
              className="flex-1 h-1 accent-blue-600" />
            <span className="text-[0.55rem] text-gray-400 w-8 text-right">{Math.round(opacity * 100)}%</span>
          </div>
        </>
      )}
    </div>
  )
}
