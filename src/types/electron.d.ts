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
    avgPlay: number
    avgLike: number
  }
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

export interface TopicSuggestion {
  title: string
  reason: string
  source: string
  estimatedPerformance: string
  tags: string[]
  platforms?: string[]
}

export interface SavedTopic extends TopicSuggestion {
  id: number
  platform: string
  fullData: Record<string, unknown>
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
  getCreators: () => Promise<CreatorInfo[]>
  starCreator: (uid: string) => Promise<boolean>
  pinCreator: (uid: string) => Promise<boolean>
  deleteCreator: (uid: string) => Promise<boolean>
  deleteMessage: (id: number) => Promise<boolean>
  exportSourceData: (sourceUid: string) => Promise<boolean>
  // 分类
  autoCategorize: (platform: string) => Promise<AutoCategorizeResult>
  getCategories: (platform: string) => Promise<CategoryInfo[]>
  updateCategory: (contentId: string, category: string) => Promise<boolean>
  // 灵感库
  suggestTopics: (platform: string) => Promise<{ topics: TopicSuggestion[]; error?: string }>
  getTopicTrends: (platform: string) => Promise<TrendData[]>
  saveTopic: (topic: Record<string, unknown>) => Promise<boolean>
  getSavedTopics: (platform?: string) => Promise<SavedTopic[]>
  sendTopicToChat: (topic: Record<string, unknown>) => Promise<boolean>
  onTopicToChat: (callback: (event: string) => void) => () => void
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}

export {}
