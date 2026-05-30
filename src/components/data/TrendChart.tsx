import { useState, useEffect } from 'react'
import ReactECharts from 'echarts-for-react'
import { getChartTheme } from '../../lib/chartTheme'
import type { CrawlContent } from '../../types/electron'

export default function TrendChart({ data }: { data: CrawlContent[] }) {
  const [ready, setReady] = useState(false)
  useEffect(() => { const t = setTimeout(() => setReady(true), 50); return () => clearTimeout(t) }, [])
  const theme = getChartTheme()
  const sorted = [...data].sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''))
  const option = {
    ...theme,
    tooltip: { trigger: 'axis', ...theme.tooltip },
    xAxis: {
      type: 'category',
      data: sorted.map(v => v.createdAt?.slice(0, 10) || ''),
      ...theme.xAxis,
    },
    yAxis: { type: 'value', ...theme.yAxis },
    series: [{
      type: 'line',
      data: sorted.map(v => v.playCount),
      smooth: true,
      areaStyle: { opacity: 0.1 },
    }],
  }
  if (!ready) return <div style={{ height: 300 }} />
  return <ReactECharts option={option} style={{ height: 300 }} />
}
