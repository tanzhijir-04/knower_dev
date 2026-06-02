import { useEffect, useRef } from 'react'
import { TrendUp, MagnifyingGlass, User, FileText, ArrowRight } from '@phosphor-icons/react'
import type { IconProps } from '@phosphor-icons/react'
import { staggerIn } from '../../lib/gsap'

interface LogEntry {
  icon: React.ComponentType<IconProps>
  text: string
  status: 'active' | 'done'
}

const MOCK_LOGS: LogEntry[] = [
  { icon: MagnifyingGlass, text: '正在抓取 B站/抖音 近期热点...', status: 'active' },
  { icon: TrendUp, text: '发现 3 个高潜力方向：AI硬件落地（热度↑35%）...', status: 'done' },
  { icon: User, text: '结合你的历史数据：你做过 3 条 AI 相关视频...', status: 'done' },
  { icon: FileText, text: '正在分析最新爆款视频特征：短小、高密度、情绪共鸣...', status: 'done' },
]

interface Props {
  onSkip: () => void
}

export default function ThinkingState({ onSkip }: Props) {
  const logRefs = useRef<HTMLDivElement[]>([])

  useEffect(() => {
    const els = logRefs.current.filter(Boolean)
    if (els.length) staggerIn(els, { stagger: 0.15, y: 12 })
  }, [])

  return (
    <div className="flex-1 flex items-center justify-center px-8">
      <div className="w-full max-w-[800px] bg-surface border border-hairline rounded-lg p-8">
        {/* Header */}
        <div className="flex justify-between items-center mb-10">
          <h2 className="text-title-md text-ink">AI 思考过程</h2>
          <span className="text-caption text-primary">正在深度解析中...</span>
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-hairline rounded-full mb-12 relative overflow-hidden">
          <div
            className="h-full bg-primary rounded-full"
            style={{ animation: 'grow 3s ease-in-out forwards', width: '0%' }}
          />
        </div>

        {/* Log entries */}
        <div className="space-y-6">
          {MOCK_LOGS.map((log, i) => (
            <div
              key={i}
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
                {log.status === 'done' && log.text.includes('：') ? (
                  <>
                    {log.text.split('：')[0]}：
                    <span className="text-primary">{log.text.split('：').slice(1).join('：')}</span>
                  </>
                ) : (
                  log.text
                )}
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

      <style>{`
        @keyframes grow {
          to { width: 75%; }
        }
      `}</style>
    </div>
  )
}
