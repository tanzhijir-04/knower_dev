import { useEffect, useRef } from 'react'
import { TrendUp, Lightbulb, Target, Books } from '@phosphor-icons/react'

interface Props {
  onSelect: (mode: string) => void
  onClose: () => void
}

const modes = [
  {
    key: 'trend',
    label: '趋势追热',
    desc: '追踪平台热点，快速切入',
    Icon: TrendUp,
  },
  {
    key: 'differentiated',
    label: '差异化切入',
    desc: '找蓝海方向，避开红海竞争',
    Icon: Lightbulb,
  },
  {
    key: 'competitor',
    label: '竞品对标',
    desc: '分析竞品选题，找到差异化机会',
    Icon: Target,
  },
  {
    key: 'series',
    label: '系列化规划',
    desc: '规划连载内容，提升用户粘性',
    Icon: Books,
  },
]

export default function ModeSelector({ onSelect, onClose }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  return (
    <div
      ref={ref}
      className="absolute right-0 top-full mt-1 w-64 bg-surface-low border border-hairline/30 rounded-xl shadow-lg overflow-hidden z-50"
    >
      <div className="px-3 py-2 border-b border-hairline/20">
        <span className="text-xs font-medium text-ink">选择选题策略</span>
      </div>
      <div className="py-1">
        {modes.map(mode => (
          <button
            key={mode.key}
            onClick={() => onSelect(mode.key)}
            className="w-full px-3 py-2.5 flex items-start gap-3 hover:bg-canvas-soft transition-colors text-left"
          >
            <mode.Icon className="w-4 h-4 text-primary mt-0.5 shrink-0" weight="fill" />
            <div>
              <p className="text-xs font-medium text-ink">{mode.label}</p>
              <p className="text-[10px] text-muted mt-0.5">{mode.desc}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}
