# 给 CC 的提示词：后端全量（四功能数据库 + IPC + Agent 工具）

## 背景

知更要新增四个功能：内容日历、评论舆情、内容复盘、竞品订阅。你负责所有后端改动——数据库表 + CRUD 函数 + IPC Handler + Agent 工具。前端由另一个 CC 负责，你只管把接口写好。

项目路径：`C:\Users\20300\Desktop\knower_dev`

## 你只改这些文件

| 文件 | 改动 |
|---|---|
| `knower-agent/db/index.js` | 加 4 张新表 + 所有 CRUD 函数 |
| `electron/main.ts` | 加所有 IPC Handler |
| `src/types/electron.d.ts` | 加类型定义 + ElectronAPI 方法 |
| `knower-agent/agent/tools/analyze_comments.js` | 新建 |
| `knower-agent/agent/tools/record_review.js` | 新建 |
| `knower-agent/agent/tools/analyze_competitor.js` | 新建 |
| `knower-agent/agent/tools/index.js` | 注册 3 个新工具 |
| `knower-agent/lib/crawler.js` | 加评论爬取函数 |
| `knower-agent/lib/competitorWatcher.js` | 新建，后台定时检查竞品 |

**不要动**：前端组件、App.tsx、Sidebar、tailwind 配置。
---

## 第一步：db/index.js — 四张新表 + CRUD

在 `initTables()` 函数内部，找到所有现有建表语句的末尾（`sync_meta` 表之后），依次加入以下建表语句。所有 CRUD 函数写在现有函数之后、`module.exports` 之前。

### 1.1 内容日历 — publish_schedule 表

建表：

```sql
CREATE TABLE IF NOT EXISTS publish_schedule (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id TEXT NOT NULL DEFAULT 'default',
  topic_id INTEGER,
  platform TEXT NOT NULL,
  title TEXT NOT NULL,
  status TEXT DEFAULT 'planned',
  planned_date TEXT,
  planned_time TEXT,
  actual_date TEXT,
  notes TEXT DEFAULT '',
  created_at DATETIME DEFAULT (datetime('now','localtime')),
  updated_at DATETIME DEFAULT (datetime('now','localtime'))
)
```

索引：`CREATE INDEX IF NOT EXISTS idx_schedule_date ON publish_schedule(account_id, planned_date)`

CRUD 函数：

```javascript
async function createScheduleItem({ accountId, topicId, platform, title, plannedDate, plannedTime, notes }) {
  const db = await getDb()
  db.run(
    'INSERT INTO publish_schedule (account_id, topic_id, platform, title, planned_date, planned_time, notes) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [accountId || 'default', topicId || null, platform, title, plannedDate || null, plannedTime || null, notes || '']
  )
  saveDb()
}

async function getScheduleItems(accountId = 'default', startDate, endDate) {
  const db = await getDb()
  let query = 'SELECT id, account_id, topic_id, platform, title, status, planned_date, planned_time, actual_date, notes, created_at FROM publish_schedule WHERE account_id = ?'
  const params = [accountId]
  if (startDate) { query += ' AND planned_date >= ?'; params.push(startDate) }
  if (endDate) { query += ' AND planned_date <= ?'; params.push(endDate) }
  query += ' ORDER BY planned_date, planned_time'
  const res = db.exec(query, params)
  if (!res.length) return []
  return res[0].values.map(row => ({
    id: row[0], accountId: row[1], topicId: row[2], platform: row[3], title: row[4],
    status: row[5], plannedDate: row[6], plannedTime: row[7], actualDate: row[8],
    notes: row[9], createdAt: row[10],
  }))
}

async function updateScheduleItem(id, updates) {
  const db = await getDb()
  const fields = [], params = []
  for (const [key, val] of Object.entries(updates)) {
    fields.push(key.replace(/([A-Z])/g, '_$1').toLowerCase() + ' = ?')
    params.push(val)
  }
  fields.push("updated_at = datetime('now','localtime')")
  params.push(id)
  db.run('UPDATE publish_schedule SET ' + fields.join(', ') + ' WHERE id = ?', params)
  saveDb()
}

async function deleteScheduleItem(id) {
  const db = await getDb()
  db.run('DELETE FROM publish_schedule WHERE id = ?', [id])
  saveDb()
}

async function getRecommendedTimes(accountId = 'default', platform) {
  const db = await getDb()
  const res = db.exec(
    "SELECT substr(publish_time, 1, 2) as hour, AVG(like_count + coin_count + collect_count + comment_count) as avg_engagement FROM crawl_content WHERE account_id = ? AND platform = ? AND publish_time IS NOT NULL GROUP BY hour ORDER BY avg_engagement DESC LIMIT 3",
    [accountId, platform]
  )
  if (!res.length) return []
  return res[0].values.map(row => ({ hour: row[0], avgEngagement: row[1] }))
}
```

