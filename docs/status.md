# Project Status

> Last updated: 2026-02-28

---

## What Has Been Built

### Simulation Engine (`game/src/engine/`)

| Component | File | What it does |
|---|---|---|
| Discrete Event Simulation | `SimulationEngine.ts` | Event queue, sim clock, speed multiplier (1×/5×/10×), failure injection, win condition |
| TrafficSource | `nodes/TrafficSource.ts` | Generates reads/writes at configured RPS; supports steady / ramp / spike patterns |
| WebServer | `nodes/WebServer.ts` | 500/2k/8k RPS tiers; S-curve latency degradation |
| LoadBalancer | `nodes/LoadBalancer.ts` | Round-robin / least-connections / IP-hash; health-check + failover |
| SqlDatabase | `nodes/SqlDatabase.ts` | Separate read/write capacity pools; write contention degrades reads |
| NoSqlDatabase | `nodes/NoSqlDatabase.ts` | 5k/25k/100k RPS; no write-read contention; flat latency |
| Cache | `nodes/Cache.ts` | Working-set-aware hit rate; LRU/LFU/TTL eviction; write-through / write-behind |
| CdnNode | `nodes/CdnNode.ts` | 50k–5M RPS; 80/90/95% read hit rate at edge (2–5ms); writes pass through |
| MessageQueue | `nodes/MessageQueue.ts` | Pull-based buffer; tick()-driven drain at configured throughput; backpressure visible via queueDepth |
| Worker | `nodes/Worker.ts` | Rate-limited consumer; drops excess when overloaded |
| RateLimiter | `nodes/RateLimiter.ts` | Token-bucket; configurable RPS ceiling; fast 429 rejection |

**Win condition:** All of `p99 ≤ max`, `uptime ≥ min`, `cost ≤ max`, `throughputRps ≥ min` must hold simultaneously for `holdDurationSeconds`.  
**Uptime** only starts counting once traffic is flowing (prevents trivial 100%-uptime wins on an empty graph).

---

### React UI (`game/src/`)

| Component | Purpose |
|---|---|
| `canvas/GameCanvas.tsx` | React Flow canvas; bidirectional Zustand ↔ RF sync (infinite-loop-safe via `fromStoreRef` + `shallowEqual`) |
| `canvas/AnimationLayer.tsx` | SVG overlay of moving packets on edges; color-coded by type (green=read, amber=write, red=dropped) |
| `canvas/nodes/ComponentNode.tsx` | Node card with live utilisation color, latency, queue depth, delete button |
| `ui/HUD.tsx` | Sim controls, global metrics, sparkline charts, SidePanel with level brief / hints / win banner |
| `ui/ConfigPanel.tsx` | Click-to-configure any node: tier selector with costs/specs, LB algorithm picker, live metrics |
| `ui/ChapterMap.tsx` | Full-screen level select modal; chapters colored by group; star ratings from localStorage |
| `ui/MetricsChart.tsx` | Reusable SVG sparkline (filled area + stroke line + latest-value dot) |
| `store/simulationStore.ts` | Zustand store; bridges engine snapshots to React; captures `animationEvents` and 60-sample `metricsHistory` |
| `store/progress.ts` | localStorage persistence: win flag, hints used, sim time; 3-star rating |

---

### Levels

#### Chapter 1 — Basics (Levels 1–3)

| # | Title | Core concept |
|---|---|---|
| 1 | First Request | Wire src → web → db; basic topology |
| 2 | Scale the Database | Upgrade DB tier when write capacity is the bottleneck |
| 3 | Cache the Hot Path | Add cache + downgrade expensive DB to meet budget |

#### Chapter 2 — Scale (Levels 4–6)

| # | Title | Core concept |
|---|---|---|
| 4 | Load Balancer | Add LB + multiple web servers for horizontal scale |
| 5 | Rate Limiting | Add rate limiter to protect backend from abuse |
| 6 | Failover | Add LB + standby web server to survive node crash |

#### Chapter 3 — Async (Levels 7–8)

| # | Title | Core concept |
|---|---|---|
| 7 | Write Queue | Message queue decouples write producers from the DB |
| 8 | Worker Pool | Workers throttle queue drain rate; DB protected from storm |

#### Chapter 4 — Data at Scale (Levels 9–11)

