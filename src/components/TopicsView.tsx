import { useState, useEffect, useCallback } from 'react'
import { usePlatform } from '../contexts/PlatformContext'
import TrendPanel from './topics/TrendPanel'
import TopicCard from './topics/TopicCard'
import TopicDetail from './topics/TopicDetail'
import type { TopicSuggestion, TrendData, SavedTopic } from '../types/electron'

interface Props {
  onSendToChat?: (topic: TopicSuggestion) => void
}

const PLATFORMS = [
  { key: 'bili', label: 'B站', icon: 'play_circle' },
  { key: 'dy', label: '抖音', icon: 'music_note' },
  { key: 'xhs', label: '小红书', icon: 'style' },
  { key: 'wb', label: '微博', icon: 'tag' },
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

  useEffect(() => { loadTrends() }, [loadTrends])
  useEffect(() => { loadSavedTopics() }, [loadSavedTopics])

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

  const displayTopics = showSaved
    ? savedTopics.map(s => ({ title: s.title, reason: s.reason, source: s.source, estimatedPerformance: s.estimatedPerformance, tags: s.tags }))
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
          onClick={() => setShowSaved(!showSaved)}
          className={`no-drag text-xs px-2.5 py-1 rounded-lg transition-colors ${
            showSaved ? 'bg-primary/15 text-primary' : 'text-muted hover:text-ink hover:bg-canvas-soft'
          }`}
        >
          <span className="material-symbols-outlined text-[14px] align-middle mr-1">bookmark</span>
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
              <span className="material-symbols-outlined text-[14px]">auto_awesome</span>
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
      <div className="flex-1 flex overflow-hidden">
        <TrendPanel trends={trends} loading={trendsLoading} />

        {/* Main area */}
        <div className="flex-1 flex overflow-hidden">
          {/* Topic list */}
          <div className="flex-1 overflow-y-auto p-4">
            {displayTopics.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <span className="material-symbols-outlined text-[36px] text-muted mb-3">lightbulb</span>
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
    </div>
  )
}