### 1.2 评论舆情 — comments 表

建表：

```sql
CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id TEXT NOT NULL DEFAULT 'default',
  video_id TEXT NOT NULL,
  platform TEXT NOT NULL,
  author_name TEXT DEFAULT '',
  author_uid TEXT DEFAULT '',
  content TEXT NOT NULL,
  like_count INTEGER DEFAULT 0,
  reply_count INTEGER DEFAULT 0,
  sentiment TEXT DEFAULT '',
  tags TEXT DEFAULT '[]',
  created_at DATETIME DEFAULT (datetime('now','localtime'))
)
```

索引：
- `CREATE INDEX IF NOT EXISTS idx_comments_video ON comments(account_id, video_id)`
- `CREATE INDEX IF NOT EXISTS idx_comments_platform ON comments(account_id, platform)`

CRUD 函数：

```javascript
async function saveComments(comments, accountId = 'default') {
  const db = await getDb()
  for (const c of comments) {
    db.run(
      'INSERT INTO comments (account_id, video_id, platform, author_name, author_uid, content, like_count, reply_count) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [accountId, c.videoId, c.platform, c.authorName || '', c.authorUid || '', c.content, c.likeCount || 0, c.replyCount || 0]
    )
  }
  saveDb()
}

async function getCommentsByVideo(videoId, accountId = 'default') {
  const db = await getDb()
  const res = db.exec('SELECT id, video_id, platform, author_name, content, like_count, reply_count, sentiment, tags, created_at FROM comments WHERE video_id = ? AND account_id = ? ORDER BY like_count DESC', [videoId, accountId])
  if (!res.length) return []
  return res[0].values.map(row => ({
    id: row[0], videoId: row[1], platform: row[2], authorName: row[3], content: row[4],
    likeCount: row[5], replyCount: row[6], sentiment: row[7], tags: JSON.parse(row[8] || '[]'), createdAt: row[9],
  }))
}

async function updateCommentSentiment(id, sentiment, tags) {
  const db = await getDb()
  db.run('UPDATE comments SET sentiment = ?, tags = ? WHERE id = ?', [sentiment, JSON.stringify(tags), id])
  saveDb()
}

async function getCommentSummary(accountId = 'default', platform) {
  const db = await getDb()
  let where = 'WHERE account_id = ?', params = [accountId]
  if (platform) { where += ' AND platform = ?'; params.push(platform) }
  const total = db.exec('SELECT COUNT(*) FROM comments ' + where, params)
  const sentiment = db.exec('SELECT sentiment, COUNT(*) FROM comments ' + where + ' GROUP BY sentiment', params)
  const topTags = db.exec('SELECT tags FROM comments ' + where + " AND tags != '[]'", params)
  const tagFreq = {}
  if (topTags.length) {
    for (const row of topTags[0].values) {
      for (const t of JSON.parse(row[0])) { tagFreq[t] = (tagFreq[t] || 0) + 1 }
    }
  }
  return {
    total: total.length ? total[0].values[0][0] : 0,
    sentimentBreakdown: sentiment.length ? sentiment[0].values : [],
    topTags: Object.entries(tagFreq).sort((a, b) => b[1] - a[1]).slice(0, 20).map(([tag, count]) => ({ tag, count })),
  }
}

async function deleteCommentsByVideo(videoId, accountId = 'default') {
  const db = await getDb()
  db.run('DELETE FROM comments WHERE video_id = ? AND account_id = ?', [videoId, accountId])
  saveDb()
}
```

### 1.3 内容复盘 — content_reviews 表

建表：

```sql
CREATE TABLE IF NOT EXISTS content_reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id TEXT NOT NULL DEFAULT 'default',
  schedule_id INTEGER,
  script_id INTEGER,
  platform TEXT NOT NULL,
  title TEXT NOT NULL,
  publish_date TEXT,
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  saves INTEGER DEFAULT 0,
  new_followers INTEGER DEFAULT 0,
  predicted_views INTEGER DEFAULT 0,
  predicted_likes INTEGER DEFAULT 0,
  ai_analysis TEXT DEFAULT '',
  user_notes TEXT DEFAULT '',
  rating INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT (datetime('now','localtime')),
  updated_at DATETIME DEFAULT (datetime('now','localtime'))
)
```

