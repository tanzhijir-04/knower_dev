import { useState, useRef, useEffect } from 'react'
import { ClockCounterClockwise, Star, Trash, CaretRight, CaretDown, X } from '@phosphor-icons/react'
import { staggerIn } from '../../lib/gsap'
import type { TopicHistory, TopicSuggestion } from '../../types/electron'

interface Props {
  history: TopicHistory[]
  onStar: (id: number) => void
  onDelete: (id: number) => void
  onSelect: (topics: TopicSuggestion[]) => void
  onClose: () => void
}

const MODE_LABELS: Record<string, string> = {
  trend: '热点趋势',
  differentiated: '差异化',
  competitor: '竞品对标',
  series: '系列化',
}

const PLATFORM_LABELS: Record<string, string> = {
  bili: 'B站',
  dy: '抖音',
  xhs: '小红书',
  wb: '微博',
}

function groupByDate(items: TopicHistory[]) {
  const groups: { label: string; items: TopicHistory[] }[] = []
  const now = new Date()
  const today = now.toDateString()
  const yesterday = new Date(now.getTime() - 86400000).toDateString()

  for (const item of items) {
    const d = new Date(item.createdAt)
    const dateStr = d.toDateString()
    let label: string
    if (dateStr === today) label = '今天'
    else if (dateStr === yesterday) label = '昨天'
    else label = `${d.getMonth() + 1}月${d.getDate()}日`

    const last = groups[groups.length - 1]
    if (last && last.label === label) {
      last.items.push(item)
    } else {
      groups.push({ label, items: [item] })
    }
  }
  return groups
}

export default function HistoryPanel({ history, onStar, onDelete, onSelect, onClose }: Props) {
  const panelRef = useRef<HTMLDivElement>(null)
  const groups = groupByDate(history)

  useEffect(() => {
    if (panelRef.current) {
      const items = panelRef.current.querySelectorAll('[data-history-item]')
      if (items.length) staggerIn(Array.from(items) as HTMLElement[], { stagger: 0.05, y: 8 })
    }
  }, [history])

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/20" />

      {/* Panel */}
      <div
        ref={panelRef}
        className="relative w-[420px] h-full bg-canvas border-l border-hairline flex flex-col shadow-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-hairline shrink-0">
          <div className="flex items-center gap-2">
            <ClockCounterClockwise className="w-4 h-4 text-primary" weight="fill" />
            <span className="text-title-sm text-ink">选题记录</span>
            <span className="text-caption text-muted">({history.length})</span>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-full flex items-center justify-center text-muted hover:bg-hairline transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {history.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <ClockCounterClockwise className="w-9 h-9 text-muted mb-3" weight="fill" />
              <p className="text-body-sm text-muted mb-1">暂无历史记录</p>
              <p className="text-caption text-muted">AI 生成选题后会自动保存到这里</p>
            </div>
          ) : (
            <div className="space-y-5">
              {groups.map((group) => (
                <HistoryGroup
                  key={group.label}
                  group={group}
                  onStar={onStar}
                  onDelete={onDelete}
                  onSelect={onSelect}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function HistoryGroup({ group, onStar, onDelete, onSelect }: {
  group: { label: string; items: TopicHistory[] }
  onStar: (id: number) => void
  onDelete: (id: number) => void
  onSelect: (topics: TopicSuggestion[]) => void
}) {
  return (
    <div>
      <h3 className="text-caption-uppercase text-muted mb-2 px-1">{group.label}</h3>
      <div className="space-y-2">
        {group.items.map((record) => (
          <HistoryRecord
            key={record.id}
            record={record}
            onStar={onStar}
            onDelete={onDelete}
            onSelect={onSelect}
          />
        ))}
      </div>
    </div>
  )
}

function HistoryRecord({ record, onStar, onDelete, onSelect }: {
  record: TopicHistory
  onStar: (id: number) => void
  onDelete: (id: number) => void
  onSelect: (topics: TopicSuggestion[]) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const firstTopic = record.topics?.[0]

  return (
    <div
      data-history-item
      className="bg-surface border border-hairline rounded-lg overflow-hidden"
    >
      {/* Record header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <button
          onClick={() => setExpanded(!expanded)}
          className="text-muted hover:text-ink transition-colors"
        >
          {expanded
            ? <CaretDown className="w-4 h-4" weight="fill" />
            : <CaretRight className="w-4 h-4" weight="fill" />}
        </button>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-caption text-ink font-medium">
              {PLATFORM_LABELS[record.platform] || record.platform}
            </span>
            <span className="text-[10px] bg-surface-strong text-body px-1.5 py-0.5 rounded">
              {MODE_LABELS[record.mode] || record.mode}
            </span>
            <span className="text-[10px] text-muted">
              {record.topicCount} 个选题
            </span>
          </div>
          {firstTopic && (
            <p className="text-[11px] text-muted mt-0.5 truncate">
              {firstTopic.title}
              {record.topicCount > 1 && ` 等 ${record.topicCount} 个`}
            </p>
          )}
        </div>

        <span className="text-[10px] text-muted shrink-0">
          {new Date(record.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
        </span>

        <button
          onClick={(e) => { e.stopPropagation(); onStar(record.id) }}
          className={`transition-colors ${record.isStarred ? 'text-yellow-500' : 'text-muted hover:text-yellow-500'}`}
        >
          <Star className="w-4 h-4" weight={record.isStarred ? 'fill' : 'regular'} />
        </button>

        <button
          onClick={(e) => { e.stopPropagation(); onDelete(record.id) }}
          className="text-muted hover:text-semantic-error transition-colors"
        >
          <Trash className="w-4 h-4" />
        </button>
      </div>

      {/* Expanded topics */}
      {expanded && record.topics && record.topics.length > 0 && (
        <div className="px-4 pb-3 border-t border-hairline pt-3">
          <div className="space-y-2">
            {record.topics.map((topic, i) => (
              <div
                key={i}
                onClick={() => onSelect(record.topics)}
                className="p-3 border border-hairline rounded-md cursor-pointer hover:border-primary/30 transition-colors"
              >
                <p className="text-body-sm text-ink font-medium">{topic.title}</p>
                {topic.overallScore != null && (
                  <span className="text-[10px] text-primary mt-1 inline-block">热度 {topic.overallScore}/100</span>
                )}
              </div>
            ))}
          </div>
          <button
            onClick={() => onSelect(record.topics)}
            className="w-full mt-3 py-2 text-body-sm text-primary hover:bg-primary/5 rounded-md transition-colors"
          >
            查看全部选题
          </button>
        </div>
      )}
    </div>
  )
}
