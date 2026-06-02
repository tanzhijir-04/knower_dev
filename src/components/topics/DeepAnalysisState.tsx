import { useRef, useEffect } from 'react'
import ReactECharts from 'echarts-for-react'
import { ArrowLeft, VideoCamera, Clock, Calendar } from '@phosphor-icons/react'
import { staggerIn } from '../../lib/gsap'
import type { TopicSuggestion } from '../../types/electron'

interface Props {
  topic: TopicSuggestion
  onBack: () => void
  onStartCreate: () => void
}

const MOCK_STRATEGY = [
  { icon: VideoCamera, label: '形式', value: '短视频' },
  { icon: Clock, label: '时长', value: '60s - 90s' },
  { icon: Calendar, label: '发布时间', value: '18:00 - 20:00' },
]

const MOCK_OUTLINE = [
  { title: '开头 (Hook)', desc: '抛出痛点：你是否也觉得家里的旧家电越用越累？展示智能家居带来的改变...' },
  { title: '核心观点 (Core Points)', desc: '提升生活效率：全屋智能语音控制实测；改善居住体验：氛围灯光与温控自动化；节能环保：智能插座的省钱账单' },
  { title: '结尾 (Ending)', desc: '引导点赞评论：你最想拥有哪件智能单品？预告下期深度测评内容。' },
]

const MOCK_TITLES = [
  '2024年，这几样智能家居真的能提升幸福感！',
  '装修党必看：值得无限回购的智能家居好物清单',
  '告别智商税，这些智能家居让你的生活更轻松',
]

function getChartOption() {
  const months = ['1月', '2月', '3月', '4月', '5月', '6月']
  const data = [80, 75, 85, 60, 70, 92]
  return {
    grid: { top: 10, right: 10, bottom: 24, left: 36 },
    xAxis: {
      type: 'category',
      data: months,
      axisLine: { lineStyle: { color: '#e6e5e0' } },
      axisTick: { show: false },
      axisLabel: { color: '#807d72', fontSize: 11 },
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: '#e6e5e0', type: 'dashed' } },
      axisLabel: { color: '#807d72', fontSize: 11 },
    },
    series: [{
      type: 'line',
      data,
      smooth: true,
      symbol: 'circle',
      symbolSize: 6,
      lineStyle: { color: '#f54e00', width: 2 },
      itemStyle: { color: '#f54e00' },
      areaStyle: {
        color: {
          type: 'linear',
          x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [
            { offset: 0, color: 'rgba(245, 78, 0, 0.15)' },
            { offset: 1, color: 'rgba(245, 78, 0, 0)' },
          ],
        },
      },
    }],
  }
}

export default function DeepAnalysisState({ topic, onBack, onStartCreate }: Props) {
  const gridRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (gridRef.current) {
      const children = Array.from(gridRef.current.children) as HTMLElement[]
      staggerIn(children, { stagger: 0.08, y: 12 })
    }
  }, [])

  return (
    <div className="flex-1 overflow-y-auto px-8 py-10 pb-32">
      <div className="max-w-[1100px] mx-auto">
        {/* Top nav */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={onBack}
            className="w-10 h-10 rounded-full flex items-center justify-center text-muted hover:bg-hairline transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h2 className="text-title-md text-ink">{topic.title}</h2>
        </div>

        {/* 12-col grid */}
        <div ref={gridRef} className="grid grid-cols-12 gap-6">
          {/* Row 1: Why Recommended + Strategy */}
          <div className="col-span-7">
            <div className="bg-surface border border-hairline rounded-lg p-6 h-full">
              {/* Header */}
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-title-md text-ink">为什么推荐</h3>
                  <p className="text-caption text-muted">增长趋势分析</p>
                </div>
                <div className="text-right">
                  <p className="text-caption text-muted">热度得分</p>
                  <p className="text-title-md text-primary">{topic.overallScore || 92}/100</p>
                </div>
              </div>

              {/* ECharts area chart */}
              <div className="mb-4">
                <ReactECharts
                  option={getChartOption()}
                  style={{ height: 200 }}
                  opts={{ renderer: 'svg' }}
                />
              </div>

              {/* Metrics */}
              <div className="flex justify-between text-caption text-muted">
                <span>近期发布: <span className="text-ink font-medium">5.2K</span></span>
                <span>互动率: <span className="text-ink font-medium">15.3%</span></span>
                <span>潜在播放: <span className="text-ink font-medium">80K - 120K</span></span>
              </div>
            </div>
          </div>

          <div className="col-span-5">
            <div className="bg-surface border border-hairline rounded-lg p-6 h-full">
              <h3 className="text-title-md text-ink mb-8">内容策略</h3>
              <div className="grid grid-cols-3 gap-4 text-center">
                {MOCK_STRATEGY.map((item, i) => (
                  <div key={i} className="space-y-2">
                    <div className="mx-auto w-10 h-10 border border-hairline flex items-center justify-center rounded-md text-primary">
                      <item.icon className="w-5 h-5" />
                    </div>
                    <p className="text-caption text-muted">{item.label}</p>
                    <p className="text-body-sm text-ink font-medium">{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Row 2: Outline + Alternate Titles */}
          <div className="col-span-7">
            <div className="bg-surface border border-hairline rounded-lg p-6">
              <h3 className="text-title-md text-ink mb-6">建议大纲</h3>
              <div className="space-y-6">
                {MOCK_OUTLINE.map((section, i) => (
                  <div key={i}>
                    <div className="flex items-center gap-2 text-primary mb-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-primary" />
                      <span className="text-caption-uppercase text-primary">{section.title}</span>
                    </div>
                    <p className="text-body-sm text-muted leading-relaxed pl-3.5">{section.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="col-span-5">
            <div className="bg-surface border border-hairline rounded-lg p-6 h-full">
              <h3 className="text-title-md text-ink mb-6">备选标题</h3>
              <div className="space-y-3">
                {MOCK_TITLES.map((title, i) => (
                  <div
                    key={i}
                    className="p-3 border border-hairline rounded-md text-body-sm text-ink hover:border-primary transition-colors cursor-pointer"
                  >
                    {i + 1}. {title}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky CTA */}
      <div className="fixed bottom-0 left-64 right-0 p-8 pointer-events-none"
        style={{ background: 'linear-gradient(to top, var(--canvas) 40%, transparent)' }}>
        <div className="max-w-[1100px] mx-auto pointer-events-auto">
          <button
            onClick={onStartCreate}
            className="w-full py-4 bg-primary text-on-primary font-semibold text-button rounded-md hover:bg-primary-active transition-colors"
          >
            开始创作
          </button>
        </div>
      </div>
    </div>
  )
}
