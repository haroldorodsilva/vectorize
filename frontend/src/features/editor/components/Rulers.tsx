import { useEffect, useRef } from 'react'
import type { useEditor } from '../hooks/useEditor'

interface RulersProps {
  editorRef: ReturnType<typeof useEditor>
}

const RULER_SIZE = 20 // px
const TICK_COLOR = '#9ca3af'
const TEXT_COLOR = '#6b7280'
const BG_COLOR = '#f9fafb'

/**
 * Canvas rulers (top + left) showing SVG coordinate measurements.
 */
export function Rulers({ editorRef }: RulersProps) {
  const topRef = useRef<HTMLCanvasElement>(null)
  const leftRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number>()

  useEffect(() => {
    const draw = () => {
      const svgEl = editorRef.getSvg()
      const vb = editorRef.vbRef.current
      const topC = topRef.current
      const leftC = leftRef.current

      if (!svgEl || !vb || !topC || !leftC) {
        rafRef.current = requestAnimationFrame(draw)
        return
      }

      const svgR = svgEl.getBoundingClientRect()
      const topP = topC.parentElement!
      const pR = topP.getBoundingClientRect()

      // Resize canvases
      const tw = pR.width, th = RULER_SIZE
      const lw = RULER_SIZE, lh = pR.height
      if (topC.width !== tw) topC.width = tw
      if (topC.height !== th) topC.height = th
      if (leftC.width !== lw) leftC.width = lw
      if (leftC.height !== lh) leftC.height = lh

      const scaleX = svgR.width / vb.w
      const scaleY = svgR.height / vb.h
      const offX = svgR.left - pR.left
      const offY = svgR.top - pR.top

      // Choose tick interval based on zoom
      const baseInterval = pickInterval(scaleX)

      // ── Top ruler ──
      const tCtx = topC.getContext('2d')!
      tCtx.clearRect(0, 0, tw, th)
      tCtx.fillStyle = BG_COLOR
      tCtx.fillRect(0, 0, tw, th)

      tCtx.strokeStyle = TICK_COLOR
      tCtx.fillStyle = TEXT_COLOR
      tCtx.font = '9px system-ui'
      tCtx.textAlign = 'center'

      const startSvgX = vb.x - offX / scaleX
      const firstTick = Math.ceil(startSvgX / baseInterval) * baseInterval

      for (let svgX = firstTick; ; svgX += baseInterval) {
        const px = offX + (svgX - vb.x) * scaleX
        if (px > tw) break
        if (px < 0) continue

        const isMajor = svgX % (baseInterval * 5) === 0
        tCtx.beginPath()
        tCtx.moveTo(px, isMajor ? 0 : th * 0.5)
        tCtx.lineTo(px, th)
        tCtx.lineWidth = isMajor ? 1 : 0.5
        tCtx.stroke()

        if (isMajor) {
          tCtx.fillText(String(Math.round(svgX)), px, 10)
        }
      }

      // ── Left ruler ──
      const lCtx = leftC.getContext('2d')!
      lCtx.clearRect(0, 0, lw, lh)
      lCtx.fillStyle = BG_COLOR
      lCtx.fillRect(0, 0, lw, lh)

      lCtx.strokeStyle = TICK_COLOR
      lCtx.fillStyle = TEXT_COLOR
      lCtx.font = '9px system-ui'
      lCtx.textAlign = 'right'

      const startSvgY = vb.y - offY / scaleY
      const firstTickY = Math.ceil(startSvgY / baseInterval) * baseInterval

      for (let svgY = firstTickY; ; svgY += baseInterval) {
        const py = offY + (svgY - vb.y) * scaleY
        if (py > lh) break
        if (py < 0) continue

        const isMajor = svgY % (baseInterval * 5) === 0
        lCtx.beginPath()
        lCtx.moveTo(isMajor ? 0 : lw * 0.5, py)
        lCtx.lineTo(lw, py)
        lCtx.lineWidth = isMajor ? 1 : 0.5
        lCtx.stroke()

        if (isMajor) {
          lCtx.save()
          lCtx.translate(10, py)
          lCtx.rotate(-Math.PI / 2)
          lCtx.textAlign = 'center'
          lCtx.fillText(String(Math.round(svgY)), 0, 0)
          lCtx.restore()
        }
      }

      rafRef.current = requestAnimationFrame(draw)
    }

    rafRef.current = requestAnimationFrame(draw)
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }
  }, [editorRef])

  return (
    <>
      {/* Top ruler */}
      <canvas
        ref={topRef}
        className="absolute top-0 left-0 w-full pointer-events-none z-[6]"
        style={{ height: RULER_SIZE }}
      />
      {/* Left ruler */}
      <canvas
        ref={leftRef}
        className="absolute top-0 left-0 h-full pointer-events-none z-[6]"
        style={{ width: RULER_SIZE }}
      />
      {/* Corner square */}
      <div
        className="absolute top-0 left-0 z-[7] pointer-events-none"
        style={{ width: RULER_SIZE, height: RULER_SIZE, background: BG_COLOR, borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb' }}
      />
    </>
  )
}

function pickInterval(scale: number): number {
  const pixelPer10 = 10 * scale
  if (pixelPer10 > 40) return 10
  if (pixelPer10 > 8) return 50
  return 100
}
