import type { LevelDefinition } from '../engine/types'

/**
 * Level 6 — Failover
 *
 * 200 RPS, 90% reads.  A single web server crashes at t=20s and stays down
 * for 20s.  Without redundancy, the entire system goes dark for that window.
 *
 * Fix: add a Load Balancer + second Web Server.
 *   LB detects the crash and routes all traffic to the surviving server.
 *   Uptime stays above 98% across the full simulation.
 *
 * Cost: $20 (LB) + $150 (web1, locked) + $50 (web2/S) + $100 (db) = $320 < $400.
 */
export const level06: LevelDefinition = {
  id: 'level-06',
  chapter: 2,
  title: 'Failover',
  brief:
    'At 20 seconds into the simulation, the web server will crash and stay down ' +
    'for 20 seconds.  Right now all traffic goes through that one server — ' +
    'a crash means total outage.  Add redundancy so the system survives the failure.',
  concept: 'A load balancer detects failed nodes and routes around them — the foundation of high availability.',
  primerRef: 'Availability',

  traffic: {
    baseRps: 200,
    readWriteRatio: 0.9,
    pattern: 'steady',
    workingSetGb: 1,
  },

  requirements: {
    maxP99LatencyMs: 200,
    minUptimePercent: 98,
    maxMonthlyCostUsd: 400,
    holdDurationSeconds: 30,
    minThroughputRps: 160,
  },

  availableComponents: ['load_balancer', 'web_server'],

  prePlaced: [
    { type: 'traffic_source', tier: 'small',  locked: true },
    { type: 'web_server',     tier: 'medium', locked: true },
    { type: 'sql_db',         tier: 'small',  locked: true },
  ],

  failureEvents: [
    { atSeconds: 20, type: 'node_crash', targetNodeId: 'web1', durationSeconds: 20 },
  ],

  hints: [
    'Run the simulation and watch what happens at t=20s.',
    'Add a Load Balancer and a second Web Server from the toolbar.',
    'Wire: Traffic → LB → Web1 + Web2 → DB.',
    'When web1 crashes, the load balancer detects it and routes all traffic to web2.',
    'A Small Web Server ($50) is enough for 200 RPS — no need for Medium.',
  ],

  winMessage: 'Failover successful. The crash at t=20s caused no noticeable uptime impact.',
  tradeoffWarning: 'Active-active failover costs double the web tier. For low-traffic services, active-passive (standby) is cheaper.',
}
