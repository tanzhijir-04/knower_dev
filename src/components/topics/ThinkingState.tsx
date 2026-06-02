import { useEffect, useRef } from 'react'
import { TrendUp, MagnifyingGlass, User, FileText, ArrowRight, ArrowLeft } from '@phosphor-icons/react'
import type { IconProps } from '@phosphor-icons/react'
import { staggerIn } from '../../lib/gsap'

interface LogEntry {
  icon: React.ComponentType<IconProps>
  text: string
  status: 'active' | 'done'
}

const FALLBACK_LOGS: LogEntry[] = [
  { icon: MagnifyingGlass, text: '正在抓取平台热点数据...', status: 'active' },
  { icon: TrendUp, text: '发现高潜力方向...', status: 'done' },
  { icon: User, text: '结合历史数据分析...', status: 'done' },
  { icon: FileText, text: 'AI 正在生成选题...', status: 'done' },
]

function buildLogEntries(messages: string[], isComplete: boolean): LogEntry[] {
  if (messages.length === 0) return FALLBACK_LOGS
  const iconMap: Record<string, React.ComponentType<IconProps>> = {
    '检查': MagnifyingGlass,
    '查询': MagnifyingGlass,
    '抓取': TrendUp,
    '爬取': TrendUp,
    '竞品': User,
    'AI': FileText,
    '解析': FileText,
    '生成': FileText,
    '趋势': TrendUp,
    '偏好': User,
    '完成': TrendUp,
  }
  return messages.map((msg, i) => {
    const isLast = i === messages.length - 1
    const matchedKey = Object.keys(iconMap).find(k => msg.includes(k))
    return {
      icon: matchedKey ? iconMap[matchedKey] : MagnifyingGlass,
      text: msg,
      status: isComplete ? 'done' : (isLast ? 'active' : 'done'),
    }
  })
}

interface Props {
  onSkip: () => void
  onBack?: () => void
  progressMessages?: string[]
  isComplete?: boolean
}

export default function ThinkingState({ onSkip, onBack, progressMessages = [], isComplete = false }: Props) {
  const logRefs = useRef<HTMLDivElement[]>([])
  const logs = buildLogEntries(progressMessages, isComplete)

  useEffect(() => {
    const els = logRefs.current.filter(Boolean)
    if (els.length) staggerIn(els, { stagger: 0.15, y: 12 })
  }, [progressMessages.length])

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
            style={{ width: isComplete ? '100%' : '75%' }}
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
