# System Design Game — Project Framework (MECE)

> Objective: A visual puzzle game where players learn system design by building and
> simulating real architectures on a node-based canvas.
> Reference material: system-design-primer (local clone)

---

## 1. Simulation Engine

> The core logic layer. Runs independently from the UI.

### 1.1 DES (Discrete Event Simulation) Core
- Event queue (min-heap priority queue, sorted by sim-time)
- Simulation clock + tick loop (`requestAnimationFrame` driven)
- Speed control: pause / 1x / 5x / 10x
- Request lifecycle: created → enqueued → processed → forwarded / dropped
- Metrics collector: aggregates per-node stats each tick

### 1.2 Request / Event Model
- `Request` object: `{ id, type: read|write, createdAt, path[] }`
- `SimEvent` object: `{ time, nodeId, request }`
- Traffic generator: produces requests at configured RPS (Poisson distribution or fixed)
- Error event type: dropped request, timeout, node failure

### 1.3 Component Models
> Full specification: **[component-models.md](component-models.md)**

Each component implements `SimNode`: receives a request, returns forwarded events with timestamps.

| Component       | Key Parameters                              | Simulated Behavior                              |
|-----------------|---------------------------------------------|-------------------------------------------------|
| Traffic Source  | rps, read/write ratio, burst pattern        | Generates requests; can inject spikes           |
| Load Balancer   | algorithm, max_connections, health_check_ms | Distributes to backends; detects failures       |
| Web Server      | max_concurrent, base_latency_ms, cpu_cores  | Queues requests; latency grows under load       |
| SQL Database    | read_qps, write_qps, replication_lag_ms     | Serializes writes; degrades under write load    |
| NoSQL Database  | read_qps, write_qps, consistency_model      | Faster writes; no transactions                  |
| Cache           | hit_rate, max_memory, eviction_policy       | Hit = fast path; miss = falls through to DB     |
| CDN             | cache_hit_rate, regions[]                   | Serves static content; reduces origin load      |
| Message Queue   | throughput_rps, consumer_count, retention   | Decouples producer/consumer; smooths spikes     |
| Rate Limiter    | rps_limit, algorithm (token/leaky/sliding)  | Drops or queues excess requests                 |
| Worker / Consumer | processing_time_ms, concurrency           | Pulls from queue; processes async jobs          |

### 1.4 Inter-Component Interactions (Emergent Behaviors)
- Cache miss rate → DB load → DB latency → overall p99
- Load balancer health check → failed server → failover routing
- Queue back-pressure → producer slow-down
- DB replication lag → stale reads on replica
- Cascading failure: overloaded node drops requests → upstream queue grows

### 1.5 Failure Injection
- Scripted (per-level): traffic spike, node crash, network partition
- Chaos mode (advanced): random failures injected during simulation

---

## 2. Canvas / UI Layer

> The visual layer. React Flow owns the graph; simulation state drives visual feedback.

### 2.1 React Flow Graph
- Custom node components per component type (WebServerNode, DBNode, etc.)
- Custom edge components (directional, animated on packet flow)
- Node placement from Toolbar (drag-and-drop from palette)
- Edge drawing: connect nodes by dragging handles
- Node configuration panel: click node → sidebar to edit parameters
- Read-only mode during simulation; editable when paused

### 2.2 Packet Animation Layer
- Separate `<canvas>` or SVG overlay on top of React Flow
- Moving dots along edges representing in-flight requests
- Color-coded: green (normal), yellow (slow), red (error/dropped)
- Driven by `animationEvents` emitted by the simulation engine

### 2.3 Node Visual Feedback
- Node border/background color changes with load: green → yellow → red
- Metrics overlay on each node: current QPS, latency, queue depth
- "Bottleneck" pulse animation when a node is overloaded
- "Down" state visual when a node has failed

### 2.4 Metrics / HUD Panel
- Global metrics: total throughput (RPS), p99 latency, error rate, monthly cost
- Win condition tracker: shows which requirements are met / not met
- Real-time graph (sparkline) for throughput and latency over time
- Requirements card: displays the level's constraints (e.g. "< 100ms p99, 99.9% uptime")