索引：
- `CREATE INDEX IF NOT EXISTS idx_reviews_account ON content_reviews(account_id, platform)`
- `CREATE INDEX IF NOT EXISTS idx_reviews_date ON content_reviews(account_id, publish_date)`

CRUD 函数：

```javascript
async function createReview(data, accountId = 'default') {
  const db = await getDb()
  db.run(
    'INSERT INTO content_reviews (account_id, schedule_id, script_id, platform, title, publish_date, views, likes, comments, shares, saves, new_followers, predicted_views, predicted_likes, user_notes, rating) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [accountId, data.scheduleId || null, data.scriptId || null, data.platform, data.title, data.publishDate || '', data.views || 0, data.likes || 0, data.comments || 0, data.shares || 0, data.saves || 0, data.newFollowers || 0, data.predictedViews || 0, data.predictedLikes || 0, data.userNotes || '', data.rating || 0]
  )
  saveDb()
}

async function getReviews(accountId = 'default', platform) {
  const db = await getDb()
  let query = 'SELECT id, account_id, schedule_id, script_id, platform, title, publish_date, views, likes, comments, shares, saves, new_followers, predicted_views, predicted_likes, ai_analysis, user_notes, rating, created_at FROM content_reviews WHERE account_id = ?'
  const params = [accountId]
  if (platform) { query += ' AND platform = ?'; params.push(platform) }
  query += ' ORDER BY publish_date DESC, created_at DESC'
  const res = db.exec(query, params)
  if (!res.length) return []
  return res[0].values.map(row => ({
    id: row[0], accountId: row[1], scheduleId: row[2], scriptId: row[3], platform: row[4],
    title: row[5], publishDate: row[6], views: row[7], likes: row[8], comments: row[9],
    shares: row[10], saves: row[11], newFollowers: row[12], predictedViews: row[13],
    predictedLikes: row[14], aiAnalysis: row[15], userNotes: row[16], rating: row[17], createdAt: row[18],
  }))
}

async function updateReview(id, updates) {
  const db = await getDb()
  const fields = [], params = []
  for (const [key, val] of Object.entries(updates)) {
    fields.push(key.replace(/([A-Z])/g, '_$1').toLowerCase() + ' = ?')
    params.push(val)
  }
  fields.push("updated_at = datetime('now','localtime')")
  params.push(id)
  db.run('UPDATE content_reviews SET ' + fields.join(', ') + ' WHERE id = ?', params)
  saveDb()
}

async function deleteReview(id) {
  const db = await getDb()
  db.run('DELETE FROM content_reviews WHERE id = ?', [id])
  saveDb()
}

async function getReviewStats(accountId = 'default', platform) {
  const db = await getDb()
  let where = 'WHERE account_id = ?', params = [accountId]
  if (platform) { where += ' AND platform = ?'; params.push(platform) }
  const total = db.exec('SELECT COUNT(*), AVG(views), AVG(likes), AVG(comments) FROM content_reviews ' + where, params)
  const byPlatform = db.exec('SELECT platform, COUNT(*), AVG(views), AVG(likes) FROM content_reviews ' + where + ' GROUP BY platform', params)
  return {
    total: total.length ? { count: total[0].values[0][0], avgViews: total[0].values[0][1], avgLikes: total[0].values[0][2], avgComments: total[0].values[0][3] } : null,
    byPlatform: byPlatform.length ? byPlatform[0].values.map(r => ({ platform: r[0], count: r[1], avgViews: r[2], avgLikes: r[3] })) : [],
  }
}
```

### 1.4 竞品订阅 — competitor_alerts 表

建表：

```sql
CREATE TABLE IF NOT EXISTS competitor_alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id TEXT NOT NULL DEFAULT 'default',
  competitor_id INTEGER NOT NULL,
  alert_type TEXT NOT NULL,
  title TEXT NOT NULL,
  detail TEXT DEFAULT '',
  is_read INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT (datetime('now','localtime'))
)
```

索引：`CREATE INDEX IF NOT EXISTS idx_alerts_account ON competitor_alerts(account_id, is_read)`

CRUD 函数：

