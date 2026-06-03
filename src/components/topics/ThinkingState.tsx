import { useEffect, useRef, useMemo } from 'react'
import { TrendUp, MagnifyingGlass, User, FileText, ArrowRight, ArrowLeft, CheckCircle, Spinner } from '@phosphor-icons/react'
import type { IconProps } from '@phosphor-icons/react'
import { staggerIn } from '../../lib/gsap'

interface LogEntry {
  id: string
  icon: React.ComponentType<IconProps>
  text: string
  status: 'active' | 'done' | 'error'
}

interface AgentEvent {
  type: string
  name?: string
  message?: string
  input?: Record<string, unknown>
  result?: unknown
  text?: string
}

const TOOL_LABELS: Record<string, string> = {
  query_data: '查询历史数据',
  search_similar: '搜索相似内容',
  crawl_data: '爬取平台数据',
  crawl_data_batch: '批量爬取数据',
  suggest_topics: 'AI 正在生成选题',
  analyze_script: '分析脚本',
  request_user_input: '等待用户输入',
  save_result: '保存结果',
}

const TOOL_ICONS: Record<string, React.ComponentType<IconProps>> = {
  query_data: MagnifyingGlass,
  search_similar: MagnifyingGlass,
  crawl_data: TrendUp,
  crawl_data_batch: TrendUp,
  suggest_topics: FileText,
  analyze_script: FileText,
  request_user_input: User,
  save_result: FileText,
}

function buildLogEntries(events: AgentEvent[], isComplete: boolean): LogEntry[] {
  if (events.length === 0) {
    return [{ id: 'boot', icon: Spinner, text: 'Agent 启动中...', status: 'active' }]
  }

  // Build entries by tracking tool lifecycle: call → progress → result
  const toolEntries = new Map<string, LogEntry>()
  const orderedEntries: LogEntry[] = []
  const textEntries: LogEntry[] = []

  for (const evt of events) {
    if (evt.type === 'tool_call' && evt.name) {
      const id = `tool-${evt.name}-${toolEntries.size}`
      const entry: LogEntry = {
        id,
        icon: TOOL_ICONS[evt.name] || MagnifyingGlass,
        text: TOOL_LABELS[evt.name] || evt.name,
        status: 'active',
      }
      toolEntries.set(evt.name, entry)
      orderedEntries.push(entry)
    } else if (evt.type === 'tool_progress' && evt.name && evt.message) {
      // Update the active tool entry's text with progress detail
      const existing = toolEntries.get(evt.name)
      if (existing) {
        existing.text = evt.message
      }
    } else if (evt.type === 'tool_result' && evt.name) {
      const existing = toolEntries.get(evt.name)
      if (existing) {
        existing.status = 'done'
        existing.icon = CheckCircle
      }
    } else if (evt.type === 'text' && evt.text) {
      const id = `text-${textEntries.length}`
      textEntries.push({
        id,
        icon: FileText,
        text: evt.text.length > 80 ? evt.text.slice(0, 80) + '...' : evt.text,
        status: 'done',
      })
    }
  }

  const all = [...orderedEntries, ...textEntries]

  if (all.length === 0) {
    return [{ id: 'boot', icon: Spinner, text: 'Agent 启动中...', status: 'active' }]
  }

  // If complete, mark all done
  if (isComplete) {
    for (const entry of all) entry.status = 'done'
  }

  return all
}

interface Props {
  onSkip: () => void
  onBack?: () => void
  agentEvents?: AgentEvent[]
  isComplete?: boolean
}

export default function ThinkingState({ onSkip, onBack, agentEvents = [], isComplete = false }: Props) {
  const logRefs = useRef<HTMLDivElement[]>([])
  const prevCountRef = useRef(0)
  const logs = useMemo(() => buildLogEntries(agentEvents, isComplete), [agentEvents, isComplete])

  // Only animate newly added entries
  useEffect(() => {
    const els = logRefs.current.filter(Boolean)
    const newEls = els.slice(prevCountRef.current)
    prevCountRef.current = els.length
    if (newEls.length) staggerIn(newEls, { stagger: 0.12, y: 8 })
  }, [logs.length])

  const activeIdx = logs.findIndex(l => l.status === 'active')

  return (
    <div className="flex-1 flex items-center justify-center px-8">
      <div className="w-full max-w-[800px] bg-surface border border-hairline rounded-lg p-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-10">
          <div className="flex items-center gap-3">
            {onBack && (
              <button
                onClick={onBack}
                className="w-8 h-8 rounded-full flex items-center justify-center text-muted hover:bg-hairline transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
            )}
            <h2 className="text-title-md text-ink">AI 思考过程</h2>
          </div>
          <span className="text-caption text-primary">
            {isComplete ? '分析完成' : '正在深度解析中...'}
          </span>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-hairline rounded-full mb-12 relative overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{
              width: isComplete
                ? '100%'
                : activeIdx >= 0
                  ? `${Math.min(90, 15 + (activeIdx + 1) / Math.max(logs.length, 1) * 75)}%`
                  : '15%',
            }}
          />
        </div>

        {/* Log entries */}
        <div className="space-y-5">
          {logs.map((log, i) => (
            <div
              key={log.id}
              ref={(el) => { logRefs.current[i] = el! }}
              className="flex items-start gap-4"
            >
              {/* Icon */}
              <div className="w-5 h-5 flex items-center justify-center shrink-0 mt-0.5">
                {log.status === 'active' ? (
                  <Spinner className="w-4 h-4 text-primary animate-spin" />
                ) : log.status === 'error' ? (
                  <div className="w-2 h-2 rounded-full bg-semantic-error" />
                ) : (
                  <log.icon className="w-4 h-4 text-primary" weight="fill" />
                )}
              </div>
              {/* Text */}
              <p className={`text-body ${log.status === 'active' ? 'text-muted' : 'text-ink'}`}>
                {log.text}
              </p>
            </div>
          ))}
        </div>

        {/* Skip button */}
        <div className="mt-16 flex justify-end">
          <button
            onClick={onSkip}
            className="text-muted hover:text-primary transition-colors text-body-sm flex items-center gap-2"
          >
            跳过
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
