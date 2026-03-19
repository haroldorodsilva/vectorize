import type { VectorizeResponse } from '@/shared/types'
import type { ControlsValues } from './schemas'

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

  const r = await fetch('/vectorize', { method: 'POST', body: fd })
  if (!r.ok) {
    const e = await r.json().catch(() => ({}))
    throw new Error((e as { detail?: string }).detail ?? r.statusText)
  }
  return r.json() as Promise<VectorizeResponse>
}