```javascript
async function saveCompetitorAlert(alert, accountId = 'default') {
  const db = await getDb()
  db.run('INSERT INTO competitor_alerts (account_id, competitor_id, alert_type, title, detail) VALUES (?, ?, ?, ?, ?)',
    [accountId, alert.competitorId, alert.alertType, alert.title, alert.detail || ''])
  saveDb()
}

async function getCompetitorAlerts(accountId = 'default', unreadOnly = false) {
  const db = await getDb()
  let query = 'SELECT id, competitor_id, alert_type, title, detail, is_read, created_at FROM competitor_alerts WHERE account_id = ?'
  const params = [accountId]
  if (unreadOnly) { query += ' AND is_read = 0' }
  query += ' ORDER BY created_at DESC LIMIT 50'
  const res = db.exec(query, params)
  if (!res.length) return []
  return res[0].values.map(row => ({
    id: row[0], competitorId: row[1], alertType: row[2], title: row[3], detail: row[4], isRead: !!row[5], createdAt: row[6],
  }))
}

async function markAlertRead(id) {
  const db = await getDb()
  db.run('UPDATE competitor_alerts SET is_read = 1 WHERE id = ?', [id])
  saveDb()
}

async function markAllAlertsRead(accountId = 'default') {
  const db = await getDb()
  db.run('UPDATE competitor_alerts SET is_read = 1 WHERE account_id = ?', [accountId])
  saveDb()
}

async function updateCompetitorCheckTime(id) {
  const db = await getDb()
  db.run("UPDATE competitors SET last_checked_at = datetime('now','localtime') WHERE id = ?", [id])
  saveDb()
}

async function getStaleCompetitors(accountId = 'default', hoursThreshold = 24) {
  const db = await getDb()
  const res = db.exec("SELECT id, platform, user_id, nickname FROM competitors WHERE account_id = ? AND (last_checked_at IS NULL OR last_checked_at < datetime('now', '-' || ? || ' hours')) ORDER BY last_checked_at ASC NULLS FIRST", [accountId, hoursThreshold])
  if (!res.length) return []
  return res[0].values.map(row => ({ id: row[0], platform: row[1], userId: row[2], nickname: row[3] }))
}
```

### 1.5 更新 module.exports

在现有导出列表末尾加上：

```javascript
// 内容日历
createScheduleItem, getScheduleItems, updateScheduleItem, deleteScheduleItem, getRecommendedTimes,
// 评论舆情
saveComments, getCommentsByVideo, updateCommentSentiment, getCommentSummary, deleteCommentsByVideo,
// 内容复盘
createReview, getReviews, updateReview, deleteReview, getReviewStats,
// 竞品订阅
saveCompetitorAlert, getCompetitorAlerts, markAlertRead, markAllAlertsRead, updateCompetitorCheckTime, getStaleCompetitors,
```

---

## 第二步：electron/main.ts — 所有 IPC Handler

找到 main.ts 中现有 handler 的末尾（`sync-meta-get` 之后），加入以下 handler。每个 handler 通过 require 引用 db 函数。如果 main.ts 中已有 `getActiveAccount` helper，复用它。

### 2.1 内容日历

```typescript
ipcMain.handle('schedule-create', async (_event, data: Record<string, unknown>) => {
  const { createScheduleItem } = require('../knower-agent/db')
  await createScheduleItem(data)
  return { ok: true }
})
ipcMain.handle('schedule-list', async (_event, startDate?: string, endDate?: string) => {
  const { getScheduleItems } = require('../knower-agent/db')
  const active = await getActiveAccount()
  return getScheduleItems(active?.id || 'default', startDate, endDate)
})
ipcMain.handle('schedule-update', async (_event, id: number, updates: Record<string, unknown>) => {
  const { updateScheduleItem } = require('../knower-agent/db')
  await updateScheduleItem(id, updates)
  return { ok: true }
})
ipcMain.handle('schedule-delete', async (_event, id: number) => {
  const { deleteScheduleItem } = require('../knower-agent/db')
  await deleteScheduleItem(id)
  return { ok: true }
})
ipcMain.handle('schedule-recommended-times', async (_event, platform: string) => {
  const { getRecommendedTimes } = require('../knower-agent/db')
  const active = await getActiveAccount()
  return getRecommendedTimes(active?.id || 'default', platform)
})
```

### 2.2 评论舆情

