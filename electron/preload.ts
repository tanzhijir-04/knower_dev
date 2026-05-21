import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  // 设置
  getStore: (key: string) => ipcRenderer.invoke('get-store', key),
  getStoreAll: () => ipcRenderer.invoke('get-store-all'),
  setStore: (key: string, value: unknown) => ipcRenderer.invoke('set-store', key, value),
  // Agent
  runAgent: (script: string, platforms: string[]) =>
    ipcRenderer.invoke('agent-run', script, platforms),
  stopAgent: () => ipcRenderer.invoke('agent-stop'),
  onAgentEvent: (callback: (event: string) => void) => {
    const handler = (_event: unknown, data: string) => callback(data)
    ipcRenderer.on('agent-event', handler)
    return () => ipcRenderer.removeListener('agent-event', handler)
  },
  // 会话
  listConversations: () => ipcRenderer.invoke('conv-list'),
  createConversation: (title: string) => ipcRenderer.invoke('conv-create', title),
  deleteConversation: (id: number) => ipcRenderer.invoke('conv-delete', id),
  renameConversation: (id: number, title: string) => ipcRenderer.invoke('conv-rename', id, title),
  getMessages: (conversationId: number) => ipcRenderer.invoke('conv-messages', conversationId),
  addMessage: (conversationId: number, role: string, content: string) =>
    ipcRenderer.invoke('msg-add', conversationId, role, content),
})
