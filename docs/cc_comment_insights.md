# 给 CC 的提示词：评论舆情分析（Comment Insights）

## 背景

知更目前能爬取视频列表数据（播放、点赞等），但缺少对评论区的分析。评论是创作者最直接的观众反馈来源——粉丝在说什么、想看什么、吐槽什么，这些信息直接指导选题和内容方向。

**目标**：让创作者输入自己视频的链接，爬取评论区数据，AI 做情感分析 + 高频话题提取 + 粉丝需求汇总，并将洞察写入 memories 形成自进化闭环。

项目路径：`C:\Users\20300\Desktop\knower_dev`

---

## 一、数据库改动

**文件**：`knower-agent/db/index.js`

在 `initTables()` 末尾新增 `comments` 表：

```sql
CREATE TABLE IF NOT EXISTS comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id TEXT NOT NULL DEFAULT 'default',
  video_id TEXT NOT NULL,             -- 关联 crawl_content.id 或视频原始 ID
  platform TEXT NOT NULL,
  author_name TEXT DEFAULT '',
  author_uid TEXT DEFAULT '',
  content TEXT NOT NULL,
  like_count INTEGER DEFAULT 0,
  reply_count INTEGER DEFAULT 0,
  sentiment TEXT DEFAULT '',          -- positive / neutral / negative / empty
  tags TEXT DEFAULT '[]',             -- JSON 数组，AI 提取的话题标签
  created_at DATETIME DEFAULT (datetime('now','localtime'))
)
```

加索引：

```javascript
try { db.run('CREATE INDEX IF NOT EXISTS idx_comments_video ON comments(account_id, video_id)') } catch {}
try { db.run('CREATE INDEX IF NOT EXISTS idx_comments_platform ON comments(account_id, platform)') } catch {}
```

新增查询函数：

```javascript
// === 评论分析 ===

async function saveComments(comments, accountId = 'default') {
  const db = await getDb()
  for (const c of comments) {
    db.run(
      `INSERT INTO comments (account_id, video_id, platform, author_name, author_uid, content, like_count, reply_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [accountId, c.videoId, c.platform, c.authorName || '', c.authorUid || '', c.content, c.likeCount || 0, c.replyCount || 0]
    )
  }
  saveDb()
}

async function getCommentsByVideo(videoId, accountId = 'default') {
  const db = await getDb()
  const res = db.exec(
    'SELECT id, video_id, platform, author_name, content, like_count, reply_count, sentiment, tags, created_at FROM comments WHERE video_id = ? AND account_id = ? ORDER BY like_count DESC',
    [videoId, accountId]
  )
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
  let where = 'WHERE account_id = ?'
  const params = [accountId]
  if (platform) { where += ' AND platform = ?'; params.push(platform) }

  const total = db.exec(`SELECT COUNT(*) FROM comments ${where}`, params)
  const sentiment = db.exec(`SELECT sentiment, COUNT(*) FROM comments ${where} GROUP BY sentiment`, params)
  const topTags = db.exec(
    `SELECT tags FROM comments ${where} AND tags != '[]'`, params
  )
  // 聚合 tags JSON 数组，统计频次
  return {
    total: total.length ? total[0].values[0][0] : 0,
    sentimentBreakdown: sentiment.length ? sentiment[0].values : [],
    topTags: topTags.length ? aggregateTags(topTags[0].values.map(r => JSON.parse(r[0]))) : [],
  }
}

function aggregateTags(tagArrays) {
  const freq = {}
  for (const tags of tagArrays) {
    for (const t of tags) {
      freq[t] = (freq[t] || 0) + 1
    }
  }
  return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 20).map(([tag, count]) => ({ tag, count }))
}

async function deleteCommentsByVideo(videoId, accountId = 'default') {
  const db = await getDb()
  db.run('DELETE FROM comments WHERE video_id = ? AND account_id = ?', [videoId, accountId])
  saveDb()
}
```

在 `module.exports` 中加上这些函数。

---

## 二、爬取评论（MediaCrawler 扩展）

**文件**：`knower-agent/crawler/run_crawler.py`

在现有爬虫脚本末尾新增 `crawl_comments` 函数：

```python
def crawl_comments(platform, video_url_or_id, max_count=50):
    """
    爬取单个视频的评论区。
    返回: [{"author_name": "", "author_uid": "", "content": "", "like_count": 0, "reply_count": 0}]
    """
    # MediaCrawler 的评论爬取能力取决于平台：
    # - B站：通过 API 获取评论列表（按热度排序）
    # - 抖音：通过评论接口获取
    # - 小红书：通过评论接口获取
    # - 微博：暂不支持
    #
    # 如果 MediaCrawler 不支持评论爬取，降级方案：
    # 使用 requests 直接调用 B站评论 API：
    # https://api.bilibili.com/x/v2/reply/main?oid={aid}&type=1&mode=3&ps=20
    pass
