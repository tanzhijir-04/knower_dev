import { app, BrowserWindow, ipcMain, nativeImage } from 'electron'
import path from 'node:path'
import fs from 'node:fs'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Agent = require('../knower-agent/agent/core')
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { createClient } = require('../knower-agent/llm')

const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']

let mainWindow: BrowserWindow | null = null

// ============================================================
//  窗口创建
// ============================================================

function createWindow() {
  const assetsDir = path.join(__dirname, '..', 'assets')
  let iconPath: string
  if (process.platform === 'win32') {
    iconPath = path.join(assetsDir, 'icon.ico')
  } else if (process.platform === 'darwin') {
    iconPath = path.join(assetsDir, 'icon.icns')
  } else {
    iconPath = path.join(assetsDir, 'icon-256x256.png')
  }
  const icon = nativeImage.createFromPath(iconPath)

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 12, y: 12 },
    backgroundColor: '#0e150f',
    icon,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(VITE_DEV_SERVER_URL)
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// ============================================================
//  App 生命周期
// ============================================================

app.whenReady().then(() => {
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// ============================================================
//  Settings 持久化
// ============================================================

const SETTINGS_PATH = path.join(app.getPath('userData'), 'settings.json')

function readSettings(): Record<string, unknown> {
  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      return JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf-8'))
    }
  } catch { /* ignore */ }
  return {}
}

function writeSettings(settings: Record<string, unknown>) {
  fs.mkdirSync(path.dirname(SETTINGS_PATH), { recursive: true })
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf-8')
}

ipcMain.handle('get-store', (_event, key: string) => {
  return readSettings()[key] ?? null
})

ipcMain.handle('get-store-all', () => {
  return readSettings()
})

ipcMain.handle('set-store', (_event, key: string, value: unknown) => {
  const settings = readSettings()
  settings[key] = value
  writeSettings(settings)
  return true
})

// ============================================================
//  Agent
// ============================================================

let currentAbortController: AbortController | null = null
let currentAgent: InstanceType<typeof Agent> | null = null

ipcMain.handle('agent-run', async (event, script: string, platforms: string[]) => {
  const settings = readSettings()
  const agent = new Agent({
    apiKey: settings.apiKey as string,
    model: (settings.model as string) || 'claude-sonnet-4-20250514',
    baseUrl: (settings.baseUrl as string) || '',
    provider: (settings.apiProvider as string) || 'claude',
  })
  currentAgent = agent

  const prompt = `请帮我分析以下脚本，并为 ${platforms.join('、')} 三个平台生成发布物料：\n\n${script}`

  // 注入用户爬取数据摘要
  const dataSummary = await db.getRecentCrawlSummary()
  let fullPrompt = dataSummary
    ? `## 你的账号数据摘要\n${dataSummary}\n\n## 任务\n${prompt}\n\n请参考上面的数据来优化建议。`
    : prompt

  // 自动检测 UID，注入创作者历史数据（竞品分析）
  const uidMatch = fullPrompt.match(/\b(\d{6,12})\b/)
  if (uidMatch) {
    const uid = uidMatch[1]
    try {
      const detail = await db.getSourceDetail(uid)
      if (detail.length > 0) {
        const dataStr = detail.map((v: { title: string; playCount: number; likeCount: number; commentCount: number }, i: number) =>
          `${i + 1}. "${v.title}" | 播放:${v.playCount} | 点赞:${v.likeCount} | 评论:${v.commentCount}`
        ).join('\n')
        fullPrompt = `## 该创作者的历史数据（共 ${detail.length} 条）\n${dataStr}\n\n## 任务\n${fullPrompt}`
      }
    } catch { /* ignore — UID may not exist */ }
  }

  const abortController = new AbortController()
  currentAbortController = abortController

  try {
    for await (const evt of agent.stream(fullPrompt, { platforms, signal: abortController.signal })) {
      event.sender.send('agent-event', JSON.stringify(evt))
    }
    event.sender.send('agent-event', JSON.stringify({ type: 'done' }))
  } catch (err: unknown) {
    if (abortController.signal.aborted) {
      event.sender.send('agent-event', JSON.stringify({ type: 'done' }))
    } else {
      const message = err instanceof Error ? err.message : String(err)
      event.sender.send('agent-event', JSON.stringify({ type: 'error', message }))
    }
  } finally {
    currentAbortController = null
    currentAgent = null
  }
})

