# Level Design

> MVP scope: **8 levels across Chapters 1–3**.
> Rule: each level introduces **exactly one new concept**.
> Reference: system-design-primer (local clone).
> Back to: [plan.md](plan.md)

---

## Design Rules

1. **One concept per level** — player should be able to name what they learned
2. **Forced failure first** — the starting state (or naive solution) must visibly fail
3. **Minimal component set** — only unlock what's needed for the current concept
4. **Budget as a constraint** — prevents brute-force solutions (just buy Large everything)
5. **Hints reveal, not solve** — each hint narrows the search space by one step

---

## Level JSON Schema (finalized)

```json
{
  "id": "string",
  "chapter": "number",
  "title": "string",
  "brief": "string",
  "concept": "string",
  "primer_ref": "string (section heading in README.md)",

  "traffic": {
    "base_rps": "number",
    "read_write_ratio": "number (0.0–1.0, fraction that are reads)",
    "pattern": "steady | ramp | spike",
    "spike_at_seconds": "number?",
    "spike_multiplier": "number?",
    "spike_duration_seconds": "number?",
    "working_set_gb": "number (hot data size, for cache hit rate)"
  },

  "requirements": {
    "max_p99_latency_ms": "number",
    "min_uptime_percent": "number (e.g. 99.0)",
    "max_monthly_cost_usd": "number",
    "hold_duration_seconds": "number (how long reqs must pass before win)"
  },

  "available_components": ["string"],
  "pre_placed": [{ "type": "string", "tier": "small|medium|large", "locked": "boolean" }],
  "failure_events": [{ "at_seconds": "number", "type": "string", "target": "string" }],

  "hints": ["string"],
  "win_message": "string",
  "tradeoff_warning": "string?"
}
```

**Win condition:** all `requirements` must hold simultaneously for `hold_duration_seconds`.
**Soft fail:** requirements breached → simulation continues, metrics shown, player iterates.
**Hard fail:** none for MVP — player can always pause, redesign, retry.

---

## Chapter 1 — The Basics

> Theme: Understand what a system is and where bottlenecks come from.
> Components unlocked: Traffic Source, Web Server, SQL DB

---

### Level 1 — "First Deploy"

**Concept:** Basic client → server → database architecture. Read the metrics.

**Brief:**
> Your side project just launched. 50 users are hitting it per second.
> Connect a web server to a database and keep things running smoothly.

**Traffic:**
```
base_rps: 50
read_write_ratio: 0.9
pattern: steady
working_set_gb: 1
```

**Available components:** `web_server`, `sql_db`

**Pre-placed:** Traffic Source (locked)

**Requirements:**
```
max_p99_latency_ms: 500
min_uptime_percent: 99.0
max_monthly_cost_usd: 300
hold_duration_seconds: 30
```

**Solution:** Small Web Server → Small SQL DB. Passes comfortably.

**Purpose:** Tutorial level. Teaches the canvas, connecting nodes, running simulation, reading per-node metrics. No failure — build confidence.

**Hints:**
1. "Drag a Web Server from the toolbar onto the canvas."
2. "Connect the Traffic Source to the Web Server, then the Web Server to the Database."
3. "Hit Run and watch the metrics appear on each node."

**Win message:** "Clean architecture. Watch the green numbers — that's your system breathing."

**Primer ref:** `## System design topics: start here`

---

### Level 2 — "Going Viral"

**Concept:** Identify a bottleneck. Upgrading the right component matters.

**Brief:**
> A blog post got picked up. Traffic jumped to 800 RPS overnight.
> Your current setup is struggling. Find what's breaking and fix it.

**Traffic:**
```
base_rps: 800
read_write_ratio: 0.9
pattern: steady
working_set_gb: 2
```

**Available components:** `web_server`, `sql_db`

**Pre-placed:** Small Web Server + Small SQL DB (both locked — player cannot remove, only upgrade)

**Requirements:**
```
max_p99_latency_ms: 200
min_uptime_percent: 99.0
max_monthly_cost_usd: 600
hold_duration_seconds: 30
```

**Failure at start:** Small DB is at ~80% utilization → p99 climbs to 400ms. Fails requirement.
Small Web Server is fine (only 40% utilized). This is intentional — player must read metrics
to identify *which* node is red, not just upgrade everything.

**Solution:** Upgrade SQL DB to Medium ($300/mo). Web Server stays Small. Total: $350/mo ✓

**Wrong path (teaches cost lesson):** upgrading Web Server first does nothing — DB stays red.

**Hints:**
1. "Check the color of each node — which one is under stress?"
2. "The database node is highlighted. Its queue depth is growing."
3. "Try upgrading the database tier."

