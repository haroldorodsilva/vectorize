import { useEffect } from 'react'
import { cn } from '@/shared/lib/utils'
import { usePaletteStore, type EditorMode } from '@/features/palette/store'
import type { useEditor } from '@/features/editor/hooks/useEditor'
import {
  MousePointer2, Hand, Paintbrush, Eraser,
  Square, Circle, Minus, Type,
  RotateCcw, RotateCw, Scissors, Trash2, Undo2, Maximize2,
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
  const { mode, setMode, selectedEl, setSelectedEl } = usePaletteStore()

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
      if (k === 'z' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); editorRef.undo() }
      if ((k === 'delete' || k === 'backspace') && selectedEl) {
        e.preventDefault()
        editorRef.deleteSelected(selectedEl)
        setSelectedEl(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setMode, editorRef, selectedEl, setSelectedEl])

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

      <div className="mt-auto" />
      <div className="w-8 h-px bg-gray-200 mb-1" />

      {/* Actions */}
      {selectedEl && (
        <ActionBtn label="Excluir selecionado" kbd="Del" danger
          onClick={() => { editorRef.deleteSelected(selectedEl); setSelectedEl(null) }}
        >
          <Trash2 size={SZ} />
        </ActionBtn>
      )}
      <ActionBtn label="Desfazer" kbd="Ctrl+Z" onClick={() => editorRef.undo()}>
        <Undo2 size={SZ} />
      </ActionBtn>
      <ActionBtn label="Reset zoom" onClick={() => editorRef.resetZoom()}>
        <Maximize2 size={SZ} />
      </ActionBtn>
    </div>
  )
}
