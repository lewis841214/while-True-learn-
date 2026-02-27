import { loadAllProgress, getStars, renderStars } from '../store/progress'

export interface MapLevel {
  id: string
  label: string
  title: string
  chapter: string
  chapterLabel: string
  brief: string
}

interface Props {
  levels: MapLevel[]
  activeId: string
  onSelect: (id: string) => void
  onClose: () => void
}

const CHAPTER_COLORS: Record<string, string> = {
  '0': '#818cf8',
  '1': '#22c55e',
  '2': '#f59e0b',
  '3': '#ec4899',
  '4': '#06b6d4',
  '5': '#a78bfa',
  '6': '#34d399',
  '7': '#fb923c',
  '8': '#f43f5e',
}

export function ChapterMap({ levels, activeId, onSelect, onClose }: Props) {
  const progress = loadAllProgress()

  // Group by chapter
  const chapters = [...new Set(levels.map(l => l.chapter))]

  return (
    // Backdrop
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(2, 6, 23, 0.85)',
        backdropFilter: 'blur(4px)',
        zIndex: 100,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {/* Modal panel */}
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#0f172a',
          border: '1px solid #1e293b',
          borderRadius: 16,
          padding: 32,
          width: 740,
          maxHeight: '80vh',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: 28,
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ color: '#818cf8', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>
              System Design Game
            </div>
            <div style={{ color: '#f1f5f9', fontSize: 20, fontWeight: 800 }}>Chapter Map</div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: '#1e293b',
              border: '1px solid #334155',
              borderRadius: 8,
              color: '#94a3b8',
              padding: '6px 14px',
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            ✕ Close
          </button>
        </div>

        {/* Chapters */}
        {chapters.map(ch => {
          const chLevels = levels.filter(l => l.chapter === ch)
          const color = CHAPTER_COLORS[ch] ?? '#818cf8'
          const label = chLevels[0]?.chapterLabel ?? `Chapter ${ch}`

          return (
            <div key={ch}>
              <div style={{
                color,
                fontSize: 11,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.08em',
                marginBottom: 12,
                paddingBottom: 6,
                borderBottom: `1px solid ${color}30`,
              }}>
                {label}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
                {chLevels.map(lvl => {
                  const p    = progress[lvl.id]
                  const stars = getStars(p)
                  const won   = stars > 0
                  const isActive = lvl.id === activeId

                  return (
                    <button
                      key={lvl.id}
                      onClick={() => { onSelect(lvl.id); onClose() }}
                      style={{
                        background: isActive ? '#1e3a5f' : won ? '#0f2a1d' : '#1e293b',
                        border: `1px solid ${isActive ? '#3b82f6' : won ? '#166534' : '#334155'}`,
                        borderRadius: 10,
                        padding: 14,
                        textAlign: 'left',
                        cursor: 'pointer',
                        position: 'relative',
                        transition: 'border-color 0.15s',
                      }}
                    >
                      {/* Level badge */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                        <span style={{
                          background: color + '20',
                          color,
                          fontSize: 10,
                          fontWeight: 700,
                          padding: '2px 7px',
                          borderRadius: 4,
                        }}>
                          {lvl.id === 'demo' ? 'DEMO' : `LVL ${lvl.label}`}
                        </span>
                        {won && (
                          <span style={{ color: '#fbbf24', fontSize: 13, letterSpacing: '-1px' }}>
                            {renderStars(stars)}
                          </span>
                        )}
                      </div>

                      <div style={{ color: '#f1f5f9', fontSize: 13, fontWeight: 600, marginBottom: 4 }}>
                        {lvl.title}
                      </div>
                      <div style={{
                        color: '#64748b',
                        fontSize: 11,
                        lineHeight: 1.5,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden',
                      }}>
                        {lvl.brief}
                      </div>

                      {/* Active indicator */}
                      {isActive && (
                        <div style={{
                          position: 'absolute',
                          top: 8,
                          right: 8,
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          background: '#3b82f6',
                        }} />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
