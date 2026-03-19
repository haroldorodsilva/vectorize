import { useState, useEffect, useCallback } from 'react'
import { cn } from '@/shared/lib/utils'
import { usePaletteStore, COLORS } from '@/features/palette/store'
import { ControlsForm } from '@/features/vectorize/components/ControlsForm'
import type { useEditor } from '@/features/editor/hooks/useEditor'
import type { VectorizeResponse } from '@/shared/types'
import type { ControlsValues } from '@/features/vectorize/schemas'
import {
  ChevronsUp, ChevronUp, ChevronDown, ChevronsDown,
  Copy, Ungroup, Eye, EyeOff, Trash2, Download,
  Highlighter, Square, X, Eraser,
  AlignHorizontalJustifyCenter, Type,
  AlignStartVertical, AlignEndVertical, AlignCenterVertical,
  AlignStartHorizontal, AlignEndHorizontal, AlignCenterHorizontal,
  AlignHorizontalSpaceBetween, AlignVerticalSpaceBetween,
  Grid3x3, Merge, Minus, CircleDot, Slice,
} from 'lucide-react'
import {
  alignLeft, alignRight, alignTop, alignBottom,
  alignCenterH, alignCenterV, distributeH, distributeV,
} from '../lib/alignment'
import { IconBrowser } from '@/features/icons/components/IconBrowser'
import { LayersPanel } from './LayersPanel'
import { ComponentsPanel } from './ComponentsPanel'
import { ColorPaletteManager } from './ColorPaletteManager'
import { GradientPicker } from './GradientPicker'
import { EffectsPanel } from './EffectsPanel'
import { StrokePanel } from './StrokePanel'
import { TypographyPanel } from './TypographyPanel'
import { TransformPanel } from './TransformPanel'

interface RightPanelProps {
  editorRef: ReturnType<typeof useEditor>
  svgData: VectorizeResponse | null
  fileLoaded: boolean
  disabled: boolean
  loading: boolean
  onSubmit: (v: ControlsValues) => void
  hlOn: boolean
  tpOn: boolean
  onToggleHL: () => void
  onToggleTP: () => void
  canVectorize?: boolean
}

// ── Shared tooltip wrapper ────────────────────────────────────────────────────
function Tooltip({ label, children, className }: {
  label: string; children: React.ReactNode; className?: string
}) {
  return (
    <div className={cn('relative group', className)}>
      {children}
      <div className="
        pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5
        bg-gray-900 text-white text-[0.65rem] rounded-md px-2 py-1 whitespace-nowrap
        opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-[200] shadow-md
      ">
        {label}
        <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
      </div>
    </div>
  )
}

// ── Collapsible section ───────────────────────────────────────────────────────
function Section({ title, children, defaultOpen = true }: {
  title: string; children: React.ReactNode; defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border-b border-gray-100">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 text-[0.65rem] font-bold text-gray-400 uppercase tracking-widest hover:bg-gray-50 transition-colors"
      >
        {title}
        <ChevronDown size={10} className={cn('text-gray-300 transition-transform', open && 'rotate-180')} />
      </button>
      {open && <div className="px-3 pb-3">{children}</div>}
    </div>
  )
}

function elLabel(el: Element, i: number): string {
  const tag = el.tagName.toLowerCase()
  if (tag === 'text') return el.textContent?.trim().slice(0, 20) || `Texto ${i + 1}`
  if (tag === 'rect') return `Retângulo ${i + 1}`
  if (tag === 'ellipse' || tag === 'circle') return `Elipse ${i + 1}`
  if (tag === 'line') return `Linha ${i + 1}`
  if (tag === 'g') return `Grupo ${i + 1}`
  return `Caminho ${i + 1}`
}

