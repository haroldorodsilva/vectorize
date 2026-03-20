import { useState, useEffect } from 'react'
import { Plus, Trash2 } from 'lucide-react'
import { usePaletteStore } from '@/features/palette/store'
import type { useEditor } from '../hooks/useEditor'

export interface ComponentDef {
  id: string
  name: string
  svgMarkup: string
  createdAt: number
}

const STORAGE_KEY = 'vectorizer-components'

function loadComponents(): ComponentDef[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]')
  } catch { return [] }
}

function saveComponents(comps: ComponentDef[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(comps))
}

interface ComponentsPanelProps {
  editorRef: ReturnType<typeof useEditor>
}

export function ComponentsPanel({ editorRef }: ComponentsPanelProps) {
  const [components, setComponents] = useState<ComponentDef[]>(loadComponents)
  const { selectedEls } = usePaletteStore()

  useEffect(() => { saveComponents(components) }, [components])

  const saveAsComponent = () => {
    if (selectedEls.length === 0) return
    const name = prompt('Nome do componente:')
    if (!name) return

    const markup = selectedEls.map(el => new XMLSerializer().serializeToString(el)).join('\n')
    const comp: ComponentDef = {
      id: `comp-${Date.now().toString(36)}`,
      name,
      svgMarkup: markup,
      createdAt: Date.now(),
    }
    setComponents(prev => [...prev, comp])
  }

  const insertComponent = (comp: ComponentDef) => {
    const svg = editorRef.getSvg()
    const vb = editorRef.vbRef.current
    if (!svg || !vb) return

    const ns = 'http://www.w3.org/2000/svg'
    const g = document.createElementNS(ns, 'g') as SVGGElement
    g.setAttribute('data-region', String(Date.now()))
    g.setAttribute('data-drawn', '1')
    g.setAttribute('data-component', comp.id)

    // Parse markup and add children
    const parser = new DOMParser()
    const doc = parser.parseFromString(`<svg xmlns="http://www.w3.org/2000/svg">${comp.svgMarkup}</svg>`, 'image/svg+xml')
    const children = doc.querySelector('svg')?.children
    if (children) {
      for (const child of Array.from(children)) {
        g.appendChild(document.importNode(child, true))
      }
    }

    // Position at center
    const cx = vb.x + vb.w / 2
    const cy = vb.y + vb.h / 2
    g.setAttribute('transform', `translate(${cx.toFixed(0)}, ${cy.toFixed(0)})`)

    svg.appendChild(g)
    editorRef.pushUndo(g, null)
  }

  const deleteComponent = (id: string) => {
    setComponents(prev => prev.filter(c => c.id !== id))
  }

  return (
    <div className="space-y-2">
      {/* Save button */}
      <button
        onClick={saveAsComponent}
        disabled={selectedEls.length === 0}
        className="w-full flex items-center justify-center gap-1.5 text-xs py-1.5 border border-blue-200 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <Plus size={12} /> Salvar seleção como componente
      </button>

      {/* Components grid */}
      {components.length > 0 ? (
        <div className="space-y-1">
          {components.map(comp => (
            <div key={comp.id}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg border border-gray-100 hover:border-blue-300 hover:bg-blue-50/50 cursor-pointer transition-colors group"
              onClick={() => insertComponent(comp)}
            >
              <div className="w-8 h-8 bg-gray-50 rounded border border-gray-200 flex items-center justify-center overflow-hidden shrink-0">
                <svg viewBox="0 0 100 100" className="w-6 h-6"
                  dangerouslySetInnerHTML={{ __html: comp.svgMarkup }} />
              </div>
              <span className="text-xs text-gray-600 flex-1 truncate">{comp.name}</span>
              <button
                onClick={e => { e.stopPropagation(); deleteComponent(comp.id) }}
                className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 p-0.5 transition-opacity"
              >
                <Trash2 size={10} />
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[0.65rem] text-gray-400 text-center py-2">
          Selecione elementos e clique "Salvar" para criar componentes reutilizáveis.
        </p>
      )}
    </div>
  )
}
