import type { LevelDefinition } from '../engine/types'

/**
 * Level 4 — Horizontal Scale
 *
 * 1,200 RPS, 90% reads.  Only a traffic source and a Medium DB are pre-placed
 * with no connections.  Nothing works until the player builds the web tier.
 * Teach: a single large server is expensive and fragile; two medium servers
 * behind a load balancer is cheaper and more resilient.
 *
 * Cheapest solution:
 *   LB/Small ($20) + 2 × Web/Medium ($300) + DB/Medium pre-placed ($300)
 *   Total: $620 < $700 budget.
 */
export const level04: LevelDefinition = {
  id: 'level-04',
  chapter: 2,
  title: 'Horizontal Scale',
  brief:
    'Your team pre-provisioned a database but forgot the web tier entirely. ' +
    '1,200 requests per second are coming in — build the missing front end. ' +
    'A single large server would work but would eat almost all of the budget. ' +
    'Can you serve the traffic more cost-effectively?',
  concept: 'Horizontal scaling: multiple smaller servers behind a load balancer beats one large server on cost and resilience.',
  primerRef: 'Load balancer',

  traffic: {
    baseRps: 1200,
    readWriteRatio: 0.9,
    pattern: 'steady',
    workingSetGb: 2,
  },

  requirements: {
    maxP99LatencyMs: 200,
    minUptimePercent: 99,
    maxMonthlyCostUsd: 700,
    holdDurationSeconds: 20,
    minThroughputRps: 960,
  },

  availableComponents: ['load_balancer', 'web_server'],

  prePlaced: [
    { type: 'traffic_source', tier: 'small',  locked: true },
    { type: 'sql_db',         tier: 'medium', locked: true },
  ],

  failureEvents: [],

  hints: [
    'Drag a Load Balancer from the toolbar onto the canvas.',
    'Connect Traffic → Load Balancer → Web Servers → Database.',
    'One Large Web Server ($400) nearly maxes the budget. Try two Medium servers ($150 each) instead.',
    'Round-robin distributes load evenly across all connected servers.',
  ],

  winMessage: 'Two servers sharing the load. Each runs at 30% utilisation — plenty of headroom.',
  tradeoffWarning: 'More servers means more deployment complexity. Consider a service mesh as you scale further.',
}