ipcMain.handle('agent-submit-form', async (_event, data: Record<string, string>) => {
  if (currentAgent?._resolveForm) {
    currentAgent._resolveForm(data)
    return true
  }
  return false
})

ipcMain.handle('agent-stop', () => {
  if (currentAbortController) {
    currentAbortController.abort()
    currentAbortController = null
  }
  return true
})

// ============================================================
//  会话管理
// ============================================================

// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require('../knower-agent/db')

ipcMain.handle('conv-list', async () => {
  return await db.listConversations()
})

ipcMain.handle('conv-create', async (_event, title: string) => {
  return await db.createConversation(title)
})

ipcMain.handle('conv-delete', async (_event, id: number) => {
  await db.deleteConversation(id)
  return true
})

ipcMain.handle('delete-message', async (_event, id: number) => {
  await db.deleteMessage(id)
  return true
})

ipcMain.handle('conv-messages', async (_event, conversationId: number) => {
  return await db.getMessages(conversationId)
})

ipcMain.handle('msg-add', async (_event, conversationId: number, role: string, content: string) => {
  await db.addMessage(conversationId, role, content)
  return true
})

ipcMain.handle('conv-rename', async (_event, id: number, title: string) => {
  await db.updateConversationTitle(id, title)
  return true
})

ipcMain.handle('conv-toggle-pin', async (_event, id: number) => {
  await db.togglePinConversation(id)
  return true
})

// ============================================================
//  爬虫
// ============================================================

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { runCrawler } = require('../knower-agent/lib/crawler')

ipcMain.handle('crawler-run', async (event, platform: string, keywords: string, options: Record<string, unknown> = {}) => {
  event.sender.send('crawler-event', JSON.stringify({ type: 'started', platform }))
  try {
    const result = await runCrawler(platform, keywords, options, (msg: string) => {
      event.sender.send('crawler-event', JSON.stringify({ type: 'progress', message: msg }))
    })
    const taskId = await db.saveCrawlTask(platform, keywords, options.crawlerType as string || 'search', 'done', JSON.stringify(result))

    // 确定来源信息
    let sourceUid = ''
    let sourceName = ''
    if (options.crawlerType === 'creator' && options.creatorId) {
      sourceUid = options.creatorId as string
      sourceName = options.creatorId as string
    } else if (keywords) {
      sourceUid = `keyword_${keywords}`
      sourceName = keywords
    }

    // 从 creators 结果中提取真实昵称和头像
    if (result.creators && result.creators.length > 0) {
      const creator = result.creators[0]
      sourceName = creator.nickname || creator.name || sourceUid || sourceName
    }

    // 爬取完成后清除旧的分析缓存
    if (sourceUid) {
      await db.deleteVideoAnalysis(platform, sourceUid)
    }

    if (result.contents && result.contents.length > 0) {
      await db.saveCrawlContentBatch(taskId, platform, result.contents, sourceUid, sourceName)
    }
    // 如果是创作者爬取，保存创作者记录
    if (options.crawlerType === 'creator' && sourceUid) {
      const creatorName = result.creators?.[0]?.nickname || result.creators?.[0]?.name || sourceName || sourceUid
      const creatorAvatar = result.creators?.[0]?.avatar
        || result.creators?.[0]?.face
        || result.creators?.[0]?.avatar_url
        || ''
      await db.saveCreator(sourceUid, creatorName, creatorAvatar)
    }
    if (result.creators && result.creators.length > 0) {
      await db.saveCrawlCreatorsBatch(taskId, platform, result.creators)
    }
    event.sender.send('crawler-event', JSON.stringify({ type: 'done', taskId, count: result.stats?.total_contents || 0 }))
    return { success: true, taskId, count: result.stats?.total_contents || 0, sourceUid, sourceName }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    event.sender.send('crawler-event', JSON.stringify({ type: 'error', message }))
    return { success: false, error: message }
  }
})

ipcMain.handle('crawler-tasks', async () => {
  return await db.getCrawlTasks()
})

ipcMain.handle('crawler-content', async (_event, taskId: number) => {
  return await db.getCrawlContent(taskId)
})

ipcMain.handle('crawler-creators', async (_event, taskId: number) => {
  return await db.getCrawlCreators(taskId)
})

ipcMain.handle('get-sources', async (_event, platform: string) => {
  return await db.getSourceList(platform || null)
})

