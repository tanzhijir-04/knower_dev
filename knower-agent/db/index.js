const initSqlJs = require('sql.js')
const fs = require('fs')
const path = require('path')

const DB_PATH = process.env.KNOWER_DB_PATH || path.join(__dirname, '..', 'knower.db')

let db
let _dirty = false
let _saveTimer = null

async function getDb() {
  if (!db) {
    const SQL = await initSqlJs()
    if (fs.existsSync(DB_PATH)) {
      const buffer = fs.readFileSync(DB_PATH)
      db = new SQL.Database(buffer)
    } else {
      db = new SQL.Database()
    }
    db.run('PRAGMA foreign_keys = ON')
    initTables()
  }
  return db
}

function saveDb() {
  _dirty = true
  if (_saveTimer) return
  _saveTimer = setTimeout(() => {
    _saveTimer = null
    if (!_dirty || !db) return
    _dirty = false
    const data = db.export()
    const buffer = Buffer.from(data)
    fs.writeFileSync(DB_PATH, buffer)
  }, 2000)
}

function flushDb() {
  if (_saveTimer) {
    clearTimeout(_saveTimer)
    _saveTimer = null
  }
  if (_dirty && db) {
    _dirty = false
    const data = db.export()
    const buffer = Buffer.from(data)
    fs.writeFileSync(DB_PATH, buffer)
  }
}

process.on('exit', flushDb)
process.on('SIGINT', () => { flushDb(); process.exit() })
process.on('SIGTERM', () => { flushDb(); process.exit() })

