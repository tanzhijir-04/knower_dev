import { useState, useEffect } from 'react'
import { Plus, X, ArrowClockwise, CheckCircle } from '@phosphor-icons/react'
import type { Competitor, CompetitorAlert } from '../../types/electron'

interface Props {
  platform: string
  competitors: Competitor[]
  onRefresh: () => void
}

function getTimeAgo(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = now - then
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return Math.floor(diff / 60000) + '分钟前'
  if (diff < 86400000) return Math.floor(diff / 3600000) + '小时前'
  return Math.floor(diff / 86400000) + '天前'
}

export default function CompetitorPanel({ platform, competitors, onRefresh }: Props) {
  const [showAdd, setShowAdd] = useState(false)
  const [userId, setUserId] = useState('')
  const [nickname, setNickname] = useState('')
  const [adding, setAdding] = useState(false)
  const [alerts, setAlerts] = useState<CompetitorAlert[]>([])
  const [checking, setChecking] = useState(false)

  const api = window.electronAPI

  // 加载通知
  useEffect(() => {
    api?.competitorAlerts().then(setAlerts)
  }, [api])

  const handleCheckNow = async () => {
    if (!api) return
    setChecking(true)
    try {
      await api.competitorCheckNow()
      const updated = await api.competitorAlerts()
      setAlerts(updated)
    } catch { /* ignore */ }
    setChecking(false)
  }

  const handleMarkRead = async (id: number) => {
    if (!api) return
    await api.competitorAlertRead(id)
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, isRead: true } : a))
  }

  const handleMarkAllRead = async () => {
    if (!api) return
    await api.competitorAlertReadAll()
    setAlerts(prev => prev.map(a => ({ ...a, isRead: true })))
  }

  const unreadCount = alerts.filter(a => !a.isRead).length

  const handleAdd = async () => {
    if (!api || !userId.trim() || !nickname.trim()) return
    setAdding(true)
    try {
      await api.addCompetitor(platform, userId.trim(), nickname.trim())
      setUserId('')
      setNickname('')
      setShowAdd(false)
      onRefresh()
    } catch { /* ignore */ }
    setAdding(false)
  }

  const handleRemove = async (id: number) => {
    if (!api) return
    await api.removeCompetitor(id)
    onRefresh()
  }

  return (
    <div className="border-t border-hairline/30">
      <div className="px-4 py-3">
        <h3 className="text-sm font-medium text-ink">竞品追踪</h3>
        <p className="text-[11px] text-muted mt-0.5">已追踪 {competitors.length} 个创作者</p>
      </div>

      {/* 已追踪列表 */}
      <div className="divide-y divide-hairline/20">
        {competitors.map(comp => (
          <div key={comp.id} className="px-3 py-2.5 hover:bg-canvas-soft transition-colors group">
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                <span className="text-[10px] text-primary">{comp.nickname[0]}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-ink truncate">{comp.nickname}</p>
                <p className="text-[10px] text-muted">
                  {comp.lastCheckedAt ? '已更新' : '待更新'}
                </p>
              </div>
              <button
                onClick={() => handleRemove(comp.id)}
                className="opacity-0 group-hover:opacity-100 p-1 hover:bg-hairline rounded transition-all"
              >
                <X className="w-3 h-3 text-muted" />
              </button>
            </div>
          </div>
        ))}

        {/* 添加竞品 */}
        {showAdd ? (
          <div className="px-3 py-2.5 space-y-2">
            <input
              value={userId}
              onChange={e => setUserId(e.target.value)}
              placeholder="创作者 UID"
              className="w-full px-2 py-1.5 text-xs bg-canvas border border-hairline/30 rounded-lg text-ink placeholder:text-muted focus:outline-none focus:border-primary/50"
            />
            <input
              value={nickname}
              onChange={e => setNickname(e.target.value)}
              placeholder="昵称"
              className="w-full px-2 py-1.5 text-xs bg-canvas border border-hairline/30 rounded-lg text-ink placeholder:text-muted focus:outline-none focus:border-primary/50"
            />
            <div className="flex gap-2">
              <button
                onClick={handleAdd}
                disabled={adding || !userId.trim() || !nickname.trim()}
                className="flex-1 px-2 py-1.5 text-xs bg-primary/15 text-primary rounded-lg hover:bg-primary/25 transition-colors disabled:opacity-50"
              >
                {adding ? '添加中...' : '确认'}
              </button>
              <button
                onClick={() => { setShowAdd(false); setUserId(''); setNickname('') }}
                className="px-2 py-1.5 text-xs text-muted hover:text-ink rounded-lg hover:bg-canvas-soft transition-colors"
              >
                取消
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setShowAdd(true)}
            className="w-full px-3 py-2 text-xs text-primary hover:bg-canvas-soft transition-colors flex items-center gap-1"
          >
            <Plus className="w-3 h-3" />
            添加竞品
          </button>
        )}
      </div>

      {/* 通知区域 */}
      <div className="border-t border-hairline/30">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium text-ink">最新通知</h3>
            {unreadCount > 0 && (
              <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded-full">{unreadCount} 条未读</span>
            )}
          </div>
          <div className="flex gap-1.5">
            {unreadCount > 0 && (
              <button onClick={handleMarkAllRead}
                className="text-[10px] text-muted hover:text-ink transition-colors flex items-center gap-1">
                <CheckCircle className="w-3 h-3" />
                全部已读
              </button>
            )}
            <button onClick={handleCheckNow} disabled={checking}
              className="text-[10px] text-primary hover:underline disabled:opacity-50 flex items-center gap-1">
              <ArrowClockwise className={`w-3 h-3 ${checking ? 'animate-spin' : ''}`} />
              {checking ? '检查中...' : '立即检查'}
            </button>
          </div>
        </div>

        <div className="divide-y divide-hairline/20 max-h-[200px] overflow-auto">
          {alerts.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <p className="text-[11px] text-muted">暂无通知</p>
            </div>
          ) : (
            alerts.slice(0, 10).map(alert => (
              <div key={alert.id} className={`px-4 py-3 transition-colors ${alert.isRead ? 'opacity-50' : 'bg-canvas-soft/30'}`}>
                <div className="flex items-center gap-2 mb-1">
                  {!alert.isRead && <span className="w-1.5 h-1.5 bg-red-500 rounded-full shrink-0" />}
                  <span className="text-xs text-ink font-medium">{alert.title}</span>
                </div>
                {alert.detail && <p className="text-[11px] text-muted ml-3.5">{alert.detail}</p>}
                <div className="flex items-center justify-between mt-1.5 ml-3.5">
                  <span className="text-[10px] text-muted">{getTimeAgo(alert.createdAt)}</span>
                  {!alert.isRead && (
                    <button onClick={() => handleMarkRead(alert.id)}
                      className="text-[10px] text-primary hover:underline">
                      标记已读
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
