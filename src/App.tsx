import { useState } from 'react'
import Sidebar from './components/Sidebar'
import ChatView from './components/ChatView'
import TopicsView from './components/TopicsView'
import DataView from './components/DataView'
import SettingsView from './components/SettingsView'

export type Page = 'chat' | 'topics' | 'data' | 'settings'

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>('chat')

  const renderPage = () => {
    switch (currentPage) {
      case 'chat':
        return <ChatView />
      case 'topics':
        return <TopicsView />
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
