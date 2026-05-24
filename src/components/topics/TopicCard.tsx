import type { TopicSuggestion } from '../../types/electron'

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
  '参考同类': 'text-on-surface-variant',
}

export default function TopicCard({ topic, onClick, isActive }: Props) {
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-4 rounded-xl border transition-all ${
        isActive
          ? 'border-primary/50 bg-primary/5'
          : 'border-outline-variant/20 bg-surface-low hover:border-outline-variant/40 hover:bg-surface-container'
      }`}
    >
      <h3 className="text-sm font-medium text-on-surface mb-2 line-clamp-2">{topic.title}</h3>
      <p className="text-xs text-body mb-3 line-clamp-2">{topic.reason}</p>
      <div className="flex items-center gap-2 flex-wrap">
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${sourceColors[topic.source] || 'bg-surface-container text-on-surface-variant'}`}>
          {topic.source}
        </span>
        <span className={`text-[10px] ${perfColors[topic.estimatedPerformance] || 'text-on-surface-variant'}`}>
          {topic.estimatedPerformance}
        </span>
      </div>
      {topic.tags && topic.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {topic.tags.slice(0, 3).map((tag, i) => (
            <span key={i} className="text-[10px] bg-surface-highest text-on-surface-variant px-1.5 py-0.5 rounded">
              #{tag}
            </span>
          ))}
          {topic.tags.length > 3 && (
            <span className="text-[10px] text-mute">+{topic.tags.length - 3}</span>
          )}
        </div>
      )}
    </button>
  )
}
