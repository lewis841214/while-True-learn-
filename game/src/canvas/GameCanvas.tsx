import { useCallback, useEffect, useRef } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type Connection,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

import { ComponentNode } from './nodes/ComponentNode'
import { AnimationLayer } from './AnimationLayer'
import { useSimStore } from '../store/simulationStore'
import type { CanvasNode } from '../store/simulationStore'
import type { GraphEdge, NodeConfig, NodeType, Tier } from '../engine/types'

// Register custom node types
const nodeTypes = {
  componentNode: ComponentNode,
}

// Convert our CanvasNode to React Flow node shape
function toRFNode(n: CanvasNode): Node {
  return {
    id: n.id,
    type: 'componentNode',
    position: n.position,
    data: n.data as unknown as Record<string, unknown>,
  }
}

// Convert GraphEdge → React Flow Edge
function toRFEdge(e: GraphEdge): Edge {
  return {
    id: e.id,
    source: e.sourceNodeId,
    target: e.targetNodeId,
    animated: true,
    style: { stroke: '#818cf8', strokeWidth: 2 },
  }
}

function shallowEqual(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  const keysA = Object.keys(a)
  const keysB = Object.keys(b)
  if (keysA.length !== keysB.length) return false
  for (const k of keysA) {
    if (a[k] !== b[k]) return false
  }
  return true
}

let nodeCounter = 0
function newNodeId() { return `node-${++nodeCounter}` }

interface Props {
  initialNodes?: CanvasNode[]
  initialEdges?: GraphEdge[]
}

