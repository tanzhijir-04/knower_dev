import type { TrendData } from '../../types/electron'

interface Props {
  trends: TrendData[]
  loading: boolean
}

export default function TrendPanel({ trends, loading }: Props) {
  return (
    <div className="w-64 shrink-0 border-r border-border/30 flex flex-col overflow-hidden">
      <div className="px-4 py-3 border-b border-border/30">
        <h3 className="text-sm font-medium text-on-surface">平台趋势</h3>
        <p className="text-[11px] text-mute mt-0.5">近 7 天热门内容</p>
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <span className="inline-block w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
            <span className="inline-block w-1.5 h-1.5 bg-primary rounded-full animate-pulse ml-1 [animation-delay:150ms]" />
            <span className="inline-block w-1.5 h-1.5 bg-primary rounded-full animate-pulse ml-1 [animation-delay:300ms]" />
          </div>
        ) : trends.length === 0 ? (
          <div className="text-center py-8 px-4">
            <span className="material-symbols-outlined text-[24px] text-mute mb-2 block">trending_up</span>
            <p className="text-xs text-mute">暂无趋势数据</p>
            <p className="text-[11px] text-mute mt-1">请先在数据概览中爬取平台数据</p>
          </div>
        ) : (
          <div className="divide-y divide-border/20">
            {trends.slice(0, 15).map((trend, i) => (
              <div key={i} className="px-3 py-2.5 hover:bg-surface-container transition-colors">
                <div className="flex items-start gap-2">
                  <span className={`text-[10px] font-medium mt-0.5 w-4 shrink-0 ${i < 3 ? 'text-primary' : 'text-mute'}`}>
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-on-surface line-clamp-2 leading-relaxed">{trend.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-mute">{trend.authorName}</span>
                      <span className="text-[10px] text-mute">
                        {trend.playCount >= 10000
                          ? `${(trend.playCount / 10000).toFixed(1)}万`
                          : trend.playCount} 播放
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