**Win message:** "You found the bottleneck. The database was the weak link, not the server."

**Primer ref:** `## Performance vs scalability`

---

### Level 3 — "Cache Me If You Can"

**Concept:** A cache reduces database load. Hit rate is determined by cache size vs working set.

**Brief:**
> Traffic is now 1,500 RPS — mostly reads of the same popular content.
> Upgrading the database keeps getting more expensive. There's a smarter way.

**Traffic:**
```
base_rps: 1500
read_write_ratio: 0.95
pattern: steady
working_set_gb: 4
```

**Available components:** `web_server`, `sql_db`, `cache`

**Pre-placed:** Medium Web Server + Large SQL DB (locked)

**Requirements:**
```
max_p99_latency_ms: 100
min_uptime_percent: 99.0
max_monthly_cost_usd: 700
hold_duration_seconds: 30
```

**Failure at start:** Large SQL DB alone: $800/mo — over budget. Cannot brute-force.

**Solution:** Downgrade DB to Medium ($300) + add Cache Small ($30).
Small Cache (1GB) with 4GB working set → ~25% hit rate → DB load drops to 1,125 RPS.
Still too high. Medium Cache (8GB) → ~95% hit rate → DB load drops to 75 RPS ✓
Total: $300 + $100 = $400/mo ✓

**The "aha" moment:** player sees DB node go from red → green as cache size increases.
Cache node shows hit rate %. Player understands the relationship directly.

**Tradeoff warning (shown after win):**
> "Your cache is using cache-aside strategy. There's a window where data can be stale.
> For this read-heavy blog, that's fine. For financial data? Think again."

**Hints:**
1. "Upgrading the database is too expensive. What else can reduce the load on it?"
2. "A cache stores frequently-read data in memory. Connect it between server and database."
3. "Watch the cache's hit rate — a bigger cache covers more of your working set."

**Win message:** "80% of your traffic never reaches the database now. That's caching."

**Primer ref:** `## Cache`

---

## Chapter 2 — Scaling Up

> Theme: Handle more traffic by scaling horizontally, not just vertically.
> New components: Load Balancer

---

### Level 4 — "One Server Isn't Enough"

**Concept:** Horizontal scaling with a load balancer. Multiple instances share load.

**Brief:**
> You're at 3,000 RPS and a single web server is maxed out.
> Upgrading to a bigger server costs a fortune — and there's a ceiling.
> There's a better way: run more servers.

**Traffic:**
```
base_rps: 3000
read_write_ratio: 0.9
pattern: steady
working_set_gb: 8
```

**Available components:** `web_server`, `sql_db`, `cache`, `load_balancer`

**Pre-placed:** Medium Cache + Medium SQL DB (locked)

**Requirements:**
```
max_p99_latency_ms: 100
min_uptime_percent: 99.0
max_monthly_cost_usd: 800
hold_duration_seconds: 30
```

**Failure at start:** Single Large Web Server ($400) + existing nodes = $800/mo.
But Large Web Server maxes at 2,000 RPS — can't handle 3,000 RPS. Still fails.

**Solution:** Load Balancer Small ($20) + 2× Medium Web Server ($300) = $620/mo ✓
Each web server handles 1,500 RPS — well within limit.

**Algorithm lesson:** default Round Robin works fine. Player can experiment with Least Connections
— metrics show more even distribution. IP Hash shown as an option with tooltip explaining session affinity.

**Hints:**
1. "A single server has a physical ceiling. What if you ran two?"
2. "A Load Balancer distributes traffic across multiple servers."
3. "Place a Load Balancer between the Traffic Source and your web servers."
4. "Two Medium servers behind a load balancer can handle more than one Large server — at lower cost."

**Win message:** "Horizontal scaling: instead of a bigger box, use more boxes."

**Primer ref:** `## Load balancer` → `### Horizontal scaling`

---

### Level 5 — "Read Replicas"

**Concept:** Master-slave replication offloads reads from the primary database.

**Brief:**
> Read traffic is 4,000 RPS. Your database is the new bottleneck — again.
> But most of it is reads. Do all reads really need to hit the primary?

**Traffic:**
```
base_rps: 4000
read_write_ratio: 0.95
pattern: steady
working_set_gb: 20
```

**Available components:** `web_server`, `sql_db`, `cache`, `load_balancer`
*(SQL DB now has `replication_mode` policy unlocked)*

**Pre-placed:** Load Balancer + 2× Medium Web Server + Medium Cache (all locked)

**Requirements:**
```
max_p99_latency_ms: 80
min_uptime_percent: 99.5
max_monthly_cost_usd: 1000
hold_duration_seconds: 30
```

