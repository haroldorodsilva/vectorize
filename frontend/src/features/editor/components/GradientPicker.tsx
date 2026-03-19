import { useState, useEffect } from 'react'
import type { useEditor } from '../hooks/useEditor'
import {
  genDefId, upsertDef, removeDef,
  createLinearGradient, createRadialGradient,
} from '../lib/defsManager'

type FillMode = 'solid' | 'linear' | 'radial'

interface GradientStop { offset: number; color: string }

interface GradientPickerProps {
  el: Element
  editorRef: ReturnType<typeof useEditor>
}

function parseCurrentFill(el: Element): {
  mode: FillMode
  solidColor: string
  stops: GradientStop[]
  angle: number
  gradId: string | null
} {
  const fill = el.getAttribute('fill') ?? '#ffffff'
  const urlMatch = fill.match(/^url\(#(.+)\)$/)

  if (urlMatch) {
    const id = urlMatch[1]
    const svg = el.closest('svg')
    const def = svg?.querySelector(`#${CSS.escape(id)}`)
    if (def) {
      const stops: GradientStop[] = []
      def.querySelectorAll('stop').forEach(s => {
        stops.push({
          offset: parseFloat(s.getAttribute('offset') ?? '0') / 100,
          color: s.getAttribute('stop-color') ?? '#000000',
        })
      })
      if (stops.length === 0) stops.push({ offset: 0, color: '#000' }, { offset: 1, color: '#fff' })

      const isRadial = def.tagName === 'radialGradient'
      return {
        mode: isRadial ? 'radial' : 'linear',
        solidColor: stops[0]?.color ?? '#ffffff',
        stops,
        angle: 0,
        gradId: id,
      }
    }
  }

  return {
    mode: 'solid',
    solidColor: fill,
    stops: [{ offset: 0, color: '#F94144' }, { offset: 1, color: '#577590' }],
    angle: 90,
    gradId: null,
  }
}

export function GradientPicker({ el, editorRef }: GradientPickerProps) {
  const [mode, setMode] = useState<FillMode>('solid')
  const [solidColor, setSolidColor] = useState('#ffffff')
  const [stops, setStops] = useState<GradientStop[]>([
    { offset: 0, color: '#F94144' },
    { offset: 1, color: '#577590' },
  ])
  const [angle, setAngle] = useState(90)
  const [gradId, setGradId] = useState<string | null>(null)

  // Parse current fill on mount / el change
  useEffect(() => {
    const parsed = parseCurrentFill(el)
    setMode(parsed.mode)
    setSolidColor(parsed.solidColor)
    setStops(parsed.stops)
    setAngle(parsed.angle)
    setGradId(parsed.gradId)
  }, [el])

  const applyGradient = (newStops: GradientStop[], newAngle: number, newMode: FillMode) => {
    const svg = editorRef.getSvg()
    if (!svg) return

    // Save undo
    editorRef.pushUndoAttrs(el, [['fill', el.getAttribute('fill')]])

    if (newMode === 'solid') {
      // Remove old gradient def if exists
      if (gradId) { removeDef(svg, gradId); setGradId(null) }
      el.setAttribute('fill', solidColor)
      return
    }

    const id = gradId || genDefId('grad')
    setGradId(id)

    const def = newMode === 'linear'
      ? createLinearGradient(id, newStops, newAngle)
      : createRadialGradient(id, newStops)

    upsertDef(svg, def)
    el.setAttribute('fill', `url(#${id})`)
  }

  const onModeChange = (m: FillMode) => {
    setMode(m)
    if (m === 'solid') {
      const svg = editorRef.getSvg()
      if (svg && gradId) { removeDef(svg, gradId); setGradId(null) }
      editorRef.pushUndoAttrs(el, [['fill', el.getAttribute('fill')]])
      el.setAttribute('fill', solidColor)
    } else {
      applyGradient(stops, angle, m)
    }
  }

  const onSolidChange = (c: string) => {
    setSolidColor(c)
    if (mode === 'solid') {
      el.setAttribute('fill', c)
    }
  }

  const onStopColorChange = (idx: number, color: string) => {
    const newStops = stops.map((s, i) => i === idx ? { ...s, color } : s)
    setStops(newStops)
    applyGradient(newStops, angle, mode)
  }

  const onAngleChange = (a: number) => {
    setAngle(a)
    applyGradient(stops, a, mode)
  }

  const addStop = () => {
    if (stops.length >= 5) return
    const newStops = [...stops, { offset: 0.5, color: '#ffffff' }].sort((a, b) => a.offset - b.offset)
    setStops(newStops)
    applyGradient(newStops, angle, mode)
  }

  const removeStop = (idx: number) => {
    if (stops.length <= 2) return
    const newStops = stops.filter((_, i) => i !== idx)
    setStops(newStops)
    applyGradient(newStops, angle, mode)
  }

  return (
    <div className="space-y-2">
      {/* Mode selector */}
      <div className="flex rounded-lg border border-gray-200 overflow-hidden text-[0.65rem] font-semibold">
        {(['solid', 'linear', 'radial'] as FillMode[]).map(m => (
          <button key={m}
            onClick={() => onModeChange(m)}
            className={`flex-1 py-1 transition-colors ${
              mode === m ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'
            } ${m !== 'solid' ? 'border-l border-gray-200' : ''}`}
          >
            {m === 'solid' ? 'Sólido' : m === 'linear' ? 'Linear' : 'Radial'}
          </button>
        ))}
      </div>

      {mode === 'solid' && (
        <div className="flex items-center gap-2">
          <input type="color" value={solidColor}
            onChange={e => onSolidChange(e.target.value)}
            className="w-7 h-7 rounded border border-gray-200 cursor-pointer"
          />
          <span className="text-xs text-gray-400 font-mono">{solidColor}</span>
        </div>
      )}

      {(mode === 'linear' || mode === 'radial') && (
        <div className="space-y-1.5">
          {/* Preview bar */}
          <div className="h-4 rounded-md border border-gray-200"
            style={{
              background: mode === 'linear'
                ? `linear-gradient(${angle}deg, ${stops.map(s => `${s.color} ${Math.round(s.offset * 100)}%`).join(', ')})`
                : `radial-gradient(circle, ${stops.map(s => `${s.color} ${Math.round(s.offset * 100)}%`).join(', ')})`,
            }}
          />

          {/* Stops */}
          {stops.map((s, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <input type="color" value={s.color}
                onChange={e => onStopColorChange(i, e.target.value)}
                className="w-5 h-5 rounded border border-gray-200 cursor-pointer"
              />
              <span className="text-[0.6rem] text-gray-400 w-8">{Math.round(s.offset * 100)}%</span>
              {stops.length > 2 && (
                <button onClick={() => removeStop(i)}
                  className="text-gray-300 hover:text-red-500 text-xs">×</button>
              )}
            </div>
          ))}
          {stops.length < 5 && (
            <button onClick={addStop}
              className="text-[0.6rem] text-blue-500 hover:text-blue-700">+ Adicionar cor</button>
          )}

          {/* Angle (linear only) */}
          {mode === 'linear' && (
            <div className="flex items-center gap-2">
              <label className="text-[0.6rem] text-gray-400 w-10">Ângulo</label>
              <input type="range" min={0} max={360} value={angle}
                onChange={e => onAngleChange(parseInt(e.target.value))}
                className="flex-1 h-1.5 accent-blue-600"
              />
              <span className="text-[0.6rem] text-gray-400 w-8">{angle}°</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
