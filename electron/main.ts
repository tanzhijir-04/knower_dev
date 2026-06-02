import { app, BrowserWindow, ipcMain, nativeImage, shell } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'module'
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const require = createRequire(import.meta.url)

// eslint-disable-next-line @typescript-eslint/no-require-imports
const db = require('../knower-agent/db')

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
    frame: false,
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 12, y: 12 },
    backgroundColor: '#f7f7f4',
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

  // 捕获渲染进程 console 输出到主进程终端
  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    const prefix = ['[INFO]', '[WARN]', '[ERROR]'][level] || '[LOG]'
    console.log(`[Renderer ${prefix}] ${message} (${sourceId}:${line})`)
  })

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
//  窗口控制
// ============================================================

ipcMain.handle('window-minimize', () => mainWindow?.minimize())
ipcMain.handle('window-maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize()
  else mainWindow?.maximize()
})
ipcMain.handle('window-close', () => mainWindow?.close())

// ============================================================
//  IPC 安全包装器
// ============================================================

function safeIpcHandler<T extends unknown[]>(
  handler: (event: Electron.IpcMainInvokeEvent, ...args: T) => Promise<unknown> | unknown
) {
  return async (event: Electron.IpcMainInvokeEvent, ...args: T) => {
    try {
      return await handler(event, ...args)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`[IPC] handler error:`, message)
      throw message
    }
  }
}

// ============================================================
//  账号管理
// ============================================================

ipcMain.handle('account-list', async () => {
  return await db.listAccounts()
})

ipcMain.handle('account-get-active', async () => {
  return await db.getActiveAccount()
})

ipcMain.handle('account-create', async (_event, data: { name: string; platform: string; uid?: string; avatarUrl?: string; description?: string }) => {
  return await db.createAccount(data)
})

ipcMain.handle('account-switch', async (_event, id: string) => {
  await db.switchAccount(id)
  return true
})

ipcMain.handle('account-update', async (_event, id: string, updates: Record<string, unknown>) => {
  await db.updateAccount(id, updates)
  return true
})

