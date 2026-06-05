import { useRef, useEffect } from 'react'
import { CaretDown, ArrowLeft } from '@phosphor-icons/react'
import { staggerIn } from '../../lib/gsap'
import type { TopicSuggestion } from '../../types/electron'

interface Props {
  topics: TopicSuggestion[]
  onSelect: (idx: number) => void
  onBack?: () => void
}

export default function ResultsState({ topics, onSelect, onBack }: Props) {
  const cardRefs = useRef<HTMLDivElement[]>([])

  useEffect(() => {
    const els = cardRefs.current.filter(Boolean)
    if (els.length) staggerIn(els, { stagger: 0.1, y: 12 })
  }, [])

  return (
    <div className="flex-1 overflow-y-auto px-8 py-10">
      <div className="max-w-[900px] mx-auto">
        {/* Back button + header */}
        {onBack && (
          <div className="flex items-center gap-3 mb-6">
            <button
              onClick={onBack}
              className="w-8 h-8 rounded-full flex items-center justify-center text-muted hover:bg-hairline transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <span className="text-body-sm text-muted">返回</span>
          </div>
        )}

        {/* Header caption */}
        <p className="text-caption text-muted mb-6">
          为你生成了 {topics.length} 个基于趋势的高潜力选题
        </p>

        {/* Topic cards */}
        <div className="space-y-4">
          {topics.map((topic, i) => (
            <div
              key={i}
              ref={(el) => { cardRefs.current[i] = el! }}
              onClick={() => onSelect(i)}
              className="bg-surface border border-hairline rounded-lg p-6 cursor-pointer hover:border-hairline-strong transition-colors group"
            >
              {/* Title row */}
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-title-md text-ink group-hover:text-primary transition-colors">
                  {topic.title}
                </h3>
                <CaretDown className="w-5 h-5 text-muted shrink-0 mt-1" weight="fill" />
              </div>

              {/* Reason */}
              <p className="text-body-md text-muted mb-6 leading-relaxed">
                <span className="text-primary">推荐理由：</span>
                {topic.reason}
              </p>

              {/* Score pills */}
              <div className="flex flex-wrap gap-3 mb-4">
                {topic.overallScore != null && (
                  <div className="flex items-center gap-2 px-3 py-1 bg-primary/10 rounded-pill text-primary text-caption-uppercase border border-primary/20">
                    <span className="opacity-70">热度:</span>
                    {topic.overallScore}/100
                  </div>
                )}
                {topic.competitionLevel && (
                  <div className="flex items-center gap-2 px-3 py-1 bg-surface-strong rounded-pill text-muted text-caption-uppercase border border-hairline">
                    <span className="opacity-70">竞争度:</span>
                    {topic.competitionLevel}
                  </div>
                )}
                {topic.urgency && (
                  <div className="flex items-center gap-2 px-3 py-1 bg-surface-strong rounded-pill text-muted text-caption-uppercase border border-hairline">
                    <span className="opacity-70">时效性:</span>
                    {topic.urgency}
                  </div>
                )}
              </div>

              {/* Tags */}
              {topic.tags?.length > 0 && (
                <div className="flex gap-2">
                  {topic.tags.slice(0, 4).map((tag, j) => (
                    <span key={j} className="text-caption bg-surface-strong text-muted px-2 py-0.5 rounded-md">
                      {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
