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

---

## Chapter 4 — Data at Scale

> Theme: A single database can't store or serve everything. Learn to split, distribute, and choose the right storage engine.
> New components: **NoSQL DB**

---

### Level 9 — "Writes Don't Scale"

**Concept:** SQL databases serialise writes behind a single lock. When write throughput hits that ceiling, NoSQL engines offer higher write capacity — at the cost of ACID guarantees.

**Brief:**
> Your analytics pipeline records every click, view, and scroll.
> 2,400 writes per second. Your SQL database is choking.
> The data doesn't need strict consistency — it just needs to be written fast.

**Traffic:**
```
base_rps:          3,000
read_write_ratio:  0.20   (80% writes)
pattern:           steady
working_set_gb:    50
```

**Available components:** `sql_db`, `nosql_db`, `cache`

**Pre-placed:** Load Balancer + 2× Medium Web Server + Medium SQL DB (all locked)

**Requirements:**
```
max_p99_latency_ms:    80
min_uptime_percent:    99.0
max_monthly_cost_usd:  900
hold_duration_seconds: 30
```

**NoSQL DB tiers (new component):**

| Tier   | Read cap    | Write cap   | Latency | Cost/mo |
|--------|-------------|-------------|---------|---------|
| Small  | 5,000 RPS   | 5,000 RPS   | 15 ms   | $80     |
| Medium | 25,000 RPS  | 25,000 RPS  | 8 ms    | $200    |
| Large  | 100,000 RPS | 100,000 RPS | 5 ms    | $600    |

**Failure at start:** Medium SQL DB write cap = 2,000 RPS. Actual writes = 2,400 RPS → queue fills → p99 climbs to 400 ms. Fails.

**Wrong path (teaches cost lesson):** Upgrade SQL to Large ($800) — nearly at budget, p99 barely dips below 80 ms. Player learns: brute-force scaling SQL has diminishing returns.

**Solution:** Replace Medium SQL DB with Medium NoSQL DB ($200/mo).
NoSQL write cap 25,000 RPS → 2,400 writes land with 8 ms latency → p99 < 80 ms ✓
Cost: $20 LB + $600 web + $200 NoSQL = $820/mo ✓

**Tradeoff warning (shown after win):**
> "NoSQL doesn't support JOINs or multi-row transactions. If two writes must succeed or fail together — a debit and a credit — you need SQL. For independent analytics events, NoSQL is the right tool."

**Hints:**
1. "Watch the SQL database — its write queue is filling up. What is its write capacity?"
2. "SQL serialises writes through a single lock. Not all databases work this way."
3. "A NoSQL database (Cassandra, DynamoDB) trades ACID guarantees for far higher write throughput."
4. "Swap the SQL DB for a NoSQL DB — analytics events don't need transactions."

**Win message:** "NoSQL sacrifices ACID for throughput. For analytics, that's the right trade."

**Primer ref:** `## NoSQL`

---

### Level 10 — "One Database, One Bottleneck"

**Concept:** Horizontal sharding splits a table across N database instances. Each shard owns a partition of the key space, so write and read capacity scales linearly with the shard count.

**Brief:**
> Your user table has 200 GB of data and 100 million rows.
> A single database — no matter how big — can't absorb 6,000 RPS.
> You need to split the table across multiple instances.

**Traffic:**
```
base_rps:          6,000
read_write_ratio:  0.50
pattern:           steady
working_set_gb:    200
```

**Available components:** `sql_db`, `nosql_db`, `cache`

**Pre-placed:** Load Balancer + 3× Medium Web Server + Medium SQL DB (all locked)

**Requirements:**
```
max_p99_latency_ms:    80
min_uptime_percent:    99.5
max_monthly_cost_usd:  2,000
hold_duration_seconds: 30
```

**Failure at start:** Medium SQL DB write cap = 2,000 RPS. Actual writes = 3,000 RPS → saturated → p99 > 300 ms.

**Solution:** Add 2 more Medium SQL DBs (shards). 3 shards × 2,000 RPS each = 6,000 total capacity.
The web servers route by `user_id % 3`; each shard receives ~1,000 writes/sec ✓
Total DB cost: 3 × $300 = $900. Full cost: $20 LB + $450 web + $900 DB = $1,370/mo ✓

**Tradeoff warning:**
> "Queries that span shards — 'find all users who logged in yesterday' — must scatter to all 3 shards and be aggregated in your application. No cross-shard JOINs. Sharding forces your query patterns to match your partition key."

