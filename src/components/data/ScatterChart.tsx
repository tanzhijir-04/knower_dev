import ReactECharts from 'echarts-for-react'
import { getChartTheme } from '../../lib/chartTheme'
import type { CrawlContent } from '../../types/electron'

export default function ScatterChart({ data }: { data: CrawlContent[] }) {
  const theme = getChartTheme()
  const option = {
    ...theme,
    tooltip: {
      trigger: 'item',
      ...theme.tooltip,
      formatter: (p: { data: [number, number] }) => `标题长度: ${p.data[0]}字<br/>播放量: ${p.data[1]}`,
    },
    xAxis: { type: 'value', name: '标题长度（字）', ...theme.xAxis },
    yAxis: { type: 'value', name: '播放量', ...theme.yAxis },
    series: [{
      type: 'scatter',
      data: data.map(v => [(v.title || '').length, v.playCount]),
      symbolSize: 8,
      itemStyle: { opacity: 0.7 },
    }],
  }
  return <ReactECharts option={option} style={{ height: 300 }} />
}