export function RightPanel({
  editorRef, svgData, fileLoaded, disabled, loading, onSubmit,
  hlOn, tpOn, onToggleHL, onToggleTP, canVectorize = true,
}: RightPanelProps) {
  const { selectedColor, mode, selectedEl, selectedEls, setColor, setMode, setSelectedEl, setSelectedEls, gridEnabled, gridSize, setGridEnabled, setGridSize } = usePaletteStore()
  const [elements, setElements]   = useState<Element[]>([])
  const [hidden, setHidden]       = useState<Set<number>>(new Set())
  const [checked, setChecked]     = useState<Set<number>>(new Set())
  const [resW, setResW]           = useState('')
  const [resH, setResH]           = useState('')
  const [locked, setLocked]       = useState(true)
  const [bgColor, setBgColor]     = useState('none')

  const [opacity, setOpacity] = useState(1)

  useEffect(() => {
    if (selectedEl) {
      setOpacity(parseFloat(selectedEl.getAttribute('opacity') ?? '1'))
    }
  }, [selectedEl])

  const refreshElements = useCallback(() => {
    requestAnimationFrame(() => {
      const svg = editorRef.getSvg()
      setElements(Array.from(svg?.querySelectorAll('[data-region]') ?? []))
      setHidden(new Set()); setChecked(new Set())
      setBgColor(editorRef.getBackground())
    })
  }, [editorRef])

  useEffect(() => { if (svgData) refreshElements() }, [svgData, refreshElements])

  // ── Download helpers ──────────────────────────────────────────────────────
  const dlSvg = () => {
    const el = editorRef.getSvg(); if (!el) return
    const clone = el.cloneNode(true) as SVGSVGElement
    clone.querySelector('[data-sel]')?.removeAttribute('data-sel')
    const blob = new Blob([new XMLSerializer().serializeToString(clone)], { type: 'image/svg+xml' })
    Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'vetorizado.svg' }).click()
  }
  const dlPng = async (transparent: boolean) => {
    const el = editorRef.getSvg(), origVb = editorRef.origVbRef.current, curVb = editorRef.vbRef.current
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
        const cv = document.createElement('canvas'); cv.width = origVb.w; cv.height = origVb.h
        const ctx = cv.getContext('2d')!
        if (!transparent) { ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height) }
        ctx.drawImage(img, 0, 0); URL.revokeObjectURL(url)
        Object.assign(document.createElement('a'), { href: cv.toDataURL('image/png'), download: transparent ? 'transparente.png' : 'vetorizado.png' }).click()
        res()
      }
      img.onerror = rej; img.src = url
    })
  }

  // ── Resize helpers ────────────────────────────────────────────────────────
  const onResWChange = (v: string) => {
    setResW(v); if (!locked) return
    const el = editorRef.getSvg(), origVb = editorRef.origVbRef.current; if (!el || !origVb) return
    const ratio = (parseFloat(el.getAttribute('height') ?? '') || origVb.h) / (parseFloat(el.getAttribute('width') ?? '') || origVb.w)
    setResH(v ? String(Math.round(parseInt(v) * ratio)) : '')
  }
  const onResHChange = (v: string) => {
    setResH(v); if (!locked) return
    const el = editorRef.getSvg(), origVb = editorRef.origVbRef.current; if (!el || !origVb) return
    const ratio = (parseFloat(el.getAttribute('width') ?? '') || origVb.w) / (parseFloat(el.getAttribute('height') ?? '') || origVb.h)
    setResW(v ? String(Math.round(parseInt(v) * ratio)) : '')
  }
  const applyResize = () => {
    const w = parseInt(resW), h = parseInt(resH)
    if (!w || !h || w < 1 || h < 1) { alert('Tamanho inválido.'); return }
    editorRef.applyResize(w, h)
  }

  // ── Visibility ────────────────────────────────────────────────────────────
  const toggleVisibility = (i: number, el: Element) => {
    const next = new Set(hidden)
    if (hidden.has(i)) { next.delete(i); el.removeAttribute('visibility') }
    else               { next.add(i);    el.setAttribute('visibility', 'hidden') }
    setHidden(next)
  }
  const deleteEl = (el: Element) => {
    editorRef.deleteSelected(el); refreshElements()
    if (selectedEls.includes(el)) setSelectedEls(selectedEls.filter(e => e !== el))
  }

  // ── Multi-select ──────────────────────────────────────────────────────────
  const toggleCheck = (i: number) => { const n = new Set(checked); n.has(i) ? n.delete(i) : n.add(i); setChecked(n) }
  const checkedEls = Array.from(checked).map(i => elements[i]).filter(Boolean)

  const doGroup = () => {
    if (checkedEls.length < 2) return
    const g = editorRef.groupElements(checkedEls)
    if (g) { refreshElements(); setSelectedEl(g); setMode('select') }
  }
  const doCombine = () => {
    const paths = checkedEls.filter(e => e.tagName === 'path')
    if (paths.length < 2) { alert('Selecione pelo menos 2 paths para combinar.'); return }
    const p = editorRef.combinePaths(paths)
    if (p) { refreshElements(); setSelectedEl(p); setMode('select') }
  }
  const doUngroup = () => {
    if (!selectedEl || selectedEl.tagName !== 'g') return
    const children = editorRef.ungroupElement(selectedEl)
    setSelectedEl(null); refreshElements()
    if (children.length) { setSelectedEl(children[children.length - 1]); setMode('select') }
  }

  const selFill = selectedEl?.getAttribute('fill') ?? null
  const isGroup = selectedEl?.tagName === 'g'
  const isText  = selectedEl?.tagName === 'text'

  return (
    <div className="w-72 bg-white border-l border-gray-200 flex flex-col overflow-y-auto shrink-0 shadow-sm">

      {/* Configurações — only for raster files */}
      {canVectorize && (
        <Section title="Configurações">
          <ControlsForm disabled={disabled} loading={loading} onSubmit={onSubmit} />
        </Section>
      )}

      {svgData && (
        <>
          {/* Canvas */}
          <Section title="Canvas" defaultOpen={false}>
            <div className="flex items-center gap-2 mb-1">
              <label className="text-xs text-gray-500 shrink-0 w-14">Fundo</label>
              <input
                type="color"
                value={bgColor === 'none' ? '#ffffff' : bgColor}
                onChange={e => { setBgColor(e.target.value); editorRef.setBackground(e.target.value) }}
                className="w-7 h-7 rounded border border-gray-200 cursor-pointer"
              />
              <button
                onClick={() => { setBgColor('none'); editorRef.setBackground('none') }}
                className="text-xs px-2 py-1 rounded border border-gray-200 hover:bg-gray-50"
              >Sem fundo</button>
            </div>
            {/* Background pattern presets */}
            <div className="flex gap-1 mt-1.5">
              {[
                { label: 'Branco', bg: '#ffffff' },
                { label: 'Preto', bg: '#000000' },
                { label: 'Cinza', bg: '#f0f0f0' },
                { label: 'Bege', bg: '#faf0e6' },
                { label: 'Azul', bg: '#e8f4fd' },
              ].map(p => (
                <button key={p.label}
                  onClick={() => { setBgColor(p.bg); editorRef.setBackground(p.bg) }}
                  className="w-5 h-5 rounded border border-gray-200 cursor-pointer hover:scale-110 transition-transform"
                  style={{ background: p.bg }}
                  title={p.label}
                />
              ))}
            </div>
          </Section>

          {/* Seleção */}
          {selectedEl && (
            <Section title="Posição" defaultOpen>
              <TransformPanel el={selectedEl} editorRef={editorRef} />
              <button onClick={() => editorRef.zoomToElements(selectedEls)}
                className="w-full mt-1.5 text-[0.65rem] py-1 border border-blue-200 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg font-medium transition-colors">
                Zoom na seleção
              </button>
            </Section>
          )}

          {selectedEl && (
            <Section title="Aparência" defaultOpen>
              <div className="space-y-2">
                {/* Fill (solid / linear gradient / radial gradient) */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs text-gray-500 font-medium">Preenchimento</label>
                    <Tooltip label="Excluir elemento">
                      <button onClick={() => deleteEl(selectedEl)}
                        className="text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors">
                        <Trash2 size={12} />
                      </button>
                    </Tooltip>
                  </div>
                  <GradientPicker el={selectedEl} editorRef={editorRef} />
                </div>

                {/* Opacity */}
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-500 w-10 shrink-0">Opac.</label>
                  <input
                    type="range" min={0} max={1} step={0.01}
                    value={opacity}
                    onChange={e => {
                      const v = parseFloat(e.target.value)
                      setOpacity(v)
                      selectedEl.setAttribute('opacity', String(v))
                    }}
                    className="flex-1 h-1.5 accent-blue-600"
                  />
                  <span className="text-xs text-gray-400 w-8 text-right">{Math.round(opacity * 100)}%</span>
                </div>

                {/* Stroke panel */}
                <StrokePanel el={selectedEl} editorRef={editorRef} />

                {/* Rotation */}
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-500 w-10 shrink-0">Girar</label>
                  <input
                    type="range" min={-180} max={180} step={1}
                    defaultValue={0}
                    key={selectedEl?.getAttribute('data-region') ?? ''}
                    onChange={e => {
                      const deg = parseInt(e.target.value)
                      const el = selectedEl
                      if (!el) return
                      // Get element center via bounding box
                      const svg = editorRef.getSvg()
                      const vb = editorRef.vbRef.current
                      if (!svg || !vb) return
                      const svgR = svg.getBoundingClientRect()
                      const er = el.getBoundingClientRect()
                      const cx = vb.x + (er.left + er.width / 2 - svgR.left) / svgR.width * vb.w
                      const cy = vb.y + (er.top + er.height / 2 - svgR.top) / svgR.height * vb.h
                      // Remove old rotation, compose new
                      const base = el.getAttribute('data-base-transform') ?? el.getAttribute('transform') ?? ''
                      if (!el.getAttribute('data-base-transform')) el.setAttribute('data-base-transform', base)
                      const tf = deg !== 0
                        ? `rotate(${deg}, ${cx.toFixed(1)}, ${cy.toFixed(1)}) ${base}`.trim()
                        : base
                      el.setAttribute('transform', tf || '')
                    }}
                    className="flex-1 h-1.5 accent-blue-600"
                  />
                  <span className="text-[0.6rem] text-gray-400 w-8 text-right">°</span>
                </div>

                {/* Typography panel (text elements) */}
                {isText && (
                  <div className="pt-1 border-t border-gray-100">
                    <TypographyPanel el={selectedEl} editorRef={editorRef} />
                  </div>
                )}

                {/* Effects */}
                <div className="pt-1 border-t border-gray-100">
                  <EffectsPanel el={selectedEl} editorRef={editorRef} />
                </div>

                {/* Ordering + actions */}
                <div className="flex gap-1 pt-1">
                  <Tooltip label="Trazer para frente">
                    <button onClick={() => { editorRef.bringToFront(selectedEl); refreshElements() }}
                      className="p-1.5 rounded border border-gray-200 hover:bg-gray-50 transition-colors">
                      <ChevronsUp size={13} />
                    </button>
                  </Tooltip>
                  <Tooltip label="Avançar">
                    <button onClick={() => { editorRef.bringForward(selectedEl); refreshElements() }}
                      className="p-1.5 rounded border border-gray-200 hover:bg-gray-50 transition-colors">
                      <ChevronUp size={13} />
                    </button>
                  </Tooltip>
                  <Tooltip label="Recuar">
                    <button onClick={() => { editorRef.sendBack(selectedEl); refreshElements() }}
                      className="p-1.5 rounded border border-gray-200 hover:bg-gray-50 transition-colors">
                      <ChevronDown size={13} />
                    </button>
                  </Tooltip>
                  <Tooltip label="Enviar para trás">
                    <button onClick={() => { editorRef.sendToBack(selectedEl); refreshElements() }}
                      className="p-1.5 rounded border border-gray-200 hover:bg-gray-50 transition-colors">
                      <ChevronsDown size={13} />
                    </button>
                  </Tooltip>
                  <Tooltip label="Duplicar">
                    <button onClick={() => {
                      const clone = editorRef.duplicate(selectedEl)
                      refreshElements(); setSelectedEl(clone); setMode('select')
                    }} className="p-1.5 rounded border border-gray-200 hover:bg-gray-50 transition-colors">
                      <Copy size={13} />
                    </button>
                  </Tooltip>
                  {isGroup && (
                    <Tooltip label="Desagrupar">
                      <button onClick={doUngroup}
                        className="p-1.5 rounded border border-orange-200 text-orange-600 hover:bg-orange-50 transition-colors">
                        <Ungroup size={13} />
                      </button>
                    </Tooltip>
                  )}
                </div>

                <p className="text-[0.6rem] text-gray-400">
                  Arraste para mover · arraste handles para redimensionar · Del para excluir
                </p>
              </div>
            </Section>
          )}

          {/* Booleanas + Alinhamento — visible when 2+ elements selected */}
          {selectedEls.length >= 2 && (
            <Section title="Booleanas" defaultOpen>
              <div className="flex gap-1 flex-wrap">
                <Tooltip label="Unir (union)">
                  <button onClick={async () => { const r = await editorRef.booleanOp(selectedEls, 'unite'); if (r) { setSelectedEl(r); refreshElements() } }}
                    className="p-1.5 rounded border border-gray-200 hover:bg-gray-50 transition-colors text-xs font-medium flex items-center gap-1">
                    <Merge size={13} /> Unir
                  </button>
                </Tooltip>
                <Tooltip label="Subtrair">
                  <button onClick={async () => { const r = await editorRef.booleanOp(selectedEls, 'subtract'); if (r) { setSelectedEl(r); refreshElements() } }}
                    className="p-1.5 rounded border border-gray-200 hover:bg-gray-50 transition-colors text-xs font-medium flex items-center gap-1">
                    <Minus size={13} /> Subtrair
                  </button>
                </Tooltip>
                <Tooltip label="Interseção">
                  <button onClick={async () => { const r = await editorRef.booleanOp(selectedEls, 'intersect'); if (r) { setSelectedEl(r); refreshElements() } }}
                    className="p-1.5 rounded border border-gray-200 hover:bg-gray-50 transition-colors text-xs font-medium flex items-center gap-1">
                    <CircleDot size={13} /> Interseção
                  </button>
                </Tooltip>
                <Tooltip label="Excluir">
                  <button onClick={async () => { const r = await editorRef.booleanOp(selectedEls, 'exclude'); if (r) { setSelectedEl(r); refreshElements() } }}
                    className="p-1.5 rounded border border-gray-200 hover:bg-gray-50 transition-colors text-xs font-medium flex items-center gap-1">
                    <Slice size={13} /> Excluir
                  </button>
                </Tooltip>
                {selectedEls.length === 2 && (
                  <Tooltip label="Máscara de recorte (1° = conteúdo, 2° = máscara)">
                    <button onClick={async () => {
                      const { applyClipMask } = await import('../lib/clipMask')
                      const svg = editorRef.getSvg()
                      if (!svg) return
                      applyClipMask(selectedEls[0], selectedEls[1], svg)
                      setSelectedEl(selectedEls[0]); refreshElements()
                    }}
                      className="p-1.5 rounded border border-gray-200 hover:bg-gray-50 transition-colors text-xs font-medium flex items-center gap-1">
                      Clip Mask
                    </button>
                  </Tooltip>
                )}
              </div>
              {/* Path simplify */}
              {selectedEls.some(e => e.tagName === 'path') && (
                <button onClick={async () => {
                  const { simplifyPathElement } = await import('../lib/pathSimplify')
                  let total = 0
                  for (const el of selectedEls) {
                    if (el.tagName === 'path') {
                      editorRef.pushUndoAttrs(el, [['d', el.getAttribute('d')]])
                      total += simplifyPathElement(el, 2)
                    }
                  }
                  if (total > 0) alert(`${total} nós removidos`)
                  else alert('Path já simplificado')
                }}
                  className="w-full mt-1 text-[0.65rem] py-1 border border-gray-200 text-gray-600 hover:bg-gray-50 rounded-lg font-medium transition-colors">
                  Simplificar paths ({selectedEls.filter(e => e.tagName === 'path').length})
                </button>
              )}
            </Section>
          )}

          {selectedEls.length >= 2 && (
            <Section title="Alinhamento" defaultOpen>
              <div className="space-y-2">
                <div className="flex gap-1 flex-wrap">
                  <Tooltip label="Alinhar à esquerda">
                    <button onClick={() => { const svg = editorRef.getSvg(); const vb = editorRef.vbRef.current; if (svg && vb) alignLeft(selectedEls, svg, vb) }}
                      className="p-1.5 rounded border border-gray-200 hover:bg-gray-50 transition-colors">
                      <AlignStartVertical size={13} />
                    </button>
                  </Tooltip>
                  <Tooltip label="Centro horizontal">
                    <button onClick={() => { const svg = editorRef.getSvg(); const vb = editorRef.vbRef.current; if (svg && vb) alignCenterH(selectedEls, svg, vb) }}
                      className="p-1.5 rounded border border-gray-200 hover:bg-gray-50 transition-colors">
                      <AlignCenterVertical size={13} />
                    </button>
                  </Tooltip>
                  <Tooltip label="Alinhar à direita">
                    <button onClick={() => { const svg = editorRef.getSvg(); const vb = editorRef.vbRef.current; if (svg && vb) alignRight(selectedEls, svg, vb) }}
                      className="p-1.5 rounded border border-gray-200 hover:bg-gray-50 transition-colors">
                      <AlignEndVertical size={13} />
                    </button>
                  </Tooltip>
                  <Tooltip label="Alinhar ao topo">
                    <button onClick={() => { const svg = editorRef.getSvg(); const vb = editorRef.vbRef.current; if (svg && vb) alignTop(selectedEls, svg, vb) }}
                      className="p-1.5 rounded border border-gray-200 hover:bg-gray-50 transition-colors">
                      <AlignStartHorizontal size={13} />
                    </button>
                  </Tooltip>
                  <Tooltip label="Centro vertical">
                    <button onClick={() => { const svg = editorRef.getSvg(); const vb = editorRef.vbRef.current; if (svg && vb) alignCenterV(selectedEls, svg, vb) }}
                      className="p-1.5 rounded border border-gray-200 hover:bg-gray-50 transition-colors">
                      <AlignCenterHorizontal size={13} />
                    </button>
                  </Tooltip>
                  <Tooltip label="Alinhar ao rodapé">
                    <button onClick={() => { const svg = editorRef.getSvg(); const vb = editorRef.vbRef.current; if (svg && vb) alignBottom(selectedEls, svg, vb) }}
                      className="p-1.5 rounded border border-gray-200 hover:bg-gray-50 transition-colors">
                      <AlignEndHorizontal size={13} />
                    </button>
                  </Tooltip>
                </div>
                {selectedEls.length >= 3 && (
                  <div className="flex gap-1">
                    <Tooltip label="Distribuir horizontalmente">
                      <button onClick={() => { const svg = editorRef.getSvg(); const vb = editorRef.vbRef.current; if (svg && vb) distributeH(selectedEls, svg, vb) }}
                        className="p-1.5 rounded border border-gray-200 hover:bg-gray-50 transition-colors">
                        <AlignHorizontalSpaceBetween size={13} />
                      </button>
                    </Tooltip>
                    <Tooltip label="Distribuir verticalmente">
                      <button onClick={() => { const svg = editorRef.getSvg(); const vb = editorRef.vbRef.current; if (svg && vb) distributeV(selectedEls, svg, vb) }}
                        className="p-1.5 rounded border border-gray-200 hover:bg-gray-50 transition-colors">
                        <AlignVerticalSpaceBetween size={13} />
                      </button>
                    </Tooltip>
                  </div>
                )}
              </div>
            </Section>
          )}

          {/* Cores */}
          <Section title="Cores">
            <ColorPaletteManager />
            <div className="flex gap-1.5 flex-wrap mt-2">
              <Tooltip label="Borracha">
                <button
                  onClick={() => setMode(mode === 'erase' ? 'paint' : 'erase')}
                  className={cn('p-1.5 rounded-lg border transition-colors',
                    mode === 'erase' ? 'bg-gray-200 border-gray-400' : 'bg-white border-gray-200 hover:bg-gray-50')}
                >
                  <Eraser size={14} />
                </button>
              </Tooltip>
              <Tooltip label={hlOn ? 'Destaque ativo' : 'Ativar destaque'}>
                <button onClick={onToggleHL} className={cn('p-1.5 rounded-lg border transition-colors',
                  hlOn ? 'bg-blue-50 border-blue-400 text-blue-600' : 'bg-white border-gray-200 hover:bg-gray-50')}>
                  <Highlighter size={14} />
                </button>
              </Tooltip>
              <Tooltip label={tpOn ? 'Transparência ativa' : 'Transparência brancos'}>
                <button onClick={onToggleTP} className={cn('p-1.5 rounded-lg border transition-colors',
                  tpOn ? 'bg-blue-50 border-blue-400 text-blue-600' : 'bg-white border-gray-200 hover:bg-gray-50')}>
                  <Square size={14} />
                </button>
              </Tooltip>
              <Tooltip label="Limpar cores">
                <button onClick={() => editorRef.clearColors()}
                  className="p-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors">
                  <X size={14} />
                </button>
              </Tooltip>
            </div>
          </Section>

          {/* Transformar */}
          <Section title="Transformar" defaultOpen={false}>
            <div className="flex items-center gap-1.5 mb-2 flex-wrap">
              <input id="resW" type="number" min={1} max={8000} placeholder="W"
                value={resW} onChange={e => onResWChange(e.target.value)}
                className="w-16 text-center text-xs border border-gray-300 rounded-md px-1.5 py-1 bg-white" />
              <span className="text-xs text-gray-400">×</span>
              <input id="resH" type="number" min={1} max={8000} placeholder="H"
                value={resH} onChange={e => onResHChange(e.target.value)}
                className="w-16 text-center text-xs border border-gray-300 rounded-md px-1.5 py-1 bg-white" />
              <Tooltip label={locked ? 'Proporção travada' : 'Proporção livre'}>
                <button onClick={() => setLocked(l => !l)}
                  className={cn('px-1.5 py-1 border rounded-md text-xs transition-colors',
                    locked ? 'bg-blue-100 border-blue-400' : 'bg-white border-gray-300')}>
                  {locked ? '🔒' : '🔓'}
                </button>
              </Tooltip>
              <button onClick={applyResize}
                className="text-xs px-2 py-1 rounded-lg border border-gray-200 bg-white hover:bg-gray-50">Aplicar</button>
            </div>
            <button onClick={() => { editorRef.resetTransforms(); editorRef.syncResInputs(); setResW(''); setResH('') }}
              className="flex items-center gap-1.5 text-xs px-2 py-1 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 transition-colors">
              <AlignHorizontalJustifyCenter size={12} />
              Reset transformações
            </button>
          </Section>

          {/* Exportar */}
          <Section title="Exportar" defaultOpen={false}>
            <div className="space-y-2">
              <div className="flex gap-1.5 flex-wrap">
                <button onClick={dlSvg}
                  className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 font-medium">
                  <Download size={12} /> SVG
                </button>
                <button onClick={async () => {
                  const { optimizeSvg, downloadBlob } = await import('../lib/exportUtils')
                  const el = editorRef.getSvg(); if (!el) return
                  const clone = el.cloneNode(true) as SVGSVGElement
                  clone.querySelector('[data-sel]')?.removeAttribute('data-sel')
                  const opt = await optimizeSvg(new XMLSerializer().serializeToString(clone))
                  downloadBlob(new Blob([opt], { type: 'image/svg+xml' }), 'otimizado.svg')
                }}
                  className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 font-medium text-blue-700">
                  <Download size={12} /> SVG otim.
                </button>
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {[1, 2, 3, 4].map(s => (
                  <button key={s} onClick={async () => {
                    const { exportPng, downloadBlob } = await import('../lib/exportUtils')
                    const el = editorRef.getSvg(), origVb = editorRef.origVbRef.current, curVb = editorRef.vbRef.current
                    if (!el || !origVb || !curVb) return
                    const blob = await exportPng(el, origVb, curVb, s, false)
                    downloadBlob(blob, `vetorizado-${s}x.png`)
                  }}
                    className="flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 font-medium">
                    <Download size={10} /> PNG {s}x
                  </button>
                ))}
              </div>
              <div className="flex gap-1.5 flex-wrap">
                <button onClick={() => dlPng(true)}
                  className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 font-medium">
                  <Download size={12} /> PNG transp.
                </button>
                <button onClick={async () => {
                  const { exportPdf, downloadBlob } = await import('../lib/exportUtils')
                  const el = editorRef.getSvg(), origVb = editorRef.origVbRef.current, curVb = editorRef.vbRef.current
                  if (!el || !origVb || !curVb) return
                  const blob = await exportPdf(el, origVb, curVb)
                  downloadBlob(blob, 'vetorizado.pdf')
                }}
                  className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 font-medium">
                  <Download size={12} /> PDF
                </button>
                <button onClick={async () => {
                  const { copySvgToClipboard } = await import('../lib/exportUtils')
                  const el = editorRef.getSvg(); if (!el) return
                  await copySvgToClipboard(el, true)
                  alert('SVG copiado para a área de transferência!')
                }}
                  className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 font-medium">
                  📋 Copiar SVG
                </button>
                {selectedEls.length > 0 && (
                  <button onClick={async () => {
                    const { exportSelectedSvg, downloadBlob } = await import('../lib/exportUtils')
                    const el = editorRef.getSvg(); const vb = editorRef.vbRef.current
                    if (!el || !vb) return
                    const svgStr = exportSelectedSvg(selectedEls, el, vb)
                    downloadBlob(new Blob([svgStr], { type: 'image/svg+xml' }), 'selecao.svg')
                  }}
                    className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-green-200 bg-green-50 hover:bg-green-100 font-medium text-green-700">
                    <Download size={12} /> Exportar seleção
                  </button>
                )}
              </div>
            </div>
          </Section>

          {/* Componentes */}
          <Section title="Componentes" defaultOpen={false}>
            <ComponentsPanel editorRef={editorRef} />
          </Section>

          {/* Ícones */}
          <Section title="Ícones" defaultOpen={false}>
            <IconBrowser editorRef={editorRef} />
          </Section>

          {/* Camadas (drag to reorder) */}
          <Section title={`Camadas (${elements.length})`} defaultOpen={false}>
            {checked.size > 0 && (
              <div className="flex gap-1 mb-2 flex-wrap items-center">
                <span className="text-[0.65rem] text-gray-400">{checked.size} selecionados:</span>
                {checked.size >= 2 && (
                  <button onClick={doGroup}
                    className="text-xs px-2 py-0.5 rounded border border-blue-300 text-blue-700 hover:bg-blue-50">
                    Agrupar
                  </button>
                )}
                {checkedEls.filter(e => e.tagName === 'path').length >= 2 && (
                  <button onClick={doCombine}
                    className="text-xs px-2 py-0.5 rounded border border-purple-300 text-purple-700 hover:bg-purple-50">
                    Combinar paths
                  </button>
                )}
                <button onClick={() => setChecked(new Set())}
                  className="ml-auto p-0.5 rounded hover:bg-gray-100">
                  <X size={11} className="text-gray-400" />
                </button>
              </div>
            )}
            <LayersPanel elements={elements} editorRef={editorRef} onRefresh={refreshElements} />
          </Section>
        </>
      )}

      {/* Status */}
      {svgData && (
        <div className="mt-auto border-t border-gray-100 px-3 py-2 shrink-0">
          <p className="text-[0.6rem] text-gray-400">
            {elements.length} formas · {svgData.width}×{svgData.height}px · {svgData.processing_time_ms}ms
          </p>
        </div>
      )}
    </div>
  )
}
