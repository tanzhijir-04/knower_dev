import { useState, useRef, useCallback, useEffect } from 'react'
import gsap from 'gsap'
import { ClockCounterClockwise } from '@phosphor-icons/react'
import InitialState from './topics/InitialState'
import ThinkingState from './topics/ThinkingState'
import ResultsState from './topics/ResultsState'
import DeepAnalysisState from './topics/DeepAnalysisState'
import TopicConfirmModal from './topics/TopicConfirmModal'
import HistoryPanel from './topics/HistoryPanel'
import type { TopicSuggestion, TopicHistory } from '../types/electron'
import { usePlatform } from '../contexts/PlatformContext'
import { useToast } from '../contexts/ToastContext'

type ViewState = 'initial' | 'thinking' | 'results' | 'deep'

interface Props {
  onSendToChat?: (topic: TopicSuggestion) => void
}

const PLATFORMS = [
  { key: 'bili', label: 'B站' },
  { key: 'dy', label: '抖音' },
  { key: 'xhs', label: '小红书' },
] as const

const THINKING_STEPS = [
  '检查 API Key...',
  '查询历史数据...',
  '查询平台趋势...',
  '查询用户偏好...',
  '正在获取平台实时热点...',
  'AI 正在生成选题...',
  '解析选题结果...',
]

