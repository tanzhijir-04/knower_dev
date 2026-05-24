import { useState, useEffect } from 'react'
import Sidebar from './components/Sidebar'
import ChatView from './components/ChatView'
import TopicsView from './components/TopicsView'
import DataView from './components/DataView'
import SettingsView from './components/SettingsView'
import type { TopicSuggestion } from './types/electron'

export type Page = 'chat' | 'topics' | 'data' | 'settings'

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('chat')
  const [pendingTopic, setPendingTopic] = useState<TopicSuggestion | null>(null)

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

  const renderPage = () => {
    switch (currentPage) {
      case 'chat':
        return <ChatView pendingTopic={pendingTopic} onTopicConsumed={() => setPendingTopic(null)} />
      case 'topics':
        return <TopicsView onSendToChat={handleSendTopicToChat} />
      case 'data':
        return <DataView />
      case 'settings':
        return <SettingsView />
    }
  }

  return (
    <div className="flex h-screen bg-background">
      <Sidebar currentPage={currentPage} onNavigate={setCurrentPage} />
      <main className="flex-1 flex flex-col overflow-hidden pt-[48px]">
        {renderPage()}
      </main>
    </div>
  )
}
