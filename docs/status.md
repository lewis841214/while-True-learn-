# System Design Game – Current Status & Next Steps

_Last updated: February 28, 2026_

---

## Current Status

- **Engine & core models**
  - Discrete event simulation engine implemented (`SimulationEngine` + `EventQueue`).
  - Core node types wired and working: `TrafficSource`, `WebServer`, `SqlDatabase`, `Cache`, `LoadBalancer`, `RateLimiter`, `MessageQueue`, `Worker`.
  - Pull-based queue model in place (`MessageQueue.tick()` emits events) and `Worker` nodes act as the real bottleneck/consumer tier.
  - Load balancer failover notifications implemented (engine notifies LBs on node crash/recovery).

- **UI & gameplay loop**
  - React Flow canvas + custom `ComponentNode` with per-node metrics and lock state.
  - Toolbar palette restricted per-level via `availableComponents`.
  - HUD with global metrics (RPS, p99, uptime, cost) and requirements card.
  - Packet animation layer (canvas overlay) visualising in-flight requests with colour-coded dots.
  - Sparklines for RPS and p99 in the HUD using a rolling metrics history.

- **Levels & progression**
  - Demo + **Levels 1–8** implemented as `LevelDefinition`s, covering basics, scaling, caching, failover, and async queues/workers.
  - Per-level layouts defined in `App.tsx` (initial nodes/edges + locked nodes).
  - Hold-to-win mechanic wired: requirements must be met continuously for `holdDurationSeconds`.
  - Throughput guard added (`minThroughputRps`) so you can’t win with zero traffic flowing.

- **Meta-game & learning aids**
  - Chapter map modal showing all scenarios, grouped by chapter, with star ratings (based on hints used).
  - Local progress persistence via `localStorage` (`sysdesign-progress-v1`).
  - Win banner includes deep links into `system-design-primer` sections per level (`primerRef`).

- **Quality**
  - **Vitest** suite green (22/22 tests) for the engine and scenarios.
  - **ESLint** clean for `game/` after custom rules (ignore `_`-prefixed unused vars).
  - Manual browser tests confirm all 8 levels load correctly and no longer trigger React’s “maximum update depth exceeded” error.

---

## What’s Next (Short Term)

- **Tune levels & numbers**
  - Playtest and adjust traffic, capacities, and budgets so each level has a clear “aha” moment without being too brittle.
  - Refine Level 7–8 async / queue scenarios to better demonstrate trade-offs (throughput vs dropped writes vs latency).

- **UX polish**
  - Add lightweight onboarding copy / mini-tutorial on Level 1 (what do the colours, metrics, and requirements mean).
  - Improve error / guidance messaging when requirements are close but not yet met (e.g. “DB write capacity is the bottleneck”).

- **Editor & authoring ergonomics**
  - Factor level layouts out of `App.tsx` into separate data files to make authoring and diffing levels easier.
  - Add a simple in-app “dev overlay” for showing raw metrics (e.g. per-node throughput/utilisation tables) while tuning.

---

## What’s Next (Medium Term)

- **New components & chapters**
  - Implement NoSQL DB + CDN nodes and design a small Chapter 4 around read-heavy / global scenarios.
  - Add more advanced rate limiting and backpressure scenarios (global vs per-tenant limits, sliding-window behaviour).

- **Deeper analytics**
  - Introduce per-level “post-mortem” panel: request timelines, where drops happened, and which nodes limited throughput.
  - Expose simple charts for per-node utilisation over time to make bottlenecks easier to see than just snapshots.

- **Productionisation**
  - Replace the template `game/README.md` with a project-specific readme (install, run, test, contribute).
  - Set up CI for lint + tests on every push/PR.

