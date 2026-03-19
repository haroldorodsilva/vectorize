import { useState, useRef } from 'react'
import { cn } from '@/shared/lib/utils'
import { Eye, EyeOff, Lock, Unlock, GripVertical, Trash2, Search } from 'lucide-react'
import { usePaletteStore } from '@/features/palette/store'
import type { useEditor } from '../hooks/useEditor'

interface LayersPanelProps {
  elements: Element[]
  editorRef: ReturnType<typeof useEditor>
  onRefresh: () => void
}

function elLabel(el: Element, i: number): string {
  const tag = el.tagName.toLowerCase()
  if (tag === 'text') return el.textContent?.trim().slice(0, 15) || `Texto ${i + 1}`
  if (tag === 'rect') return `Retângulo ${i + 1}`
  if (tag === 'ellipse' || tag === 'circle') return `Elipse ${i + 1}`
  if (tag === 'line') return `Linha ${i + 1}`
  if (tag === 'image') return `Imagem ${i + 1}`
  if (tag === 'g') return el.getAttribute('data-icon') ? `Ícone ${i + 1}` : `Grupo ${i + 1}`
  return `Path ${i + 1}`
}

export function LayersPanel({ elements, editorRef, onRefresh }: LayersPanelProps) {
  const { selectedEls, setSelectedEl, setSelectedEls, setMode } = usePaletteStore()
  const [dragIdx, setDragIdx] = useState<number | null>(null)
  const [dropIdx, setDropIdx] = useState<number | null>(null)
  const [filter, setFilter] = useState('')
  const dragEl = useRef<Element | null>(null)

  const handleDragStart = (i: number) => {
    setDragIdx(i)
    dragEl.current = elements[i]
  }

  const handleDragOver = (e: React.DragEvent, i: number) => {
    e.preventDefault()
    setDropIdx(i)
  }

  const handleDrop = (targetIdx: number) => {
    if (dragIdx === null || dragIdx === targetIdx || !dragEl.current) {
      setDragIdx(null); setDropIdx(null)
      return
    }
    const svg = editorRef.getSvg()
    if (!svg) return

    const el = dragEl.current
    const targetEl = elements[targetIdx]

    // Reorder in SVG DOM: move dragged element before/after target
    if (dragIdx > targetIdx) {
      // Moving up in the list = moving later in DOM (rendered on top)
      targetEl.parentNode?.insertBefore(el, targetEl.nextSibling)
    } else {
      // Moving down in the list = moving earlier in DOM (rendered below)
      targetEl.parentNode?.insertBefore(el, targetEl)
    }

    setDragIdx(null)
    setDropIdx(null)
    dragEl.current = null
    onRefresh()
  }

  const toggleVisibility = (el: Element) => {
    if (el.getAttribute('visibility') === 'hidden') {
      el.removeAttribute('visibility')
    } else {
      el.setAttribute('visibility', 'hidden')
    }
    onRefresh()
  }

  const toggleLock = (el: Element) => {
    if (el.getAttribute('data-locked') === '1') {
      el.removeAttribute('data-locked')
    } else {
      el.setAttribute('data-locked', '1')
    }
    onRefresh()
  }

  const deleteEl = (el: Element) => {
    editorRef.deleteSelected(el)
    if (selectedEls.includes(el)) setSelectedEls(selectedEls.filter(e => e !== el))
    onRefresh()
  }

  // Reverse order: top layer first, then filter
  const reversed = [...elements].reverse()
  const filtered = filter
    ? reversed.filter((el, i) => elLabel(el, elements.length - 1 - i).toLowerCase().includes(filter.toLowerCase()))
    : reversed

  return (
    <div className="space-y-1.5">
      {/* Search */}
      {elements.length > 5 && (
        <div className="relative">
          <Search size={10} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" value={filter} onChange={e => setFilter(e.target.value)}
            placeholder="Buscar camada…"
            className="w-full text-[0.65rem] pl-6 pr-2 py-1 border border-gray-200 rounded bg-white focus:border-blue-400 focus:outline-none" />
        </div>
      )}
      <div className="space-y-0.5 max-h-60 overflow-y-auto pr-0.5">
      {filtered.length === 0 && <p className="text-xs text-gray-400 text-center py-2">{filter ? 'Nenhum resultado.' : 'Nenhuma camada.'}</p>}
      {filtered.map((el, ri) => {
        const i = elements.indexOf(el)
        const fill = el.getAttribute('fill') ?? '#FFFFFF'
        const isSelected = selectedEls.includes(el)
        const isHidden = el.getAttribute('visibility') === 'hidden'
        const isLocked = el.getAttribute('data-locked') === '1'

        return (
          <div
            key={i}
            draggable
            onDragStart={() => handleDragStart(i)}
            onDragOver={e => handleDragOver(e, i)}
            onDrop={() => handleDrop(i)}
            onDragEnd={() => { setDragIdx(null); setDropIdx(null) }}
            onClick={() => { setSelectedEl(isSelected ? null : el); setMode('select') }}
            className={cn(
              'flex items-center gap-1 px-1 py-1 rounded-lg cursor-pointer transition-all text-xs',
              isSelected ? 'bg-blue-50 ring-1 ring-blue-300' : 'hover:bg-gray-50',
              isHidden && 'opacity-40',
              dropIdx === i && 'ring-2 ring-blue-400',
              dragIdx === i && 'opacity-30',
            )}
          >
            <GripVertical size={10} className="text-gray-300 cursor-grab shrink-0" />
            <div className="w-3.5 h-3.5 rounded-sm border border-gray-200 shrink-0"
              style={{
                background: fill === '#FFFFFF' || fill === 'none' || fill.startsWith('url') ? 'transparent' : fill,
                backgroundImage: fill === '#FFFFFF' || fill === 'none'
                  ? 'repeating-conic-gradient(#ddd 0% 25%, transparent 0% 50%)' : 'none',
                backgroundSize: '5px 5px',
              }} />
            <span className={cn('text-gray-600 truncate flex-1', isLocked && 'italic text-gray-400')}>
              {elLabel(el, i)}
            </span>
            <button onClick={e => { e.stopPropagation(); toggleLock(el) }}
              className={cn('p-0.5', isLocked ? 'text-red-400' : 'text-gray-200 hover:text-gray-500')}>
              {isLocked ? <Lock size={9} /> : <Unlock size={9} />}
            </button>
            <button onClick={e => { e.stopPropagation(); toggleVisibility(el) }}
              className="text-gray-200 hover:text-gray-600 p-0.5">
              {isHidden ? <EyeOff size={9} /> : <Eye size={9} />}
            </button>
            <button onClick={e => { e.stopPropagation(); deleteEl(el) }}
              className="text-gray-200 hover:text-red-500 p-0.5">
              <Trash2 size={9} />
            </button>
          </div>
        )
      })}
      </div>
    </div>
  )
}
