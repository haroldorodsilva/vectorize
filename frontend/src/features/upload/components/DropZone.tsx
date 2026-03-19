import { DragEvent, useRef, useState } from 'react'
import { useVectorizeStore } from '@/features/vectorize/store'

interface DropZoneProps {
  onFile: (file: File) => void
}

export function DropZone({ onFile }: DropZoneProps) {
  const [over, setOver] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const currentFile = useVectorizeStore(s => s.currentFile)

  const onDrop = (e: DragEvent) => {
    e.preventDefault(); setOver(false)
    const f = e.dataTransfer.files[0]
    if (f) onFile(f)
  }

  return (
    <div
      onClick={() => inputRef.current?.click()}
      onDragOver={e => { e.preventDefault(); setOver(true) }}
      onDragLeave={() => setOver(false)}
      onDrop={onDrop}
      className={`
        border-2 border-dashed rounded-xl px-8 py-10 text-center cursor-pointer
        transition-colors
        ${over ? 'border-blue-500 bg-blue-50' : 'border-gray-300 hover:border-blue-400 hover:bg-blue-50/40'}
      `}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*,.svg,image/svg+xml"
        className="hidden"
        onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f) }}
      />
      <div className="text-4xl mb-3">🖼</div>
      <p className="text-sm font-semibold mb-1">
        {currentFile ? currentFile.name : 'Clique ou arraste uma imagem'}
      </p>
      <p className="text-xs text-gray-400">PNG · JPG · WEBP · BMP · SVG — máx 20 MB</p>
    </div>
  )
}
