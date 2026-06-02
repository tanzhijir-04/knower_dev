import { useState, useRef, useCallback } from 'react'
import gsap from 'gsap'
import InitialState from './topics/InitialState'
import ThinkingState from './topics/ThinkingState'
import ResultsState from './topics/ResultsState'
import DeepAnalysisState from './topics/DeepAnalysisState'
import TopicConfirmModal from './topics/TopicConfirmModal'
import type { TopicSuggestion } from '../types/electron'
import { usePlatform } from '../contexts/PlatformContext'

type ViewState = 'initial' | 'thinking' | 'results' | 'deep'

interface Props {
  onSendToChat?: (topic: TopicSuggestion) => void
}

const PLATFORMS = [
  { key: 'bili', label: 'B站' },
  { key: 'dy', label: '抖音' },
  { key: 'xhs', label: '小红书' },
] as const

const MOCK_TOPICS: TopicSuggestion[] = [
  {
    title: '2024夏日城市骑行Vlog指南：路线与装备全攻略',
    reason: '基于夏日户外运动趋势和您近期对旅行、科技内容的关注，此选题结合了热门生活方式与实用攻略，极具爆款潜力。',
    source: 'trend',
    estimatedPerformance: '80K - 120K',
    tags: ['城市骑行', 'Vlog', '装备推荐', '夏日活动'],
    overallScore: 95,
    competitionLevel: '60/100',
    urgency: '强',
  },
  {
    title: 'AI工具赋能创意短视频：5分钟制作高质量内容实战',
    reason: '顺应AI工具在创作领域的爆发，结合您对效率工具的兴趣。此选题针对痛点，提供实操价值。',
    source: 'trend',
    estimatedPerformance: '60K - 90K',
    tags: ['AI工具', '短视频', '效率提升'],
    overallScore: 92,
    competitionLevel: '55/100',
    urgency: '中',
  },
  {
    title: '低成本家居改造挑战：租房党的百元幸福感提升秘籍',
    reason: '家居改造类内容持续高热，低成本切入点降低用户心理门槛，适合中小创作者突围。',
    source: 'differentiated',
    estimatedPerformance: '50K - 80K',
    tags: ['家居改造', '租房', '低成本', '生活技巧'],
    overallScore: 88,
    competitionLevel: '45/100',
    urgency: '中',
  },
]

export default function TopicsView({ onSendToChat }: Props) {
  const [viewState, setViewState] = useState<ViewState>('initial')
  const [platform, setPlatform] = useState<string>('bili')
  const [selectedTopicIdx, setSelectedTopicIdx] = useState<number>(0)
  const [showConfirm, setShowConfirm] = useState(false)
  const [topics] = useState<TopicSuggestion[]>(MOCK_TOPICS)
  const containerRef = useRef<HTMLDivElement>(null)
  const { isWindows } = usePlatform()

  const transitionTo = useCallback((next: ViewState) => {
    const el = containerRef.current
    if (el) {
      gsap.fromTo(el,
        { opacity: 0, y: 12 },
        { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out', clearProps: 'transform' }
      )
    }
    setViewState(next)
  }, [])

  const handleInitialSubmit = (_input: string, _mode: string) => {
    transitionTo('thinking')
  }

  const handleThinkingSkip = () => {
    transitionTo('results')
  }

  const handleTopicSelect = (idx: number) => {
    setSelectedTopicIdx(idx)
    transitionTo('deep')
  }

  const handleDeepBack = () => {
    transitionTo('results')
  }

  const handleStartCreate = () => {
    setShowConfirm(true)
  }

  const handleConfirmCreate = (data: { duration: string; requirements: string }) => {
    setShowConfirm(false)
    const topic = topics[selectedTopicIdx]
    onSendToChat?.({
      ...topic,
      platforms: topic.platforms?.length ? topic.platforms : ['bilibili'],
    })
    console.log('Confirmed with:', data)
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <header className={`titlebar-drag h-12 flex items-center px-5 shrink-0 gap-3 ${isWindows ? '' : 'border-b border-hairline'}`}>
        <h1 className="text-body-sm font-medium text-ink no-drag">灵感库</h1>
        <div className="flex-1" />
        <div className="flex items-center gap-1 no-drag">
          {PLATFORMS.map((p) => (
            <button
              key={p.key}
              onClick={() => setPlatform(p.key)}
              className={`px-2.5 py-1 text-caption rounded-md transition-colors ${
                platform === p.key
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted hover:text-ink hover:bg-canvas-soft'
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </header>

      {/* Content */}
      <div ref={containerRef} className="flex-1 flex flex-col overflow-hidden">
        {viewState === 'initial' && (
          <InitialState onSubmit={handleInitialSubmit} />
        )}
        {viewState === 'thinking' && (
          <ThinkingState onSkip={handleThinkingSkip} />
        )}
        {viewState === 'results' && (
          <ResultsState topics={topics} onSelect={handleTopicSelect} />
        )}
        {viewState === 'deep' && (
          <DeepAnalysisState
            topic={topics[selectedTopicIdx]}
            onBack={handleDeepBack}
            onStartCreate={handleStartCreate}
          />
        )}
      </div>

      {/* Confirm modal */}
      {showConfirm && (
        <TopicConfirmModal
          topic={topics[selectedTopicIdx]}
          onConfirm={handleConfirmCreate}
          onCancel={() => setShowConfirm(false)}
        />
      )}
    </div>
  )
}