```typescript
ipcMain.handle('comments-crawl', async (_event, platform: string, videoId: string) => {
  const { crawlVideoComments } = require('../knower-agent/lib/crawler')
  const { saveComments } = require('../knower-agent/db')
  const active = await getActiveAccount()
  try {
    const comments = await crawlVideoComments(platform, videoId)
    await saveComments(comments.map((c: Record<string, unknown>) => ({ ...c, videoId, platform })), active?.id || 'default')
    return { ok: true, count: comments.length }
  } catch (e: any) { return { ok: false, error: e.message } }
})
ipcMain.handle('comments-list', async (_event, videoId: string) => {
  const { getCommentsByVideo } = require('../knower-agent/db')
  const active = await getActiveAccount()
  return getCommentsByVideo(videoId, active?.id || 'default')
})
ipcMain.handle('comments-analyze', async (_event, videoId: string) => {
  const { getCommentsByVideo, updateCommentSentiment } = require('../knower-agent/db')
  const { callLLM } = require('../knower-agent/llm/client')
  const active = await getActiveAccount()
  const comments = await getCommentsByVideo(videoId, active?.id || 'default')
  if (!comments.length) return { ok: false, error: '没有评论数据' }
  const batchSize = 20
  for (let i = 0; i < comments.length; i += batchSize) {
    const batch = comments.slice(i, i + batchSize)
    const text = batch.map((c: any, idx: number) => `[${idx}] (${c.likeCount}赞) ${c.content}`).join('\n')
    const prompt = `分析以下视频评论，为每条标注情感(positive/neutral/negative)并提取话题标签。输出JSON数组：[{"index":0,"sentiment":"positive","tags":["tag"]},...]\n\n${text}`
    try {
      const result = await callLLM(prompt, { maxTokens: 2000 })
      const analyses = JSON.parse(result)
      for (const a of analyses) { if (batch[a.index]) await updateCommentSentiment(batch[a.index].id, a.sentiment, a.tags) }
    } catch { /* skip batch */ }
  }
  return { ok: true, analyzed: comments.length }
})
ipcMain.handle('comments-summary', async (_event, platform?: string) => {
  const { getCommentSummary } = require('../knower-agent/db')
  const active = await getActiveAccount()
  return getCommentSummary(active?.id || 'default', platform)
})
ipcMain.handle('comments-write-memories', async (_event, videoId: string) => {
  const { getCommentsByVideo, upsertMemory } = require('../knower-agent/db')
  const active = await getActiveAccount()
  const comments = await getCommentsByVideo(videoId, active?.id || 'default')
  const allTags = comments.flatMap((c: any) => c.tags || [])
  const tagFreq: Record<string, number> = {}
  for (const t of allTags) { tagFreq[t] = (tagFreq[t] || 0) + 1 }
  const top = Object.entries(tagFreq).sort((a, b) => b[1] - a[1]).slice(0, 5)
  if (top.length) {
    await upsertMemory({ accountId: active?.id || 'default', type: 'content_pattern', key: '观众反馈关注点',
      value: '观众最关注：' + top.map(([t, c]) => t + '(' + c + '次)').join('、'),
      evidence: '基于 ' + comments.length + ' 条评论', weight: 0.6 })
  }
  return { ok: true, memories: top.length }
})
```

### 2.3 内容复盘

```typescript
ipcMain.handle('review-create', async (_event, data: Record<string, unknown>) => {
  const { createReview } = require('../knower-agent/db')
  const active = await getActiveAccount()
  await createReview(data, active?.id || 'default')
  return { ok: true }
})
ipcMain.handle('review-list', async (_event, platform?: string) => {
  const { getReviews } = require('../knower-agent/db')
  const active = await getActiveAccount()
  return getReviews(active?.id || 'default', platform)
})
ipcMain.handle('review-update', async (_event, id: number, updates: Record<string, unknown>) => {
  const { updateReview } = require('../knower-agent/db')
  await updateReview(id, updates)
  return { ok: true }
})
ipcMain.handle('review-delete', async (_event, id: number) => {
  const { deleteReview } = require('../knower-agent/db')
  await deleteReview(id)
  return { ok: true }
})
ipcMain.handle('review-stats', async (_event, platform?: string) => {
  const { getReviewStats } = require('../knower-agent/db')
  const active = await getActiveAccount()
  return getReviewStats(active?.id || 'default', platform)
})
ipcMain.handle('review-ai-analyze', async (_event, reviewId: number) => {
  const { getReviews, updateReview, upsertMemory } = require('../knower-agent/db')
  const { callLLM } = require('../knower-agent/llm/client')
  const active = await getActiveAccount()
  const reviews = await getReviews(active?.id || 'default')
  const review = reviews.find((r: any) => r.id === reviewId)
  if (!review) return { ok: false, error: '复盘记录不存在' }
  const prompt = '你是视频运营分析师。根据以下数据给出简短复盘（200字内）。\n标题：' + review.title + '\n平台：' + review.platform + '\n播放：' + review.views + ' 点赞：' + review.likes + ' 评论：' + review.comments + ' 收藏：' + review.saves + '\n预测播放：' + review.predictedViews + ' 预测点赞：' + review.predictedLikes + '\n自评：' + review.rating + '/5\n直接输出分析。'
  const analysis = await callLLM(prompt, { maxTokens: 500 })
  await updateReview(reviewId, { aiAnalysis: analysis })
  if (review.views > 0) {
    const rate = ((review.likes + review.comments + review.saves) / review.views * 100).toFixed(1)
    await upsertMemory({ accountId: active?.id || 'default', type: 'content_pattern',
      key: review.platform + '内容表现', value: '"' + review.title + '" 播放 ' + review.views + '，互动率 ' + rate + '%',
      evidence: '实际数据 ' + review.publishDate, weight: 0.5 })
  }
  return { ok: true, analysis }
})
```

