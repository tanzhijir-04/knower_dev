export interface Account {
  id: string
  name: string
  platform: string
  uid: string
  avatarUrl: string
  description: string
  isActive: boolean
  userId: string
  createdAt: string
  updatedAt: string
}

export interface AccountData {
  name: string
  platform: string
  uid?: string
  avatarUrl?: string
  description?: string
}

export interface Conversation {
  id: number
  title: string
  isPinned?: number
  createdAt: string
  updatedAt: string
}

export interface ToolCallInfo {
  name: string
  input: Record<string, unknown>
  status: 'running' | 'success' | 'error'
  result?: string
  startTime: number
  endTime?: number
}

export interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt?: string
  toolCalls?: ToolCallInfo[]
  toolAnalysis?: Record<string, unknown>
  toolResult?: Record<string, unknown>
}

export interface CrawlTask {
  id: number
  platform: string
  keywords: string
  crawlerType: string
  status: string
  createdAt: string
  completedAt: string | null
}

export interface CrawlContent {
  id: number
  platform: string
  contentType: string
  contentId: string
  title: string
  desc: string
  authorName: string
  authorId: string
  likeCount: number
  commentCount: number
  shareCount: number
  playCount: number
  createdAt: string
  category: string
  sourceUid: string
  sourceName: string
  rawJson?: Record<string, string>
}

export interface CrawlerResult {
  success: boolean
  taskId?: number
  count?: number
  error?: string
  sourceUid?: string
  sourceName?: string
}

export interface CrawlCreator {
  id: number
  platform: string
  userId: string
  nickname: string
  avatar: string
  totalFans: number
  totalLiked: number
  totalPlay: number
  totalNote: number
  description: string
  ipLocation: string
  fetchedAt: string
}

export interface VideoAnalysis {
  overview: {
    totalVideos: number
    totalPlay: number
    totalLike: number
    totalComment: number
    totalShare: number
    totalCoin: number
    totalFavorite: number
    totalDanmaku: number
    avgPlay: number
    avgLike: number
    avgEngagement: number
  }
  fans?: number
  topTopics?: { topic: string; avgPlay: number; count: number }[]
  titlePatterns?: string
  bestDuration?: string
  bestTime?: string
  topByEngagement?: { title: string; playCount: number; engagementRate: number }[]
  suggestions?: string[]
}

export interface CategoryInfo {
  category: string
  count: number
}

export interface AutoCategorizeResult {
  success: boolean
  categorized?: number
  total?: number
  message?: string
  error?: string
}

export interface SourceInfo {
  sourceUid: string
  sourceName: string
  count: number
  type: 'creator' | 'keyword' | 'unknown'
  avatarUrl: string
  isStarred: number
  isPinned: number
  totalFans: number
}

export interface SourceDetailItem {
  title: string
  desc: string
  likeCount: number
  commentCount: number
  playCount: number
  shareCount: number
  createdAt: string
  category: string
  coinCount: number
  favoriteCount: number
  sourceName?: string
  authorName?: string
}

export interface CreatorInfo {
  uid: string
  name: string
  avatarUrl: string
  isStarred: number
  isPinned: number
  lastFetchedAt: string
}

export interface Competitor {
  id: number
  platform: string
  userId: string
  nickname: string
  lastCheckedAt?: string
  createdAt?: string
}

export interface TopicSuggestion {
  title: string
  reason: string
  source: string
  estimatedPerformance: string
  tags: string[]
  platforms?: string[]
  scores?: {
    heat: number
    competition: number
    feasibility: number
    fit: number
    urgency: number
  }
  overallScore?: number
  urgency?: string
  competitionLevel?: string
}

export interface SavedTopic extends TopicSuggestion {
  id: number
  platform: string
  fullData: Record<string, unknown>
  createdAt: string
}

export interface TopicHistory {
  id: number
  platform: string
  mode: string
  topics: TopicSuggestion[]
  topicCount: number
  isStarred: number
  createdAt: string
}

export interface TrendData {
  title: string
  desc: string
  authorName: string
  playCount: number
  likeCount: number
  commentCount: number
  createdAt: string
}

export interface TrendingItem {
  id: string
  title: string
  url: string
  platform: string
  extra?: {
    author?: string
    view?: number
    like?: number
    desc?: string
    pubDate?: number
    hotValue?: string
    flag?: string
    info?: string
  }
}

export interface TrendingSource {
  name: string
  column: string
  desc?: string
}

export interface TrendingConfig {
  sources: string[]
  order: string[]
  lastRefresh: number
}