### 2.5 Toolbar / Component Palette
- List of available components for the current level (locked/unlocked)
- Drag from palette to canvas to place
- Cost badge on each component (teaches cost awareness)

---

## 3. Level / Mission Design

> Content layer. Defines what the player must build and what they learn.

### 3.1 Level Structure (JSON schema)
```json
{
  "id": "level-01",
  "title": "...",
  "brief": "...",
  "requirements": { "max_p99_latency_ms": 200, "min_uptime": 0.999, "max_cost_usd": 500 },
  "traffic": { "base_rps": 100, "read_write_ratio": 0.9, "spike_events": [] },
  "available_components": ["web_server", "sql_db"],
  "locked_components": [],
  "failure_events": [],
  "hints": [],
  "solution_reference": "..."
}
```

### 3.2 Progression Chapters (mapped from system-design-primer)
> Full level specifications: **[levels.md](levels.md)**


| Chapter | Theme                  | New Concepts Introduced                              |
|---------|------------------------|------------------------------------------------------|
| 1       | The Basics             | Single server, single DB — find the bottleneck       |
| 2       | Scaling Up             | Caching, load balancer, horizontal scaling           |
| 3       | Reliability            | Replication, failover, health checks, availability   |
| 4       | Data at Scale          | DB sharding, federation, denormalization, NoSQL      |
| 5       | Async & Decoupling     | Message queues, workers, back pressure               |
| 6       | Global Scale           | CDN, DNS, multi-region, latency vs consistency       |
| 7       | Distributed Tradeoffs  | CAP theorem, consistency models, eventual consistency|
| 8       | Real Architectures     | "Design Twitter feed", "Design a payment system"     |

### 3.3 Level Win / Fail Conditions
- **Win**: all requirements in the brief are satisfied for N continuous seconds of simulation
- **Soft fail**: requirements not met → simulation continues, player iterates
- **Hard fail**: budget exceeded, or a mandatory SLA breach occurs
- **Star rating**: 1–3 stars based on how well the solution exceeds requirements

### 3.4 Learning Scaffolding
- Hint system: optional hints that reveal one step at a time
- "Why did I fail?" post-simulation analysis panel
- Reference link to system-design-primer section after completing each level
- Concept tooltip on hover for every component

---

## 4. Game Design

> The player experience layer.

### 4.1 Core Loop
```
Read brief → Place components → Connect graph → Run simulation
     ↑                                                  ↓
  Iterate  ←──── See bottleneck / failure ←──── Metrics feedback
```

### 4.2 Economy / Progression
- Each component has a monthly cost (reflects real cloud pricing roughly)
- Budget constraint per level teaches cost-aware design
- Completing levels unlocks new component types for future levels
- Optional: "efficiency score" rewards using fewer/cheaper components

### 4.3 Tradeoff Teaching Moments
- Adding cache → hit latency drops, but introduce stale data warning
- Adding replicas → availability improves, but write complexity warning
- Choosing NoSQL → write throughput improves, but no-transaction warning
- Each tradeoff surfaces as an in-game notification / follow-up challenge

### 4.4 Narrative Framing (TBD)
- Player is an engineer at a startup scaling from 0 to millions of users
- Each chapter = a growth phase of the company
- Simple story beats between chapters (optional, not core)

---

## 5. Technical Architecture

> The implementation layer.

### 5.1 Tech Stack
- **Language**: TypeScript (strict mode)
- **UI framework**: React
- **Node graph**: React Flow
- **State management**: Zustand
- **Build tool**: Vite
- **Testing**: Vitest (unit tests for simulation engine)

