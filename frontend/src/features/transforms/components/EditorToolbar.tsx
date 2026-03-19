import { useState } from 'react'
import { Button } from '@/shared/components/ui/Button'
import type { useEditor } from '@/features/editor/hooks/useEditor'

interface EditorToolbarProps {
  editorRef: ReturnType<typeof useEditor>
  tpOn: boolean
  hlOn: boolean
  onToggleHL: () => void
  onToggleTP: () => void
  onClearColors: () => void
}

export function EditorToolbar({
  editorRef, tpOn, hlOn, onToggleHL, onToggleTP, onClearColors,
}: EditorToolbarProps) {
  const [dlOpen, setDlOpen] = useState(false)
  const { getSvg, resetZoom, origVbRef, vbRef } = editorRef

  const dlSvg = () => {
    const el = getSvg()
    if (!el) return
    const blob = new Blob([new XMLSerializer().serializeToString(el)], { type: 'image/svg+xml' })
    Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'colorido.svg' }).click()
  }

  const dlPng = async (transparent: boolean) => {
    const el = getSvg(), origVb = origVbRef.current, curVb = vbRef.current
    if (!el || !origVb || !curVb) return
    el.setAttribute('viewBox', `${origVb.x} ${origVb.y} ${origVb.w} ${origVb.h}`)
    const restored: Array<{ el: Element; f: string }> = []
    if (transparent) {
      el.querySelectorAll('[data-region]').forEach(p => {
        const f = p.getAttribute('fill')
        if (!f || f === '#FFFFFF' || f === '#ffffff') { restored.push({ el: p, f: f ?? '#FFFFFF' }); p.setAttribute('fill', 'none') }
      })
    }
    const data = new XMLSerializer().serializeToString(el)
    restored.forEach(({ el: p, f }) => p.setAttribute('fill', f))
    el.setAttribute('viewBox', `${curVb.x} ${curVb.y} ${curVb.w} ${curVb.h}`)
    const url = URL.createObjectURL(new Blob([data], { type: 'image/svg+xml;charset=utf-8' }))
    await new Promise<void>((res, rej) => {
      const img = new Image()
      img.onload = () => {
        const cv = document.createElement('canvas')
        cv.width = origVb.w; cv.height = origVb.h
        const ctx = cv.getContext('2d')!
        if (!transparent) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height) }
        ctx.drawImage(img, 0, 0); URL.revokeObjectURL(url)
        Object.assign(document.createElement('a'), {
          href: cv.toDataURL('image/png'),
          download: transparent ? 'linhas_transparente.png' : 'colorido.png',
        }).click()
        res()
      }
      img.onerror = rej; img.src = url
    })
  }

  return (
    <div className="space-y-1.5">
      <div className="flex gap-1.5 flex-wrap items-center px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl">
        <Button variant="outline" size="sm" active={hlOn} onClick={onToggleHL}>◆ Highlight</Button>
        <Button variant="outline" size="sm" active={tpOn} onClick={onToggleTP}>□ Transparente</Button>
        <div className="w-px h-5 bg-gray-200 mx-0.5" />
        <Button variant="outline" size="sm" onClick={onClearColors}>✕ Limpar cores</Button>
        <Button variant="outline" size="sm" onClick={resetZoom}>↺ Reset zoom</Button>
        <div className="w-px h-5 bg-gray-200 mx-0.5" />
        <Button variant="outline" size="sm" active={dlOpen} onClick={() => setDlOpen(o => !o)}>⬇ Exportar</Button>
      </div>

      {dlOpen && (
        <div className="flex gap-1.5 items-center px-3 py-2 bg-blue-50 border border-blue-200 rounded-xl">
          <span className="text-[0.65rem] text-blue-400 font-bold uppercase tracking-widest mr-1">Exportar</span>
          <Button variant="outline" size="sm" onClick={dlSvg}>⬇ SVG</Button>
          <Button variant="outline" size="sm" onClick={() => dlPng(false)}>⬇ PNG</Button>
          <Button variant="outline" size="sm" onClick={() => dlPng(true)}>⬇ PNG transparente</Button>
        </div>
      )}
    </div>
  )
}
