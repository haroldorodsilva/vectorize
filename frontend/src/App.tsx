import { useEffect, useRef, useState } from 'react'
import { cn }                  from '@/shared/lib/utils'
import { DropZone }            from '@/features/upload/components/DropZone'
import { SvgEditor }           from '@/features/editor/components/SvgEditor'
import { LeftToolbar }         from '@/features/editor/components/LeftToolbar'
import { RightPanel }          from '@/features/editor/components/RightPanel'
import { ConfirmModal }        from '@/shared/components/ui/ConfirmModal'
import { useEditor }           from '@/features/editor/hooks/useEditor'
import { useVectorizeStore }   from '@/features/vectorize/store'
import type { ControlsValues } from '@/features/vectorize/schemas'

const isSvgFile = (f: File) =>
  f.type === 'image/svg+xml' || f.name.toLowerCase().endsWith('.svg')

export function App() {
  const { isProcessing, svgData, run, setSvgData } = useVectorizeStore()
  const editorRef = useEditor()

  const [fileLoaded, setFileLoaded]   = useState(false)
  const [previewUrl, setPreviewUrl]   = useState<string | null>(null)
  const [hlOn, setHlOn]               = useState(false)
  const [tpOn, setTpOn]               = useState(false)
  const [tpSaved, setTpSaved]         = useState<Array<{ el: Element; fill: string }>>([]
  )
  const [cropActive, setCropActive]   = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const pendingFile = useRef<File | null>(null)
  const [compareOn, setCompareOn]     = useState(false)

  useEffect(() => {
    if (svgData) {
      requestAnimationFrame(() => {
        editorRef.initViewBox()
        editorRef.syncResInputs()
      })
    }
  }, [svgData])

  const doLoadFile = async (file: File) => {
    useVectorizeStore.getState().reset()
    setHlOn(false); setTpOn(false); setTpSaved([])
    setCompareOn(false)

    if (isSvgFile(file)) {
      // Load SVG directly into editor without vectorizing
      const text = await file.text()
      // Wrap in a minimal response shape
      useVectorizeStore.getState().setSvgData({
        svg: text,
        regions: [],
        width: 0,
        height: 0,
        processing_time_ms: 0,
      })
      useVectorizeStore.getState().setFile(file)
      setFileLoaded(true)
      setPreviewUrl(null)
    } else {
      useVectorizeStore.getState().setFile(file)
      setFileLoaded(true)
      setPreviewUrl(URL.createObjectURL(file))
    }
  }

  const handleFile = (file: File) => {
    if (svgData) {
      pendingFile.current = file
      setConfirmOpen(true)
    } else {
      doLoadFile(file)
    }
  }

  // ── Blank canvas ──────────────────────────────────────────────────────────
  const openBlankCanvas = (w = 800, h = 600) => {
    const blank = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"></svg>`
    useVectorizeStore.getState().reset()
    setSvgData({ svg: blank, regions: [], width: w, height: h, processing_time_ms: 0 })
    setFileLoaded(true)
    setPreviewUrl(null)
    setHlOn(false); setTpOn(false); setTpSaved([])
    setCompareOn(false)
  }

  // ── Import image into canvas as <image> element ────────────────────────────
  const importImageToCanvas = (file: File) => {
    const svg = editorRef.getSvg()
    if (!svg) return
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      const img = new Image()
      img.onload = () => {
        const vb = editorRef.vbRef.current
        const cx = vb ? vb.x + vb.w / 2 - img.width / 2 : 0
        const cy = vb ? vb.y + vb.h / 2 - img.height / 2 : 0
        const el = document.createElementNS('http://www.w3.org/2000/svg', 'image')
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
    reader.readAsDataURL(file)
  }

  // ── Clear conversion (keep file, remove SVG) ───────────────────────────────
  const clearConversion = () => {
    useVectorizeStore.getState().reset()
    setHlOn(false); setTpOn(false); setTpSaved([])
    setCompareOn(false); setCropActive(false)
  }

  const handleVectorize = async (params: ControlsValues) => {
    const savedColors = editorRef.saveColorMap()
    setHlOn(false); setTpOn(false); setTpSaved([])
    try {
      await run(params)
      requestAnimationFrame(() => editorRef.restoreColorMap(savedColors))
    } catch (err) {
      alert('Erro ao vetorizar:\n' + (err instanceof Error ? err.message : String(err)))
    }
  }

  // ── Highlight ─────────────────────────────────────────────────────────────
  const toggleHL = () => {
    const next = !hlOn; setHlOn(next)
    const el = editorRef.getSvg()
    if (!el) return
    el.querySelectorAll('[data-region]').forEach(p => {
      if (next) { p.setAttribute('stroke', '#2563eb'); p.setAttribute('stroke-width', '1.5'); p.setAttribute('stroke-opacity', '0.65') }
      else       { p.removeAttribute('stroke'); p.removeAttribute('stroke-width'); p.removeAttribute('stroke-opacity') }
    })
  }

  // ── Transparency ──────────────────────────────────────────────────────────
  const toggleTP = () => {
    const next = !tpOn; setTpOn(next)
    const el = editorRef.getSvg()
    if (!el) return
    if (next) {
      const saved: typeof tpSaved = []
      el.querySelectorAll('[data-region]').forEach(p => {
        const f = p.getAttribute('fill')
        if (!f || f === '#FFFFFF' || f === '#ffffff') { saved.push({ el: p, fill: f ?? '#FFFFFF' }); p.setAttribute('fill', 'none') }
      })
      setTpSaved(saved)
    } else {
      tpSaved.forEach(({ el: p, fill }) => { if (p.getAttribute('fill') === 'none') p.setAttribute('fill', fill) })
      setTpSaved([])
    }
  }

  return (
    <div className="h-screen overflow-hidden flex flex-col bg-gray-100">

      {/* ── Confirm modal ──────────────────────────────────────────────────── */}
      <ConfirmModal
        open={confirmOpen}
        title="Carregar nova imagem"
        message="Você tem um SVG não exportado. Carregar uma nova imagem irá perder o trabalho atual."
        confirmLabel="Sim, carregar"
        cancelLabel="Cancelar"
        danger
        onConfirm={() => {
          setConfirmOpen(false)
          if (pendingFile.current) { doLoadFile(pendingFile.current); pendingFile.current = null }
          else openBlankCanvas()
        }}
        onCancel={() => { setConfirmOpen(false); pendingFile.current = null }}
      />

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="h-12 bg-white border-b border-gray-200 flex items-center gap-2 px-4 shadow-sm z-50 shrink-0">
        <span className="font-bold text-sm tracking-tight text-gray-900 select-none">◆ Vetorizador</span>
        <span className="text-[0.58rem] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full font-bold">v2</span>

        <div className="w-px h-5 bg-gray-200 mx-1" />

        {/* Upload */}
        <label className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg cursor-pointer font-medium text-gray-700 transition-colors select-none">
          ⊕ Carregar
          <input
            type="file" accept="image/*,.svg,image/svg+xml" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }}
          />
        </label>

        {/* Import image into canvas (only when SVG canvas is open) */}
        {svgData && (
          <label className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg cursor-pointer font-medium text-gray-700 transition-colors select-none">
            ⊞ Importar imagem
            <input
              type="file" accept="image/*" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) importImageToCanvas(f); e.target.value = '' }}
            />
          </label>
        )}

        {/* New blank canvas */}
        <button
          onClick={() => {
            if (svgData) { pendingFile.current = null; setConfirmOpen(true) }
            else openBlankCanvas()
          }}
          className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium text-gray-700 transition-colors select-none"
        >
          ◻ Novo
        </button>

        {/* Clear conversion */}
        {svgData && fileLoaded && previewUrl && (
          <button
            onClick={clearConversion}
            className="text-xs px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg font-medium text-gray-700 transition-colors select-none"
          >
            ✕ Limpar vetorização
          </button>
        )}

        {svgData && (
          <button
            onClick={() => setCompareOn(o => !o)}
            className={cn(
              'text-xs px-3 py-1.5 rounded-lg font-medium transition-colors select-none',
              compareOn
                ? 'bg-blue-50 text-blue-600 border border-blue-300'
                : 'bg-gray-100 hover:bg-gray-200 text-gray-700',
            )}
          >
            ◧ Comparar
          </button>
        )}

        <div className="ml-auto flex items-center gap-1.5 text-xs text-gray-400 hidden sm:flex">
          Scroll = zoom · Drag = mover · R/O/L/T = desenhar · Del = excluir · Ctrl+Z = desfazer
        </div>
      </header>

      {/* ── Body ───────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left toolbar (only when SVG is loaded) */}
        {svgData && (
          <LeftToolbar
            editorRef={editorRef}
            cropActive={cropActive}
            onCropStart={() => setCropActive(true)}
            onCropCancel={() => setCropActive(false)}
          />
        )}

        {/* ── Canvas area ────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-hidden flex flex-col bg-[#dde1e7]">
          {!fileLoaded ? (
            // ── Drop zone ─────────────────────────────────────────────────
            <div className="flex-1 flex items-center justify-center p-10">
              <DropZone onFile={handleFile} />
            </div>

          ) : !svgData ? (
            // ── Original image (before vectorize) ─────────────────────────
            <div className="flex-1 flex items-center justify-center p-8 relative">
              {previewUrl && (
                <img
                  src={previewUrl}
                  alt="original"
                  className="max-w-full max-h-full object-contain rounded-xl shadow-xl"
                />
              )}
              {isProcessing && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/30 rounded-xl m-8">
                  <div className="bg-white rounded-2xl px-8 py-5 text-sm font-semibold text-gray-800 shadow-2xl">
                    ⟳ Vetorizando…
                  </div>
                </div>
              )}
            </div>

          ) : compareOn ? (
            // ── Compare view ──────────────────────────────────────────────
            <div className="flex-1 flex overflow-hidden">
              <div className="flex-1 flex items-center justify-center bg-[#dde1e7] p-4 border-r-2 border-white relative">
                {previewUrl && (
                  <img src={previewUrl} alt="original" className="max-w-full max-h-full object-contain" />
                )}
                <div className="absolute top-2 left-2 text-[0.6rem] font-bold text-white bg-black/40 px-2 py-0.5 rounded-full uppercase tracking-widest">Original</div>
              </div>
              <div className="flex-1 relative">
                <SvgEditor
                  svgContent={svgData.svg}
                  editorRef={editorRef}
                  tpOn={tpOn}
                  cropActive={cropActive}
                  onCropConfirm={(sel, ov) => { const ok = editorRef.confirmCrop(sel, ov); if (ok) setCropActive(false); return ok }}
                  onCropCancel={() => setCropActive(false)}
                />
                <div className="absolute top-2 left-2 text-[0.6rem] font-bold text-white bg-black/40 px-2 py-0.5 rounded-full uppercase tracking-widest pointer-events-none">Vetorizado</div>
              </div>
            </div>

          ) : (
            // ── SVG editor full area ───────────────────────────────────────
            <div className="flex-1 relative">
              <SvgEditor
                svgContent={svgData.svg}
                editorRef={editorRef}
                tpOn={tpOn}
                cropActive={cropActive}
                onCropConfirm={(sel, ov) => { const ok = editorRef.confirmCrop(sel, ov); if (ok) setCropActive(false); return ok }}
                onCropCancel={() => setCropActive(false)}
              />
            </div>
          )}
        </div>

        {/* ── Right panel (always when file loaded) ──────────────────────── */}
        {fileLoaded && (
          <RightPanel
            editorRef={editorRef}
            svgData={svgData}
            fileLoaded={fileLoaded}
            disabled={isProcessing || !fileLoaded}
            loading={isProcessing}
            onSubmit={handleVectorize}
            hlOn={hlOn}
            tpOn={tpOn}
            onToggleHL={toggleHL}
            onToggleTP={toggleTP}
            canVectorize={!!previewUrl}
          />
        )}
      </div>
    </div>
  )
}
