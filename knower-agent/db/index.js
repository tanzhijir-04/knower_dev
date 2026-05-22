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
      last_fetched_at DATETIME DEFAULT (datetime('now','localtime'))
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

// --- 爬虫任务管理 ---

async function saveCrawlTask(platform, keywords, crawlerType, status, resultJson) {
  const db = await getDb()
  const maxRes = db.exec('SELECT COALESCE(MAX(id), 0) FROM crawl_tasks')
  const nextId = (maxRes[0]?.values[0][0] || 0) + 1
  db.run(
    'INSERT INTO crawl_tasks (id, platform, keywords, crawler_type, status, result_json) VALUES (?, ?, ?, ?, ?, ?)',
    [nextId, platform, keywords, crawlerType || 'search', status || 'pending', resultJson || null]
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

async function getCrawlTasks(limit = 50) {
  const db = await getDb()
  const res = db.exec(
    `SELECT id, platform, keywords, crawler_type, status, created_at, completed_at
     FROM crawl_tasks ORDER BY id DESC LIMIT ${limit}`
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
            play_count, created_at, fetched_at, category, source_uid, source_name
     FROM crawl_content WHERE task_id = ? ORDER BY id DESC LIMIT ${limit}`,
    [taskId]
  )
  if (!res.length) return []
  return res[0].values.map((row) => ({
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
    fetchedAt: row[13],
    category: (/^\d{4}-\d{2}-\d{2}/.test(row[14] || '')) ? '未分类' : (row[14] || '未分类'),
    sourceUid: row[15] || '',
    sourceName: row[16] || '',
  }))
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
        c.avatar || '',
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

async function cleanOldData() {
  const db = await getDb()
  db.run("DELETE FROM crawl_content WHERE source_uid = '' OR source_uid IS NULL")
  db.run("DELETE FROM creators")
  saveDb()
}

// --- 创作者管理 ---

async function saveCreator(uid, name, avatarUrl) {
  const db = await getDb()
  db.run(
    `INSERT INTO creators (uid, name, avatar_url, last_fetched_at)
     VALUES (?, ?, ?, datetime('now','localtime'))
     ON CONFLICT(uid) DO UPDATE SET name = ?, avatar_url = ?, last_fetched_at = datetime('now','localtime')`,
    [uid, name, avatarUrl || '', name, avatarUrl || '']
  )
  saveDb()
}

async function getCreators() {
  const db = await getDb()
  const res = db.exec(
    `SELECT uid, name, avatar_url, is_starred, is_pinned, last_fetched_at
     FROM creators ORDER BY is_pinned DESC, is_starred DESC, last_fetched_at DESC`
  )
  if (!res.length) return []
  return res[0].values.map((row) => ({
    uid: row[0],
    name: row[1],
    avatarUrl: row[2],
    isStarred: row[3],
    isPinned: row[4],
    lastFetchedAt: row[5],
  }))
}

async function starCreator(uid) {
  const db = await getDb()
  db.run(
    `UPDATE creators SET is_starred = CASE WHEN is_starred = 1 THEN 0 ELSE 1 END WHERE uid = ?`,
    [uid]
  )
  saveDb()
}

async function pinCreator(uid) {
  const db = await getDb()
  db.run(
    `UPDATE creators SET is_pinned = CASE WHEN is_pinned = 1 THEN 0 ELSE 1 END WHERE uid = ?`,
    [uid]
  )
  saveDb()
}

async function deleteCreator(uid) {
  const db = await getDb()
  db.run('DELETE FROM creators WHERE uid = ?', [uid])
  db.run('DELETE FROM crawl_content WHERE source_uid = ?', [uid])
  saveDb()
}

async function getAllCrawlContent(platform) {
  const db = await getDb()
  const res = db.exec(
    `SELECT id, platform, content_type, content_id, title, "desc",
            author_name, author_id, like_count, comment_count, share_count,
            play_count, created_at, raw_json, category, source_uid, source_name
     FROM crawl_content WHERE platform = ? ORDER BY play_count DESC`,
    [platform || 'bili']
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

// --- 来源管理 ---

async function getSourceList(platform) {
  const db = await getDb()
  const where = platform ? `WHERE platform = '${platform}'` : ''
  const res = db.exec(
    `SELECT source_uid, source_name, COUNT(*) as cnt
     FROM crawl_content ${where}
     GROUP BY source_uid
     ORDER BY cnt DESC`
  )
  // 获取创作者信息（含收藏/置顶状态）
  const creatorsRes = db.exec('SELECT uid, name, avatar_url, is_starred, is_pinned FROM creators')
  const creatorMap = {}
  if (creatorsRes.length) {
    for (const row of creatorsRes[0].values) {
      creatorMap[row[0]] = { name: row[1], avatarUrl: row[2], isStarred: row[3], isPinned: row[4] }
    }
  }
  if (!res.length) return []
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
    }
  })
}

async function getVideosBySource(platform, sourceUid) {
  const db = await getDb()
  let query = `SELECT id, platform, content_type, content_id, title, "desc",
            author_name, author_id, like_count, comment_count, share_count,
            play_count, created_at, raw_json, category, source_uid, source_name
     FROM crawl_content WHERE platform = ?`
  const params = [platform || 'bili']
  if (sourceUid) {
    query += ` AND source_uid = ?`
    params.push(sourceUid)
  }
  query += ` ORDER BY play_count DESC`

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
      createdAt: row[12],
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

async function getAllCategories(platform) {
  const db = await getDb()
  const where = platform ? `WHERE platform = '${platform}'` : ''
  const res = db.exec(
    `SELECT category, COUNT(*) as cnt FROM crawl_content ${where} GROUP BY category ORDER BY cnt DESC`
  )
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

async function getUncategorizedCount(platform) {
  const db = await getDb()
  const where = platform ? `AND platform = '${platform}'` : ''
  const res = db.exec(
    `SELECT COUNT(*) FROM crawl_content WHERE category = '未分类' ${where}`
  )
  return res.length ? res[0].values[0][0] : 0
}

module.exports = {
  getDb, saveScript, getScript, listScripts,
  createConversation, updateConversationTitle, deleteConversation,
  listConversations, addMessage, getMessages,
  upsertMemory, getMemories,
  saveCrawlTask, updateCrawlTaskStatus, saveCrawlContentBatch, getCrawlTasks, getCrawlContent,
  saveCrawlCreatorsBatch, getCrawlCreators, getAllCrawlContent,
  saveCreator, getCreators, starCreator, pinCreator, deleteCreator, cleanOldData,
  getSourceList, getVideosBySource,
  categorizeVideo, categorizeVideoBatch, getAllCategories, getUncategorizedCount,
}
