import { useRef, useEffect, useMemo } from 'react'
import ReactECharts from 'echarts-for-react'
import { ArrowLeft, VideoCamera, Clock, Calendar } from '@phosphor-icons/react'
import { staggerIn } from '../../lib/gsap'
import type { TopicSuggestion } from '../../types/electron'

interface Props {
  topic: TopicSuggestion
  onBack: () => void
  onStartCreate: () => void
}

const STRATEGY_ICONS = [VideoCamera, Clock, Calendar]

function getChartOption(trendData?: { month: string; value: number }[]) {
  const data = trendData || [
    { month: '1月', value: 60 }, { month: '2月', value: 55 },
    { month: '3月', value: 65 }, { month: '4月', value: 50 },
    { month: '5月', value: 70 }, { month: '6月', value: 80 },
  ]
  return {
    grid: { top: 10, right: 10, bottom: 24, left: 36 },
    xAxis: {
      type: 'category',
      data: data.map(d => d.month),
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
      data: data.map(d => d.value),
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

const FALLBACK_OUTLINE = [
  { title: '开头 (Hook)', desc: '抛出痛点问题，引发观众共鸣，展示核心价值' },
  { title: '核心观点 (Core)', desc: '展开论述，提供干货内容，用数据和案例支撑' },
  { title: '结尾 (Ending)', desc: '总结要点，引导互动，预告下期内容' },
]

const FALLBACK_STRATEGY = [
  { label: '形式', value: '短视频' },
  { label: '时长', value: '60s - 90s' },
  { label: '发布时间', value: '18:00 - 20:00' },
]

const FALLBACK_TITLES = [
  '这个方法真的有效，不信你试试',
  '90%的人都不知道的技巧',
  '后悔没早点知道的真相',
]

export default function DeepAnalysisState({ topic, onBack, onStartCreate }: Props) {
  const gridRef = useRef<HTMLDivElement>(null)

  const outline = topic.outline?.length ? topic.outline : FALLBACK_OUTLINE
  const strategy = topic.strategy?.length ? topic.strategy : FALLBACK_STRATEGY
  const titles = topic.alternateTitles?.length ? topic.alternateTitles : FALLBACK_TITLES
  const chartOption = useMemo(() => getChartOption(topic.trendData), [topic.trendData])

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
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-title-md text-ink">为什么推荐</h3>
                  <p className="text-caption text-muted">{topic.reason}</p>
                </div>
                <div className="text-right">
                  <p className="text-caption text-muted">热度得分</p>
                  <p className="text-title-md text-primary">{topic.overallScore || 0}/100</p>
                </div>
              </div>

              <div className="mb-4">
                <ReactECharts
                  option={chartOption}
                  style={{ height: 200 }}
                  opts={{ renderer: 'svg' }}
                />
              </div>

              <div className="flex justify-between text-caption text-muted">
                {topic.scores ? (
                  <>
                    <span>热度: <span className="text-ink font-medium">{topic.scores.heat}</span></span>
                    <span>可行性: <span className="text-ink font-medium">{topic.scores.feasibility}</span></span>
                    <span>契合度: <span className="text-ink font-medium">{topic.scores.fit}</span></span>
                  </>
                ) : (
                  <>
                    <span>来源: <span className="text-ink font-medium">{topic.source}</span></span>
                    <span>预估: <span className="text-ink font-medium">{topic.estimatedPerformance}</span></span>
                    <span>时效: <span className="text-ink font-medium">{topic.urgency || '长期'}</span></span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="col-span-5">
            <div className="bg-surface border border-hairline rounded-lg p-6 h-full">
              <h3 className="text-title-md text-ink mb-8">内容策略</h3>
              <div className="grid grid-cols-3 gap-4 text-center">
                {strategy.map((item, i) => (
                  <div key={i} className="space-y-2">
                    <div className="mx-auto w-10 h-10 border border-hairline flex items-center justify-center rounded-md text-primary">
                      {(() => { const Icon = STRATEGY_ICONS[i % STRATEGY_ICONS.length]; return <Icon className="w-5 h-5" /> })()}
                    </div>
                    <p className="text-caption text-muted">{item.label}</p>
                    <p className="text-body-sm text-ink font-medium">{item.value}</p>
                  </div>
                ))}
              </div>
              {topic.actionPlan && (
                <p className="text-caption text-muted mt-6 text-center">{topic.actionPlan}</p>
              )}
            </div>
          </div>

          {/* Row 2: Outline + Alternate Titles */}
          <div className="col-span-7">
            <div className="bg-surface border border-hairline rounded-lg p-6">
              <h3 className="text-title-md text-ink mb-6">建议大纲</h3>
              <div className="space-y-6">
                {outline.map((section, i) => (
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
                {titles.map((title, i) => (
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