ipcMain.handle('account-delete', async (_event, id: string) => {
  await db.deleteAccount(id)
  return true
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
let currentAgent: Record<string, unknown> | null = null
let agentLock = false

ipcMain.handle('agent-run', async (event, script: string, platforms: string[], conversationId?: number) => {
  if (agentLock) {
    return { error: 'Agent 正在处理中，请稍候' }
  }
  agentLock = true

  try {
    const Agent = require('../knower-agent/agent/core')
    const settings = readSettings()
    const activeAccount = await db.getActiveAccount()
    const agent = new Agent({
      apiKey: settings.apiKey as string,
      model: (settings.model as string) || 'claude-sonnet-4-20250514',
      baseUrl: (settings.baseUrl as string) || '',
      provider: (settings.apiProvider as string) || 'claude',
      temperature: typeof settings.temperature === 'number' ? settings.temperature : 0.7,
      maxTokens: typeof settings.maxTokens === 'number' ? settings.maxTokens : 4096,
      contentStyle: (settings.contentStyle as string) || '',
      scriptDuration: (settings.scriptDuration as string) || '',
      defaultLanguage: (settings.defaultLanguage as string) || '',
      accountId: activeAccount?.id || 'default',
      accountName: activeAccount?.name || '',
      accountPlatform: activeAccount?.platform || '',
      accountUid: activeAccount?.uid || '',
    })
    currentAgent = agent

  // 获取最近对话历史（最多 5 轮）
  let historyContext = ''
  if (conversationId) {
    try {
      const messages = await db.getMessages(conversationId)
      const recent = messages.slice(-10)
      if (recent.length > 0) {
        historyContext = recent.map((m: { role: string; content: string }) => {
          const role = m.role === 'user' ? '用户' : '助手'
          const content = m.content.slice(0, 500)
          return `${role}：${content}`
        }).join('\n')
      }
    } catch { /* ignore */ }
  }

  let prompt = script
  if (historyContext) {
    prompt = `## 最近对话记录\n${historyContext}\n\n## 当前请求\n${script}`
  }

  // 意图检测：只在用户确实要生成物料时才包装 prompt
  const materialsKw = ['脚本', '物料', '文案', '标题', '标签', '简介', '字幕', '封面', '生成', '发布']
  const isMaterialsIntent = materialsKw.some(kw => script.includes(kw))
  if (isMaterialsIntent) {
    prompt = `请帮我分析以下脚本，并为 ${platforms.join('、')} 平台生成发布物料：\n\n${prompt}`
  }

  // 注入用户爬取数据摘要
  const dataSummary = await db.getRecentCrawlSummary(activeAccount?.id || 'default')
  let fullPrompt = dataSummary
    ? `## 你的账号数据摘要\n${dataSummary}\n\n## 任务\n${prompt}\n\n请参考上面的数据来优化建议。`
    : prompt

  // 自动检测 UID，注入创作者历史数据（竞品分析）
  const uidMatch = fullPrompt.match(/\b(\d{6,12})\b/)
  if (uidMatch) {
    const uid = uidMatch[1]
    try {
      const detail = await db.getSourceDetail(uid, undefined, activeAccount?.id || 'default')
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
    agentLock = false
  }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[Agent] 启动失败:', message)
    try { event.sender.send('agent-event', JSON.stringify({ type: 'error', message })) } catch {}
    agentLock = false
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

ipcMain.handle('conv-list', async () => {
  const active = await db.getActiveAccount()
  return await db.listConversations(50, active?.id || 'default')
})

ipcMain.handle('conv-create', async (_event, title: string) => {
  const active = await db.getActiveAccount()
  return await db.createConversation(title, active?.id || 'default')
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

ipcMain.handle('search-messages', async (_event, query: string) => {
  const active = await db.getActiveAccount()
  const conversations = await db.listConversations(50, active?.id || 'default')
  const results: { convId: number; convTitle: string; matches: { role: string; content: string }[] }[] = []
  for (const conv of conversations) {
    const messages = await db.getMessages(conv.id)
    const matches = messages
      .filter((m: { content: string }) => m.content.toLowerCase().includes(query.toLowerCase()))
      .map((m: { role: string; content: string }) => ({ role: m.role, content: m.content.slice(0, 200) }))
    if (matches.length > 0) {
      results.push({ convId: conv.id, convTitle: conv.title, matches })
    }
  }
  return results
})

// ============================================================
//  爬虫
// ============================================================

ipcMain.handle('crawler-run', async (event, platform: string, keywords: string, options: Record<string, unknown> = {}) => {
  event.sender.send('crawler-event', JSON.stringify({ type: 'started', platform }))
  try {
    const { runCrawler } = require('../knower-agent/lib/crawler')
    const result = await runCrawler(platform, keywords, options, (msg: string) => {
      event.sender.send('crawler-event', JSON.stringify({ type: 'progress', message: msg }))
    })
    const active = await db.getActiveAccount()
    const taskId = await db.saveCrawlTask(platform, keywords, options.crawlerType as string || 'search', 'done', JSON.stringify(result), active?.id || 'default')

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
      await db.deleteVideoAnalysis(platform, sourceUid, active?.id || 'default')
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
      const totalFans = parseInt(result.creators?.[0]?.total_fans) || 0
      await db.saveCreator(sourceUid, creatorName, creatorAvatar, totalFans, active?.id || 'default')
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
  const active = await db.getActiveAccount()
  return await db.getCrawlTasks(50, active?.id || 'default')
})

ipcMain.handle('crawler-content', async (_event, taskId: number) => {
  return await db.getCrawlContent(taskId)
})

ipcMain.handle('crawler-creators', async (_event, taskId: number) => {
  return await db.getCrawlCreators(taskId)
})

ipcMain.handle('get-sources', async (_event, platform: string) => {
  const active = await db.getActiveAccount()
  return await db.getSourceList(platform || null, active?.id || 'default')
})

ipcMain.handle('get-videos-by-source', async (_event, platform: string, sourceUid: string) => {
  const active = await db.getActiveAccount()
  return await db.getVideosBySource(platform || 'bili', sourceUid || '', active?.id || 'default')
})

ipcMain.handle('get-all-crawl-content', async (_event, platform?: string) => {
  const active = await db.getActiveAccount()
  return await db.getAllCrawlContent(platform || null, active?.id || 'default')
})

ipcMain.handle('source-detail', async (_event, sourceUid: string, platform?: string) => {
  const active = await db.getActiveAccount()
  return await db.getSourceDetail(sourceUid, platform || null, active?.id || 'default')
})

ipcMain.handle('keyword-detail', async (_event, keyword: string, platform?: string) => {
  const active = await db.getActiveAccount()
  return await db.getKeywordDetail(keyword, platform || null, active?.id || 'default')
})

// ============================================================
//  创作者管理
// ============================================================

ipcMain.handle('clean-old-data', async () => {
  const active = await db.getActiveAccount()
  await db.cleanOldData(active?.id || 'default')
  return true
})

// ============================================================
//  API 连接测试（在主进程中执行，避免 CORS 问题）
// ============================================================

const PROVIDER_DEFAULTS: Record<string, string> = {
  claude: 'https://api.anthropic.com',
  openai: 'https://api.openai.com',
  deepseek: 'https://api.deepseek.com',
  qwen: 'https://dashscope.aliyuncs.com/compatible-mode',
}

ipcMain.handle('test-connection', async (_event, settings: {
  provider: string; apiKey: string; baseUrl: string; model: string;
}) => {
  // SSRF 保护：只允许连接到已知 provider 域名或用户配置的域名
  const raw = settings.baseUrl || PROVIDER_DEFAULTS[settings.provider] || ''
  const base = raw.replace(/\/+$/, '').replace(/\/v1$/, '')

  try {
    const url = new URL(base)
    if (!['https:', 'http:'].includes(url.protocol)) {
      return { ok: false, msg: '只支持 HTTP/HTTPS 协议' }
    }
  } catch {
    return { ok: false, msg: '无效的 URL 格式' }
  }

  const isClaude = settings.provider === 'claude'
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  let endpoint: string
  let body: Record<string, unknown>

  if (isClaude) {
    endpoint = `${base}/v1/messages`
    headers['x-api-key'] = settings.apiKey
    headers['anthropic-version'] = '2023-06-01'
    body = { model: settings.model, max_tokens: 32, messages: [{ role: 'user', content: 'ping' }] }
  } else {
    endpoint = `${base}/v1/chat/completions`
    headers['Authorization'] = `Bearer ${settings.apiKey}`
    body = { model: settings.model, max_tokens: 32, messages: [{ role: 'user', content: 'ping' }] }
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 10000)
  try {
    const res = await fetch(endpoint, { method: 'POST', headers, body: JSON.stringify(body), signal: controller.signal })
    clearTimeout(timeout)
    if (res.ok) {
      return { ok: true, msg: '连接成功' }
    }
    const err = await res.text().catch(() => res.statusText)
    return { ok: false, msg: `错误 ${res.status}: ${err.slice(0, 120)}` }
  } catch (err: unknown) {
    clearTimeout(timeout)
    if (err instanceof Error && err.name === 'AbortError') {
      return { ok: false, msg: '连接超时（10s）' }
    }
    return { ok: false, msg: `连接失败: ${err instanceof Error ? err.message : String(err)}` }
  }
})

// ============================================================
//  导入数据库
// ============================================================

ipcMain.handle('import-db', async () => {
  const { dialog } = require('electron')
  const result = await dialog.showOpenDialog({
    title: '选择 knower 数据库文件',
    filters: [{ name: 'SQLite 数据库', extensions: ['db'] }],
    properties: ['openFile'],
  })
  if (result.canceled || !result.filePaths[0]) return { success: false, canceled: true }

  const srcPath = result.filePaths[0]
  const destPath = path.join(__dirname, '..', 'knower-agent', 'knower.db')

  try {
    // 验证文件是有效的 SQLite 数据库
    const initSqlJs = require('sql.js')
    const SQL = await initSqlJs()
    const buffer = fs.readFileSync(srcPath)
    const testDb = new SQL.Database(buffer)
    const tables = testDb.exec("SELECT name FROM sqlite_master WHERE type='table'")
    testDb.close()

    if (!tables.length || !tables[0].values.length) {
      return { success: false, error: '文件不是有效的 SQLite 数据库' }
    }

    // 备份当前数据库
    if (fs.existsSync(destPath)) {
      const backupPath = destPath + `.bak.${Date.now()}`
      fs.copyFileSync(destPath, backupPath)
    }

    // 替换数据库文件
    fs.copyFileSync(srcPath, destPath)

    // 重新加载
    db.reloadDb()
    console.log(`[DB] 数据库已导入，来源: ${srcPath}，表: ${tables[0].values.map((r: unknown[]) => r[0]).join(', ')}`)
    return { success: true, tables: tables[0].values.map((r: unknown[]) => r[0] as string) }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[DB] 导入失败:', message)
    return { success: false, error: message }
  }
})

// ============================================================
//  爬虫登录状态检测
// ============================================================

ipcMain.handle('check-login-states', async () => {
  const crawlerDir = path.join(__dirname, '..', 'knower-agent', 'crawler')
  const browserDataDir = path.join(crawlerDir, 'mediasrc', 'browser_data')

  const platforms = [
    { key: 'bili', dir: 'bili_user_data_dir' },
    { key: 'dy', dir: 'dy_user_data_dir' },
    { key: 'xhs', dir: 'xhs_user_data_dir' },
    { key: 'wb', dir: 'wb_user_data_dir' },
  ]

  const states: Record<string, boolean> = {}
  for (const p of platforms) {
    const cookiePath = path.join(browserDataDir, p.dir, 'Default', 'Cookies')
    try {
      const stat = fs.statSync(cookiePath)
      states[p.key] = stat.size > 0
    } catch {
      states[p.key] = false
    }
  }
  return states
})

ipcMain.handle('clear-login-state', async (_event, platform: string) => {
  const crawlerDir = path.join(__dirname, '..', 'knower-agent', 'crawler')
  const browserDataDir = path.join(crawlerDir, 'mediasrc', 'browser_data')
  const dirMap: Record<string, string> = {
    bili: 'bili_user_data_dir',
    dy: 'dy_user_data_dir',
    xhs: 'xhs_user_data_dir',
    wb: 'wb_user_data_dir',
  }
  const dirName = dirMap[platform]
  if (!dirName) return false
  const cookiePath = path.join(browserDataDir, dirName, 'Default', 'Cookies')
  try {
    if (fs.existsSync(cookiePath)) {
      fs.unlinkSync(cookiePath)
    }
    return true
  } catch {
    return false
  }
})

ipcMain.handle('get-creators', async () => {
  const active = await db.getActiveAccount()
  return await db.getCreators(active?.id || 'default')
})

ipcMain.handle('star-creator', async (_event, uid: string) => {
  const active = await db.getActiveAccount()
  await db.starCreator(uid, active?.id || 'default')
  return true
})

ipcMain.handle('pin-creator', async (_event, uid: string) => {
  const active = await db.getActiveAccount()
  await db.pinCreator(uid, active?.id || 'default')
  return true
})

ipcMain.handle('delete-creator', async (_event, uid: string) => {
  const active = await db.getActiveAccount()
  await db.deleteCreator(uid, active?.id || 'default')
  return true
})

// ============================================================
//  竞品管理
// ============================================================

ipcMain.handle('competitor-add', async (_event, platform: string, userId: string, nickname: string) => {
  const active = await db.getActiveAccount()
  await db.addCompetitor(platform, userId, nickname, active?.id || 'default')
  return true
})

ipcMain.handle('competitor-remove', async (_event, id: number) => {
  await db.removeCompetitor(id)
  return true
})

ipcMain.handle('competitor-list', async (_event, platform: string) => {
  const active = await db.getActiveAccount()
  return await db.getCompetitors(platform, active?.id || 'default')
})

ipcMain.handle('export-source-data', async (_event, sourceUid: string) => {
  const active = await db.getActiveAccount()
  const accountId = active?.id || 'default'
  // 从所有平台中查找该 sourceUid 的数据
  let videos: Record<string, unknown>[] = []
  for (const p of ['bili', 'dy', 'xhs', 'wb']) {
    const found = await db.getVideosBySource(p, sourceUid, accountId)
    if (found.length) { videos = found; break }
  }
  const creators = await db.getCreators(accountId)
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
  const active = await db.getActiveAccount()
  const accountId = active?.id || 'default'
  console.log(`[Analysis] 开始分析 platform=${platform} sourceUid=${sourceUid || '(全部)'} accountId=${accountId}`)

  // 1. 先查数据库缓存
  const cached = await db.getVideoAnalysis(platform || 'bili', sourceUid || '', accountId)
  if (cached) {
    const videos = sourceUid
      ? await db.getVideosBySource(platform || 'bili', sourceUid, accountId)
      : await db.getAllCrawlContent(platform || 'bili', accountId)
    console.log(`[Analysis] 命中缓存，视频数=${videos.length} 缓存数=${cached.videoCount}`)
    if (videos.length === cached.videoCount) {
      // 从 creators 表补全粉丝数
      let fans = cached.analysis.fans || 0
      if (!fans && sourceUid) {
        try {
          const creatorsList = await db.getCreators(accountId)
          const match = creatorsList.find((c: { uid: string }) => c.uid === sourceUid || sourceUid.startsWith(c.uid))
          if (match) fans = (match as { totalFans?: number }).totalFans || 0
        } catch { /* ignore */ }
      }
      return { ...cached.analysis, overview: cached.overview, fans }
    }
    // 数据数量变化，清除旧缓存
    await db.deleteVideoAnalysis(platform || 'bili', sourceUid || '', accountId)
  }

  const videos = sourceUid
    ? await db.getVideosBySource(platform || 'bili', sourceUid, accountId)
    : await db.getAllCrawlContent(platform || 'bili', accountId)
  if (!videos.length) {
    console.log('[Analysis] 无视频数据，跳过分析')
    return null
  }
  console.log(`[Analysis] 获取到 ${videos.length} 条视频数据，开始 LLM 分析...`)

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
  const totalShare = enriched.reduce((s: number, v: { shareCount: number }) => s + v.shareCount, 0)
  const totalCoin = enriched.reduce((s: number, v: { coinCount: number }) => s + v.coinCount, 0)
  const totalFavorite = enriched.reduce((s: number, v: { favoriteCount: number }) => s + v.favoriteCount, 0)
  const totalDanmaku = enriched.reduce((s: number, v: { danmaku: number }) => s + v.danmaku, 0)
  const avgPlay = Math.round(totalPlay / enriched.length)
  const avgLike = Math.round(totalLike / enriched.length)
  const avgEngagement = enriched.length > 0
    ? enriched.reduce((s: number, v: { playCount: number; likeCount: number; coinCount: number; favoriteCount: number; commentCount: number; danmaku: number }) =>
        s + (v.playCount > 0 ? (v.likeCount + v.coinCount + v.favoriteCount + v.commentCount + v.danmaku) / v.playCount * 100 : 0), 0) / enriched.length
    : 0

  // 查找粉丝数
  const creators = await db.getCreators(accountId)
  const matchingCreator = creators.find((c: { uid: string }) => {
    const srcUid = sourceUid || ''
    return c.uid === srcUid || srcUid.startsWith(c.uid)
  })

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
  const { createClient } = require('../knower-agent/llm')
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

  console.log(`[Analysis] LLM 返回 ${text.length} 字，开始解析...`)

  // 解析 JSON
  let analysis
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : {}
    console.log('[Analysis] JSON 解析成功，topTopics:', JSON.stringify(analysis.topTopics?.slice(0, 3)))
  } catch {
    console.error('[Analysis] JSON 解析失败，原始文本:', text.slice(0, 200))
    analysis = {}
  }

  const overview = {
    totalVideos: enriched.length,
    totalPlay,
    totalLike,
    totalComment,
    totalShare,
    totalCoin,
    totalFavorite,
    totalDanmaku,
    avgPlay,
    avgLike,
    avgEngagement: Math.round(avgEngagement * 100) / 100,
  }

  const result = {
    overview,
    fans: (matchingCreator as { totalFans?: number } | undefined)?.totalFans || 0,
    topByEngagement: withEngagement.slice(0, 20).map((v: { title: string; playCount: number; engagementRate: number }) => ({
      title: v.title,
      playCount: v.playCount,
      engagementRate: Math.round(v.engagementRate * 100) / 100,
    })),
    ...analysis,
  }

  // 3. 存入数据库缓存
  await db.saveVideoAnalysis(platform || 'bili', sourceUid || '', result, enriched.length, overview, accountId)
  console.log(`[Analysis] 分析完成并缓存，视频数=${enriched.length} 总播放=${totalPlay}`)

  return result
})

// ============================================================
//  AI 视频分类
// ============================================================

ipcMain.handle('auto-categorize', async (_event, platform: string) => {
  const settings = readSettings()
  const active = await db.getActiveAccount()
  const videos = await db.getAllCrawlContent(platform || 'bili', active?.id || 'default')
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

  const { createClient: createLlmClient } = require('../knower-agent/llm')
  const catClient = createLlmClient({
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
  const active = await db.getActiveAccount()
  return await db.getAllCategories(platform || null, active?.id || 'default')
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
  const active = await db.getActiveAccount()
  const result = await suggestTool.execute({ platform, count: 5, accountId: active?.id || 'default' })
  // 自动生成后保存历史记录
  if (result.topics && result.topics.length > 0) {
    await db.saveTopicHistory(platform, 'trend', result.topics, active?.id || 'default')
  }
  return result
})

ipcMain.handle('topics-trends', async (_event, platform: string) => {
  const active = await db.getActiveAccount()
  return await db.getRecentTrends(platform || 'bili', 7, active?.id || 'default')
})

ipcMain.handle('topics-save', async (_event, topic: Record<string, unknown>) => {
  const active = await db.getActiveAccount()
  await db.saveTopic(
    topic.platform as string,
    topic.title as string,
    topic.reason as string,
    topic.source as string,
    topic.estimatedPerformance as string,
    topic.tags as string[],
    topic.fullData as Record<string, unknown>,
    active?.id || 'default',
  )
  return true
})

ipcMain.handle('topics-saved', async (_event, platform?: string) => {
  const active = await db.getActiveAccount()
  return await db.getSavedTopics(platform || null, active?.id || 'default')
})

ipcMain.handle('topic-to-chat', async (_event, topic: Record<string, unknown>) => {
  pendingTopic = topic
  if (mainWindow) {
    mainWindow.webContents.send('topic-to-chat-event', JSON.stringify(topic))
  }
  return true
})

ipcMain.handle('topics-history-save', async (_event, platform: string, mode: string, topics: Record<string, unknown>[]) => {
  const active = await db.getActiveAccount()
  await db.saveTopicHistory(platform, mode, topics, active?.id || 'default')
  return true
})

ipcMain.handle('topics-history-list', async (_event, platform?: string, limit?: number) => {
  const active = await db.getActiveAccount()
  return await db.getTopicHistory(platform || null, active?.id || 'default', limit || 50)
})

ipcMain.handle('topics-history-star', async (_event, id: number) => {
  await db.toggleTopicHistoryStar(id)
  return true
})

ipcMain.handle('topics-history-delete', async (_event, id: number) => {
  await db.deleteTopicHistory(id)
  return true
})

// ============================================================
//  打开外部链接
// ============================================================
ipcMain.handle('open-url', async (_event, url: string) => {
  try {
    if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
      await shell.openExternal(url)
    }
  } catch { /* ignore */ }
  return true
})

// ============================================================
//  全网热点
// ============================================================

const TRENDING_DEFAULTS = { sources: ['bilibili', 'douyin', 'weibo'], order: ['bilibili', 'douyin', 'weibo'], lastRefresh: 0 }

function getTrendingConfig() {
  const settings = readSettings()
  const saved = settings.trendingConfig
  if (!saved) return TRENDING_DEFAULTS
  const order = (Array.isArray(saved.order) && saved.order.length > 0)
    ? saved.order
    : [...new Set([...(saved.sources || []), ...TRENDING_DEFAULTS.order])]
  return { ...saved, order }
}

function saveTrendingConfig(config: { sources: string[]; order: string[]; lastRefresh?: number }) {
  const settings = readSettings()
  settings.trendingConfig = config
  writeSettings(settings)
}

ipcMain.handle('trending-fetch', async (_event, platforms?: string[]) => {
  const trending = require('../knower-agent/lib/trending')
  const config = getTrendingConfig()
  const sources = platforms || config.sources || TRENDING_DEFAULTS.sources
  const result = await trending.fetchTrending(sources)
  return result
})

ipcMain.handle('trending-sources', async () => {
  const trending = require('../knower-agent/lib/trending')
  const config = getTrendingConfig()
  return { sources: trending.SOURCES, config }
})

ipcMain.handle('trending-set-config', async (_event, config: { sources: string[]; order: string[] }) => {
  saveTrendingConfig({ ...config, lastRefresh: Date.now() })
  return true
})
