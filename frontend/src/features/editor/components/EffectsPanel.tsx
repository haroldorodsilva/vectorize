import { useState, useEffect } from 'react'
import type { useEditor } from '../hooks/useEditor'
import {
  createDropShadowFilter, createBlurFilter,
  applyFilter, removeFilter, getFilterId, setBlendMode, genDefId,
} from '../lib/filterManager'

interface EffectsPanelProps {
  el: Element
  editorRef: ReturnType<typeof useEditor>
}

const BLEND_MODES = [
  'normal', 'multiply', 'screen', 'overlay', 'darken',
  'lighten', 'color-dodge', 'color-burn', 'hard-light', 'soft-light',
]

export function EffectsPanel({ el, editorRef }: EffectsPanelProps) {
  const [shadowOn, setShadowOn] = useState(false)
  const [shadowDx, setShadowDx] = useState(2)
  const [shadowDy, setShadowDy] = useState(2)
  const [shadowBlur, setShadowBlur] = useState(3)
  const [shadowColor, setShadowColor] = useState('#000000')
  const [shadowOpacity, setShadowOpacity] = useState(0.3)

  const [blurOn, setBlurOn] = useState(false)
  const [blurRadius, setBlurRadius] = useState(3)

  const [blendMode, setBlendModeState] = useState('normal')

  const [rx, setRx] = useState(0)

  // Read current state from element
  useEffect(() => {
    const filterId = getFilterId(el)
    setShadowOn(!!filterId && filterId.startsWith('shadow'))
    setBlurOn(!!filterId && filterId.startsWith('blur'))
    setRx(parseFloat(el.getAttribute('rx') ?? '0'))
    const style = el.getAttribute('style') ?? ''
    const bm = style.match(/mix-blend-mode:\s*(\S+)/)
    setBlendModeState(bm ? bm[1] : 'normal')
  }, [el])

  const applyShadow = (on: boolean, dx = shadowDx, dy = shadowDy, blur = shadowBlur, color = shadowColor, opacity = shadowOpacity) => {
    const svg = editorRef.getSvg()
    if (!svg) return
    editorRef.pushUndoAttrs(el, [['filter', el.getAttribute('filter')]])
    if (!on) { removeFilter(el, svg); return }
    const id = getFilterId(el) ?? genDefId('shadow')
    const filterEl = createDropShadowFilter(id, dx, dy, blur, color, opacity)
    applyFilter(el, svg, filterEl)
  }

  const applyBlur = (on: boolean, radius = blurRadius) => {
    const svg = editorRef.getSvg()
    if (!svg) return
    editorRef.pushUndoAttrs(el, [['filter', el.getAttribute('filter')]])
    if (!on) { removeFilter(el, svg); return }
    const id = getFilterId(el) ?? genDefId('blur')
    const filterEl = createBlurFilter(id, radius)
    applyFilter(el, svg, filterEl)
  }

  const onBlendChange = (mode: string) => {
    setBlendModeState(mode)
    editorRef.pushUndoAttrs(el, [['style', el.getAttribute('style')]])
    setBlendMode(el, mode)
  }

  const onRxChange = (v: number) => {
    setRx(v)
    editorRef.pushUndoAttrs(el, [['rx', el.getAttribute('rx')], ['ry', el.getAttribute('ry')]])
    el.setAttribute('rx', String(v))
    el.setAttribute('ry', String(v))
  }

  const isRect = el.tagName.toLowerCase() === 'rect'

  return (
    <div className="space-y-2">
      {/* Border radius (rect only) */}
      {isRect && (
        <div className="flex items-center gap-2">
          <label className="text-[0.65rem] text-gray-500 w-16 shrink-0">Raio borda</label>
          <input type="range" min={0} max={100} value={rx}
            onChange={e => onRxChange(parseFloat(e.target.value))}
            className="flex-1 h-1.5 accent-blue-600" />
          <span className="text-[0.65rem] text-gray-400 w-6 text-right">{Math.round(rx)}</span>
        </div>
      )}

      {/* Drop shadow */}
      <div className="space-y-1">
        <label className="flex items-center gap-2 text-[0.65rem]">
          <input type="checkbox" checked={shadowOn}
            onChange={e => { setShadowOn(e.target.checked); applyShadow(e.target.checked) }}
            className="w-3 h-3 accent-blue-600" />
          <span className="text-gray-600 font-medium">Sombra</span>
        </label>
        {shadowOn && (
          <div className="pl-5 space-y-1">
            <div className="flex items-center gap-1.5">
              <span className="text-[0.6rem] text-gray-400 w-8">Blur</span>
              <input type="range" min={0} max={20} step={0.5} value={shadowBlur}
                onChange={e => { const v = parseFloat(e.target.value); setShadowBlur(v); applyShadow(true, shadowDx, shadowDy, v) }}
                className="flex-1 h-1 accent-blue-600" />
              <span className="text-[0.6rem] text-gray-400 w-5">{shadowBlur}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[0.6rem] text-gray-400 w-8">Cor</span>
              <input type="color" value={shadowColor}
                onChange={e => { setShadowColor(e.target.value); applyShadow(true, shadowDx, shadowDy, shadowBlur, e.target.value) }}
                className="w-5 h-5 rounded border border-gray-200 cursor-pointer" />
            </div>
          </div>
        )}
      </div>

      {/* Gaussian blur */}
      <div className="space-y-1">
        <label className="flex items-center gap-2 text-[0.65rem]">
          <input type="checkbox" checked={blurOn}
            onChange={e => { setBlurOn(e.target.checked); applyBlur(e.target.checked) }}
            className="w-3 h-3 accent-blue-600" />
          <span className="text-gray-600 font-medium">Desfoque</span>
        </label>
        {blurOn && (
          <div className="pl-5 flex items-center gap-1.5">
            <span className="text-[0.6rem] text-gray-400 w-8">Raio</span>
            <input type="range" min={0.5} max={20} step={0.5} value={blurRadius}
              onChange={e => { const v = parseFloat(e.target.value); setBlurRadius(v); applyBlur(true, v) }}
              className="flex-1 h-1 accent-blue-600" />
            <span className="text-[0.6rem] text-gray-400 w-5">{blurRadius}</span>
          </div>
        )}
      </div>

      {/* Blend mode */}
      <div className="flex items-center gap-2">
        <label className="text-[0.65rem] text-gray-500 w-16 shrink-0">Blend</label>
        <select value={blendMode} onChange={e => onBlendChange(e.target.value)}
          className="flex-1 text-[0.65rem] border border-gray-200 rounded px-1.5 py-1">
          {BLEND_MODES.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>
    </div>
  )
}
