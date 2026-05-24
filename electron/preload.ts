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
  submitAgentForm: (data: Record<string, string>) => ipcRenderer.invoke('agent-submit-form', data),
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
  togglePinConversation: (id: number) => ipcRenderer.invoke('conv-toggle-pin', id),
  getMessages: (conversationId: number) => ipcRenderer.invoke('conv-messages', conversationId),
  addMessage: (conversationId: number, role: string, content: string) =>
    ipcRenderer.invoke('msg-add', conversationId, role, content),
  // 爬虫
  runCrawler: (platform: string, keywords: string, options?: Record<string, unknown>) =>
    ipcRenderer.invoke('crawler-run', platform, keywords, options || {}),
  onCrawlerEvent: (callback: (event: string) => void) => {
    const handler = (_event: unknown, data: string) => callback(data)
    ipcRenderer.on('crawler-event', handler)
    return () => ipcRenderer.removeListener('crawler-event', handler)
  },
  listCrawlTasks: () => ipcRenderer.invoke('crawler-tasks'),
  getCrawlContent: (taskId: number) => ipcRenderer.invoke('crawler-content', taskId),
  getCrawlCreators: (taskId: number) => ipcRenderer.invoke('crawler-creators', taskId),
  analyzeVideoData: (platform: string, sourceUid?: string) => ipcRenderer.invoke('analyze-video-data', platform, sourceUid),
  getAllCrawlContent: (platform?: string) => ipcRenderer.invoke('get-all-crawl-content', platform),
  getSourceDetail: (sourceUid: string, platform?: string) => ipcRenderer.invoke('source-detail', sourceUid, platform),
  getKeywordDetail: (keyword: string, platform?: string) => ipcRenderer.invoke('keyword-detail', keyword, platform),
  // 来源
  getSources: (platform: string) => ipcRenderer.invoke('get-sources', platform),
  getVideosBySource: (platform: string, sourceUid: string) => ipcRenderer.invoke('get-videos-by-source', platform, sourceUid),
  // 创作者
  cleanOldData: () => ipcRenderer.invoke('clean-old-data'),
  getCreators: () => ipcRenderer.invoke('get-creators'),
  deleteMessage: (id: number) => ipcRenderer.invoke('delete-message', id),
  starCreator: (uid: string) => ipcRenderer.invoke('star-creator', uid),
  pinCreator: (uid: string) => ipcRenderer.invoke('pin-creator', uid),
  deleteCreator: (uid: string) => ipcRenderer.invoke('delete-creator', uid),
  exportSourceData: (sourceUid: string) => ipcRenderer.invoke('export-source-data', sourceUid),
  // 分类
  autoCategorize: (platform: string) => ipcRenderer.invoke('auto-categorize', platform),
  getCategories: (platform: string) => ipcRenderer.invoke('get-categories', platform),
  updateCategory: (contentId: string, category: string) => ipcRenderer.invoke('update-category', contentId, category),
  // 灵感库
  suggestTopics: (platform: string) => ipcRenderer.invoke('topics-suggest', platform),
  getTopicTrends: (platform: string) => ipcRenderer.invoke('topics-trends', platform),
  saveTopic: (topic: Record<string, unknown>) => ipcRenderer.invoke('topics-save', topic),
  getSavedTopics: (platform?: string) => ipcRenderer.invoke('topics-saved', platform),
  sendTopicToChat: (topic: Record<string, unknown>) => ipcRenderer.invoke('topic-to-chat', topic),
  onTopicToChat: (callback: (event: string) => void) => {
    const handler = (_event: unknown, data: string) => callback(data)
    ipcRenderer.on('topic-to-chat-event', handler)
    return () => ipcRenderer.removeListener('topic-to-chat-event', handler)
  },
})
