import { useEffect } from 'react'
import { cn } from '@/shared/lib/utils'
import { usePaletteStore, type EditorMode } from '@/features/palette/store'
import type { useEditor } from '@/features/editor/hooks/useEditor'
import {
  MousePointer2, Hand, Paintbrush, Eraser,
  Square, Circle, Minus, Type,
  RotateCcw, RotateCw, Scissors, Trash2, Undo2, Redo2, Maximize2,
  PenTool, Hexagon, Pencil, Grid3x3, Pipette, MoveRight,
} from 'lucide-react'

interface LeftToolbarProps {
  editorRef: ReturnType<typeof useEditor>
  cropActive: boolean
  onCropStart: () => void
  onCropCancel: () => void
}

function Tip({ label, kbd }: { label: string; kbd?: string }) {
  return (
    <div className="
      pointer-events-none absolute left-full ml-2.5 top-1/2 -translate-y-1/2
      bg-gray-900 text-white text-xs rounded-lg px-2.5 py-1.5 whitespace-nowrap
      opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-[100]
      shadow-lg flex items-center gap-2
    ">
      <span>{label}</span>
      {kbd && <kbd className="bg-gray-700 text-gray-300 rounded px-1 py-px font-mono text-[0.6rem]">{kbd}</kbd>}
      <div className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-gray-900" />
    </div>
  )
}

function ToolBtn({ active, label, kbd, onClick, children }: {
  active?: boolean; label: string; kbd?: string; onClick: () => void; children: React.ReactNode
}) {
  return (
    <div className="relative group">
      <button
        onClick={onClick}
        className={cn(
          'w-10 h-10 flex items-center justify-center rounded-xl transition-all',
          active
            ? 'bg-blue-600 text-white shadow-sm'
            : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900',
        )}
      >
        {children}
      </button>
      <Tip label={label} kbd={kbd} />
    </div>
  )
}

function ActionBtn({ label, kbd, onClick, children, danger }: {
  label: string; kbd?: string; onClick: () => void; children: React.ReactNode; danger?: boolean
}) {
  return (
    <div className="relative group">
      <button
        onClick={onClick}
        className={cn(
          'w-10 h-10 flex items-center justify-center rounded-xl transition-all',
          danger
            ? 'text-red-400 hover:bg-red-50 hover:text-red-600'
            : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900',
        )}
      >
        {children}
      </button>
      <Tip label={label} kbd={kbd} />
    </div>
  )
}

const SZ = 16

