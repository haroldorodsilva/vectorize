import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { controlsSchema, type ControlsValues } from '../schemas'
import { Slider } from '@/shared/components/ui/Slider'
import { Button } from '@/shared/components/ui/Button'
import { cn } from '@/shared/lib/utils'
import { analyzeImage, removeBackground, upscaleImage, extractText } from '../api'
import { useVectorizeStore } from '../store'
import { PresetsPanel } from './PresetsPanel'

interface ControlsFormProps {
  disabled?: boolean
  loading?: boolean
  onSubmit: (values: ControlsValues) => void
}

export function ControlsForm({ disabled, loading, onSubmit }: ControlsFormProps) {
  const { register, handleSubmit, watch, setValue } = useForm<ControlsValues>({
    resolver: zodResolver(controlsSchema),
    defaultValues: {
      mode: 'lineart', threshold: 170, dilate: 1, minArea: 10,
      vtColormode: 'color', vtFilterSpeckle: 4, vtColorPrecision: 6,
      vtLayerDifference: 16, vtCornerThreshold: 60, vtSpliceThreshold: 45,
    },
  })

  const [mode, threshold, dilate, minArea,
    vtFilterSpeckle, vtColorPrecision, vtLayerDifference,
    vtCornerThreshold, vtSpliceThreshold, vtColormode] =
    watch(['mode', 'threshold', 'dilate', 'minArea',
      'vtFilterSpeckle', 'vtColorPrecision', 'vtLayerDifference',
      'vtCornerThreshold', 'vtSpliceThreshold', 'vtColormode'])

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
      {/* Mode tabs */}
      <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs font-semibold">
        <button
          type="button"
          onClick={() => setValue('mode', 'lineart')}
          className={cn(
            'flex-1 py-1.5 transition-colors',
            mode === 'lineart' ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 hover:bg-gray-50',
          )}
        >
          ✏ Lineart
        </button>
        <button
          type="button"
          onClick={() => setValue('mode', 'icon')}
          className={cn(
            'flex-1 py-1.5 border-l border-gray-200 transition-colors',
            mode === 'icon' ? 'bg-orange-500 text-white' : 'bg-white text-gray-500 hover:bg-gray-50',
          )}
        >
          ◈ Ícone
        </button>
        <button
          type="button"
          onClick={() => setValue('mode', 'vtracer')}
          className={cn(
            'flex-1 py-1.5 border-l border-gray-200 transition-colors',
            mode === 'vtracer' ? 'bg-purple-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50',
          )}
        >
          ⚡ Foto
        </button>
        <button
          type="button"
          onClick={() => setValue('mode', 'deep_edges')}
          className={cn(
            'flex-1 py-1.5 border-l border-gray-200 transition-colors',
            mode === 'deep_edges' ? 'bg-teal-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50',
          )}
        >
          🧠 Deep
        </button>
      </div>

      <input type="hidden" {...register('mode')} />

      {/* Presets */}
      <PresetsPanel
        currentValues={{ mode, threshold, dilate, minArea, vtColormode, vtFilterSpeckle, vtColorPrecision, vtLayerDifference, vtCornerThreshold, vtSpliceThreshold }}
        onApply={(v) => {
          if (v.mode) setValue('mode', v.mode as any)
          if (v.threshold !== undefined) setValue('threshold', v.threshold)
          if (v.dilate !== undefined) setValue('dilate', v.dilate)
          if (v.minArea !== undefined) setValue('minArea', v.minArea)
          if (v.vtColormode) setValue('vtColormode', v.vtColormode as any)
          if (v.vtColorPrecision !== undefined) setValue('vtColorPrecision', v.vtColorPrecision)
          if (v.vtFilterSpeckle !== undefined) setValue('vtFilterSpeckle', v.vtFilterSpeckle)
          if (v.vtLayerDifference !== undefined) setValue('vtLayerDifference', v.vtLayerDifference)
          if (v.vtCornerThreshold !== undefined) setValue('vtCornerThreshold', v.vtCornerThreshold)
          if (v.vtSpliceThreshold !== undefined) setValue('vtSpliceThreshold', v.vtSpliceThreshold)
        }}
      />

      {/* Lineart controls */}
      {mode === 'lineart' && (
        <div className="space-y-3">
          <Slider label="Sensibilidade" valueDisplay={threshold}
            min={80} max={210} {...register('threshold', { valueAsNumber: true })} />
          <Slider label="Fechamento gaps" valueDisplay={dilate}
            min={1} max={6} {...register('dilate', { valueAsNumber: true })} />
          <Slider label="Área mínima" valueDisplay={minArea}
            min={1} max={500} {...register('minArea', { valueAsNumber: true })} />
          <p className="text-[0.65rem] text-gray-400 leading-tight">
            Gera regiões fechadas para colorir. Ideal para desenhos e esboços.
          </p>
        </div>
      )}

      {/* Icon mode controls */}
      {mode === 'icon' && (
        <div className="space-y-3">
          <Slider label="Fechamento gaps" valueDisplay={dilate}
            min={1} max={6} {...register('dilate', { valueAsNumber: true })} />
          <Slider label="Área mínima" valueDisplay={minArea}
            min={1} max={500} {...register('minArea', { valueAsNumber: true })} />
          <p className="text-[0.65rem] text-orange-500 leading-tight">
            ◈ Detecta bordas de cor para ícones e ilustrações flat. Gera regiões pintáveis.
          </p>
        </div>
      )}

      {/* vtracer controls */}
      {mode === 'vtracer' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500 w-20 shrink-0">Tipo</span>
            <div className="flex rounded border border-gray-200 overflow-hidden text-xs">
              <button type="button" onClick={() => setValue('vtColormode', 'color')}
                className={cn('px-2 py-1 transition-colors', vtColormode === 'color' ? 'bg-blue-600 text-white' : 'bg-white text-gray-500 hover:bg-gray-50')}>
                Colorido
              </button>
              <button type="button" onClick={() => setValue('vtColormode', 'binary')}
                className={cn('px-2 py-1 border-l border-gray-200 transition-colors', vtColormode === 'binary' ? 'bg-gray-900 text-white' : 'bg-white text-gray-500 hover:bg-gray-50')}>
                P&amp;B
              </button>
            </div>
          </div>
          <input type="hidden" {...register('vtColormode')} />
          <Slider label="Precisão cores" valueDisplay={vtColorPrecision}
            min={1} max={8} {...register('vtColorPrecision', { valueAsNumber: true })} />
          <Slider label="Filtro ruído" valueDisplay={vtFilterSpeckle}
            min={1} max={16} {...register('vtFilterSpeckle', { valueAsNumber: true })} />
          <Slider label="Dif. camadas" valueDisplay={vtLayerDifference}
            min={0} max={256} {...register('vtLayerDifference', { valueAsNumber: true })} />
          <Slider label="Ângulo canto" valueDisplay={vtCornerThreshold}
            min={0} max={180} {...register('vtCornerThreshold', { valueAsNumber: true })} />
          <Slider label="Ângulo junção" valueDisplay={vtSpliceThreshold}
            min={0} max={180} {...register('vtSpliceThreshold', { valueAsNumber: true })} />
          <p className="text-[0.65rem] text-purple-500 leading-tight">
            ⚡ Vetorização de alta qualidade. Preserva cores e detalhes. Ideal para fotos, ícones e ilustrações.
          </p>
        </div>
      )}

      {/* Deep edges controls */}
      {mode === 'deep_edges' && (
        <div className="space-y-3">
          <Slider label="Fechamento gaps" valueDisplay={dilate}
            min={1} max={6} {...register('dilate', { valueAsNumber: true })} />
          <Slider label="Área mínima" valueDisplay={minArea}
            min={1} max={500} {...register('minArea', { valueAsNumber: true })} />
          <p className="text-[0.65rem] text-teal-600 leading-tight">
            🧠 Detecção de bordas com deep learning. Multi-escala Canny + LAB color space. Melhor para imagens complexas.
          </p>
        </div>
      )}

      {/* Preprocessing */}
      <div className="flex gap-1.5">
        <button
          type="button" disabled={disabled}
          onClick={async () => {
            const file = useVectorizeStore.getState().currentFile
            if (!file) return
            try {
              const blob = await removeBackground(file)
              const newFile = new File([blob], file.name.replace(/\.\w+$/, '_nobg.png'), { type: 'image/png' })
              useVectorizeStore.getState().setFile(newFile)
              alert('Fundo removido!')
            } catch (e) { alert('Erro: ' + (e instanceof Error ? e.message : e)) }
          }}
          className="flex-1 text-[0.65rem] py-1.5 border border-green-200 text-green-700 bg-green-50 hover:bg-green-100 rounded-lg font-medium transition-colors"
        >
          Remover fundo
        </button>
        <button
          type="button" disabled={disabled}
          onClick={async () => {
            const file = useVectorizeStore.getState().currentFile
            if (!file) return
            try {
              const blob = await upscaleImage(file, 2)
              const newFile = new File([blob], file.name.replace(/\.\w+$/, '_2x.png'), { type: 'image/png' })
              useVectorizeStore.getState().setFile(newFile)
              alert('Imagem ampliada 2x!')
            } catch (e) { alert('Erro: ' + (e instanceof Error ? e.message : e)) }
          }}
          className="flex-1 text-[0.65rem] py-1.5 border border-purple-200 text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg font-medium transition-colors"
        >
          Ampliar 2x
        </button>
      </div>

      {/* OCR text extraction */}
      <button
        type="button" disabled={disabled}
        onClick={async () => {
          const file = useVectorizeStore.getState().currentFile
          if (!file) return
          try {
            const result = await extractText(file)
            if (result.count === 0) { alert('Nenhum texto detectado.'); return }
            alert(`${result.count} textos detectados! Vetorize primeiro, depois os textos serão adicionados como <text>.`)
          } catch (e) { alert('Erro OCR: ' + (e instanceof Error ? e.message : e)) }
        }}
        className="w-full text-[0.65rem] py-1.5 border border-cyan-200 text-cyan-700 bg-cyan-50 hover:bg-cyan-100 rounded-lg font-medium transition-colors"
      >
        🔤 Extrair texto (OCR)
      </button>

      {/* Auto-detect */}
      <button
        type="button"
        disabled={disabled}
        onClick={async () => {
          const file = useVectorizeStore.getState().currentFile
          if (!file) return
          try {
            const result = await analyzeImage(file)
            const s = result.recommended_settings as Record<string, string | number>
            if (s.mode) setValue('mode', s.mode as 'lineart' | 'icon' | 'vtracer')
            if (s.threshold) setValue('threshold', Number(s.threshold))
            if (s.dilate) setValue('dilate', Number(s.dilate))
            if (s.minArea) setValue('minArea', Number(s.minArea))
            if (s.vtColormode) setValue('vtColormode', s.vtColormode as 'color' | 'binary')
            if (s.vtColorPrecision) setValue('vtColorPrecision', Number(s.vtColorPrecision))
            if (s.vtFilterSpeckle) setValue('vtFilterSpeckle', Number(s.vtFilterSpeckle))
          } catch (e) {
            console.warn('Auto-detect failed:', e)
          }
        }}
        className="w-full text-xs py-1.5 border border-blue-200 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg font-medium transition-colors"
      >
        🔍 Auto-detectar tipo
      </button>

      <Button type="submit" disabled={disabled} className="w-full justify-center">
        {loading ? '⟳ Processando…' : '▶ Vetorizar'}
      </Button>
    </form>
  )
}
