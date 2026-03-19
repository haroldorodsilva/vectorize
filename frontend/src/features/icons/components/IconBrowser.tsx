import { useState, useRef, useEffect, useCallback } from 'react'
import { Search, Loader2 } from 'lucide-react'
import { searchIcons, fetchIconSvg, COLLECTIONS, type IconResult } from '../api'
import type { useEditor } from '@/features/editor/hooks/useEditor'

interface IconBrowserProps {
  editorRef: ReturnType<typeof useEditor>
}

export function IconBrowser({ editorRef }: IconBrowserProps) {
  const [query, setQuery]       = useState('')
  const [prefix, setPrefix]     = useState<string | undefined>(undefined)
  const [results, setResults]   = useState<IconResult[]>([])
  const [loading, setLoading]   = useState(false)
  const [inserting, setInserting] = useState<string | null>(null)
  const debounce = useRef<ReturnType<typeof setTimeout>>()

  const doSearch = useCallback(async (q: string, p?: string) => {
    if (!q.trim()) { setResults([]); return }
    setLoading(true)
    try {
      const res = await searchIcons(q, 60, p)
      setResults(res)
    } catch { setResults([]) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    clearTimeout(debounce.current)
    debounce.current = setTimeout(() => doSearch(query, prefix), 300)
    return () => clearTimeout(debounce.current)
  }, [query, prefix, doSearch])

  const insertIcon = async (icon: IconResult) => {
    setInserting(icon.id)
    try {
      const svgText = await fetchIconSvg(icon.id)
      if (!svgText) return
      const svg = editorRef.getSvg()
      const vb  = editorRef.vbRef.current
      if (!svg || !vb) return

      // Parse the icon SVG and extract its inner content
      const parser = new DOMParser()
      const doc = parser.parseFromString(svgText, 'image/svg+xml')
      const iconSvg = doc.querySelector('svg')
      if (!iconSvg) return

      // Get icon viewBox for sizing
      const ivb = iconSvg.getAttribute('viewBox')?.split(/\s+/).map(Number) ?? [0, 0, 24, 24]
      const iw = ivb[2] || 24, ih = ivb[3] || 24

      // Scale icon to ~10% of canvas size
      const targetSize = Math.min(vb.w, vb.h) * 0.15
      const scale = targetSize / Math.max(iw, ih)

      // Create a group at canvas center
      const ns = 'http://www.w3.org/2000/svg'
      const g = document.createElementNS(ns, 'g')
      const cx = vb.x + vb.w / 2 - (iw * scale) / 2
      const cy = vb.y + vb.h / 2 - (ih * scale) / 2
      g.setAttribute('transform', `translate(${cx.toFixed(1)}, ${cy.toFixed(1)}) scale(${scale.toFixed(4)})`)
      g.setAttribute('data-region', String(Date.now()))
      g.setAttribute('data-drawn', '1')
      g.setAttribute('data-icon', icon.id)

      // Copy all children from the icon SVG
      for (const child of Array.from(iconSvg.children)) {
        const imported = document.importNode(child, true)
        g.appendChild(imported)
      }

      // If no fill is set, default to current color
      if (!g.getAttribute('fill')) g.setAttribute('fill', 'currentColor')

      svg.appendChild(g)
      editorRef.pushUndo(g, null)
    } finally {
      setInserting(null)
    }
  }

  return (
    <div className="space-y-2">
      {/* Search input */}
      <div className="relative">
        <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Buscar ícones…"
          className="w-full text-xs pl-7 pr-2 py-1.5 border border-gray-200 rounded-lg bg-white focus:border-blue-400 focus:outline-none"
        />
        {loading && <Loader2 size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-blue-400 animate-spin" />}
      </div>

      {/* Collection filter */}
      <div className="flex flex-wrap gap-1">
        <button
          onClick={() => setPrefix(undefined)}
          className={`text-[0.6rem] px-1.5 py-0.5 rounded-full border transition-colors ${
            !prefix ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
          }`}
        >Todos</button>
        {COLLECTIONS.map(c => (
          <button key={c.prefix}
            onClick={() => setPrefix(prefix === c.prefix ? undefined : c.prefix)}
            className={`text-[0.6rem] px-1.5 py-0.5 rounded-full border transition-colors ${
              prefix === c.prefix ? 'bg-blue-100 border-blue-300 text-blue-700' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
            }`}
          >{c.name}</button>
        ))}
      </div>

      {/* Results grid */}
      {results.length > 0 ? (
        <div className="grid grid-cols-6 gap-1 max-h-48 overflow-y-auto pr-0.5">
          {results.map(icon => (
            <button key={icon.id}
              onClick={() => insertIcon(icon)}
              disabled={inserting === icon.id}
              className="group relative aspect-square flex items-center justify-center rounded-lg border border-gray-100 hover:border-blue-400 hover:bg-blue-50 transition-colors p-1"
              title={icon.id}
            >
              {inserting === icon.id ? (
                <Loader2 size={16} className="text-blue-400 animate-spin" />
              ) : (
                <img
                  src={`https://api.iconify.design/${icon.prefix}/${icon.name}.svg`}
                  alt={icon.name}
                  className="w-full h-full object-contain"
                  loading="lazy"
                />
              )}
            </button>
          ))}
        </div>
      ) : query && !loading ? (
        <p className="text-xs text-gray-400 text-center py-2">Nenhum ícone encontrado.</p>
      ) : !query ? (
        <p className="text-xs text-gray-400 text-center py-2">Digite para buscar em {COLLECTIONS.reduce((s, c) => s + c.total, 0).toLocaleString()}+ ícones</p>
      ) : null}
    </div>
  )
}
