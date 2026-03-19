import { useEffect, useState, useRef } from 'react'

interface Guide {
  type: 'h' | 'v'
  pos: number // screen px
}

interface SmartGuidesProps {
  containerRef: React.RefObject<HTMLDivElement | null>
  movingEls: Element[]
  allEls: Element[]
  enabled: boolean
}

const SNAP_THRESHOLD = 5 // pixels

/**
 * Smart alignment guides — shows colored lines when dragging elements
 * that align with edges/centers of other elements.
 */
export function SmartGuides({ containerRef, movingEls, allEls, enabled }: SmartGuidesProps) {
  const [guides, setGuides] = useState<Guide[]>([])
  const rafRef = useRef<number>()

  useEffect(() => {
    if (!enabled || movingEls.length === 0) {
      setGuides([])
      return
    }

    const update = () => {
      const ctr = containerRef.current
      if (!ctr) { rafRef.current = requestAnimationFrame(update); return }
      const cr = ctr.getBoundingClientRect()

      // Get bounding boxes of moving elements (combined)
      let mL = Infinity, mT = Infinity, mR = -Infinity, mB = -Infinity
      for (const el of movingEls) {
        const r = el.getBoundingClientRect()
        if (r.left < mL) mL = r.left
        if (r.top < mT) mT = r.top
        if (r.right > mR) mR = r.right
        if (r.bottom > mB) mB = r.bottom
      }
      const mCx = (mL + mR) / 2, mCy = (mT + mB) / 2

      const movingSet = new Set(movingEls)
      const newGuides: Guide[] = []

      // Check against all non-moving elements
      for (const el of allEls) {
        if (movingSet.has(el)) continue
        const r = el.getBoundingClientRect()
        const edges = [r.left, r.left + r.width / 2, r.right]
        const vEdges = [r.top, r.top + r.height / 2, r.bottom]
        const movingH = [mL, mCx, mR]
        const movingV = [mT, mCy, mB]

        // Horizontal alignment (vertical guide lines)
        for (const me of movingH) {
          for (const e of edges) {
            if (Math.abs(me - e) < SNAP_THRESHOLD) {
              newGuides.push({ type: 'v', pos: e - cr.left })
            }
          }
        }
        // Vertical alignment (horizontal guide lines)
        for (const me of movingV) {
          for (const e of vEdges) {
            if (Math.abs(me - e) < SNAP_THRESHOLD) {
              newGuides.push({ type: 'h', pos: e - cr.top })
            }
          }
        }
      }

      // Deduplicate guides (within 2px)
      const unique: Guide[] = []
      for (const g of newGuides) {
        if (!unique.some(u => u.type === g.type && Math.abs(u.pos - g.pos) < 2)) {
          unique.push(g)
        }
      }

      setGuides(unique)
      rafRef.current = requestAnimationFrame(update)
    }

    rafRef.current = requestAnimationFrame(update)
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      setGuides([])
    }
  }, [enabled, movingEls, allEls, containerRef])

  if (guides.length === 0) return null

  return (
    <div className="absolute inset-0 pointer-events-none z-[15]">
      {guides.map((g, i) => (
        <div
          key={`${g.type}-${i}`}
          className="absolute bg-pink-500"
          style={g.type === 'v'
            ? { left: g.pos, top: 0, width: 1, height: '100%', opacity: 0.6 }
            : { top: g.pos, left: 0, height: 1, width: '100%', opacity: 0.6 }
          }
        />
      ))}
    </div>
  )
}
