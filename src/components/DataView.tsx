import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import type { CrawlContent, VideoAnalysis, SourceInfo, CreatorInfo } from '../types/electron'

type Mode = 'search' | 'creator'

function formatNumber(n: number) {
  if (n >= 10000) return (n / 10000).toFixed(1) + '万'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
  return String(n)
}

function formatDate(s: string) {
  if (!s) return '-'
  const ts = Number(s)
  if (ts > 1e9) return new Date(ts * 1000).toLocaleDateString('zh-CN')
  return s.slice(0, 10)
}

// ============================================================
//  头像组件（带 fallback）
// ============================================================

function Avatar({ src, name, size = 32 }: { src?: string; name: string; size?: number }) {
  if (src) {
    return <img src={src} alt={name} style={{ width: size, height: size }} className="rounded-full object-cover border border-outline-variant shrink-0" />
  }
  return (
    <div
      style={{ width: size, height: size }}
      className="rounded-full bg-primary/20 flex items-center justify-center text-primary font-medium shrink-0"
    >
      <span style={{ fontSize: size * 0.4 }}>{name[0] || '?'}</span>
    </div>
  )
}

// ============================================================
//  进度条
// ============================================================

function ProgressBar({ status, logs }: { status: string; logs?: string[] }) {
  const isDone = status.includes("完成")
  const isFailed = status.includes("失败") || status.includes("出错")
  const logEndRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs?.length])
  return (
    <div className="bg-surface-container rounded-xl px-5 py-4">
      <div className="flex items-center gap-3 mb-2">
        {isDone ? (<span className="material-symbols-outlined text-[20px] text-green-400">check_circle</span>) : isFailed ? (<span className="material-symbols-outlined text-[20px] text-red-400">error</span>) : (<div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />)}
        <span className="text-sm text-on-surface font-medium">{status}</span>
      </div>
      {logs && logs.length > 0 && (
        <div className="mt-2 bg-[#0a0f0a] rounded-lg p-3 max-h-[200px] overflow-auto font-mono text-[11px] leading-relaxed">
          {logs.map((line, i) => (
            <div key={i} className="text-green-400/80">
              <span className="text-mute/50 mr-2">{String(i + 1).padStart(3, ' ')}</span>
              {line}
            </div>
          ))}
          <div ref={logEndRef} />
        </div>
      )}
    </div>
  )
}

// ============================================================
//  概览卡片
// ============================================================

function OverviewCards({ overview }: { overview: VideoAnalysis['overview'] }) {
  const cards = [
    { label: '视频总数', value: overview.totalVideos, icon: 'movie' },
    { label: '总播放量', value: overview.totalPlay, icon: 'play_circle' },
    { label: '总点赞数', value: overview.totalLike, icon: 'thumb_up' },
    { label: '平均播放', value: overview.avgPlay, icon: 'trending_up' },
  ]
  return (
    <div className="grid grid-cols-4 gap-3">
      {cards.map(c => (
        <div key={c.label} className="bg-surface-container rounded-xl px-4 py-3">
          <div className="flex items-center gap-2 mb-1">
            <span className="material-symbols-outlined text-[16px] text-primary">{c.icon}</span>
            <span className="text-[11px] text-mute">{c.label}</span>
          </div>
          <p className="text-xl font-semibold text-on-surface">{formatNumber(c.value)}</p>
        </div>
      ))}
    </div>
  )
}

// ============================================================
//  内容规律卡片
// ============================================================