### 2.4 竞品订阅

```typescript
ipcMain.handle('competitor-check-now', async () => {
  const { checkCompetitors } = require('../knower-agent/lib/competitorWatcher')
  const active = await getActiveAccount()
  return checkCompetitors(active?.id || 'default')
})
ipcMain.handle('competitor-alerts', async (_event, unreadOnly?: boolean) => {
  const { getCompetitorAlerts } = require('../knower-agent/db')
  const active = await getActiveAccount()
  return getCompetitorAlerts(active?.id || 'default', unreadOnly)
})
ipcMain.handle('competitor-alert-read', async (_event, id: number) => {
  const { markAlertRead } = require('../knower-agent/db')
  await markAlertRead(id)
  return { ok: true }
})
ipcMain.handle('competitor-alert-read-all', async () => {
  const { markAllAlertsRead } = require('../knower-agent/db')
  const active = await getActiveAccount()
  await markAllAlertsRead(active?.id || 'default')
  return { ok: true }
})
```

---

## 第三步：src/types/electron.d.ts — 类型定义

在现有 interface 定义之后、`ElectronAPI` 之前，加入四个新类型：

```typescript
export interface ScheduleItem {
  id: number; accountId: string; topicId: number | null; platform: string; title: string
  status: 'planned' | 'scheduled' | 'published' | 'skipped'
  plannedDate: string | null; plannedTime: string | null; actualDate: string | null
  notes: string; createdAt: string
}
export interface Comment {
  id: number; videoId: string; platform: string; authorName: string; content: string
  likeCount: number; replyCount: number
  sentiment: 'positive' | 'neutral' | 'negative' | ''; tags: string[]; createdAt: string
}
export interface CommentSummary {
  total: number; sentimentBreakdown: [string, number][]; topTags: { tag: string; count: number }[]
}
export interface ContentReview {
  id: number; accountId: string; scheduleId: number | null; scriptId: number | null
  platform: string; title: string; publishDate: string
  views: number; likes: number; comments: number; shares: number; saves: number; newFollowers: number
  predictedViews: number; predictedLikes: number
  aiAnalysis: string; userNotes: string; rating: number; createdAt: string
}
export interface ReviewStats {
  total: { count: number; avgViews: number; avgLikes: number; avgComments: number } | null
  byPlatform: { platform: string; count: number; avgViews: number; avgLikes: number }[]
}
export interface CompetitorAlert {
  id: number; competitorId: number
  alertType: 'new_video' | 'strategy_change' | 'performance_drop'
  title: string; detail: string; isRead: boolean; createdAt: string
}
```

在 `ElectronAPI` interface 内部加入：

