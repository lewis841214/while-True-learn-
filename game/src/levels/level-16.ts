import type { LevelDefinition } from '../engine/types'

/**
 * Level 16 — Second Region  (Chapter 6 · Global Scale)
 *
 * 8 000 RPS, 80% reads, global audience: 50% US + 50% Asia-Pacific.
 * All traffic currently routed to a single US region → APAC latency is 200ms+.
 *
 * Model: two Load Balancers (US + APAC), each with web servers, backed by
 *   a primary SQL DB (US) and a read-replica NoSQL DB (APAC).
 * Pre-placed: src, US-LB, 2× US-Web, Primary SQL DB (all locked).
 * Player adds: APAC-LB, 2× APAC-Web, NoSQL Read Replica.
 *
 * Single-region cost: $50+2×$100+$300 = $550.
 * With second region: +$50+2×$100+$200 = +$350 → total $900 < $1 100.
 *
 * The "second region" is modelled as an additional load balancer downstream of
 * the traffic source — traffic is split 50/50 (LB round-robins across the two LBs).
 */
export const level16: LevelDefinition = {
  id: 'level-16',
  chapter: 6,
  title: 'Second Region',
  brief:
    '8 000 RPS, 80 % reads. Half your users are in Asia-Pacific — single-region ' +
    'latency is 200 ms for them. Add a second region with read replicas to serve ' +
    'APAC users from a local data centre.',
  concept:
    'Multi-region architecture places read replicas close to users in different ' +
    'geographies. Writes still go to the primary region; reads are served locally. ' +
    'Replication lag (typically <1 s) means APAC reads may be slightly stale.',
  primerRef: 'Multi-region architecture',

  traffic: {
    baseRps: 8_000,
    readWriteRatio: 0.80,
    pattern: 'steady',
    workingSetGb: 30,
  },

  requirements: {
    maxP99LatencyMs: 60,
    minUptimePercent: 99,
    maxMonthlyCostUsd: 1_100,
    holdDurationSeconds: 30,
    minThroughputRps: 6_400,
  },

  availableComponents: ['load_balancer', 'web_server', 'nosql_db', 'sql_db', 'cache'],

  prePlaced: [
    { type: 'traffic_source', tier: 'small', locked: true },
    { type: 'load_balancer',  tier: 'small', locked: true },
    { type: 'web_server',     tier: 'medium', locked: true },
    { type: 'web_server',     tier: 'medium', locked: true },
    { type: 'sql_db',         tier: 'medium', locked: true },
  ],

  failureEvents: [],

  hints: [
    'The existing US region serves all 8 000 RPS but APAC latency is high.',
    'Add a second Load Balancer (APAC region). Wire Traffic Source → US-LB AND Traffic Source → APAC-LB.',
    'Add 2× Medium Web Servers behind the APAC LB.',
    'Add a Medium NoSQL DB as the APAC read replica — wire APAC web servers to it.',
    'The Global LB now round-robins: 4 000 RPS to US, 4 000 RPS to APAC.',
    'APAC users now read locally — p99 drops from 200ms to <10ms for APAC reads.',
  ],

  winMessage:
    'APAC users now read from a local replica. Write latency is unchanged — writes ' +
    'still go to the US primary. This is the foundation of global apps like Netflix and Spotify.',
  tradeoffWarning:
    'Replication is asynchronous: APAC reads may lag behind US writes by 50–500 ms. ' +
    'For financial data this is unacceptable — use synchronous replication (at higher cost).',
}
