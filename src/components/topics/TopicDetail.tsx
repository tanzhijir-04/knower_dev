import type { TopicSuggestion } from '../../types/electron'

interface Props {
  topic: TopicSuggestion
  onSave: () => void
  onSendToChat: () => void
}

export default function TopicDetail({ topic, onSave, onSendToChat }: Props) {
  return (
    <div className="bg-surface-low rounded-xl p-5 border border-outline-variant/20">
      <h3 className="text-base font-medium text-on-surface mb-3">{topic.title}</h3>

      <div className="space-y-4">
        <div>
          <span className="text-xs text-mute block mb-1">推荐理由</span>
          <p className="text-sm text-on-surface">{topic.reason}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className="text-xs text-mute block mb-1">灵感来源</span>
            <span className="text-sm text-on-surface">{topic.source}</span>
          </div>
          <div>
            <span className="text-xs text-mute block mb-1">预估表现</span>
            <span className="text-sm text-on-surface">{topic.estimatedPerformance}</span>
          </div>
        </div>

        {topic.tags && topic.tags.length > 0 && (
          <div>
            <span className="text-xs text-mute block mb-1.5">建议标签</span>
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
            <span className="material-symbols-outlined text-[16px]">chat</span>
            发到创作台
          </button>
          <button
            onClick={onSave}
            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-surface-container text-on-surface-variant text-sm rounded-lg hover:bg-surface-highest transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">bookmark</span>
            收藏
          </button>
        </div>
      </div>
    </div>
  )
}
