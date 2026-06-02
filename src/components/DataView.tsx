import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import type { CrawlContent, VideoAnalysis, SourceInfo } from '../types/electron'
import { usePlatform } from '../contexts/PlatformContext'
import { gsap } from '../lib/gsap'
import TrendChart from './data/TrendChart'
import CategoryChart from './data/CategoryChart'
import TimeChart from './data/TimeChart'
import RadarChart from './data/RadarChart'
import ScatterChart from './data/ScatterChart'
import VideoDetailPanel from './data/VideoDetailPanel'
import ExportMenu from './data/ExportMenu'
import { ChartBar, Tag, Clock, TrendUp, PlayCircle, ThumbsUp, ChatsCircle, ShareNetwork, Users, BookmarkSimple, Coin, Subtitles, TextAa, ChartLineUp, ChartPie, ChartPolar, ChartScatter, Brain, Trophy, Lightbulb, Note, MagnifyingGlass, Database, Plus, DotsThree, Person, Sparkle, CheckCircle, WarningCircle, HourglassSimple, StackSimple, ArrowDown, ArrowUp, FunnelSimple, MagicWand, ArrowRight, Download, Trash } from '@phosphor-icons/react'
import type { ComponentType } from 'react'

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
//  数据维度定义
// ============================================================

const DIMENSIONS: { key: string; label: string; icon: ComponentType<{ className?: string }> }[] = [
  { key: 'play_count', label: '播放量', icon: PlayCircle },
  { key: 'like_count', label: '点赞数', icon: ThumbsUp },
  { key: 'comment_count', label: '评论数', icon: ChatsCircle },
  { key: 'share_count', label: '分享数', icon: ShareNetwork },
  { key: 'total_fans', label: '粉丝数', icon: Users },
  { key: 'favorite_count', label: '收藏数', icon: BookmarkSimple },
  { key: 'coin_count', label: '投币数', icon: Coin },
  { key: 'danmaku', label: '弹幕数', icon: Subtitles },
  { key: 'engagement_rate', label: '互动率', icon: TrendUp },
  { key: 'publish_time', label: '发布时间', icon: Clock },
  { key: 'category', label: '内容分类', icon: Tag },
  { key: 'title_length', label: '标题长度', icon: TextAa },
]

const CHART_TABS: { key: string; label: string; icon: ComponentType<{ className?: string }> }[] = [
  { key: 'trend', label: '播放趋势', icon: ChartLineUp },
  { key: 'category', label: '分类占比', icon: ChartPie },
  { key: 'time', label: '发布时间', icon: Clock },
  { key: 'radar', label: '综合评分', icon: ChartPolar },
  { key: 'scatter', label: '标题分析', icon: ChartScatter },
]

// ============================================================
//  头像组件（带 fallback）
// ============================================================

