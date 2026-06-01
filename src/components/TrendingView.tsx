import { useState, useEffect, useCallback } from 'react'
import { ArrowClockwise, GearSix, X, List, Spinner } from '@phosphor-icons/react'
import { usePlatform } from '../contexts/PlatformContext'
import type { TrendingItem, TrendingSource, TrendingConfig } from '../types/electron'

// ============================================================
//  卡片组件
// ============================================================

function TrendingCard({
  sourceId,
  source,
  items,
  isLoading,
}: {
  sourceId: string
  source: TrendingSource
  items: TrendingItem[]
  isLoading: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const displayItems = expanded ? items : items.slice(0, 10)

  const handleClick = (url: string) => {
    window.electronAPI?.openUrl(url)
  }

  return (
    <div className="bg-surface-low border border-hairline/20 rounded-xl overflow-hidden">
      {/* 卡片头部 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-hairline/20">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-ink">{source.name}</span>
          <span className="text-[11px] text-muted-soft">{source.desc}</span>
        </div>
        <List className="w-3.5 h-3.5 text-muted-soft" />
      </div>

      {/* 内容区 */}
      {isLoading ? (
        <div className="px-4 py-6 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 animate-pulse">
              <div className="w-5 h-3 bg-hairline rounded" />
              <div className="flex-1 h-3 bg-hairline rounded" style={{ width: `${60 + Math.random() * 30}%` }} />
            </div>
          ))}
        </div>
      ) : displayItems.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <p className="text-xs text-muted">暂无数据</p>
        </div>
      ) : (
        <div className="divide-y divide-hairline/20">
          {displayItems.map((item, idx) => (
            <button
              key={`${sourceId}-${item.id}-${idx}`}
              onClick={() => handleClick(item.url)}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-canvas-soft transition-colors group"
            >
              <span className={`text-xs font-mono w-5 text-right shrink-0 ${
                idx < 3 ? 'text-primary font-medium' : 'text-muted'
              }`}>
                {idx + 1}
              </span>
              <span className="text-sm text-ink truncate flex-1 group-hover:text-primary transition-colors">
                {item.title}
              </span>
              {item.extra?.flag === 'new' && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/15 text-green-400 shrink-0">新</span>
              )}
              {item.extra?.flag === 'hot' && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-400 shrink-0">热</span>
              )}
              {item.extra?.flag === 'boom' && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/15 text-orange-400 shrink-0">爆</span>
              )}
              {item.extra?.info && !item.extra?.flag && (
                <span className="text-[11px] text-muted-soft shrink-0 truncate max-w-[100px]">
                  {item.extra.info}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* 展开/收起 */}
      {items.length > 10 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full px-4 py-2 text-[11px] text-muted hover:text-ink hover:bg-canvas-soft transition-colors border-t border-hairline/20"
        >
          {expanded ? '收起' : `查看更多 (${items.length - 10} 条)`}
        </button>
      )}
    </div>
  )
}

// ============================================================
//  数据源管理弹窗（含 HTML5 拖拽排序）
// ============================================================

