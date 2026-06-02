import { useState } from 'react'
import { TrendUp, Lightbulb, Target, Books } from '@phosphor-icons/react'
import type { ComponentType } from 'react'

const MODES: { key: string; label: string; Icon: ComponentType<{ className?: string }> }[] = [
  { key: 'trend', label: '趋势追热', Icon: TrendUp },
  { key: 'differentiated', label: '差异化切入', Icon: Lightbulb },
  { key: 'competitor', label: '竞品对标', Icon: Target },
  { key: 'series', label: '系列化规划', Icon: Books },
]

interface Props {
  onSubmit: (input: string, mode: string) => void
}

export default function InitialState({ onSubmit }: Props) {
  const [input, setInput] = useState('')
  const [selectedMode, setSelectedMode] = useState('differentiated')

  const handleSubmit = (mode: 'think' | 'generate') => {
    const text = mode === 'think'
      ? input || '帮我分析一下最近有什么好选题方向'
      : input || '帮我生成几个选题'
    onSubmit(text, selectedMode)
  }

  return (
    <div className="flex-1 flex items-center justify-center px-8">
      <div className="w-full max-w-[800px] space-y-8">
        {/* Textarea */}
        <div className="bg-surface border border-hairline rounded-lg p-6 focus-within:border-primary/50 transition-colors">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="输入一个想法、关键词，或直接问我「最近有什么好选题」"
            className="w-full bg-transparent border-none focus:ring-0 text-body-md resize-none placeholder-muted-soft outline-none min-h-[120px]"
            rows={4}
          />
        </div>

        {/* Quick action pills */}
        <div className="flex flex-wrap justify-center gap-3">
          {MODES.map((mode) => (
            <button
              key={mode.key}
              onClick={() => setSelectedMode(mode.key)}
              className={`flex items-center gap-2 px-5 py-2 rounded-md text-body-sm transition-all border ${
                selectedMode === mode.key
                  ? 'bg-primary/10 text-primary border-primary/50'
                  : 'bg-surface text-body border-hairline hover:border-primary/30 hover:bg-primary/5'
              }`}
            >
              <mode.Icon className="w-4 h-4" />
              {mode.label}
            </button>
          ))}
        </div>

        {/* Action buttons */}
        <div className="flex justify-center gap-4 pt-2">
          <button
            onClick={() => handleSubmit('think')}
            className="btn-primary px-8 py-3 h-auto text-button"
          >
            帮我想想
          </button>
          <button
            onClick={() => handleSubmit('generate')}
            className="px-8 py-3 h-auto text-button bg-transparent border border-hairline text-muted rounded-md hover:bg-surface transition-colors"
          >
            生成选题
          </button>
        </div>
      </div>
    </div>
  )
}