function initTables() {
  // ============================================================
  //  Accounts 表 — 多创作者账号管理
  // ============================================================
  db.run(`
    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      platform TEXT NOT NULL,
      uid TEXT DEFAULT '',
      avatar_url TEXT DEFAULT '',
      description TEXT DEFAULT '',
      is_active INTEGER DEFAULT 0,
      user_id TEXT NOT NULL DEFAULT 'default',
      created_at DATETIME DEFAULT (datetime('now','localtime')),
      updated_at DATETIME DEFAULT (datetime('now','localtime'))
    )
  `)

  db.run(`
    CREATE TABLE IF NOT EXISTS scripts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      content TEXT NOT NULL,
      analysis TEXT,
      result TEXT,
      created_at DATETIME DEFAULT (datetime('now','localtime'))
    )
  `)
  // 迁移: scripts 表加 account_id
  try {
    db.exec('SELECT account_id FROM scripts LIMIT 1')
  } catch {
    db.exec("ALTER TABLE scripts ADD COLUMN account_id TEXT NOT NULL DEFAULT 'default'")
    saveDb()
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL DEFAULT '新对话',
      is_pinned INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT (datetime('now','localtime')),
      updated_at DATETIME DEFAULT (datetime('now','localtime'))
    )
  `)
  // 迁移: conversations 表加 account_id
  try {
    db.exec('SELECT account_id FROM conversations LIMIT 1')
  } catch {
    db.exec("ALTER TABLE conversations ADD COLUMN account_id TEXT NOT NULL DEFAULT 'default'")
    saveDb()
  }
  // 迁移：如果旧表没有 is_pinned 列，添加
  try {
    db.exec('SELECT is_pinned FROM conversations LIMIT 1')
  } catch {
    db.exec('ALTER TABLE conversations ADD COLUMN is_pinned INTEGER DEFAULT 0')
    saveDb()
  }
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
      updated_at TEXT NOT NULL,
      UNIQUE(account_id, key)
    )
  `)
  db.run(`
    CREATE TABLE IF NOT EXISTS crawl_tasks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      platform TEXT NOT NULL,
      keywords TEXT,
      crawler_type TEXT DEFAULT 'search',
      status TEXT DEFAULT 'pending',
      result_json TEXT,
      created_at DATETIME DEFAULT (datetime('now','localtime')),
      completed_at DATETIME
    )
  `)
  // 迁移: crawl_tasks 表加 account_id
  try {
    db.exec('SELECT account_id FROM crawl_tasks LIMIT 1')
  } catch {
    db.exec("ALTER TABLE crawl_tasks ADD COLUMN account_id TEXT NOT NULL DEFAULT 'default'")
    saveDb()
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS crawl_content (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER,
      platform TEXT NOT NULL,
      content_type TEXT,
      content_id TEXT,
      title TEXT,
      "desc" TEXT,
      author_name TEXT,
      author_id TEXT,
      like_count INTEGER DEFAULT 0,
      comment_count INTEGER DEFAULT 0,
      share_count INTEGER DEFAULT 0,
      play_count INTEGER DEFAULT 0,
      created_at TEXT,
      raw_json TEXT,
      category TEXT DEFAULT '未分类',
      source_uid TEXT DEFAULT '',
      source_name TEXT DEFAULT '',
      fetched_at DATETIME DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (task_id) REFERENCES crawl_tasks(id),
      UNIQUE(platform, content_id)
    )
  `)
  // 迁移：如果旧表没有 source_uid 列，重建表
  try {
    db.exec('SELECT source_uid FROM crawl_content LIMIT 1')
  } catch {
    const rows = db.exec('SELECT * FROM crawl_content')
    db.run('DROP TABLE crawl_content')
    db.run(`
      CREATE TABLE crawl_content (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        task_id INTEGER,
        platform TEXT NOT NULL,
        content_type TEXT,
        content_id TEXT,
        title TEXT,
        "desc" TEXT,
        author_name TEXT,
        author_id TEXT,
        like_count INTEGER DEFAULT 0,
        comment_count INTEGER DEFAULT 0,
        share_count INTEGER DEFAULT 0,
        play_count INTEGER DEFAULT 0,
        created_at TEXT,
        raw_json TEXT,
        category TEXT DEFAULT '未分类',
        source_uid TEXT DEFAULT '',
        source_name TEXT DEFAULT '',
        fetched_at DATETIME DEFAULT (datetime('now','localtime')),
        FOREIGN KEY (task_id) REFERENCES crawl_tasks(id),
        UNIQUE(platform, content_id)
      )
    `)
    if (rows.length) {
      for (const row of rows[0].values) {
        // old: id,task_id,platform,content_type,content_id,title,desc,author_name,author_id,
        //      like_count,comment_count,share_count,play_count,created_at,raw_json,category,fetched_at
        // new: ... same ... + source_uid, source_name, fetched_at
        db.run(
          `INSERT OR IGNORE INTO crawl_content
            (id, task_id, platform, content_type, content_id, title, "desc",
             author_name, author_id, like_count, comment_count, share_count,
             play_count, created_at, raw_json, category, source_uid, source_name, fetched_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            row[0], row[1], row[2], row[3], row[4], row[5], row[6],
            row[7], row[8], row[9], row[10], row[11], row[12],
            row[13], row[14], row[15] || '未分类',
            '', '',
            row[16] || null,
          ]
        )
      }
    }
    saveDb()
  }
  db.run(`
    CREATE TABLE IF NOT EXISTS crawl_creators (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      task_id INTEGER,
      platform TEXT NOT NULL,
      user_id TEXT NOT NULL,
      nickname TEXT,
      avatar TEXT,
      total_fans INTEGER DEFAULT 0,
      total_liked INTEGER DEFAULT 0,
      total_play INTEGER DEFAULT 0,
      total_note INTEGER DEFAULT 0,
      description TEXT,
      ip_location TEXT,
      other_info TEXT,
      raw_json TEXT,
      fetched_at DATETIME DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (task_id) REFERENCES crawl_tasks(id),
      UNIQUE(platform, user_id)
    )
  `)
  db.run(`
    CREATE TABLE IF NOT EXISTS creators (
      uid TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      avatar_url TEXT DEFAULT '',
      is_starred INTEGER DEFAULT 0,
      is_pinned INTEGER DEFAULT 0,
      total_fans INTEGER DEFAULT 0,
      last_fetched_at DATETIME DEFAULT (datetime('now','localtime'))
    )
  `)
  // 迁移：如果旧表没有 total_fans 列，添加
  try {
    db.exec('SELECT total_fans FROM creators LIMIT 1')
  } catch {
    db.exec('ALTER TABLE creators ADD COLUMN total_fans INTEGER DEFAULT 0')
    saveDb()
  }
  // 迁移: creators 表加 account_id
  try {
    db.exec('SELECT account_id FROM creators LIMIT 1')
  } catch {
    db.exec("ALTER TABLE creators ADD COLUMN account_id TEXT NOT NULL DEFAULT 'default'")
    saveDb()
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS competitors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      platform TEXT NOT NULL,
      user_id TEXT NOT NULL,
      nickname TEXT NOT NULL,
      account_id TEXT NOT NULL DEFAULT 'default',
      last_checked_at TEXT,
      created_at TEXT DEFAULT (datetime('now','localtime')),
      UNIQUE(platform, user_id, account_id)
    )
  `)
  // 迁移: competitors 表加 last_checked_at
  try {
    db.exec('SELECT last_checked_at FROM competitors LIMIT 1')
  } catch {
    db.exec('ALTER TABLE competitors ADD COLUMN last_checked_at TEXT')
    saveDb()
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS saved_topics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      platform TEXT NOT NULL,
      title TEXT NOT NULL,
      reason TEXT,
      source TEXT,
      estimated_performance TEXT,
      tags TEXT,
      full_data TEXT,
      created_at DATETIME DEFAULT (datetime('now','localtime'))
    )
  `)
  // 迁移: saved_topics 表加 account_id
  try {
    db.exec('SELECT account_id FROM saved_topics LIMIT 1')
  } catch {
    db.exec("ALTER TABLE saved_topics ADD COLUMN account_id TEXT NOT NULL DEFAULT 'default'")
    saveDb()
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS video_analyses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      platform TEXT NOT NULL,
      source_uid TEXT NOT NULL DEFAULT '',
      analysis_json TEXT NOT NULL,
      video_count INTEGER NOT NULL DEFAULT 0,
      overview_json TEXT,
      created_at DATETIME DEFAULT (datetime('now','localtime')),
      UNIQUE(platform, source_uid)
    )
  `)
  // 迁移: video_analyses 表加 account_id
  try {
    db.exec('SELECT account_id FROM video_analyses LIMIT 1')
  } catch {
    db.exec("ALTER TABLE video_analyses ADD COLUMN account_id TEXT NOT NULL DEFAULT 'default'")
    saveDb()
  }
  // 修复分类脏数据：将 datetime 格式的 category 值重置为"未分类"
  db.run("UPDATE crawl_content SET category = '未分类' WHERE category LIKE '____-__-__%'")

  // 修复 UID 格式的 source_name：用 creators 表的真实名称更新
  try {
    const uidNames = db.exec(`
      SELECT c.uid, c.name FROM creators c
      WHERE c.uid IN (
        SELECT DISTINCT source_uid FROM crawl_content
        WHERE source_uid != '' AND source_uid = source_name AND source_uid GLOB '[0-9]*'
      )
    `)
    if (uidNames.length) {
      for (const row of uidNames[0].values) {
        db.run('UPDATE crawl_content SET source_name = ? WHERE source_uid = ? AND source_name = source_uid', [row[1], row[0]])
      }
      saveDb()
    }
  } catch { /* ignore */ }

  // ============================================================
  //  索引：加速常用查询
  // ============================================================
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_crawl_content_task_id ON crawl_content(task_id)',
    'CREATE INDEX IF NOT EXISTS idx_crawl_content_platform ON crawl_content(platform)',
    'CREATE INDEX IF NOT EXISTS idx_crawl_content_source_uid ON crawl_content(source_uid)',
    'CREATE INDEX IF NOT EXISTS idx_crawl_content_account ON crawl_content(task_id, platform)',
    'CREATE INDEX IF NOT EXISTS idx_crawl_tasks_account_id ON crawl_tasks(account_id)',
    'CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages(conversation_id)',
    'CREATE INDEX IF NOT EXISTS idx_conversations_account_id ON conversations(account_id)',
    'CREATE INDEX IF NOT EXISTS idx_scripts_account_id ON scripts(account_id)',
    'CREATE INDEX IF NOT EXISTS idx_memories_account_id ON memories(account_id)',
    'CREATE INDEX IF NOT EXISTS idx_saved_topics_account_id ON saved_topics(account_id)',
    'CREATE INDEX IF NOT EXISTS idx_topic_history_account_id ON topic_history(account_id)',
    'CREATE INDEX IF NOT EXISTS idx_creators_account_id ON creators(account_id)',
    'CREATE INDEX IF NOT EXISTS idx_video_analyses_platform ON video_analyses(platform, source_uid, account_id)',
    'CREATE INDEX IF NOT EXISTS idx_embeddings_account ON embeddings(account_id, source_type)',
  ]
  for (const idx of indexes) {
    try { db.run(idx) } catch { /* ignore */ }
  }

  // ============================================================
  //  topic_history 表 — 选题生成历史
  // ============================================================
  db.run(`
    CREATE TABLE IF NOT EXISTS topic_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      platform TEXT NOT NULL,
      mode TEXT DEFAULT 'trend',
      topics_json TEXT NOT NULL,
      topic_count INTEGER DEFAULT 0,
      is_starred INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT (datetime('now','localtime')),
      account_id TEXT NOT NULL DEFAULT 'default'
    )
  `)

  // ============================================================
  //  embeddings 表 — RAG 向量索引元数据
  // ============================================================
  db.run(`
    CREATE TABLE IF NOT EXISTS embeddings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      account_id TEXT NOT NULL DEFAULT 'default',
      source_type TEXT NOT NULL,
      source_id INTEGER NOT NULL,
      content_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT (datetime('now','localtime')),
      UNIQUE(source_type, source_id)
    )
  `)

  // 修复头像：从 crawl_content.raw_json 回补 creators.avatar_url
  try {
    const needAvatar = db.exec(`
      SELECT uid FROM creators WHERE avatar_url = '' OR avatar_url IS NULL
    `)
    if (needAvatar.length) {
      for (const row of needAvatar[0].values) {
        const rawRes = db.exec('SELECT raw_json FROM crawl_content WHERE source_uid = ? LIMIT 1', [row[0]])
        if (rawRes.length && rawRes[0].values.length) {
          try {
            const raw = JSON.parse(rawRes[0].values[0][0] || '{}')
            const avatar = raw.face || raw.author?.face || raw.pic || ''
            if (avatar) {
              db.run('UPDATE creators SET avatar_url = ? WHERE uid = ?', [avatar, row[0]])
            }
          } catch { /* ignore */ }
        }
      }
      saveDb()
    }
  } catch { /* ignore */ }
}

async function saveScript(content, analysis, result, accountId = 'default') {
  const db = await getDb()
  // 先查当前最大 id
  const maxRes = db.exec('SELECT COALESCE(MAX(id), 0) FROM scripts')
  const nextId = (maxRes[0]?.values[0][0] || 0) + 1
  db.run(
    'INSERT INTO scripts (id, content, analysis, result, account_id) VALUES (?, ?, ?, ?, ?)',
    [nextId, content, JSON.stringify(analysis), JSON.stringify(result), accountId]
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

async function listScripts(limit = 20, accountId = 'default') {
  const db = await getDb()
  const res = db.exec(
    'SELECT id, created_at FROM scripts WHERE account_id = ? ORDER BY id DESC LIMIT ?',
    [accountId, limit]
  )
  if (!res.length) return []
  return res[0].values.map((row) => ({
    id: row[0],
    created_at: row[1],
  }))
}

// --- 会话管理 ---

async function createConversation(title, accountId = 'default') {
  const db = await getDb()
  const maxRes = db.exec('SELECT COALESCE(MAX(id), 0) FROM conversations')
  const nextId = (maxRes[0]?.values[0][0] || 0) + 1
  db.run('INSERT INTO conversations (id, title, account_id) VALUES (?, ?, ?)', [nextId, title || '新对话', accountId])
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

async function togglePinConversation(id) {
  const db = await getDb()
  db.run(
    'UPDATE conversations SET is_pinned = CASE WHEN is_pinned = 1 THEN 0 ELSE 1 END WHERE id = ?',
    [id]
  )
  saveDb()
}

async function deleteMessage(id) {
  const db = await getDb()
  db.run('DELETE FROM messages WHERE id = ?', [id])
  saveDb()
  return true
}


async function listConversations(limit = 50, accountId = 'default') {
  const db = await getDb()
  const res = db.exec(
    'SELECT id, title, is_pinned, created_at, updated_at FROM conversations WHERE account_id = ? ORDER BY is_pinned DESC, updated_at DESC LIMIT ?',
    [accountId, limit]
  )
  if (!res.length) return []
  return res[0].values.map((row) => ({
    id: row[0],
    title: row[1],
    isPinned: row[2] || 0,
    createdAt: row[3],
    updatedAt: row[4],
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
    'SELECT id, role, content, created_at FROM messages WHERE conversation_id = ? ORDER BY id ASC',
    [conversationId]
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

// --- 爬虫任务管理 ---

async function saveCrawlTask(platform, keywords, crawlerType, status, resultJson, accountId = 'default') {
  const db = await getDb()
  const maxRes = db.exec('SELECT COALESCE(MAX(id), 0) FROM crawl_tasks')
  const nextId = (maxRes[0]?.values[0][0] || 0) + 1
  db.run(
    'INSERT INTO crawl_tasks (id, platform, keywords, crawler_type, status, result_json, account_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [nextId, platform, keywords, crawlerType || 'search', status || 'pending', resultJson || null, accountId]
  )
  saveDb()
  return nextId
}

async function updateCrawlTaskStatus(taskId, status, resultJson) {
  const db = await getDb()
  if (resultJson) {
    db.run(
      'UPDATE crawl_tasks SET status = ?, result_json = ?, completed_at = datetime("now","localtime") WHERE id = ?',
      [status, resultJson, taskId]
    )
  } else {
    db.run(
      'UPDATE crawl_tasks SET status = ?, completed_at = datetime("now","localtime") WHERE id = ?',
      [status, taskId]
    )
  }
  saveDb()
}

async function saveCrawlContentBatch(taskId, platform, contents, sourceUid, sourceName) {
  const db = await getDb()
  for (const item of contents) {
    const contentId = item.video_id || item.note_id || item.aweme_id || item.comment_id || ''
    db.run(
      `INSERT OR REPLACE INTO crawl_content
        (task_id, platform, content_type, content_id, title, "desc",
         author_name, author_id, like_count, comment_count, share_count,
         play_count, created_at, raw_json, source_uid, source_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        taskId,
        platform,
        item.video_id ? 'video' : (item.note_id ? 'note' : 'content'),
        contentId,
        item.title || '',
        item.desc || '',
        item.nickname || item.author_name || '',
        item.user_id || item.author_id || '',
        parseInt(item.liked_count) || 0,
        parseInt(item.video_comment || item.comment_count) || 0,
        parseInt(item.video_share_count || item.share_count || item.share) || 0,
        parseInt(item.video_play_count || item.play_count) || 0,
        item.create_time || item.created_at || null,
        JSON.stringify(item),
        sourceUid || '',
        sourceName || '',
      ]
    )
  }
  saveDb()
}

