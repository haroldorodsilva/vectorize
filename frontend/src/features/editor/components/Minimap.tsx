import { useEffect, useRef } from 'react'
import type { useEditor } from '../hooks/useEditor'

interface MinimapProps {
  editorRef: ReturnType<typeof useEditor>
}

const SIZE = 120 // px

export function Minimap({ editorRef }: MinimapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>()

  useEffect(() => {
    const draw = () => {
      const canvas = canvasRef.current
      const svgEl = editorRef.getSvg()
      const vb = editorRef.vbRef.current
      if (!canvas || !svgEl || !vb) {
        rafRef.current = requestAnimationFrame(draw)
        return
      }

      const ctx = canvas.getContext('2d')
      if (!ctx) { rafRef.current = requestAnimationFrame(draw); return }

      // Canvas size
      const aspect = vb.w / vb.h
      const cw = aspect >= 1 ? SIZE : SIZE * aspect
      const ch = aspect >= 1 ? SIZE / aspect : SIZE
      if (canvas.width !== Math.round(cw)) canvas.width = Math.round(cw)
      if (canvas.height !== Math.round(ch)) canvas.height = Math.round(ch)

      ctx.clearRect(0, 0, cw, ch)

      // Draw white background
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, cw, ch)

      // Scale factor from SVG to minimap
      const sx = cw / vb.w
      const sy = ch / vb.h

      // Draw simplified versions of elements
      svgEl.querySelectorAll('[data-region]').forEach(el => {
        const r = el.getBoundingClientRect()
        const svgR = svgEl.getBoundingClientRect()
        const scX = vb.w / svgR.width, scY = vb.h / svgR.height

        const ex = (vb.x + (r.left - svgR.left) * scX - vb.x) * sx
        const ey = (vb.y + (r.top - svgR.top) * scY - vb.y) * sy
        const ew = r.width * scX * sx
        const eh = r.height * scY * sy

        const fill = el.getAttribute('fill') ?? '#cccccc'
        ctx.fillStyle = fill === 'none' ? 'transparent' : fill
        ctx.fillRect(ex, ey, ew, eh)
      })

      // Draw viewport indicator
      const boxEl = editorRef.boxRef.current
      if (boxEl) {
        const boxR = boxEl.getBoundingClientRect()
        const svgR = svgEl.getBoundingClientRect()
        const scX = vb.w / svgR.width, scY = vb.h / svgR.height

        const vpX = (vb.x + (boxR.left - svgR.left) * scX - vb.x) * sx
        const vpY = (vb.y + (boxR.top - svgR.top) * scY - vb.y) * sy
        const vpW = boxR.width * scX * sx
        const vpH = boxR.height * scY * sy

        ctx.strokeStyle = '#3b82f6'
        ctx.lineWidth = 1.5
        ctx.strokeRect(vpX, vpY, vpW, vpH)
      }

      // Border
      ctx.strokeStyle = '#e5e7eb'
      ctx.lineWidth = 1
      ctx.strokeRect(0, 0, cw, ch)

      rafRef.current = requestAnimationFrame(draw)
    }

    rafRef.current = requestAnimationFrame(draw)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [editorRef])

  return (
    <div className="absolute bottom-10 right-2 z-20 shadow-lg rounded-lg overflow-hidden border border-gray-200 bg-white/90 backdrop-blur-sm">
      <canvas ref={canvasRef} style={{ width: SIZE, height: SIZE }} />
    </div>
  )
}
