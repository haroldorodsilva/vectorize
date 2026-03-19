import { z } from 'zod'

export const controlsSchema = z.object({
  mode:      z.enum(['lineart', 'icon', 'vtracer', 'deep_edges']).default('lineart'),
  threshold: z.coerce.number().int().min(80).max(210).default(170),
  dilate:    z.coerce.number().int().min(1).max(6).default(1),
  minArea:   z.coerce.number().int().min(1).max(500).default(10),
  // vtracer params
  vtColormode:       z.enum(['color', 'binary']).default('color'),
  vtFilterSpeckle:   z.coerce.number().int().min(1).max(16).default(4),
  vtColorPrecision:  z.coerce.number().int().min(1).max(8).default(6),
  vtLayerDifference: z.coerce.number().int().min(0).max(256).default(16),
  vtCornerThreshold: z.coerce.number().int().min(0).max(180).default(60),
  vtSpliceThreshold: z.coerce.number().int().min(0).max(180).default(45),
})

export type ControlsValues = z.infer<typeof controlsSchema>
