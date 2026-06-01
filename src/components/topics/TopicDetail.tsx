import type { TopicSuggestion } from '../../types/electron'
import { ChatCircle, BookmarkSimple } from '@phosphor-icons/react'

interface Props {
  topic: TopicSuggestion
  onSave: () => void
  onSendToChat: () => void
}

const SCORE_LABELS: { key: keyof NonNullable<TopicSuggestion['scores']>; label: string; color: string }[] = [
  { key: 'heat', label: '热度匹配', color: 'bg-red-400' },
  { key: 'competition', label: '竞争度', color: 'bg-orange-400' },
  { key: 'feasibility', label: '可执行性', color: 'bg-blue-400' },
  { key: 'fit', label: '账号契合', color: 'bg-purple-400' },
  { key: 'urgency', label: '时效性', color: 'bg-yellow-400' },
]

function getScoreLabel(score: number) {
  if (score >= 80) return { text: '高', cls: 'text-green-400' }
  if (score >= 60) return { text: '中', cls: 'text-yellow-400' }
  return { text: '低', cls: 'text-red-400' }
}

export default function TopicDetail({ topic, onSave, onSendToChat }: Props) {
  return (
    <div className="bg-surface-low rounded-xl p-5 border border-hairline/20">
      <div className="flex items-start justify-between gap-3 mb-3">
        <h3 className="text-base font-medium text-ink flex-1">{topic.title}</h3>
        {topic.overallScore != null && (
          <div className="text-center shrink-0">
            <div className={`text-2xl font-mono font-bold ${getScoreLabel(topic.overallScore).cls}`}>
              {topic.overallScore}
            </div>
            <div className="text-[10px] text-muted">综合评分</div>
          </div>
        )}
      </div>

      <div className="space-y-4">
        <div>
          <span className="text-xs text-muted block mb-1">推荐理由</span>
          <p className="text-sm text-ink">{topic.reason}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className="text-xs text-muted block mb-1">灵感来源</span>
            <span className="text-sm text-ink">{topic.source}</span>
          </div>
          <div>
            <span className="text-xs text-muted block mb-1">预估表现</span>
            <span className="text-sm text-ink">{topic.estimatedPerformance}</span>
          </div>
        </div>

        {topic.scores && (
          <div>
            <span className="text-xs text-muted block mb-2">评分详情</span>
            <div className="space-y-2">
              {SCORE_LABELS.map(({ key, label, color }) => {
                const val = topic.scores![key]
                const barWidth = key === 'competition' ? 100 - val : val
                return (
                  <div key={key} className="flex items-center gap-2">
                    <span className="text-[11px] text-muted w-16 shrink-0">{label}</span>
                    <div className="flex-1 h-1.5 bg-hairline rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${color}`} style={{ width: `${barWidth}%` }} />
                    </div>
                    <span className="text-[11px] text-ink font-mono w-6 text-right">{val}</span>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        <div className="flex gap-3 text-[11px] text-muted">
          {topic.competitionLevel && <span>竞争: {topic.competitionLevel}</span>}
          {topic.urgency && <span>时效: {topic.urgency}</span>}
        </div>

        {topic.tags && topic.tags.length > 0 && (
          <div>
            <span className="text-xs text-muted block mb-1.5">建议标签</span>
            <div className="flex flex-wrap gap-1.5">
              {topic.tags.map((tag, i) => (
                <span key={i} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                  #{tag}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <button
            onClick={onSendToChat}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-primary/15 text-primary text-sm rounded-lg hover:bg-primary/25 transition-colors"
          >
            <ChatCircle className="w-4 h-4" weight="fill" />
            发到创作台
          </button>
          <button
            onClick={onSave}
            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-canvas-soft text-body text-sm rounded-lg hover:bg-hairline transition-colors"
          >
            <BookmarkSimple className="w-4 h-4" weight="fill" />
            收藏
          </button>
        </div>
      </div>
    </div>
  )
}