**Hints:**
1. "One database can't absorb 3,000 writes/sec. What if you had three databases sharing the load?"
2. "Sharding splits your data by key — users A–F on shard 1, G–M on shard 2, N–Z on shard 3."
3. "Add two more SQL DB instances. Traffic is distributed across all three by user ID."
4. "Each shard now handles 1/3 of the data and 1/3 of the traffic."

**Win message:** "Horizontal scaling applies to databases too: three shards, three times the capacity."

**Primer ref:** `## Sharding`

---

### Level 11 — "The Hot Partition"

**Concept:** Uneven access concentrates traffic on one shard while the others sit idle — a hot partition. The fix is smarter key design, not more hardware.

**Brief:**
> You sharded your product catalogue by category ID.
> "Electronics" gets 80% of all queries.
> That shard is overloaded. The other two are barely touched.
> You have three shards — but effectively only one.

**Traffic:**
```
base_rps:          3,000
read_write_ratio:  0.80
pattern:           steady
working_set_gb:    30
```

**Available components:** `sql_db`, `nosql_db`, `cache`

**Pre-placed:**
- Load Balancer + 2× Medium Web Server (locked)
- Shard 1 (Electronics, 80% traffic, 2,400 RPS): Small SQL DB — locked, overloaded
- Shard 2 (Clothing, 10%, 300 RPS): Small SQL DB — locked
- Shard 3 (Books, 10%, 300 RPS): Small SQL DB — locked

**Requirements:**
```
max_p99_latency_ms:    100
min_uptime_percent:    99.0
max_monthly_cost_usd:  1,200
hold_duration_seconds: 30
```

**Failure at start:** Small SQL DB cap = 800 RPS. Shard 1 receives 2,400 RPS → overloaded → p99 > 400 ms.

**Wrong path:** Upgrade shard 1 to Large SQL DB ($800) — expensive, and the imbalance remains.

**Solution:** Replace all three category-keyed shards with a single Medium NoSQL DB. Hash by `product_id` instead of category — traffic spreads evenly. 3,000 RPS / 25,000 NoSQL cap = 12% utilization ✓. Total cost: $20 LB + $300 web + $200 NoSQL = $520/mo ✓

**The lesson:** The partition key is the design decision. Hardware can't fix a bad schema.

**Tradeoff warning:**
> "Hash-based partitioning distributes load evenly — but you lose range queries. 'List all products in Electronics sorted by price' now requires a full scan. Choose your partition key based on your most frequent access pattern."

**Hints:**
1. "Three shards, but one is red and two are nearly idle. Is this a capacity problem or a design problem?"
2. "Category-based partitioning creates a hot partition — a few categories get most traffic."
3. "Hash partitioning by product_id distributes traffic evenly, regardless of category popularity."
4. "A NoSQL DB with hash-based routing eliminates the imbalance entirely."

**Win message:** "The right partition key matters more than the number of shards."

**Primer ref:** `## Sharding` → `### Disadvantages: sharding`

---

## Chapter 5 — Async Patterns (Deep Dive)

> Theme: Queues are not just buffers. They encode delivery guarantees, fan-out, back-pressure, and retry semantics. Chapter 3 introduced the basics; this chapter surfaces the failure modes.
> New components: none (builds on Message Queue + Worker from Chapter 3)

---

### Level 12 — "The Slow Consumer"

**Concept:** Back-pressure signals a producer to slow down when consumers can't keep up. Without it, queues grow unbounded and the whole system collapses under its own backlog.

**Brief:**
> Your image processing pipeline queues 800 jobs per second.
> Each worker can process 300 per second.
> The queue grows by 500 items every second. In two minutes it's full.
> Then everything crashes.

**Traffic:**
```
base_rps:          800
read_write_ratio:  0.0   (all produce — 100% writes into the queue)
pattern:           steady
working_set_gb:    0
```

**Available components:** `message_queue`, `worker`, `rate_limiter`

**Pre-placed:** Traffic Source + Message Queue Medium (locked) + 1× Small Worker (locked)

**Requirements:**
```
max_p99_latency_ms:    600
min_uptime_percent:    99.0
max_monthly_cost_usd:  700
hold_duration_seconds: 30
```

**Failure at start:** 1 Small Worker (300 RPS cap) vs 800 RPS producer → queue fills at 500/sec → buffer saturates → messages dropped → uptime falls.

**Solution A (scale consumers):** Add 2 more Small Workers ($50 each).
Total capacity = 3 × 300 = 900 RPS > 800 ✓. Cost: $30 + $150 = $180/mo total ✓

**Solution B (back-pressure via rate limiting):** Add Rate Limiter ($10) set to 280 RPS.
Single worker processes 300 RPS, producer limited to 280 RPS → queue drains slowly → stable ✓
Cost: $10 — cheapest solution. Tradeoff: 65% of jobs are rejected at the source.

