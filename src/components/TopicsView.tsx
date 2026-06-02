import { useState, useEffect, useCallback } from 'react'
import { usePlatform } from '../contexts/PlatformContext'
import TrendPanel from './topics/TrendPanel'
import CompetitorPanel from './topics/CompetitorPanel'
import TopicCard from './topics/TopicCard'
import TopicDetail from './topics/TopicDetail'
import { PlayCircle, Palette, Tag, BookmarkSimple, Sparkle, Lightbulb, ClockCounterClockwise, Star, Trash, CaretRight, CaretDown } from '@phosphor-icons/react'
import type { TopicSuggestion, TrendData, SavedTopic, Competitor, TopicHistory } from '../types/electron'

interface Props {
  onSendToChat?: (topic: TopicSuggestion) => void
}

const PLATFORMS = [
  { key: 'bili', label: 'B站', Icon: PlayCircle },
  { key: 'dy', label: '抖音', Icon: Palette },
  { key: 'xhs', label: '小红书', Icon: Sparkle },
  { key: 'wb', label: '微博', Icon: Tag },
] as const

export default function TopicsView({ onSendToChat }: Props) {
  const [platform, setPlatform] = useState<string>('bili')
  const [trends, setTrends] = useState<TrendData[]>([])
  const [trendsLoading, setTrendsLoading] = useState(false)
  const [topics, setTopics] = useState<TopicSuggestion[]>([])
  const [generating, setGenerating] = useState(false)
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null)
  const [savedTopics, setSavedTopics] = useState<SavedTopic[]>([])
  const [showSaved, setShowSaved] = useState(false)
  const [status, setStatus] = useState('')
  const [competitors, setCompetitors] = useState<Competitor[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [historyList, setHistoryList] = useState<TopicHistory[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)
  const [expandedHistoryId, setExpandedHistoryId] = useState<number | null>(null)
  const { isWindows } = usePlatform()

  const api = window.electronAPI

  const loadTrends = useCallback(async () => {
    if (!api) return
    setTrendsLoading(true)
    try {
      const data = await api.getTopicTrends(platform)
      setTrends(data)
    } catch { /* ignore */ }
    setTrendsLoading(false)
  }, [api, platform])

  const loadSavedTopics = useCallback(async () => {
    if (!api) return
    const data = await api.getSavedTopics(platform)
    setSavedTopics(data)
  }, [api, platform])

  const loadCompetitors = useCallback(async () => {
    if (!api?.listCompetitors) return
    const data = await api.listCompetitors(platform)
    setCompetitors(data)
  }, [api, platform])

  const loadHistory = useCallback(async () => {
    if (!api?.getTopicHistory) return
    setHistoryLoading(true)
    const data = await api.getTopicHistory(platform)
    setHistoryList(data)
    setHistoryLoading(false)
  }, [api, platform])

  useEffect(() => { loadHistory() }, [loadHistory])

  useEffect(() => { loadTrends() }, [loadTrends])
  useEffect(() => { loadSavedTopics() }, [loadSavedTopics])
  useEffect(() => { loadCompetitors() }, [loadCompetitors])

  const handleGenerate = async () => {
    if (!api) return
    setGenerating(true)
    setSelectedIdx(null)
    setStatus('AI 正在分析趋势并生成选题...')

    try {
      const result = await api.suggestTopics(platform)
      if (result.error) {
        setStatus(`生成失败: ${result.error}`)
      } else {
        setTopics(result.topics || [])
        setStatus(result.topics?.length ? `已生成 ${result.topics.length} 个选题` : '暂无可用选题')
        setTimeout(() => setStatus(''), 3000)
      }
    } catch {
      setStatus('生成失败，请重试')
    }
    setGenerating(false)
  }

  const handleSave = async (topic: TopicSuggestion) => {
    if (!api) return
    await api.saveTopic({
      platform,
      title: topic.title,
      reason: topic.reason,
      source: topic.source,
      estimatedPerformance: topic.estimatedPerformance,
      tags: topic.tags,
      fullData: topic,
    })
    loadSavedTopics()
    setStatus('已收藏')
    setTimeout(() => setStatus(''), 2000)
  }

  const handleSendToChat = (topic: TopicSuggestion) => {
    const platformMap: Record<string, string> = { bili: 'bilibili', dy: 'douyin', xhs: 'xiaohongshu', wb: 'weibo' }
    onSendToChat?.({
      ...topic,
      platforms: topic.platforms?.length ? topic.platforms : [platformMap[platform] || platform],
    })
  }

  const handleStarHistory = async (id: number) => {
    if (!api?.starTopicHistory) return
    await api.starTopicHistory(id)
    loadHistory()
  }

  const handleDeleteHistory = async (id: number) => {
    if (!api?.deleteTopicHistory) return
    await api.deleteTopicHistory(id)
    loadHistory()
  }

  function groupHistoryByDate(items: TopicHistory[]) {
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

  const displayTopics = showSaved
    ? savedTopics.map(s => ({
        title: s.title,
        reason: s.reason,
        source: s.source,
        estimatedPerformance: s.estimatedPerformance,
        tags: s.tags,
        scores: s.fullData?.scores as TopicSuggestion['scores'],
        overallScore: s.fullData?.overallScore as number | undefined,
        urgency: s.fullData?.urgency as string | undefined,
        competitionLevel: s.fullData?.competitionLevel as string | undefined,
      }))
    : topics

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <header className={`titlebar-drag h-12 flex items-center px-5 shrink-0 gap-3 ${isWindows ? '' : 'border-b border-hairline'}`}>
        <h1 className="text-sm font-medium text-ink no-drag">灵感库</h1>
        <div className="flex-1" />
        {/* Platform selector */}
        <div className="flex items-center gap-1 no-drag">
          {PLATFORMS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPlatform(p.key)}
              className={`px-2.5 py-1 text-xs rounded-lg transition-colors ${
                platform === p.key
                  ? 'bg-primary/15 text-primary'
                  : 'text-muted hover:text-ink hover:bg-canvas-soft'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="w-px h-5 bg-hairline no-drag" />
        <button
          onClick={() => { setShowSaved(false); setShowHistory(!showHistory); }}
          className={`no-drag text-xs px-2.5 py-1 rounded-lg transition-colors ${
            showHistory ? 'bg-primary/15 text-primary' : 'text-muted hover:text-ink hover:bg-canvas-soft'
          }`}
        >
          <ClockCounterClockwise className="w-4 h-4 align-middle mr-1" weight="fill" />
          历史
        </button>
        <button
          onClick={() => { setShowHistory(false); setShowSaved(!showSaved); }}
          className={`no-drag text-xs px-2.5 py-1 rounded-lg transition-colors ${
            showSaved ? 'bg-primary/15 text-primary' : 'text-muted hover:text-ink hover:bg-canvas-soft'
          }`}
        >
          <BookmarkSimple className="w-4 h-4 align-middle mr-1" weight="fill" />
          收藏 ({savedTopics.length})
        </button>
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="no-drag flex items-center gap-1 px-3 py-1.5 bg-primary/15 text-primary text-xs rounded-lg hover:bg-primary/20 transition-colors disabled:opacity-50"
        >
          {generating ? (
            <>
              <span className="inline-block w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
              生成中...
            </>
          ) : (
            <>
              <Sparkle className="w-4 h-4" weight="fill" />
              AI 生成选题
            </>
          )}
        </button>
      </header>

      {status && (
        <div className="px-5 py-2 bg-primary/5 border-b border-primary/20 text-xs text-primary">
          {status}
        </div>
      )}

      {/* Content */}
      {showHistory ? (
        /* History view */
        <div className="flex-1 overflow-y-auto p-4">
          {historyLoading ? (
            <div className="flex items-center justify-center h-full">
              <span className="inline-block w-1.5 h-1.5 bg-primary rounded-full animate-pulse mr-2" />
              <span className="text-xs text-muted">加载中...</span>
            </div>
          ) : historyList.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <ClockCounterClockwise className="w-9 h-9 text-muted mb-3" weight="fill" />
              <p className="text-sm text-muted mb-1">暂无历史记录</p>
              <p className="text-xs text-muted">AI 生成选题后会自动保存到这里</p>
            </div>
          ) : (
            <div className="space-y-4 max-w-3xl mx-auto">
              {groupHistoryByDate(historyList).map(group => (
                <div key={group.label}>
                  <h3 className="text-xs font-medium text-muted mb-2 px-1">{group.label}</h3>
                  <div className="space-y-2">
                    {group.items.map(record => {
                      const isExpanded = expandedHistoryId === record.id
                      const firstTopic = record.topics?.[0]
                      return (
                        <div
                          key={record.id}
                          className="rounded-xl border border-hairline/20 bg-surface-low overflow-hidden"
                        >
                          {/* Record header */}
                          <div className="flex items-center gap-3 px-4 py-3">
                            <button
                              onClick={() => setExpandedHistoryId(isExpanded ? null : record.id)}
                              className="text-muted hover:text-ink transition-colors"
                            >
                              {isExpanded
                                ? <CaretDown className="w-4 h-4" weight="fill" />
                                : <CaretRight className="w-4 h-4" weight="fill" />}
                            </button>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-ink font-medium">
                                  {PLATFORM_LABELS[record.platform] || record.platform}
                                </span>
                                <span className="text-[10px] bg-hairline text-body px-1.5 py-0.5 rounded">
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
                              onClick={(e) => { e.stopPropagation(); handleStarHistory(record.id) }}
                              className={`transition-colors ${record.isStarred ? 'text-yellow-400' : 'text-muted hover:text-yellow-400'}`}
                            >
                              <Star className="w-4 h-4" weight={record.isStarred ? 'fill' : 'regular'} />
                            </button>
                            <button
                              onClick={(e) => { e.stopPropagation(); handleDeleteHistory(record.id) }}
                              className="text-muted hover:text-red-400 transition-colors"
                            >
                              <Trash className="w-4 h-4" />
                            </button>
                          </div>

                          {/* Expanded topics */}
                          {isExpanded && record.topics && record.topics.length > 0 && (
                            <div className="px-4 pb-3 border-t border-hairline/20 pt-3">
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                {record.topics.map((topic, i) => (
                                  <TopicCard
                                    key={i}
                                    topic={topic}
                                    onClick={() => {}}
                                    isActive={false}
                                  />
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          <div className="w-64 shrink-0 border-r border-hairline/30 flex flex-col overflow-hidden">
            <div className="flex-1 overflow-hidden flex flex-col">
              <TrendPanel trends={trends} loading={trendsLoading} />
            </div>
            <CompetitorPanel platform={platform} competitors={competitors} onRefresh={loadCompetitors} />
          </div>

          {/* Main area */}
          <div className="flex-1 flex overflow-hidden">
            {/* Topic list */}
            <div className="flex-1 overflow-y-auto p-4">
              {displayTopics.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <Lightbulb className="w-9 h-9 text-muted mb-3" weight="fill" />
                  <p className="text-sm text-muted mb-1">
                    {showSaved ? '暂无收藏的选题' : '暂无选题建议'}
                  </p>
                  <p className="text-xs text-muted">
                    {showSaved ? '在 AI 生成后收藏选题' : '点击上方 "AI 生成选题" 开始'}
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {displayTopics.map((topic, i) => (
                    <TopicCard
                      key={i}
                      topic={topic}
                      onClick={() => setSelectedIdx(i)}
                      isActive={selectedIdx === i}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Detail panel */}
            {selectedIdx !== null && displayTopics[selectedIdx] && (
              <div className="w-80 shrink-0 border-l border-hairline p-4 overflow-y-auto">
                <TopicDetail
                  topic={displayTopics[selectedIdx]}
                  onSave={() => handleSave(displayTopics[selectedIdx])}
                  onSendToChat={() => handleSendToChat(displayTopics[selectedIdx])}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