**Failure at start:** Large SQL DB alone handles reads but p99 still 120ms under load. Over budget if you just upgrade.

**Solution:** Medium SQL DB (master, writes only) + Medium SQL DB (replica, reads only).
Set replication_mode = `master_slave` on master. Route reads to replica, writes to master.
Cache sits in front of replica for reads → hit rate 60% (20GB working set, 8GB cache).
Effective read load on replica: 4,000 × 0.95 × 0.4 = 1,520 RPS ✓

**Tradeoff warning (shown after win):**
> "Your replica is ~100ms behind the master. Users might read slightly stale data.
> For a social feed, acceptable. For account balances, think carefully."

**Hints:**
1. "The primary database is overwhelmed. Can you split reads and writes?"
2. "Enable replication on the database — create a replica node."
3. "Route write traffic to the master and read traffic to the replica."
4. "Add a cache in front of the replica to further reduce its load."

**Win message:** "Reads and writes separated. Your master only takes the hard hits now."

**Primer ref:** `### Master-slave replication` → `### Replication`

---

## Chapter 3 — Reliability

> Theme: Systems fail. Design for uptime, not just performance.
> New components: (none new — reliability comes from topology, not new parts)

---

### Level 6 — "Don't Go Down"

**Concept:** Single points of failure. Redundancy and failover.

**Brief:**
> It's 2am. Your web server crashes. Everything goes down.
> Your SLA promises 99.9% uptime — that's less than 9 hours of downtime per year.
> A single server can't make that promise.

**Traffic:**
```
base_rps: 1000
read_write_ratio: 0.9
pattern: steady
working_set_gb: 5
```

**Available components:** `web_server`, `sql_db`, `cache`, `load_balancer`

**Pre-placed:** Single Small Web Server + Small SQL DB (locked, deliberately fragile)

**Failure event:**
```
at_seconds: 20
type: node_crash
target: web_server_1
duration_seconds: 30
```

**Requirements:**
```
max_p99_latency_ms: 200
min_uptime_percent: 99.9
max_monthly_cost_usd: 700
hold_duration_seconds: 60
```

**Failure at start:** Server crashes at t=20s → 30s of 100% errors → uptime drops to ~50%. Fails.

**Solution:** Load Balancer + 2× Small Web Server.
When server 1 crashes at t=20s, LB health check detects failure and routes to server 2.
Downtime = 1 health check interval (default 5s) → uptime = 99.9% ✓

**Secondary lesson:** health_check_interval matters.
Player can reduce it to 1s → even faster failover. Tooltip: "Shorter interval = faster recovery, but more health check traffic."

**Tradeoff warning:**
> "The database is still a single point of failure. In a real system, you'd replicate it too.
> That's the next challenge."

**Hints:**
1. "Watch the uptime percentage drop when the server fails."
2. "If one server fails, traffic needs somewhere else to go."
3. "A Load Balancer can detect failed servers and stop sending traffic to them."
4. "Add a second web server — the load balancer will failover automatically."

**Win message:** "N+1 redundancy: always have one more than you need."

**Primer ref:** `## Availability patterns` → `### Fail-over`

---

### Level 7 — "The Spike"

**Concept:** Rate limiting protects backend systems during traffic spikes.

**Brief:**
> You're running a flash sale. Traffic spikes 10× for 30 seconds.
> Your infrastructure can handle 1,000 RPS. The spike hits 10,000.
> You can't scale fast enough — but you can protect what you have.

**Traffic:**
```
base_rps: 500
read_write_ratio: 0.85
pattern: spike
spike_at_seconds: 30
spike_multiplier: 20
spike_duration_seconds: 30
working_set_gb: 5
```

**Available components:** `web_server`, `sql_db`, `cache`, `load_balancer`, `rate_limiter`

**Pre-placed:** Load Balancer + 2× Medium Web Server + Medium Cache + Medium SQL DB

**Requirements:**
```
max_p99_latency_ms: 300
min_uptime_percent: 99.0
max_monthly_cost_usd: 900
hold_duration_seconds: 90
```

**Failure at start:** Spike hits → 10,000 RPS → all nodes overwhelmed → cascade failure → uptime 60%. Fails.

**Solution:** Rate Limiter ($10) placed before Load Balancer. Set `rps_limit = 1000`.
During spike: excess 9,000 RPS → 429 errors (rejected cleanly, not cascade failure).
Backend stays healthy. Uptime: 99%+ ✓. p99 for accepted requests: normal ✓.

**Algorithm lesson:**
- `token_bucket` — allows short bursts, some users get through
- `sliding_window` — strict limit, fair but no bursts
- `leaky_bucket` — smooths traffic, shows queue filling up

