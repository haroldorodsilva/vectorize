import type { VectorizeResponse } from '@/shared/types'
import type { ControlsValues } from './schemas'

const API = import.meta.env.VITE_API_URL || ''

export async function vectorize(
  file: File,
  {
    mode, threshold, dilate, minArea,
    vtColormode, vtFilterSpeckle, vtColorPrecision,
    vtLayerDifference, vtCornerThreshold, vtSpliceThreshold,
  }: ControlsValues,
): Promise<VectorizeResponse> {
  const fd = new FormData()
  fd.append('file',            file)
  fd.append('mode',            mode)
  fd.append('line_threshold',  String(threshold))
  fd.append('dilate_radius',   String(dilate))
  fd.append('min_area',        String(minArea))
  // vtracer params (ignored by server when mode != 'vtracer')
  fd.append('vtracer_colormode',        vtColormode)
  fd.append('vtracer_filter_speckle',   String(vtFilterSpeckle))
  fd.append('vtracer_color_precision',  String(vtColorPrecision))
  fd.append('vtracer_layer_difference', String(vtLayerDifference))
  fd.append('vtracer_corner_threshold', String(vtCornerThreshold))
  fd.append('vtracer_splice_threshold', String(vtSpliceThreshold))

  const r = await fetch(`${API}/vectorize`, { method: 'POST', body: fd })
  if (!r.ok) {
    const e = await r.json().catch(() => ({}))
    throw new Error((e as { detail?: string }).detail ?? r.statusText)
  }
  return r.json() as Promise<VectorizeResponse>
}

/** Upscale image by 2x or 4x (returns PNG blob) */
export async function upscaleImage(file: File, scale: number = 2): Promise<Blob> {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('scale', String(scale))
  const r = await fetch(`${API}/preprocess/upscale`, { method: 'POST', body: fd })
  if (!r.ok) {
    const e = await r.json().catch(() => ({}))
    throw new Error((e as { detail?: string }).detail ?? r.statusText)
  }
  return r.blob()
}

/** Remove background from image (returns PNG blob with transparency) */
export async function removeBackground(file: File): Promise<Blob> {
  const fd = new FormData()
  fd.append('file', file)
  const r = await fetch(`${API}/preprocess/remove-bg`, { method: 'POST', body: fd })
  if (!r.ok) {
    const e = await r.json().catch(() => ({}))
    throw new Error((e as { detail?: string }).detail ?? r.statusText)
  }
  return r.blob()
}

/** Extract text from image using OCR */
export async function extractText(file: File): Promise<{
  regions: Array<{ text: string; bbox: number[]; confidence: number }>
  count: number
}> {
  const fd = new FormData()
  fd.append('file', file)
  const r = await fetch(`${API}/extract-text`, { method: 'POST', body: fd })
  if (!r.ok) {
    const e = await r.json().catch(() => ({}))
    throw new Error((e as { detail?: string }).detail ?? r.statusText)
  }
  return r.json()
}

/** Analyze image type and get recommended settings */
export async function analyzeImage(file: File): Promise<{
  type: string
  confidence: number
  recommended_mode: string
  recommended_settings: Record<string, unknown>
  analysis: Record<string, unknown>
}> {
  const fd = new FormData()
  fd.append('file', file)
  const r = await fetch(`${API}/analyze`, { method: 'POST', body: fd })
  if (!r.ok) {
    const e = await r.json().catch(() => ({}))
    throw new Error((e as { detail?: string }).detail ?? r.statusText)
  }
  return r.json()
}
