const initSqlJs = require('sql.js')
const fs = require('fs')
const path = require('path')

const DB_PATH = path.join(__dirname, '..', 'knower.db')

let db

async function getDb() {
  if (!db) {
    const SQL = await initSqlJs()
    if (fs.existsSync(DB_PATH)) {
      const buffer = fs.readFileSync(DB_PATH)
      db = new SQL.Database(buffer)
    } else {
      db = new SQL.Database()
    }
    initTables()
  }
  return db
}

function saveDb() {
  const data = db.export()
  const buffer = Buffer.from(data)
  fs.writeFileSync(DB_PATH, buffer)
}

function initTables() {
  db.run(`
    CREATE TABLE IF NOT EXISTS scripts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT NOT NULL,
      analysis TEXT,
      result TEXT,
      created_at DATETIME DEFAULT (datetime('now','localtime'))
    )
  `)
  db.run(`
    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL DEFAULT '新对话',
      created_at DATETIME DEFAULT (datetime('now','localtime')),
      updated_at DATETIME DEFAULT (datetime('now','localtime'))
    )
  `)
  db.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at DATETIME DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (conversation_id) REFERENCES conversations(id)
    )
  `)
  db.run(`
    CREATE TABLE IF NOT EXISTS memories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id TEXT NOT NULL DEFAULT 'default',
      type TEXT NOT NULL,
      key TEXT NOT NULL,
      value TEXT NOT NULL,
      evidence TEXT,
      weight REAL NOT NULL DEFAULT 0.5,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )
  `)
  db.run(`
    CREATE TABLE IF NOT EXISTS overview_data (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      platform TEXT NOT NULL DEFAULT 'bilibili',
      total_play INTEGER DEFAULT 0,
      total_comment INTEGER DEFAULT 0,
      total_danmaku INTEGER DEFAULT 0,
      total_like INTEGER DEFAULT 0,
      total_share INTEGER DEFAULT 0,
      total_favorite INTEGER DEFAULT 0,
      total_coin INTEGER DEFAULT 0,
      follower_count INTEGER DEFAULT 0,
      follower_change_today INTEGER DEFAULT 0,
      revenue_year REAL DEFAULT 0,
      fetched_at DATETIME DEFAULT (datetime('now','localtime'))
    )
  `)
  db.run(`
    CREATE TABLE IF NOT EXISTS video_data (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      platform TEXT NOT NULL DEFAULT 'bilibili',
      video_id TEXT NOT NULL,
      title TEXT,
      published_at TEXT,
      duration INTEGER DEFAULT 0,
      play_count INTEGER DEFAULT 0,
      like_count INTEGER DEFAULT 0,
      comment_count INTEGER DEFAULT 0,
      share INTEGER DEFAULT 0,
      coin INTEGER DEFAULT 0,
      favorite INTEGER DEFAULT 0,
      danmaku INTEGER DEFAULT 0,
      fetched_at DATETIME DEFAULT (datetime('now','localtime')),
      UNIQUE(platform, video_id)
    )
  `)
}

async function saveScript(content, analysis, result) {
  const db = await getDb()
  // 先查当前最大 id
  const maxRes = db.exec('SELECT COALESCE(MAX(id), 0) FROM scripts')
  const nextId = (maxRes[0]?.values[0][0] || 0) + 1
  db.run(
    'INSERT INTO scripts (id, content, analysis, result) VALUES (?, ?, ?, ?)',
    [nextId, content, JSON.stringify(analysis), JSON.stringify(result)]
  )
  saveDb()
  return nextId
}

async function getScript(id) {
  const db = await getDb()
  const res = db.exec('SELECT * FROM scripts WHERE id = ?', [id])
  if (!res.length) return null
  const row = {}
  res[0].columns.forEach((col, i) => {
    row[col] = res[0].values[0][i]
  })
  row.analysis = JSON.parse(row.analysis)
  row.result = JSON.parse(row.result)
  return row
}

async function listScripts(limit = 20) {
  const db = await getDb()
  const res = db.exec(
    `SELECT id, created_at FROM scripts ORDER BY id DESC LIMIT ${limit}`
  )
  if (!res.length) return []
  return res[0].values.map((row) => ({
    id: row[0],
    created_at: row[1],
  }))
}

// --- 会话管理 ---

async function createConversation(title) {
  const db = await getDb()
  const maxRes = db.exec('SELECT COALESCE(MAX(id), 0) FROM conversations')
  const nextId = (maxRes[0]?.values[0][0] || 0) + 1
  db.run('INSERT INTO conversations (id, title) VALUES (?, ?)', [nextId, title || '新对话'])
  saveDb()
  return nextId
}

async function updateConversationTitle(id, title) {
  const db = await getDb()
  db.run('UPDATE conversations SET title = ?, updated_at = datetime("now","localtime") WHERE id = ?', [title, id])
  saveDb()
}

async function deleteConversation(id) {
  const db = await getDb()
  db.run('DELETE FROM messages WHERE conversation_id = ?', [id])
  db.run('DELETE FROM conversations WHERE id = ?', [id])
  saveDb()
}

async function listConversations(limit = 50) {
  const db = await getDb()
  const res = db.exec(
    `SELECT id, title, created_at, updated_at FROM conversations ORDER BY updated_at DESC LIMIT ${limit}`
  )
  if (!res.length) return []
  return res[0].values.map((row) => ({
    id: row[0],
    title: row[1],
    createdAt: row[2],
    updatedAt: row[3],
  }))
}

async function addMessage(conversationId, role, content) {
  const db = await getDb()
  db.run(
    'INSERT INTO messages (conversation_id, role, content) VALUES (?, ?, ?)',
    [conversationId, role, content]
  )
  db.run('UPDATE conversations SET updated_at = datetime("now","localtime") WHERE id = ?', [conversationId])
  saveDb()
}

async function getMessages(conversationId) {
  const db = await getDb()
  const res = db.exec(
    `SELECT id, role, content, created_at FROM messages WHERE conversation_id = ${conversationId} ORDER BY id ASC`
  )
  if (!res.length) return []
  return res[0].values.map((row) => ({
    id: String(row[0]),
    role: row[1],
    content: row[2],
    createdAt: row[3],
  }))
}

// --- 记忆管理 ---

async function upsertMemory(accountId, type, key, value, evidence) {
  const db = await getDb()
  const now = new Date().toISOString()
  const existing = db.exec(
    'SELECT id, weight FROM memories WHERE account_id = ? AND key = ?',
    [accountId, key]
  )
  if (existing.length && existing[0].values.length) {
    const id = existing[0].values[0][0]
    const oldWeight = existing[0].values[0][1]
    const newWeight = Math.min(oldWeight + 0.1, 1.0)
    db.run(
      'UPDATE memories SET value = ?, evidence = ?, weight = ?, updated_at = ? WHERE id = ?',
      [value, evidence, newWeight, now, id]
    )
  } else {
    db.run(
      'INSERT INTO memories (account_id, type, key, value, evidence, weight, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [accountId, type, key, value, evidence, 0.5, now, now]
    )
  }
  saveDb()
}

async function getMemories(accountId) {
  const db = await getDb()
  const res = db.exec(
    'SELECT type, key, value, evidence, weight FROM memories WHERE account_id = ? ORDER BY weight DESC',
    [accountId]
  )
  if (!res.length) return []
  return res[0].values.map((row) => ({
    type: row[0],
    key: row[1],
    value: row[2],
    evidence: row[3],
    weight: row[4],
  }))
}

// --- 平台数据 ---

async function saveOverviewData(data) {
  const db = await getDb()
  db.run(
    `INSERT INTO overview_data
      (platform, total_play, total_comment, total_danmaku, total_like,
       total_share, total_favorite, total_coin, follower_count,
       follower_change_today, revenue_year)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      data.platform || 'bilibili',
      data.total_play || 0,
      data.total_comment || 0,
      data.total_danmaku || 0,
      data.total_like || 0,
      data.total_share || 0,
      data.total_favorite || 0,
      data.total_coin || 0,
      data.follower_count || 0,
      data.follower_change_today || 0,
      data.revenue_year || 0,
    ]
  )
  saveDb()
}