async function getCrawlTasks(limit = 50, accountId = 'default') {
  const db = await getDb()
  const res = db.exec(
    'SELECT id, platform, keywords, crawler_type, status, created_at, completed_at FROM crawl_tasks WHERE account_id = ? ORDER BY id DESC LIMIT ?',
    [accountId, limit]
  )
  if (!res.length) return []
  return res[0].values.map((row) => ({
    id: row[0],
    platform: row[1],
    keywords: row[2],
    crawlerType: row[3],
    status: row[4],
    createdAt: row[5],
    completedAt: row[6],
  }))
}

async function getCrawlContent(taskId, limit = 100) {
  const db = await getDb()
  const res = db.exec(
    `SELECT id, platform, content_type, content_id, title, "desc",
            author_name, author_id, like_count, comment_count, share_count,
            play_count, created_at, raw_json, category, source_uid, source_name
     FROM crawl_content WHERE task_id = ? ORDER BY id DESC LIMIT ?`,
    [taskId, limit]
  )
  if (!res.length) return []
  return res[0].values.map((row) => {
    let raw = {}
    try { raw = JSON.parse(row[13] || '{}') } catch { /* ignore */ }
    let cat = row[14] || '未分类'
    if (/^\d{4}-\d{2}-\d{2}/.test(cat)) cat = '未分类'
    return {
      id: row[0],
      platform: row[1],
      contentType: row[2],
      contentId: row[3],
      title: row[4],
      desc: row[5],
      authorName: row[6],
      authorId: row[7],
      likeCount: row[8],
      commentCount: row[9],
      shareCount: row[10],
      playCount: row[11],
      createdAt: row[12],
      rawJson: raw,
      category: cat,
      sourceUid: row[15] || '',
      sourceName: row[16] || '',
    }
  })
}

