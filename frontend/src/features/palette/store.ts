import { create } from 'zustand'

export const COLORS = [
  '#F94144', '#F3722C', '#F9C74F', '#90BE6D', '#43AA8B', '#4D908E',
  '#577590', '#B5838D', '#9B5DE5', '#00BBF9', '#FF99C8', '#FCBF49',
  '#A8DADC', '#C77DFF', '#FFDDD2', '#FFFFFF',
]

export type EditorMode = 'select' | 'pan' | 'paint' | 'erase' | 'rect' | 'ellipse' | 'line' | 'text' | 'pen' | 'polygon' | 'freehand' | 'eyedropper' | 'arrow'

interface PaletteState {
  selectedColor: string
  mode: EditorMode
  /** Multi-select: all currently selected elements */
  selectedEls: Element[]
  /** Backward-compatible: always selectedEls[0] ?? null */
  selectedEl: Element | null
  /** Snap to grid */
  gridEnabled: boolean
  gridSize: number
  guidesEnabled: boolean

  setColor: (color: string) => void
  setMode: (mode: EditorMode) => void
  /** Select a single element (clears multi-select) */
  setSelectedEl: (el: Element | null) => void
  /** Set full multi-select list */
  setSelectedEls: (els: Element[]) => void
  /** Toggle an element in multi-select (for Shift+click) */
  toggleSelectedEl: (el: Element) => void
  setGridEnabled: (v: boolean) => void
  setGridSize: (v: number) => void
  setGuidesEnabled: (v: boolean) => void
  darkMode: boolean
  setDarkMode: (v: boolean) => void
}

export const usePaletteStore = create<PaletteState>((set) => ({
  selectedColor: COLORS[0],
  mode: 'paint',
  selectedEls: [],
  selectedEl: null,
  gridEnabled: false,
  gridSize: 10,
  guidesEnabled: true,

  setColor:      (color) => set({ selectedColor: color, mode: 'paint' }),
  setMode:       (mode)  => set({ mode, selectedEls: [], selectedEl: null }),
  setSelectedEl: (el)    => set({ selectedEls: el ? [el] : [], selectedEl: el }),
  setSelectedEls:(els)   => set({ selectedEls: els, selectedEl: els[0] ?? null }),
  toggleSelectedEl: (el) => set((state) => {
    const idx = state.selectedEls.indexOf(el)
    const next = idx >= 0
      ? state.selectedEls.filter((_, i) => i !== idx)
      : [...state.selectedEls, el]
    return { selectedEls: next, selectedEl: next[0] ?? null }
  }),
  setGridEnabled:  (v) => set({ gridEnabled: v }),
  setGridSize:     (v) => set({ gridSize: v }),
  setGuidesEnabled:(v) => set({ guidesEnabled: v }),
  // Dark mode
  darkMode: false,
  setDarkMode: (v: boolean) => set({ darkMode: v }),
}))
