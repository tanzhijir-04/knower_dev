import ReactECharts from 'echarts-for-react'
import { getChartTheme } from '../../lib/chartTheme'
import type { CrawlContent } from '../../types/electron'

export default function TimeChart({ data }: { data: CrawlContent[] }) {
  const theme = getChartTheme()
  const hourMap: Record<number, number> = {}
  data.forEach(v => {
    if (v.createdAt) {
      const hour = new Date(v.createdAt).getHours()
      hourMap[hour] = (hourMap[hour] || 0) + 1
    }
  })
  const hours = Array.from({ length: 24 }, (_, i) => i)
  const option = {
    ...theme,
    tooltip: { trigger: 'axis', ...theme.tooltip },
    xAxis: { type: 'category', data: hours.map(h => `${h}时`), ...theme.xAxis },
    yAxis: { type: 'value', ...theme.yAxis },
    series: [{
      type: 'bar',
      data: hours.map(h => hourMap[h] || 0),
      itemStyle: { borderRadius: [4, 4, 0, 0] },
    }],
  }
  return <ReactECharts option={option} style={{ height: 300 }} />
}
