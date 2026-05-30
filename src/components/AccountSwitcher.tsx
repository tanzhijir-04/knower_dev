import { useState, useRef, useEffect } from 'react'
import { CaretDown, Check, Plus, GearSix } from '@phosphor-icons/react'
import { useAccount } from '../contexts/AccountContext'
import type { Page } from '../App'

const PLATFORM_LABELS: Record<string, string> = {
  bili: 'B站',
  dy: '抖音',
  xhs: '小红书',
  wb: '微博',
}

const PLATFORM_COLORS: Record<string, string> = {
  bili: 'bg-[#00a1d6]',
  dy: 'bg-[#fe2c55]',
  xhs: 'bg-[#ff2442]',
  wb: 'bg-[#ff8200]',
}

interface Props {
  onNavigate?: (page: Page) => void
}

export default function AccountSwitcher({ onNavigate }: Props) {
  const { accounts, activeAccount, switchAccount, loading } = useAccount()
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    setTimeout(() => window.addEventListener('mousedown', close), 0)
    return () => window.removeEventListener('mousedown', close)
  }, [open])

  if (loading) return null

  // 空状态
  if (accounts.length === 0) {
    return (
      <button
        onClick={() => onNavigate?.('settings')}
        className="w-full px-3 py-2 text-xs text-muted hover:text-ink hover:bg-canvas rounded-lg transition-colors flex items-center gap-2"
      >
        <Plus className="w-3.5 h-3.5" />
        <span>设置创作者账号</span>
      </button>
    )
  }

  const platform = activeAccount?.platform || 'bili'
  const platformLabel = PLATFORM_LABELS[platform] || platform

  return (
    <div ref={ref} className="relative">
      {/* 当前账号按钮 */}
      <button
        onClick={() => setOpen(!open)}
        className="w-full px-3 py-2 text-xs text-ink hover:bg-canvas rounded-lg transition-colors flex items-center gap-2"
      >
        <span className={`w-2 h-2 rounded-full ${PLATFORM_COLORS[platform] || 'bg-muted'}`} />
        <span className="flex-1 text-left truncate">{activeAccount?.name || '未设置'}</span>
        <span className="text-muted-soft text-[10px]">{platformLabel}</span>
        <CaretDown className={`w-3 h-3 text-muted transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* 下拉菜单 */}
      {open && (
        <div className="absolute left-0 right-0 top-full mt-1 bg-surface border border-hairline rounded-xl py-1 z-50 shadow-lg">
          {accounts.map(acc => (
            <button
              key={acc.id}
              onClick={() => { switchAccount(acc.id); setOpen(false) }}
              className="w-full px-3 py-2 text-left text-xs hover:bg-canvas transition-colors flex items-center gap-2"
            >
              <span className={`w-2 h-2 rounded-full ${PLATFORM_COLORS[acc.platform] || 'bg-muted'}`} />
              <span className="flex-1 truncate">{acc.name}</span>
              <span className="text-muted-soft text-[10px]">{PLATFORM_LABELS[acc.platform] || acc.platform}</span>
              {acc.id === activeAccount?.id && <Check className="w-3 h-3 text-primary" />}
            </button>
          ))}
          <div className="h-px bg-hairline mx-2 my-1" />
          <button
            onClick={() => { onNavigate?.('settings'); setOpen(false) }}
            className="w-full px-3 py-2 text-left text-xs text-muted hover:bg-canvas transition-colors flex items-center gap-2"
          >
            <GearSix className="w-3.5 h-3.5" />
            <span>管理账号</span>
          </button>
        </div>
      )}
    </div>
  )
}
