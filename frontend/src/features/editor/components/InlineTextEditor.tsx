import { useState, useEffect, useRef } from 'react'
import type { useEditor } from '../hooks/useEditor'

interface InlineTextEditorProps {
  el: SVGTextElement
  containerRef: React.RefObject<HTMLDivElement | null>
  editorRef: ReturnType<typeof useEditor>
  onDone: () => void
}

export function InlineTextEditor({ el, containerRef, editorRef, onDone }: InlineTextEditorProps) {
  const [value, setValue] = useState(el.textContent ?? '')
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const savedText = useRef(el.textContent ?? '')

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  const commit = () => {
    const newText = value.trim()
    if (newText !== savedText.current) {
      editorRef.pushUndoAttrs(el, []) // We store text separately
      el.textContent = newText || savedText.current
    }
    onDone()
  }

  // Position the textarea over the text element
  const ctr = containerRef.current
  const er = el.getBoundingClientRect()
  const cr = ctr?.getBoundingClientRect()
  if (!cr) return null

  const left = er.left - cr.left
  const top = er.top - cr.top
  const fontSize = parseFloat(el.getAttribute('font-size') ?? '16')
  const fontFamily = el.getAttribute('font-family') ?? 'system-ui, sans-serif'
  const fill = el.getAttribute('fill') ?? '#000000'

  return (
    <textarea
      ref={inputRef}
      value={value}
      onChange={e => {
        setValue(e.target.value)
        el.textContent = e.target.value
      }}
      onKeyDown={e => {
        if (e.key === 'Escape') { el.textContent = savedText.current; onDone() }
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commit() }
      }}
      onBlur={commit}
      className="absolute z-30 bg-transparent border-2 border-blue-400 rounded outline-none resize-none overflow-hidden"
      style={{
        left,
        top: top - fontSize * 0.2,
        minWidth: Math.max(er.width + 20, 80),
        minHeight: fontSize * 1.5,
        fontSize: `${fontSize}px`,
        fontFamily,
        color: fill === '#FFFFFF' ? '#000' : fill,
        fontWeight: el.getAttribute('font-weight') ?? 'normal',
        lineHeight: 1.2,
        padding: '2px 4px',
      }}
    />
  )
}
