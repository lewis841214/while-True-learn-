import type { LevelDefinition } from '../engine/types'

/**
 * Level 15 — The Edge  (Chapter 6 · Global Scale)
 *
 * 15 000 RPS, 95% static reads (images, JS bundles, HTML).
 * Without a CDN: 15 000 RPS hits the origin web servers.
 * Even with Large Web Servers (max ~10 000 RPS each), you'd need 2+ and they're $300 each.
 *
 * Fix: add a Small CDN ($20/mo) in front of the web servers.
 *   Small CDN: 50 000 RPS capacity, 80% static hit rate.
 *   80% of 15 000 = 12 000 requests served at the edge (5ms).
 *   Only 3 000 requests reach origin web servers.
 *   2× Medium Web Servers ($100 each) can handle 3 000 RPS with ease.
 *
 * Cost: $20 src + $50 LB + CDN $20 + 2×$100 web + $100 DB = $390 < $500.
 */
export const level15: LevelDefinition = {
  id: 'level-15',
  chapter: 6,
  title: 'The Edge',
  brief:
    '15 000 RPS — 95 % of it is static content (images, CSS, JS). ' +
    'Your origin servers are overwhelmed and p99 is 800 ms. ' +
    'Move the static content to the edge.',
  concept:
    'A CDN caches static assets at edge nodes worldwide. Cache hits are served ' +
    'in ~5 ms without touching the origin, reducing both latency and origin load. ' +
    'The cache hit rate determines how much traffic reaches your servers.',
  primerRef: 'Content delivery network',

  traffic: {
    baseRps: 15_000,
    readWriteRatio: 0.95,
    pattern: 'steady',
    workingSetGb: 10,
  },

  requirements: {
    maxP99LatencyMs: 50,
    minUptimePercent: 99,
    maxMonthlyCostUsd: 500,
    holdDurationSeconds: 30,
    minThroughputRps: 12_000,
  },

  availableComponents: ['cdn', 'web_server', 'sql_db', 'cache'],

  prePlaced: [
    { type: 'traffic_source', tier: 'small', locked: true },
    { type: 'load_balancer',  tier: 'small', locked: true },
    { type: 'web_server',     tier: 'large',  locked: false },
    { type: 'web_server',     tier: 'large',  locked: false },
    { type: 'sql_db',         tier: 'medium', locked: false },
  ],

  failureEvents: [],

  hints: [
    'Run the sim. 15 000 RPS is overwhelming the Large Web Servers — and costing $650/mo.',
    'Add a CDN from the toolbar. Place it BEFORE the load balancer: Traffic → CDN → LB → Web.',
    'The Small CDN serves 80% of reads at the edge — only 3 000 RPS reaches origin.',
    'With lower origin load, downgrade Large Web Servers to Medium ($100 each).',
    'Total cost: CDN $20 + 2× Medium Web $200 + Medium DB $300 = ~$620. Downgrade DB to Small to hit budget.',
  ],

  winMessage:
    '12 000 requests/s never touch your servers. CDN is the single best latency ' +
    'improvement for read-heavy, static-content apps — and often the cheapest.',
  tradeoffWarning:
    'CDN caching means deploys require cache invalidation. Without it, users see ' +
    'stale JS/CSS for up to the cache TTL (often hours). Use versioned asset URLs to bust caches.',
}
