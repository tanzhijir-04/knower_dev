import { useState, useEffect, useCallback } from 'react'
import { Plus, TrendUp, TrendDown, Star, X, Trash, PencilSimple } from '@phosphor-icons/react'
import type { ContentReview, ReviewStats } from '../types/electron'

const PLATFORM_COLORS: Record<string, string> = {
  bili: 'bg-[#00a1d6]', dy: 'bg-[#010101]', xhs: 'bg-[#fe2c55]',
  wb: 'bg-[#ff8200]', youtube: 'bg-[#ff0000]',
}
const PLATFORM_LABELS: Record<string, string> = {
  bili: 'B站', dy: '抖音', xhs: '小红书', wb: '微博', youtube: 'YouTube',
}

function DeviationBadge({ actual, predicted }: { actual: number; predicted: number }) {
  if (!predicted) return null
  const pct = ((actual - predicted) / predicted * 100).toFixed(0)
  const isPositive = actual >= predicted
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-medium ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
      {isPositive ? <TrendUp className="w-3 h-3" /> : <TrendDown className="w-3 h-3" />}
      {isPositive ? '↑' : '↓'}{Math.abs(Number(pct))}%
    </span>
  )
}

function StarRating({ rating, onChange }: { rating: number; onChange?: (r: number) => void }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <button key={n} onClick={() => onChange?.(n)} disabled={!onChange}
          className={`transition-colors ${onChange ? 'hover:scale-110' : ''}`}>
          <Star className={`w-3.5 h-3.5 ${n <= rating ? 'text-amber-400 fill-amber-400' : 'text-muted/30'}`} />
        </button>
      ))}
    </div>
  )
}

function formatNumber(n: number): string {
  if (n >= 10000) return (n / 10000).toFixed(1) + '万'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
  return String(n)
}

