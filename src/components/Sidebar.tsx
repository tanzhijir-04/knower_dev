import { useState, useEffect, useRef } from 'react'
import type { Page } from '../App'
import type { Message } from '../types/electron'
import logoSvg from '../../assets/logo-sidebar.svg?url'

interface SidebarProps {
  currentPage: Page
  onNavigate: (page: Page) => void
  onOpenConversation?: (id: number) => void
  conversationVersion?: number
}

const navItems: { id: Page; icon: string; label: string }[] = [
  { id: 'chat', icon: 'chat_bubble', label: '创作台' },
  { id: 'data', icon: 'analytics', label: '数据分析' },
  { id: 'topics', icon: 'grid_view', label: '灵感库' },
  { id: 'settings', icon: 'settings', label: '设置' },
]

interface Conversation {
  id: number
  title: string
  isPinned?: number
  createdAt: string
  updatedAt: string
}

// ---- Context Menu ----

function ContextMenu({ x, y, onClose, onRename, onPin, onExport, onDelete, isPinned }: {
  x: number; y: number; onClose: () => void; isPinned?: number
  onRename: () => void; onPin: () => void; onExport: () => void; onDelete: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    setTimeout(() => {
      window.addEventListener('mousedown', close)
      window.addEventListener('contextmenu', close)
    }, 0)
    return () => { window.removeEventListener('mousedown', close); window.removeEventListener('contextmenu', close) }
  }, [onClose])

  const items = [
    { icon: 'edit', label: '重命名', onClick: onRename },
    { icon: 'push_pin', label: isPinned ? '取消置顶' : '置顶到顶部', onClick: onPin },
    { icon: 'download', label: '导出对话记录', onClick: onExport },
    { icon: 'delete', label: '删除', onClick: onDelete, danger: true },
  ]

  return (
    <div
      ref={ref}
      className="fixed z-50 bg-surface-low border border-outline-variant rounded-xl shadow-xl py-1 min-w-[160px]"
      style={{ left: x, top: y }}
      onClick={e => e.stopPropagation()}
    >
      {items.map((item, i) => (
        <div key={i}>
          {i === items.length - 1 && <div className="h-px bg-outline-variant mx-2 my-1" />}
          <button
            onClick={() => { item.onClick(); onClose() }}
            className={`w-full px-3 py-2 text-left text-xs flex items-center gap-2 hover:bg-surface-container transition-colors ${
              item.danger ? 'text-red-400 hover:bg-red-500/10' : 'text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[14px]">{item.icon}</span>
            {item.label}
          </button>
        </div>
      ))}
    </div>
  )
}

// ---- Conversation Item ----

function ConversationItem({
  conv, isActive, isEditing, editingTitle, onEditTitleChange,
  onSelect, onEdit, onConfirmEdit, onCancelEdit,
  onContextMenu, onTogglePin, onDelete, onExport,
}: {
  conv: Conversation
  isActive: boolean
  isEditing: boolean
  editingTitle: string
  onEditTitleChange: (t: string) => void
  onSelect: () => void
  onEdit: () => void
  onConfirmEdit: () => void
  onCancelEdit: () => void
  onContextMenu: (e: React.MouseEvent) => void
  onTogglePin: () => void
  onDelete: () => void
  onExport: () => void
}) {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      className={`group relative flex items-center gap-2 px-3 py-2 mx-1 rounded-lg cursor-pointer transition-colors ${
        isActive ? 'bg-surface-container' : 'hover:bg-surface-container/50'
      }`}
      onClick={onSelect}
      onContextMenu={(e) => { e.preventDefault(); onContextMenu(e) }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span className="material-symbols-outlined text-[14px] text-mute shrink-0">chat_bubble</span>

      {isEditing ? (
        <input
          autoFocus
          value={editingTitle}
          onChange={(e) => onEditTitleChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') onConfirmEdit()
            if (e.key === 'Escape') onCancelEdit()
          }}
          onBlur={onConfirmEdit}
          className="flex-1 bg-surface-high border border-primary/50 rounded px-2 py-0.5 text-xs text-on-surface outline-none"
          onClick={(e) => e.stopPropagation()}
        />
      ) : (
        <span className="text-xs text-on-surface truncate flex-1">{conv.title}</span>
      )}

      {hovered && !isEditing && (
        <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
          <button onClick={onTogglePin} className="p-1 rounded text-mute hover:text-on-surface hover:bg-surface-high transition-colors" title={conv.isPinned ? '取消置顶' : '置顶'}>
            <span className={`material-symbols-outlined text-[12px] ${conv.isPinned ? 'text-primary' : ''}`}>push_pin</span>
          </button>
          <button onClick={onEdit} className="p-1 rounded text-mute hover:text-on-surface hover:bg-surface-high transition-colors" title="重命名">
            <span className="material-symbols-outlined text-[12px]">edit</span>
          </button>
          <button onClick={(e) => onContextMenu(e)} className="p-1 rounded text-mute hover:text-on-surface hover:bg-surface-high transition-colors" title="更多">
            <span className="material-symbols-outlined text-[12px]">more_horiz</span>
          </button>
        </div>
      )}

      {!hovered && conv.isPinned === 1 && !isEditing && (
        <span className="material-symbols-outlined text-[10px] text-primary shrink-0">push_pin</span>
      )}
    </div>
  )
}

// ---- Sidebar ----

export default function Sidebar({ currentPage, onNavigate, onOpenConversation, conversationVersion }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; conv: Conversation } | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [activeConversationId, setActiveConversationId] = useState<number | null>(null)
  const [theme, setTheme] = useState<'dark' | 'light' | 'system'>('dark')
  const width = collapsed ? 56 : 240

  const handleThemeChange = (newTheme: 'dark' | 'light' | 'system') => {
    setTheme(newTheme)
    const root = document.documentElement
    root.classList.remove('theme-dark', 'theme-light')
    if (newTheme === 'system') {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      root.classList.add(prefersDark ? 'theme-dark' : 'theme-light')
    } else {
      root.classList.add(`theme-${newTheme}`)
    }
    window.electronAPI?.setStore('theme', newTheme)
  }

  useEffect(() => {
    window.electronAPI?.getStore('theme').then((saved) => {
      if (saved) handleThemeChange(saved as 'dark' | 'light' | 'system')
    })
  }, [])

  const loadConversations = () => {
    window.electronAPI?.listConversations().then((list: Conversation[]) => {
      setConversations(list || [])
    }).catch(() => {})
  }

  useEffect(() => {
    if (currentPage !== 'chat' || collapsed) return
    loadConversations()
  }, [currentPage, collapsed, conversationVersion])

  const filteredConversations = conversations.filter(conv =>
    conv.title.toLowerCase().includes(searchQuery.toLowerCase())
  )
  const pinned = filteredConversations.filter(c => c.isPinned)
  const recent = filteredConversations.filter(c => !c.isPinned)

  const handleConfirmRename = async () => {
    if (editingId && editingTitle.trim()) {
      await window.electronAPI?.renameConversation(editingId, editingTitle.trim())
      loadConversations()
    }
    setEditingId(null)
  }

  const handleTogglePin = async (id: number) => {
    await window.electronAPI?.togglePinConversation(id)
    loadConversations()
  }

  const handleDeleteConversation = async (id: number) => {
    if (!confirm('确定删除这个对话？')) return
    await window.electronAPI?.deleteConversation(id)
    loadConversations()
  }

  const handleExportConversation = async (conv: Conversation) => {
    const messages: Message[] = await window.electronAPI?.getMessages(conv.id) || []
    if (!messages.length) return

    const text = messages.map(m => {
      const role = m.role === 'user' ? '用户' : '助手'
      return `[${role}]\n${m.content}\n`
    }).join('\n---\n\n')

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${conv.title || '对话'}_${new Date().toISOString().slice(0, 10)}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleOpenConversation = (id: number) => {
    setActiveConversationId(id)
    onOpenConversation?.(id)
  }

  const renderConversationItem = (conv: Conversation) => (
    <ConversationItem
      key={conv.id}
      conv={conv}
      isActive={activeConversationId === conv.id}
      isEditing={editingId === conv.id}
      editingTitle={editingTitle}
      onEditTitleChange={setEditingTitle}
      onSelect={() => handleOpenConversation(conv.id)}
      onEdit={() => { setEditingId(conv.id); setEditingTitle(conv.title) }}
      onConfirmEdit={handleConfirmRename}
      onCancelEdit={() => setEditingId(null)}
      onContextMenu={(e) => setContextMenu({ x: e.clientX, y: e.clientY, conv })}
      onTogglePin={() => handleTogglePin(conv.id)}
      onDelete={() => handleDeleteConversation(conv.id)}
      onExport={() => handleExportConversation(conv)}
    />
  )

  return (
    <aside
      className="h-full border-r border-border/50 flex flex-col shrink-0 transition-all duration-250 bg-sidebar"
      style={{ width }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-border/30">
        <img src={logoSvg} alt="知更" className="w-8 h-8 rounded-lg shrink-0" />
        <span className={`text-sm font-semibold text-on-surface whitespace-nowrap overflow-hidden transition-all duration-200 ${collapsed ? 'w-0 opacity-0' : 'w-auto opacity-100 delay-150'}`}>
          知更 Knower
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex flex-col gap-0.5 px-2 pt-3">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onNavigate(item.id)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left ${
              currentPage === item.id
                ? 'bg-surface-container text-primary border-l-2 border-primary'
                : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container/50 border-l-2 border-transparent'
            }`}
          >
            <span className="material-symbols-outlined text-[20px] shrink-0">{item.icon}</span>
            <span className={`text-sm whitespace-nowrap overflow-hidden transition-all duration-200 ${collapsed ? 'w-0 opacity-0' : 'w-auto opacity-100 delay-100'}`}>
              {item.label}
            </span>
          </button>
        ))}
      </nav>

      {/* Conversation history (chat page only) */}
      {currentPage === 'chat' && (
        <div className={`flex-1 flex flex-col mt-4 overflow-hidden transition-all duration-200 ${collapsed ? 'w-0 opacity-0 pointer-events-none' : 'w-auto opacity-100 delay-100'}`}>
          {/* Search box */}
          <div className="px-2 mb-2">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-2 top-1/2 -translate-y-1/2 text-[14px] text-mute">search</span>
              <input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="搜索对话..."
                className="w-full bg-surface-container rounded-lg pl-7 pr-3 py-1.5 text-[11px] text-on-surface placeholder:text-mute outline-none border border-transparent focus:border-outline-variant/50 transition-colors"
              />
            </div>
          </div>

          {/* Conversation list */}
          <div className="flex-1 overflow-y-auto px-1">
            {pinned.length > 0 && (
              <div className="mb-2">
                <div className="px-3 mb-1 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[12px] text-mute">push_pin</span>
                  <span className="text-[10px] text-mute">置顶</span>
                </div>
                {pinned.map(conv => renderConversationItem(conv))}
              </div>
            )}

            {recent.length > 0 && (
              <div>
                <div className="px-3 mb-1">
                  <span className="text-[10px] text-mute">最近对话</span>
                </div>
                {recent.map(conv => renderConversationItem(conv))}
              </div>
            )}

            {filteredConversations.length === 0 && (
              <p className="text-[11px] text-mute px-3 py-2">
                {searchQuery ? '没有匹配的对话' : '暂无对话'}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Bottom bar: theme toggle + collapse */}
      <div className="px-2 py-3 border-t border-border/30 space-y-2">
        {/* Theme toggle — expanded */}
        {!collapsed && (
          <div className="flex items-center justify-center gap-1">
            {([
              { mode: 'light' as const, icon: 'light_mode', tip: '浅色模式' },
              { mode: 'dark' as const, icon: 'dark_mode', tip: '深色模式' },
              { mode: 'system' as const, icon: 'computer', tip: '跟随系统' },
            ]).map(t => (
              <button
                key={t.mode}
                onClick={() => handleThemeChange(t.mode)}
                className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                  theme === t.mode ? 'bg-primary/20 text-primary' : 'text-mute hover:text-on-surface hover:bg-surface-container'
                }`}
                title={t.tip}
              >
                <span className="material-symbols-outlined text-[16px]">{t.icon}</span>
              </button>
            ))}
          </div>
        )}

        {/* Theme toggle — collapsed */}
        {collapsed && (
          <div className="flex justify-center">
            <button
              onClick={() => handleThemeChange(theme === 'dark' ? 'light' : theme === 'light' ? 'system' : 'dark')}
              className="w-8 h-8 rounded-full flex items-center justify-center text-mute hover:text-on-surface hover:bg-surface-container transition-colors"
              title={theme === 'dark' ? '切换到浅色' : theme === 'light' ? '切换到跟随系统' : '切换到深色'}
            >
              <span className="material-symbols-outlined text-[16px]">
                {theme === 'dark' ? 'light_mode' : theme === 'light' ? 'computer' : 'dark_mode'}
              </span>
            </button>
          </div>
        )}

        {/* Collapse button */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full py-2 rounded-lg text-mute hover:text-on-surface hover:bg-surface-container/50 transition-colors"
        >
          <span className={`material-symbols-outlined text-[18px] transition-transform ${collapsed ? 'rotate-180' : ''}`}>
            chevron_left
          </span>
        </button>
      </div>

      {/* Context menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          isPinned={contextMenu.conv.isPinned}
          onClose={() => setContextMenu(null)}
          onRename={() => { setEditingId(contextMenu.conv.id); setEditingTitle(contextMenu.conv.title); setContextMenu(null) }}
          onPin={() => { handleTogglePin(contextMenu.conv.id); setContextMenu(null) }}
          onExport={() => { handleExportConversation(contextMenu.conv); setContextMenu(null) }}
          onDelete={() => { handleDeleteConversation(contextMenu.conv.id); setContextMenu(null) }}
        />
      )}
    </aside>
  )
}
