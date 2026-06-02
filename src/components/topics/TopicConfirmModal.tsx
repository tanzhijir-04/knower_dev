import { useState, useEffect, useRef } from 'react'
import { modalEnter, modalExit } from '../../lib/gsap'
import type { TopicSuggestion } from '../../types/electron'

interface Props {
  topic: TopicSuggestion
  onConfirm: (data: { duration: string; requirements: string }) => void
  onCancel: () => void
}

export default function TopicConfirmModal({ topic, onConfirm, onCancel }: Props) {
  const [duration, setDuration] = useState('')
  const [requirements, setRequirements] = useState('')
  const overlayRef = useRef<HTMLDivElement>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (overlayRef.current && contentRef.current) {
      modalEnter(overlayRef.current, contentRef.current)
    }
  }, [])

  const handleClose = () => {
    if (overlayRef.current && contentRef.current) {
      modalExit(overlayRef.current, contentRef.current, onCancel)
    } else {
      onCancel()
    }
  }

  const handleConfirm = () => {
    if (overlayRef.current && contentRef.current) {
      modalExit(overlayRef.current, contentRef.current, () => onConfirm({ duration, requirements }))
    } else {
      onConfirm({ duration, requirements })
    }
  }

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={handleClose}
    >
      <div
        ref={contentRef}
        className="w-full max-w-[512px] bg-surface border border-hairline rounded-lg p-8 space-y-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <h2 className="text-display-sm text-ink mb-2" style={{ fontWeight: 600 }}>确认进入创作状态</h2>
          <p className="text-body-sm text-muted">我们将根据上述选题和大纲为您初始化创作工作台。</p>
        </div>

        {/* Topic preview */}
        <div className="bg-canvas-soft p-4 rounded-lg border border-hairline">
          <h4 className="text-caption-uppercase text-muted mb-2">选题 + 大纲预览</h4>
          <p className="text-body-sm text-ink font-medium mb-2">主题：{topic.title}</p>
          <div className="text-caption text-muted leading-loose">
            {topic.reason}
          </div>
        </div>

        {/* Form fields */}
        <div className="space-y-4">
          <div>
            <label className="block text-caption text-muted mb-2">目标时长</label>
            <input
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="例如：3-5分钟"
              className="w-full bg-surface border border-hairline rounded-md px-4 py-2 text-body-sm text-ink outline-none focus:border-primary transition-colors"
            />
          </div>
          <div>
            <label className="block text-caption text-muted mb-2">特殊要求</label>
            <textarea
              value={requirements}
              onChange={(e) => setRequirements(e.target.value)}
              placeholder="例如：风格偏向活泼，加入表情包"
              className="w-full bg-surface border border-hairline rounded-md px-4 py-2 text-body-sm text-ink outline-none focus:border-primary transition-colors h-24 resize-none"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            onClick={handleClose}
            className="flex-1 py-3 border border-hairline rounded-md text-muted text-button hover:text-ink transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 py-3 bg-primary text-on-primary rounded-md text-button font-semibold hover:bg-primary-active transition-colors"
          >
            确认并进入创作台
          </button>
        </div>
      </div>
    </div>
  )
}
