import { useEffect, useRef } from 'react'
import type { useEditor } from '../hooks/useEditor'

interface GridOverlayProps {
  editorRef: ReturnType<typeof useEditor>
  gridSize: number
}

/**
 * Renders a CSS-based grid overlay that scales with zoom/pan.
 * Uses the same coordinate system as the SVG "page".
 */
export function GridOverlay({ editorRef, gridSize }: GridOverlayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>()

  useEffect(() => {
    const draw = () => {
      const canvas = canvasRef.current
      const svgEl = editorRef.getSvg()
      const ctr = canvas?.parentElement
      if (!canvas || !svgEl || !ctr) {
        rafRef.current = requestAnimationFrame(draw)
        return
      }

      const cr = ctr.getBoundingClientRect()
      const sr = svgEl.getBoundingClientRect()

      // Match canvas to container size
      if (canvas.width !== cr.width || canvas.height !== cr.height) {
        canvas.width = cr.width
        canvas.height = cr.height
      }

      const ctx = canvas.getContext('2d')
      if (!ctx) { rafRef.current = requestAnimationFrame(draw); return }
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      const vb = editorRef.vbRef.current
      if (!vb) { rafRef.current = requestAnimationFrame(draw); return }

      // SVG-space grid spacing mapped to screen pixels
      const scaleX = sr.width / vb.w
      const scaleY = sr.height / vb.h
      const stepPx = gridSize * scaleX
      const stepPy = gridSize * scaleY

      if (stepPx < 4 || stepPy < 4) {
        // Grid too dense, skip
        rafRef.current = requestAnimationFrame(draw)
        return
      }

      // Offset from SVG origin to container
      const offX = sr.left - cr.left
      const offY = sr.top - cr.top

      // Grid lines within SVG bounds
      const startX = offX % stepPx
      const startY = offY % stepPy

      ctx.strokeStyle = 'rgba(0, 120, 255, 0.12)'
      ctx.lineWidth = 0.5
      ctx.beginPath()

      // Vertical lines
      for (let x = startX; x <= offX + sr.width; x += stepPx) {
        if (x >= offX && x <= offX + sr.width) {
          ctx.moveTo(x, Math.max(0, offY))
          ctx.lineTo(x, Math.min(canvas.height, offY + sr.height))
        }
      }

      // Horizontal lines
      for (let y = startY; y <= offY + sr.height; y += stepPy) {
        if (y >= offY && y <= offY + sr.height) {
          ctx.moveTo(Math.max(0, offX), y)
          ctx.lineTo(Math.min(canvas.width, offX + sr.width), y)
        }
      }

      ctx.stroke()
      rafRef.current = requestAnimationFrame(draw)
    }

    rafRef.current = requestAnimationFrame(draw)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [editorRef, gridSize])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none z-[5]"
    />
  )
}
