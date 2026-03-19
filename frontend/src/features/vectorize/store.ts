import { create } from 'zustand'
import type { VectorizeResponse } from '@/shared/types'
import type { ControlsValues } from './schemas'
import { vectorize as apiVectorize } from './api'

interface VectorizeState {
  currentFile: File | null
  isProcessing: boolean
  svgData: VectorizeResponse | null
  error: string | null

  setFile: (file: File) => void
  setSvgData: (data: VectorizeResponse) => void
  run: (params: ControlsValues) => Promise<void>
  reset: () => void
}

export const useVectorizeStore = create<VectorizeState>((set, get) => ({
  currentFile: null,
  isProcessing: false,
  svgData: null,
  error: null,

  setFile: (file) => set({ currentFile: file, error: null }),

  setSvgData: (data) => set({ svgData: data }),

  run: async (params) => {
    const { currentFile } = get()
    if (!currentFile) return
    set({ isProcessing: true, error: null })
    try {
      const data = await apiVectorize(currentFile, params)
      set({ svgData: data })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      set({ error: msg })
      throw err
    } finally {
      set({ isProcessing: false })
    }
  },

  reset: () => set({ svgData: null, error: null }),
}))
