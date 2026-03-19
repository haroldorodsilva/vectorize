import { useState, useEffect } from 'react'
import { Plus, Trash2, Save, Download } from 'lucide-react'
import { usePaletteStore, COLORS } from '@/features/palette/store'

interface SavedPalette {
  id: string
  name: string
  colors: string[]
}

const STORAGE_KEY = 'vectorizer-palettes'

function loadPalettes(): SavedPalette[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]') }
  catch { return [] }
}

function savePalettes(p: SavedPalette[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(p))
}

const PRESET_PALETTES: SavedPalette[] = [
  { id: 'pastel', name: 'Pastel', colors: ['#FFB3BA', '#FFDFBA', '#FFFFBA', '#BAFFC9', '#BAE1FF', '#E8BAFF', '#FFC9DE', '#C9FFE5'] },
  { id: 'neon', name: 'Neon', colors: ['#FF0080', '#FF8000', '#FFE500', '#00FF80', '#00BFFF', '#8000FF', '#FF0040', '#00FFD5'] },
  { id: 'earth', name: 'Terra', colors: ['#8B4513', '#A0522D', '#CD853F', '#DEB887', '#D2B48C', '#F5DEB3', '#6B8E23', '#556B2F'] },
  { id: 'ocean', name: 'Oceano', colors: ['#001F3F', '#003366', '#005B96', '#0080C0', '#00B4D8', '#48CAE4', '#90E0EF', '#ADE8F4'] },
  { id: 'mono', name: 'Monocromático', colors: ['#000000', '#1a1a1a', '#333333', '#4d4d4d', '#666666', '#999999', '#cccccc', '#ffffff'] },
]

export function ColorPaletteManager() {
  const { selectedColor, setColor, selectedEl, mode } = usePaletteStore()
  const [palettes, setPalettes] = useState<SavedPalette[]>(loadPalettes)
  const [activePalette, setActivePalette] = useState<string>('default')

  useEffect(() => { savePalettes(palettes) }, [palettes])

  const activeColors = activePalette === 'default'
    ? COLORS
    : [...PRESET_PALETTES, ...palettes].find(p => p.id === activePalette)?.colors ?? COLORS

  const saveCurrent = () => {
    const name = prompt('Nome da paleta:')
    if (!name) return
    const newPalette: SavedPalette = {
      id: `pal-${Date.now().toString(36)}`,
      name,
      colors: [...activeColors],
    }
    setPalettes(prev => [...prev, newPalette])
    setActivePalette(newPalette.id)
  }

  const deletePalette = (id: string) => {
    setPalettes(prev => prev.filter(p => p.id !== id))
    if (activePalette === id) setActivePalette('default')
  }

  const paint = (c: string) => {
    if (selectedEl && mode === 'select') {
      const store = usePaletteStore.getState()
      // Direct paint on selected element
      selectedEl.setAttribute('fill', c)
    } else {
      setColor(c)
    }
  }

  return (
    <div className="space-y-2">
      {/* Palette selector */}
      <div className="flex items-center gap-1">
        <select
          value={activePalette}
          onChange={e => setActivePalette(e.target.value)}
          className="flex-1 text-[0.65rem] border border-gray-200 rounded px-1.5 py-0.5"
        >
          <option value="default">Padrão</option>
          <optgroup label="Presets">
            {PRESET_PALETTES.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </optgroup>
          {palettes.length > 0 && (
            <optgroup label="Minhas paletas">
              {palettes.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
            </optgroup>
          )}
        </select>
        <button onClick={saveCurrent} className="p-1 rounded border border-gray-200 hover:bg-gray-50" title="Salvar paleta">
          <Save size={10} />
        </button>
        {palettes.some(p => p.id === activePalette) && (
          <button onClick={() => deletePalette(activePalette)} className="p-1 rounded border border-gray-200 hover:bg-red-50 text-red-400" title="Excluir">
            <Trash2 size={10} />
          </button>
        )}
      </div>

      {/* Color grid */}
      <div className="flex flex-wrap gap-1.5">
        {activeColors.map((c, i) => (
          <button key={`${c}-${i}`}
            onClick={() => paint(c)}
            className="w-6 h-6 rounded-full border-[2.5px] transition-transform shrink-0 hover:scale-110"
            style={{
              background: c,
              borderColor: selectedColor === c ? '#1e293b' : 'transparent',
              boxShadow: selectedColor === c ? '0 0 0 2px white inset' : undefined,
            }}
          />
        ))}
        <input
          type="color" value={selectedColor}
          onChange={e => paint(e.target.value)}
          className="w-6 h-6 p-0.5 border-2 border-gray-200 rounded-full cursor-pointer bg-transparent shrink-0"
          title="Cor personalizada"
        />
      </div>
    </div>
  )
}