ipcMain.handle('get-videos-by-source', async (_event, platform: string, sourceUid: string) => {
  return await db.getVideosBySource(platform || 'bili', sourceUid || '')
})

ipcMain.handle('get-all-crawl-content', async (_event, platform?: string) => {
  return await db.getAllCrawlContent(platform || null)
})

ipcMain.handle('source-detail', async (_event, sourceUid: string, platform?: string) => {
  return await db.getSourceDetail(sourceUid, platform || null)
})

ipcMain.handle('keyword-detail', async (_event, keyword: string, platform?: string) => {
  return await db.getKeywordDetail(keyword, platform || null)
})

// ============================================================
//  创作者管理
// ============================================================

ipcMain.handle('clean-old-data', async () => {
  await db.cleanOldData()
  return true
})

ipcMain.handle('get-creators', async () => {
  return await db.getCreators()
})

ipcMain.handle('star-creator', async (_event, uid: string) => {
  await db.starCreator(uid)
  return true
})

ipcMain.handle('pin-creator', async (_event, uid: string) => {
  await db.pinCreator(uid)
  return true
})

ipcMain.handle('delete-creator', async (_event, uid: string) => {
  await db.deleteCreator(uid)
  return true
})

ipcMain.handle('export-source-data', async (_event, sourceUid: string) => {
  // 从所有平台中查找该 sourceUid 的数据
  let videos: Record<string, unknown>[] = []
  for (const p of ['bili', 'dy', 'xhs', 'wb']) {
    const found = await db.getVideosBySource(p, sourceUid)
    if (found.length) { videos = found; break }
  }
  const creators = await db.getCreators()
  const creator = creators.find((c: { uid: string }) => c.uid === sourceUid)
  const exportData = {
    source: {
      uid: sourceUid,
      name: creator?.name || sourceUid,
      exportedAt: new Date().toISOString(),
    },
    videos: videos.map((v: Record<string, unknown>) => ({
      title: v.title,
      playCount: v.playCount,
      likeCount: v.likeCount,
      commentCount: v.commentCount,
      shareCount: v.shareCount,
      category: v.category,
      createdAt: v.createdAt,
    })),
  }
  const { dialog } = require('electron')
  const result = await dialog.showSaveDialog({
    defaultPath: `${sourceUid}_${Date.now()}.json`,
    filters: [{ name: 'JSON', extensions: ['json'] }],
  })
  if (!result.canceled && result.filePath) {
    fs.writeFileSync(result.filePath, JSON.stringify(exportData, null, 2), 'utf-8')
    return true
  }
  return false
})

// ============================================================
//  数据分析
// ============================================================

