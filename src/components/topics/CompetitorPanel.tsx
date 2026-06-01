import { useState } from 'react'
import { Plus, X } from '@phosphor-icons/react'
import type { Competitor } from '../../types/electron'

interface Props {
  platform: string
  competitors: Competitor[]
  onRefresh: () => void
}

export default function CompetitorPanel({ platform, competitors, onRefresh }: Props) {
  const [showAdd, setShowAdd] = useState(false)
  const [userId, setUserId] = useState('')
  const [nickname, setNickname] = useState('')
  const [adding, setAdding] = useState(false)

  const api = window.electronAPI

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
    </div>
  )
}
