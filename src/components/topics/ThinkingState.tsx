import { useEffect, useRef } from 'react'
import { TrendUp, MagnifyingGlass, User, FileText, ArrowRight, ArrowLeft, CheckCircle } from '@phosphor-icons/react'
import type { IconProps } from '@phosphor-icons/react'
import { staggerIn } from '../../lib/gsap'

interface LogEntry {
  icon: React.ComponentType<IconProps>
  text: string
  status: 'active' | 'done'
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
  suggest_topics: 'AI 生成选题中',
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

const FALLBACK_LOGS: LogEntry[] = [
  { icon: MagnifyingGlass, text: 'Agent 启动中...', status: 'active' },
]

function buildLogEntries(events: AgentEvent[], isComplete: boolean): LogEntry[] {
  if (events.length === 0) return FALLBACK_LOGS

  const logs: LogEntry[] = []

  for (const evt of events) {
    if (evt.type === 'tool_call' && evt.name) {
      const label = TOOL_LABELS[evt.name] || evt.name
      logs.push({
        icon: TOOL_ICONS[evt.name] || MagnifyingGlass,
        text: label,
        status: 'active',
      })
    } else if (evt.type === 'tool_progress' && evt.message) {
      // Update the last active entry with progress message
      if (logs.length > 0) {
        const last = logs[logs.length - 1]
        logs.push({
          icon: last.icon,
          text: evt.message,
          status: 'active',
        })
      }
    } else if (evt.type === 'tool_result' && evt.name) {
      const label = TOOL_LABELS[evt.name] || evt.name
      // Mark previous entries as done, add completion
      for (const log of logs) {
        if (log.status === 'active') log.status = 'done'
      }
      logs.push({
        icon: CheckCircle,
        text: `${label} — 完成`,
        status: 'done',
      })
    } else if (evt.type === 'text' && evt.text) {
      logs.push({
        icon: FileText,
        text: evt.text.slice(0, 80) + (evt.text.length > 80 ? '...' : ''),
        status: 'done',
      })
    }
  }

  if (logs.length === 0) return FALLBACK_LOGS

  // Mark all as done if complete
  if (isComplete) {
    for (const log of logs) log.status = 'done'
  } else if (logs.length > 0) {
    // Keep only the last entry as active
    for (let i = 0; i < logs.length - 1; i++) {
      if (logs[i].status === 'active') logs[i].status = 'done'
    }
  }

  return logs
}

interface Props {
  onSkip: () => void
  onBack?: () => void
  agentEvents?: AgentEvent[]
  isComplete?: boolean
}

export default function ThinkingState({ onSkip, onBack, agentEvents = [], isComplete = false }: Props) {
  const logRefs = useRef<HTMLDivElement[]>([])
  const logs = buildLogEntries(agentEvents, isComplete)

  useEffect(() => {
    const els = logRefs.current.filter(Boolean)
    if (els.length) staggerIn(els, { stagger: 0.15, y: 12 })
  }, [agentEvents.length])

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
            style={{ width: isComplete ? '100%' : `${Math.min(90, 20 + logs.length * 15)}%` }}
          />
        </div>

        {/* Log entries */}
        <div className="space-y-6">
          {logs.map((log, i) => (
            <div
              key={`${i}-${log.text}`}
              ref={(el) => { logRefs.current[i] = el! }}
              className="flex items-start gap-4"
            >
              {log.status === 'active' ? (
                <div className="w-2 h-2 rounded-full bg-primary mt-2 animate-pulse" />
              ) : (
                <div className="w-5 h-5 flex items-center justify-center text-primary mt-0.5">
                  <log.icon className="w-4 h-4" weight="fill" />
                </div>
              )}
              <p className={log.status === 'active' ? 'text-muted animate-pulse' : 'text-body'}>
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
