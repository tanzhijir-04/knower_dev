import { useState } from 'react'
import { X, PaperPlaneRight } from '@phosphor-icons/react'
import type { TopicSuggestion } from '../../types/electron'

interface Props {
  topic: TopicSuggestion
  onConfirm: (extra: { duration?: string; requirements?: string; referenceUrl?: string }) => void
  onCancel: () => void
}

export default function TopicConfirmDialog({ topic, onConfirm, onCancel }: Props) {
  const [duration, setDuration] = useState('')
  const [requirements, setRequirements] = useState('')
  const [referenceUrl, setReferenceUrl] = useState('')

  const handleConfirm = () => {
    onConfirm({
      duration: duration.trim() || undefined,
      requirements: requirements.trim() || undefined,
      referenceUrl: referenceUrl.trim() || undefined,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-96 bg-surface-low rounded-xl border border-hairline/30 shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-hairline/20">
          <h3 className="text-sm font-medium text-ink">发送到创作台</h3>
          <button onClick={onCancel} className="p-1 hover:bg-canvas-soft rounded-lg transition-colors">
            <X className="w-4 h-4 text-muted" />
          </button>
        </div>

        {/* Content */}
        <div className="px-4 py-4 space-y-4">
          {/* 选题预览 */}
          <div className="p-3 bg-canvas-soft rounded-lg">
            <p className="text-sm font-medium text-ink mb-1">{topic.title}</p>
            <p className="text-xs text-muted line-clamp-2">{topic.reason}</p>
          </div>

          {/* 补充信息表单 */}
          <div className="space-y-3">
            <div>
              <label className="text-xs text-muted block mb-1">目标时长（可选）</label>
              <input
                value={duration}
                onChange={e => setDuration(e.target.value)}
                placeholder="如：3-5分钟"
                className="w-full px-3 py-2 text-xs bg-canvas border border-hairline/30 rounded-lg text-ink placeholder:text-muted focus:outline-none focus:border-primary/50"
              />
            </div>
            <div>
              <label className="text-xs text-muted block mb-1">特殊要求（可选）</label>
              <textarea
                value={requirements}
                onChange={e => setRequirements(e.target.value)}
                placeholder="如：需要包含实操演示、语速要快..."
                rows={2}
                className="w-full px-3 py-2 text-xs bg-canvas border border-hairline/30 rounded-lg text-ink placeholder:text-muted focus:outline-none focus:border-primary/50 resize-none"
              />
            </div>
            <div>
              <label className="text-xs text-muted block mb-1">参考视频链接（可选）</label>
              <input
                value={referenceUrl}
                onChange={e => setReferenceUrl(e.target.value)}
                placeholder="https://..."
                className="w-full px-3 py-2 text-xs bg-canvas border border-hairline/30 rounded-lg text-ink placeholder:text-muted focus:outline-none focus:border-primary/50"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 px-4 py-3 border-t border-hairline/20">
          <button
            onClick={onCancel}
            className="flex-1 px-3 py-2 text-xs text-muted hover:text-ink bg-canvas-soft rounded-lg hover:bg-hairline transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs bg-primary/15 text-primary rounded-lg hover:bg-primary/25 transition-colors"
          >
            <PaperPlaneRight className="w-3.5 h-3.5" weight="fill" />
            确认发送
          </button>
        </div>
      </div>
    </div>
  )
}