**Intended lesson:** both work; Rate Limiter is cheapest but rejects load. More workers keep every job. The right choice depends on whether jobs can be dropped.

**Tradeoff warning:**
> "With back-pressure, producers slow down or get rejected. Users feel it. Without back-pressure, the queue silently grows until it bursts — users get no response at all. Pick your poison."

**Hints:**
1. "The message queue buffer is growing red — messages are being dropped. Why?"
2. "800 jobs arrive per second but your worker handles 300. The gap accumulates."
3. "Option A: Add more workers to increase consumer throughput to match the producer."
4. "Option B: Add a rate limiter before the queue — slow the producer to the consumer's pace."

**Win message:** "Back-pressure: make the producer feel the pain before the queue does."

**Primer ref:** `## Asynchronism` → `### Back pressure`

---

### Level 13 — "Fan-Out"

**Concept:** A single published event must reach N independent consumers. Routing one event to many workers (pub/sub) is more efficient and more resilient than one worker doing all downstream work sequentially.

**Brief:**
> When a user posts a photo, three things must happen:
>   1. Update every follower's timeline (NoSQL write)
>   2. Queue an ML thumbnail job (worker pipeline)
>   3. Increment analytics counters (SQL write)
> One event — three consumers. Right now a single worker does all three in sequence.
> If step 2 is slow, step 3 waits. That's not acceptable.

**Traffic:**
```
base_rps:          500
read_write_ratio:  0.0
pattern:           steady
working_set_gb:    0
```

**Available components:** `message_queue`, `worker`, `nosql_db`, `sql_db`

**Pre-placed:** Traffic Source + 1× Message Queue Medium (locked)

**Requirements:**
```
max_p99_latency_ms:    400
min_uptime_percent:    99.0
max_monthly_cost_usd:  800
hold_duration_seconds: 30
```

**Failure at start:** One worker handles all three tasks sequentially → effective load = 500 × 3 = 1,500 ops/sec → worker saturated → queue fills.

**Solution:** Connect the single queue to 3 separate workers — each dedicated to one task.
- Worker A ($50): timeline writes → NoSQL DB ($200)
- Worker B ($50): ML thumbnail → (no DB needed)
- Worker C ($50): analytics → SQL DB ($300)
Each worker independently processes 500 events/sec ✓
Cost: $30 queue + $150 workers + $500 DBs = $680/mo ✓

**The "aha" moment:** the queue's event count is 3× the traffic source's — each event is delivered to all three consumers independently.

**Tradeoff warning:**
> "Fanout-on-write keeps every subscriber current in real time. But for celebrities with 50 million followers, a single post fans out to 50 million writes. At that scale you need a hybrid: pre-fan for ordinary users, pull-on-read for celebrities."

**Hints:**
1. "One worker processing three tasks sequentially becomes the bottleneck. What if the tasks ran in parallel?"
2. "A message queue can connect to multiple consumers — each receives a copy of every event."
3. "Add three separate workers, one per task: timeline, thumbnails, analytics."
4. "Each worker now handles only 500 events/sec independently, in parallel."

**Win message:** "Pub/sub: one publish, N independent subscribers. Producers are decoupled from consumers."

**Primer ref:** `## Asynchronism` → `### Task queues`

---

### Level 14 — "Dead Letters"

**Concept:** Transient failures in async processing are inevitable. A dead-letter queue (DLQ) captures failed messages for retry and inspection without blocking the main pipeline.

**Brief:**
> Your payment worker occasionally crashes — DB timeouts, bad payloads.
> When it does, those payment requests disappear silently.
> A lost payment is a very angry user. And possibly a regulatory problem.
> Failed messages must be retried — but not indefinitely.

**Traffic:**
```
base_rps:          300
read_write_ratio:  0.0
pattern:           steady
working_set_gb:    0
```

**Failure event:**
```
at_seconds:       20
type:             node_crash
target:           worker_primary
duration_seconds: 15
```

**Available components:** `message_queue`, `worker`, `sql_db`

**Pre-placed:** Traffic Source + Message Queue Medium + 1× Medium Worker + Medium SQL DB (all locked)

**Requirements:**
```
max_p99_latency_ms:    500
min_uptime_percent:    99.5
max_monthly_cost_usd:  700
hold_duration_seconds: 60
```

**Failure at start:** Worker crashes at t=20s → 15 s of dropped payment events → those jobs are gone → uptime = 75%. Fails.

