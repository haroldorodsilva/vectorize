import { useState } from 'react'
import { Button } from '@/shared/components/ui/Button'
import { cn } from '@/shared/lib/utils'
import type { useEditor } from '@/features/editor/hooks/useEditor'

interface TransformToolbarProps {
  editorRef: ReturnType<typeof useEditor>
  cropActive: boolean
  onCropStart: () => void
  onCropCancel: () => void
}

type ActivePanel = 'rotate' | 'resize' | null

export function TransformToolbar({ editorRef, cropActive, onCropStart, onCropCancel }: TransformToolbarProps) {
  const [panel, setPanel]   = useState<ActivePanel>(null)
  const [locked, setLocked] = useState(true)
  const [resW, setResW]     = useState('')
  const [resH, setResH]     = useState('')

  const { getSvg, rotate, applyResize, syncResInputs, resetTransforms, origVbRef } = editorRef

  const toggle = (p: ActivePanel) => setPanel(prev => (prev === p ? null : p))

  const onResWChange = (v: string) => {
    setResW(v)
    if (!locked) return
    const el = getSvg(), origVb = origVbRef.current
    if (!el || !origVb) return
    const ratio = (parseFloat(el.getAttribute('height') ?? '') || origVb.h) /
                  (parseFloat(el.getAttribute('width')  ?? '') || origVb.w)
    setResH(v ? String(Math.round(parseInt(v) * ratio)) : '')
  }

  const onResHChange = (v: string) => {
    setResH(v)
    if (!locked) return
    const el = getSvg(), origVb = origVbRef.current
    if (!el || !origVb) return
    const ratio = (parseFloat(el.getAttribute('width')  ?? '') || origVb.w) /
                  (parseFloat(el.getAttribute('height') ?? '') || origVb.h)
    setResW(v ? String(Math.round(parseInt(v) * ratio)) : '')
  }

  const handleApplyResize = () => {
    const w = parseInt(resW), h = parseInt(resH)
    if (!w || !h || w < 1 || h < 1) { alert('Tamanho inválido.'); return }
    applyResize(w, h)
  }

  return (
    <div className="space-y-1.5">
      {/* Main toggle buttons */}
      <div className="flex gap-1.5 flex-wrap items-center px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl">
        <Button
          variant="outline" size="sm"
          active={panel === 'rotate'}
          onClick={() => toggle('rotate')}
        >
          ↻ Girar
        </Button>

        <Button
          variant="outline" size="sm"
          active={panel === 'resize'}
          onClick={() => toggle('resize')}
        >
          ⤢ Tamanho
        </Button>

        <Button
          variant="outline" size="sm"
          active={cropActive}
          onClick={cropActive ? onCropCancel : onCropStart}
        >
          ✂ Recortar
        </Button>

        <div className="w-px h-5 bg-gray-200 mx-0.5" />

        <Button
          variant="outline" size="sm"
          onClick={() => { resetTransforms(); syncResInputs(); setResW(''); setResH(''); setPanel(null) }}
          title="Desfazer todas as transformações"
        >
          ↺ Reset transf.
        </Button>
      </div>

      {/* Rotate panel */}
      {panel === 'rotate' && (
        <div className="flex gap-1.5 items-center px-3 py-2 bg-blue-50 border border-blue-200 rounded-xl">
          <span className="text-[0.65rem] text-blue-400 font-bold uppercase tracking-widest mr-1">Girar</span>
          <Button variant="outline" size="sm" onClick={() => rotate(-90)}>↺ −90°</Button>
          <Button variant="outline" size="sm" onClick={() => rotate(90)}>↻ +90°</Button>
          <Button variant="outline" size="sm" onClick={() => rotate(180)}>⇕ 180°</Button>
        </div>
      )}

      {/* Resize panel */}
      {panel === 'resize' && (
        <div className="flex gap-2 items-center px-3 py-2 bg-blue-50 border border-blue-200 rounded-xl flex-wrap">
          <span className="text-[0.65rem] text-blue-400 font-bold uppercase tracking-widest mr-1">Tamanho</span>
          <input
            type="number" min={1} max={8000} placeholder="Largura"
            value={resW}
            onChange={e => onResWChange(e.target.value)}
            className="w-24 text-center text-sm border border-gray-300 rounded-md px-2 py-1 bg-white"
          />
          <span className="text-xs text-gray-400">×</span>
          <input
            type="number" min={1} max={8000} placeholder="Altura"
            value={resH}
            onChange={e => onResHChange(e.target.value)}
            className="w-24 text-center text-sm border border-gray-300 rounded-md px-2 py-1 bg-white"
          />
          <button
            title="Travar proporção"
            onClick={() => setLocked(l => !l)}
            className={cn(
              'px-2 py-1 border rounded-md text-sm transition-colors',
              locked ? 'bg-blue-100 border-blue-400' : 'bg-white border-gray-300',
            )}
          >
            {locked ? '🔒' : '🔓'}
          </button>
          <Button variant="outline" size="sm" onClick={handleApplyResize}>Aplicar</Button>
        </div>
      )}
    </div>
  )
}