| # | Title | Core concept |
|---|---|---|
| 9 | Writes Don't Scale | SQL → NoSQL swap for write-heavy workloads |
| 10 | Shard Your Database | LB in front of 3 SQL shards as a query router |
| 11 | Cache or Pay | Cut monthly cost by adding cache + downgrading oversized tiers |

#### Chapter 5 — Async Patterns Deep (Levels 12–14)

| # | Title | Core concept |
|---|---|---|
| 12 | The Slow Consumer | Back-pressure: scale worker pool to drain the queue |
| 13 | Fan-Out | Pub/sub: MQ broadcasts to 3 independent consumer pipelines |
| 14 | Dead Letters | Worker crash + DLQ; redundant consumers prevent data loss |

#### Chapter 6 — Global Scale (Levels 15–16)

| # | Title | Core concept |
|---|---|---|
| 15 | The Edge | CDN absorbs 80% of static reads before hitting origin |
| 16 | Second Region | Read replicas close to APAC users; async replication lag tradeoff |

#### Chapter 7 — Reliability at Scale (Levels 17–18)

| # | Title | Core concept |
|---|---|---|
| 17 | Database Failover | Primary DB crash; read replica + rate limiter maintain uptime |
| 18 | Graceful Degradation | Traffic spike; rate limiter fast-fails (429) rather than timing out |

#### Chapter 8 — Capstone (Levels 19–20)

| # | Title | Core concept |
|---|---|---|
| 19 | URL Shortener | Open-canvas design; optimise for read-heavy, low-latency redirects |
| 20 | Social Feed | Open-canvas design; spike + fan-out; CDN + cache + async write path |

---

## Test Results

- **22 engine unit tests** — all pass (`npx vitest run`)
- **Levels 1–20 browser tests** — all load without crash; simulation runs; metrics update
- **TypeScript** — `tsc --noEmit --skipLibCheck` exits 0 (2 pre-existing issues in `vite.config.ts` and `BaseNode.ts` are unrelated to game logic)

---

## What Is Next

### Short-term (gameplay polish)

| Item | Notes |
|---|---|
| Tutorial overlay for Level 1 | Arrow + highlight tooltips guiding first-time players |
| Star-rating display in LevelBar | Show ★★★ inline next to each won level |
| Win → next-level auto-advance | After win banner, offer "Next Level →" button |
| Hint cost feedback | Show how many hints were used in the win banner |

### Medium-term (engine features)

| Item | Notes |
|---|---|
| Network partition event | New `FailureEvent` type that disconnects edges, enabling CAP theorem levels |
| Per-node write multiplier | Fan-out amplification model needed for Level 20 celebrity post scenario |
| Consistency mode on DB nodes | `strong` vs `eventual` config that affects latency + availability tradeoffs |
| Read replica lag visualisation | Show replication lag as a metric on NoSQL/replica nodes |

### Long-term (content)

| Item | Notes |
|---|---|
| Levels 21+ | Beyond the current 20: consensus protocols, CRDT, global transactions |
| Mobile layout | Current UI assumes desktop width |
| Leaderboard | Compare star ratings / completion time |
| Share topology | Export graph as URL or JSON for community sharing |

---

## Repository Layout

```
while-True-learn-/
├── docs/
│   ├── plan.md        # Original design document
│   ├── levels.md      # Full level design spec (Levels 1–20 + post-MVP 21+)
│   └── status.md      # This file
└── game/
    ├── src/
    │   ├── engine/
    │   │   ├── SimulationEngine.ts
    │   │   ├── EventQueue.ts
    │   │   ├── nodes/          # BaseNode + all 10 node types
    │   │   └── __tests__/      # 22 unit tests
    │   ├── canvas/
    │   │   ├── GameCanvas.tsx  # React Flow canvas + Toolbar
    │   │   ├── AnimationLayer.tsx
    │   │   └── nodes/ComponentNode.tsx
    │   ├── levels/
    │   │   ├── level-demo.ts
    │   │   └── level-01.ts … level-20.ts
    │   ├── store/
    │   │   ├── simulationStore.ts
    │   │   └── progress.ts
    │   └── ui/
    │       ├── HUD.tsx
    │       ├── ConfigPanel.tsx
    │       ├── ChapterMap.tsx
    │       └── MetricsChart.tsx
    ├── package.json
    └── vite.config.ts
```
