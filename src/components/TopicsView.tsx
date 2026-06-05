import { useState, useRef, useCallback, useEffect } from 'react'
import gsap from 'gsap'
import { ClockCounterClockwise, CaretLeft } from '@phosphor-icons/react'
import InitialState from './topics/InitialState'
import ThinkingState from './topics/ThinkingState'
import ResultsState from './topics/ResultsState'
import DeepAnalysisState from './topics/DeepAnalysisState'
import TopicConfirmModal from './topics/TopicConfirmModal'
import HistoryPanel from './topics/HistoryPanel'
import type { TopicSuggestion, TopicHistory } from '../types/electron'
import { usePlatform } from '../contexts/PlatformContext'
import { useToast } from '../contexts/ToastContext'
import { useAccount } from '../contexts/AccountContext'

type ViewState = 'initial' | 'thinking' | 'results' | 'deep'

interface Props {
  onSendToChat?: (topic: TopicSuggestion) => void
}

const PLATFORMS = [
  { key: 'bili', label: 'B站' },
  { key: 'dy', label: '抖音' },
  { key: 'xhs', label: '小红书' },
] as const

interface AgentEvent {
  type: string
  name?: string
  message?: string
  input?: Record<string, unknown>
  result?: unknown
  text?: string
}

export default function TopicsView({ onSendToChat }: Props) {
  const { activeAccountId } = useAccount()
  const [viewState, setViewState] = useState<ViewState>('initial')
  const [platform, setPlatform] = useState<string>('bili')
  const [selectedTopicIdx, setSelectedTopicIdx] = useState<number>(0)
  const [showConfirm, setShowConfirm] = useState(false)
  const [topics, setTopics] = useState<TopicSuggestion[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [history, setHistory] = useState<TopicHistory[]>([])
  const [thinkingComplete, setThinkingComplete] = useState(false)
  const [agentEvents, setAgentEvents] = useState<AgentEvent[]>([])
  const [error, setError] = useState<string | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const thinkingCompleteRef = useRef(false)
  const { isWindows } = usePlatform()
  const { showToast } = useToast()
  const stateHistoryRef = useRef<ViewState[]>([])
  const api = window.electronAPI

  // Keep ref in sync
  useEffect(() => { thinkingCompleteRef.current = thinkingComplete }, [thinkingComplete])

  // Load history
  const loadHistory = useCallback(async () => {
    if (!api) return
    try {
      const data = await api.getTopicHistory(platform)
      setHistory(data)
    } catch { /* ignore */ }
  }, [api, platform, activeAccountId])

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

  // Agent event listener for topic generation
  useEffect(() => {
    if (!api) return
    const unsub = api.onTopicAgentEvent((raw) => {
      try {
        const evt: AgentEvent = JSON.parse(raw)
        setAgentEvents(prev => [...prev, evt])

        // 1. 从 tool_result 提取选题
        if (evt.type === 'tool_result' && evt.name === 'suggest_topics') {
          const result = typeof evt.result === 'string' ? JSON.parse(evt.result) : evt.result
          if (result?.topics?.length) {
            setTopics(result.topics)
            setThinkingComplete(true)
            api.saveTopicHistory(platform, 'agent', result.topics).catch(() => {})
            loadHistory()
            setTimeout(() => setViewState('results'), 300)
            return
          }
          if (!result?.error) {
            setThinkingComplete(true)
          }
        }

        // 2. 从 text 事件兜底提取 JSON 选题
        if (evt.type === 'text' && evt.text) {
          try {
            const match = evt.text.match(/\[[\s\S]*\]/)
            if (match) {
              const parsed = JSON.parse(match[0])
              if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].title) {
                setTopics(parsed)
                setThinkingComplete(true)
                api.saveTopicHistory(platform, 'agent', parsed).catch(() => {})
                loadHistory()
                setTimeout(() => setViewState('results'), 300)
                return
              }
            }
          } catch {}
        }

        if (evt.type === 'error') {
          setError(evt.message || 'Agent 执行失败')
          showToast(`生成失败: ${evt.message}`, 'error')
          setViewState('initial')
          return
        }

        if (evt.type === 'done') {
          if (topics.length > 0 || thinkingCompleteRef.current) {
            setViewState('results')
          } else {
            setError('Agent 未返回选题，请重试')
            setViewState('initial')
          }
        }
      } catch { /* ignore parse errors */ }
    })
    return unsub
  }, [api, loadHistory, showToast, platform, topics.length])

  // Handlers
  const handleInitialSubmit = useCallback(async (_input: string, mode: string) => {
    setError(null)
    setAgentEvents([])
    setThinkingComplete(false)
    transitionTo('thinking')
    // Start Agent via independent channel
    try {
      const result = await api?.runTopicAgent(platform, mode)
      if (result?.error) {
        setError(result.error)
        showToast(result.error, 'error')
        setViewState('initial')
      }
    } catch {
      setError('启动 Agent 失败')
      setViewState('initial')
    }
  }, [api, platform, transitionTo, showToast])

  const handleThinkingSkip = useCallback(() => {
    // If API already returned, just go to results
    if (topics.length > 0) {
      setThinkingComplete(true)
      transitionTo('results')
    } else {
      // Stop the Agent
      api?.stopTopicAgent().catch(() => {})
      setViewState('initial')
    }
  }, [topics.length, transitionTo, api])

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
        {viewState !== 'initial' && (
          <button onClick={goBack} className="self-start m-3 flex items-center gap-1 text-xs text-muted hover:text-ink transition-colors px-2 py-1 rounded hover:bg-canvas-soft">
            <CaretLeft className="w-3.5 h-3.5" />
            返回
          </button>
        )}
        {viewState === 'initial' && (
          <InitialState onSubmit={handleInitialSubmit} />
        )}
        {viewState === 'thinking' && (
          <ThinkingState
            onSkip={handleThinkingSkip}
            onBack={goBack}
            agentEvents={agentEvents}
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
