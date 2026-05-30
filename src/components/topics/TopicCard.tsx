import type { TopicSuggestion } from '../../types/electron'
import { gsap } from '../../lib/gsap'

interface Props {
  topic: TopicSuggestion
  onClick: () => void
  isActive: boolean
}

const sourceColors: Record<string, string> = {
  '历史高互动': 'bg-blue-500/15 text-blue-400',
  '当前趋势': 'bg-orange-500/15 text-orange-400',
  '结合两者': 'bg-purple-500/15 text-purple-400',
}

const perfColors: Record<string, string> = {
  '高': 'text-green-400',
  '中': 'text-yellow-400',
  '参考同类': 'text-body',
}

export default function TopicCard({ topic, onClick, isActive }: Props) {
  const handleHover = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!isActive) gsap.to(e.currentTarget, { scale: 1.015, duration: 0.2, ease: 'power2.out' })
  }
  const handleLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
    gsap.to(e.currentTarget, { scale: 1, duration: 0.2, ease: 'power2.out' })
  }

  return (
    <button
      onClick={onClick}
      onMouseEnter={handleHover}
      onMouseLeave={handleLeave}
      className={`w-full text-left p-4 rounded-xl border transition-all ${
        isActive
          ? 'border-primary/50 bg-primary/5'
          : 'border-hairline/20 bg-surface-low hover:border-hairline/40 hover:bg-canvas-soft'
      }`}
    >
      <h3 className="text-sm font-medium text-ink mb-2 line-clamp-2">{topic.title}</h3>
      <p className="text-xs text-body mb-3 line-clamp-2">{topic.reason}</p>
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${sourceColors[topic.source] || 'bg-hairline text-body'}`}>
          {topic.source}
        </span>
        <span className={`text-[10px] ${perfColors[topic.estimatedPerformance] || 'text-body'}`}>
          {topic.estimatedPerformance}
        </span>
      </div>
      {topic.tags && topic.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {topic.tags.slice(0, 3).map((tag, i) => (
            <span key={i} className="text-[10px] bg-hairline text-body px-1.5 py-0.5 rounded">
              #{tag}
            </span>
          ))}
          {topic.tags.length > 3 && (
            <span className="text-[10px] text-muted">+{topic.tags.length - 3}</span>
          )}
        </div>
      )}
    </button>
  )
}