```

**文件**：`knower-agent/lib/crawler.js`

在现有 `runCrawler` 函数之后新增：

```javascript
async function crawlVideoComments(platform, videoId, maxCount = 50) {
  // 调用 Python 脚本的评论爬取功能
  // 或者直接用 Node.js 调用平台 API（B站评论 API 是公开的）
  const { execFile } = require('child_process')
  const scriptPath = path.join(__dirname, '..', 'crawler', 'run_crawler.py')

  return new Promise((resolve, reject) => {
    execFile('python', [scriptPath, 'comments', platform, videoId, String(maxCount)],
      { cwd: path.join(__dirname, '..', 'crawler'), timeout: 30000 },
      (err, stdout) => {
        if (err) return reject(err)
        try { resolve(JSON.parse(stdout)) }
        catch { resolve([]) }
      }
    )
  })
}

module.exports = { runCrawler, crawlVideoComments }
```

---

## 三、IPC Handler

**文件**：`electron/main.ts`

```typescript
ipcMain.handle('comments-crawl', async (event, platform: string, videoId: string) => {
  const { crawlVideoComments } = require('../knower-agent/lib/crawler')
  const { saveComments } = require('../knower-agent/db')
  const active = await getActiveAccount()

  try {
    const comments = await crawlVideoComments(platform, videoId)
    await saveComments(comments.map(c => ({ ...c, videoId, platform })), active?.id || 'default')
    return { ok: true, count: comments.length }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

ipcMain.handle('comments-list', async (_event, videoId: string) => {
  const { getCommentsByVideo } = require('../knower-agent/db')
  const active = await getActiveAccount()
  return getCommentsByVideo(videoId, active?.id || 'default')
})

ipcMain.handle('comments-analyze', async (_event, videoId: string) => {
  // 调用 LLM 对评论做情感分析 + 话题提取
  const { getCommentsByVideo, updateCommentSentiment } = require('../knower-agent/db')
  const { getActiveAccount } = require('../knower-agent/accounts')
  const { callLLM } = require('../knower-agent/llm/client')

  const active = await getActiveAccount()
  const comments = await getCommentsByVideo(videoId, active?.id || 'default')
  if (!comments.length) return { ok: false, error: '没有评论数据' }

  // 批量分析（每次 20 条）
  const batchSize = 20
  for (let i = 0; i < comments.length; i += batchSize) {
    const batch = comments.slice(i, i + batchSize)
    const text = batch.map((c, idx) => `[${idx}] (${c.likeCount}赞) ${c.content}`).join('\n')

    const prompt = `分析以下视频评论，为每条评论标注情感（positive/neutral/negative）并提取话题标签。
输出 JSON 数组：[{"index": 0, "sentiment": "positive", "tags": ["选题好", "干货"]}, ...]
只输出 JSON，不要其他文字。

评论：
${text}`

    const result = await callLLM(prompt, { maxTokens: 2000 })
    try {
      const analyses = JSON.parse(result)
      for (const a of analyses) {
        if (batch[a.index]) {
          await updateCommentSentiment(batch[a.index].id, a.sentiment, a.tags)
        }
      }
    } catch { /* LLM 输出解析失败，跳过这批 */ }
  }

  return { ok: true, analyzed: comments.length }
})

ipcMain.handle('comments-summary', async (_event, platform?: string) => {
  const { getCommentSummary } = require('../knower-agent/db')
  const active = await getActiveAccount()
  return getCommentSummary(active?.id || 'default', platform)
})

ipcMain.handle('comments-write-memories', async (_event, videoId: string) => {
  // 将评论洞察写入 memories，闭合自进化闭环
  const { getCommentsByVideo, updateCommentSentiment } = require('../knower-agent/db')
  const { upsertMemory } = require('../knower-agent/db')
  const { callLLM } = require('../knower-agent/llm/client')

  const active = await getActiveAccount()
  const comments = await getCommentsByVideo(videoId, active?.id || 'default')

  const sentimentCounts = { positive: 0, neutral: 0, negative: 0 }
  const allTags = []
  for (const c of comments) {
    sentimentCounts[c.sentiment || 'neutral']++
    allTags.push(...(c.tags || []))
  }

  // 找出高频负面话题（改进方向）
  const negTags = allTags.filter(t => t)
  const tagFreq = {}
  for (const t of negTags) { tagFreq[t] = (tagFreq[t] || 0) + 1 }
  const topNegatives = Object.entries(tagFreq).sort((a, b) => b[1] - a[1]).slice(0, 5)

  if (topNegatives.length) {
    await upsertMemory({
      accountId: active?.id || 'default',
      type: 'content_pattern',
      key: '观众反馈关注点',
      value: `观众最关注的话题：${topNegatives.map(([t, c]) => `${t}(${c}次)`).join('、')}`,
      evidence: `基于 ${comments.length} 条评论分析`,
      weight: 0.6,
    })
  }

  return { ok: true, memories: topNegatives.length }
})
```

---

## 四、前端类型

**文件**：`src/types/electron.d.ts`

```typescript
export interface Comment {
  id: number
  videoId: string
  platform: string
  authorName: string
  content: string
  likeCount: number
  replyCount: number
  sentiment: 'positive' | 'neutral' | 'negative' | ''
  tags: string[]
  createdAt: string
}

export interface CommentSummary {
  total: number
  sentimentBreakdown: [string, number][]
  topTags: { tag: string; count: number }[]
}
```

`ElectronAPI` 中新增：

```typescript
commentsCrawl: (platform: string, videoId: string) => Promise<{ ok: boolean; count?: number; error?: string }>
commentsList: (videoId: string) => Promise<Comment[]>
commentsAnalyze: (videoId: string) => Promise<{ ok: boolean; analyzed?: number; error?: string }>
commentsSummary: (platform?: string) => Promise<CommentSummary>
commentsWriteMemories: (videoId: string) => Promise<{ ok: boolean; memories?: number }>
```

---

## 五、前端 UI

### DataView 中的评论入口

**文件**：`src/components/DataView.tsx`

在视频详情面板（`VideoDetailPanel`）中，当用户选中一个视频时，右侧显示"评论分析"区域：

```
┌──────────────────────────────────────┐
│  视频详情                              │
│  标题: iPhone 17 深度评测              │
│  播放: 12.3万  点赞: 4500             │
│                                      │
│  ┌─ 评论分析 ─────────────────────┐  │
│  │  [爬取评论]  [AI 分析]          │  │
│  │                                │  │
│  │  情感分布:  ████████░░ 65% 正面 │  │
│  │            ███░░░░░░░ 25% 中性  │  │
│  │            █░░░░░░░░░ 10% 负面  │  │
│  │                                │  │
│  │  热门话题:                      │  │
│  │  #续航 12次  #屏幕 8次  #价格 6次│  │
│  │                                │  │
│  │  [写入记忆 →]                   │  │
│  └────────────────────────────────┘  │
└──────────────────────────────────────┘
```

### 新文件：`src/components/data/CommentPanel.tsx`

```tsx
// Props: { videoId: string; platform: string }

// State:
// - comments: Comment[]
// - summary: CommentSummary | null
// - loading: boolean
// - crawling: boolean
// - analyzing: boolean

// 组件结构：
// 1. 操作栏：[爬取评论] [AI 分析] [写入记忆]
// 2. 情感分布：用横向进度条显示 positive/neutral/negative 占比
// 3. 热门话题：标签云，按频次排序
// 4. 评论列表：按点赞数排序，每条显示情感色标（绿/灰/红）

// 交互：
// 1. 点击"爬取评论" → 调用 commentsCrawl，loading 态
// 2. 爬取完成后自动调用 commentsAnalyze
// 3. 分析完成后显示情感分布和话题标签
// 4. 点击"写入记忆" → 调用 commentsWriteMemories，toast 提示成功
```

### 情感色标

```tsx
const SENTIMENT_COLOR = {
  positive: 'text-emerald-400',
  neutral: 'text-gray-400',
  negative: 'text-red-400',
  '': 'text-gray-500',
}
```

---

## 六、Agent 工具集成

**文件**：`knower-agent/agent/tools/analyze_comments.js`（新建）

```javascript
module.exports = {
  name: 'analyze_comments',
  description: '分析已爬取的视频评论，提取情感分布和高频话题，帮助了解观众反馈',
  input_schema: {
    type: 'object',
    properties: {
      videoId: { type: 'string', description: '视频 ID（crawl_content 表的 id）' },
      platform: { type: 'string', enum: ['bili', 'dy', 'xhs', 'wb'] },
    },
    required: ['videoId', 'platform'],
  },
  async execute({ videoId, platform }) {
    // 1. 获取评论
    // 2. 调用 LLM 做情感分析
    // 3. 返回摘要
    const { getCommentsByVideo, updateCommentSentiment } = require('../../db')
    const { callLLM } = require('../../llm/client')
    const comments = await getCommentsByVideo(videoId)
    // ... 批量分析逻辑同 IPC handler
    return { commentCount: comments.length, summary: '分析完成' }
  },
}
```

在 `knower-agent/agent/tools/index.js` 中注册：

```javascript
const analyzeComments = require('./analyze_comments')
const tools = [...existingTools, analyzeComments]
```

---

## 验收标准

- [ ] DataView 视频详情面板显示"评论分析"区域
- [ ] 点击"爬取评论"成功爬取 B站视频评论
- [ ] 自动调用 AI 分析，情感分布和话题标签正确显示
- [ ] 评论列表按点赞数排序，情感色标正确
- [ ] 点击"写入记忆"后 memories 表新增观众反馈洞察
- [ ] Agent 对话中说"分析评论"时能调用 analyze_comments 工具
- [ ] 不同创作者的评论数据按 account_id 隔离
- [ ] 评论爬取失败时显示错误提示，不崩溃
