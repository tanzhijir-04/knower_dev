import type { CrawlContent } from '../../types/electron'
import { useState } from 'react'
import { useToast } from '../../contexts/ToastContext'

function formatNumber(n: number) {
  if (n >= 10000) return (n / 10000).toFixed(1) + '万'
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k'
  return String(n)
}

interface Props {
  video: CrawlContent
  onClose: () => void
  onUpdateCategory?: (contentId: string, category: string) => void
}

export default function VideoDetailPanel({ video, onClose, onUpdateCategory }: Props) {
  const { showToast } = useToast()
  const [editingCategory, setEditingCategory] = useState(false)
  const [category, setCategory] = useState(video.category || '未分类')

  const raw = video.rawJson || {}
  const coinCount = parseInt(raw.video_coin_count) || 0
  const favoriteCount = parseInt(raw.video_favorite_count) || 0
  const danmaku = parseInt(raw.video_danmaku) || 0
  const playCount = video.playCount || 0
  const engagementRate = playCount > 0
    ? ((video.likeCount + coinCount + favoriteCount + video.commentCount + danmaku) / playCount * 100).toFixed(2)
    : '0'

  const handleCopyTitle = () => {
    navigator.clipboard.writeText(video.title || '')
    showToast('标题已复制', 'success')
  }

  const handleSaveCategory = () => {
    onUpdateCategory?.(video.contentId, category)
    setEditingCategory(false)
    showToast('分类已更新', 'success')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="bg-surface-low border border-outline-variant rounded-2xl shadow-2xl w-[420px] max-w-[90vw] max-h-[80vh] flex flex-col animate-msg-enter"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant/30">
          <span className="text-sm font-medium text-on-surface flex items-center gap-2">
            <span className="material-symbols-outlined text-[16px] text-primary">videocam</span>
            视频详情
          </span>
          <button onClick={onClose} className="text-mute hover:text-on-surface">
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <div>
            <p className="text-[11px] text-mute mb-1">标题</p>
            <p className="text-sm text-on-surface leading-relaxed">{video.title || '-'}</p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[11px] text-mute mb-1">作者</p>
              <p className="text-sm text-on-surface">{video.authorName || '-'}</p>
            </div>
            <div>
              <p className="text-[11px] text-mute mb-1">发布时间</p>
              <p className="text-sm text-on-surface">{video.createdAt?.slice(0, 10) || '-'}</p>
            </div>
          </div>

          <div>
            <p className="text-[11px] text-mute mb-1">分类</p>
            {editingCategory ? (
              <div className="flex items-center gap-2">
                <input
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className="flex-1 bg-surface-container border border-outline-variant rounded px-2 py-1 text-xs text-on-surface outline-none"
                  autoFocus
                  onKeyDown={e => e.key === 'Enter' && handleSaveCategory()}
                />
                <button onClick={handleSaveCategory} className="px-2 py-1 bg-primary/20 text-primary text-[11px] rounded">保存</button>
                <button onClick={() => setEditingCategory(false)} className="px-2 py-1 text-mute text-[11px]">取消</button>
              </div>
            ) : (
              <button onClick={() => setEditingCategory(true)} className="text-sm text-on-surface hover:text-primary transition-colors">
                {category} <span className="material-symbols-outlined text-[12px] align-[-2px]">edit</span>
              </button>
            )}
          </div>

          <div>
            <p className="text-[11px] text-mute mb-2">数据指标</p>
            <div className="grid grid-cols-4 gap-2">
              {[
                { label: '播放量', value: formatNumber(playCount) },
                { label: '点赞数', value: formatNumber(video.likeCount) },
                { label: '评论数', value: formatNumber(video.commentCount) },
                { label: '分享数', value: formatNumber(video.shareCount) },
                { label: '收藏数', value: formatNumber(favoriteCount) },
                { label: '投币数', value: formatNumber(coinCount) },
                { label: '弹幕数', value: formatNumber(danmaku) },
                { label: '互动率', value: engagementRate + '%' },
              ].map(item => (
                <div key={item.label} className="bg-surface-container rounded-lg px-2.5 py-2 text-center">
                  <p className="text-[10px] text-mute">{item.label}</p>
                  <p className="text-sm font-medium text-on-surface">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          {video.desc && (
            <div>
              <p className="text-[11px] text-mute mb-1">简介</p>
              <p className="text-xs text-on-surface-variant leading-relaxed whitespace-pre-wrap">{video.desc}</p>
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-outline-variant/30 flex gap-2">
          <button onClick={handleCopyTitle} className="flex-1 py-2 bg-primary/10 text-primary text-xs rounded-lg hover:bg-primary/20 transition-colors flex items-center justify-center gap-1">
            <span className="material-symbols-outlined text-[14px]">content_copy</span>
            复制标题
          </button>
        </div>
      </div>
    </div>
  )
}
