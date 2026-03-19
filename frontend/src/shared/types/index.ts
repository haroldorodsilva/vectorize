export interface ViewBox {
  x: number
  y: number
  w: number
  h: number
}

export interface Region {
  id: number
  area: number
  bbox: [number, number, number, number]
}

export interface VectorizeResponse {
  svg: string
  regions: Region[]
  width: number
  height: number
  processing_time_ms: number
}

export interface ColorMapEntry {
  cx: number
  cy: number
  color: string
}

export type UndoEntry =
  | { type: 'add';    el: Element }
  | { type: 'remove'; el: Element; parent: Element; before: Element | null }
  | { type: 'attrs';  el: Element; attrs: Array<[string, string | null]> }