**Tradeoff warning:**
> "You rejected 90% of traffic during the spike. Those were real users.
> Rate limiting protects your system but doesn't solve the capacity problem.
> In production: combine with auto-scaling and a queue to absorb demand."

**Hints:**
1. "The spike overwhelms everything at once — a cascade failure."
2. "You can't add capacity fast enough. Can you limit how much traffic enters?"
3. "A Rate Limiter rejects excess requests with a 429 error before they reach your servers."
4. "Set the limit to what your backend can handle: ~1,000 RPS."

**Win message:** "Graceful degradation: some users get a 429. Zero users get a 500."

**Primer ref:** `## Availability patterns` → `### Back pressure`

---

### Level 8 — "Write Storm"

**Concept:** Message queues decouple heavy write workloads from the database.

**Brief:**
> Your app now processes user events — every click, view, and action is recorded.
> Write traffic is 800 RPS. Your database can't keep up.
> Writes don't need to be instant. Can you make them async?

**Traffic:**
```
base_rps: 2000
read_write_ratio: 0.6
pattern: steady
working_set_gb: 10
```

**Available components:** `web_server`, `sql_db`, `cache`, `load_balancer`, `message_queue`, `worker`

**Pre-placed:** Load Balancer + 2× Medium Web Server + Medium Cache (locked)

**Requirements:**
```
max_p99_latency_ms: 80
min_uptime_percent: 99.0
max_monthly_cost_usd: 1000
hold_duration_seconds: 30
```

**Failure at start:** 800 writes/sec directly to Large SQL DB → write latency 40ms × overload → p99 climbs to 300ms. Fails.

**Solution:**
- Web servers send writes → Message Queue (Medium, $80)
- 2× Medium Worker ($200) pull from queue, write to DB at their own pace
- Effective write rate to DB: 2 × 200 rps = 400 rps — within DB capacity
- DB (Medium, $300) handles 400 writes + 400 cache-miss reads comfortably
- p99 for web requests: 30ms (reads from cache) ✓

**Delivery guarantee lesson:**
- `at_most_once` — fast, but events can be lost
- `at_least_once` — safe, but duplicates possible (tooltip: "idempotent writes needed")
- `exactly_once` — safest, slowest

**Tradeoff warning:**
> "Writes are now asynchronous — there's a delay between user action and DB write.
> A user who writes data might not immediately read it back.
> This is eventual consistency. For analytics events: fine. For bank transfers: not fine."

**Hints:**
1. "Writes are blocking your entire database. What if they didn't need to be immediate?"
2. "A Message Queue holds write requests until the database is ready to process them."
3. "Workers pull from the queue and write to the database at a controlled rate."
4. "With 2 workers at 200 rps each, you can process 400 writes per second — without overwhelming the DB."

**Win message:** "Async writes: your users get a fast response. The database does the work later."

**Primer ref:** `## Asynchronism` → `### Message queues` → `### Back pressure`

---

## Level Progression Summary

| # | Title | Concept | New Component | Chapter |
|---|---|---|---|---|
| 1 | First Deploy | Basic architecture, reading metrics | Web Server, SQL DB | 1 |
| 2 | Going Viral | Identify bottleneck, upgrade right node | — | 1 |
| 3 | Cache Me If You Can | Caching, hit rate, working set | Cache | 1 |
| 4 | One Server Isn't Enough | Horizontal scaling, load balancer | Load Balancer | 2 |
| 5 | Read Replicas | Master-slave replication, read/write split | DB replication | 2 |
| 6 | Don't Go Down | SPOF, failover, health checks | — | 3 |
| 7 | The Spike | Rate limiting, graceful degradation | Rate Limiter | 3 |
| 8 | Write Storm | Async writes, message queue, workers | Queue + Worker | 3 |

---

## Components Unlocked Per Chapter

```
Chapter 1 (Levels 1–3):  Traffic Source, Web Server, SQL DB, Cache
Chapter 2 (Levels 4–5):  + Load Balancer, DB replication mode
Chapter 3 (Levels 6–8):  + Rate Limiter, Message Queue, Worker
```

CDN, NoSQL DB, and multi-region components are reserved for Chapters 4–6 (post-MVP).

---

## Open Questions (Level Design)

- [ ] **Post-MVP chapters (4–8):** NoSQL, sharding, CDN, CAP theorem, real architectures — design later
- [ ] **Tutorial overlay:** Level 1 needs guided tooltips for first-time players (arrow, highlight)
- [ ] **Level select screen:** chapter map or linear unlock?
- [ ] **Star rating criteria:** e.g. 3 stars = meets all requirements AND under 80% of budget
- [ ] **Tradeoff follow-up puzzles:** after Level 3 win, optional challenge "now handle stale data"
