import { useState, useEffect } from 'react'
import type { useEditor } from '../hooks/useEditor'

interface TypographyPanelProps {
  el: Element
  editorRef: ReturnType<typeof useEditor>
}

const FONTS = [
  'system-ui', 'Arial', 'Helvetica', 'Georgia', 'Times New Roman',
  'Courier New', 'Verdana', 'Impact', 'Comic Sans MS', 'Trebuchet MS',
  'Palatino', 'Garamond', 'Bookman', 'Avant Garde',
  'monospace', 'sans-serif', 'serif', 'cursive', 'fantasy',
]

const WEIGHTS = [
  { label: 'Thin', value: '100' },
  { label: 'Light', value: '300' },
  { label: 'Normal', value: '400' },
  { label: 'Medium', value: '500' },
  { label: 'Semi', value: '600' },
  { label: 'Bold', value: '700' },
  { label: 'Extra', value: '800' },
  { label: 'Black', value: '900' },
]

export function TypographyPanel({ el, editorRef }: TypographyPanelProps) {
  const [fontFamily, setFontFamily] = useState('system-ui')
  const [fontSize, setFontSize] = useState(16)
  const [fontWeight, setFontWeight] = useState('400')
  const [fontStyle, setFontStyle] = useState('normal')
  const [textAnchor, setTextAnchor] = useState('start')
  const [letterSpacing, setLetterSpacing] = useState(0)
  const [textDecoration, setTextDecoration] = useState('none')

  useEffect(() => {
    setFontFamily(el.getAttribute('font-family') ?? 'system-ui')
    setFontSize(parseFloat(el.getAttribute('font-size') ?? '16'))
    setFontWeight(el.getAttribute('font-weight') ?? '400')
    setFontStyle(el.getAttribute('font-style') ?? 'normal')
    setTextAnchor(el.getAttribute('text-anchor') ?? 'start')
    setLetterSpacing(parseFloat(el.getAttribute('letter-spacing') ?? '0'))
    setTextDecoration(el.getAttribute('text-decoration') ?? 'none')
  }, [el])

  const apply = (attr: string, value: string) => {
    editorRef.pushUndoAttrs(el, [[attr, el.getAttribute(attr)]])
    el.setAttribute(attr, value)
  }

  return (
    <div className="space-y-1.5">
      {/* Font family */}
      <div className="flex items-center gap-1.5">
        <span className="text-[0.6rem] text-gray-400 w-10 shrink-0">Fonte</span>
        <select value={fontFamily}
          onChange={e => { setFontFamily(e.target.value); apply('font-family', e.target.value) }}
          className="flex-1 text-[0.65rem] border border-gray-200 rounded px-1.5 py-0.5"
          style={{ fontFamily }}
        >
          {FONTS.map(f => <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>)}
        </select>
      </div>

      {/* Size + Weight */}
      <div className="flex items-center gap-1.5">
        <span className="text-[0.6rem] text-gray-400 w-10 shrink-0">Tam.</span>
        <input type="number" min={4} max={500} value={fontSize}
          onChange={e => { const v = parseInt(e.target.value) || 16; setFontSize(v); apply('font-size', String(v)) }}
          className="w-12 text-[0.65rem] border border-gray-200 rounded px-1.5 py-0.5 text-center" />
        <select value={fontWeight}
          onChange={e => { setFontWeight(e.target.value); apply('font-weight', e.target.value) }}
          className="flex-1 text-[0.65rem] border border-gray-200 rounded px-1.5 py-0.5">
          {WEIGHTS.map(w => <option key={w.value} value={w.value}>{w.label}</option>)}
        </select>
      </div>

      {/* Style buttons */}
      <div className="flex gap-1">
        <button
          onClick={() => { const v = fontStyle === 'italic' ? 'normal' : 'italic'; setFontStyle(v); apply('font-style', v) }}
          className={`flex-1 text-[0.65rem] py-0.5 rounded border transition-colors italic ${
            fontStyle === 'italic' ? 'bg-blue-100 border-blue-300 text-blue-700' : 'border-gray-200 hover:bg-gray-50 text-gray-500'
          }`}>Itálico</button>
        <button
          onClick={() => { const v = textDecoration === 'underline' ? 'none' : 'underline'; setTextDecoration(v); apply('text-decoration', v) }}
          className={`flex-1 text-[0.65rem] py-0.5 rounded border transition-colors underline ${
            textDecoration === 'underline' ? 'bg-blue-100 border-blue-300 text-blue-700' : 'border-gray-200 hover:bg-gray-50 text-gray-500'
          }`}>Sublinhado</button>
        <button
          onClick={() => { const v = textDecoration === 'line-through' ? 'none' : 'line-through'; setTextDecoration(v); apply('text-decoration', v) }}
          className={`flex-1 text-[0.65rem] py-0.5 rounded border transition-colors line-through ${
            textDecoration === 'line-through' ? 'bg-blue-100 border-blue-300 text-blue-700' : 'border-gray-200 hover:bg-gray-50 text-gray-500'
          }`}>Riscado</button>
      </div>

      {/* Alignment */}
      <div className="flex items-center gap-1.5">
        <span className="text-[0.6rem] text-gray-400 w-10 shrink-0">Alinhar</span>
        <div className="flex gap-0.5 flex-1">
          {[
            { v: 'start', label: 'Esq.' },
            { v: 'middle', label: 'Centro' },
            { v: 'end', label: 'Dir.' },
          ].map(a => (
            <button key={a.v}
              onClick={() => { setTextAnchor(a.v); apply('text-anchor', a.v) }}
              className={`flex-1 text-[0.55rem] py-0.5 rounded border transition-colors ${
                textAnchor === a.v ? 'bg-blue-100 border-blue-300 text-blue-700' : 'border-gray-200 hover:bg-gray-50 text-gray-500'
              }`}>{a.label}</button>
          ))}
        </div>
      </div>

      {/* Letter spacing */}
      <div className="flex items-center gap-1.5">
        <span className="text-[0.6rem] text-gray-400 w-10 shrink-0">Espaço</span>
        <input type="range" min={-5} max={20} step={0.5} value={letterSpacing}
          onChange={e => { const v = parseFloat(e.target.value); setLetterSpacing(v); apply('letter-spacing', String(v)) }}
          className="flex-1 h-1 accent-blue-600" />
        <span className="text-[0.55rem] text-gray-400 w-6 text-right">{letterSpacing}</span>
      </div>
    </div>
  )
}
