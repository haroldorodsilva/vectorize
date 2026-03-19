/**
 * Polygon / Star Tool — click-drag from center to create regular polygon or star.
 */

const NS = 'http://www.w3.org/2000/svg'

export function createPolygon(
  cx: number, cy: number, radius: number,
  sides: number, innerRadius: number, // 0 = regular polygon, >0 = star
  color: string,
): SVGPathElement {
  const el = document.createElementNS(NS, 'path') as SVGPathElement
  const points: Array<{ x: number; y: number }> = []
  const totalPoints = innerRadius > 0 ? sides * 2 : sides
  const angleStep = (2 * Math.PI) / totalPoints
  const startAngle = -Math.PI / 2 // Start from top

  for (let i = 0; i < totalPoints; i++) {
    const angle = startAngle + angleStep * i
    const r = (innerRadius > 0 && i % 2 === 1) ? radius * innerRadius : radius
    points.push({
      x: cx + Math.cos(angle) * r,
      y: cy + Math.sin(angle) * r,
    })
  }

  const r = (n: number) => Math.round(n * 100) / 100
  const d = points.map((p, i) =>
    `${i === 0 ? 'M' : 'L'} ${r(p.x)} ${r(p.y)}`
  ).join(' ') + ' Z'

  el.setAttribute('d', d)
  el.setAttribute('fill', color)
  el.setAttribute('stroke', color === '#FFFFFF' ? '#999' : 'none')
  el.setAttribute('stroke-width', '1')
  el.setAttribute('data-region', String(Date.now()))
  el.setAttribute('data-drawn', '1')
  return el
}
