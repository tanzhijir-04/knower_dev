interface Scores {
  heat: number
  competition: number
  feasibility: number
  fit: number
  urgency: number
}

interface Props {
  scores: Scores
  size?: number
}

const dimensions = [
  { key: 'heat' as const, label: '热度', angle: -90 },
  { key: 'competition' as const, label: '竞争', angle: -18 },
  { key: 'feasibility' as const, label: '执行', angle: 54 },
  { key: 'fit' as const, label: '契合', angle: 126 },
  { key: 'urgency' as const, label: '时效', angle: 198 },
]

export default function TopicRadar({ scores, size = 180 }: Props) {
  if (!scores) return null
  const center = size / 2
  const maxR = size / 2 - 28
  const rings = [0.25, 0.5, 0.75, 1]

  const getPoint = (angle: number, ratio: number) => {
    const rad = (angle * Math.PI) / 180
    return {
      x: center + maxR * ratio * Math.cos(rad),
      y: center + maxR * ratio * Math.sin(rad),
    }
  }

  const polygonPoints = dimensions
    .map(d => {
      const raw = scores[d.key]
      // 竞争度反转：越低越好
      const val = d.key === 'competition' ? (100 - raw) / 100 : raw / 100
      const p = getPoint(d.angle, val)
      return `${p.x},${p.y}`
    })
    .join(' ')

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* 背景环 */}
      {rings.map(r => {
        const pts = dimensions.map(d => {
          const p = getPoint(d.angle, r)
          return `${p.x},${p.y}`
        }).join(' ')
        return (
          <polygon
            key={r}
            points={pts}
            fill="none"
            stroke="var(--color-hairline)"
            strokeWidth={0.5}
            opacity={0.4}
          />
        )
      })}

      {/* 轴线 */}
      {dimensions.map(d => {
        const p = getPoint(d.angle, 1)
        return (
          <line
            key={d.key}
            x1={center}
            y1={center}
            x2={p.x}
            y2={p.y}
            stroke="var(--color-hairline)"
            strokeWidth={0.5}
            opacity={0.3}
          />
        )
      })}

      {/* 数据多边形 */}
      <polygon
        points={polygonPoints}
        fill="var(--color-primary)"
        fillOpacity={0.15}
        stroke="var(--color-primary)"
        strokeWidth={1.5}
      />

      {/* 数据点 */}
      {dimensions.map(d => {
        const raw = scores[d.key]
        const val = d.key === 'competition' ? (100 - raw) / 100 : raw / 100
        const p = getPoint(d.angle, val)
        return (
          <circle
            key={d.key}
            cx={p.x}
            cy={p.y}
            r={3}
            fill="var(--color-primary)"
          />
        )
      })}

      {/* 标签 */}
      {dimensions.map(d => {
        const p = getPoint(d.angle, 1.18)
        const raw = scores[d.key]
        const displayVal = d.key === 'competition' ? 100 - raw : raw
        return (
          <g key={d.key}>
            <text
              x={p.x}
              y={p.y - 6}
              textAnchor="middle"
              className="fill-muted text-[10px]"
              style={{ fontSize: 10 }}
            >
              {d.label}
            </text>
            <text
              x={p.x}
              y={p.y + 6}
              textAnchor="middle"
              className="fill-ink text-[10px] font-medium"
              style={{ fontSize: 10 }}
            >
              {displayVal}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
