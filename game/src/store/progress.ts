// ─── Per-level completion data ────────────────────────────────────────────────

export interface LevelProgress {
  won: boolean
  hintsUsed: number
  simTimeSec: number    // sim-time when the win condition was satisfied
}

const STORAGE_KEY = 'sysdesign-progress-v1'

export function loadAllProgress(): Record<string, LevelProgress> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}')
  } catch {
    return {}
  }
}

export function saveProgress(levelId: string, p: LevelProgress): void {
  const all = loadAllProgress()
  const existing = all[levelId]
  // Keep the best run (fewest hints, then fastest time)
  if (
    !existing?.won ||
    p.hintsUsed < existing.hintsUsed ||
    (p.hintsUsed === existing.hintsUsed && p.simTimeSec < existing.simTimeSec)
  ) {
    all[levelId] = p
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all))
  }
}

/** 3 stars = no hints; 2 = 1 hint; 1 = 2+ hints */
export function getStars(p: LevelProgress | undefined): 0 | 1 | 2 | 3 {
  if (!p?.won) return 0
  if (p.hintsUsed === 0) return 3
  if (p.hintsUsed === 1) return 2
  return 1
}

export function renderStars(stars: 0 | 1 | 2 | 3): string {
  return '★'.repeat(stars) + '☆'.repeat(3 - stars)
}