export function LeftToolbar({ editorRef, cropActive, onCropStart, onCropCancel }: LeftToolbarProps) {
  const { mode, setMode, selectedEl, selectedEls, setSelectedEl, setSelectedEls } = usePaletteStore()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return
      const k = e.key.toLowerCase()
      if (k === 'v') setMode('select')
      if (k === 'h') setMode('pan')
      if (k === 'p') setMode('paint')
      if (k === 'e') setMode('erase')
      if (k === 'r') setMode('rect')
      if (k === 'o') setMode('ellipse')
      if (k === 'l') setMode('line')
      if (k === 't') setMode('text')
      if (k === 'n') setMode('pen')
      if (k === 'g') setMode('polygon')
      if (k === 'f') setMode('freehand')
      if (k === 'i') setMode('eyedropper')
      if (k === 'a' && !(e.ctrlKey || e.metaKey)) setMode('arrow')
      // Ctrl+A: select all
      if (k === 'a' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        const svg = editorRef.getSvg()
        if (svg) {
          const all = Array.from(svg.querySelectorAll('[data-region]'))
          setSelectedEls(all); setMode('select')
        }
      }
      if (k === 'z' && (e.ctrlKey || e.metaKey) && !e.shiftKey) { e.preventDefault(); editorRef.undo() }
      if (k === 'z' && (e.ctrlKey || e.metaKey) && e.shiftKey) { e.preventDefault(); editorRef.redo() }
      if (k === 'y' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); editorRef.redo() }
      if ((k === 'delete' || k === 'backspace') && selectedEls.length > 0) {
        e.preventDefault()
        for (const el of selectedEls) editorRef.deleteSelected(el)
        setSelectedEls([])
      }
      // Arrow keys: nudge selected elements (1px, Shift=10px)
      if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k) && selectedEls.length > 0 && mode === 'select') {
        e.preventDefault()
        const step = e.shiftKey ? 10 : 1
        const dx = k === 'arrowleft' ? -step : k === 'arrowright' ? step : 0
        const dy = k === 'arrowup' ? -step : k === 'arrowdown' ? step : 0
        for (const el of selectedEls) {
          const old = el.getAttribute('transform') ?? ''
          el.setAttribute('transform', `translate(${dx}, ${dy}) ${old}`.trim())
        }
      }
      // Ctrl+D: duplicate selected
      if (k === 'd' && (e.ctrlKey || e.metaKey) && selectedEls.length > 0) {
        e.preventDefault()
        const clones: Element[] = []
        for (const el of selectedEls) {
          const clone = editorRef.duplicate(el)
          if (clone) clones.push(clone)
        }
        if (clones.length > 0) setSelectedEls(clones)
      }
      // Ctrl+C: copy selected elements
      if (k === 'c' && (e.ctrlKey || e.metaKey) && selectedEls.length > 0) {
        const svgParts = selectedEls.map(el => new XMLSerializer().serializeToString(el))
        navigator.clipboard.writeText(svgParts.join('\n')).catch(() => {})
      }
      // Ctrl+V: paste from clipboard (SVG text or image)
      if (k === 'v' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        navigator.clipboard.read().then(async items => {
          const svg = editorRef.getSvg()
          const vb = editorRef.vbRef.current
          if (!svg || !vb) return
          for (const item of items) {
            // Try SVG/text first
            if (item.types.includes('text/plain')) {
              const blob = await item.getType('text/plain')
              const text = await blob.text()
              if (text.includes('<') && (text.includes('path') || text.includes('rect') || text.includes('svg'))) {
                // Parse SVG content
                const parser = new DOMParser()
                const doc = parser.parseFromString(`<svg xmlns="http://www.w3.org/2000/svg">${text}</svg>`, 'image/svg+xml')
                const els = doc.querySelectorAll('path, rect, ellipse, circle, line, text, g, polygon, image')
                els.forEach(el => {
                  const imported = document.importNode(el, true) as Element
                  if (!imported.getAttribute('data-region')) imported.setAttribute('data-region', String(Date.now()))
                  imported.setAttribute('data-drawn', '1')
                  svg.appendChild(imported)
                  editorRef.pushUndo(imported, null)
                })
                continue
              }
            }
            // Try image
            const imgType = item.types.find(t => t.startsWith('image/'))
            if (imgType) {
              const blob = await item.getType(imgType)
              const reader = new FileReader()
              reader.onload = () => {
                const dataUrl = reader.result as string
                const img = new Image()
                img.onload = () => {
                  const ns = 'http://www.w3.org/2000/svg'
                  const el = document.createElementNS(ns, 'image')
                  const cx = vb.x + vb.w / 2 - img.width / 2
                  const cy = vb.y + vb.h / 2 - img.height / 2
                  el.setAttribute('x', String(Math.round(cx)))
                  el.setAttribute('y', String(Math.round(cy)))
                  el.setAttribute('width', String(img.width))
                  el.setAttribute('height', String(img.height))
                  el.setAttribute('href', dataUrl)
                  el.setAttribute('data-region', String(Date.now()))
                  el.setAttribute('data-drawn', '1')
                  svg.appendChild(el)
                  editorRef.pushUndo(el, null)
                }
                img.src = dataUrl
              }
              reader.readAsDataURL(blob)
            }
          }
        }).catch(() => {})
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setMode, editorRef, selectedEl, selectedEls, setSelectedEl, setSelectedEls])

  const m = (mode_: EditorMode) => () => setMode(mode_)

  return (
    <div className="w-14 bg-white border-r border-gray-200 flex flex-col items-center py-3 gap-0.5 shadow-sm z-10 shrink-0 overflow-visible">

      {/* Selection */}
      <ToolBtn active={mode === 'select'} label="Selecionar" kbd="V" onClick={m('select')}>
        <MousePointer2 size={SZ} />
      </ToolBtn>
      <ToolBtn active={mode === 'pan'} label="Mover canvas" kbd="H" onClick={m('pan')}>
        <Hand size={SZ} />
      </ToolBtn>

      <div className="w-8 h-px bg-gray-200 my-1" />

      {/* Paint */}
      <ToolBtn active={mode === 'paint'} label="Pintar" kbd="P" onClick={m('paint')}>
        <Paintbrush size={SZ} />
      </ToolBtn>
      <ToolBtn active={mode === 'erase'} label="Apagar" kbd="E" onClick={m('erase')}>
        <Eraser size={SZ} />
      </ToolBtn>

      <div className="w-8 h-px bg-gray-200 my-1" />

      {/* Draw */}
      <ToolBtn active={mode === 'rect'} label="Retângulo" kbd="R" onClick={m('rect')}>
        <Square size={SZ} />
      </ToolBtn>
      <ToolBtn active={mode === 'ellipse'} label="Elipse" kbd="O" onClick={m('ellipse')}>
        <Circle size={SZ} />
      </ToolBtn>
      <ToolBtn active={mode === 'line'} label="Linha" kbd="L" onClick={m('line')}>
        <Minus size={SZ} />
      </ToolBtn>
      <ToolBtn active={mode === 'text'} label="Texto" kbd="T" onClick={m('text')}>
        <Type size={SZ} />
      </ToolBtn>
      <ToolBtn active={mode === 'pen'} label="Caneta Bézier" kbd="N" onClick={m('pen')}>
        <PenTool size={SZ} />
      </ToolBtn>
      <ToolBtn active={mode === 'polygon'} label="Polígono" kbd="G" onClick={m('polygon')}>
        <Hexagon size={SZ} />
      </ToolBtn>
      <ToolBtn active={mode === 'freehand'} label="Desenho livre" kbd="F" onClick={m('freehand')}>
        <Pencil size={SZ} />
      </ToolBtn>
      <ToolBtn active={mode === 'arrow'} label="Seta" kbd="A" onClick={m('arrow')}>
        <MoveRight size={SZ} />
      </ToolBtn>
      <ToolBtn active={mode === 'eyedropper'} label="Conta-gotas" kbd="I" onClick={m('eyedropper')}>
        <Pipette size={SZ} />
      </ToolBtn>

      <div className="w-8 h-px bg-gray-200 my-1" />

      {/* Transform */}
      <ActionBtn label="Girar −90°" onClick={() => editorRef.rotate(-90)}>
        <RotateCcw size={SZ} />
      </ActionBtn>
      <ActionBtn label="Girar +90°" onClick={() => editorRef.rotate(90)}>
        <RotateCw size={SZ} />
      </ActionBtn>
      <ToolBtn active={cropActive} label="Recortar" onClick={cropActive ? onCropCancel : onCropStart}>
        <Scissors size={SZ} />
      </ToolBtn>

      {/* Grid toggle */}
      <ToolBtn
        active={usePaletteStore.getState().gridEnabled}
        label={usePaletteStore.getState().gridEnabled ? 'Grid ativo' : 'Ativar grid'}
        onClick={() => {
          const s = usePaletteStore.getState()
          s.setGridEnabled(!s.gridEnabled)
        }}
      >
        <Grid3x3 size={SZ} />
      </ToolBtn>

      <div className="mt-auto" />
      <div className="w-8 h-px bg-gray-200 mb-1" />

      {/* Actions */}
      {selectedEls.length > 0 && (
        <ActionBtn label="Excluir selecionado" kbd="Del" danger
          onClick={() => { for (const el of selectedEls) editorRef.deleteSelected(el); setSelectedEls([]) }}
        >
          <Trash2 size={SZ} />
        </ActionBtn>
      )}
      <ActionBtn label="Desfazer" kbd="Ctrl+Z" onClick={() => editorRef.undo()}>
        <Undo2 size={SZ} />
      </ActionBtn>
      <ActionBtn label="Refazer" kbd="Ctrl+Shift+Z" onClick={() => editorRef.redo()}>
        <Redo2 size={SZ} />
      </ActionBtn>
      <ActionBtn label="Reset zoom" onClick={() => editorRef.resetZoom()}>
        <Maximize2 size={SZ} />
      </ActionBtn>
    </div>
  )
}