ipcMain.handle('analyze-video-data', async (_event, platform: string, sourceUid?: string) => {
  const settings = readSettings()

  // 1. 先查数据库缓存
  const cached = await db.getVideoAnalysis(platform || 'bili', sourceUid || '')
  if (cached) {
    const videos = sourceUid
      ? await db.getVideosBySource(platform || 'bili', sourceUid)
      : await db.getAllCrawlContent(platform || 'bili')
    if (videos.length === cached.videoCount) {
      return { ...cached.analysis, overview: cached.overview }
    }
    // 数据数量变化，清除旧缓存
    await db.deleteVideoAnalysis(platform || 'bili', sourceUid || '')
  }

  const videos = sourceUid
    ? await db.getVideosBySource(platform || 'bili', sourceUid)
    : await db.getAllCrawlContent(platform || 'bili')
  if (!videos.length) return null

  // 从 raw_json 提取完整指标
  const enriched = videos.map((v: Record<string, unknown>) => {
    const raw = (v.rawJson || {}) as Record<string, string>
    return {
      title: v.title as string,
      playCount: v.playCount as number,
      likeCount: v.likeCount as number,
      commentCount: v.commentCount as number,
      shareCount: v.shareCount as number,
      coinCount: parseInt(raw.video_coin_count) || 0,
      favoriteCount: parseInt(raw.video_favorite_count) || 0,
      danmaku: parseInt(raw.video_danmaku) || 0,
      createdAt: v.createdAt as string,
      authorName: v.authorName as string,
      desc: v.desc as string,
    }
  })

  // 本地预计算统计
  const totalPlay = enriched.reduce((s: number, v: { playCount: number }) => s + v.playCount, 0)
  const totalLike = enriched.reduce((s: number, v: { likeCount: number }) => s + v.likeCount, 0)
  const totalComment = enriched.reduce((s: number, v: { commentCount: number }) => s + v.commentCount, 0)
  const avgPlay = Math.round(totalPlay / enriched.length)
  const avgLike = Math.round(totalLike / enriched.length)

  // 互动率排行
  const withEngagement = enriched.map((v: typeof enriched[0]) => ({
    ...v,
    engagementRate: v.playCount > 0
      ? ((v.likeCount + v.coinCount + v.favoriteCount + v.commentCount + v.danmaku) / v.playCount * 100)
      : 0,
  })).sort((a: { engagementRate: number }, b: { engagementRate: number }) => b.engagementRate - a.engagementRate)

  // 构造分析 prompt
  const videoDataStr = enriched.slice(0, 50).map((v: { title: string; playCount: number; likeCount: number; commentCount: number; coinCount: number; favoriteCount: number; danmaku: number; createdAt: string }, i: number) =>
    `${i + 1}. 标题: "${v.title}" | 播放: ${v.playCount} | 点赞: ${v.likeCount} | 评论: ${v.commentCount} | 投币: ${v.coinCount} | 收藏: ${v.favoriteCount} | 弹幕: ${v.danmaku} | 发布: ${v.createdAt}`
  ).join('\n')

  const prompt = `你是一位资深的视频数据分析专家。请基于以下视频数据进行深度分析，返回严格的 JSON 格式。

## 视频数据（共 ${enriched.length} 条，按播放量降序）
${videoDataStr}

## 请返回以下 JSON 结构（不要有任何其他文字）：
{
  "topTopics": [
    { "topic": "选题方向关键词", "avgPlay": 平均播放量, "count": 视频数量 }
  ],
  "titlePatterns": "分析高播放视频的标题特征（长度、句式、是否含数字/反问/反差等），50字以内",
  "bestDuration": "根据数据推断最佳时长区间（0-3min / 3-5min / 5-10min / 10min+）",
  "bestTime": "分析发布时间规律，哪个时间段发布表现最好",
  "suggestions": [
    "基于数据的具体选题方向建议",
    "基于标题规律的标题优化建议",
    "基于发布时间的发布策略建议"
  ]
}

## 要求：
1. topTopics 提取 3-5 个高频选题方向，按平均播放量降序
2. suggestions 每条要具体可执行，引用数据依据
3. 只输出 JSON，不要任何其他文字`

  // 调用 LLM（通过适配器）
  const llmClient = createClient({
    apiKey: settings.apiKey as string,
    model: (settings.model as string) || 'claude-sonnet-4-20250514',
    baseUrl: (settings.baseUrl as string) || '',
    provider: (settings.apiProvider as string) || 'claude',
  })
  const chatResponse = await llmClient.chat({
    messages: [{ role: 'user', content: prompt }],
    maxTokens: 2048,
  })
  const text = chatResponse.content
    .filter((b: { type: string }) => b.type === 'text')
    .map((b: { type: string; text: string }) => b.text)
    .join('')

  // 解析 JSON
  let analysis
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : {}
  } catch {
    analysis = {}
  }

  const overview = {
    totalVideos: enriched.length,
    totalPlay,
    totalLike,
    totalComment,
    avgPlay,
    avgLike,
  }

  const result = {
    overview,
    topByEngagement: withEngagement.slice(0, 20).map((v: { title: string; playCount: number; engagementRate: number }) => ({
      title: v.title,
      playCount: v.playCount,
      engagementRate: Math.round(v.engagementRate * 100) / 100,
    })),
    ...analysis,
  }

  // 3. 存入数据库缓存
  await db.saveVideoAnalysis(platform || 'bili', sourceUid || '', result, enriched.length, overview)

  return result
})

// ============================================================
//  AI 视频分类
// ============================================================

