import type { LevelDefinition } from '../engine/types'

/**
 * Level 17 — Database Failover  (Chapter 7 · Reliability at Scale)
 *
 * 2 000 RPS, 60% reads, 40% writes.
 * The primary SQL DB crashes at t=15s and recovers at t=45s.
 *
 * Pre-placed: src, LB, 2× Med Web, Primary SQL DB (locked, will crash).
 * Player must add a Read Replica (NoSQL DB) that the LB can route reads to,
 * plus a Rate Limiter to shed write load while primary is down.
 *
 * Without failover: 30 s of downtime → uptime < 97%.
 * With replica + LB routing: reads go to replica during crash; writes fail gracefully.
 * A rate limiter on writes limits write drops to a manageable level.
 *
 * Win: uptime >= 99% (replica handles reads during crash),
 *      p99 <= 100ms (reads from replica 8ms, writes slow down briefly).
 */
export const level17: LevelDefinition = {
  id: 'level-17',
  chapter: 7,
  title: 'Database Failover',
  brief:
    '2 000 RPS. At t=15 s the primary database crashes for 30 seconds. ' +
    'Without a replica, all reads and writes fail — uptime collapses. ' +
    'Add a read replica and a write-shedding mechanism to survive the outage.',
  concept:
    'A read replica mirrors the primary database. During a primary failure, ' +
    'reads fail over to the replica automatically. Writes must either queue ' +
    'or be rejected gracefully (returning 503) rather than timing out.',
  primerRef: 'Replication',

  traffic: {
    baseRps: 2_000,
    readWriteRatio: 0.60,
    pattern: 'steady',
    workingSetGb: 10,
  },

  requirements: {
    maxP99LatencyMs: 100,
    minUptimePercent: 99,
    maxMonthlyCostUsd: 900,
    holdDurationSeconds: 30,
    minThroughputRps: 1_600,
  },

  availableComponents: ['nosql_db', 'sql_db', 'rate_limiter', 'cache', 'load_balancer'],

  prePlaced: [
    { type: 'traffic_source', tier: 'small', locked: true },
    { type: 'load_balancer',  tier: 'small', locked: true },
    { type: 'web_server',     tier: 'medium', locked: true },
    { type: 'web_server',     tier: 'medium', locked: true },
    { type: 'sql_db',         tier: 'medium', locked: true },
  ],

  failureEvents: [
    { atSeconds: 15, type: 'node_crash', targetNodeId: 'db', durationSeconds: 30 },
  ],

  hints: [
    'Run the sim. At t=15 s the SQL DB crashes — all 2 000 RPS fail for 30 s.',
    'Add a Medium NoSQL DB as a read replica. Wire web servers → replica AND web servers → primary SQL.',
    'The LB round-robins between primary and replica — during the crash, the replica handles reads.',
    'Writes to the replica will succeed but won\'t be synced back to primary (read replica = read-only in production).',
    'Add a Rate Limiter before the DB connections to limit write load during degraded mode.',
    'Tune the Rate Limiter to ~400 RPS writes — enough to protect the DB but drop excess gracefully.',
  ],

  winMessage:
    'The replica absorbed read traffic during the 30-second primary outage. ' +
    'Automatic failover is the cornerstone of high availability (HA) database setups.',
  tradeoffWarning:
    'If writes reach the replica during a primary crash, replica data diverges from primary. ' +
    'When primary recovers, you face a split-brain conflict requiring manual resolution.',
}
