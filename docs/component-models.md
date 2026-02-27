# Component Models

> Detailed specification for all simulation components.
> Decisions locked in: **Tiers (S/M/L)** for upgrades, **S-curve degradation** for all latency under load.
> Back to: [plan.md](plan.md)

---

## Resolved Design Decisions

| Question | Decision |
|---|---|
| Tiers vs sliders | **Tiers (Small / Medium / Large)** — keeps focus on topology, not tuning |
| Traffic model | **Poisson arrivals** — natural bursty behavior, more realistic than fixed RPS |
| Latency under load | **S-curve degradation** — same formula for all components, constants tuned per type |
| Round-trip vs one-way | **One-way** for MVP — request travels source → sink, no return path modelled |
| Replication lag | **Separate delayed write event** — write emits a second event to replicas at `now + lag_ms` |
| Network latency between nodes | **Zero for MVP** — assume co-located; add regional latency in Chapter 6 |
| Multiple instances | **Yes** — player can place N of the same component; simulation sums their capacity |

---

## Latency Degradation Model (shared by all components)

All components use the same S-curve formula. Only `base_latency` and `capacity` differ.

```
utilization = active_load / capacity

latency_multiplier =
  utilization < 0.50  →  1.0x
  utilization 0.50–0.80  →  linear: 1.0x → 2.0x
  utilization 0.80–0.95  →  linear: 2.0x → 5.0x
  utilization > 0.95  →  requests enter overflow queue
                          queue > overflow_limit → drop (error)

effective_latency = base_latency_ms * latency_multiplier
```

This single formula is the core teaching mechanic — every component degrades the same way,
so players build intuition once and apply it everywhere.

---

## Component Specifications

---

### 1. Traffic Source
*Level-fixed. Not placed by player. Always the entry point.*

| Parameter | Type | Description |
|---|---|---|
| `base_rps` | level-fixed | Baseline requests per second |
| `read_write_ratio` | level-fixed | e.g. `0.9` = 90% reads, 10% writes |
| `pattern` | level-fixed | `steady` / `ramp` / `spike` |
| `spike_at_seconds` | level-fixed | When spike is injected (if pattern = spike) |
| `spike_multiplier` | level-fixed | e.g. `10` = 10× burst |
| `spike_duration_seconds` | level-fixed | How long the spike lasts |

**Traffic generation:** Poisson process — inter-arrival time = `Exponential(1 / base_rps)`.
Burst events temporarily multiply the rate parameter.

---

### 2. Load Balancer

| Parameter | Small | Medium | Large |
|---|---|---|---|
| `max_connections` | 1,000 | 10,000 | 100,000 |
| `base_latency_ms` | 2ms | 1ms | 0.5ms |
| `cost_usd_mo` | $20 | $60 | $150 |

| Parameter | Type | Options |
|---|---|---|
| `algorithm` | policy | `round_robin` / `least_connections` / `ip_hash` |
| `health_check_interval_ms` | policy | `1000` / `5000` / `10000` |

**Algorithm behavior:**
- `round_robin` — distributes sequentially across healthy backends
- `least_connections` — routes to backend with fewest active requests (teaches better utilization)
- `ip_hash` — same client always hits same backend (teaches session affinity use case)

**Failure behavior:** backend is marked unhealthy after missing `2` consecutive health checks.
Unhealthy backends receive no traffic until they recover.
If all backends are down: all incoming requests are dropped (502).

**Overflow behavior:** if `active_connections > max_connections` → drop with 503.

---

### 3. Web Server

| Parameter | Small | Medium | Large |
|---|---|---|---|
| `max_concurrent_req` | 100 | 500 | 2,000 |
| `base_latency_ms` | 50ms | 30ms | 20ms |
| `overflow_queue_limit` | 200 | 500 | 1,000 |
| `cost_usd_mo` | $50 | $150 | $400 |

No policy choices — web server is intentionally simple. The teaching value is
seeing it become the first bottleneck, motivating the load balancer + horizontal scaling.

**Multiple instances:** placing 3× Small Web Servers behind a Load Balancer gives
effective `max_concurrent_req = 300`. This is the key horizontal scaling lesson.

---

### 4. SQL Database

| Parameter | Small | Medium | Large |
|---|---|---|---|
| `read_qps_capacity` | 2,000 | 10,000 | 50,000 |
| `write_qps_capacity` | 500 | 2,000 | 10,000 |
| `read_latency_ms` | 20ms | 10ms | 5ms |
| `write_latency_ms` | 50ms | 20ms | 10ms |
| `cost_usd_mo` | $100 | $300 | $800 |