export default function ReviewView() {
  const [reviews, setReviews] = useState<ContentReview[]>([])
  const [stats, setStats] = useState<ReviewStats | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editingReview, setEditingReview] = useState<ContentReview | null>(null)
  const [analyzingId, setAnalyzingId] = useState<number | null>(null)
  const [form, setForm] = useState({
    platform: 'bili', title: '', publishDate: '', views: '', likes: '', comments: '',
    saves: '', shares: '', newFollowers: '', predictedViews: '', predictedLikes: '',
    rating: 0, userNotes: '',
  })

  const load = useCallback(async () => {
    try {
      const [r, s] = await Promise.all([
        window.electronAPI?.reviewList(),
        window.electronAPI?.reviewStats(),
      ])
      if (r) setReviews(r)
      if (s) setStats(s)
    } catch { /* ignore */ }
  }, [])

  useEffect(() => { load() }, [load])

  const openCreateModal = () => {
    setEditingReview(null)
    setForm({ platform: 'bili', title: '', publishDate: '', views: '', likes: '', comments: '', saves: '', shares: '', newFollowers: '', predictedViews: '', predictedLikes: '', rating: 0, userNotes: '' })
    setShowModal(true)
  }

  const openEditModal = (review: ContentReview) => {
    setEditingReview(review)
    setForm({
      platform: review.platform, title: review.title, publishDate: review.publishDate,
      views: String(review.views || ''), likes: String(review.likes || ''), comments: String(review.comments || ''),
      saves: String(review.saves || ''), shares: String(review.shares || ''), newFollowers: String(review.newFollowers || ''),
      predictedViews: String(review.predictedViews || ''), predictedLikes: String(review.predictedLikes || ''),
      rating: review.rating, userNotes: review.userNotes || '',
    })
    setShowModal(true)
  }

  const handleSave = async () => {
    if (!form.title.trim()) return
    const data = {
      platform: form.platform, title: form.title, publishDate: form.publishDate,
      views: Number(form.views) || 0, likes: Number(form.likes) || 0, comments: Number(form.comments) || 0,
      saves: Number(form.saves) || 0, shares: Number(form.shares) || 0, newFollowers: Number(form.newFollowers) || 0,
      predictedViews: Number(form.predictedViews) || 0, predictedLikes: Number(form.predictedLikes) || 0,
      rating: form.rating, userNotes: form.userNotes,
    }
    if (editingReview) {
      await window.electronAPI?.reviewUpdate(editingReview.id, data)
    } else {
      await window.electronAPI?.reviewCreate(data)
    }
    setShowModal(false)
    load()
  }

  const handleDelete = async (id: number) => {
    await window.electronAPI?.reviewDelete(id)
    load()
  }

  const handleAiAnalyze = async (id: number) => {
    setAnalyzingId(id)
    try {
      await window.electronAPI?.reviewAiAnalyze(id)
      load()
    } catch { /* ignore */ }
    setAnalyzingId(null)
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-6 py-4 flex items-center justify-between shrink-0 border-b border-hairline/30">
        <h1 className="text-base font-semibold text-ink">内容复盘</h1>
        <button onClick={openCreateModal} className="btn-primary flex items-center gap-1.5 text-xs">
          <Plus className="w-3.5 h-3.5" />
          录入数据
        </button>
      </div>

      <div className="flex-1 overflow-auto p-6 space-y-5">
        {/* 数据概览 */}
        {stats?.total && (
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: '总发布', value: String(stats.total.count) + '条' },
              { label: '平均播放', value: formatNumber(Math.round(stats.total.avgViews || 0)) },
              { label: '平均点赞', value: formatNumber(Math.round(stats.total.avgLikes || 0)) },
              { label: '平均评论', value: formatNumber(Math.round(stats.total.avgComments || 0)) },
            ].map(item => (
              <div key={item.label} className="overview-card px-4 py-3">
                <p className="text-[10px] text-muted uppercase tracking-wide">{item.label}</p>
                <p className="text-lg font-semibold text-ink mt-0.5">{item.value}</p>
              </div>
            ))}
          </div>
        )}

        {/* 复盘列表 */}
        {reviews.length === 0 ? (
          <div className="text-center py-12">
            <TrendUp className="w-10 h-10 text-muted/20 mx-auto mb-3" />
            <p className="text-sm text-muted">暂无复盘数据</p>
            <p className="text-[11px] text-muted/60 mt-1">点击"录入数据"开始记录</p>
          </div>
        ) : (
          <div className="space-y-3">
            {reviews.map(review => {
              const engagement = review.views > 0
                ? ((review.likes + review.comments + review.saves) / review.views * 100).toFixed(1)
                : '0'
              return (
                <div key={review.id} className="p-4 rounded-xl bg-surface border border-hairline/30 group hover:border-hairline/50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className={`w-2.5 h-2.5 rounded-full ${PLATFORM_COLORS[review.platform] || 'bg-muted'}`} />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-muted">{review.publishDate}</span>
                          <span className="text-[10px] text-muted bg-canvas-soft px-1.5 py-0.5 rounded">
                            {PLATFORM_LABELS[review.platform] || review.platform}
                          </span>
                        </div>
                        <p className="text-sm text-ink font-medium mt-0.5">{review.title}</p>
                      </div>
                    </div>
                    <StarRating rating={review.rating} />
                  </div>

                  {/* 数据行 */}
                  <div className="flex items-center gap-4 mt-3 text-[11px]">
                    <span className="text-muted">播放 <span className="text-ink font-medium">{formatNumber(review.views)}</span></span>
                    {review.predictedViews > 0 && (
                      <span className="text-muted">预测 <span className="text-ink">{formatNumber(review.predictedViews)}</span></span>
                    )}
                    {review.predictedViews > 0 && (
                      <DeviationBadge actual={review.views} predicted={review.predictedViews} />
                    )}
                    <span className="text-muted">互动率 <span className="text-ink font-medium">{engagement}%</span></span>
                    <span className="text-muted">赞 <span className="text-ink">{formatNumber(review.likes)}</span></span>
                    <span className="text-muted">评 <span className="text-ink">{formatNumber(review.comments)}</span></span>
                    <span className="text-muted">藏 <span className="text-ink">{formatNumber(review.saves)}</span></span>
                  </div>

                  {/* AI 分析 */}
                  {review.aiAnalysis && (
                    <div className="mt-3 p-3 rounded-lg bg-canvas-soft/50 border border-hairline/20">
                      <p className="text-[11px] text-muted leading-relaxed">{review.aiAnalysis}</p>
                    </div>
                  )}

                  {/* 操作 */}
                  <div className="flex gap-2 mt-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => handleAiAnalyze(review.id)} disabled={analyzingId === review.id}
                      className="text-[10px] text-primary hover:underline disabled:opacity-50">
                      {analyzingId === review.id ? '分析中...' : 'AI 分析'}
                    </button>
                    <button onClick={() => openEditModal(review)} className="text-[10px] text-muted hover:text-ink">
                      <PencilSimple className="w-3 h-3 inline mr-0.5" />编辑
                    </button>
                    <button onClick={() => handleDelete(review.id)} className="text-[10px] text-semantic-error hover:underline">
                      <Trash className="w-3 h-3 inline mr-0.5" />删除
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* 录入/编辑弹窗 */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowModal(false)}>
          <div className="bg-surface border border-hairline/50 rounded-xl w-[480px] max-h-[85vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-5 py-4 border-b border-hairline/30">
              <h3 className="text-sm font-semibold text-ink">{editingReview ? '编辑复盘' : '录入数据'}</h3>
              <button onClick={() => setShowModal(false)} className="p-1 rounded hover:bg-canvas-soft text-muted">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {/* 平台 + 日期 */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-[11px] text-muted mb-1.5 block">平台</label>
                  <div className="flex gap-1.5">
                    {Object.entries(PLATFORM_LABELS).map(([key, label]) => (
                      <button key={key} onClick={() => setForm(f => ({ ...f, platform: key }))}
                        className={`px-2 py-1 rounded-lg text-[10px] transition-colors ${
                          form.platform === key ? 'bg-primary/15 text-primary' : 'bg-canvas-soft text-muted hover:text-ink'
                        }`}>
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex-1">
                  <label className="text-[11px] text-muted mb-1.5 block">发布日期</label>
                  <input type="date" value={form.publishDate} onChange={e => setForm(f => ({ ...f, publishDate: e.target.value }))}
                    className="input w-full" />
                </div>
              </div>
              {/* 标题 */}
              <div>
                <label className="text-[11px] text-muted mb-1.5 block">标题</label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  className="input w-full" placeholder="视频标题" />
              </div>
              {/* 实际数据 */}
              <div>
                <label className="text-[11px] text-muted mb-1.5 block">实际数据</label>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { key: 'views', label: '播放' }, { key: 'likes', label: '点赞' }, { key: 'comments', label: '评论' },
                    { key: 'saves', label: '收藏' }, { key: 'shares', label: '分享' }, { key: 'newFollowers', label: '新增粉丝' },
                  ] as const).map(f => (
                    <div key={f.key}>
                      <label className="text-[10px] text-muted mb-1 block">{f.label}</label>
                      <input type="number" value={form[f.key]} onChange={e => setForm(ft => ({ ...ft, [f.key]: e.target.value }))}
                        className="input w-full text-[11px]" placeholder="0" />
                    </div>
                  ))}
                </div>
              </div>
              {/* 预测数据 */}
              <div>
                <label className="text-[11px] text-muted mb-1.5 block">预测数据（可选）</label>
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="text-[10px] text-muted mb-1 block">预测播放</label>
                    <input type="number" value={form.predictedViews} onChange={e => setForm(f => ({ ...f, predictedViews: e.target.value }))}
                      className="input w-full text-[11px]" placeholder="0" />
                  </div>
                  <div className="flex-1">
                    <label className="text-[10px] text-muted mb-1 block">预测点赞</label>
                    <input type="number" value={form.predictedLikes} onChange={e => setForm(f => ({ ...f, predictedLikes: e.target.value }))}
                      className="input w-full text-[11px]" placeholder="0" />
                  </div>
                </div>
              </div>
              {/* 评分 */}
              <div>
                <label className="text-[11px] text-muted mb-1.5 block">自评</label>
                <StarRating rating={form.rating} onChange={r => setForm(f => ({ ...f, rating: r }))} />
              </div>
              {/* 备注 */}
              <div>
                <label className="text-[11px] text-muted mb-1.5 block">备注</label>
                <textarea value={form.userNotes} onChange={e => setForm(f => ({ ...f, userNotes: e.target.value }))}
                  className="textarea w-full" rows={2} placeholder="可选" />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-5 py-3 border-t border-hairline/30">
              <button onClick={() => setShowModal(false)} className="btn-ghost text-xs">取消</button>
              <button onClick={handleSave} className="btn-primary text-xs" disabled={!form.title.trim()}>
                {editingReview ? '保存' : '录入'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
