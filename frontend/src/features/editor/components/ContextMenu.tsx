import { useState, useEffect, useRef } from 'react'
import { usePaletteStore } from '@/features/palette/store'
import type { useEditor } from '../hooks/useEditor'
import {
  Copy, Trash2, ChevronsUp, ChevronsDown, FlipHorizontal2, FlipVertical2,
  Lock, Unlock, Eye, EyeOff,
} from 'lucide-react'
import { getElSvgBBox } from '../lib/alignment'

interface ContextMenuProps {
  editorRef: ReturnType<typeof useEditor>
  containerRef: React.RefObject<HTMLDivElement | null>
}

interface MenuState {
  x: number
  y: number
  el: Element | null
}

export function ContextMenu({ editorRef, containerRef }: ContextMenuProps) {
  const [menu, setMenu] = useState<MenuState | null>(null)
  const { selectedEls, setSelectedEl, setSelectedEls, setMode } = usePaletteStore()
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const ctr = containerRef.current
    if (!ctr) return

    const onContext = (e: MouseEvent) => {
      const tgt = e.target as Element
      const region = tgt.closest('[data-region]')
      if (!region) { setMenu(null); return }
      e.preventDefault()
      const cr = ctr.getBoundingClientRect()
      setMenu({ x: e.clientX - cr.left, y: e.clientY - cr.top, el: region })
      if (!selectedEls.includes(region)) {
        setSelectedEl(region)
        setMode('select')
      }
    }

    const onClickAway = () => setMenu(null)

    ctr.addEventListener('contextmenu', onContext)
    window.addEventListener('click', onClickAway)
    window.addEventListener('contextmenu', onClickAway)
    return () => {
      ctr.removeEventListener('contextmenu', onContext)
      window.removeEventListener('click', onClickAway)
      window.removeEventListener('contextmenu', onClickAway)
    }
  }, [containerRef, selectedEls, setSelectedEl, setMode])

  if (!menu) return null

  const el = menu.el!
  const isLocked = el.getAttribute('data-locked') === '1'
  const isHidden = el.getAttribute('visibility') === 'hidden'

  const action = (fn: () => void) => { fn(); setMenu(null) }

  const flipH = () => {
    const svg = editorRef.getSvg(); const vb = editorRef.vbRef.current
    if (!svg || !vb) return
    const box = getElSvgBBox(el, svg, vb)
    const cx = box.x + box.w / 2, cy = box.y + box.h / 2
    editorRef.pushUndoAttrs(el, [['transform', el.getAttribute('transform')]])
    const old = el.getAttribute('transform') ?? ''
    el.setAttribute('transform', `translate(${cx},${cy}) scale(-1,1) translate(${-cx},${-cy}) ${old}`.trim())
  }

  const flipV = () => {
    const svg = editorRef.getSvg(); const vb = editorRef.vbRef.current
    if (!svg || !vb) return
    const box = getElSvgBBox(el, svg, vb)
    const cx = box.x + box.w / 2, cy = box.y + box.h / 2
    editorRef.pushUndoAttrs(el, [['transform', el.getAttribute('transform')]])
    const old = el.getAttribute('transform') ?? ''
    el.setAttribute('transform', `translate(${cx},${cy}) scale(1,-1) translate(${-cx},${-cy}) ${old}`.trim())
  }

  const items = [
    { icon: <Copy size={12} />, label: 'Duplicar', kbd: 'Ctrl+D', fn: () => { const c = editorRef.duplicate(el); if (c) setSelectedEl(c) } },
    { icon: <Trash2 size={12} />, label: 'Excluir', kbd: 'Del', fn: () => { editorRef.deleteSelected(el); setSelectedEls([]) }, danger: true },
    null, // separator
    { icon: <ChevronsUp size={12} />, label: 'Trazer para frente', fn: () => editorRef.bringToFront(el) },
    { icon: <ChevronsDown size={12} />, label: 'Enviar para trás', fn: () => editorRef.sendToBack(el) },
    null,
    { icon: <FlipHorizontal2 size={12} />, label: 'Espelhar H', fn: flipH },
    { icon: <FlipVertical2 size={12} />, label: 'Espelhar V', fn: flipV },
    null,
    { icon: isLocked ? <Unlock size={12} /> : <Lock size={12} />, label: isLocked ? 'Desbloquear' : 'Bloquear',
      fn: () => { isLocked ? el.removeAttribute('data-locked') : el.setAttribute('data-locked', '1') } },
    { icon: isHidden ? <Eye size={12} /> : <EyeOff size={12} />, label: isHidden ? 'Mostrar' : 'Ocultar',
      fn: () => { isHidden ? el.removeAttribute('visibility') : el.setAttribute('visibility', 'hidden') } },
  ]

  return (
    <div ref={ref}
      className="absolute z-[9999] bg-white rounded-xl shadow-2xl border border-gray-200 py-1.5 min-w-[180px] animate-in"
      style={{ left: menu.x, top: menu.y }}
    >
      {items.map((item, i) =>
        item === null ? (
          <div key={`sep-${i}`} className="h-px bg-gray-100 my-1" />
        ) : (
          <button key={item.label}
            onClick={e => { e.stopPropagation(); action(item.fn) }}
            className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-gray-50 transition-colors ${
              (item as any).danger ? 'text-red-500 hover:bg-red-50' : 'text-gray-700'
            }`}
          >
            {item.icon}
            <span className="flex-1 text-left">{item.label}</span>
            {item.kbd && <span className="text-[0.6rem] text-gray-400">{item.kbd}</span>}
          </button>
        )
      )}
    </div>
  )
}
