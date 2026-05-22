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
  fetchedAt: string
  category: string
  sourceUid: string
  sourceName: string
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

export interface CreatorInfo {
  uid: string
  name: string
  avatarUrl: string
  isStarred: number
  isPinned: number
  lastFetchedAt: string
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
  // 爬虫
  runCrawler: (platform: string, keywords: string, options?: Record<string, unknown>) => Promise<CrawlerResult>
  onCrawlerEvent: (callback: (event: string) => void) => () => void
  listCrawlTasks: () => Promise<CrawlTask[]>
  getCrawlContent: (taskId: number) => Promise<CrawlContent[]>
  getCrawlCreators: (taskId: number) => Promise<CrawlCreator[]>
  analyzeVideoData: (platform: string, sourceUid?: string) => Promise<VideoAnalysis | null>
  // 来源
  getSources: (platform: string) => Promise<SourceInfo[]>
  getVideosBySource: (platform: string, sourceUid: string) => Promise<CrawlContent[]>
  // 创作者
  cleanOldData: () => Promise<boolean>
  getCreators: () => Promise<CreatorInfo[]>
  starCreator: (uid: string) => Promise<boolean>
  pinCreator: (uid: string) => Promise<boolean>
  deleteCreator: (uid: string) => Promise<boolean>
  exportSourceData: (sourceUid: string) => Promise<boolean>
  // 分类
  autoCategorize: (platform: string) => Promise<AutoCategorizeResult>
  getCategories: (platform: string) => Promise<CategoryInfo[]>
  updateCategory: (contentId: string, category: string) => Promise<boolean>
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}

export {}