| Parameter | Type | Options |
|---|---|---|
| `replication_mode` | policy | `none` / `master_slave` / `master_master` |

**Write/read contention:** reads and writes share the same connection pool.
High write load raises the effective `active_load` seen by reads, increasing read latency.
Formula: `read_active_load = read_rps + (write_rps * 3)` — writes are 3× more expensive.

**Replication behavior:**
- `master_slave` — writes go to master only; reads can go to replica.
  Replica emits a delayed write event at `now + replica_lag_ms` (50–200ms, randomly sampled).
  Reads from replica may return stale data — surfaced as an in-game warning.
- `master_master` — both nodes accept writes; conflict resolution is hidden complexity
  (surfaced as an advanced warning tooltip, not simulated in detail for MVP).

**ACID model (simplified):** writes are serialized (one at a time through the write pool).
This is what causes write contention under load — teaches the motivation for NoSQL.

---

### 5. NoSQL Database

| Parameter | Small | Medium | Large |
|---|---|---|---|
| `read_qps_capacity` | 10,000 | 100,000 | 1,000,000 |
| `write_qps_capacity` | 8,000 | 80,000 | 800,000 |
| `read_latency_ms` | 5ms | 2ms | 1ms |
| `write_latency_ms` | 10ms | 4ms | 2ms |
| `cost_usd_mo` | $80 | $250 | $700 |

| Parameter | Type | Options |
|---|---|---|
| `consistency_model` | policy | `eventual` / `strong` |

**vs SQL:** writes are not serialized — concurrent writes accepted.
Trade-off surfaced as an in-game notification: "No transactions — are you sure?"

**Consistency model:**
- `eventual` — higher throughput, replica lag exists (same as master_slave above)
- `strong` — slightly lower throughput (write must be acknowledged by quorum),
  but reads always consistent. Latency penalty: +10ms on writes.

---

### 6. Cache (Redis)

| Parameter | Small | Medium | Large |
|---|---|---|---|
| `max_memory_gb` | 1 | 8 | 64 |
| `ops_capacity` | 50,000 | 200,000 | 1,000,000 |
| `base_latency_ms` | 1ms | 0.5ms | 0.2ms |
| `cost_usd_mo` | $30 | $100 | $300 |

| Parameter | Type | Options |
|---|---|---|
| `eviction_policy` | policy | `lru` / `lfu` / `ttl` |
| `write_strategy` | policy | `cache_aside` / `write_through` / `write_behind` |

**Hit rate model** (emergent, not configurable):
```
working_set_gb = defined per level (e.g. 10GB of hot data)
raw_hit_rate   = min(1.0, max_memory_gb / working_set_gb)

pattern_factor:
  lru → 0.95  (good for recency-skewed access)
  lfu → 0.98  (best for stable hot keys)
  ttl → 0.85  (penalised for expiry misses)

effective_hit_rate = raw_hit_rate * pattern_factor
```

Player sees the resulting hit rate on the node — they learn "bigger cache = higher hit rate = less DB load"
without configuring a number directly.

**Write strategy behavior:**
- `cache_aside` — application reads cache first, writes DB directly, invalidates cache.
  Simplest. Stale window exists between write and invalidation.
- `write_through` — every write goes to cache AND DB synchronously.
  No stale data. Write latency = cache_latency + db_latency.
- `write_behind` — writes go to cache immediately, DB is updated asynchronously.
  Lowest write latency. Risk: data loss if cache fails before DB write. Surfaced as warning.

**Cache miss path:** on miss, request is forwarded to the connected DB node.
Effective DB load = total_rps * (1 - effective_hit_rate).

---

### 7. CDN

| Parameter | Small | Medium | Large |
|---|---|---|---|
| `regions` | 1 (US only) | 3 (US/EU/Asia) | 10 (global PoPs) |
| `cache_hit_rate` | 60% | 80% | 95% |
| `edge_latency_ms` | 20ms | 10ms | 5ms |
| `cost_usd_mo` | $20 | $80 | $300 |

| Parameter | Type | Options |
|---|---|---|
| `cache_strategy` | policy | `pull` / `push` |

**Hit behavior:** CDN hit = served at `edge_latency_ms`, bypasses all origin nodes entirely.
CDN miss = request passes through to origin chain at full latency.

**Effective origin load:** `origin_rps = total_rps * (1 - cache_hit_rate)`