**Solution:** Add a Small Message Queue ($30) as the dead-letter queue, connected downstream of the primary worker's failure path.
Add a Small Worker ($50) as the retry worker, reading from the DLQ.
When the primary worker crashes, failed messages land in the DLQ.
Retry Worker replays them once the primary recovers.
15-second crash → payments delayed, not lost → uptime 99.5%+ ✓
Cost: existing + $30 DLQ + $50 retry worker = $640/mo ✓

**Tradeoff warning:**
> "Messages retried from the DLQ may be processed more than once — that's 'at-least-once' delivery. Your DB writes must be idempotent: writing the same payment twice must produce the same result as writing it once. This is why payment systems use idempotency keys."

**Hints:**
1. "Watch the worker crash at t=20s — messages in-flight disappear. They aren't being retried."
2. "Add a second message queue — a dead-letter queue — that receives events the primary worker failed to process."
3. "Add a retry worker reading from the DLQ. It replays the failed messages."
4. "Now when the primary crashes, messages are delayed — not lost."

**Win message:** "Failed messages aren't gone — they're queued for a second chance."

**Primer ref:** `## Asynchronism`

---

## Chapter 6 — Global Scale

> Theme: Users are not in one city. Light takes 70 ms to cross the Atlantic and 120 ms to cross the Pacific. The architecture must close that gap.
> New components: **CDN**

---

### Level 15 — "The Edge"

**Concept:** A CDN caches static content at edge nodes close to users. Static requests never reach the origin, dramatically reducing both latency and origin server load.

**Brief:**
> Your media site serves images, CSS, and JavaScript.
> 70% of requests are for static files that never change.
> Users in Tokyo wait 180 ms for a CSS file to load from your US data centre.
> There is a better way — serve it from somewhere 10 ms away.

**Traffic:**
```
base_rps:          5,000
read_write_ratio:  0.95
pattern:           steady
working_set_gb:    20   (static assets)
```

**Available components:** `web_server`, `sql_db`, `cache`, `cdn`, `load_balancer`

**Pre-placed:** Load Balancer + 3× Medium Web Server + Medium Cache + Medium SQL DB (all locked)

**Requirements:**
```
max_p99_latency_ms:    40
min_uptime_percent:    99.0
max_monthly_cost_usd:  1,200
hold_duration_seconds: 30
```

**Failure at start:** All 5,000 RPS hits origin. Web servers at 80% utilization. p99 = 120 ms (includes cross-region base latency). Fails.

**CDN tiers (new component):**

| Tier   | Capacity    | Static hit rate | Edge latency | Cost/mo |
|--------|-------------|-----------------|--------------|---------|
| Small  | 50,000 RPS  | 80%             | 5 ms         | $20     |
| Medium | 500,000 RPS | 90%             | 3 ms         | $60     |
| Large  | 5M RPS      | 95%             | 2 ms         | $200    |

**Solution:** Place Medium CDN in front of the Load Balancer.
- 70% of traffic is static → CDN serves 90% of it at 3 ms from the edge
- Static CDN hits: 5,000 × 0.70 × 0.90 = 3,150 RPS served at edge (never reaches origin)
- Origin load: 5,000 × 0.30 (dynamic) + 5,000 × 0.70 × 0.10 (static misses) = 1,850 RPS
- 3 Medium web servers easily handle 1,850 RPS → p99 < 40 ms ✓
- Cost: $60 CDN + existing = well within $1,200 ✓

**The "aha" moment:** web server utilization drops from 80% → ~20%. CDN node shows "Offloaded: 3,150 RPS".

**Tradeoff warning:**
> "CDN edge nodes cache your content for a configured TTL. Push a CSS update and users at the edge may see the old version for hours. Solutions: versioned asset filenames (cache.v4.css), short TTLs (< 60 s), or explicit cache invalidation — each with their own cost."

**Hints:**
1. "Most traffic is for static files that never change. Do they need to travel 10,000 km to your servers?"
2. "A CDN (Content Delivery Network) caches static files at edge nodes close to users worldwide."
3. "Place the CDN before your load balancer. Static requests never reach the origin."
4. "Watch origin load fall — only dynamic requests and CDN cache misses reach your servers now."

**Win message:** "70% of your traffic now loads in 3 ms from the nearest edge. The origin sees 37% of what it used to."

**Primer ref:** `## Content delivery network`

---

### Level 16 — "Cross the Pacific"

**Concept:** For dynamic API responses, a CDN is not enough. A read replica in a second region serves local users, eliminating round-trip latency that geography makes unavoidable.

**Brief:**
> 50% of your users are in Tokyo. Every API call crosses the Pacific.
> Your servers are fast — but light isn't.
> 120 ms of network latency is a floor, not a ceiling.
> What if Tokyo had its own database?

