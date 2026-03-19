import { useState, useEffect } from 'react'
import { Code, X, Check } from 'lucide-react'
import type { useEditor } from '../hooks/useEditor'
import { useVectorizeStore } from '@/features/vectorize/store'

interface SvgCodeEditorProps {
  editorRef: ReturnType<typeof useEditor>
}

export function SvgCodeEditor({ editorRef }: SvgCodeEditorProps) {
  const [open, setOpen] = useState(false)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)

  const loadCode = () => {
    const svg = editorRef.getSvg()
    if (!svg) return
    const str = new XMLSerializer().serializeToString(svg)
    // Pretty format (basic)
    setCode(str.replace(/></g, '>\n<'))
    setError(null)
  }

  useEffect(() => { if (open) loadCode() }, [open])

  const applyCode = () => {
    try {
      const parser = new DOMParser()
      const doc = parser.parseFromString(code, 'image/svg+xml')
      const err = doc.querySelector('parsererror')
      if (err) { setError('SVG inválido: ' + err.textContent?.slice(0, 100)); return }
      const svgEl = doc.querySelector('svg')
      if (!svgEl) { setError('Nenhum elemento <svg> encontrado'); return }

      // Apply: replace current SVG content
      const serialized = new XMLSerializer().serializeToString(svgEl)
      useVectorizeStore.getState().setSvgData({
        svg: serialized,
        regions: [], width: 0, height: 0, processing_time_ms: 0,
      })
      setOpen(false)
    } catch (e) {
      setError('Erro: ' + (e instanceof Error ? e.message : String(e)))
    }
  }

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="p-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors text-gray-600"
        title="Editor de código SVG">
        <Code size={14} />
      </button>

      {open && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/50" onClick={() => setOpen(false)}>
          <div className="bg-white rounded-2xl shadow-2xl w-[700px] max-w-[90vw] max-h-[80vh] flex flex-col animate-in"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
              <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                <Code size={16} /> Editor SVG
              </h2>
              <div className="flex gap-2">
                <button onClick={applyCode}
                  className="flex items-center gap-1 text-xs px-3 py-1.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700">
                  <Check size={12} /> Aplicar
                </button>
                <button onClick={() => setOpen(false)}
                  className="p-1.5 rounded hover:bg-gray-100">
                  <X size={16} />
                </button>
              </div>
            </div>

            {error && (
              <div className="px-4 py-2 bg-red-50 text-red-600 text-xs border-b border-red-100">
                {error}
              </div>
            )}

            <textarea
              value={code}
              onChange={e => { setCode(e.target.value); setError(null) }}
              className="flex-1 p-4 font-mono text-xs text-gray-800 resize-none focus:outline-none"
              style={{ minHeight: 400, tabSize: 2 }}
              spellCheck={false}
            />

            <div className="px-4 py-2 border-t border-gray-200 text-[0.6rem] text-gray-400">
              {code.length.toLocaleString()} caracteres · Edite o SVG diretamente e clique "Aplicar"
            </div>
          </div>
        </div>
      )}
    </>
  )
}