function SourceManagerModal({
  allSources,
  config,
  onClose,
  onSave,
}: {
  allSources: Record<string, TrendingSource>
  config: TrendingConfig
  onClose: () => void
  onSave: (config: { sources: string[]; order: string[] }) => void
}) {
  const [selected, setSelected] = useState<string[]>([...config.sources])
  const [order, setOrder] = useState<string[]>([...config.order])
  const [draggedId, setDraggedId] = useState<string | null>(null)

  // 合并 order + 未排入的
  const allIds = [...new Set([...order, ...Object.keys(allSources)])]
  const orderedIds = order.filter(id => allIds.includes(id))
  const unorderedIds = allIds.filter(id => !orderedIds.includes(id))
  const displayIds = [...orderedIds, ...unorderedIds]

  const toggle = (id: string) => {
    setSelected(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  const handleDragStart = (id: string) => setDraggedId(id)
  const handleDragEnd = () => setDraggedId(null)

  const handleDragOver = (e: React.DragEvent, targetId: string) => {
    e.preventDefault()
    if (!draggedId || draggedId === targetId) return
    const fromIndex = displayIds.indexOf(draggedId)
    const toIndex = displayIds.indexOf(targetId)
    if (fromIndex === -1 || toIndex === -1) return
    const newOrder = [...displayIds]
    newOrder.splice(fromIndex, 1)
    newOrder.splice(toIndex, 0, draggedId)
    setOrder(newOrder)
  }

  const handleSave = () => {
    onSave({ sources: selected, order })
    onClose()
  }

  const handleReset = () => {
    setSelected(['bilibili', 'douyin', 'weibo'])
    setOrder(Object.keys(allSources))
  }

  const columns: { key: string; label: string; ids: string[] }[] = [
    { key: 'china', label: '中国', ids: displayIds.filter(id => allSources[id]?.column === 'china') },
    { key: 'tech', label: '科技', ids: displayIds.filter(id => allSources[id]?.column === 'tech') },
    { key: 'world', label: '国际', ids: displayIds.filter(id => allSources[id]?.column === 'world') },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-surface border border-hairline rounded-xl w-[440px] max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-hairline">
          <h3 className="text-sm font-medium text-ink">热点数据源管理</h3>
          <button onClick={onClose} className="p-1 text-muted hover:text-ink transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-4">
          <p className="text-[11px] text-muted">拖拽排序，勾选启用/禁用</p>

          {columns.map(col => (
            <div key={col.key}>
              <h4 className="text-[11px] font-semibold text-muted uppercase tracking-wider mb-2">{col.label}</h4>
              <div className="space-y-1">
                {col.ids.map(id => {
                  const src = allSources[id]
                  if (!src) return null
                  return (
                    <div
                      key={id}
                      draggable
                      onDragStart={() => handleDragStart(id)}
                      onDragEnd={handleDragEnd}
                      onDragOver={(e) => handleDragOver(e, id)}
                      className={`flex items-center gap-2.5 px-3 py-2 rounded-lg transition-colors ${
                        draggedId === id ? 'opacity-50' : ''
                      } hover:bg-canvas-soft cursor-grab active:cursor-grabbing`}
                    >
                      <label className="flex items-center gap-2 cursor-pointer flex-1 min-w-0" onClick={e => e.preventDefault()}>
                        <input
                          type="checkbox"
                          checked={selected.includes(id)}
                          onChange={() => toggle(id)}
                          className="sr-only"
                        />
                        <span className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                          selected.includes(id) ? 'bg-primary border-primary' : 'border-hairline-strong'
                        }`}>
                          {selected.includes(id) && (
                            <svg className="w-2.5 h-2.5 text-on-primary" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M2 6l3 3 5-5" />
                            </svg>
                          )}
                        </span>
                        <span className="text-xs text-ink truncate">{src.name}</span>
                        <span className="text-[11px] text-muted-soft truncate">{src.desc}</span>
                      </label>
                      <List className="w-3.5 h-3.5 text-muted-soft shrink-0" />
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between px-5 py-3 border-t border-hairline">
          <button onClick={handleReset} className="text-xs text-muted hover:text-ink transition-colors">
            恢复默认
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-secondary text-xs">
              取消
            </button>
            <button onClick={handleSave} className="btn-primary text-xs">
              保存
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ============================================================
//  主页面
// ============================================================

export default function TrendingView() {
  const { isWindows } = usePlatform()
  const [allSources, setAllSources] = useState<Record<string, TrendingSource>>({})
  const [config, setConfig] = useState<TrendingConfig>({ sources: [], order: [], lastRefresh: 0 })
  const [trendingData, setTrendingData] = useState<Record<string, TrendingItem[]>>({})
  const [loading, setLoading] = useState<Record<string, boolean>>({})
  const [showManager, setShowManager] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)

  const loadConfig = useCallback(async () => {
    const api = window.electronAPI
    if (!api) return null
    try {
      const result = await api.getTrendingSources()
      setAllSources(result.sources)
      setConfig(result.config)
      return result.config
    } catch (e) { console.error('[TrendingView] loadConfig error:', e); return null }
  }, [])

  const loadData = useCallback(async (sources?: string[]) => {
    const api = window.electronAPI
    if (!api) return
    const platformIds = sources
    if (!platformIds?.length) return
    const order = platformIds

    const loadingState: Record<string, boolean> = {}
    for (const id of platformIds) loadingState[id] = true
    setLoading(loadingState)

    try {
      const data = await api.fetchTrending(platformIds)
      setTrendingData(data)
      setConfig(prev => ({ ...prev, lastRefresh: Date.now(), sources: platformIds, order }))
      await api.setTrendingConfig({ sources: platformIds, order })
    } catch (e) { console.error('[TrendingView] loadData error:', e) }

    const doneState: Record<string, boolean> = {}
    for (const id of platformIds) doneState[id] = false
    setLoading(doneState)
  }, [])

  useEffect(() => {
    (async () => {
      const cfg = await loadConfig()
      if (cfg?.sources?.length) {
        await loadData(cfg.sources)
      }
      setInitialLoading(false)
    })()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const handleRefresh = () => loadData(config.sources)

  const handleSaveConfig = async (newConfig: { sources: string[]; order: string[] }) => {
    setConfig(prev => ({ ...prev, ...newConfig }))
    await window.electronAPI?.setTrendingConfig(newConfig)
    loadData(newConfig.sources)
  }

  const orderedSources = config.order.filter(id => config.sources.includes(id))

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <header className={`titlebar-drag h-12 flex items-center justify-between px-5 shrink-0 ${isWindows ? '' : 'border-b border-hairline'}`}>
        <h1 className="text-sm font-medium text-ink no-drag">全网热点</h1>
        <div className="flex items-center gap-1 no-drag">
          <button
            onClick={handleRefresh}
            disabled={Object.values(loading).some(Boolean)}
            className="p-2 rounded-lg text-muted hover:text-ink hover:bg-canvas-soft transition-colors disabled:opacity-50"
            title="刷新"
          >
            <ArrowClockwise className={`w-4 h-4 ${Object.values(loading).some(Boolean) ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowManager(true)}
            className="p-2 rounded-lg text-muted hover:text-ink hover:bg-canvas-soft transition-colors"
            title="数据源管理"
          >
            <GearSix className="w-4 h-4" />
          </button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-5">
        {initialLoading ? (
          <div className="flex items-center justify-center py-20">
            <Spinner className="w-6 h-6 text-muted animate-spin" />
          </div>
        ) : orderedSources.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <p className="text-sm text-muted">未启用任何热点数据源</p>
            <button onClick={() => setShowManager(true)} className="btn-secondary text-xs">
              管理数据源
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {orderedSources.map(sourceId => {
              const source = allSources[sourceId]
              if (!source) return null
              return (
                <TrendingCard
                  key={sourceId}
                  sourceId={sourceId}
                  source={source}
                  items={trendingData[sourceId] || []}
                  isLoading={!!loading[sourceId]}
                />
              )
            })}
          </div>
        )}
      </div>

      {showManager && (
        <SourceManagerModal
          allSources={allSources}
          config={config}
          onClose={() => setShowManager(false)}
          onSave={handleSaveConfig}
        />
      )}
    </div>
  )
}