**Traffic:**
```
base_rps:          3,000
read_write_ratio:  0.90
pattern:           steady
working_set_gb:    15
```
50% of requests originate in Tokyo and carry a +120 ms baseline latency surcharge to the US region.

**Available components:** `web_server`, `sql_db`, `cache`, `load_balancer`, `cdn`

**Pre-placed (US region):** Load Balancer US + 2× Medium Web Server US + Medium SQL DB Primary (locked)

**Requirements:**
```
max_p99_latency_ms:    60   (global p99 — Tokyo users included)
min_uptime_percent:    99.0
max_monthly_cost_usd:  2,000
hold_duration_seconds: 30
```

**Failure at start:** All traffic routed to US origin. Tokyo base latency = 120 ms → global p99 >> 60 ms.

**Solution:** Add a Tokyo region:
- Load Balancer Tokyo ($20)
- 2× Small Web Server Tokyo ($100 total)
- Medium SQL DB Read Replica Tokyo ($300) — replicates from US primary

Tokyo reads hit local replica: ~15 ms local latency → p99 < 60 ms ✓
Writes still route to US primary (writes are global, and writes are only 10% of traffic).
Cost: existing US ($870) + $20 + $100 + $300 = $1,290/mo ✓

**Tradeoff warning:**
> "Your Tokyo replica lags 50–200 ms behind the US primary. A user who writes data and immediately reads it back may see the old value — read-your-own-write inconsistency. A common fix: route each user's reads to the primary for 1 second after a write, then switch back to the replica."

**Hints:**
1. "Tokyo users' 120 ms base latency is not a software problem — it's the speed of light."
2. "What if Tokyo had its own web servers and its own database?"
3. "Add a second region: a load balancer, web servers, and a SQL DB read replica."
4. "Reads are now served locally in Tokyo. Only writes travel to the US primary."

**Win message:** "Geography is a constraint, not an excuse. Replicate closer to your users."

**Primer ref:** `## Replication` → `### Master-slave replication`

---

## Chapter 7 — Distributed Tradeoffs

> Theme: Distributed systems cannot guarantee consistency, availability, and partition tolerance simultaneously. When the network fails — and it will — you must choose. These are not academic exercises. They determine what users see during an outage.
> New components: none

---

### Level 17 — "The Network Split"

**Concept:** The CAP theorem: during a network partition, a distributed system must choose Consistency (every read returns the latest write) or Availability (every request gets a response, even if stale). There is no third option.

**Brief:**
> A fibre cut has split your US and Tokyo regions.
> The partition will last 20 seconds.
> Tokyo users are still online. Their requests are arriving.
> Do you serve them potentially stale data — or a 503 error?

**Traffic:**
```
base_rps:          2,000
read_write_ratio:  0.90
pattern:           steady
working_set_gb:    10
```

**Failure event:**
```
at_seconds:        20
type:              network_partition
from:              us_primary_db
to:                tokyo_replica_db
duration_seconds:  20
```

**Pre-placed (same two-region topology as Level 16):** All nodes locked. One configurable parameter on the Tokyo replica: `consistency_mode` (toggle: `eventual` / `strong`).

**Two SLA scenarios — player must solve both:**

_Scenario A — Social media "likes" counter (default):_
```
max_p99_latency_ms:    200
min_uptime_percent:    99.0   (brief: "occasional stale counts are fine")
```
→ Set `consistency_mode: eventual`.
During partition Tokyo serves reads from local replica (stale by up to 20 s). Zero downtime. Passes ✓.

_Scenario B — Bank balance display:_
```
max_p99_latency_ms:    400
min_uptime_percent:    85.0   (brief: "stale balances are never acceptable")
```
→ Set `consistency_mode: strong`.
During partition Tokyo rejects all reads → 20 s of downtime → uptime ≈ 86% → passes ✓ (barely).
With eventual consistency it passes uptime but shows stale data → wrong answer flagged.

**The lesson:** the same partition, two correct answers — depending entirely on the application's tolerance for stale data.

**Tradeoff warning:**
> "CAP is not a binary switch. Modern databases (DynamoDB, Cassandra, Spanner) expose tunable consistency levels so you can make the trade per-query, not per-cluster. But you still can't escape the partition: the numbers change, the choice doesn't."

**Hints:**
1. "During the partition, Tokyo's replica can't sync with the US primary. What should it do?"
2. "Option A (eventual): serve reads from the local replica. Users may see stale data."
3. "Option B (strong): reject reads until the partition heals. Users see a 503 error."
4. "The right answer depends entirely on whether stale data is acceptable for this specific feature."