// --- 爬虫创作者 ---

async function saveCrawlCreatorsBatch(taskId, platform, creators) {
  const db = await getDb()
  for (const c of creators) {
    db.run(
      `INSERT OR REPLACE INTO crawl_creators
        (task_id, platform, user_id, nickname, avatar,
         total_fans, total_liked, total_play, total_note,
         description, ip_location, other_info, raw_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        taskId,
        platform,
        c.user_id || '',
        c.nickname || '',
        c.avatar || c.face || c.avatar_url || '',
        parseInt(c.total_fans) || 0,
        parseInt(c.total_liked) || 0,
        parseInt(c.total_play) || 0,
        parseInt(c.total_note) || 0,
        c.description || '',
        c.ip_location || '',
        c.other_info || '',
        JSON.stringify(c),
      ]
    )
  }
  saveDb()
}

async function getCrawlCreators(taskId, limit = 100) {
  const db = await getDb()
  const res = db.exec(
    `SELECT id, platform, user_id, nickname, avatar,
            total_fans, total_liked, total_play, total_note,
            description, ip_location, fetched_at
     FROM crawl_creators WHERE task_id = ? ORDER BY id DESC LIMIT ${limit}`,
    [taskId]
  )
  if (!res.length) return []
  return res[0].values.map((row) => ({
    id: row[0],
    platform: row[1],
    userId: row[2],
    nickname: row[3],
    avatar: row[4],
    totalFans: row[5],
    totalLiked: row[6],
    totalPlay: row[7],
    totalNote: row[8],
    description: row[9],
    ipLocation: row[10],
    fetchedAt: row[11],
  }))
}

// --- 临时：清理旧数据 ---

async function cleanOldData(accountId = 'default') {
  const db = await getDb()
  db.run(
    `DELETE FROM crawl_content WHERE task_id IN (SELECT id FROM crawl_tasks WHERE account_id = ?)`,
    [accountId]
  )
  db.run(
    `DELETE FROM creators WHERE account_id = ?`,
    [accountId]
  )
  saveDb()
}

// --- 创作者管理 ---

async function saveCreator(uid, name, avatarUrl, totalFans, accountId = 'default') {
  const db = await getDb()
  db.run(
    `INSERT INTO creators (uid, name, avatar_url, total_fans, account_id, last_fetched_at)
     VALUES (?, ?, ?, ?, ?, datetime('now','localtime'))
     ON CONFLICT(uid) DO UPDATE SET name = ?, avatar_url = ?, total_fans = ?, account_id = ?, last_fetched_at = datetime('now','localtime')`,
    [uid, name, avatarUrl || '', totalFans || 0, accountId, name, avatarUrl || '', totalFans || 0, accountId]
  )
  saveDb()
}

async function getCreators(accountId = 'default') {
  const db = await getDb()
  const res = db.exec(
    `SELECT uid, name, avatar_url, is_starred, is_pinned, total_fans, last_fetched_at
     FROM creators WHERE account_id = ? ORDER BY is_pinned DESC, is_starred DESC, last_fetched_at DESC`,
    [accountId]
  )
  if (!res.length) return []
  return res[0].values.map((row) => ({
    uid: row[0],
    name: row[1],
    avatarUrl: row[2],
    isStarred: row[3],
    isPinned: row[4],
    totalFans: row[5] || 0,
    lastFetchedAt: row[6],
  }))
}

async function starCreator(uid, accountId = 'default') {
  const db = await getDb()
  db.run(
    `UPDATE creators SET is_starred = CASE WHEN is_starred = 1 THEN 0 ELSE 1 END WHERE uid = ? AND account_id = ?`,
    [uid, accountId]
  )
  saveDb()
}

async function pinCreator(uid, accountId = 'default') {
  const db = await getDb()
  db.run(
    `UPDATE creators SET is_pinned = CASE WHEN is_pinned = 1 THEN 0 ELSE 1 END WHERE uid = ? AND account_id = ?`,
    [uid, accountId]
  )
  saveDb()
}

async function deleteCreator(uid, accountId = 'default') {
  const db = await getDb()
  db.run('DELETE FROM creators WHERE uid = ? AND account_id = ?', [uid, accountId])
  saveDb()
}

async function getAllCrawlContent(platform, accountId = 'default') {
  const db = await getDb()
  let query = `SELECT cc.id, cc.platform, cc.content_type, cc.content_id, cc.title, cc."desc",
            cc.author_name, cc.author_id, cc.like_count, cc.comment_count, cc.share_count,
            cc.play_count, cc.created_at, cc.raw_json, cc.category, cc.source_uid, cc.source_name
     FROM crawl_content cc
     INNER JOIN crawl_tasks ct ON cc.task_id = ct.id
     WHERE ct.account_id = ?`
  const params = [accountId]
  if (platform) {
    query += ' AND cc.platform = ?'
    params.push(platform)
  }
  query += ' ORDER BY cc.play_count DESC'
  const res = db.exec(query, params)
  if (!res.length) return []
  return res[0].values.map((row) => {
    let raw = {}
    try { raw = JSON.parse(row[13] || '{}') } catch { /* ignore */ }
    let cat = row[14] || '未分类'
    if (/^\d{4}-\d{2}-\d{2}/.test(cat)) cat = '未分类'
    return {
      id: row[0],
      platform: row[1],
      contentType: row[2],
      contentId: row[3],
      title: row[4],
      desc: row[5],
      authorName: row[6],
      authorId: row[7],
      likeCount: row[8],
      commentCount: row[9],
      shareCount: row[10],
      playCount: row[11],
      createdAt: (() => {
        const raw2 = row[12]
        if (!raw2) return ''
        const ts = Number(raw2)
        if (ts > 946684800 && ts < 4102444800) return new Date(ts * 1000).toISOString()
        return raw2
      })(),
      rawJson: raw,
      category: cat,
      sourceUid: row[15] || '',
      sourceName: row[16] || '',
    }
  })
}

// --- 来源管理 ---

async function getSourceList(platform, accountId = 'default') {
  const db = await getDb()
  let query = `SELECT cc.source_uid, cc.source_name, COUNT(*) as cnt
     FROM crawl_content cc
     INNER JOIN crawl_tasks ct ON cc.task_id = ct.id
     WHERE ct.account_id = ?`
  const params = [accountId]
  if (platform) {
    query += ' AND cc.platform = ?'
    params.push(platform)
  }
  query += ' GROUP BY cc.source_uid ORDER BY cnt DESC'
  const res = db.exec(query, params)
  // 获取创作者信息（含收藏/置顶状态）
  const creatorsRes = db.exec('SELECT uid, name, avatar_url, is_starred, is_pinned, total_fans FROM creators')
  const creatorMap = {}
  if (creatorsRes.length) {
    for (const row of creatorsRes[0].values) {
      creatorMap[row[0]] = { name: row[1], avatarUrl: row[2], isStarred: row[3], isPinned: row[4], totalFans: row[5] || 0 }
    }
  }

  // Avatar fallback: extract from raw_json if not in creators table
  const needsAvatar = res[0].values
    .filter(row => !String(row[0] || '').startsWith('keyword_') && row[0])
    .map(row => String(row[0]))
    .filter(uid => !creatorMap[uid] || !creatorMap[uid].avatarUrl);
  for (const uid of needsAvatar) {
    const avatarRes = db.exec('SELECT raw_json FROM crawl_content WHERE source_uid = ? LIMIT 1', [uid]);
    if (avatarRes.length && avatarRes[0].values.length) {
      try {
        const raw = JSON.parse(avatarRes[0].values[0][0] || '{}');
        const avatar = raw.face || raw.avatar || raw.author?.face || raw.author?.avatar || '';
        if (avatar) {
          if (!creatorMap[uid]) creatorMap[uid] = { name: uid, avatarUrl: '', isStarred: 0, isPinned: 0 };
          creatorMap[uid].avatarUrl = avatar;
        }
      } catch {}
    }
  }

  if (!res.length) return []

  // DEBUG: log avatar data
  console.log('[getSourceList] creatorMap keys:', Object.keys(creatorMap));
  for (const k of Object.keys(creatorMap)) {
    console.log('[getSourceList]', k, '-> avatarUrl:', creatorMap[k].avatarUrl ? creatorMap[k].avatarUrl.slice(0, 60) : '(empty)');
  }

  return res[0].values.map((row) => {
    const uid = row[0] || ''
    const isKeyword = uid.startsWith('keyword_')
    const creator = !isKeyword && uid ? creatorMap[uid] : null
    return {
      sourceUid: uid,
      sourceName: row[1] || '未知来源',
      count: row[2],
      type: isKeyword ? 'keyword' : (uid ? 'creator' : 'unknown'),
      avatarUrl: creator?.avatarUrl || '',
      isStarred: creator?.isStarred || 0,
      isPinned: creator?.isPinned || 0,
      totalFans: creator?.totalFans || 0,
    }
  })
}

async function getVideosBySource(platform, sourceUid, accountId = 'default') {
  const db = await getDb()
  let query = `SELECT cc.id, cc.platform, cc.content_type, cc.content_id, cc.title, cc."desc",
            cc.author_name, cc.author_id, cc.like_count, cc.comment_count, cc.share_count,
            cc.play_count, cc.created_at, cc.raw_json, cc.category, cc.source_uid, cc.source_name
     FROM crawl_content cc
     INNER JOIN crawl_tasks ct ON cc.task_id = ct.id
     WHERE ct.account_id = ?`
  const params = [accountId]
  if (platform) {
    query += ` AND cc.platform = ?`
    params.push(platform)
  }
  if (sourceUid) {
    query += ` AND cc.source_uid = ?`
    params.push(sourceUid)
  }
  query += ` ORDER BY cc.play_count DESC`

  const res = db.exec(query, params)
  if (!res.length) return []
  return res[0].values.map((row) => {
    let raw = {}
    try { raw = JSON.parse(row[13] || '{}') } catch { /* ignore */ }
    let cat = row[14] || '未分类'
    if (/^\d{4}-\d{2}-\d{2}/.test(cat)) cat = '未分类'
    return {
      id: row[0],
      platform: row[1],
      contentType: row[2],
      contentId: row[3],
      title: row[4],
      desc: row[5],
      authorName: row[6],
      authorId: row[7],
      likeCount: row[8],
      commentCount: row[9],
      shareCount: row[10],
      playCount: row[11],
      createdAt: (() => {
        const raw2 = row[12]
        if (!raw2) return ''
        const ts = Number(raw2)
        if (ts > 946684800 && ts < 4102444800) return new Date(ts * 1000).toISOString()
        return raw2
      })(),
      rawJson: raw,
      category: cat,
      sourceUid: row[15] || '',
      sourceName: row[16] || '',
    }
  })
}

// --- 分类管理 ---

async function categorizeVideo(contentId, category) {
  const db = await getDb()
  db.run(
    'UPDATE crawl_content SET category = ? WHERE content_id = ?',
    [category, contentId]
  )
  saveDb()
}

async function categorizeVideoBatch(updates) {
  const db = await getDb()
  for (const { contentId, category } of updates) {
    db.run(
      'UPDATE crawl_content SET category = ? WHERE content_id = ?',
      [category, contentId]
    )
  }
  saveDb()
}

async function getAllCategories(platform, accountId = 'default') {
  const db = await getDb()
  let query = `SELECT cc.category, COUNT(*) as cnt
     FROM crawl_content cc
     INNER JOIN crawl_tasks ct ON cc.task_id = ct.id
     WHERE ct.account_id = ?`
  const params = [accountId]
  if (platform) {
    query += ' AND cc.platform = ?'
    params.push(platform)
  }
  query += ' GROUP BY cc.category ORDER BY cnt DESC'
  const res = db.exec(query, params)
  if (!res.length) return []
  // 合并时间戳格式的分类到"未分类"，再重新统计
  const merged = { '未分类': 0 }
  for (const row of res[0].values) {
    const cat = (/^\d{4}-\d{2}-\d{2}/.test(row[0] || '')) ? '未分类' : (row[0] || '未分类')
    merged[cat] = (merged[cat] || 0) + row[1]
  }
  return Object.entries(merged)
    .filter(([k]) => k !== '未分类' || merged['未分类'] > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([category, count]) => ({ category, count }))
}

async function getUncategorizedCount(platform, accountId = 'default') {
  const db = await getDb()
  let query = `SELECT COUNT(*)
     FROM crawl_content cc
     INNER JOIN crawl_tasks ct ON cc.task_id = ct.id
     WHERE ct.account_id = ? AND cc.category = '未分类'`
  const params = [accountId]
  if (platform) {
    query += ' AND cc.platform = ?'
    params.push(platform)
  }
  const res = db.exec(query, params)
  return res.length ? res[0].values[0][0] : 0
}

// --- 灵感库 ---

async function saveTopic(platform, title, reason, source, estimatedPerformance, tags, fullData, accountId = 'default') {
  const db = await getDb()
  db.run(
    'INSERT INTO saved_topics (platform, title, reason, source, estimated_performance, tags, full_data, account_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [platform, title, reason || '', source || '', estimatedPerformance || '', JSON.stringify(tags || []), JSON.stringify(fullData || {}), accountId]
  )
  saveDb()
}

async function getSavedTopics(platform, accountId = 'default') {
  const db = await getDb()
  let query = 'SELECT id, platform, title, reason, source, estimated_performance, tags, full_data, created_at FROM saved_topics WHERE account_id = ?'
  const params = [accountId]
  if (platform) {
    query += ' AND platform = ?'
    params.push(platform)
  }
  query += ' ORDER BY id DESC'
  const res = db.exec(query, params)
  if (!res.length) return []
  return res[0].values.map((row) => ({
    id: row[0],
    platform: row[1],
    title: row[2],
    reason: row[3],
    source: row[4],
    estimatedPerformance: row[5],
    tags: JSON.parse(row[6] || '[]'),
    fullData: JSON.parse(row[7] || '{}'),
    createdAt: row[8],
  }))
}

async function deleteSavedTopic(id) {
  const db = await getDb()
  db.run('DELETE FROM saved_topics WHERE id = ?', [id])
  saveDb()
}

// --- 选题历史 ---

async function saveTopicHistory(platform, mode, topics, accountId = 'default') {
  const db = await getDb()
  db.run(
    'INSERT INTO topic_history (platform, mode, topics_json, topic_count, account_id) VALUES (?, ?, ?, ?, ?)',
    [platform, mode || 'trend', JSON.stringify(topics || []), (topics || []).length, accountId]
  )
  saveDb()
}

async function getTopicHistory(platform, accountId = 'default', limit = 50) {
  const db = await getDb()
  let query = 'SELECT id, platform, mode, topics_json, topic_count, is_starred, created_at FROM topic_history WHERE account_id = ?'
  const params = [accountId]
  if (platform) {
    query += ' AND platform = ?'
    params.push(platform)
  }
  query += ' ORDER BY id DESC LIMIT ?'
  params.push(limit)
  const res = db.exec(query, params)
  if (!res.length) return []
  return res[0].values.map((row) => ({
    id: row[0],
    platform: row[1],
    mode: row[2],
    topics: JSON.parse(row[3] || '[]'),
    topicCount: row[4],
    isStarred: row[5],
    createdAt: row[6],
  }))
}

async function toggleTopicHistoryStar(id) {
  const db = await getDb()
  db.run(
    'UPDATE topic_history SET is_starred = CASE WHEN is_starred = 1 THEN 0 ELSE 1 END WHERE id = ?',
    [id]
  )
  saveDb()
}

async function deleteTopicHistory(id) {
  const db = await getDb()
  db.run('DELETE FROM topic_history WHERE id = ?', [id])
  saveDb()
}

async function getTopContent(platform, limit = 20, accountId = 'default') {
  const db = await getDb()
  const params = [accountId, platform || 'bili']
  const res = db.exec(
    `SELECT cc.title, cc."desc", cc.author_name, cc.play_count, cc.like_count, cc.comment_count, cc.share_count, cc.category, cc.created_at
     FROM crawl_content cc
     INNER JOIN crawl_tasks ct ON cc.task_id = ct.id
     WHERE ct.account_id = ? AND cc.platform = ?
     ORDER BY (cc.like_count + cc.comment_count + cc.share_count) * 1.0 / MAX(cc.play_count, 1) DESC
     LIMIT ?`,
    [...params, limit]
  )
  if (!res.length) return []
  return res[0].values.map((row) => ({
    title: row[0],
    desc: row[1],
    authorName: row[2],
    playCount: row[3],
    likeCount: row[4],
    commentCount: row[5],
    shareCount: row[6],
    category: row[7],
    createdAt: row[8],
  }))
}

async function getRecentTrends(platform, days = 7, accountId = 'default') {
  const db = await getDb()
  const dateThreshold = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)
  const res = db.exec(
    `SELECT cc.title, cc."desc", cc.author_name, cc.play_count, cc.like_count, cc.comment_count, cc.created_at
     FROM crawl_content cc
     INNER JOIN crawl_tasks ct ON cc.task_id = ct.id
     WHERE ct.account_id = ? AND cc.platform = ? AND cc.created_at >= ?
     ORDER BY cc.play_count DESC
     LIMIT 30`,
    [accountId, platform || 'bili', dateThreshold]
  )
  if (!res.length) return []
  return res[0].values.map((row) => ({
    title: row[0],
    desc: row[1],
    authorName: row[2],
    playCount: row[3],
    likeCount: row[4],
    commentCount: row[5],
    createdAt: row[6],
  }))
}

// --- AI 分析缓存 ---

async function saveVideoAnalysis(platform, sourceUid, analysis, videoCount, overview, accountId = 'default') {
  const db = await getDb()
  db.run(
    `INSERT OR REPLACE INTO video_analyses (platform, source_uid, analysis_json, video_count, overview_json, account_id)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [platform, sourceUid || '', JSON.stringify(analysis), videoCount, overview ? JSON.stringify(overview) : null, accountId]
  )
  saveDb()
}

async function getVideoAnalysis(platform, sourceUid, accountId = 'default') {
  const db = await getDb()
  const res = db.exec(
    'SELECT analysis_json, video_count, overview_json, created_at FROM video_analyses WHERE platform = ? AND source_uid = ? AND account_id = ?',
    [platform, sourceUid || '', accountId]
  )
  if (!res.length || !res[0].values.length) return null
  const row = res[0].values[0]
  return {
    analysis: JSON.parse(row[0]),
    videoCount: row[1],
    overview: row[2] ? JSON.parse(row[2]) : null,
    createdAt: row[3],
  }
}

async function deleteVideoAnalysis(platform, sourceUid, accountId = 'default') {
  const db = await getDb()
  db.run('DELETE FROM video_analyses WHERE platform = ? AND source_uid = ? AND account_id = ?', [platform, sourceUid || '', accountId])
  saveDb()
}

// --- 竞品分析 ---

async function getSourceDetail(sourceUid, platform, accountId = 'default') {
  const db = await getDb()
  let query = `SELECT cc.title, cc."desc", cc.like_count, cc.comment_count, cc.play_count, cc.share_count,
               cc.created_at, cc.category, cc.raw_json, cc.source_name
       FROM crawl_content cc
       INNER JOIN crawl_tasks ct ON cc.task_id = ct.id
       WHERE ct.account_id = ? AND cc.source_uid = ?`
  const params = [accountId, sourceUid]
  if (platform) {
    query += ' AND cc.platform = ?'
    params.push(platform)
  }
  query += ' ORDER BY cc.play_count DESC LIMIT 30'
  const res = db.exec(query, params)
  if (!res.length) return []
  return res[0].values.map((row) => {
    let raw = {}
    try { raw = JSON.parse(row[8] || '{}') } catch { /* ignore */ }
    return {
      title: row[0],
      desc: row[1],
      likeCount: row[2],
      commentCount: row[3],
      playCount: row[4],
      shareCount: row[5],
      createdAt: row[6],
      category: row[7],
      coinCount: parseInt(raw.video_coin_count) || 0,
      favoriteCount: parseInt(raw.video_favorite_count) || 0,
      sourceName: row[9] || '',
    }
  })
}

// 查询关键词来源的详细数据（按 keyword 前缀匹配）
async function getKeywordDetail(keyword, platform, accountId = 'default') {
  const db = await getDb()
  const sourceUid = 'keyword_' + keyword
  let query = `SELECT cc.title, cc."desc", cc.like_count, cc.comment_count, cc.play_count, cc.share_count,
               cc.created_at, cc.category, cc.raw_json, cc.author_name
       FROM crawl_content cc
       INNER JOIN crawl_tasks ct ON cc.task_id = ct.id
       WHERE ct.account_id = ? AND cc.source_uid = ?`
  const params = [accountId, sourceUid]
  if (platform) {
    query += ' AND cc.platform = ?'
    params.push(platform)
  }
  query += ' ORDER BY cc.play_count DESC LIMIT 30'
  const res = db.exec(query, params)
  if (!res.length) return []
  return res[0].values.map((row) => {
    let raw = {}
    try { raw = JSON.parse(row[8] || '{}') } catch { /* ignore */ }
    return {
      title: row[0],
      desc: row[1],
      likeCount: row[2],
      commentCount: row[3],
      playCount: row[4],
      shareCount: row[5],
      createdAt: row[6],
      category: row[7],
      coinCount: parseInt(raw.video_coin_count) || 0,
      favoriteCount: parseInt(raw.video_favorite_count) || 0,
      authorName: row[9] || '',
    }
  })
}

// --- 页面数据互通 ---

async function getRecentCrawlSummary(accountId = 'default') {
  const db = await getDb()
  const res = db.exec(`
    SELECT cc.source_name, cc.platform, COUNT(*) as cnt, SUM(cc.play_count) as total_play, SUM(cc.like_count) as total_like
    FROM crawl_content cc
    INNER JOIN crawl_tasks ct ON cc.task_id = ct.id
    WHERE ct.account_id = ? AND cc.source_uid != '' AND cc.source_uid IS NOT NULL
    GROUP BY cc.source_uid, cc.platform ORDER BY total_play DESC LIMIT 10
  `, [accountId])
  if (!res.length) return ''
  return res[0].values.map(row => {
    const platform = row[1] === 'bili' ? 'B站' : row[1] === 'dy' ? '抖音' : row[1] === 'xhs' ? '小红书' : row[1]
    return `- ${row[0] || '未知'}（${platform}）：${row[2]} 个视频，播放 ${row[3]?.toLocaleString() || 0}`
  }).join('\n')
}

function reloadDb() {
  if (_saveTimer) { clearTimeout(_saveTimer); _saveTimer = null }
  if (_dirty && db) {
    const data = db.export()
    const buffer = Buffer.from(data)
    fs.writeFileSync(DB_PATH, buffer)
  }
  _dirty = false
  db = null
}

// --- 账号管理 ---

async function createAccount({ name, platform, uid, avatarUrl, description }) {
  const db = await getDb()
  const id = `${platform}_${uid || Date.now()}`
  // 检查是否第一个账号，是则自动激活
  const countRes = db.exec('SELECT COUNT(*) FROM accounts')
  const count = countRes.length ? countRes[0].values[0][0] : 0
  const isActive = count === 0 ? 1 : 0
  db.run(
    `INSERT OR REPLACE INTO accounts (id, name, platform, uid, avatar_url, description, is_active, user_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'default', datetime('now','localtime'), datetime('now','localtime'))`,
    [id, name, platform, uid || '', avatarUrl || '', description || '', isActive]
  )
  saveDb()
  return id
}

async function listAccounts() {
  const db = await getDb()
  const res = db.exec('SELECT id, name, platform, uid, avatar_url, description, is_active, user_id, created_at, updated_at FROM accounts ORDER BY is_active DESC, updated_at DESC')
  if (!res.length) return []
  return res[0].values.map(row => ({
    id: row[0],
    name: row[1],
    platform: row[2],
    uid: row[3],
    avatarUrl: row[4],
    description: row[5],
    isActive: !!row[6],
    userId: row[7],
    createdAt: row[8],
    updatedAt: row[9],
  }))
}

async function getActiveAccount() {
  const db = await getDb()
  const res = db.exec("SELECT id, name, platform, uid, avatar_url, description, user_id FROM accounts WHERE is_active = 1 LIMIT 1")
  if (!res.length || !res[0].values.length) return null
  const row = res[0].values[0]
  return { id: row[0], name: row[1], platform: row[2], uid: row[3], avatarUrl: row[4], description: row[5], userId: row[6] }
}

async function switchAccount(accountId) {
  const db = await getDb()
  db.run('UPDATE accounts SET is_active = 0')
  db.run("UPDATE accounts SET is_active = 1, updated_at = datetime('now','localtime') WHERE id = ?", [accountId])
  saveDb()
}

async function updateAccount(accountId, updates) {
  const db = await getDb()
  const fields = []
  const values = []
  for (const [key, value] of Object.entries(updates)) {
    const col = key.replace(/([A-Z])/g, '_$1').toLowerCase()
    fields.push(`${col} = ?`)
    values.push(value)
  }
  if (fields.length === 0) return
  fields.push("updated_at = datetime('now','localtime')")
  values.push(accountId)
  db.run(`UPDATE accounts SET ${fields.join(', ')} WHERE id = ?`, values)
  saveDb()
}

async function deleteAccount(accountId) {
  const db = await getDb()
  // 级联删除关联数据
  db.run("DELETE FROM messages WHERE conversation_id IN (SELECT id FROM conversations WHERE account_id = ?)", [accountId])
  db.run('DELETE FROM conversations WHERE account_id = ?', [accountId])
  db.run('DELETE FROM scripts WHERE account_id = ?', [accountId])
  db.run("DELETE FROM crawl_content WHERE task_id IN (SELECT id FROM crawl_tasks WHERE account_id = ?)", [accountId])
  db.run('DELETE FROM crawl_tasks WHERE account_id = ?', [accountId])
  db.run('DELETE FROM saved_topics WHERE account_id = ?', [accountId])
  db.run('DELETE FROM video_analyses WHERE account_id = ?', [accountId])
  db.run('DELETE FROM memories WHERE account_id = ?', [accountId])
  db.run('DELETE FROM accounts WHERE id = ?', [accountId])
  // 如果删除的是当前激活账号，激活最近的账号
  const remaining = db.exec('SELECT id FROM accounts ORDER BY updated_at DESC LIMIT 1')
  if (remaining.length && remaining[0].values.length) {
    db.run("UPDATE accounts SET is_active = 1 WHERE id = ?", [remaining[0].values[0][0]])
  }
  saveDb()
}

// --- 竞品管理 ---

async function addCompetitor(platform, userId, nickname, accountId = 'default') {
  const db = await getDb()
  db.run(
    'INSERT INTO competitors (platform, user_id, nickname, account_id) VALUES (?, ?, ?, ?)',
    [platform, userId, nickname, accountId]
  )
  saveDb()
}

async function removeCompetitor(id) {
  const db = await getDb()
  db.run('DELETE FROM competitors WHERE id = ?', [id])
  saveDb()
}

async function getCompetitors(platform, accountId = 'default') {
  const db = await getDb()
  const result = db.exec(
    'SELECT id, platform, user_id, nickname, last_checked_at, created_at FROM competitors WHERE platform = ? AND account_id = ? ORDER BY created_at DESC',
    [platform, accountId]
  )
  if (!result.length || !result[0].values.length) return []
  return result[0].values.map(row => ({
    id: row[0],
    platform: row[1],
    userId: row[2],
    nickname: row[3],
    lastCheckedAt: row[4],
    createdAt: row[5],
  }))
}

async function getCompetitorRecentContent(platform, competitorUids, days = 7, accountId = 'default') {
  if (!competitorUids || !competitorUids.length) return []
  const db = await getDb()
  const dateThreshold = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)
  const placeholders = competitorUids.map(() => '?').join(',')
  const result = db.exec(
    `SELECT cc.title, cc.like_count, cc.comment_count, cc.share_count, cc.play_count, cc.author_name, cc.category
     FROM crawl_content cc
     INNER JOIN crawl_tasks ct ON cc.task_id = ct.id
     WHERE cc.platform = ? AND cc.source_uid IN (${placeholders}) AND ct.account_id = ?
       AND cc.created_at >= ?
     ORDER BY cc.created_at DESC`,
    [platform, ...competitorUids, accountId, dateThreshold]
  )
  if (!result.length) return []
  return result[0].values.map(row => ({
    title: row[0], likeCount: row[1], commentCount: row[2], shareCount: row[3],
    playCount: row[4], authorName: row[5], category: row[6],
  }))
}

