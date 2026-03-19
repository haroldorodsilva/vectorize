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
} from 'lucide-react'

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
  const { selectedColor, mode, selectedEl, setColor, setMode, setSelectedEl } = usePaletteStore()
  const [elements, setElements]   = useState<Element[]>([])
  const [hidden, setHidden]       = useState<Set<number>>(new Set())
  const [checked, setChecked]     = useState<Set<number>>(new Set())
  const [resW, setResW]           = useState('')
  const [resH, setResH]           = useState('')
  const [locked, setLocked]       = useState(true)
  const [bgColor, setBgColor]     = useState('none')

  // Controlled stroke state — updates when selectedEl changes
  const [strokeColor, setStrokeColor] = useState('#000000')
  const [strokeWidth, setStrokeWidth] = useState(0)
  const [opacity, setOpacity]         = useState(1)

  useEffect(() => {
    if (selectedEl) {
      setStrokeColor(selectedEl.getAttribute('stroke') ?? '#000000')
      setStrokeWidth(parseFloat(selectedEl.getAttribute('stroke-width') ?? '0'))
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
  const deleteEl = (el: Element) => { el.remove(); refreshElements(); if (selectedEl === el) setSelectedEl(null) }

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
          </Section>

          {/* Seleção */}
          {selectedEl && (
            <Section title="Seleção" defaultOpen>
              <div className="space-y-2">
                {/* Fill */}
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-500 w-10 shrink-0">Cor</label>
                  <input
                    type="color"
                    value={selFill?.match(/^#[0-9a-f]{6}$/i) ? selFill : '#ffffff'}
                    onChange={e => editorRef.paint(selectedEl, e.target.value, false)}
                    className="w-7 h-7 rounded border border-gray-200 cursor-pointer"
                  />
                  <span className="text-xs text-gray-400 font-mono flex-1 truncate">{selFill}</span>
                  <Tooltip label="Excluir elemento">
                    <button onClick={() => deleteEl(selectedEl)}
                      className="text-red-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors">
                      <Trash2 size={12} />
                    </button>
                  </Tooltip>
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

                {/* Stroke */}
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-500 w-10 shrink-0">Borda</label>
                  <input
                    type="color"
                    value={strokeColor}
                    onChange={e => {
                      setStrokeColor(e.target.value)
                      selectedEl.setAttribute('stroke', e.target.value)
                      if (strokeWidth === 0) {
                        const w = 1; setStrokeWidth(w)
                        selectedEl.setAttribute('stroke-width', String(w))
                      }
                    }}
                    className="w-7 h-7 rounded border border-gray-200 cursor-pointer"
                  />
                  <input
                    type="number" min={0} max={20} step={0.5}
                    value={strokeWidth}
                    onChange={e => {
                      const v = parseFloat(e.target.value) || 0
                      setStrokeWidth(v)
                      selectedEl.setAttribute('stroke-width', String(v))
                    }}
                    className="w-14 text-xs border border-gray-200 rounded px-1.5 py-1 text-center"
                    placeholder="px"
                  />
                </div>

                {/* Text properties */}
                {isText && (
                  <div className="space-y-1.5 pt-1 border-t border-gray-100">
                    <div className="flex items-center gap-2">
                      <Type size={11} className="text-gray-400 shrink-0" />
                      <select
                        defaultValue={selectedEl.getAttribute('font-family') ?? 'sans-serif'}
                        onChange={e => selectedEl.setAttribute('font-family', e.target.value)}
                        className="flex-1 text-xs border border-gray-200 rounded px-1.5 py-1"
                      >
                        <option value="sans-serif">Sans-serif</option>
                        <option value="serif">Serif</option>
                        <option value="monospace">Monospace</option>
                        <option value="Arial">Arial</option>
                        <option value="Georgia">Georgia</option>
                        <option value="Impact">Impact</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="text-xs text-gray-400 w-10 shrink-0">Tam.</label>
                      <input
                        type="number" min={4} max={500}
                        defaultValue={parseFloat(selectedEl.getAttribute('font-size') ?? '16')}
                        onChange={e => selectedEl.setAttribute('font-size', e.target.value)}
                        className="w-16 text-xs border border-gray-200 rounded px-1.5 py-1 text-center"
                      />
                      <select
                        defaultValue={selectedEl.getAttribute('font-weight') ?? 'normal'}
                        onChange={e => selectedEl.setAttribute('font-weight', e.target.value)}
                        className="flex-1 text-xs border border-gray-200 rounded px-1.5 py-1"
                      >
                        <option value="normal">Normal</option>
                        <option value="bold">Bold</option>
                        <option value="300">Light</option>
                        <option value="700">Bold</option>
                        <option value="900">Black</option>
                      </select>
                    </div>
                  </div>
                )}

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

          {/* Cores */}
          <Section title="Cores">
            <div className="flex flex-wrap gap-1.5 mb-2">
              {COLORS.map(c => (
                <Tooltip key={c} label={c}>
                  <button
                    onClick={() => {
                      if (selectedEl && mode === 'select') editorRef.paint(selectedEl, c, false)
                      else setColor(c)
                    }}
                    className={cn(
                      'w-6 h-6 rounded-full border-[2.5px] transition-transform shrink-0',
                      selectedColor === c && mode === 'paint'
                        ? 'border-gray-900 scale-110 shadow-[0_0_0_2px_white_inset]'
                        : 'border-transparent hover:scale-110',
                    )}
                    style={{ background: c }}
                  />
                </Tooltip>
              ))}
              <Tooltip label="Cor personalizada">
                <input
                  type="color" value={selectedColor}
                  onChange={e => {
                    if (selectedEl && mode === 'select') editorRef.paint(selectedEl, e.target.value, false)
                    else setColor(e.target.value)
                  }}
                  className="w-6 h-6 p-0.5 border-2 border-gray-200 rounded-full cursor-pointer bg-transparent shrink-0"
                />
              </Tooltip>
            </div>

            <div className="flex gap-1.5 flex-wrap">
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
            <div className="flex gap-1.5 flex-wrap">
              <button onClick={dlSvg}
                className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 font-medium">
                <Download size={12} /> SVG
              </button>
              <button onClick={() => dlPng(false)}
                className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 font-medium">
                <Download size={12} /> PNG
              </button>
              <button onClick={() => dlPng(true)}
                className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 bg-white hover:bg-gray-50 font-medium">
                <Download size={12} /> PNG transp.
              </button>
            </div>
          </Section>

          {/* Elementos */}
          <Section title={`Elementos (${elements.length})`} defaultOpen={false}>
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

            <div className="space-y-0.5 max-h-52 overflow-y-auto pr-1">
              {elements.length === 0 && <p className="text-xs text-gray-400">Nenhum elemento.</p>}
              {elements.map((el, i) => {
                const fill = el.getAttribute('fill') ?? '#FFFFFF'
                const isSelected = el === selectedEl
                const isHidden   = hidden.has(i)
                const isChecked  = checked.has(i)
                return (
                  <div key={i}
                    onClick={() => { setSelectedEl(isSelected ? null : el); setMode('select') }}
                    className={cn(
                      'flex items-center gap-1.5 px-1.5 py-1 rounded-lg cursor-pointer transition-colors text-xs',
                      isSelected ? 'bg-blue-50 ring-1 ring-blue-300' : 'hover:bg-gray-50',
                      isHidden && 'opacity-40',
                    )}
                  >
                    <input type="checkbox" checked={isChecked}
                      onClick={e => e.stopPropagation()}
                      onChange={() => toggleCheck(i)}
                      className="w-3 h-3 shrink-0 accent-blue-600" />
                    <div className="w-4 h-4 rounded-sm border border-gray-200 shrink-0"
                      style={{
                        background: fill === '#FFFFFF' || fill === 'none' ? 'transparent' : fill,
                        backgroundImage: fill === '#FFFFFF' || fill === 'none'
                          ? 'repeating-conic-gradient(#ddd 0% 25%, transparent 0% 50%)' : 'none',
                        backgroundSize: '6px 6px',
                      }} />
                    <span className="text-gray-600 truncate flex-1">{elLabel(el, i)}</span>
                    <Tooltip label={isHidden ? 'Mostrar' : 'Ocultar'}>
                      <button onClick={e => { e.stopPropagation(); toggleVisibility(i, el) }}
                        className="text-gray-300 hover:text-gray-600 p-0.5">
                        {isHidden ? <EyeOff size={11} /> : <Eye size={11} />}
                      </button>
                    </Tooltip>
                    <Tooltip label="Excluir">
                      <button onClick={e => { e.stopPropagation(); deleteEl(el) }}
                        className="text-gray-300 hover:text-red-500 p-0.5">
                        <Trash2 size={11} />
                      </button>
                    </Tooltip>
                  </div>
                )
              })}
            </div>
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
