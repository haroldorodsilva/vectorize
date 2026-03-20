import { useState } from 'react'
import { Plus, X, Copy } from 'lucide-react'
import { cn } from '@/shared/lib/utils'

export interface PageDef {
  id: string
  name: string
  svgContent: string
}

interface PagesBarProps {
  pages: PageDef[]
  activePageIdx: number
  onSwitchPage: (idx: number) => void
  onAddPage: () => void
  onDeletePage: (idx: number) => void
  onDuplicatePage: (idx: number) => void
  onRenamePage: (idx: number, name: string) => void
}

export function PagesBar({
  pages, activePageIdx, onSwitchPage, onAddPage, onDeletePage, onDuplicatePage, onRenamePage,
}: PagesBarProps) {
  const [editingIdx, setEditingIdx] = useState<number | null>(null)
  const [editName, setEditName] = useState('')

  const startRename = (idx: number) => {
    setEditingIdx(idx)
    setEditName(pages[idx].name)
  }

  const commitRename = () => {
    if (editingIdx !== null && editName.trim()) {
      onRenamePage(editingIdx, editName.trim())
    }
    setEditingIdx(null)
  }

  return (
    <div className="h-8 bg-white border-t border-gray-200 flex items-center px-2 gap-1 overflow-x-auto shrink-0">
      {pages.map((page, i) => (
        <div key={page.id}
          className={cn(
            'flex items-center gap-1 px-2 py-1 rounded text-[0.65rem] cursor-pointer transition-colors shrink-0 group',
            i === activePageIdx
              ? 'bg-blue-100 text-blue-700 font-medium'
              : 'text-gray-500 hover:bg-gray-100',
          )}
          onClick={() => onSwitchPage(i)}
          onDoubleClick={() => startRename(i)}
        >
          {editingIdx === i ? (
            <input
              autoFocus
              value={editName}
              onChange={e => setEditName(e.target.value)}
              onBlur={commitRename}
              onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setEditingIdx(null) }}
              className="w-16 text-[0.65rem] border border-blue-300 rounded px-1 py-0 bg-white outline-none"
              onClick={e => e.stopPropagation()}
            />
          ) : (
            <span>{page.name}</span>
          )}
          {pages.length > 1 && (
            <button
              onClick={e => { e.stopPropagation(); onDeletePage(i) }}
              className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-opacity"
            >
              <X size={10} />
            </button>
          )}
          <button
            onClick={e => { e.stopPropagation(); onDuplicatePage(i) }}
            className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-blue-500 transition-opacity"
          >
            <Copy size={10} />
          </button>
        </div>
      ))}

      <button
        onClick={onAddPage}
        className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-blue-500 transition-colors shrink-0"
        title="Nova página"
      >
        <Plus size={14} />
      </button>
    </div>
  )
}
