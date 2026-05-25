import { useState, useEffect } from 'react'
import Sidebar from './components/Sidebar'
import ChatView from './components/ChatView'
import TopicsView from './components/TopicsView'
import DataView from './components/DataView'
import SettingsView from './components/SettingsView'
import { ToastProvider } from './contexts/ToastContext'
import { PlatformProvider } from './contexts/PlatformContext'
import type { TopicSuggestion } from './types/electron'

export type Page = 'chat' | 'topics' | 'data' | 'settings'

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('chat')
  const [pendingTopic, setPendingTopic] = useState<TopicSuggestion | null>(null)
  const [openConversationId, setOpenConversationId] = useState<number | null>(null)
  const [conversationVersion, setConversationVersion] = useState(0)

  // Listen for topic-to-chat events from main process
  useEffect(() => {
    const api = window.electronAPI
    if (!api) return
    const unsub = api.onTopicToChat((raw) => {
      try {
        const topic = JSON.parse(raw)
        setPendingTopic(topic)
        setCurrentPage('chat')
      } catch { /* ignore */ }
    })
    return unsub
  }, [])

  const handleSendTopicToChat = (topic: TopicSuggestion) => {
    setPendingTopic(topic)
    setCurrentPage('chat')
  }

  const isWindows = window.electronAPI?.platform !== 'darwin'

  return (
    <ToastProvider>
      <PlatformProvider>
        <div className="flex h-screen bg-canvas">
          <Sidebar
            currentPage={currentPage}
            onNavigate={setCurrentPage}
            conversationVersion={conversationVersion}
            onOpenConversation={(id) => {
              setOpenConversationId(id)
              setCurrentPage('chat')
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
                    <span className="material-symbols-outlined text-[16px]">remove</span>
                  </button>
                  <button onClick={() => window.electronAPI?.maximizeWindow()}
                    className="w-11 h-8 rounded flex items-center justify-center text-muted hover:bg-hairline hover:text-ink transition-colors">
                    <span className="material-symbols-outlined text-[14px]">crop_square</span>
                  </button>
                  <button onClick={() => window.electronAPI?.closeWindow()}
                    className="w-11 h-8 rounded flex items-center justify-center text-muted hover:bg-red-500 hover:text-white transition-colors">
                    <span className="material-symbols-outlined text-[16px]">close</span>
                  </button>
                </div>
              </div>
            )}

            {/* 所有页面始终挂载，用 display 控制显示 */}
            <div style={{ display: currentPage === 'chat' ? 'flex' : 'none', flex: 1, flexDirection: 'column', overflow: 'hidden' }}>
              <ChatView
                pendingTopic={pendingTopic}
                onTopicConsumed={() => setPendingTopic(null)}
                initialConversationId={openConversationId}
                onConversationOpened={() => setOpenConversationId(null)}
                onNavigate={setCurrentPage}
                onConversationChange={() => setConversationVersion(v => v + 1)}
              />
            </div>
            <div style={{ display: currentPage === 'data' ? 'flex' : 'none', flex: 1, flexDirection: 'column', overflow: 'hidden' }}>
              <DataView />
            </div>
            <div style={{ display: currentPage === 'topics' ? 'flex' : 'none', flex: 1, flexDirection: 'column', overflow: 'hidden' }}>
              <TopicsView onSendToChat={handleSendTopicToChat} />
            </div>
            <div style={{ display: currentPage === 'settings' ? 'flex' : 'none', flex: 1, flexDirection: 'column', overflow: 'hidden' }}>
              <SettingsView />
            </div>
          </div>
        </div>
      </PlatformProvider>
    </ToastProvider>
  )
}
