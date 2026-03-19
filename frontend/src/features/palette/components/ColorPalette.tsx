import { cn } from '@/shared/lib/utils'
import { COLORS, usePaletteStore } from '../store'

export function ColorPalette() {
  const { selectedColor, mode, setColor, setMode } = usePaletteStore()
  const erasing = mode === 'erase'

  return (
    <div className="flex items-center gap-1.5 flex-wrap px-3 py-2 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-2xl shadow-lg">
      <span className="text-[0.65rem] text-gray-400 font-bold uppercase tracking-widest mr-1 whitespace-nowrap">
        Cor
      </span>

      {COLORS.map((c) => (
        <button
          key={c}
          title={c}
          onClick={() => setColor(c)}
          className={cn(
            'w-5 h-5 rounded-full border-[2.5px] transition-transform shrink-0',
            selectedColor === c && !erasing
              ? 'border-gray-900 scale-110 shadow-[0_0_0_2px_white_inset]'
              : 'border-transparent hover:scale-110',
          )}
          style={{ background: c }}
        />
      ))}

      <input
        type="color"
        title="Cor personalizada"
        value={selectedColor}
        onChange={e => setColor(e.target.value)}
        className="w-6 h-6 p-0.5 border-2 border-gray-200 rounded-full cursor-pointer bg-transparent shrink-0"
      />

      <button
        title="Borracha"
        onClick={() => setMode('erase')}
        className={cn(
          'text-xs px-2 py-0.5 rounded border transition-colors',
          erasing
            ? 'bg-gray-200 border-gray-400'
            : 'bg-white border-gray-200 hover:bg-gray-100',
        )}
      >
        <svg className="inline-block mr-1" width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
          <path d="M15.14 3c-.51 0-1.02.2-1.41.59L2.59 14.73a2 2 0 0 0 0 2.83L5.03 20H20v-2H9.41l8.18-8.18-5.83-5.83c-.39-.39-.9-.59-1.41-.59h-.21z"/>
        </svg>
        Borracha
      </button>
    </div>
  )
}
