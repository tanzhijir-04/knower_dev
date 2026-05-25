import ReactECharts from 'echarts-for-react'
import { getChartTheme } from '../../lib/chartTheme'
import type { CrawlContent } from '../../types/electron'

export default function CategoryChart({ data }: { data: CrawlContent[] }) {
  const theme = getChartTheme()
  const catMap: Record<string, number> = {}
  data.forEach(v => {
    const cat = v.category || '未分类'
    catMap[cat] = (catMap[cat] || 0) + 1
  })
  const option = {
    ...theme,
    tooltip: { trigger: 'item', ...theme.tooltip },
    series: [{
      type: 'pie',
      radius: ['40%', '70%'],
      data: Object.entries(catMap).map(([name, value]) => ({ name, value })),
    }],
  }
  return <ReactECharts option={option} style={{ height: 300 }} />
}