**Win message (Scenario A):** "Eventual consistency: stale data is acceptable. 100% availability during the partition."
**Win message (Scenario B):** "Strong consistency: no stale data, ever. 15 seconds of downtime instead."

**Primer ref:** `## CAP theorem`

---

### Level 18 — "Tunable Consistency"

**Concept:** Modern distributed databases expose per-query consistency levels. By choosing the right level for each operation, you balance latency, availability, and correctness without making a system-wide all-or-nothing trade.

**Brief:**
> You're building a shopping cart system.
> Adding items to the cart can tolerate eventual consistency — a brief delay is fine.
> But the order total shown at checkout must always be correct.
> Your database can handle both — if you configure it correctly.

**Traffic:**
```
base_rps:          4,000
read_write_ratio:  0.80
pattern:           steady
working_set_gb:    8
```

**Available components:** `nosql_db`, `cache`, `load_balancer`, `web_server`

**Pre-placed:** Load Balancer + 3× Medium Web Server + Medium NoSQL DB (locked)
The NoSQL DB supports three read consistency levels (configurable):
- `eventual` — latency 8 ms, may return stale data (< 100 ms stale)
- `bounded` — latency 15 ms, data at most 500 ms stale
- `strong` — latency 40 ms, always returns the latest committed write

**Two traffic classes (configurable per component):**
- `/cart` writes + reads: 3,200 RPS (80%) — stale data acceptable
- `/checkout` reads: 800 RPS (20%) — must be perfectly consistent

**Requirements:**
```
max_p99_latency_ms:    25    (global weighted p99)
min_uptime_percent:    99.5
correctness_score:     100%  (checkout reads must never return stale data)
max_monthly_cost_usd:  800
hold_duration_seconds: 30
```

**Failure at start (default: strong everywhere):** Strong consistency for all 4,000 RPS → p99 = 40 ms. Fails latency requirement.

**Failure path 2 (eventual everywhere):** p99 = 8 ms ✓ — but checkout reads return stale totals → correctness score fails.

**Solution:** Configure two consistency levels per operation type:
- `/cart` operations → `eventual` (8 ms latency)
- `/checkout` reads → `strong` (40 ms, only 20% of traffic)

Weighted p99: (3,200 × 8 ms + 800 × 40 ms) / 4,000 = (25,600 + 32,000) / 4,000 = 14.4 ms ✓
Correctness: checkout always reads latest → 100% ✓

**Tradeoff warning:**
> "You now have two contracts with your database: a fast, approximate one for cart updates and a slow, exact one for checkout. This is correct — but it requires that every developer on the team knows which queries get which consistency level. Undocumented consistency assumptions are a common source of subtle data corruption bugs in production."

**Hints:**
1. "Strong consistency everywhere is too slow. Eventual consistency everywhere is too stale."
2. "Not every operation needs the same guarantee. What are the consequences of a wrong cart count vs a wrong checkout total?"
3. "Configure eventual consistency for cart operations and strong consistency for checkout reads."
4. "Only 20% of traffic needs the slow strong path — the weighted p99 drops significantly."

**Win message:** "Tune consistency per query, not per cluster. High availability and correctness can coexist."

**Primer ref:** `## Consistency patterns`

---

## Chapter 8 — Real Architectures

> Theme: Apply every technique from Chapters 1–7 to architect complete real-world systems from a blank canvas. No pre-placed nodes, no single correct answer, multiple valid designs.
> New components: none
> Design principle: player chooses the architecture; the simulation validates it against SLA requirements.

---

### Level 19 — "Build a URL Shortener"

**Concept:** A URL shortener (bit.ly, tinyurl) is a classic system design interview problem. It is read-heavy, latency-critical, globally distributed, and has distinct read and write paths. Apply caching, sharding, and CDN in one design.

**Brief:**
> Build a URL shortener serving 10,000 RPS globally.
> Writes (create short URL): 100 RPS — rare.
> Reads (resolve short URL to original): 9,900 RPS — the entire point.
> Requirements: resolve in under 30 ms globally. Handle 1 billion total URLs (storage at scale).

**Traffic:**
```
base_rps:          10,000
read_write_ratio:  0.99
pattern:           steady
working_set_gb:    400   (1 billion URLs, ~400 bytes each = 400 GB)
```

**Available components:** all unlocked

**Pre-placed:** Traffic Source only (locked)

**Requirements:**
```
max_p99_latency_ms:    30
min_uptime_percent:    99.9
max_monthly_cost_usd:  3,000
hold_duration_seconds: 60
```