### 5.2 Project Structure
```
src/
  engine/
    SimulationEngine.ts      ← DES core, event queue, tick loop
    EventQueue.ts            ← min-heap priority queue
    types.ts                 ← Request, SimEvent, NodeMetrics interfaces
    nodes/                   ← one file per component model
      WebServer.ts
      LoadBalancer.ts
      Database.ts
      Cache.ts
      MessageQueue.ts
      CDN.ts
      RateLimiter.ts
      TrafficSource.ts
  canvas/
    GameCanvas.tsx           ← React Flow wrapper
    AnimationLayer.tsx       ← canvas overlay for moving packets
    nodes/                   ← custom React Flow node components
      WebServerNode.tsx
      DatabaseNode.tsx
      ...
  levels/
    level-01.json
    level-02.json
    ...
  store/
    simulationStore.ts       ← Zustand: bridges engine ↔ UI
  ui/
    HUD.tsx                  ← metrics panel, win/loss tracker
    Toolbar.tsx              ← component palette
    ConfigPanel.tsx          ← node configuration sidebar
    MetricsChart.tsx         ← sparkline charts
  levels/
    LevelLoader.ts           ← parses level JSON, sets up engine
```

### 5.3 Engine ↔ UI Bridge
```
SimulationEngine.tick()
  → emits: NodeMetrics (per node), AnimationEvents (packet positions)
  → written to: Zustand simulationStore
  → React components re-render from store (React Flow nodes, HUD, charts)
```

---

## 6. Missing Parts (To Be Discussed)

The following areas are **not yet defined** and need decisions before or during development:

### 6.1 Simulation Engine
- [x] Exact traffic model: **Poisson arrivals**
- [x] Latency model: **S-curve degradation** (shared formula, tuned constants per component)
- [x] Round-trip vs one-way: **one-way for MVP**
- [x] Replication lag: **separate delayed write event to replicas**
- [x] Network latency between nodes: **zero for MVP; added in Chapter 6 levels**

### 6.2 Component Models ✅ → see [component-models.md](component-models.md)
- [x] Full parameter list and default values for all 10 components
- [x] Load Balancer algorithms: Round Robin / Least Connections / IP Hash
- [x] Cache eviction policies: LRU / LFU / TTL
- [x] Database ACID model: SQL serializes writes; NoSQL allows concurrent writes
- [x] Tiers vs sliders: **Tiers (Small / Medium / Large)**
- [x] Multiple instances: **yes, player can place N; capacity sums linearly**

### 6.3 Level Design ✅ → see [levels.md](levels.md)
- [x] Level count for MVP: **8 levels across Chapters 1–3**
- [x] Level JSON schema finalized
- [x] Win condition: **all requirements hold for `hold_duration_seconds` simultaneously**
- [x] Hints: **3–4 per level, each narrows search space by one step, never gives full solution**
- [x] Component unlock order: Ch1 (Web Server, DB, Cache) → Ch2 (LB, replication) → Ch3 (Rate Limiter, Queue, Worker)

### 6.4 Game Design
- [ ] Narrative: do we have a story, or pure puzzle?
- [ ] Undo / redo on canvas during edit mode
- [ ] Save / load player progress (localStorage for MVP)
- [ ] Level select / chapter map screen
- [ ] Onboarding / tutorial level design
- [ ] Sound design (in scope?)
- [ ] Art style / visual design direction for nodes and UI

### 6.5 Technical
- [ ] Packet animation performance: max simultaneous animated packets?
- [ ] How fast can the DES run? (1000 RPS × 10 nodes = 10,000 events/sec — is this fine in JS?)
- [ ] Mobile support or desktop-only?
- [ ] Deployment target: hosted web app, Electron desktop, or both?
- [ ] Testing strategy for simulation engine (unit test each component model)
- [ ] Level editor tool (needed to author more levels efficiently)

### 6.6 Content
- [ ] Map system-design-primer sections to specific levels (needs detailed pass)
- [ ] Real-world numbers: latency benchmarks, cost estimates per component
- [ ] "Real architecture" levels (chapter 8) — which companies/systems to model?

---

## Proposed Next Steps

1. ~~**Finalize component models**~~ ✅ → [component-models.md](component-models.md)
2. ~~**Design levels 1–8**~~ ✅ → [levels.md](levels.md)
3. **Build engine MVP** — DES core + 3 components (WebServer, DB, Cache) + TrafficSource
4. **Build canvas MVP** — React Flow + 3 custom nodes + basic metrics HUD
5. **Wire together** — Zustand store bridge, first playable level
6. **Iterate** — add components, add levels, tune simulation numbers