ipcMain.handle('auto-categorize', async (_event, platform: string) => {
  const settings = readSettings()
  const videos = await db.getAllCrawlContent(platform || 'bili')
  if (!videos.length) return { success: false, error: '暂无视频数据' }

  const uncategorized = videos.filter((v: { category?: string }) => !v.category || v.category === '未分类')
  if (!uncategorized.length) return { success: true, message: '所有视频已分类', categorized: 0 }

  const videoList = uncategorized.map((v: { contentId: string; title: string; desc?: string; authorName?: string; rawJson?: Record<string, string> }, i: number) => {
    const raw = v.rawJson || {}
    const sourceKeyword = raw.source_keyword || ''
    const desc = (v.desc || '').slice(0, 100)
    const parts = [
      `${i + 1}. [${v.contentId}]`,
      `标题: ${v.title}`,
      `作者: ${v.authorName || ''}`,
      desc ? `简介: ${desc}` : '',
      sourceKeyword ? `来源关键词: ${sourceKeyword}` : '',
    ].filter(Boolean)
    return parts.join(' | ')
  }).join('\n')

  const prompt = `你是一位视频内容分类专家。请根据视频的标题、简介描述、作者信息和来源关键词，将以下视频分类到最合适的类别中。

## 视频列表（共 ${uncategorized.length} 条）
每条格式：序号. [ID] 标题: xxx | 作者: xxx | 简介: xxx | 来源关键词: xxx
${videoList}

## 分类要求：
1. 综合标题、简介描述、作者风格来判断类别，不要只看标题
2. 常见类别参考：科技数码、游戏娱乐、生活日常、知识科普、美食烹饪、旅行探险、影视剪辑、音乐舞蹈、教育学习、时事热点、运动健身、萌宠动物、时尚穿搭、汽车交通、职场商务、心理情感、艺术设计、其他
3. 如果现有类别不合适，可以自定义新类别

## 输出格式（严格按此格式，每行一条，不要有任何其他文字）：
序号|分类名称
序号|分类名称
...

例如：
1|科技数码
2|游戏娱乐
3|科技数码

## 要求：
- 每行格式：序号|分类名称
- 不要输出标题、解释或其他内容
- 如果某个视频无法判断，分类为"其他"`

  const catClient = createClient({
    apiKey: settings.apiKey as string,
    model: (settings.model as string) || 'claude-sonnet-4-20250514',
    baseUrl: (settings.baseUrl as string) || '',
    provider: (settings.apiProvider as string) || 'claude',
  })
  try {
    const catResponse = await catClient.chat({
      messages: [{ role: 'user', content: prompt }],
      maxTokens: 2048,
    })
    const text = catResponse.content
      .filter((b: { type: string }) => b.type === 'text')
      .map((b: { type: string; text: string }) => b.text)
      .join('')

    // 解析 "序号|分类" 格式
    const lines = text.trim().split('\n').filter((l: string) => l.includes('|'))
    const updates: { contentId: string; category: string }[] = []

    for (const line of lines) {
      const parts = line.split('|')
      if (parts.length >= 2) {
        const idx = parseInt(parts[0].trim()) - 1
        const category = parts[1].trim()
        if (idx >= 0 && idx < uncategorized.length && category) {
          updates.push({ contentId: uncategorized[idx].contentId, category })
        }
      }
    }

    if (updates.length > 0) {
      await db.categorizeVideoBatch(updates)
    }

    return { success: true, categorized: updates.length, total: uncategorized.length }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    return { success: false, error: message }
  }
})

ipcMain.handle('get-categories', async (_event, platform: string) => {
  return await db.getAllCategories(platform || null)
})

ipcMain.handle('update-category', async (_event, contentId: string, category: string) => {
  await db.categorizeVideo(contentId, category)
  return true
})

// ============================================================
//  灵感库
// ============================================================

let pendingTopic: Record<string, unknown> | null = null

ipcMain.handle('topics-suggest', async (_event, platform: string) => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const suggestTool = require('../knower-agent/agent/tools/suggest_topics')
  return await suggestTool.execute({ platform, count: 5 })
})

ipcMain.handle('topics-trends', async (_event, platform: string) => {
  return await db.getRecentTrends(platform || 'bili', 7)
})

ipcMain.handle('topics-save', async (_event, topic: Record<string, unknown>) => {
  await db.saveTopic(
    topic.platform as string,
    topic.title as string,
    topic.reason as string,
    topic.source as string,
    topic.estimatedPerformance as string,
    topic.tags as string[],
    topic.fullData as Record<string, unknown>,
  )
  return true
})

ipcMain.handle('topics-saved', async (_event, platform?: string) => {
  return await db.getSavedTopics(platform || null)
})

ipcMain.handle('topic-to-chat', async (_event, topic: Record<string, unknown>) => {
  pendingTopic = topic
  if (mainWindow) {
    mainWindow.webContents.send('topic-to-chat-event', JSON.stringify(topic))
  }
  return true
})
