/**
 * Tiny SVG sparkline used in the HUD.
 * Renders the last N data points as a filled area + stroke line.
 */
interface SparklineProps {
  data: number[]
  color: string
  width?: number
  height?: number
}

export function Sparkline({ data, color, width = 80, height = 28 }: SparklineProps) {
  if (data.length < 2) {
    return (
      <svg width={width} height={height}>
        <line x1={0} y1={height / 2} x2={width} y2={height / 2}
              stroke={color + '30'} strokeWidth={1} />
      </svg>
    )
  }

  const max = Math.max(...data, 1)
  const pts = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height - (v / max) * (height - 2) - 1
    return [x, y] as [number, number]
  })

  const linePath = pts.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  const fillPath = `${linePath} L${width},${height} L0,${height} Z`

  return (
    <svg width={width} height={height} style={{ display: 'block' }}>
      {/* Filled area */}
      <path d={fillPath} fill={color + '18'} />
      {/* Line */}
      <path d={linePath} fill="none" stroke={color} strokeWidth={1.5}
            strokeLinecap="round" strokeLinejoin="round" />
      {/* Latest value dot */}
      {pts.length > 0 && (
        <circle
          cx={pts[pts.length - 1][0]}
          cy={pts[pts.length - 1][1]}
          r={2.5}
          fill={color}
        />
      )}
    </svg>
  )
}