export function GameCanvas({ initialNodes = [], initialEdges = [] }: Props) {
  const { setCanvasNodes, setCanvasEdges, isRunning } = useSimStore()

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>(
    initialNodes.map(toRFNode)
  )
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(
    initialEdges.map(toRFEdge)
  )

  const storeNodes = useSimStore(s => s.canvasNodes)

  // Snapshot the store node count at mount time so we can tell when the
  // toolbar adds a genuinely new node (count increases) vs the initial
  // render / level-switch churn.
  const lastStoreCountRef = useRef(storeNodes.length)
  // Track what we last wrote to the store so Effect 2 can skip echo writes.
  const lastWrittenRef = useRef<string>('')

  // Effect 1: Store → RF  (new toolbar nodes + config/tier changes)
  //
  // Runs when storeNodes changes.  Two responsibilities:
  //   a) Inject nodes that were added via the Toolbar (present in store but
  //      not in React Flow).
  //   b) Push data changes (tier, algorithm, locked, monthlyCostUsd …) from
  //      store into existing RF nodes so the config panel works.
  //
  // Must return `prev` unchanged when nothing meaningful differs, otherwise
  // React Flow's setState would trigger Effect 2, creating a loop.
  useEffect(() => {
    setNodes(prev => {
      const prevIds = new Set(prev.map(n => n.id))
      let changed = false

      // (b) Update data on existing RF nodes
      const updated = prev.map(rfNode => {
        const sNode = storeNodes.find(s => s.id === rfNode.id)
        if (!sNode) return rfNode
        const cur = rfNode.data as unknown as Record<string, unknown>
        const next = sNode.data as unknown as Record<string, unknown>
        if (shallowEqual(cur, next)) return rfNode
        changed = true
        return { ...rfNode, data: next }
      })

      // (a) Only inject truly NEW nodes (toolbar adds).  Ignore store nodes
      //     left over from a previous level that haven't been cleaned up yet.
      if (storeNodes.length > lastStoreCountRef.current) {
        const newRFNodes = storeNodes.filter(s => !prevIds.has(s.id)).map(toRFNode)
        if (newRFNodes.length > 0) {
          changed = true
          lastStoreCountRef.current = storeNodes.length
          return [...updated, ...newRFNodes]
        }
      }
      lastStoreCountRef.current = storeNodes.length

      return changed ? [...updated] : prev
    })
  }, [storeNodes, setNodes])

  // Effect 2: RF → Store  (positions + deletions)
  //
  // Runs when RF nodes change (drag, delete, initial mount).
  // Writes positions and the current node list back to the store so the
  // engine sees the latest topology.
  //
  // To avoid re-triggering Effect 1, we skip the write when the serialized
  // node list hasn't changed since our last write.
  useEffect(() => {
    const fingerprint = nodes.map(n => `${n.id}:${n.position.x}:${n.position.y}`).join('|')
    if (fingerprint === lastWrittenRef.current) return
    lastWrittenRef.current = fingerprint

    setCanvasNodes(nodes.map(n => ({
      id: n.id,
      type: n.type ?? 'componentNode',
      position: n.position,
      data: n.data as unknown as NodeConfig & { label: string },
    })))
  }, [nodes, setCanvasNodes])

  // React Flow → Store: sync edges (add/delete) back to store.
  // This also captures the initialEdges on first render.
  useEffect(() => {
    const graphEdges: GraphEdge[] = edges.map(e => ({
      id: e.id,
      sourceNodeId: e.source,
      targetNodeId: e.target,
    }))
    setCanvasEdges(graphEdges)
  }, [edges, setCanvasEdges])

  const onConnect = useCallback(
    (connection: Connection) => {
      if (isRunning) return
      const newEdge: Edge = {
        ...connection,
        id: `edge-${connection.source}-${connection.target}`,
        animated: true,
        style: { stroke: '#818cf8', strokeWidth: 2 },
      }
      setEdges(eds => addEdge(newEdge, eds))
    },
    [isRunning, setEdges]
  )

  return (
    <div style={{ width: '100%', height: '100%' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        nodesDraggable={!isRunning}
        nodesConnectable={!isRunning}
        deleteKeyCode="Delete"
        fitView
        colorMode="dark"
      >
        <Background color="#334155" gap={20} />
        <Controls />
        <MiniMap
          nodeColor={() => '#818cf8'}
          style={{ background: '#0f172a' }}
        />
        <AnimationLayer />
      </ReactFlow>
    </div>
  )
}

// ─── Toolbar / component palette ─────────────────────────────────────────────

const PALETTE_ITEMS: Array<{ type: NodeType; tier: Tier; label: string; cost: number }> = [
  { type: 'web_server',    tier: 'small',  label: 'Web Server (S)',   cost: 50  },
  { type: 'web_server',    tier: 'medium', label: 'Web Server (M)',   cost: 150 },
  { type: 'web_server',    tier: 'large',  label: 'Web Server (L)',   cost: 300 },
  { type: 'sql_db',        tier: 'small',  label: 'SQL DB (S)',       cost: 100 },
  { type: 'sql_db',        tier: 'medium', label: 'SQL DB (M)',       cost: 300 },
  { type: 'nosql_db',      tier: 'small',  label: 'NoSQL DB (S)',     cost: 80  },
  { type: 'nosql_db',      tier: 'medium', label: 'NoSQL DB (M)',     cost: 200 },
  { type: 'nosql_db',      tier: 'large',  label: 'NoSQL DB (L)',     cost: 600 },
  { type: 'cache',         tier: 'small',  label: 'Cache (1 GB)',     cost: 30  },
  { type: 'cache',         tier: 'medium', label: 'Cache (8 GB)',     cost: 100 },
  { type: 'cache',         tier: 'large',  label: 'Cache (64 GB)',    cost: 200 },
  { type: 'cdn',           tier: 'small',  label: 'CDN (S)',          cost: 20  },
  { type: 'cdn',           tier: 'medium', label: 'CDN (M)',          cost: 60  },
  { type: 'load_balancer', tier: 'small',  label: 'Load Balancer',    cost: 50  },
  { type: 'message_queue', tier: 'small',  label: 'Queue (S)',        cost: 30  },
  { type: 'message_queue', tier: 'medium', label: 'Queue (M)',        cost: 80  },
  { type: 'worker',        tier: 'small',  label: 'Worker (S)',       cost: 50  },
  { type: 'worker',        tier: 'medium', label: 'Worker (M)',       cost: 150 },
  { type: 'worker',        tier: 'large',  label: 'Worker (L)',       cost: 400 },
  { type: 'rate_limiter',  tier: 'small',  label: 'Rate Limiter',     cost: 10  },
]

export function Toolbar() {
  const { setCanvasNodes, canvasNodes, isRunning, level } = useSimStore()
  const available = level?.availableComponents ?? []

  const addNode = (item: typeof PALETTE_ITEMS[0]) => {
    if (isRunning) return
    const id = newNodeId()
    const cfg: NodeConfig & { label: string } = {
      id,
      type: item.type,
      tier: item.tier,
      label: item.label,
      monthlyCostUsd: item.cost,
    }
    const newNode: CanvasNode = {
      id,
      type: 'componentNode',
      position: { x: 200 + nodeCounter * 37 % 200, y: 100 + nodeCounter * 61 % 200 },
      data: cfg,
    }
    setCanvasNodes([...canvasNodes, newNode])
  }

  return (
    <div style={{
      width: 180,
      background: '#0f172a',
      borderRight: '1px solid #1e293b',
      padding: 12,
      display: 'flex',
      flexDirection: 'column',
      gap: 8,
      overflowY: 'auto',
    }}>
      <div style={{ color: '#64748b', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>
        Components
      </div>
      {PALETTE_ITEMS.filter(i => available.includes(i.type)).map(item => (
        <button
          key={`${item.type}-${item.tier}`}
          onClick={() => addNode(item)}
          disabled={isRunning}
          style={{
            background: '#1e293b',
            border: '1px solid #334155',
            borderRadius: 6,
            color: '#e2e8f0',
            padding: '8px 10px',
            textAlign: 'left',
            cursor: isRunning ? 'not-allowed' : 'pointer',
            opacity: isRunning ? 0.5 : 1,
            fontSize: 12,
          }}
        >
          <div>{item.label}</div>
          <div style={{ color: '#64748b', fontSize: 10 }}>${item.cost}/mo</div>
        </button>
      ))}
    </div>
  )
}
