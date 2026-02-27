import type { LevelDefinition } from '../engine/types'

/**
 * Demo level: pre-wired full-stack graph so you can hit Run immediately.
 *
 * Topology: Traffic → LB → [Web1, Web2] → Cache → DB
 *   - 900 RPS, 95% reads, 4 GB working set
 *   - Cache (8 GB) → ~95% hit rate → only ~43 RPS reach the DB
 *   - Web servers run at ~90% utilisation — you can see the pressure
 *   - DB is barely loaded, protected by the cache
 *
 * Swap the cache out to watch DB utilisation spike to >90%.
 */
export const levelDemo: LevelDefinition = {
  id: 'level-demo',
  chapter: 0,
  title: 'Demo: Full-Stack Under Load',
  brief:
    '900 requests/sec hit a load-balanced pair of web servers. ' +
    'A cache absorbs 95% of reads, keeping the database comfortable. ' +
    'Watch each node\'s live utilisation — then pause and remove the cache to see what happens.',
  concept: 'Load balancing + caching dramatically extend a system\'s capacity without upgrading hardware.',
  primerRef: '',

  traffic: {
    baseRps: 900,
    readWriteRatio: 0.95,
    pattern: 'steady',
    workingSetGb: 4,
  },

  requirements: {
    maxP99LatencyMs: 800,
    minUptimePercent: 95,
    maxMonthlyCostUsd: 5000,
    holdDurationSeconds: 10,
  },

  availableComponents: [
    'web_server', 'sql_db', 'cache', 'load_balancer', 'rate_limiter',
  ],

  prePlaced: [],
  failureEvents: [],

  hints: [
    'Web servers are at ~90% utilisation — each handles ~450 RPS of its 500 RPS capacity.',
    'The cache (8 GB, 4 GB working set) achieves ~95% hit rate. Only ~45 RPS reach the DB.',
    'Pause, delete the cache edge, and reconnect Web → DB directly — watch the DB utilisation jump.',
    'Try upgrading one web server to Medium and observe how load redistributes.',
  ],

  winMessage: 'System stable. Cache is doing its job — the database barely notices 900 RPS.',
}
