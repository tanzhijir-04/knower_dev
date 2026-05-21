export interface Conversation {
  id: number
  title: string
  createdAt: string
  updatedAt: string
}

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt?: string
}

export interface ElectronAPI {
  // 设置
  getStore: (key: string) => Promise<unknown>
  getStoreAll: () => Promise<Record<string, unknown>>
  setStore: (key: string, value: unknown) => Promise<boolean>
  // Agent
  runAgent: (script: string, platforms: string[]) => Promise<void>
  stopAgent: () => Promise<boolean>
  onAgentEvent: (callback: (event: string) => void) => () => void
  // 会话
  listConversations: () => Promise<Conversation[]>
  createConversation: (title: string) => Promise<number>
  deleteConversation: (id: number) => Promise<boolean>
  renameConversation: (id: number, title: string) => Promise<boolean>
  getMessages: (conversationId: number) => Promise<Message[]>
  addMessage: (conversationId: number, role: string, content: string) => Promise<boolean>
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}

export {}