module.exports = {
  getDb, saveDb: flushDb, reloadDb, saveScript, getScript, listScripts,
  createConversation, updateConversationTitle, deleteConversation, togglePinConversation,
  listConversations, addMessage, getMessages, deleteMessage,
  upsertMemory, getMemories,
  saveCrawlTask, updateCrawlTaskStatus, saveCrawlContentBatch, getCrawlTasks, getCrawlContent,
  saveCrawlCreatorsBatch, getCrawlCreators, getAllCrawlContent,
  saveCreator, getCreators, starCreator, pinCreator, deleteCreator, cleanOldData,
  getSourceList, getVideosBySource,
  categorizeVideo, categorizeVideoBatch, getAllCategories, getUncategorizedCount,
  saveTopic, getSavedTopics, deleteSavedTopic, getTopContent, getRecentTrends,
  saveTopicHistory, getTopicHistory, toggleTopicHistoryStar, deleteTopicHistory,
  saveVideoAnalysis, getVideoAnalysis, deleteVideoAnalysis, getRecentCrawlSummary,
  getSourceDetail, getKeywordDetail,
  createAccount, listAccounts, getActiveAccount, switchAccount, updateAccount, deleteAccount,
  addCompetitor, removeCompetitor, getCompetitors, getCompetitorRecentContent,
}