export default function TopicsView({ onSendToChat }: Props) {
  const [viewState, setViewState] = useState<ViewState>('initial')
  const [platform, setPlatform] = useState<string>('bili')
  const [selectedTopicIdx, setSelectedTopicIdx] = useState<number>(0)
  const [showConfirm, setShowConfirm] = useState(false)
  const [topics, setTopics] = useState<TopicSuggestion[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [history, setHistory] = useState<TopicHistory[]>([])
  const [progressMessages, setProgressMessages] = useState<string[]>([])
  const [thinkingComplete, setThinkingComplete] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const { isWindows } = usePlatform()
  const { showToast } = useToast()
  const stateHistoryRef = useRef<ViewState[]>([])
  const api = window.electronAPI

  // Load history
  const loadHistory = useCallback(async () => {
    if (!api) return
    try {
      const data = await api.getTopicHistory(platform)
      setHistory(data)
    } catch { /* ignore */ }
  }, [api, platform])

  useEffect(() => { loadHistory() }, [loadHistory])

  // State transitions with history tracking
  const transitionTo = useCallback((next: ViewState) => {
    stateHistoryRef.current.push(viewState)
    const el = containerRef.current
    if (el) {
      gsap.fromTo(el,
        { opacity: 0, y: 12 },
        { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out', clearProps: 'transform' }
      )
    }
    setViewState(next)
  }, [viewState])

  const goBack = useCallback(() => {
    const prev = stateHistoryRef.current.pop()
    if (prev) {
      const el = containerRef.current
      if (el) {
        gsap.fromTo(el,
          { opacity: 0, y: 12 },
          { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out', clearProps: 'transform' }
        )
      }
      setViewState(prev)
    }
  }, [])

  // Simulate thinking progress
  const runThinkingAnimation = useCallback(() => {
    setProgressMessages([])
    setThinkingComplete(false)
    let step = 0
    const timer = setInterval(() => {
      if (step < THINKING_STEPS.length) {
        setProgressMessages(prev => [...prev, THINKING_STEPS[step]])
        step++
      } else {
        clearInterval(timer)
      }
    }, 600)
    return () => clearInterval(timer)
  }, [])

  // Real API call
  const callSuggestTopics = useCallback(async () => {
    if (!api) {
      setError('Electron IPC 不可用')
      setViewState('initial')
      return
    }
    try {
      const result = await api.suggestTopics(platform)
      if (result.error) {
        setError(result.error)
        showToast(`生成失败: ${result.error}`, 'error')
        setViewState('initial')
        return
      }
      if (result.topics?.length) {
        setTopics(result.topics)
        setThinkingComplete(true)
        loadHistory()
        // Small delay so user sees "完成" state
        setTimeout(() => {
          transitionTo('results')
        }, 500)
      } else {
        setError('暂无可用选题')
        showToast('暂无可用选题', 'error')
        setViewState('initial')
      }
    } catch {
      setError('生成失败，请重试')
      showToast('生成失败，请重试', 'error')
      setViewState('initial')
    }
  }, [api, platform, loadHistory, showToast, transitionTo])

  // Handlers
  const handleInitialSubmit = useCallback((_input: string, _mode: string) => {
    setError(null)
    transitionTo('thinking')
    const cleanup = runThinkingAnimation()
    // Start real API call (fire and forget — results arrive via callSuggestTopics)
    callSuggestTopics().then(() => cleanup()).catch(() => cleanup())
  }, [transitionTo, runThinkingAnimation, callSuggestTopics])

  const handleThinkingSkip = useCallback(() => {
    // If API already returned, just go to results
    if (topics.length > 0) {
      setThinkingComplete(true)
      transitionTo('results')
    }
    // Otherwise let the API continue in background
  }, [topics.length, transitionTo])

  const handleTopicSelect = useCallback((idx: number) => {
    setSelectedTopicIdx(idx)
    transitionTo('deep')
  }, [transitionTo])

  const handleStartCreate = useCallback(() => {
    setShowConfirm(true)
  }, [])

  const handleConfirmCreate = useCallback((data: { duration: string; requirements: string }) => {
    setShowConfirm(false)
    const topic = topics[selectedTopicIdx]
    onSendToChat?.({
      ...topic,
      platforms: topic.platforms?.length ? topic.platforms : ['bilibili'],
    })
    void data // used for future integration
  }, [topics, selectedTopicIdx, onSendToChat])

  // History actions
  const handleStarHistory = useCallback(async (id: number) => {
    if (!api) return
    await api.starTopicHistory(id)
    loadHistory()
  }, [api, loadHistory])

  const handleDeleteHistory = useCallback(async (id: number) => {
    if (!api) return
    await api.deleteTopicHistory(id)
    loadHistory()
    showToast('已删除', 'success')
  }, [api, loadHistory, showToast])

  const handleSelectHistory = useCallback((topicsFromHistory: TopicSuggestion[]) => {
    setTopics(topicsFromHistory)
    setShowHistory(false)
    stateHistoryRef.current = ['initial'] // reset history so back goes to initial
    const el = containerRef.current
    if (el) {
      gsap.fromTo(el,
        { opacity: 0, y: 12 },
        { opacity: 1, y: 0, duration: 0.3, ease: 'power2.out', clearProps: 'transform' }
      )
    }
    setViewState('results')
  }, [])

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
        <div className="w-px h-5 bg-hairline no-drag" />
        <button
          onClick={() => setShowHistory(!showHistory)}
          className={`no-drag text-caption px-2.5 py-1 rounded-md transition-colors flex items-center gap-1.5 ${
            showHistory ? 'bg-primary/10 text-primary' : 'text-muted hover:text-ink hover:bg-canvas-soft'
          }`}
        >
          <ClockCounterClockwise className="w-4 h-4" weight="fill" />
          历史
        </button>
      </header>

      {/* Error banner */}
      {error && (
        <div className="px-5 py-2 bg-semantic-error/5 border-b border-semantic-error/20 text-caption text-semantic-error flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-semantic-error hover:opacity-70">✕</button>
        </div>
      )}

      {/* Content */}
      <div ref={containerRef} className="flex-1 flex flex-col overflow-hidden">
        {viewState === 'initial' && (
          <InitialState onSubmit={handleInitialSubmit} />
        )}
        {viewState === 'thinking' && (
          <ThinkingState
            onSkip={handleThinkingSkip}
            onBack={goBack}
            progressMessages={progressMessages}
            isComplete={thinkingComplete}
          />
        )}
        {viewState === 'results' && (
          <ResultsState
            topics={topics}
            onSelect={handleTopicSelect}
            onBack={goBack}
          />
        )}
        {viewState === 'deep' && topics[selectedTopicIdx] && (
          <DeepAnalysisState
            topic={topics[selectedTopicIdx]}
            onBack={goBack}
            onStartCreate={handleStartCreate}
          />
        )}
      </div>

      {/* Confirm modal */}
      {showConfirm && topics[selectedTopicIdx] && (
        <TopicConfirmModal
          topic={topics[selectedTopicIdx]}
          onConfirm={handleConfirmCreate}
          onCancel={() => setShowConfirm(false)}
        />
      )}

      {/* History panel */}
      {showHistory && (
        <HistoryPanel
          history={history}
          onStar={handleStarHistory}
          onDelete={handleDeleteHistory}
          onSelect={handleSelectHistory}
          onClose={() => setShowHistory(false)}
        />
      )}
    </div>
  )
}
