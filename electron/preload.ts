import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  // 平台信息
  platform: process.platform,
  // 窗口控制
  minimizeWindow: () => ipcRenderer.invoke('window-minimize'),
  maximizeWindow: () => ipcRenderer.invoke('window-maximize'),
  closeWindow: () => ipcRenderer.invoke('window-close'),
  // 账号管理
  listAccounts: () => ipcRenderer.invoke('account-list'),
  getActiveAccount: () => ipcRenderer.invoke('account-get-active'),
  createAccount: (data: { name: string; platform: string; uid?: string; avatarUrl?: string; description?: string }) =>
    ipcRenderer.invoke('account-create', data),
  switchAccount: (id: string) => ipcRenderer.invoke('account-switch', id),
  updateAccount: (id: string, updates: Record<string, unknown>) => ipcRenderer.invoke('account-update', id, updates),
  deleteAccount: (id: string) => ipcRenderer.invoke('account-delete', id),
  // 设置
  getStore: (key: string) => ipcRenderer.invoke('get-store', key),
  getStoreAll: () => ipcRenderer.invoke('get-store-all'),
  setStore: (key: string, value: unknown) => ipcRenderer.invoke('set-store', key, value),
  // Agent
  runAgent: (script: string, platforms: string[], conversationId?: number) =>
    ipcRenderer.invoke('agent-run', script, platforms, conversationId),
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
  importDb: () => ipcRenderer.invoke('import-db'),
  checkLoginStates: () => ipcRenderer.invoke('check-login-states'),
  clearLoginState: (platform: string) => ipcRenderer.invoke('clear-login-state', platform),
  getCreators: () => ipcRenderer.invoke('get-creators'),
  deleteMessage: (id: number) => ipcRenderer.invoke('delete-message', id),
  searchMessages: (query: string) => ipcRenderer.invoke('search-messages', query),
  starCreator: (uid: string) => ipcRenderer.invoke('star-creator', uid),
  pinCreator: (uid: string) => ipcRenderer.invoke('pin-creator', uid),
  deleteCreator: (uid: string) => ipcRenderer.invoke('delete-creator', uid),
  exportSourceData: (sourceUid: string) => ipcRenderer.invoke('export-source-data', sourceUid),
  // 分类
  autoCategorize: (platform: string) => ipcRenderer.invoke('auto-categorize', platform),
  getCategories: (platform: string) => ipcRenderer.invoke('get-categories', platform),
  updateCategory: (contentId: string, category: string) => ipcRenderer.invoke('update-category', contentId, category),
  // API 连接测试
  testConnection: (settings: { provider: string; apiKey: string; baseUrl: string; model: string }) =>
    ipcRenderer.invoke('test-connection', settings),
  // 灵感库
  suggestTopics: (platform: string) => ipcRenderer.invoke('topics-suggest', platform),
  getTopicTrends: (platform: string) => ipcRenderer.invoke('topics-trends', platform),
  saveTopic: (topic: Record<string, unknown>) => ipcRenderer.invoke('topics-save', topic),
  getSavedTopics: (platform?: string) => ipcRenderer.invoke('topics-saved', platform),
  saveTopicHistory: (platform: string, mode: string, topics: Record<string, unknown>[]) =>
    ipcRenderer.invoke('topics-history-save', platform, mode, topics),
  getTopicHistory: (platform?: string, limit?: number) =>
    ipcRenderer.invoke('topics-history-list', platform, limit),
  starTopicHistory: (id: number) => ipcRenderer.invoke('topics-history-star', id),
  deleteTopicHistory: (id: number) => ipcRenderer.invoke('topics-history-delete', id),
  sendTopicToChat: (topic: Record<string, unknown>) => ipcRenderer.invoke('topic-to-chat', topic),
  onTopicToChat: (callback: (event: string) => void) => {
    const handler = (_event: unknown, data: string) => callback(data)
    ipcRenderer.on('topic-to-chat-event', handler)
    return () => ipcRenderer.removeListener('topic-to-chat-event', handler)
  },
  // 竞品管理
  addCompetitor: (platform: string, userId: string, nickname: string) =>
    ipcRenderer.invoke('competitor-add', platform, userId, nickname),
  removeCompetitor: (id: number) => ipcRenderer.invoke('competitor-remove', id),
  listCompetitors: (platform: string) => ipcRenderer.invoke('competitor-list', platform),
  // 全网热点
  fetchTrending: (platforms?: string[]) => ipcRenderer.invoke('trending-fetch', platforms),
  getTrendingSources: () => ipcRenderer.invoke('trending-sources'),
  setTrendingConfig: (config: { sources: string[]; order: string[] }) => ipcRenderer.invoke('trending-set-config', config),
  openUrl: (url: string) => ipcRenderer.invoke('open-url', url),
})