**Example strong solution:**
- CDN (Medium, $60) → serves ~90% of reads from edge (popular URLs) → 9,000 RPS at 3 ms
- Load Balancer ($20) → 2× Small Web Server ($100)
- Medium Cache ($100) → 8 GB of hot URLs (~2% of working set, but the most popular 2% absorb ~80% of redirects)
- 4× Medium NoSQL DB shards ($800 total) — each shard stores 250 GB
- Writes go directly to a shard (hash by short code). Reads: CDN → Cache → DB.

Weighted p99: 90% CDN hits (3 ms) + 8% cache hits (8 ms) + 2% DB reads (8 ms per shard) = 3.4 ms ✓
Cost: $60 + $20 + $100 + $100 + $800 = $1,080/mo ✓

**There is no single correct solution.** The simulation accepts any topology that satisfies the SLA. Players might solve it differently — more shards, more cache, less CDN — and all are valid if the numbers work.

**Tradeoff warning (post-win):**
> "You solved the read path beautifully. The write path (creating new URLs) is easy at 100 RPS — but think about ID generation at scale. If multiple web servers generate short codes simultaneously, you need a coordination strategy: pre-allocated ID ranges, UUID v4 (and hash it shorter), or a centralised sequence service. These tradeoffs don't show up in the simulation — but they show up in the interview."

**Hints:**
1. "99% of traffic is reads. Design the read path first."
2. "Popular URLs are read millions of times. A cache with even a 50% hit rate halves your DB load."
3. "A CDN at the edge can serve cached redirects in under 5 ms — without touching the origin at all."
4. "The working set is 400 GB — too large for one cache node. But the top 1% of URLs likely absorb 80% of traffic. A small cache still helps enormously."
5. "Split writes from reads at the database: writes go to any shard, reads go to the nearest."

**Win message:** "URL shortener solved. The CDN + cache stack absorbs 98% of reads before they reach a database."

**Primer ref:** `## Domain name system` + `## Content delivery network` + `## Cache`

---

### Level 20 — "Design a Social Feed"

**Concept:** A social feed is the canonical example of the fan-out problem. Fan-out on write (push to all followers' timelines on post) vs fan-out on read (pull and merge all followees' posts at read time) is a fundamental distributed systems trade-off with no single right answer.

**Brief:**
> Build the timeline feature for a social network.
> 1 million users. Average 200 followers each.
> 5,000 posts per second. 50,000 timeline reads per second.
> Every user expects their feed to load in under 100 ms.

**Traffic:**
```
base_rps:          55,000   (5,000 writes + 50,000 reads)
read_write_ratio:  0.91
pattern:           steady
working_set_gb:    100      (recent posts hot set)
```

**Available components:** all unlocked

**Pre-placed:** Traffic Source only (locked)

**Requirements:**
```
max_p99_latency_ms:    100
min_uptime_percent:    99.5
max_monthly_cost_usd:  5,000
hold_duration_seconds: 60
```

**Two valid architectures (player must discover and pick one):**

_Fan-out on Write:_
- Each new post triggers writes to all N follower timelines immediately.
- 5,000 posts × 200 followers average = 1,000,000 timeline writes/sec.
- Timeline reads are fast (pre-built feed, just fetch from cache).
- Cost: many workers + large NoSQL DB for timelines.
- Breaks for celebrities: a single post by a user with 10M followers = 10M writes.

_Fan-out on Read:_
- No pre-built timelines. At read time, fetch the last 20 posts from each followee.
- A user following 500 accounts → 500 DB lookups per read → too slow without caching.
- Works for celebrities (no write amplification). Hard to make fast for users with many followees.

**Simulation model (simplified):** The engine exposes a "fan-out mode" toggle:
- `write`: each write event fans out to `avg_followers` downstream writes immediately.
- `read`: each read event fans out to `avg_following` DB reads to assemble the feed.

**Requirements set:** p99 < 100 ms means fan-out on read without caching fails (500 DB lookups × 8 ms each = too slow). Fan-out on write with adequate worker and DB capacity succeeds.

**Example strong solution (fan-out on write):**
- Rate Limiter ($10) caps fanout for celebrity accounts (> 10k followers) → deferred to a batch job
- Message Queue Large ($200) → 5× Medium Worker ($750) → NoSQL DB Large ($600) for timelines
- Medium Cache ($100) in front of timeline DB (hot feeds cached)
- CDN + LB + 4× Web Server for read path
Total ~$2,200/mo ✓

