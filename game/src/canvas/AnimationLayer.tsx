import { useRef, useEffect } from 'react'
import { useNodes, useStore } from '@xyflow/react'
import { useSimStore } from '../store/simulationStore'

// Max simultaneous packets — prevents perf issues at high RPS
const MAX_PACKETS = 300

interface Packet {
  key: number
  fromX: number; fromY: number
  toX:   number; toY:   number
  startMs: number
  durationMs: number
  color: string
}

let _seq = 0

/**
 * Canvas overlay that draws animated packets moving along edges.
 * Must be rendered as a child of <ReactFlow> to access the RF context
 * (useNodes, useStore for viewport transform).
 *
 * Color coding:
 *   green  (#22c55e) — normal read
 *   amber  (#f59e0b) — write
 *   red    (#ef4444) — dropped
 */
export function AnimationLayer() {
  const canvasRef  = useRef<HTMLCanvasElement>(null)
  const packetsRef = useRef<Packet[]>([])

  const animationEvents = useSimStore(s => s.animationEvents)
  const isRunning       = useSimStore(s => s.isRunning)

  // React Flow internal state for node positions + viewport
  const nodes    = useNodes()
  const [tx, ty, zoom] = useStore(s => s.transform)

  // ─── Convert new animation events → packets ─────────────────────────────────

  useEffect(() => {
    if (!animationEvents.length || !isRunning) return

    const now = performance.now()

    for (const evt of animationEvents) {
      const fromNode = nodes.find(n => n.id === evt.fromNodeId)
      const toNode   = nodes.find(n => n.id === evt.toNodeId)
      if (!fromNode || !toNode) continue

      const fw = fromNode.measured?.width  ?? 130
      const fh = fromNode.measured?.height ?? 70
      const tw = toNode.measured?.width    ?? 130
      const th = toNode.measured?.height   ?? 70

      // Flow → screen coords (canvas is absolutely positioned inside RF container)
      const fromX = (fromNode.position.x + fw / 2) * zoom + tx
      const fromY = (fromNode.position.y + fh / 2) * zoom + ty
      const toX   = (toNode.position.x   + tw / 2) * zoom + tx
      const toY   = (toNode.position.y   + th / 2) * zoom + ty

      const color = evt.dropped
        ? '#ef4444'
        : evt.type === 'write'
          ? '#f59e0b'
          : '#22c55e'

      packetsRef.current.push({
        key: _seq++,
        fromX, fromY, toX, toY,
        // Use now as start so every packet gets its full animation window
        startMs: now,
        durationMs: evt.durationMs,
        color,
      })
    }

    // Drop oldest packets when over the cap
    if (packetsRef.current.length > MAX_PACKETS) {
      packetsRef.current = packetsRef.current.slice(-MAX_PACKETS)
    }
  }, [animationEvents, isRunning, nodes, tx, ty, zoom])

  // ─── Resize canvas to match parent ──────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const parent = canvas.parentElement
    if (!parent) return

    const sync = () => {
      canvas.width  = parent.offsetWidth
      canvas.height = parent.offsetHeight
    }
    sync()

    const ro = new ResizeObserver(sync)
    ro.observe(parent)
    return () => ro.disconnect()
  }, [])

  // ─── Draw loop ──────────────────────────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let rafId: number

    const draw = () => {
      const ctx = canvas.getContext('2d')
      if (!ctx) { rafId = requestAnimationFrame(draw); return }

      ctx.clearRect(0, 0, canvas.width, canvas.height)

      const now = performance.now()

      packetsRef.current = packetsRef.current.filter(p => {
        const raw = (now - p.startMs) / p.durationMs
        if (raw >= 1) return false

        // Ease in-out cubic
        const t = raw < 0.5 ? 4 * raw * raw * raw : 1 - Math.pow(-2 * raw + 2, 3) / 2
        const x = p.fromX + (p.toX - p.fromX) * t
        const y = p.fromY + (p.toY - p.fromY) * t

        // Outer glow
        ctx.beginPath()
        ctx.arc(x, y, 6, 0, Math.PI * 2)
        ctx.fillStyle = p.color + '30'
        ctx.fill()

        // Core dot
        ctx.beginPath()
        ctx.arc(x, y, 3, 0, Math.PI * 2)
        ctx.fillStyle = p.color
        ctx.fill()

        return true
      })

      rafId = requestAnimationFrame(draw)
    }

    rafId = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(rafId)
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        pointerEvents: 'none',
        zIndex: 5,
      }}
    />
  )
}
