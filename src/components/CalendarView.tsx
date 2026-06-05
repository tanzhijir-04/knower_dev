import { useState, useEffect, useCallback, useMemo } from 'react'
import { CalendarBlank, Plus, CaretLeft, CaretRight, X, Clock } from '@phosphor-icons/react'
import type { ScheduleItem } from '../types/electron'
import type { Page } from '../App'
import { useAccount } from '../contexts/AccountContext'

const PLATFORM_COLORS: Record<string, string> = {
  bili: 'bg-[#00a1d6]', dy: 'bg-[#010101]', xhs: 'bg-[#fe2c55]',
  wb: 'bg-[#ff8200]', youtube: 'bg-[#ff0000]',
}
const PLATFORM_LABELS: Record<string, string> = {
  bili: 'B站', dy: '抖音', xhs: '小红书', wb: '微博', youtube: 'YouTube',
}
const STATUS_LABELS: Record<string, string> = {
  planned: '待安排', scheduled: '已安排', published: '已发布', skipped: '已跳过',
}
const STATUS_STYLES: Record<string, string> = {
  planned: 'bg-canvas-soft text-muted', scheduled: 'bg-primary/10 text-primary',
  published: 'bg-semantic-success/10 text-semantic-success', skipped: 'bg-hairline text-muted',
}
const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

interface Props { onNavigate?: (page: Page) => void }