**Strategy behavior:**
- `pull` — CDN fetches from origin on first miss, caches for subsequent requests.
  Zero setup. Works for any content. Slight latency on first request.
- `push` — operator pre-populates CDN. Zero miss latency. Only works for known static content.
  Surfaced as: "Push CDN only for content you control."

**Constraint:** CDN only reduces load on `read` requests with static/cacheable content.
Level definition specifies `cacheable_ratio` (e.g. 0.7 = 70% of reads are cacheable).
Effective hit rate = `cache_hit_rate * cacheable_ratio`.

---

### 8. Message Queue

| Parameter | Small | Medium | Large |
|---|---|---|---|
| `throughput_rps` | 5,000 | 50,000 | 500,000 |
| `max_queue_depth` | 10,000 | 100,000 | 1,000,000 |
| `added_latency_ms` | 5ms | 3ms | 1ms |
| `cost_usd_mo` | $20 | $80 | $250 |

| Parameter | Type | Options |
|---|---|---|
| `delivery_guarantee` | policy | `at_most_once` / `at_least_once` / `exactly_once` |
| `ordering` | policy | `unordered` / `fifo` |

**Backpressure behavior:**
```
queue_depth grows when: producer_rps > consumer_throughput
when queue_depth > max_queue_depth:
  at_most_once  → new messages dropped silently
  at_least_once → producer receives error, retries (adds to load)
  exactly_once  → producer blocks (increases producer latency)
```

**Delivery guarantee cost:**
- `at_most_once` — fastest, no overhead
- `at_least_once` — +1ms, requires message acknowledgement
- `exactly_once` — +3ms, requires deduplication; surfaced as "heaviest, use for payments"

**Ordering cost:**
- `unordered` — max throughput
- `fifo` — ~20% throughput reduction (serialization overhead)

---

### 9. Worker / Consumer

| Parameter | Small | Medium | Large |
|---|---|---|---|
| `concurrency` | 5 | 20 | 100 |
| `processing_time_ms` | 200ms | 100ms | 50ms |
| `cost_usd_mo` | $30 | $100 | $300 |

No policy choices for MVP.

**Effective throughput:**
```
throughput_rps = concurrency / (processing_time_ms / 1000)

Small:  5 / 0.2  = 25 rps
Medium: 20 / 0.1 = 200 rps
Large:  100 / 0.05 = 2,000 rps
```

**Multiple instances:** placing N workers multiplies throughput by N.
This is the horizontal scaling lesson for async workloads.

---

### 10. Rate Limiter

*Fixed cost, no tiers — it's a policy component, not a capacity component.*

| Parameter | Type | Options / Value |
|---|---|---|
| `rps_limit` | player-set | Free integer input |
| `algorithm` | policy | `token_bucket` / `leaky_bucket` / `sliding_window` |
| `reject_behavior` | policy | `drop_429` / `queue` |
| `added_latency_ms` | fixed | 1ms |
| `cost_usd_mo` | fixed | $10 |

**Algorithm behavior:**
- `token_bucket` — allows short bursts above the limit (up to bucket size). Most permissive.
- `leaky_bucket` — smooths traffic to exactly `rps_limit`. No bursts. Teaches traffic shaping.
- `sliding_window` — strict per-second count. No bursts. More accurate than token bucket.

**Placement teaching moment:** placing rate limiter before vs after load balancer has different
effects — surfaced as a tooltip: "Before LB protects infrastructure. After LB protects per-backend."

---

## Component Interaction Summary

| Interaction | Effect |
|---|---|
| Cache miss → DB | `db_load += rps * (1 - hit_rate)` |
| LB health check → failed server | routes 0% traffic to failed backend |
| Queue depth growing | producer latency increases (backpressure) |
| DB replication lag | reads from replica may be stale (eventual consistency) |
| N workers pulling from queue | effective consumer throughput = N × worker_throughput |
| CDN hit | bypasses web server + DB entirely |
| Write-heavy SQL load | raises read latency via shared connection pool contention |

---

## Cost Reference (Monthly, USD)

| Component | Small | Medium | Large |
|---|---|---|---|
| Load Balancer | $20 | $60 | $150 |
| Web Server | $50 | $150 | $400 |
| SQL Database | $100 | $300 | $800 |
| NoSQL Database | $80 | $250 | $700 |
| Cache | $30 | $100 | $300 |
| CDN | $20 | $80 | $300 |
| Message Queue | $20 | $80 | $250 |
| Worker | $30 | $100 | $300 |
| Rate Limiter | $10 | $10 | $10 |
