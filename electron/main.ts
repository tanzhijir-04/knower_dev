import electron from 'electron'
const { app, BrowserWindow, ipcMain, nativeImage } = electron
console.log('[DEBUG] electron module keys:', Object.keys(electron))
console.log('[DEBUG] app:', typeof app, app)
import path from 'node:path'
import fs from 'node:fs'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const Agent = require('../knower-agent/agent/core')

const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL']

let mainWindow: BrowserWindow | null = null

function createWindow() {
  // 设置窗口图标
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

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// --- Settings persistence via JSON file ---
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
  const settings = readSettings()
  return settings[key] ?? null
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

// --- Agent: 在主进程内直接运行 ---
let currentAbortController: AbortController | null = null

ipcMain.handle('agent-run', async (event, script: string, platforms: string[]) => {
  const settings = readSettings()
  const agent = new Agent({
    apiKey: settings.apiKey as string,
    model: (settings.model as string) || 'claude-sonnet-4-20250514',
    baseUrl: (settings.baseUrl as string) || '',
  })

  const prompt = `请帮我分析以下脚本，并为 ${platforms.join('、')} 三个平台生成发布物料：\n\n${script}`

  const abortController = new AbortController()
  currentAbortController = abortController

  try {
    for await (const evt of agent.stream(prompt, { platforms, signal: abortController.signal })) {
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
  }
})

ipcMain.handle('agent-stop', () => {
  if (currentAbortController) {
    currentAbortController.abort()
    currentAbortController = null
  }
  return true
})

// --- 会话管理 ---
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