```typescript
  // 内容日历
  scheduleCreate: (data: { topicId?: number; platform: string; title: string; plannedDate?: string; plannedTime?: string; notes?: string }) => Promise<{ ok: boolean }>
  scheduleList: (startDate?: string, endDate?: string) => Promise<ScheduleItem[]>
  scheduleUpdate: (id: number, updates: Record<string, unknown>) => Promise<{ ok: boolean }>
  scheduleDelete: (id: number) => Promise<{ ok: boolean }>
  scheduleRecommendedTimes: (platform: string) => Promise<{ hour: string; avgEngagement: number }[]>
  // 评论舆情
  commentsCrawl: (platform: string, videoId: string) => Promise<{ ok: boolean; count?: number; error?: string }>
  commentsList: (videoId: string) => Promise<Comment[]>
  commentsAnalyze: (videoId: string) => Promise<{ ok: boolean; analyzed?: number; error?: string }>
  commentsSummary: (platform?: string) => Promise<CommentSummary>
  commentsWriteMemories: (videoId: string) => Promise<{ ok: boolean; memories?: number }>
  // 内容复盘
  reviewCreate: (data: Record<string, unknown>) => Promise<{ ok: boolean }>
  reviewList: (platform?: string) => Promise<ContentReview[]>
  reviewUpdate: (id: number, updates: Record<string, unknown>) => Promise<{ ok: boolean }>
  reviewDelete: (id: number) => Promise<{ ok: boolean }>
  reviewStats: (platform?: string) => Promise<ReviewStats>
  reviewAiAnalyze: (reviewId: number) => Promise<{ ok: boolean; analysis?: string; error?: string }>
  // 竞品订阅
  competitorCheckNow: () => Promise<{ checked: number; alerts: number }>
  competitorAlerts: (unreadOnly?: boolean) => Promise<CompetitorAlert[]>
  competitorAlertRead: (id: number) => Promise<{ ok: boolean }>
  competitorAlertReadAll: () => Promise<{ ok: boolean }>
```

---

## 第四步：Agent 工具

### 4.1 analyze_comments.js（新建 `knower-agent/agent/tools/`）

```javascript
module.exports = {
  name: 'analyze_comments',
  description: '分析已爬取的视频评论，提取情感分布和高频话题',
  input_schema: {
    type: 'object',
    properties: {
      videoId: { type: 'string', description: '视频 ID' },
      platform: { type: 'string', enum: ['bili', 'dy', 'xhs', 'wb'] },
    },
    required: ['videoId', 'platform'],
  },
  async execute({ videoId }) {
    const { getCommentsByVideo, updateCommentSentiment } = require('../../db')
    const { callLLM } = require('../../llm/client')
    const comments = await getCommentsByVideo(videoId)
    if (!comments.length) return { error: '暂无评论数据' }
    const batchSize = 20
    for (let i = 0; i < comments.length; i += batchSize) {
      const batch = comments.slice(i, i + batchSize)
      const text = batch.map((c, idx) => `[${idx}] (${c.likeCount}赞) ${c.content}`).join('\n')
      try {
        const result = await callLLM('分析评论情感和话题。输出JSON：[{"index":0,"sentiment":"positive","tags":["tag"]},...]\n\n' + text, { maxTokens: 2000 })
        const analyses = JSON.parse(result)
        for (const a of analyses) { if (batch[a.index]) await updateCommentSentiment(batch[a.index].id, a.sentiment, a.tags) }
      } catch { /* skip */ }
    }
    return { commentCount: comments.length, summary: '分析完成' }
  },
}
```

### 4.2 record_review.js（新建）

```javascript
module.exports = {
  name: 'record_review',
  description: '记录内容发布后的实际表现数据，用于复盘分析',
  input_schema: {
    type: 'object',
    properties: {
      platform: { type: 'string', enum: ['bili', 'dy', 'xhs', 'wb', 'youtube'] },
      title: { type: 'string' },
      publishDate: { type: 'string' },
      views: { type: 'number' }, likes: { type: 'number' }, comments: { type: 'number' },
      saves: { type: 'number' }, shares: { type: 'number' }, newFollowers: { type: 'number' },
      rating: { type: 'number' },
    },
    required: ['platform', 'title'],
  },
  async execute(params) {
    const { createReview } = require('../../db')
    await createReview(params)
    return { ok: true, message: '已记录「' + params.title + '」' }
  },
}
```

### 4.3 analyze_competitor.js（新建）

```javascript
module.exports = {
  name: 'analyze_competitor',
  description: '分析竞品频道的最新内容变化和策略趋势',
  input_schema: {
    type: 'object',
    properties: { competitorId: { type: 'number', description: '竞品 ID（competitors 表）' } },
    required: ['competitorId'],
  },
  async execute({ competitorId }) {
    const { getDb } = require('../../db')
    const { callLLM } = require('../../llm/client')
    const db = await getDb()
    const comp = db.exec('SELECT platform, user_id, nickname FROM competitors WHERE id = ?', [competitorId])
    if (!comp.length || !comp[0].values.length) return { error: '竞品不存在' }
    const [platform, userId, nickname] = comp[0].values[0]
    const content = db.exec('SELECT title, view_count, like_count, comment_count FROM crawl_content WHERE source_uid = ? AND platform = ? ORDER BY created_at DESC LIMIT 10', [userId, platform])
    if (!content.length) return { error: '暂无数据' }
    const videos = content[0].values.map((r) => ({ title: r[0], views: r[1], likes: r[2], comments: r[3] }))
    const prompt = '分析竞品「' + nickname + '」在' + platform + '的内容表现：\n' + videos.map((v, i) => (i+1) + '. ' + v.title + ' | 播放' + v.views + ' | 赞' + v.likes).join('\n') + '\n分析主题趋势、标题策略、互动率，200字内。'
    const analysis = await callLLM(prompt, { maxTokens: 500 })
    return { nickname, platform, videoCount: videos.length, analysis }
  },
}
```