function ContentPatternsCard({ analysis }: { analysis: VideoAnalysis }) {
  return (
    <div className="bg-surface-container rounded-xl p-5">
      <h3 className="text-sm font-medium text-on-surface mb-4 flex items-center gap-2">
        <span className="material-symbols-outlined text-[18px] text-primary">psychology</span>
        内容规律
      </h3>
      {analysis.topTopics && analysis.topTopics.length > 0 && (
        <div className="mb-4">
          <p className="text-[11px] text-mute mb-2">最佳选题方向（按平均播放排序）</p>
          <div className="space-y-1.5">
            {analysis.topTopics.map((t, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-5 h-5 rounded bg-surface-high flex items-center justify-center text-[10px] text-primary font-medium">{i + 1}</span>
                <span className="text-xs text-on-surface flex-1">{t.topic}</span>
                <span className="text-[10px] text-body">{t.count} 条</span>
                <span className="text-[10px] text-primary">{formatNumber(t.avgPlay)} 播放</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {analysis.titlePatterns && (
        <div className="mb-4">
          <p className="text-[11px] text-mute mb-1.5">标题特征</p>
          <p className="text-xs text-on-surface leading-relaxed">{analysis.titlePatterns}</p>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        {analysis.bestDuration && (
          <div className="bg-surface-high rounded-lg px-3 py-2">
            <p className="text-[10px] text-mute mb-0.5">最佳时长</p>
            <p className="text-xs text-on-surface font-medium">{analysis.bestDuration}</p>
          </div>
        )}
        {analysis.bestTime && (
          <div className="bg-surface-high rounded-lg px-3 py-2">
            <p className="text-[10px] text-mute mb-0.5">最佳发布时间</p>
            <p className="text-xs text-on-surface font-medium">{analysis.bestTime}</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ============================================================
//  互动率排行
// ============================================================

function EngagementTable({ items }: { items: VideoAnalysis['topByEngagement'] }) {
  if (!items || items.length === 0) return null
  const maxRate = Math.max(...items.map(i => i.engagementRate))
  return (
    <div className="bg-surface-container rounded-xl p-5">
      <h3 className="text-sm font-medium text-on-surface mb-4 flex items-center gap-2">
        <span className="material-symbols-outlined text-[18px] text-primary">leaderboard</span>
        内容质量排行
      </h3>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-mute border-b border-outline-variant">
            <th className="pb-2 w-8">#</th>
            <th className="pb-2">标题</th>
            <th className="pb-2 w-20 text-right">播放量</th>
            <th className="pb-2 w-40">互动率</th>
          </tr>
        </thead>
        <tbody>
          {items.slice(0, 15).map((item, i) => {
            const barWidth = maxRate > 0 ? (item.engagementRate / maxRate) * 100 : 0
            const isTop3 = i < 3
            return (
              <tr key={i} className={`border-b border-outline-variant/30 ${isTop3 ? 'bg-primary/5' : ''}`}>
                <td className="py-2">
                  <span className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-medium ${isTop3 ? 'bg-primary/20 text-primary' : 'text-mute'}`}>{i + 1}</span>
                </td>
                <td className="py-2 text-on-surface max-w-[200px] truncate">
                  {item.title}
                  {isTop3 && <span className="ml-1.5 text-[9px] text-primary">高质量方向</span>}
                </td>
                <td className="py-2 text-right text-body">{formatNumber(item.playCount)}</td>
                <td className="py-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-surface-high rounded-full overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${barWidth}%` }} />
                    </div>
                    <span className="text-[10px] text-primary w-12 text-right">{item.engagementRate}%</span>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ============================================================
//  选题建议
// ============================================================

function SuggestionsCard({ suggestions, videoCount }: { suggestions: string[]; videoCount: number }) {
  if (!suggestions || suggestions.length === 0) return null
  const icons = ['lightbulb', 'edit_note', 'schedule']
  return (
    <div className="bg-surface-container rounded-xl p-5">
      <h3 className="text-sm font-medium text-on-surface mb-4 flex items-center gap-2">
        <span className="material-symbols-outlined text-[18px] text-primary">tips_and_updates</span>
        下一步建议
      </h3>
      <div className="space-y-3">
        {suggestions.map((s, i) => (
          <div key={i} className="flex gap-3">
            <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
              <span className="material-symbols-outlined text-[14px] text-primary">{icons[i] || 'arrow_right'}</span>
            </div>
            <div className="flex-1">
              <p className="text-xs text-on-surface leading-relaxed">{s}</p>
              <p className="text-[10px] text-mute mt-1">基于 {videoCount} 条视频的数据分析</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ============================================================
//  上下文菜单
// ============================================================

function ContextMenu({
  x, y, source, onClose, onStar, onPin, onExport, onDelete,
}: {
  x: number; y: number; source: SourceInfo
  onClose: () => void
  onStar: () => void; onPin: () => void; onExport: () => void; onDelete: () => void
}) {
  useEffect(() => {
    const close = () => onClose()
    window.addEventListener('click', close)
    window.addEventListener('contextmenu', close)
    return () => { window.removeEventListener('click', close); window.removeEventListener('contextmenu', close) }
  }, [onClose])

  const isCreator = source.type === 'creator'
  return (
    <div
      className="fixed z-50 bg-surface-low border border-outline-variant rounded-xl shadow-xl py-1 min-w-[160px]"
      style={{ left: x, top: y }}
      onClick={e => e.stopPropagation()}
    >
      {isCreator && (
        <>
          <button onClick={() => { onStar(); onClose() }} className="w-full px-3 py-2 text-left text-xs text-on-surface hover:bg-surface-container flex items-center gap-2">
            <span className={source.isStarred ? 'text-yellow-500' : ''}>{source.isStarred ? '★' : '☆'}</span>
            {source.isStarred ? '取消收藏' : '收藏'}
          </button>
          <button onClick={() => { onPin(); onClose() }} className="w-full px-3 py-2 text-left text-xs text-on-surface hover:bg-surface-container flex items-center gap-2">
            <span className={source.isPinned ? 'text-green-500' : ''}>{source.isPinned ? '📌' : '📍'}</span>
            {source.isPinned ? '取消置顶' : '置顶'}
          </button>
          <div className="h-px bg-outline-variant mx-2 my-1" />
        </>
      )}
      <button onClick={() => { onExport(); onClose() }} className="w-full px-3 py-2 text-left text-xs text-on-surface hover:bg-surface-container flex items-center gap-2">
        <span>📦</span> 导出数据
      </button>
      <div className="h-px bg-outline-variant mx-2 my-1" />
      <button onClick={() => { onDelete(); onClose() }} className="w-full px-3 py-2 text-left text-xs text-red-400 hover:bg-red-500/10 flex items-center gap-2">
        <span>🗑️</span> 删除数据
      </button>
    </div>
  )
}

// ============================================================
//  侧边栏
// ============================================================

function Sidebar({
  sources, selectedSource, searchQuery, onSearchChange, onSelect,
  onNewCrawl, onContextMenu, onMoreMenu,
}: {
  sources: SourceInfo[]; selectedSource: string; searchQuery: string
  onSearchChange: (q: string) => void; onSelect: (uid: string) => void
  onNewCrawl: () => void
  onContextMenu: (e: React.MouseEvent, source: SourceInfo) => void
  onMoreMenu: (e: React.MouseEvent) => void
}) {
  const filtered = useMemo(() => {
    if (!searchQuery) return sources
    const q = searchQuery.toLowerCase()
    return sources.filter(s => s.sourceName.toLowerCase().includes(q) || s.sourceUid.toLowerCase().includes(q))
  }, [sources, searchQuery])

  const pinned = filtered.filter(s => s.type === 'creator' && s.isPinned)
  const starred = filtered.filter(s => s.type === 'creator' && !s.isPinned && s.isStarred)
  const creators = filtered.filter(s => s.type === 'creator' && !s.isPinned && !s.isStarred)
  const keywords = filtered.filter(s => s.type === 'keyword')
  const totalCount = sources.reduce((s, src) => s + src.count, 0)

  const renderGroup = (title: string, icon: string, items: SourceInfo[]) => {
    if (items.length === 0) return null
    return (
      <div className="mb-1">
        <div className="text-[10px] text-mute uppercase tracking-wider px-4 py-2 flex items-center gap-1.5">
          <span className="material-symbols-outlined text-[12px]">{icon}</span>
          {title}
        </div>
        {items.map(s => (
          <SidebarItem
            key={s.sourceUid}
            source={s}
            isSelected={selectedSource === s.sourceUid}
            onClick={() => onSelect(s.sourceUid)}
            onContextMenu={(e) => onContextMenu(e, s)}
          />
        ))}
      </div>
    )
  }

  return (
    <div className="w-60 bg-surface-low border-r border-outline-variant flex flex-col shrink-0">
      {/* 搜索框 */}
      <div className="p-2">
        <div className="relative">
          <span className="material-symbols-outlined absolute left-2.5 top-1/2 -translate-y-1/2 text-[16px] text-mute">search</span>
          <input
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            placeholder="搜索来源..."
            className="w-full bg-surface-container rounded-lg pl-8 pr-3 py-2 text-xs text-on-surface placeholder:text-mute outline-none focus:ring-1 focus:ring-primary/50"
          />
        </div>
      </div>

      {/* 列表 */}
      <div className="flex-1 overflow-auto px-1">
        {renderGroup('置顶', 'push_pin', pinned)}
        {renderGroup('收藏', 'star', starred)}
        {renderGroup('创作者', 'person', creators)}
        {renderGroup('关键词', 'search', keywords)}

        {/* 全部 */}
        <div className="mb-1">
          <div className="text-[10px] text-mute uppercase tracking-wider px-4 py-2 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-[12px]">database</span>
            全部
          </div>
          <button
            onClick={() => onSelect('all')}
            className={`w-full flex items-center gap-3 px-3 py-2 mx-1 rounded-lg transition-colors text-left ${
              selectedSource === 'all'
                ? 'bg-surface-container border-l-2 border-primary'
                : 'hover:bg-surface-container/50'
            }`}
          >
            <div className="w-8 h-8 rounded-full bg-surface-container flex items-center justify-center">
              <span className="material-symbols-outlined text-[16px] text-mute">analytics</span>
            </div>
            <span className="text-xs text-on-surface flex-1 truncate">全部数据</span>
            <span className="text-[10px] text-mute">{totalCount}</span>
          </button>
        </div>
      </div>

      {/* 底部按钮 */}
      <div className="p-2 border-t border-outline-variant flex gap-1">
        <button
          onClick={onNewCrawl}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-primary/10 text-primary text-xs hover:bg-primary/20 transition-colors"
        >
          <span className="material-symbols-outlined text-[16px]">add</span>
          新建爬取
        </button>
        <button
          onClick={onMoreMenu}
          className="px-2 py-2 rounded-lg text-mute hover:bg-surface-container transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">more_horiz</span>
        </button>
      </div>
    </div>
  )
}

function SidebarItem({ source, isSelected, onClick, onContextMenu }: {
  source: SourceInfo; isSelected: boolean; onClick: () => void; onContextMenu: (e: React.MouseEvent) => void
}) {
  return (
    <button
      onClick={onClick}
      onContextMenu={onContextMenu}
      className={`w-full flex items-center gap-3 px-3 py-2 mx-1 rounded-lg transition-colors text-left group ${
        isSelected
          ? 'bg-surface-container border-l-2 border-primary'
          : 'hover:bg-surface-container/50'
      }`}
    >
      <Avatar src={source.avatarUrl} name={source.sourceName} size={32} />
      <span className="text-xs text-on-surface flex-1 truncate">{source.sourceName}</span>
      <span className="text-[10px] text-mute">{source.count}</span>
    </button>
  )
}

// ============================================================
//  主组件
// ============================================================

export default function DataView() {
  const [selectedSource, setSelectedSource] = useState('all')
  const [sources, setSources] = useState<SourceInfo[]>([])
  const [videos, setVideos] = useState<CrawlContent[]>([])
  const [analysis, setAnalysis] = useState<VideoAnalysis | null>(null)
  const [showVideos, setShowVideos] = useState(false)
  const [mode, setMode] = useState<Mode>('search')
  const [crawlKeyword, setCrawlKeyword] = useState('')
  const [crawlUid, setCrawlUid] = useState('')
  const [crawlPlatform, setCrawlPlatform] = useState('bili')
  const [analyzing, setAnalyzing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  // 分类
  const [selectedCategory, setSelectedCategory] = useState('')
  const [categorizing, setCategorizing] = useState(false)
  const [categorizeStatus, setCategorizeStatus] = useState('')
  // 进度
  const [crawlStatus, setCrawlStatus] = useState('')
  const [crawlLogs, setCrawlLogs] = useState<string[]>([])
  const [aiStatus, setAiStatus] = useState('')
  // 上下文菜单
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; source: SourceInfo } | null>(null)
  const [moreMenuOpen, setMoreMenuOpen] = useState(false)
  // AI 分析缓存
  const analysisCache = useRef<Map<string, { data: VideoAnalysis; timestamp: number }>>(new Map())
  const cleanupRef = useRef<(() => void) | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const api = window.electronAPI

  // 监听爬虫事件
  useEffect(() => {
    if (!api?.onCrawlerEvent) return
    const unsubscribe = api.onCrawlerEvent((event: string) => {
      try {
        const evt = JSON.parse(event)
        if (evt.type === 'started') {
          setCrawlStatus(`正在爬取 ${evt.platform === 'bili' ? 'B站' : evt.platform} 数据...`)
          setCrawlLogs(['启动浏览器，加载页面...'])
        } else if (evt.type === 'progress') {
          if (evt.message) {
            setCrawlLogs(prev => [...prev, evt.message])
          }
        } else if (evt.type === 'done') {
          setCrawlStatus('爬取完成')
          setCrawlLogs(prev => [...prev, `爬取完成，共 ${evt.count || 0} 条数据`])
          setTimeout(() => setCrawlStatus(''), 3000)
        } else if (evt.type === 'error') {
          setCrawlStatus('爬取出错')
          setCrawlLogs(prev => [...prev, `错误: ${evt.message || '未知错误'}`])
          setTimeout(() => setCrawlStatus(''), 3000)
        }
      } catch { /* ignore */ }
    })
    cleanupRef.current = unsubscribe
    return () => { unsubscribe() }
  }, [api])

  // 加载来源列表
  const loadSources = useCallback(async () => {
    if (!api?.getSources) return
    try {
      const list = await api.getSources(crawlPlatform)
      setSources(list)
    } catch { /* ignore */ }
  }, [api, crawlPlatform])

  useEffect(() => { loadSources() }, [loadSources])

  // 加载视频数据
  const loadVideos = useCallback(async () => {
    if (!api) return
    setLoading(true)
    try {
      let vids: CrawlContent[]
      if (selectedSource === 'all') {
        vids = await api.getAllCrawlContent(crawlPlatform)
      } else {
        vids = await api.getVideosBySource(crawlPlatform, selectedSource)
      }
      setVideos(vids)
    } catch { /* ignore */ }
    setLoading(false)
  }, [api, crawlPlatform, selectedSource])

  useEffect(() => { loadVideos() }, [loadVideos])

  // 从视频数据计算本地统计（不调 LLM）
  const localStats = useMemo(() => {
    if (videos.length === 0) return null
    const totalPlay = videos.reduce((s, v) => s + v.playCount, 0)
    const totalLike = videos.reduce((s, v) => s + v.likeCount, 0)
    const totalComment = videos.reduce((s, v) => s + v.commentCount, 0)
    const totalShare = videos.reduce((s, v) => s + v.shareCount, 0)
    return {
      overview: {
        totalVideos: videos.length,
        totalPlay,
        totalLike,
        totalComment,
        avgPlay: Math.round(totalPlay / videos.length),
        avgLike: Math.round(totalLike / videos.length),
      },
      topByEngagement: videos.map(v => {
        const raw = v.rawJson || {}
        const coin = parseInt(raw.video_coin_count) || 0
        const fav = parseInt(raw.video_favorite_count) || 0
        const danmaku = parseInt(raw.video_danmaku) || 0
        const rate = v.playCount > 0
          ? ((v.likeCount + coin + fav + v.commentCount + danmaku) / v.playCount * 100)
          : 0
        return { title: v.title, playCount: v.playCount, engagementRate: Math.round(rate * 100) / 100 }
      }).sort((a, b) => b.engagementRate - a.engagementRate).slice(0, 20),
    }
  }, [videos])

  // 刷新分析缓存（爬取新数据后）
  const invalidateAnalysisCache = useCallback((sourceUid?: string) => {
    if (sourceUid) {
      analysisCache.current.delete(`${crawlPlatform}:${sourceUid}`)
    } else {
      analysisCache.current.clear()
    }
  }, [crawlPlatform])

  // AI 分析（手动触发）
  const runAIAnalysis = async () => {
    if (!api) return
    // Pre-check: API key
    const settings: Record<string, unknown> = await api.getStoreAll().catch(() => ({}))
    if (!settings.apiKey) {
      setAiStatus('请先在设置页配置 API Key')
      setTimeout(() => setAiStatus(''), 4000)
      return
    }
    setAnalyzing(true)
    setAiStatus('正在调用 AI 分析数据...')
    try {
      const cacheKey = `${crawlPlatform}:${selectedSource}`
      const cached = analysisCache.current.get(cacheKey)
      if (cached) {
        setAnalysis(cached.data)
        setAiStatus('')
        setAnalyzing(false)
        return
      }
      const result = await api.analyzeVideoData(crawlPlatform, selectedSource === 'all' ? undefined : selectedSource)
      if (result) {
        setAnalysis(result)
        analysisCache.current.set(cacheKey, { data: result, timestamp: Date.now() })
        setAiStatus('分析完成')
        setTimeout(() => setAiStatus(''), 2000)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setAiStatus('AI 分析出错: ' + (msg.length > 80 ? msg.slice(0, 80) + '...' : msg))
      setTimeout(() => setAiStatus(''), 5000)
    }
    setAnalyzing(false)
  }

  // AI 一键分类
  const runAutoCategorize = async () => {
    if (!api?.autoCategorize) return
    setCategorizing(true)
    setCategorizeStatus('正在分析视频标题，自动分类...')
    try {
      const result = await api.autoCategorize(crawlPlatform)
      if (result.success) {
        setCategorizeStatus(`分类完成，已分类 ${result.categorized} 条`)
        await loadVideos()
      } else {
        setCategorizeStatus(result.error || '分类失败')
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setCategorizeStatus('AI 分类出错: ' + (msg.length > 80 ? msg.slice(0, 80) + '...' : msg))
    }
    setTimeout(() => setCategorizeStatus(''), 3000)
    setCategorizing(false)
  }

  // 手动修改分类
  const handleUpdateCategory = async (contentId: string, category: string) => {
    if (!api?.updateCategory) return
    await api.updateCategory(contentId, category)
    setVideos(prev => prev.map(v => v.contentId === contentId ? { ...v, category } : v))
  }

  // 按分类筛选
  const filteredVideos = selectedCategory
    ? videos.filter(v => v.category === selectedCategory)
    : videos

  // 爬取
  const startCrawl = async () => {
    if (!api) return
    const input = mode === 'search' ? crawlKeyword.trim() : crawlUid.trim()
    if (!input) return

    setAnalyzing(true)
    setCrawlStatus('准备爬取...')
    setCrawlLogs([])

    try {
      const options: Record<string, unknown> = { maxNotes: 15 }
      if (mode === 'creator') {
        options.crawlerType = 'creator'
        options.creatorId = input
      }

      const result = await api.runCrawler(crawlPlatform, input, options)
      if (result.success) {
        invalidateAnalysisCache(result.sourceUid)
        await loadSources()
        if (result.sourceUid) {
          setSelectedSource(result.sourceUid)
        }
      } else {
        setCrawlStatus('爬取失败')
        setCrawlLogs(prev => [...prev, `失败: ${result.error || '未知错误'}`])
        setTimeout(() => setCrawlStatus(''), 3000)
      }
    } catch {
      setCrawlStatus('爬取出错')
      setCrawlLogs(prev => [...prev, '请检查网络或登录状态'])
      setTimeout(() => setCrawlStatus(''), 3000)
    }
    setAnalyzing(false)
  }

  // 新建爬取
  const handleNewCrawl = () => {
    setMode('creator')
    setTimeout(() => inputRef.current?.focus(), 100)
  }

  // 上下文菜单操作
  const handleStar = async (source: SourceInfo) => {
    if (!api?.starCreator) return
    await api.starCreator(source.sourceUid)
    await loadSources()
  }
  const handlePin = async (source: SourceInfo) => {
    if (!api?.pinCreator) return
    await api.pinCreator(source.sourceUid)
    await loadSources()
  }
  const handleExport = async (source: SourceInfo) => {
    if (!api?.exportSourceData) return
    await api.exportSourceData(source.sourceUid)
  }
  const handleDelete = async (source: SourceInfo) => {
    if (!api?.deleteCreator) return
    if (!confirm(`确定删除「${source.sourceName}」的所有数据？`)) return
    await api.deleteCreator(source.sourceUid)
    if (selectedSource === source.sourceUid) setSelectedSource('all')
    await loadSources()
  }
  const handleExportAll = async () => {
    if (!api?.exportSourceData) return
    // 导出全部：逐个导出（简单方案）
    for (const s of sources) {
      if (s.sourceUid) await api.exportSourceData(s.sourceUid)
    }
  }

  const isRunning = analyzing || !!crawlStatus
  const currentSource = sources.find(s => s.sourceUid === selectedSource)

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* 顶部操作栏 - 第一行：标题 + 模式切换 */}
      <div className="px-6 py-3 border-b border-outline-variant shrink-0 flex items-center gap-3">
        <h1 className="text-lg font-medium text-on-surface mr-2">数据分析</h1>

        {/* 模式切换 */}
        <div className="flex gap-1">
          <button
            onClick={() => setMode('search')}
            className={`px-3 py-1 text-[11px] rounded-full transition-colors ${
              mode === 'search' ? 'bg-primary/20 text-primary' : 'bg-surface-container text-mute hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[12px] align-[-2px] mr-1">search</span>关键词搜索
          </button>
          <button
            onClick={() => setMode('creator')}
            className={`px-3 py-1 text-[11px] rounded-full transition-colors ${
              mode === 'creator' ? 'bg-primary/20 text-primary' : 'bg-surface-container text-mute hover:text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[12px] align-[-2px] mr-1">person</span>用户主页
          </button>
        </div>
      </div>

      {/* 顶部操作栏 - 第二行：平台选择 + 输入 + 操作按钮 */}
      <div className="px-6 py-2 border-b border-outline-variant shrink-0 flex items-center gap-3">

        {/* 输入区 */}
        <select
          value={crawlPlatform}
          onChange={e => { setCrawlPlatform(e.target.value); setSelectedSource('all') }}
          className="bg-surface-container border border-outline-variant rounded px-2 py-1.5 text-xs text-on-surface"
        >
          <option value="bili">B站</option>
          <option value="dy">抖音</option>
          <option value="xhs">小红书</option>
          <option value="wb">微博</option>
        </select>

        {mode === 'search' ? (
          <input
            ref={inputRef}
            value={crawlKeyword}
            onChange={e => setCrawlKeyword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && startCrawl()}
            placeholder="输入搜索关键词..."
            disabled={isRunning}
            className="flex-1 bg-surface-container border border-outline-variant rounded px-3 py-1.5 text-xs text-on-surface placeholder:text-mute disabled:opacity-50"
          />
        ) : (
          <input
            ref={inputRef}
            value={crawlUid}
            onChange={e => setCrawlUid(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && startCrawl()}
            placeholder="输入用户 UID（如 B站 space.bilibili.com/后面的数字）"
            disabled={isRunning}
            className="flex-1 bg-surface-container border border-outline-variant rounded px-3 py-1.5 text-xs text-on-surface placeholder:text-mute disabled:opacity-50"
          />
        )}

        <button
          onClick={startCrawl}
          disabled={isRunning || !(mode === 'search' ? crawlKeyword : crawlUid).trim()}
          className="px-4 py-1.5 bg-primary text-on-primary text-xs font-medium rounded hover:opacity-90 disabled:opacity-40"
        >
          {isRunning ? '处理中...' : '爬取'}
        </button>
        <button
          onClick={runAIAnalysis}
          disabled={analyzing || videos.length === 0}
          className="px-4 py-1.5 bg-surface-container border border-outline-variant text-on-surface text-xs rounded hover:bg-surface-high disabled:opacity-40"
        >
          <span className="material-symbols-outlined text-[12px] align-[-2px] mr-1">auto_awesome</span>
          {analyzing ? '分析中...' : 'AI 分析'}
        </button>
        <button
          onClick={runAutoCategorize}
          disabled={categorizing || videos.length === 0}
          className="px-4 py-1.5 bg-primary/10 border border-primary/30 text-primary text-xs rounded hover:bg-primary/20 disabled:opacity-40"
        >
          <span className="material-symbols-outlined text-[12px] align-[-2px] mr-1">label</span>
          {categorizing ? '分类中...' : 'AI 一键分类'}
        </button>
      </div>

      {/* 主体：侧边栏 + 内容区 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 侧边栏 */}
        <Sidebar
          sources={sources}
          selectedSource={selectedSource}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onSelect={setSelectedSource}
          onNewCrawl={handleNewCrawl}
          onContextMenu={(e, s) => setContextMenu({ x: e.clientX, y: e.clientY, source: s })}
          onMoreMenu={(e) => setMoreMenuOpen(!moreMenuOpen)}
        />

        {/* 右侧内容区 */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-32">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-sm text-body">加载数据中...</p>
            </div>
          ) : videos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-32">
              <span className="material-symbols-outlined text-[48px] text-mute mb-4">analytics</span>
              <p className="text-sm text-body">
                {selectedSource === 'all' ? '还没有数据，输入关键词或用户 UID 开始爬取' : '该来源暂无数据'}
              </p>
            </div>
          ) : (
            <div className="p-6 space-y-5 max-w-[1100px]">
              {/* 爬取进度 */}
              {crawlStatus && <ProgressBar status={crawlStatus} logs={crawlLogs} />}

              {/* AI 分析进度 */}
              {aiStatus && <ProgressBar status={aiStatus} />}

              {/* 分类状态 */}
              {categorizeStatus && (
                <div className="bg-primary/5 border border-primary/20 rounded-xl px-4 py-3 flex items-center gap-2">
                  <span className="material-symbols-outlined text-[16px] text-primary">label</span>
                  <span className="text-xs text-on-surface">{categorizeStatus}</span>
                </div>
              )}

              {/* ===== 创作者详情头部 ===== */}
              {currentSource && currentSource.type === 'creator' && (
                <div className="bg-surface-container rounded-xl p-5 flex items-center gap-4">
                  <Avatar src={currentSource.avatarUrl} name={currentSource.sourceName} size={48} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-medium text-on-surface">{currentSource.sourceName}</h2>
                      {currentSource.isStarred ? <span className="text-yellow-500 text-sm">★</span> : null}
                      {currentSource.isPinned ? <span className="text-sm">📌</span> : null}
                    </div>
                    <p className="text-[11px] text-mute">UID: {currentSource.sourceUid} · {currentSource.count} 个视频</p>
                  </div>
                </div>
              )}

              {/* ===== 关键词头部 ===== */}
              {currentSource && currentSource.type === 'keyword' && (
                <div className="bg-surface-container rounded-xl p-5 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-surface-high flex items-center justify-center">
                    <span className="material-symbols-outlined text-[24px] text-primary">search</span>
                  </div>
                  <div>
                    <h2 className="text-lg font-medium text-on-surface">{currentSource.sourceName}</h2>
                    <p className="text-[11px] text-mute">关键词搜索 · {currentSource.count} 个视频</p>
                  </div>
                </div>
              )}

              {/* 概览卡片（本地统计，立即显示） */}
              {localStats && <OverviewCards overview={localStats.overview} />}

              {/* AI 洞察面板（需要 LLM 分析） */}
              {analysis?.topTopics && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  <ContentPatternsCard analysis={analysis} />
                  <SuggestionsCard suggestions={analysis.suggestions || []} videoCount={analysis.overview.totalVideos} />
                </div>
              )}

              {/* 互动率排行（本地计算，立即显示） */}
              {localStats && <EngagementTable items={localStats.topByEngagement} />}

              {/* AI 分析按钮（未分析时显示） */}
              {!analysis && videos.length > 0 && (
                <button
                  onClick={runAIAnalysis}
                  disabled={analyzing}
                  className="w-full bg-surface-container rounded-xl p-6 text-center hover:bg-surface-high transition-colors"
                >
                  <span className="material-symbols-outlined text-[32px] text-primary mb-3 block">
                    {analyzing ? 'hourglass_empty' : 'auto_awesome'}
                  </span>
                  <p className="text-sm text-on-surface mb-1">
                    {analyzing ? 'AI 正在分析数据...' : '点击「AI 分析」获取深度洞察'}
                  </p>
                  <p className="text-[11px] text-mute">
                    {analyzing ? '请稍候，正在分析选题方向、标题特征...' : '分析选题方向、标题特征、发布时间等规律'}
                  </p>
                </button>
              )}

              {/* 分类标签 */}
              {videos.length > 0 && (
                <div className="bg-surface-container rounded-xl px-4 py-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="material-symbols-outlined text-[14px] text-primary">category</span>
                    <span className="text-[11px] text-mute">按分类筛选</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      onClick={() => setSelectedCategory('')}
                      className={`px-2.5 py-1 text-[11px] rounded-full transition-colors ${
                        selectedCategory === '' ? 'bg-primary text-on-primary' : 'bg-surface-high text-mute hover:text-on-surface'
                      }`}
                    >
                      全部（{videos.length}）
                    </button>
                    {(() => {
                      const catMap: Record<string, number> = {}
                      for (const v of videos) {
                        const c = v.category || '未分类'
                        catMap[c] = (catMap[c] || 0) + 1
                      }
                      return Object.entries(catMap).sort((a, b) => b[1] - a[1]).map(([cat, cnt]) => (
                        <button
                          key={cat}
                          onClick={() => setSelectedCategory(cat === selectedCategory ? '' : cat)}
                          className={`px-2.5 py-1 text-[11px] rounded-full transition-colors ${
                            cat === selectedCategory ? 'bg-primary text-on-primary' : 'bg-surface-high text-mute hover:text-on-surface'
                          }`}
                        >
                          {cat}（{cnt}）
                        </button>
                      ))
                    })()}
                  </div>
                </div>
              )}

              {/* 视频列表 */}
              {filteredVideos.length > 0 && (
                <div className="bg-surface-container rounded-xl overflow-hidden">
                  <button
                    onClick={() => setShowVideos(!showVideos)}
                    className="w-full flex items-center justify-between px-5 py-3 hover:bg-surface-high transition-colors"
                  >
                    <span className="text-sm font-medium text-on-surface flex items-center gap-2">
                      <span className="material-symbols-outlined text-[18px] text-primary">video_library</span>
                      完整视频列表（{filteredVideos.length}{selectedCategory ? ` / ${videos.length}` : ''} 条）
                    </span>
                    <span className={`material-symbols-outlined text-[18px] text-mute transition-transform ${showVideos ? 'rotate-180' : ''}`}>
                      expand_more
                    </span>
                  </button>
                  {showVideos && (
                    <div className="border-t border-outline-variant max-h-[400px] overflow-auto">
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-surface-low">
                          <tr className="text-left text-mute">
                            <th className="px-4 py-2 font-medium">#</th>
                            <th className="px-4 py-2 font-medium">标题</th>
                            <th className="px-4 py-2 font-medium w-20">作者</th>
                            <th className="px-4 py-2 font-medium w-24 text-right">播放</th>
                            <th className="px-4 py-2 font-medium w-20 text-right">点赞</th>
                            <th className="px-4 py-2 font-medium w-16 text-right">评论</th>
                            <th className="px-4 py-2 font-medium w-24">分类</th>
                            <th className="px-4 py-2 font-medium w-24">发布时间</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredVideos.map((v, i) => (
                            <tr key={v.id} className="border-t border-outline-variant/30 hover:bg-surface-high/50">
                              <td className="px-4 py-2 text-mute">{i + 1}</td>
                              <td className="px-4 py-2 text-on-surface max-w-xs truncate">{v.title || '-'}</td>
                              <td className="px-4 py-2 text-body truncate">{v.authorName || '-'}</td>
                              <td className="px-4 py-2 text-right text-on-surface">{formatNumber(v.playCount)}</td>
                              <td className="px-4 py-2 text-right text-on-surface">{formatNumber(v.likeCount)}</td>
                              <td className="px-4 py-2 text-right text-on-surface">{formatNumber(v.commentCount)}</td>
                              <td className="px-4 py-2">
                                <select
                                  value={v.category || '未分类'}
                                  onChange={e => handleUpdateCategory(v.contentId, e.target.value)}
                                  className="bg-surface-high border border-outline-variant rounded px-1.5 py-0.5 text-[10px] text-on-surface max-w-[90px] truncate cursor-pointer hover:border-primary/50"
                                >
                                  <option value="未分类">未分类</option>
                                  <option value={v.category || '未分类'}>{v.category || '未分类'}</option>
                                </select>
                              </td>
                              <td className="px-4 py-2 text-mute">{formatDate(v.createdAt)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 上下文菜单 */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          source={contextMenu.source}
          onClose={() => setContextMenu(null)}
          onStar={() => handleStar(contextMenu.source)}
          onPin={() => handlePin(contextMenu.source)}
          onExport={() => handleExport(contextMenu.source)}
          onDelete={() => handleDelete(contextMenu.source)}
        />
      )}

      {/* 更多菜单 */}
      {moreMenuOpen && (
        <div
          className="fixed z-50 bg-surface-low border border-outline-variant rounded-xl shadow-xl py-1 min-w-[160px]"
          style={{ bottom: 60, right: 20 }}
          onClick={e => e.stopPropagation()}
        >
          <button onClick={() => { handleExportAll(); setMoreMenuOpen(false) }} className="w-full px-3 py-2 text-left text-xs text-on-surface hover:bg-surface-container flex items-center gap-2">
            <span>📦</span> 导出全部数据
          </button>
          <div className="h-px bg-outline-variant mx-2 my-1" />
          <button onClick={async () => {
            if (!confirm('确定清空全部历史数据？此操作不可恢复。')) return
            if (api?.cleanOldData) await api.cleanOldData()
            setMoreMenuOpen(false)
            setSelectedSource('all')
            await loadSources()
          }} className="w-full px-3 py-2 text-left text-xs text-red-400 hover:bg-red-500/10 flex items-center gap-2">
            <span>🗑️</span> 清空全部历史
          </button>
        </div>
      )}

      {/* 点击关闭更多菜单 */}
      {moreMenuOpen && (
        <div className="fixed inset-0 z-40" onClick={() => setMoreMenuOpen(false)} />
      )}
    </div>
  )
}
