import ReactECharts from 'echarts-for-react'
import { getChartTheme } from '../../lib/chartTheme'
import type { VideoAnalysis } from '../../types/electron'

export default function RadarChart({ stats }: { stats: VideoAnalysis }) {
  const theme = getChartTheme()
  const option = {
    ...theme,
    radar: {
      indicator: [
        { name: '播放量', max: Math.max(stats.overview.totalPlay, 1) },
        { name: '点赞数', max: Math.max(stats.overview.totalLike, 1) },
        { name: '评论数', max: Math.max(stats.overview.totalComment, 1) },
        { name: '互动率', max: 100 },
        { name: '更新频率', max: 30 },
      ],
      axisName: { color: theme.textStyle.color },
      splitArea: { areaStyle: { color: ['transparent'] } },
    },
    series: [{
      type: 'radar',
      data: [{
        value: [
          stats.overview.totalPlay,
          stats.overview.totalLike,
          stats.overview.totalComment,
          stats.topByEngagement?.[0]?.engagementRate || 0,
          stats.overview.totalVideos,
        ],
        areaStyle: { opacity: 0.2 },
      }],
    }],
  }
  return <ReactECharts option={option} style={{ height: 300 }} />
}