### 4.4 注册到 tools/index.js

在 import 列表末尾加：

```javascript
const analyzeComments = require('./analyze_comments')
const recordReview = require('./record_review')
const analyzeCompetitor = require('./analyze_competitor')
```

在 tools 数组末尾加：`analyzeComments, recordReview, analyzeCompetitor`

---

## 第五步：lib/crawler.js — 评论爬取

在现有文件末尾、`module.exports` 之前加：

```javascript
async function crawlVideoComments(platform, videoId, maxCount = 50) {
  const { execFile } = require('child_process')
  const scriptPath = require('path').join(__dirname, '..', 'crawler', 'run_crawler.py')
  return new Promise((resolve, reject) => {
    execFile('python', [scriptPath, 'comments', platform, videoId, String(maxCount)],
      { cwd: require('path').join(__dirname, '..', 'crawler'), timeout: 30000 },
      (err, stdout) => { if (err) return reject(err); try { resolve(JSON.parse(stdout)) } catch { resolve([]) } })
  })
}
```

在 module.exports 中加 `crawlVideoComments`。

---

## 第六步：lib/competitorWatcher.js（新建 `knower-agent/lib/`）

```javascript
const { getStaleCompetitors, updateCompetitorCheckTime, saveCompetitorAlert, getDb } = require('../db')
const { runCrawler } = require('./crawler')
let _interval = null

async function checkCompetitors(accountId = 'default') {
  const stale = await getStaleCompetitors(accountId, 24)
  if (!stale.length) return { checked: 0, alerts: 0 }
  let alertsCreated = 0
  for (const comp of stale) {
    try {
      const result = await runCrawler(comp.platform, comp.nickname, { type: 'creator', creatorId: comp.userId, limit: 5 })
      const db = await getDb()
      const existing = db.exec('SELECT video_id FROM crawl_content WHERE source_uid = ? AND platform = ? ORDER BY created_at DESC LIMIT 5', [comp.userId, comp.platform])
      const existingIds = existing.length ? existing[0].values.map(r => String(r[0])) : []
      const newVideos = (result.videos || []).filter(v => !existingIds.includes(String(v.id || v.videoId)))
      if (newVideos.length > 0) {
        await saveCompetitorAlert({ competitorId: comp.id, alertType: 'new_video',
          title: comp.nickname + ' 发布了 ' + newVideos.length + ' 条新内容',
          detail: newVideos.slice(0, 3).map(v => v.title || '未知').join('、') }, accountId)
        alertsCreated++
      }
      await updateCompetitorCheckTime(comp.id)
    } catch (e) { console.error('竞品检查失败: ' + comp.nickname, e.message) }
  }
  return { checked: stale.length, alerts: alertsCreated }
}

function startWatcher(intervalMs = 60 * 60 * 1000) {
  if (_interval) return
  _interval = setInterval(async () => {
    try {
      const { listAccounts } = require('../accounts')
      const accounts = await listAccounts()
      for (const acc of accounts) { await checkCompetitors(acc.id) }
    } catch (e) { console.error('竞品监控出错:', e.message) }
  }, intervalMs)
}
function stopWatcher() { if (_interval) { clearInterval(_interval); _interval = null } }
module.exports = { checkCompetitors, startWatcher, stopWatcher }
```

在 `knower-agent/agent/core.js` 的 `stream()` 方法开头加：

```javascript
const { startWatcher } = require('../lib/competitorWatcher')
startWatcher()
```

---

## 完成后验证

1. 重启应用，确认控制台无报错
2. 确认 `module.exports` 导出所有新函数
3. 确认 main.ts 中所有新 handler 可用
4. 确认 `tools/index.js` 导出 11 个工具（原 8 + 新 3）
5. 前端 CC 需要你提供的接口契约：所有 IPC handler 名称见第二步，类型见第三步，preload 由前端 CC 补充暴露
