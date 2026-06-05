import { useState, useEffect, useCallback } from 'react'
import { ChatCircleText, TrendUp, Brain, FloppyDisk } from '@phosphor-icons/react'
import type { Comment, CommentSummary } from '../../types/electron'

const SENTIMENT_COLOR: Record<string, string> = {
  positive: 'text-emerald-400', neutral: 'text-gray-400',
  negative: 'text-red-400', '': 'text-gray-500',
}
const SENTIMENT_DOT: Record<string, string> = {
  positive: 'bg-emerald-400', neutral: 'bg-gray-400',
  negative: 'bg-red-400', '': 'bg-gray-500',
}
const SENTIMENT_LABEL: Record<string, string> = {
  positive: '正面', neutral: '中性', negative: '负面', '': '未分析',
}

interface Props {
  videoId: string
  platform: string
}

export default function CommentPanel({ videoId, platform }: Props) {
  const [comments, setComments] = useState<Comment[]>([])
  const [summary, setSummary] = useState<CommentSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [crawling, setCrawling] = useState(false)

  const loadComments = useCallback(async () => {
    try {
      const data = await window.electronAPI?.commentsList(videoId)
      if (data) setComments(data)
    } catch { /* ignore */ }
  }, [videoId])

  const loadSummary = useCallback(async () => {
    try {
      const s = await window.electronAPI?.commentsSummary(platform)
      if (s) setSummary(s)
    } catch { /* ignore */ }
  }, [platform])

  useEffect(() => { loadComments() }, [loadComments])
  useEffect(() => { loadSummary() }, [loadSummary])

  const handleCrawl = async () => {
    setCrawling(true)
    try {
      await window.electronAPI?.commentsCrawl(platform, videoId)
      await loadComments()
      await loadSummary()
    } catch { /* ignore */ }
    setCrawling(false)
  }

  const handleAnalyze = async () => {
    setAnalyzing(true)
    try {
      await window.electronAPI?.commentsAnalyze(videoId)
      await loadComments()
      await loadSummary()
    } catch { /* ignore */ }
    setAnalyzing(false)
  }

  const handleWriteMemories = async () => {
    setLoading(true)
    try {
      await window.electronAPI?.commentsWriteMemories(videoId)
    } catch { /* ignore */ }
    setLoading(false)
  }

  // 情感分布统计
  const sentimentCounts = { positive: 0, neutral: 0, negative: 0, '': 0 }
  for (const c of comments) {
    const s = c.sentiment || ''
    sentimentCounts[s as keyof typeof sentimentCounts]++
  }
  const total = comments.length || 1

  return (
    <div className="bg-surface rounded-xl border border-hairline/30 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-hairline/20">
        <div className="flex items-center gap-2">
          <ChatCircleText className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-medium text-ink">评论分析</h3>
          {comments.length > 0 && (
            <span className="text-[10px] text-muted bg-canvas-soft px-1.5 py-0.5 rounded-full">{comments.length} 条</span>
          )}
        </div>
        <div className="flex gap-1.5">
          <button onClick={handleCrawl} disabled={crawling}
            className="px-2 py-1 text-[10px] text-primary bg-primary/10 border border-primary/20 rounded hover:bg-primary/15 transition-colors disabled:opacity-50">
            {crawling ? '爬取中...' : '爬取评论'}
          </button>
          <button onClick={handleAnalyze} disabled={analyzing || comments.length === 0}
            className="px-2 py-1 text-[10px] text-primary bg-primary/10 border border-primary/20 rounded hover:bg-primary/15 transition-colors disabled:opacity-50">
            {analyzing ? '分析中...' : 'AI 分析'}
          </button>
          <button onClick={handleWriteMemories} disabled={loading || comments.length === 0}
            className="px-2 py-1 text-[10px] text-muted bg-canvas-soft border border-hairline/30 rounded hover:bg-hairline transition-colors disabled:opacity-50">
            <FloppyDisk className="w-3 h-3 inline mr-0.5" />
            写入记忆
          </button>
        </div>
      </div>

      <div className="p-4 space-y-4">
        {comments.length === 0 ? (
          <div className="text-center py-8">
            <ChatCircleText className="w-8 h-8 text-muted/30 mx-auto mb-2" />
            <p className="text-xs text-muted">暂无评论数据</p>
            <p className="text-[10px] text-muted/60 mt-1">点击"爬取评论"获取数据</p>
          </div>
        ) : (
          <>
            {/* 情感分布 */}
            <div>
              <p className="text-[11px] text-muted mb-2 flex items-center gap-1.5">
                <TrendUp className="w-3 h-3" /> 情感分布
              </p>
              <div className="space-y-1.5">
                {(['positive', 'neutral', 'negative'] as const).map(s => {
                  const count = sentimentCounts[s]
                  const pct = Math.round((count / total) * 100)
                  return (
                    <div key={s} className="flex items-center gap-2">
                      <span className="text-[10px] text-muted w-8">{SENTIMENT_LABEL[s]}</span>
                      <div className="flex-1 h-1.5 bg-canvas-soft rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all duration-500 ${
                          s === 'positive' ? 'bg-emerald-400' : s === 'neutral' ? 'bg-gray-400' : 'bg-red-400'
                        }`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-[10px] text-muted w-10 text-right">{pct}%</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* 热门话题 */}
            {summary && summary.topTags.length > 0 && (
              <div>
                <p className="text-[11px] text-muted mb-2 flex items-center gap-1.5">
                  <Brain className="w-3 h-3" /> 热门话题
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {summary.topTags.slice(0, 10).map(t => (
                    <span key={t.tag} className="px-2 py-0.5 rounded-full bg-canvas-soft text-[10px] text-ink">
                      #{t.tag}
                      <span className="text-muted ml-1">{t.count}次</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* 评论列表 */}
            <div>
              <p className="text-[11px] text-muted mb-2">评论列表（按点赞排序）</p>
              <div className="space-y-1 max-h-[300px] overflow-auto">
                {comments.map(c => (
                  <div key={c.id} className="flex items-start gap-2 py-1.5 px-2 rounded hover:bg-canvas-soft/50 transition-colors">
                    <span className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${SENTIMENT_DOT[c.sentiment || '']}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] text-ink truncate">{c.content}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-muted">{c.authorName || '匿名'}</span>
                        <span className="text-[10px] text-muted">{c.likeCount} 赞</span>
                        {c.sentiment && (
                          <span className={`text-[9px] ${SENTIMENT_COLOR[c.sentiment]}`}>
                            {SENTIMENT_LABEL[c.sentiment]}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
