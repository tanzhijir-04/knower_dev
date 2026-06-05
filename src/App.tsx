import { useState, useEffect, useRef, useCallback } from 'react'
import Sidebar from './components/Sidebar'
import ChatView from './components/ChatView'
import TopicsView from './components/TopicsView'
import DataView from './components/DataView'
import SettingsView from './components/SettingsView'
import TrendingView from './components/TrendingView'
import CalendarView from './components/CalendarView'
import ErrorBoundary from './components/ErrorBoundary'
import { ToastProvider } from './contexts/ToastContext'
import { PlatformProvider } from './contexts/PlatformContext'
import { AccountProvider } from './contexts/AccountContext'
import { pageEnter, pageExit } from './lib/gsap'
import { Minus, Square, X } from '@phosphor-icons/react'
import type { TopicSuggestion } from './types/electron'

export type Page = 'chat' | 'topics' | 'data' | 'settings' | 'trending' | 'calendar'

const PAGE_ORDER: Page[] = ['chat', 'data', 'trending', 'calendar', 'topics', 'settings']

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('chat')
  const [pendingTopic, setPendingTopic] = useState<TopicSuggestion | null>(null)
  const [openConversationId, setOpenConversationId] = useState<number | null>(null)
  const [conversationVersion, setConversationVersion] = useState(0)
  const prevPageRef = useRef<Page>('chat')
  const pageRefs = useRef<Record<Page, HTMLDivElement | null>>({
    chat: null, data: null, topics: null, settings: null, trending: null, calendar: null,
  })
  const animatingRef = useRef(false)

  const navigateTo = useCallback((page: Page) => {
    if (page === currentPage || animatingRef.current) return
    animatingRef.current = true

    const oldPage = currentPage
    const oldEl = pageRefs.current[oldPage]
    const newEl = pageRefs.current[page]
    if (!oldEl || !newEl) { setCurrentPage(page); animatingRef.current = false; return }

    const oldIdx = PAGE_ORDER.indexOf(oldPage)
    const newIdx = PAGE_ORDER.indexOf(page)
    const direction = newIdx > oldIdx ? 'right' : 'left'

    // Show new page underneath
    newEl.style.display = 'flex'
    newEl.style.opacity = '0'

    // Animate old page out, then new page in
    pageExit(oldEl, direction)
    pageEnter(newEl, direction)

    prevPageRef.current = oldPage
    setCurrentPage(page)

    setTimeout(() => { animatingRef.current = false }, 350)
  }, [currentPage])

  // Listen for topic-to-chat events from main process
  useEffect(() => {
    const api = window.electronAPI
    if (!api) return
    const unsub = api.onTopicToChat((raw) => {
      try {
        const topic = JSON.parse(raw)
        setPendingTopic(topic)
        navigateTo('chat')
      } catch { /* ignore */ }
    })
    return unsub
  }, [navigateTo])

  const handleSendTopicToChat = (topic: TopicSuggestion) => {
    setPendingTopic(topic)
    navigateTo('chat')
  }

  const isWindows = window.electronAPI?.platform !== 'darwin'

  const pageStyle = (page: Page): React.CSSProperties => ({
    display: currentPage === page ? 'flex' : 'none',
    flex: 1,
    flexDirection: 'column',
    overflow: 'hidden',
  })

  return (
    <ErrorBoundary>
    <ToastProvider>
      <PlatformProvider>
        <AccountProvider>
          <div className="flex h-screen bg-canvas">
            <Sidebar
              currentPage={currentPage}
              onNavigate={navigateTo}
              conversationVersion={conversationVersion}
              onOpenConversation={(id) => {
                setOpenConversationId(id)
                navigateTo('chat')
              }}
            />
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Windows/Linux 标题栏：拖拽区域 + 窗口按钮，同级 flex row */}
              {isWindows && (
                <div className="h-12 flex items-stretch shrink-0 border-b border-hairline">
                  <div className="titlebar-drag flex-1" />
                  <div className="flex items-center gap-0.5 px-2 shrink-0 no-drag">
                    <button onClick={() => window.electronAPI?.minimizeWindow()}
                      className="w-11 h-8 rounded flex items-center justify-center text-muted hover:bg-hairline hover:text-ink transition-colors">
                      <Minus className="w-4 h-4" />
                    </button>
                    <button onClick={() => window.electronAPI?.maximizeWindow()}
                      className="w-11 h-8 rounded flex items-center justify-center text-muted hover:bg-hairline hover:text-ink transition-colors">
                      <Square className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => window.electronAPI?.closeWindow()}
                      className="w-11 h-8 rounded flex items-center justify-center text-muted hover:bg-red-500 hover:text-white transition-colors">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* 所有页面始终挂载，用 display 控制显示 */}
              <div ref={el => { pageRefs.current.chat = el }} style={pageStyle('chat')}>
                <ChatView
                  pendingTopic={pendingTopic}
                  onTopicConsumed={() => setPendingTopic(null)}
                  initialConversationId={openConversationId}
                  onConversationOpened={() => setOpenConversationId(null)}
                  onNavigate={navigateTo}
                  onConversationChange={() => setConversationVersion(v => v + 1)}
                />
              </div>
              <div ref={el => { pageRefs.current.data = el }} style={pageStyle('data')}>
                <DataView />
              </div>
              <div ref={el => { pageRefs.current.trending = el }} style={pageStyle('trending')}>
                <TrendingView />
              </div>
              <div ref={el => { pageRefs.current.calendar = el }} style={pageStyle('calendar')}>
                <CalendarView onNavigate={navigateTo} />
              </div>
              <div ref={el => { pageRefs.current.topics = el }} style={pageStyle('topics')}>
                <TopicsView onSendToChat={handleSendTopicToChat} />
              </div>
              <div ref={el => { pageRefs.current.settings = el }} style={pageStyle('settings')}>
                <SettingsView />
              </div>
            </div>
          </div>
        </AccountProvider>
      </PlatformProvider>
    </ToastProvider>
    </ErrorBoundary>
  )
}