export interface ElectronAPI {
  // 平台信息
  platform: string
  // 窗口控制
  minimizeWindow: () => Promise<void>
  maximizeWindow: () => Promise<void>
  closeWindow: () => Promise<void>
  // 账号管理
  listAccounts: () => Promise<Account[]>
  getActiveAccount: () => Promise<Account | null>
  createAccount: (data: AccountData) => Promise<string>
  switchAccount: (id: string) => Promise<boolean>
  updateAccount: (id: string, updates: Partial<AccountData>) => Promise<boolean>
  deleteAccount: (id: string) => Promise<boolean>
  // 设置
  getStore: (key: string) => Promise<unknown>
  getStoreAll: () => Promise<Record<string, unknown>>
  setStore: (key: string, value: unknown) => Promise<boolean>
  // Agent
  runAgent: (script: string, platforms: string[], conversationId?: number) => Promise<void>
  stopAgent: () => Promise<boolean>
  submitAgentForm: (data: Record<string, string>) => Promise<boolean>
  onAgentEvent: (callback: (event: string) => void) => () => void
  // 会话
  convList?: () => Promise<Conversation[]>
  listConversations: () => Promise<Conversation[]>
  createConversation: (title: string) => Promise<number>
  deleteConversation: (id: number) => Promise<boolean>
  renameConversation: (id: number, title: string) => Promise<boolean>
  togglePinConversation: (id: number) => Promise<boolean>
  getMessages: (conversationId: number) => Promise<Message[]>
  addMessage: (conversationId: number, role: string, content: string) => Promise<boolean>
  // 爬虫
  runCrawler: (platform: string, keywords: string, options?: Record<string, unknown>) => Promise<CrawlerResult>
  onCrawlerEvent: (callback: (event: string) => void) => () => void
  listCrawlTasks: () => Promise<CrawlTask[]>
  getCrawlContent: (taskId: number) => Promise<CrawlContent[]>
  getCrawlCreators: (taskId: number) => Promise<CrawlCreator[]>
  analyzeVideoData: (platform: string, sourceUid?: string) => Promise<VideoAnalysis | null>
  getAllCrawlContent: (platform?: string) => Promise<CrawlContent[]>
  getSourceDetail: (sourceUid: string, platform?: string) => Promise<SourceDetailItem[]>
  getKeywordDetail: (keyword: string, platform?: string) => Promise<SourceDetailItem[]>
  // 来源
  getSources: (platform: string) => Promise<SourceInfo[]>
  getVideosBySource: (platform: string, sourceUid: string) => Promise<CrawlContent[]>
  // 创作者
  cleanOldData: () => Promise<boolean>
  importDb: () => Promise<{ success: boolean; canceled?: boolean; tables?: string[]; error?: string }>
  checkLoginStates: () => Promise<Record<string, boolean>>
  clearLoginState: (platform: string) => Promise<boolean>
  getCreators: () => Promise<CreatorInfo[]>
  starCreator: (uid: string) => Promise<boolean>
  pinCreator: (uid: string) => Promise<boolean>
  deleteCreator: (uid: string) => Promise<boolean>
  deleteMessage: (id: number) => Promise<boolean>
  searchMessages: (query: string) => Promise<{ convId: number; convTitle: string; matches: { role: string; content: string }[] }[]>
  exportSourceData: (sourceUid: string) => Promise<boolean>
  // 分类
  autoCategorize: (platform: string) => Promise<AutoCategorizeResult>
  getCategories: (platform: string) => Promise<CategoryInfo[]>
  updateCategory: (contentId: string, category: string) => Promise<boolean>
  // API 连接测试
  testConnection: (settings: { provider: string; apiKey: string; baseUrl: string; model: string }) => Promise<{ ok: boolean; msg: string }>
  // 灵感库
  suggestTopics: (platform: string) => Promise<{ topics: TopicSuggestion[]; error?: string }>
  getTopicTrends: (platform: string) => Promise<TrendData[]>
  saveTopic: (topic: Record<string, unknown>) => Promise<boolean>
  getSavedTopics: (platform?: string) => Promise<SavedTopic[]>
  saveTopicHistory: (platform: string, mode: string, topics: TopicSuggestion[]) => Promise<void>
  getTopicHistory: (platform?: string, limit?: number) => Promise<TopicHistory[]>
  starTopicHistory: (id: number) => Promise<void>
  deleteTopicHistory: (id: number) => Promise<void>
  sendTopicToChat: (topic: Record<string, unknown>) => Promise<boolean>
  onTopicToChat: (callback: (event: string) => void) => () => void
  // 竞品管理
  addCompetitor: (platform: string, userId: string, nickname: string) => Promise<boolean>
  removeCompetitor: (id: number) => Promise<boolean>
  listCompetitors: (platform: string) => Promise<Competitor[]>
  // 全网热点
  fetchTrending: (platforms?: string[]) => Promise<Record<string, TrendingItem[]>>
  getTrendingSources: () => Promise<{ sources: Record<string, TrendingSource>; config: TrendingConfig }>
  setTrendingConfig: (config: { sources: string[]; order: string[] }) => Promise<boolean>
  openUrl: (url: string) => Promise<void>
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}

export {}
