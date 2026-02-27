import type { LevelDefinition } from '../engine/types'

export const level01: LevelDefinition = {
  id: 'level-01',
  chapter: 1,
  title: 'First Deploy',
  brief:
    'Your side project just launched. 50 users are hitting it per second. ' +
    'Connect a web server to a database and keep things running smoothly.',
  concept: 'Basic client → server → database architecture. Read the metrics.',
  primerRef: 'System design topics: start here',

  traffic: {
    baseRps: 50,
    readWriteRatio: 0.9,
    pattern: 'steady',
    workingSetGb: 1,
  },

  requirements: {
    maxP99LatencyMs: 500,
    minUptimePercent: 99.0,
    maxMonthlyCostUsd: 300,
    holdDurationSeconds: 20,
  },

  availableComponents: ['web_server', 'sql_db'],

  prePlaced: [
    { type: 'traffic_source', tier: 'small', locked: true },
  ],

  failureEvents: [],

  hints: [
    'Drag a Web Server from the toolbar onto the canvas.',
    'Connect the Traffic Source → Web Server → Database.',
    'Hit Run and watch the metrics appear on each node.',
  ],

  winMessage:
    'Clean architecture. Watch the green numbers — that\'s your system breathing.',
}
