import { create } from 'zustand'

export const COLORS = [
  '#F94144', '#F3722C', '#F9C74F', '#90BE6D', '#43AA8B', '#4D908E',
  '#577590', '#B5838D', '#9B5DE5', '#00BBF9', '#FF99C8', '#FCBF49',
  '#A8DADC', '#C77DFF', '#FFDDD2', '#FFFFFF',
]

export type EditorMode = 'select' | 'pan' | 'paint' | 'erase' | 'rect' | 'ellipse' | 'line' | 'text'

interface PaletteState {
  selectedColor: string
  mode: EditorMode
  selectedEl: Element | null
  setColor: (color: string) => void
  setMode: (mode: EditorMode) => void
  setSelectedEl: (el: Element | null) => void
}

export const usePaletteStore = create<PaletteState>((set) => ({
  selectedColor: COLORS[0],
  mode: 'paint',
  selectedEl: null,
  setColor:      (color) => set({ selectedColor: color, mode: 'paint' }),
  setMode:       (mode)  => set({ mode, selectedEl: null }),
  setSelectedEl: (el)    => set({ selectedEl: el }),
}))
