import { useState, useEffect } from 'react'
import { Save, Trash2 } from 'lucide-react'
import type { ControlsValues } from '../schemas'

interface Preset {
  id: string
  name: string
  values: Partial<ControlsValues>
}

const STORAGE_KEY = 'vectorizer-presets'

const BUILT_IN_PRESETS: Preset[] = [
  { id: 'sketch', name: 'Sketch/Desenho', values: { mode: 'lineart', threshold: 150, dilate: 2, minArea: 10 } },
  { id: 'icon-flat', name: 'Ícone Flat', values: { mode: 'icon', dilate: 2, minArea: 20 } },
  { id: 'photo-hq', name: 'Foto Alta Qualidade', values: { mode: 'vtracer', vtColormode: 'color', vtColorPrecision: 8, vtFilterSpeckle: 2 } },
  { id: 'photo-simple', name: 'Foto Simplificada', values: { mode: 'vtracer', vtColormode: 'color', vtColorPrecision: 4, vtFilterSpeckle: 6 } },
  { id: 'bw-clean', name: 'P&B Limpo', values: { mode: 'vtracer', vtColormode: 'binary', vtFilterSpeckle: 4, vtColorPrecision: 2 } },
  { id: 'deep', name: 'Deep Learning', values: { mode: 'deep_edges', dilate: 2, minArea: 15 } },
]

function loadPresets(): Preset[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') }
  catch { return [] }
}
function savePresets(p: Preset[]) { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)) }

interface PresetsPanelProps {
  currentValues: ControlsValues
  onApply: (values: Partial<ControlsValues>) => void
}

export function PresetsPanel({ currentValues, onApply }: PresetsPanelProps) {
  const [presets, setPresets] = useState<Preset[]>(loadPresets)

  useEffect(() => { savePresets(presets) }, [presets])

  const saveCurrent = () => {
    const name = prompt('Nome do preset:')
    if (!name) return
    const preset: Preset = {
      id: `preset-${Date.now().toString(36)}`,
      name,
      values: { ...currentValues },
    }
    setPresets(prev => [...prev, preset])
  }

  const allPresets = [...BUILT_IN_PRESETS, ...presets]

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1">
        {allPresets.map(p => (
          <div key={p.id} className="group relative">
            <button
              onClick={() => onApply(p.values)}
              className="text-[0.6rem] px-2 py-1 rounded-lg border border-gray-200 hover:border-blue-300 hover:bg-blue-50 text-gray-600 transition-colors"
            >
              {p.name}
            </button>
            {presets.some(up => up.id === p.id) && (
              <button
                onClick={() => setPresets(prev => prev.filter(up => up.id !== p.id))}
                className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 text-white rounded-full text-[0.4rem] flex items-center justify-center opacity-0 group-hover:opacity-100"
              >×</button>
            )}
          </div>
        ))}
      </div>
      <button onClick={saveCurrent}
        className="flex items-center gap-1 text-[0.6rem] text-blue-500 hover:text-blue-700">
        <Save size={10} /> Salvar configuração atual
      </button>
    </div>
  )
}