**Tradeoff warning:**
> "Fan-out on write pre-computes every user's feed on every post. It works perfectly at ordinary follower counts — but at celebrity scale (Obama, Taylor Swift) you would fan out to 100 million timeline writes per post. Real systems (Twitter/X, Instagram) use a hybrid: fan-out on write for ordinary users, pull-on-read for verified accounts above a follower threshold. The simulation doesn't model celebrities — but the interview will ask."

**Hints:**
1. "50,000 reads per second, 100 ms budget. How do you serve a personalised feed that fast?"
2. "Option A: pre-compute each user's timeline at write time. Reads are fast — just fetch."
3. "Option B: assemble the feed at read time by querying every followee. Reads are flexible but expensive."
4. "Fan-out on write needs workers to handle 1M writes/sec — scale the worker pool."
5. "A cache in front of the timeline store serves hot feeds without touching the database at all."

**Win message:** "Fan-out on write: pre-compute every feed. Fast reads, expensive writes, challenging at celebrity scale."

**Primer ref:** `## Asynchronism` + `## Cache` + `## NoSQL`

---

## Level Progression Summary (Full)

| #  | Title                      | Concept                             | New Component   | Chapter |
|----|----------------------------|-------------------------------------|-----------------|---------|
| 1  | First Deploy               | Basic architecture, reading metrics | Web Server, DB  | 1       |
| 2  | Going Viral                | Identify bottleneck, upgrade right node | —           | 1       |
| 3  | Cache Me If You Can        | Caching, hit rate, working set      | Cache           | 1       |
| 4  | One Server Isn't Enough    | Horizontal scaling, load balancer   | Load Balancer   | 2       |
| 5  | Read Replicas              | Primary/replica, read-write split   | DB replication  | 2       |
| 6  | Don't Go Down              | SPOF, failover, health checks       | —               | 3       |
| 7  | The Spike                  | Rate limiting, graceful degradation | Rate Limiter    | 3       |
| 8  | Write Storm                | Async writes, message queue, workers| Queue, Worker   | 3       |
| 9  | Writes Don't Scale         | NoSQL vs SQL write throughput       | NoSQL DB        | 4       |
| 10 | One Database, One Bottleneck | Horizontal sharding               | —               | 4       |
| 11 | The Hot Partition          | Key design, hot spots, re-sharding  | —               | 4       |
| 12 | The Slow Consumer          | Back-pressure, consumer scaling     | —               | 5       |
| 13 | Fan-Out                    | Pub/sub, multiple consumers         | —               | 5       |
| 14 | Dead Letters               | DLQ, retry semantics, idempotency   | —               | 5       |
| 15 | The Edge                   | CDN, static offload, edge caching   | CDN             | 6       |
| 16 | Cross the Pacific          | Multi-region read replica           | —               | 6       |
| 17 | The Network Split          | CAP theorem, partition trade-off    | —               | 7       |
| 18 | Tunable Consistency        | Per-query consistency levels        | —               | 7       |
| 19 | Build a URL Shortener      | Full-system design (capstone)       | —               | 8       |
| 20 | Design a Social Feed       | Fan-out on write vs read (capstone) | —               | 8       |

---

## Components Unlocked Per Chapter (Updated)

```
Chapter 1 (1–3):   Traffic Source, Web Server, SQL DB, Cache
Chapter 2 (4–5):   + Load Balancer, DB replication mode
Chapter 3 (6–8):   + Rate Limiter, Message Queue, Worker
Chapter 4 (9–11):  + NoSQL DB
Chapter 5 (12–14): (no new components — deeper queue patterns)
Chapter 6 (15–16): + CDN, multi-region routing
Chapter 7 (17–18): (no new components — consistency config)
Chapter 8 (19–20): All components, blank canvas
```

---

## Open Questions (Level Design)

- [x] **Post-MVP chapters (4–8):** NoSQL, sharding, CDN, CAP theorem, real architectures — ✅ designed above
- [ ] **Tutorial overlay:** Level 1 needs guided tooltips for first-time players (arrow, highlight)
- [ ] **Level select screen:** chapter map or linear unlock?
- [ ] **Star rating criteria:** e.g. 3 stars = meets all requirements AND under 80% of budget
- [ ] **Tradeoff follow-up puzzles:** after Level 3 win, optional challenge "now handle stale data"
- [ ] **Network partition simulation:** Chapter 7 requires a new failure event type (`network_partition`) and `consistency_mode` config on DB nodes — needs engine implementation
- [ ] **Celebrity fan-out:** Level 20 fan-out amplification model needs engine support for per-node write multipliers
- [ ] **Capstone grading (Levels 19–20):** multiple valid solutions — simulator grades on SLA metrics only, not topology shape