async function getOverviewData(platform) {
  const db = await getDb()
  const res = db.exec(
    'SELECT * FROM overview_data WHERE platform = ? ORDER BY id DESC LIMIT 1',
    [platform || 'bilibili']
  )
  if (!res.length || !res[0].values.length) return null
  const row = {}
  res[0].columns.forEach((col, i) => { row[col] = res[0].values[0][i] })
  return row
}

async function saveVideoData(videos) {
  const db = await getDb()
  for (const v of videos) {
    db.run(
      `INSERT OR REPLACE INTO video_data
        (platform, video_id, title, published_at, duration,
         play_count, like_count, comment_count, share, coin, favorite, danmaku)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        v.platform || 'bilibili',
        v.video_id,
        v.title || '',
        v.published_at || null,
        v.duration || 0,
        v.play_count || 0,
        v.like_count || 0,
        v.comment_count || 0,
        v.share || 0,
        v.coin || 0,
        v.favorite || 0,
        v.danmaku || 0,
      ]
    )
  }
  saveDb()
}

async function getVideoData(platform, limit = 50) {
  const db = await getDb()
  const res = db.exec(
    `SELECT * FROM video_data WHERE platform = ? ORDER BY published_at DESC LIMIT ${limit}`,
    [platform || 'bilibili']
  )
  if (!res.length) return []
  return res[0].values.map((row) => {
    const obj = {}
    res[0].columns.forEach((col, i) => { obj[col] = row[i] })
    return obj
  })
}

module.exports = {
  getDb, saveScript, getScript, listScripts,
  createConversation, updateConversationTitle, deleteConversation,
  listConversations, addMessage, getMessages,
  upsertMemory, getMemories,
  saveOverviewData, getOverviewData, saveVideoData, getVideoData,
}
