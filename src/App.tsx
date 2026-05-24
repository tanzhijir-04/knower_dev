import { useState, useEffect } from 'react'
import Sidebar from './components/Sidebar'
import ChatView from './components/ChatView'
import TopicsView from './components/TopicsView'
import DataView from './components/DataView'
import SettingsView from './components/SettingsView'
import { ToastProvider } from './contexts/ToastContext'
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

  return (
    <ToastProvider>
      <div className="flex h-screen bg-background">
        <Sidebar
          currentPage={currentPage}
          onNavigate={setCurrentPage}
          conversationVersion={conversationVersion}
          onOpenConversation={(id) => {
            setOpenConversationId(id)
            setCurrentPage('chat')
          }}
        />
        <main className="flex-1 flex flex-col overflow-hidden pt-[48px]">
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
        </main>
      </div>
    </ToastProvider>
  )
}