function Avatar({ src, name, size = 32 }: { src?: string; name: string; size?: number }) {
  const [imgError, setImgError] = useState(false)

  if (src && !imgError) {
    return (
      <img
        src={src}
        alt={name}
        style={{ width: size, height: size }}
        className="rounded-full object-cover border border-hairline shrink-0"
        onError={() => setImgError(true)}
      />
    )
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
    <div className="bg-canvas-soft rounded-xl px-5 py-4">
      <div className="flex items-center gap-3 mb-2">
        {isDone ? (<CheckCircle className="w-5 h-5 text-semantic-success" />) : isFailed ? (<WarningCircle className="w-5 h-5 text-semantic-error" />) : (<div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />)}
        <span className="text-sm text-ink font-medium">{status}</span>
      </div>
      {logs && logs.length > 0 && (
        <div className="mt-2 bg-ink/90 rounded-lg p-3 max-h-[200px] overflow-auto font-mono text-[11px] leading-relaxed">
          {logs.map((line, i) => (
            <div key={i} className="text-semantic-success/80">
              <span className="text-muted/50 mr-2">{String(i + 1).padStart(3, ' ')}</span>
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
//  概览卡片（支持维度选择 + 粉丝数）
// ============================================================

function OverviewCards({ overview, selectedDimensions, fans }: {
  overview: VideoAnalysis['overview']
  selectedDimensions: string[]
  fans?: number
}) {
  const handleCardHover = (e: React.MouseEvent<HTMLDivElement>) => {
    gsap.to(e.currentTarget, { scale: 1.02, boxShadow: '0 4px 20px rgba(0,0,0,0.08)', duration: 0.2, ease: 'power2.out' })
  }
  const handleCardLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    gsap.to(e.currentTarget, { scale: 1, boxShadow: 'none', duration: 0.2, ease: 'power2.out' })
  }
  const allCards: { key: string; label: string; value: number; icon: ComponentType<{ className?: string }>; suffix?: string }[] = [
    { key: 'play_count', label: '总播放量', value: overview.totalPlay, icon: PlayCircle },
    { key: 'like_count', label: '总点赞数', value: overview.totalLike, icon: ThumbsUp },
    { key: 'comment_count', label: '总评论数', value: overview.totalComment, icon: ChatsCircle },
    { key: 'share_count', label: '总分享数', value: overview.totalShare, icon: ShareNetwork },
    { key: 'total_fans', label: '粉丝数', value: fans || 0, icon: Users },
    { key: 'favorite_count', label: '总收藏数', value: overview.totalFavorite, icon: BookmarkSimple },
    { key: 'coin_count', label: '总投币数', value: overview.totalCoin, icon: Coin },
    { key: 'danmaku', label: '总弹幕数', value: overview.totalDanmaku, icon: Subtitles },
    { key: 'engagement_rate', label: '平均互动率', value: overview.avgEngagement, icon: ChartBar, suffix: '%' },
  ]
  const cards = allCards.filter(c => selectedDimensions.includes(c.key))
  if (cards.length === 0) return null
  return (
    <div className={`grid gap-3 ${cards.length <= 4 ? 'grid-cols-4' : cards.length <= 6 ? 'grid-cols-3' : 'grid-cols-4'}`}>
      {cards.map(c => (
        <div key={c.key} className="overview-card" onMouseEnter={handleCardHover} onMouseLeave={handleCardLeave}>
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-primary"><c.icon className="w-3.5 h-3.5" /></span>
            <span className="text-[11px] text-muted">{c.label}</span>
          </div>
          <p className="text-xl font-semibold text-ink">
            {formatNumber(c.value)}{'suffix' in c ? c.suffix : ''}
          </p>
        </div>
      ))}
    </div>
  )
}

// ============================================================
//  维度选择器
// ============================================================

function DimensionSelector({ selected, onChange }: { selected: string[]; onChange: (dims: string[]) => void }) {
  const toggle = (key: string) => {
    onChange(selected.includes(key) ? selected.filter(d => d !== key) : [...selected, key])
  }
  return (
    <div className="flex flex-wrap gap-1.5">
      {DIMENSIONS.map(d => (
        <button
          key={d.key}
          onClick={() => toggle(d.key)}
          className={`flex items-center gap-1 px-2.5 py-1 text-[11px] rounded-full transition-colors ${
            selected.includes(d.key)
              ? 'bg-primary/15 text-primary border border-primary/30'
              : 'bg-canvas-soft text-muted border border-hairline/30 hover:border-hairline'
          }`}
        >
          <span><d.icon className="w-3 h-3" /></span>
          {d.label}
        </button>
      ))}
    </div>
  )
}

// ============================================================
//  内容规律卡片
// ============================================================

function ContentPatternsCard({ analysis }: { analysis: VideoAnalysis }) {
  return (
    <div className="bg-canvas-soft rounded-xl p-5">
      <h3 className="text-sm font-medium text-ink mb-4 flex items-center gap-2">
        <Brain className="w-4 h-4 text-primary" />
        内容规律
      </h3>
      {analysis.topTopics && analysis.topTopics.length > 0 && (
        <div className="mb-4">
          <p className="text-[11px] text-muted mb-2">最佳选题方向（按平均播放排序）</p>
          <div className="space-y-1.5">
            {analysis.topTopics.map((t, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-5 h-5 rounded bg-surface-strong flex items-center justify-center text-[10px] text-primary font-medium">{i + 1}</span>
                <span className="text-xs text-ink flex-1">{t.topic}</span>
                <span className="text-[10px] text-body">{t.count} 条</span>
                <span className="text-[10px] text-primary">{formatNumber(t.avgPlay)} 播放</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {analysis.titlePatterns && (
        <div className="mb-4">
          <p className="text-[11px] text-muted mb-1.5">标题特征</p>
          <p className="text-xs text-ink leading-relaxed">{analysis.titlePatterns}</p>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        {analysis.bestDuration && (
          <div className="bg-surface-strong rounded-lg px-3 py-2">
            <p className="text-[10px] text-muted mb-0.5">最佳时长</p>
            <p className="text-xs text-ink font-medium">{analysis.bestDuration}</p>
          </div>
        )}
        {analysis.bestTime && (
          <div className="bg-surface-strong rounded-lg px-3 py-2">
            <p className="text-[10px] text-muted mb-0.5">最佳发布时间</p>
            <p className="text-xs text-ink font-medium">{analysis.bestTime}</p>
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
    <div className="bg-canvas-soft rounded-xl p-5">
      <h3 className="text-sm font-medium text-ink mb-4 flex items-center gap-2">
        <Trophy className="w-4 h-4 text-primary" />
        内容质量排行
      </h3>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-muted border-b border-hairline">
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
              <tr key={i} className={`border-b border-hairline/30 ${isTop3 ? 'bg-primary/5' : ''}`}>
                <td className="py-2">
                  <span className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-medium ${isTop3 ? 'bg-primary/20 text-primary' : 'text-muted'}`}>{i + 1}</span>
                </td>
                <td className="py-2 text-ink max-w-[200px] truncate">
                  {item.title}
                  {isTop3 && <span className="ml-1.5 text-[9px] text-primary">高质量方向</span>}
                </td>
                <td className="py-2 text-right text-body">{formatNumber(item.playCount)}</td>
                <td className="py-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-surface-strong rounded-full overflow-hidden">
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
  const icons: ComponentType<{ className?: string }>[] = [Lightbulb, Note, Clock]
  return (
    <div className="bg-canvas-soft rounded-xl p-5">
      <h3 className="text-sm font-medium text-ink mb-4 flex items-center gap-2">
        <MagicWand className="w-4 h-4 text-primary" />
        下一步建议
      </h3>
      <div className="space-y-3">
        {suggestions.map((s, i) => (
          <div key={i} className="flex gap-3">
            <div className="w-6 h-6 rounded bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
              {(() => { const Icon = icons[i] || ArrowRight; return <Icon className="w-3.5 h-3.5 text-primary" />; })()}
            </div>
            <div className="flex-1">
              <p className="text-xs text-ink leading-relaxed">{s}</p>
              <p className="text-[10px] text-muted mt-1">基于 {videoCount} 条视频的数据分析</p>
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
      className="fixed z-50 bg-canvas-soft border border-hairline rounded-xl shadow-xl py-1 min-w-[160px]"
      style={{ left: x, top: y }}
      onClick={e => e.stopPropagation()}
    >
      {isCreator && (
        <>
          <button onClick={() => { onStar(); onClose() }} className="w-full px-3 py-2 text-left text-xs text-ink hover:bg-canvas-soft flex items-center gap-2">
            <BookmarkSimple className={`w-3.5 h-3.5 ${source.isStarred ? 'text-primary' : 'text-muted'}`} weight={source.isStarred ? 'fill' : 'regular'} />
            {source.isStarred ? '取消收藏' : '收藏'}
          </button>
          <button onClick={() => { onPin(); onClose() }} className="w-full px-3 py-2 text-left text-xs text-ink hover:bg-canvas-soft flex items-center gap-2">
            <FunnelSimple className={`w-3.5 h-3.5 ${source.isPinned ? 'text-semantic-success' : 'text-muted'}`} weight={source.isPinned ? 'fill' : 'regular'} />
            {source.isPinned ? '取消置顶' : '置顶'}
          </button>
          <div className="h-px bg-hairline mx-2 my-1" />
        </>
      )}
      <button onClick={() => { onExport(); onClose() }} className="w-full px-3 py-2 text-left text-xs text-ink hover:bg-canvas-soft flex items-center gap-2">
        <Download className="w-3.5 h-3.5 text-muted" /> 导出数据
      </button>
      <div className="h-px bg-hairline mx-2 my-1" />
      <button onClick={() => { onDelete(); onClose() }} className="w-full px-3 py-2 text-left text-xs text-semantic-error hover:bg-semantic-error/10 flex items-center gap-2">
        <Trash className="w-3.5 h-3.5 text-semantic-error" /> 删除数据
      </button>
    </div>
  )
}

// ============================================================
//  侧边栏
// ============================================================

function Sidebar({
  sources, selectedSource, searchQuery, onMagnifyingGlassChange, onSelect,
  onNewCrawl, onContextMenu, onMoreMenu,
}: {
  sources: SourceInfo[]; selectedSource: string; searchQuery: string
  onMagnifyingGlassChange: (q: string) => void; onSelect: (uid: string) => void
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

  const renderGroup = (title: string, Icon: ComponentType<{ className?: string }>, items: SourceInfo[]) => {
    if (items.length === 0) return null
    return (
      <div className="mb-1">
        <div className="text-[10px] text-muted uppercase tracking-wider px-4 py-2 flex items-center gap-1.5">
          <Icon className="w-3 h-3" />
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
    <div className="w-60 bg-canvas-soft border-r border-hairline flex flex-col shrink-0">
      <div className="p-2">
        <div className="relative">
          <MagnifyingGlass className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            value={searchQuery}
            onChange={e => onMagnifyingGlassChange(e.target.value)}
            placeholder="搜索来源..."
            className="w-full bg-canvas-soft rounded-lg pl-8 pr-3 py-2 text-xs text-ink placeholder:text-muted outline-none focus:ring-1 focus:ring-primary/50"
          />
        </div>
      </div>

      <div className="flex-1 overflow-auto px-1">
        {renderGroup('置顶', FunnelSimple, pinned)}
        {renderGroup('收藏', BookmarkSimple, starred)}
        {renderGroup('创作者', Person, creators)}
        {renderGroup('关键词', MagnifyingGlass, keywords)}

        <div className="mb-1">
          <div className="text-[10px] text-muted uppercase tracking-wider px-4 py-2 flex items-center gap-1.5">
            <Database className="w-3 h-3" />
            全部
          </div>
          <button
            onClick={() => onSelect('all')}
            className={`w-full flex items-center gap-3 px-3 py-2 mx-1 rounded-lg transition-colors text-left ${
              selectedSource === 'all'
                ? 'bg-canvas-soft border-l-2 border-primary'
                : 'hover:bg-canvas-soft/50'
            }`}
          >
            <div className="w-8 h-8 rounded-full bg-canvas-soft flex items-center justify-center">
              <ChartBar className="w-4 h-4 text-muted" />
            </div>
            <span className="text-xs text-ink flex-1 truncate">全部数据</span>
            <span className="text-[10px] text-muted">{totalCount}</span>
          </button>
        </div>
      </div>

      <div className="p-2 border-t border-hairline flex gap-1">
        <button
          onClick={onNewCrawl}
          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-primary/10 text-primary text-xs hover:bg-primary/20 transition-colors"
        >
          <Plus className="w-4 h-4" />
          新建爬取
        </button>
        <button
          onClick={onMoreMenu}
          className="px-2 py-2 rounded-lg text-muted hover:bg-canvas-soft transition-colors"
        >
          <DotsThree className="w-4 h-4" />
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
          ? 'bg-canvas-soft border-l-2 border-primary'
          : 'hover:bg-canvas-soft/50'
      }`}
    >
      <Avatar src={source.avatarUrl} name={source.sourceName} size={32} />
      <span className="text-xs text-ink flex-1 truncate">{source.sourceName}</span>
      <span className="text-[10px] text-muted">{source.count}</span>
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
  const [mode, setMode] = useState<Mode>('search')
  const [crawlKeyword, setCrawlKeyword] = useState('')
  const [crawlUid, setCrawlUid] = useState('')
  const [crawlPlatform, setCrawlPlatform] = useState('bili')
  const [analyzing, setAnalyzing] = useState(false)
  const [loading, setLoading] = useState(true)
  const [searchQuery, setMagnifyingGlassQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [categorizing, setCategorizing] = useState(false)
  const [categorizeStatus, setCategorizeStatus] = useState('')
  const [crawlStatus, setCrawlStatus] = useState('')
  const [crawlLogs, setCrawlLogs] = useState<string[]>([])
  const [aiStatus, setAiStatus] = useState('')
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; source: SourceInfo } | null>(null)
  const [moreMenuOpen, setMoreMenuOpen] = useState(false)
  const analysisCache = useRef<Map<string, { data: VideoAnalysis; timestamp: number }>>(new Map())
  const cleanupRef = useRef<(() => void) | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const { isWindows } = usePlatform()

  // 新增状态
  const [selectedDimensions, setSelectedDimensions] = useState<string[]>([
    'play_count', 'like_count', 'comment_count', 'total_fans', 'engagement_rate',
  ])
  const [activeChart, setActiveChart] = useState('trend')
  const [selectedVideo, setSelectedVideo] = useState<CrawlContent | null>(null)
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const prevChartRef = useRef('trend')

  // Chart transition animation
  useEffect(() => {
    if (prevChartRef.current !== activeChart && chartContainerRef.current) {
      const el = chartContainerRef.current
      gsap.fromTo(el,
        { opacity: 0, y: 8 },
        { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out', clearProps: 'transform' }
      )
    }
    prevChartRef.current = activeChart
  }, [activeChart])

  // 表格排序/筛选/分页
  const [sortField, setSortField] = useState('playCount')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [tablePage, setTablePage] = useState(0)
  const pageSize = 20

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
          if (evt.message) setCrawlLogs(prev => [...prev, evt.message])
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

  const loadSources = useCallback(async () => {
    if (!api?.getSources) return
    try {
      const list = await api.getSources(crawlPlatform)
      setSources(list)
    } catch { /* ignore */ }
  }, [api, crawlPlatform])

  useEffect(() => { loadSources() }, [loadSources])

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

  // 获取粉丝数
  const fansCount = useMemo(() => {
    if (selectedSource === 'all') return undefined
    const src = sources.find(s => s.sourceUid === selectedSource)
    return src?.totalFans || undefined
  }, [sources, selectedSource])

  const localStats = useMemo(() => {
    if (videos.length === 0) return null
    const totalPlay = videos.reduce((s, v) => s + v.playCount, 0)
    const totalLike = videos.reduce((s, v) => s + v.likeCount, 0)
    const totalComment = videos.reduce((s, v) => s + v.commentCount, 0)
    const totalShare = videos.reduce((s, v) => s + v.shareCount, 0)
    const totalCoin = videos.reduce((s, v) => {
      const raw = v.rawJson || {}
      return s + (parseInt(raw.video_coin_count) || 0)
    }, 0)
    const totalFavorite = videos.reduce((s, v) => {
      const raw = v.rawJson || {}
      return s + (parseInt(raw.video_favorite_count) || 0)
    }, 0)
    const totalDanmaku = videos.reduce((s, v) => {
      const raw = v.rawJson || {}
      return s + (parseInt(raw.video_danmaku) || 0)
    }, 0)
    const avgPlay = Math.round(totalPlay / videos.length)
    const avgLike = Math.round(totalLike / videos.length)
    const avgEngagement = videos.length > 0
      ? videos.reduce((s, v) => {
        const raw = v.rawJson || {}
        const coin = parseInt(raw.video_coin_count) || 0
        const fav = parseInt(raw.video_favorite_count) || 0
        const danmaku = parseInt(raw.video_danmaku) || 0
        return s + (v.playCount > 0 ? (v.likeCount + coin + fav + v.commentCount + danmaku) / v.playCount * 100 : 0)
      }, 0) / videos.length
      : 0
    return {
      overview: {
        totalVideos: videos.length,
        totalPlay,
        totalLike,
        totalComment,
        totalShare,
        totalCoin,
        totalFavorite,
        totalDanmaku,
        avgPlay,
        avgLike,
        avgEngagement: Math.round(avgEngagement * 100) / 100,
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

  const invalidateAnalysisCache = useCallback((sourceUid?: string) => {
    if (sourceUid) {
      analysisCache.current.delete(`${crawlPlatform}:${sourceUid}`)
    } else {
      analysisCache.current.clear()
    }
  }, [crawlPlatform])

  const runAIAnalysis = async () => {
    if (!api) return
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

  const handleUpdateCategory = async (contentId: string, category: string) => {
    if (!api?.updateCategory) return
    await api.updateCategory(contentId, category)
    setVideos(prev => prev.map(v => v.contentId === contentId ? { ...v, category } : v))
  }

  const filteredVideos = useMemo(() => {
    return selectedCategory
      ? videos.filter(v => v.category === selectedCategory)
      : videos
  }, [videos, selectedCategory])

  const sortedVideos = useMemo(() => {
    return [...filteredVideos].sort((a, b) => {
      const getVal = (v: CrawlContent) => {
        switch (sortField) {
          case 'playCount': return v.playCount
          case 'likeCount': return v.likeCount
          case 'commentCount': return v.commentCount
          case 'shareCount': return v.shareCount
          case 'createdAt': return v.createdAt ? new Date(v.createdAt).getTime() : 0
          default: return 0
        }
      }
      const aVal = getVal(a)
      const bVal = getVal(b)
      return sortDir === 'desc' ? bVal - aVal : aVal - bVal
    })
  }, [filteredVideos, sortField, sortDir])

  const pagedVideos = sortedVideos.slice(tablePage * pageSize, (tablePage + 1) * pageSize)
  const totalPages = Math.ceil(sortedVideos.length / pageSize)

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
        if (result.sourceUid) setSelectedSource(result.sourceUid)
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

  const handleNewCrawl = () => {
    setMode('creator')
    setTimeout(() => inputRef.current?.focus(), 100)
  }

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
    for (const s of sources) {
      if (s.sourceUid) await api.exportSourceData(s.sourceUid)
    }
  }

  const isRunning = analyzing || !!crawlStatus
  const currentSource = sources.find(s => s.sourceUid === selectedSource)

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* 顶部操作栏 */}
      <div className={`titlebar-drag h-12 px-6 shrink-0 flex items-center gap-3 ${isWindows ? '' : 'border-b border-hairline'}`}>
        <h1 className="text-sm font-medium text-ink mr-2">数据分析</h1>
        <div className="flex gap-1">
          <button onClick={() => setMode('search')}
            className={`px-3 py-1 text-[11px] rounded-full transition-colors ${mode === 'search' ? 'bg-primary/20 text-primary' : 'bg-canvas-soft text-muted hover:text-ink'}`}>
            <MagnifyingGlass className="w-3 h-3 mr-1" />关键词搜索
          </button>
          <button onClick={() => setMode('creator')}
            className={`px-3 py-1 text-[11px] rounded-full transition-colors ${mode === 'creator' ? 'bg-primary/20 text-primary' : 'bg-canvas-soft text-muted hover:text-ink'}`}>
            <Person className="w-3 h-3 mr-1" />用户主页
          </button>
        </div>
      </div>

      <div className="px-6 py-2 border-b border-hairline shrink-0 flex items-center gap-3">
        <select value={crawlPlatform} onChange={e => { setCrawlPlatform(e.target.value); setSelectedSource('all') }}
          className="bg-canvas-soft border border-hairline rounded px-2 py-1.5 text-xs text-ink">
          <option value="bili">B站</option>
          <option value="dy">抖音</option>
          <option value="xhs">小红书</option>
          <option value="wb">微博</option>
        </select>
        {mode === 'search' ? (
          <input ref={inputRef} value={crawlKeyword} onChange={e => setCrawlKeyword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && startCrawl()} placeholder="输入搜索关键词..." disabled={isRunning}
            className="flex-1 bg-canvas-soft border border-hairline rounded px-3 py-1.5 text-xs text-ink placeholder:text-muted disabled:opacity-50" />
        ) : (
          <input ref={inputRef} value={crawlUid} onChange={e => setCrawlUid(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && startCrawl()} placeholder="输入用户 UID（如 B站 space.bilibili.com/后面的数字）" disabled={isRunning}
            className="flex-1 bg-canvas-soft border border-hairline rounded px-3 py-1.5 text-xs text-ink placeholder:text-muted disabled:opacity-50" />
        )}
        <button onClick={startCrawl} disabled={isRunning || !(mode === 'search' ? crawlKeyword : crawlUid).trim()}
          className="px-4 py-1.5 bg-primary text-on-primary text-xs font-medium rounded hover:opacity-90 disabled:opacity-40">
          {isRunning ? '处理中...' : '爬取'}
        </button>
        <button onClick={runAIAnalysis} disabled={analyzing || videos.length === 0}
          className="px-4 py-1.5 bg-canvas-soft border border-hairline text-ink text-xs rounded hover:bg-surface-strong disabled:opacity-40">
          <Sparkle className="w-3 h-3 mr-1" />
          {analyzing ? '分析中...' : 'AI 分析'}
        </button>
        <button onClick={runAutoCategorize} disabled={categorizing || videos.length === 0}
          className="px-4 py-1.5 bg-primary/10 border border-primary/30 text-primary text-xs rounded hover:bg-primary/20 disabled:opacity-40">
          <Tag className="w-3 h-3 mr-1" />
          {categorizing ? '分类中...' : 'AI 一键分类'}
        </button>
      </div>

      {/* 主体 */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar
          sources={sources} selectedSource={selectedSource} searchQuery={searchQuery}
          onMagnifyingGlassChange={setMagnifyingGlassQuery} onSelect={setSelectedSource} onNewCrawl={handleNewCrawl}
          onContextMenu={(e, s) => setContextMenu({ x: e.clientX, y: e.clientY, source: s })}
          onMoreMenu={() => setMoreMenuOpen(!moreMenuOpen)}
        />

        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-32">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-sm text-body">加载数据中...</p>
            </div>
          ) : videos.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-32">
              <ChartBar className="w-12 h-12 text-muted mb-4" />
              <p className="text-sm text-body">
                {selectedSource === 'all' ? '还没有数据，输入关键词或用户 UID 开始爬取' : '该来源暂无数据'}
              </p>
            </div>
          ) : (
            <div className="p-6 space-y-5 max-w-[1100px]">
              {crawlStatus && <ProgressBar status={crawlStatus} logs={crawlLogs} />}
              {aiStatus && <ProgressBar status={aiStatus} />}
              {categorizeStatus && (
                <div className="bg-primary/5 border border-primary/20 rounded-xl px-4 py-3 flex items-center gap-2">
                  <Tag className="w-4 h-4 text-primary" />
                  <span className="text-xs text-ink">{categorizeStatus}</span>
                </div>
              )}

              {/* 创作者详情头部 */}
              {currentSource && currentSource.type === 'creator' && (
                <div className="bg-canvas-soft rounded-xl p-5 flex items-center gap-4">
                  <Avatar src={currentSource.avatarUrl} name={currentSource.sourceName} size={48} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-medium text-ink">{currentSource.sourceName}</h2>
                      {currentSource.isStarred ? <span className="text-primary text-sm">★</span> : null}
                      {currentSource.isPinned ? <span className="text-sm">📌</span> : null}
                    </div>
                    <p className="text-[11px] text-muted">
                      UID: {currentSource.sourceUid} · {currentSource.count} 个视频
                      {currentSource.totalFans ? ` · ${formatNumber(currentSource.totalFans)} 粉丝` : ''}
                    </p>
                  </div>
                </div>
              )}

              {/* 关键词头部 */}
              {currentSource && currentSource.type === 'keyword' && (
                <div className="bg-canvas-soft rounded-xl p-5 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-surface-strong flex items-center justify-center">
                    <MagnifyingGlass className="w-6 h-6 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-lg font-medium text-ink">{currentSource.sourceName}</h2>
                    <p className="text-[11px] text-muted">关键词搜索 · {currentSource.count} 个视频</p>
                  </div>
                </div>
              )}

              {/* 数据维度选择器 */}
              <div className="bg-canvas-soft rounded-xl px-4 py-3">
                <div className="flex items-center gap-2 mb-2">
                  <FunnelSimple className="w-3.5 h-3.5 text-primary" />
                  <span className="text-[11px] text-muted">数据维度</span>
                </div>
                <DimensionSelector selected={selectedDimensions} onChange={setSelectedDimensions} />
              </div>

              {/* 概览卡片 */}
              {localStats && <OverviewCards overview={localStats.overview} selectedDimensions={selectedDimensions} fans={fansCount || analysis?.fans} />}

              {/* 图表 Tab */}
              <div>
                <div className="flex gap-1 mb-4">
                  {CHART_TABS.map(c => (
                    <button key={c.key} onClick={() => setActiveChart(c.key)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] rounded-full transition-colors ${
                        activeChart === c.key ? 'bg-primary/20 text-primary' : 'bg-canvas-soft text-muted hover:text-ink'
                      }`}>
                      <c.icon className="w-3.5 h-3.5" />
                      {c.label}
                    </button>
                  ))}
                </div>
                <div ref={chartContainerRef} className="chart-card">
                  {activeChart === 'trend' && <TrendChart data={filteredVideos} />}
                  {activeChart === 'category' && <CategoryChart data={filteredVideos} />}
                  {activeChart === 'time' && <TimeChart data={filteredVideos} />}
                  {activeChart === 'radar' && localStats && <RadarChart stats={{ ...localStats, topByEngagement: analysis?.topByEngagement }} />}
                  {activeChart === 'scatter' && <ScatterChart data={filteredVideos} />}
                </div>
              </div>

              {/* AI 洞察 */}
              {analysis?.topTopics && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  <ContentPatternsCard analysis={analysis} />
                  <SuggestionsCard suggestions={analysis.suggestions || []} videoCount={analysis.overview.totalVideos} />
                </div>
              )}

              {/* 互动率排行 */}
              {localStats && <EngagementTable items={localStats.topByEngagement} />}

              {/* AI 分析按钮 */}
              {!analysis && videos.length > 0 && (
                <button onClick={runAIAnalysis} disabled={analyzing}
                  className="w-full bg-canvas-soft rounded-xl p-6 text-center hover:bg-surface-strong transition-colors">
                  <span className="text-primary mb-3 block">
                    {analyzing ? <HourglassSimple className="w-8 h-8" /> : <Sparkle className="w-8 h-8" />}
                  </span>
                  <p className="text-sm text-ink mb-1">
                    {analyzing ? 'AI 正在分析数据...' : '点击「AI 分析」获取深度洞察'}
                  </p>
                  <p className="text-[11px] text-muted">
                    {analyzing ? '请稍候，正在分析选题方向、标题特征...' : '分析选题方向、标题特征、发布时间等规律'}
                  </p>
                </button>
              )}

              {/* 分类标签 */}
              {videos.length > 0 && (
                <div className="bg-canvas-soft rounded-xl px-4 py-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Tag className="w-3.5 h-3.5 text-primary" />
                    <span className="text-[11px] text-muted">按分类筛选</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <button onClick={() => setSelectedCategory('')}
                      className={`px-2.5 py-1 text-[11px] rounded-full transition-colors ${selectedCategory === '' ? 'bg-primary text-on-primary' : 'bg-surface-strong text-muted hover:text-ink'}`}>
                      全部（{videos.length}）
                    </button>
                    {(() => {
                      const catMap: Record<string, number> = {}
                      for (const v of videos) { const c = v.category || '未分类'; catMap[c] = (catMap[c] || 0) + 1 }
                      return Object.entries(catMap).sort((a, b) => b[1] - a[1]).map(([cat, cnt]) => (
                        <button key={cat} onClick={() => setSelectedCategory(cat === selectedCategory ? '' : cat)}
                          className={`px-2.5 py-1 text-[11px] rounded-full transition-colors ${cat === selectedCategory ? 'bg-primary text-on-primary' : 'bg-surface-strong text-muted hover:text-ink'}`}>
                          {cat}（{cnt}）
                        </button>
                      ))
                    })()}
                  </div>
                </div>
              )}

              {/* 视频数据表格 */}
              {sortedVideos.length > 0 && (
                <div className="bg-surface rounded-xl border border-hairline/30 overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-hairline/20">
                    <span className="text-sm font-medium text-ink flex items-center gap-2">
                      <StackSimple className="w-4 h-4 text-primary" />
                      数据列表（{sortedVideos.length} 条）
                    </span>
                    <div className="flex items-center gap-2">
                      {/* 排序 */}
                      <select value={sortField} onChange={e => { setSortField(e.target.value); setTablePage(0) }}
                        className="bg-canvas-soft border border-hairline/30 rounded-lg px-2 py-1 text-[11px] text-ink">
                        <option value="playCount">按播放量</option>
                        <option value="likeCount">按点赞数</option>
                        <option value="commentCount">按评论数</option>
                        <option value="shareCount">按分享数</option>
                        <option value="createdAt">按发布时间</option>
                      </select>
                      <button onClick={() => { setSortDir(d => d === 'desc' ? 'asc' : 'desc'); setTablePage(0) }}
                        className="p-1.5 rounded-lg text-muted hover:text-ink hover:bg-canvas-soft">
                        {sortDir === 'desc' ? <ArrowDown className="w-4 h-4" /> : <ArrowUp className="w-4 h-4" />}
                      </button>
                      {/* 分类筛选 */}
                      <select value={selectedCategory} onChange={e => { setSelectedCategory(e.target.value); setTablePage(0) }}
                        className="bg-canvas-soft border border-hairline/30 rounded-lg px-2 py-1 text-[11px] text-ink">
                        <option value="">全部分类</option>
                        {[...new Set(videos.map(v => v.category || '未分类'))].sort().map(cat => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                      <ExportMenu videos={sortedVideos} overview={localStats?.overview} analysis={analysis || undefined} sourceName={currentSource?.sourceName} />
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-canvas-soft">
                        <tr className="text-left text-muted border-b border-hairline/30">
                          <th className="px-4 py-2.5 w-8">#</th>
                          <th className="px-4 py-2.5">标题</th>
                          <th className="px-4 py-2.5 w-20">作者</th>
                          <th className="px-4 py-2.5 w-20 text-right cursor-pointer hover:text-ink" onClick={() => { setSortField('playCount'); setSortDir('desc'); setTablePage(0) }}>播放 ↓</th>
                          <th className="px-4 py-2.5 w-16 text-right cursor-pointer hover:text-ink" onClick={() => { setSortField('likeCount'); setSortDir('desc'); setTablePage(0) }}>点赞</th>
                          <th className="px-4 py-2.5 w-16 text-right">评论</th>
                          <th className="px-4 py-2.5 w-16 text-right">分享</th>
                          <th className="px-4 py-2.5 w-24">分类</th>
                          <th className="px-4 py-2.5 w-24">发布时间</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pagedVideos.map((v, i) => (
                          <tr key={v.id} onClick={() => setSelectedVideo(v)}
                            className="border-b border-hairline/20 hover:bg-canvas-soft/50 cursor-pointer">
                            <td className="px-4 py-2.5 text-muted">{tablePage * pageSize + i + 1}</td>
                            <td className="px-4 py-2.5 text-ink truncate max-w-[280px]">{v.title || '-'}</td>
                            <td className="px-4 py-2.5 text-muted truncate">{v.authorName || '-'}</td>
                            <td className="px-4 py-2.5 text-right font-medium text-ink">{formatNumber(v.playCount)}</td>
                            <td className="px-4 py-2.5 text-right text-ink">{formatNumber(v.likeCount)}</td>
                            <td className="px-4 py-2.5 text-right text-ink">{v.commentCount}</td>
                            <td className="px-4 py-2.5 text-right text-ink">{v.shareCount}</td>
                            <td className="px-4 py-2.5">
                              <span className="px-2 py-0.5 bg-canvas-soft rounded-full text-[10px] text-muted">
                                {v.category || '未分类'}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 text-muted">{formatDate(v.createdAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* 分页 */}
                  {sortedVideos.length > pageSize && (
                    <div className="flex items-center justify-between px-4 py-2.5 border-t border-hairline/20">
                      <span className="text-[11px] text-muted">
                        第 {tablePage + 1} / {totalPages} 页
                      </span>
                      <div className="flex gap-1">
                        <button disabled={tablePage === 0} onClick={() => setTablePage(p => p - 1)}
                          className="px-2 py-1 text-[11px] rounded bg-canvas-soft text-muted disabled:opacity-30">上一页</button>
                        <button disabled={(tablePage + 1) * pageSize >= sortedVideos.length} onClick={() => setTablePage(p => p + 1)}
                          className="px-2 py-1 text-[11px] rounded bg-canvas-soft text-muted disabled:opacity-30">下一页</button>
                      </div>
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
        <ContextMenu x={contextMenu.x} y={contextMenu.y} source={contextMenu.source}
          onClose={() => setContextMenu(null)}
          onStar={() => handleStar(contextMenu.source)} onPin={() => handlePin(contextMenu.source)}
          onExport={() => handleExport(contextMenu.source)} onDelete={() => handleDelete(contextMenu.source)} />
      )}

      {/* 更多菜单 */}
      {moreMenuOpen && (
        <div className="fixed z-50 bg-canvas-soft border border-hairline rounded-xl shadow-xl py-1 min-w-[160px]"
          style={{ bottom: 60, right: 20 }} onClick={e => e.stopPropagation()}>
          <button onClick={() => { handleExportAll(); setMoreMenuOpen(false) }}
            className="w-full px-3 py-2 text-left text-xs text-ink hover:bg-canvas-soft flex items-center gap-2">
            <Download className="w-3.5 h-3.5 text-muted" /> 导出全部数据
          </button>
          <div className="h-px bg-hairline mx-2 my-1" />
          <button onClick={async () => {
            if (!confirm('确定清空全部历史数据？此操作不可恢复。')) return
            if (api?.cleanOldData) await api.cleanOldData()
            setMoreMenuOpen(false)
            setSelectedSource('all')
            await loadSources()
          }} className="w-full px-3 py-2 text-left text-xs text-semantic-error hover:bg-semantic-error/10 flex items-center gap-2">
            <Trash className="w-3.5 h-3.5 text-semantic-error" /> 清空全部历史
          </button>
        </div>
      )}
      {moreMenuOpen && <div className="fixed inset-0 z-40" onClick={() => setMoreMenuOpen(false)} />}

      {/* 视频详情面板 */}
      {selectedVideo && (
        <VideoDetailPanel video={selectedVideo} onClose={() => setSelectedVideo(null)} onUpdateCategory={handleUpdateCategory} />
      )}
    </div>
  )
}
