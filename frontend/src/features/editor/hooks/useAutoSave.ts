import { useEffect, useRef } from 'react'
import type { useEditor } from './useEditor'

const STORAGE_KEY = 'vectorizer-autosave'
const INTERVAL = 30_000 // 30 seconds

export interface AutoSaveData {
  svg: string
  timestamp: number
}

export function useAutoSave(editorRef: ReturnType<typeof useEditor>, active: boolean) {
  const intervalRef = useRef<ReturnType<typeof setInterval>>()

  useEffect(() => {
    if (!active) return

    const save = () => {
      const svg = editorRef.getSvg()
      if (!svg) return
      const data: AutoSaveData = {
        svg: new XMLSerializer().serializeToString(svg),
        timestamp: Date.now(),
      }
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
      } catch {
        // localStorage full, ignore
      }
    }

    intervalRef.current = setInterval(save, INTERVAL)
    // Also save on beforeunload
    const onUnload = () => save()
    window.addEventListener('beforeunload', onUnload)

    return () => {
      clearInterval(intervalRef.current)
      window.removeEventListener('beforeunload', onUnload)
    }
  }, [active, editorRef])
}

export function getAutoSave(): AutoSaveData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch { return null }
}

export function clearAutoSave() {
  localStorage.removeItem(STORAGE_KEY)
}
