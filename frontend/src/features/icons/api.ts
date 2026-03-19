/**
 * Iconify API client — search and fetch SVG icons from 100+ open-source sets.
 * Collections: Phosphor, Material Design, Tabler, Feather, Lucide, etc.
 */

const API = 'https://api.iconify.design'

export interface IconResult {
  prefix: string
  name: string
  /** Full icon ID (prefix:name) */
  id: string
}

export interface IconCollection {
  prefix: string
  name: string
  total: number
}

/** Search icons by keyword across all collections */
export async function searchIcons(query: string, limit = 60, prefix?: string): Promise<IconResult[]> {
  if (!query.trim()) return []
  const params = new URLSearchParams({ query, limit: String(limit) })
  if (prefix) params.set('prefix', prefix)
  const res = await fetch(`${API}/search?${params}`)
  if (!res.ok) return []
  const data = await res.json()
  return (data.icons ?? []).map((id: string) => {
    const [pref, ...rest] = id.split(':')
    return { prefix: pref, name: rest.join(':'), id }
  })
}

/** Fetch a single icon's SVG markup */
export async function fetchIconSvg(id: string): Promise<string | null> {
  const [prefix, name] = id.split(':')
  if (!prefix || !name) return null
  const res = await fetch(`${API}/${prefix}/${name}.svg`)
  if (!res.ok) return null
  return res.text()
}

/** Get popular icon collections */
export const COLLECTIONS: IconCollection[] = [
  { prefix: 'ph', name: 'Phosphor', total: 9072 },
  { prefix: 'mdi', name: 'Material Design', total: 7447 },
  { prefix: 'tabler', name: 'Tabler', total: 5237 },
  { prefix: 'lucide', name: 'Lucide', total: 1548 },
  { prefix: 'carbon', name: 'Carbon', total: 2145 },
  { prefix: 'ri', name: 'Remix Icon', total: 2860 },
  { prefix: 'heroicons', name: 'Heroicons', total: 592 },
  { prefix: 'bi', name: 'Bootstrap', total: 1953 },
  { prefix: 'fa6-solid', name: 'Font Awesome', total: 1392 },
  { prefix: 'fluent', name: 'Fluent UI', total: 4625 },
]