export default function CalendarView({ onNavigate: _onNavigate }: Props) {
  const { activeAccount } = useAccount()
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [items, setItems] = useState<ScheduleItem[]>([])
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editingItem, setEditingItem] = useState<ScheduleItem | null>(null)
  const [form, setForm] = useState({ platform: 'bili', title: '', plannedDate: '', plannedTime: '', notes: '' })
  const [recommendedTimes, setRecommendedTimes] = useState<{ hour: string; avgEngagement: number }[]>([])

  const year = currentMonth.getFullYear()
  const month = currentMonth.getMonth()

  const loadSchedule = useCallback(async () => {
    const start = `${year}-${String(month + 1).padStart(2, '0')}-01`
    const end = `${year}-${String(month + 1).padStart(2, '0')}-${new Date(year, month + 1, 0).getDate()}`
    try {
      const data = await window.electronAPI?.scheduleList(start, end)
      if (data) setItems(data)
    } catch { /* ignore */ }
  }, [year, month, activeAccount?.id])

  useEffect(() => { loadSchedule() }, [loadSchedule, activeAccount?.id])

  // 加载推荐发布时间（弹窗打开时 + 平台切换时刷新）
  useEffect(() => {
    if (showModal && form.platform) {
      window.electronAPI?.scheduleRecommendedTimes(form.platform)
        .then(setRecommendedTimes)
        .catch(() => setRecommendedTimes([]))
    }
  }, [showModal, form.platform])

  // 日历网格数据
  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1).getDay()
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const days: { date: string; day: number; isCurrentMonth: boolean; isToday: boolean }[] = []
    // 上月填充
    const prevMonthDays = new Date(year, month, 0).getDate()
    for (let i = firstDay - 1; i >= 0; i--) {
      const d = prevMonthDays - i
      const m = month === 0 ? 12 : month
      const y = month === 0 ? year - 1 : year
      days.push({ date: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`, day: d, isCurrentMonth: false, isToday: false })
    }
    // 本月
    const today = new Date()
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      const isToday = today.getFullYear() === year && today.getMonth() === month && today.getDate() === d
      days.push({ date: dateStr, day: d, isCurrentMonth: true, isToday })
    }
    // 下月填充
    const remaining = 42 - days.length
    for (let d = 1; d <= remaining; d++) {
      const m = month === 11 ? 1 : month + 2
      const y = month === 11 ? year + 1 : year
      days.push({ date: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`, day: d, isCurrentMonth: false, isToday: false })
    }
    return days
  }, [year, month])

  // 按日期分组排期
  const itemsByDate = useMemo(() => {
    const map: Record<string, ScheduleItem[]> = {}
    for (const item of items) {
      if (item.plannedDate) {
        if (!map[item.plannedDate]) map[item.plannedDate] = []
        map[item.plannedDate].push(item)
      }
    }
    return map
  }, [items])

  const selectedItems = selectedDate ? (itemsByDate[selectedDate] || []) : []

  const prevMonth = () => setCurrentMonth(new Date(year, month - 1, 1))
  const nextMonth = () => setCurrentMonth(new Date(year, month + 1, 1))

  const openCreateModal = (date?: string) => {
    setEditingItem(null)
    setForm({ platform: 'bili', title: '', plannedDate: date || `${year}-${String(month + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`, plannedTime: '', notes: '' })
    setShowModal(true)
  }

  const openEditModal = (item: ScheduleItem) => {
    setEditingItem(item)
    setForm({ platform: item.platform, title: item.title, plannedDate: item.plannedDate || '', plannedTime: item.plannedTime || '', notes: item.notes || '' })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.title.trim()) return
    if (editingItem) {
      await window.electronAPI?.scheduleUpdate(editingItem.id, form)
    } else {
      await window.electronAPI?.scheduleCreate(form)
    }
    setShowModal(false)
    loadSchedule()
  }

  const handleDelete = async (id: number) => {
    await window.electronAPI?.scheduleDelete(id)
    loadSchedule()
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 flex items-center justify-between shrink-0 border-b border-hairline/30">
        <div className="flex items-center gap-3">
          <CalendarBlank className="w-5 h-5 text-primary" />
          <h1 className="text-base font-semibold text-ink">内容日历</h1>
        </div>
        <button onClick={() => openCreateModal()} className="btn-primary flex items-center gap-1.5 text-xs">
          <Plus className="w-3.5 h-3.5" />
          新建排期
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* 左侧日历 */}
        <div className="flex-1 flex flex-col p-4 overflow-auto">
          {/* 月份导航 */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-ink">{year}年{month + 1}月</h2>
            <div className="flex items-center gap-1">
              <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-canvas-soft text-muted hover:text-ink transition-colors">
                <CaretLeft className="w-4 h-4" />
              </button>
              <button onClick={() => setCurrentMonth(new Date())} className="px-2 py-1 text-[11px] text-muted hover:text-ink hover:bg-canvas-soft rounded transition-colors">
                今天
              </button>
              <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-canvas-soft text-muted hover:text-ink transition-colors">
                <CaretRight className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 星期头 */}
          <div className="grid grid-cols-7 mb-1">
            {WEEKDAYS.map(w => (
              <div key={w} className="text-center text-[11px] text-muted py-1">{w}</div>
            ))}
          </div>

          {/* 日历网格 */}
          <div className="grid grid-cols-7 gap-px bg-hairline/20 rounded-lg overflow-hidden flex-1">
            {calendarDays.map((d, i) => {
              const dayItems = itemsByDate[d.date] || []
              const isSelected = selectedDate === d.date
              return (
                <button
                  key={i}
                  onClick={() => setSelectedDate(d.date)}
                  className={`flex flex-col items-start p-1.5 min-h-[72px] transition-colors ${
                    isSelected ? 'bg-primary/8 ring-1 ring-inset ring-primary/30' :
                    d.isToday ? 'bg-canvas-soft' :
                    d.isCurrentMonth ? 'bg-surface hover:bg-canvas-soft' : 'bg-canvas-soft/30'
                  }`}
                >
                  <span className={`text-[11px] w-5 h-5 flex items-center justify-center rounded-full ${
                    d.isToday ? 'bg-primary text-on-primary font-medium' :
                    d.isCurrentMonth ? 'text-ink' : 'text-muted/50'
                  }`}>
                    {d.day}
                  </span>
                  <div className="flex flex-col gap-0.5 mt-0.5 w-full overflow-hidden">
                    {dayItems.slice(0, 2).map(item => (
                      <div key={item.id} className="flex items-center gap-1 px-1 py-0.5 rounded bg-canvas-soft/80 min-w-0">
                        <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${PLATFORM_COLORS[item.platform] || 'bg-muted'}`} />
                        <span className="text-[10px] text-ink truncate">{item.title}</span>
                      </div>
                    ))}
                    {dayItems.length > 2 && (
                      <span className="text-[9px] text-muted px-1">+{dayItems.length - 2}</span>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* 右侧选中日排期 */}
        <div className="w-72 border-l border-hairline/30 flex flex-col overflow-hidden shrink-0">
          <div className="px-4 py-3 border-b border-hairline/20">
            <h3 className="text-sm font-medium text-ink">
              {selectedDate ? `${selectedDate} 排期` : '选择日期查看排期'}
            </h3>
            {selectedDate && (
              <p className="text-[11px] text-muted mt-0.5">{selectedItems.length} 条排期</p>
            )}
          </div>
          <div className="flex-1 overflow-auto p-3 space-y-2">
            {selectedItems.length === 0 && selectedDate && (
              <div className="text-center py-8">
                <CalendarBlank className="w-8 h-8 text-muted/30 mx-auto mb-2" />
                <p className="text-xs text-muted">暂无排期</p>
                <button onClick={() => openCreateModal(selectedDate)} className="text-xs text-primary hover:underline mt-2">
                  + 添加排期
                </button>
              </div>
            )}
            {selectedItems.map(item => (
              <div key={item.id} className="p-3 rounded-lg bg-surface border border-hairline/30 group">
                <div className="flex items-center gap-2 mb-1">
                  <span className={`w-2 h-2 rounded-full ${PLATFORM_COLORS[item.platform] || 'bg-muted'}`} />
                  <span className="text-[11px] text-muted">{PLATFORM_LABELS[item.platform] || item.platform}</span>
                  <div className="ml-auto relative">
                    <button
                      onClick={async () => {
                        const nextStatus: Record<string, string> = { planned: 'scheduled', scheduled: 'published', published: 'planned', skipped: 'planned' }
                        const next = nextStatus[item.status] || 'planned'
                        await window.electronAPI?.scheduleUpdate(item.id, { status: next })
                        setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: next as ScheduleItem['status'] } : i))
                      }}
                      className={`text-[10px] px-1.5 py-0.5 rounded-full hover:opacity-80 transition-opacity cursor-pointer ${STATUS_STYLES[item.status] || ''}`}
                      title="点击切换状态"
                    >
                      {STATUS_LABELS[item.status] || item.status}
                    </button>
                  </div>
                </div>
                <p className="text-xs text-ink font-medium mb-1">{item.title}</p>
                {item.plannedTime && (
                  <div className="flex items-center gap-1 text-[11px] text-muted">
                    <Clock className="w-3 h-3" />
                    {item.plannedTime}
                  </div>
                )}
                {item.notes && <p className="text-[11px] text-muted mt-1 truncate">{item.notes}</p>}
                <div className="flex gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEditModal(item)} className="text-[10px] text-primary hover:underline">编辑</button>
                  <button onClick={() => handleDelete(item.id)} className="text-[10px] text-semantic-error hover:underline">删除</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 新建/编辑弹窗 */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowModal(false)}>
          <div className="bg-surface border border-hairline/50 rounded-xl w-[420px] max-h-[80vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-hairline/30">
              <h3 className="text-sm font-semibold text-ink">{editingItem ? '编辑排期' : '新建排期'}</h3>
              <button onClick={() => setShowModal(false)} className="p-1 rounded hover:bg-canvas-soft text-muted">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {/* 平台 */}
              <div>
                <label className="text-[11px] text-muted mb-1.5 block">平台</label>
                <div className="flex gap-1.5">
                  {Object.entries(PLATFORM_LABELS).map(([key, label]) => (
                    <button key={key} onClick={() => setForm(f => ({ ...f, platform: key }))}
                      className={`px-2.5 py-1 rounded-lg text-[11px] transition-colors ${
                        form.platform === key ? 'bg-primary/15 text-primary' : 'bg-canvas-soft text-muted hover:text-ink'
                      }`}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              {/* 标题 */}
              <div>
                <label className="text-[11px] text-muted mb-1.5 block">标题</label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  className="input w-full" placeholder="视频标题" />
              </div>
              {/* 日期 + 时间 */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-[11px] text-muted mb-1.5 block">日期</label>
                  <input type="date" value={form.plannedDate} onChange={e => setForm(f => ({ ...f, plannedDate: e.target.value }))}
                    className="input w-full" />
                </div>
                <div className="flex-1">
                  <label className="text-[11px] text-muted mb-1.5 block">时间</label>
                  <input type="time" value={form.plannedTime} onChange={e => setForm(f => ({ ...f, plannedTime: e.target.value }))}
                    className="input w-full" />
                </div>
              </div>
              {/* AI 推荐时间 */}
              {recommendedTimes.filter(t => t.hour).length > 0 && (
                <div className="p-2.5 rounded-lg bg-primary/5 border border-primary/15">
                  <p className="text-[10px] text-primary font-medium mb-1.5">
                    <Clock className="w-3 h-3 inline mr-1" />
                    AI 推荐发布时间
                  </p>
                  <div className="flex gap-1.5">
                    {recommendedTimes.filter(t => t.hour).map(t => (
                      <button key={t.hour} onClick={() => setForm(f => ({ ...f, plannedTime: `${t.hour}:00` }))}
                        className="px-2 py-0.5 rounded bg-primary/10 text-[10px] text-primary hover:bg-primary/20 transition-colors">
                        {t.hour}:00
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {/* 备注 */}
              <div>
                <label className="text-[11px] text-muted mb-1.5 block">备注</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  className="textarea w-full" rows={2} placeholder="可选" />
              </div>
              {/* 状态（仅编辑时显示） */}
              {editingItem && (
                <div>
                  <label className="text-[11px] text-muted mb-1.5 block">状态</label>
                  <select
                    value={editingItem.status}
                    onChange={e => {
                      window.electronAPI?.scheduleUpdate(editingItem.id, { status: e.target.value })
                      setItems(prev => prev.map(i => i.id === editingItem.id ? { ...i, status: e.target.value as ScheduleItem['status'] } : i))
                      setEditingItem(null)
                      setShowModal(false)
                    }}
                    className="input w-full"
                  >
                    <option value="planned">待安排</option>
                    <option value="scheduled">已安排</option>
                    <option value="published">已发布</option>
                    <option value="skipped">已跳过</option>
                  </select>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 px-5 py-3 border-t border-hairline/30">
              <button onClick={() => setShowModal(false)} className="btn-ghost text-xs">取消</button>
              <button onClick={handleSave} className="btn-primary text-xs" disabled={!form.title.trim()}>
                {editingItem ? '保存' : '创建'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
