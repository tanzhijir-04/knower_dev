# 给 CC 的提示词：内容复盘（Content Retrospective）

## 背景

知更的自进化机制目前只从"生成的物料"里提炼风格偏好（memories 表），但缺少关键的第三层数据：**发布后的实际表现**。AI 推荐的标题风格播放量好不好？哪个平台的物料效果最差？没有反馈信号，记忆系统就只能猜，不能学。

**目标**：让创作者在发布内容后录入各平台实际数据，AI 对比预期与实际，更新 memories 权重，形成"生成 → 发布 → 反馈 → 优化"的完整闭环。

项目路径：`C:\Users\20300\Desktop\knower_dev`

---

## 一、数据库改动

**文件**：`knower-agent/db/index.js`

在 `initTables()` 末尾新增 `content_reviews` 表：

```sql
CREATE TABLE IF NOT EXISTS content_reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id TEXT NOT NULL DEFAULT 'default',
  schedule_id INTEGER,              -- 关联 publish_schedule.id，可为空
  script_id INTEGER,                -- 关联 scripts.id，可为空
  platform TEXT NOT NULL,
  title TEXT NOT NULL,
  publish_date TEXT,
  -- 实际数据
  views INTEGER DEFAULT 0,
  likes INTEGER DEFAULT 0,
  comments INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  saves INTEGER DEFAULT 0,          -- 收藏/书签
  new_followers INTEGER DEFAULT 0,
  -- AI 预测数据（生成物料时保存的预期）
  predicted_views INTEGER DEFAULT 0,
  predicted_likes INTEGER DEFAULT 0,
  -- 复盘
  ai_analysis TEXT DEFAULT '',      -- AI 生成的复盘分析 JSON
  user_notes TEXT DEFAULT '',       -- 创作者自己的复盘笔记
  rating INTEGER DEFAULT 0,         -- 1-5 星自评分
  created_at DATETIME DEFAULT (datetime('now','localtime')),
  updated_at DATETIME DEFAULT (datetime('now','localtime'))
)
```

索引：

```javascript
try { db.run('CREATE INDEX IF NOT EXISTS idx_reviews_account ON content_reviews(account_id, platform)') } catch {}
try { db.run('CREATE INDEX IF NOT EXISTS idx_reviews_date ON content_reviews(account_id, publish_date)') } catch {}
```

新增 CRUD：

```javascript
// === 内容复盘 ===

async function createReview(data, accountId = 'default') {
  const db = await getDb()
  db.run(
    `INSERT INTO content_reviews (account_id, schedule_id, script_id, platform, title, publish_date,
     views, likes, comments, shares, saves, new_followers, predicted_views, predicted_likes, user_notes, rating)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [accountId, data.scheduleId || null, data.scriptId || null, data.platform, data.title,
     data.publishDate || '', data.views || 0, data.likes || 0, data.comments || 0,
     data.shares || 0, data.saves || 0, data.newFollowers || 0,
     data.predictedViews || 0, data.predictedLikes || 0, data.userNotes || '', data.rating || 0]
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
  const fields = []
  const params = []
  for (const [key, val] of Object.entries(updates)) {
    const col = key.replace(/([A-Z])/g, '_$1').toLowerCase()
    fields.push(`${col} = ?`)
    params.push(val)
  }
  fields.push("updated_at = datetime('now','localtime')")
  params.push(id)
  db.run(`UPDATE content_reviews SET ${fields.join(', ')} WHERE id = ?`, params)
  saveDb()
}

async function deleteReview(id) {
  const db = await getDb()
  db.run('DELETE FROM content_reviews WHERE id = ?', [id])
  saveDb()
}

async function getReviewStats(accountId = 'default', platform) {
  const db = await getDb()
  let where = 'WHERE account_id = ?'
  const params = [accountId]
  if (platform) { where += ' AND platform = ?'; params.push(platform) }

  const total = db.exec(`SELECT COUNT(*), AVG(views), AVG(likes), AVG(comments) FROM content_reviews ${where}`, params)
  const byPlatform = db.exec(
    `SELECT platform, COUNT(*), AVG(views), AVG(likes) FROM content_reviews ${where} GROUP BY platform`,
    params
  )
  const accuracy = db.exec(
    `SELECT platform,
       AVG(CASE WHEN predicted_views > 0 THEN ABS(views - predicted_views) * 1.0 / predicted_views ELSE 0 END) as view_error,
       AVG(CASE WHEN predicted_likes > 0 THEN ABS(likes - predicted_likes) * 1.0 / predicted_likes ELSE 0 END) as like_error
     FROM content_reviews ${where} AND predicted_views > 0 GROUP BY platform`,
    params
  )
  return {
    total: total.length ? { count: total[0].values[0][0], avgViews: total[0].values[0][1], avgLikes: total[0].values[0][2], avgComments: total[0].values[0][3] } : null,
    byPlatform: byPlatform.length ? byPlatform[0].values.map(r => ({ platform: r[0], count: r[1], avgViews: r[2], avgLikes: r[3] })) : [],
    predictionAccuracy: accuracy.length ? accuracy[0].values.map(r => ({ platform: r[0], viewError: r[1], likeError: r[2] })) : [],
  }
}
```

在 `module.exports` 中加上。

---

## 二、IPC Handler

**文件**：`electron/main.ts`

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
  const { getReviews, updateReview } = require('../knower-agent/db')
  const { callLLM } = require('../knower-agent/llm/client')
  const active = await getActiveAccount()

  const reviews = await getReviews(active?.id || 'default')
  const review = reviews.find(r => r.id === reviewId)
  if (!review) return { ok: false, error: '复盘记录不存在' }

  // 构建分析 prompt
  const prompt = `你是一个资深视频运营分析师。根据以下发布数据，给出简短的复盘分析（200字以内）。

标题：${review.title}
平台：${review.platform}
发布日期：${review.publishDate}
播放：${review.views}  点赞：${review.likes}  评论：${review.comments}  收藏：${review.saves}  分享：${review.shares}  新增粉丝：${review.newFollowers}
AI 预测播放：${review.predictedViews}  AI 预测点赞：${review.predictedLikes}
自评分：${review.rating}/5

分析要点：
1. 实际表现与预测的差距
2. 该平台的互动率表现
3. 对后续内容的建议

直接输出分析文字，不要 JSON。`

  const analysis = await callLLM(prompt, { maxTokens: 500 })
  await updateReview(reviewId, { aiAnalysis: analysis })

  // 将洞察写入 memories
  const { upsertMemory } = require('../knower-agent/db')
  if (review.views > 0) {
    const engagementRate = ((review.likes + review.comments + review.saves) / review.views * 100).toFixed(1)
    await upsertMemory({
      accountId: active?.id || 'default',
      type: 'content_pattern',
      key: `${review.platform}内容表现`,
      value: `"${review.title}" 发布后 ${review.views} 播放，互动率 ${engagementRate}%`,
      evidence: `实际发布数据 ${review.publishDate}`,
      weight: 0.5,
    })
  }

  return { ok: true, analysis }
})
```

---

## 三、前端类型

**文件**：`src/types/electron.d.ts`

```typescript
export interface ContentReview {
  id: number
  accountId: string
  scheduleId: number | null
  scriptId: number | null
  platform: string
  title: string
  publishDate: string
  views: number
  likes: number
  comments: number
  shares: number
  saves: number
  newFollowers: number
  predictedViews: number
  predictedLikes: number
  aiAnalysis: string
  userNotes: string
  rating: number
  createdAt: string
}

export interface ReviewStats {
  total: { count: number; avgViews: number; avgLikes: number; avgComments: number } | null
  byPlatform: { platform: string; count: number; avgViews: number; avgLikes: number }[]
  predictionAccuracy: { platform: string; viewError: number; likeError: number }[]
}
```

`ElectronAPI` 中新增：

```typescript
reviewCreate: (data: Record<string, unknown>) => Promise<{ ok: boolean }>
reviewList: (platform?: string) => Promise<ContentReview[]>
reviewUpdate: (id: number, updates: Record<string, unknown>) => Promise<{ ok: boolean }>
reviewDelete: (id: number) => Promise<{ ok: boolean }>
reviewStats: (platform?: string) => Promise<ReviewStats>
reviewAiAnalyze: (reviewId: number) => Promise<{ ok: boolean; analysis?: string; error?: string }>
```

---

## 四、前端 UI

### 新文件：`src/components/ReviewView.tsx`

这个页面不做独立导航入口，而是集成在 DataView 中作为一个 Tab。

**文件**：`src/components/DataView.tsx`

在顶部 Tab 栏新增"复盘"Tab：

```tsx
const TABS = [
  { key: 'overview', label: '概览' },
  { key: 'videos', label: '视频' },
  { key: 'creators', label: '创作者' },
  { key: 'reviews', label: '复盘' },  // 新增
]
```

### 复盘页面布局

```
┌──────────────────────────────────────────────────────┐
│  内容复盘                                              │
│                                                      │
│  ┌─ 数据概览 ──────────────────────────────────────┐ │
│  │  总发布 12条  平均播放 8,500  平均互动率 4.2%   │ │
│  │  预测准确度：播放偏差 ±23%  点赞偏差 ±18%       │ │
│  └──────────────────────────────────────────────────┘ │
│                                                      │
│  [+ 录入数据]                                          │
│                                                      │
│  ┌─ 复盘记录 ──────────────────────────────────────┐ │
│  │  6/3  🎬 B站  "iPhone 17 深度评测"              │ │
│  │        播放 12.3万 / 预测 10万  ↑23%            │ │
│  │        互动率 5.1%  ⭐⭐⭐⭐                      │ │
│  │        [AI 分析] [编辑] [删除]                    │ │
│  │                                                  │ │
│  │  6/1  📱 抖音  "一分钟看 iPhone 17"              │ │
│  │        播放 3.2万 / 预测 5万  ↓36%              │ │
│  │        互动率 2.1%  ⭐⭐                          │ │
│  │        [AI 分析] [编辑] [删除]                    │ │
│  └──────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

### 录入数据弹窗

```tsx
// ReviewModal 组件

// 表单字段：
// - 平台：下拉选择
// - 标题：文本输入（可从 publish_schedule 自动填充）
// - 发布日期：日期选择器
// - 播放量：数字输入
// - 点赞数：数字输入
// - 评论数：数字输入
// - 收藏数：数字输入
// - 分享数：数字输入
// - 新增粉丝：数字输入
// - 自评分：1-5 星选择
// - 备注：可选文本

// 关键交互：
// 1. 如果关联了 publish_schedule，自动填充标题和预测数据
// 2. 保存后自动计算互动率
// 3. 可选"AI 分析"按钮，调用 review-ai-analyze
```

### 复盘卡片

```tsx
// ReviewCard 组件

// 显示：
// - 平台色点 + 标题
// - 发布日期
// - 实际数据 vs 预测数据（用箭头标注偏差）
// - 互动率（likes + comments + saves）/ views * 100
// - 星级评分
// - AI 分析结果（折叠/展开）
// - 操作按钮：AI 分析 / 编辑 / 删除

// 偏差标注：
const deviation = predicted > 0 ? ((actual - predicted) / predicted * 100) : 0
// 正偏差 → 绿色 ↑23%
// 负偏差 → 红色 ↓36%
```

---

## 五、从日历到复盘的快捷操作

**文件**：`src/components/CalendarView.tsx`

在排期状态为 `published` 的卡片上，新增"录入复盘"按钮：

```tsx
// 点击后弹出 ReviewModal，自动填充平台、标题、发布日期
// 如果有 predictedViews（从 saved_topics 的 estimated_performance 解析），也自动填充
```

---

## 六、Agent 工具集成

**文件**：`knower-agent/agent/tools/record_review.js`（新建）

```javascript
module.exports = {
  name: 'record_review',
  description: '记录内容发布后的实际表现数据，用于复盘分析和优化记忆',
  input_schema: {
    type: 'object',
    properties: {
      platform: { type: 'string', enum: ['bili', 'dy', 'xhs', 'wb', 'youtube'] },
      title: { type: 'string' },
      publishDate: { type: 'string' },
      views: { type: 'number' },
      likes: { type: 'number' },
      comments: { type: 'number' },
      saves: { type: 'number' },
      shares: { type: 'number' },
      newFollowers: { type: 'number' },
      rating: { type: 'number' },
    },
    required: ['platform', 'title'],
  },
  async execute(params) {
    const { createReview } = require('../../db')
    await createReview(params)
    return { ok: true, message: `已记录「${params.title}」的发布数据` }
  },
}
```

注册到 `tools/index.js`。

---

## 验收标准

- [ ] DataView 新增"复盘"Tab，显示复盘记录列表
- [ ] 点击"+ 录入数据"弹出表单，可手动输入各平台数据
- [ ] 复盘卡片正确显示实际 vs 预测偏差，正偏差绿色、负偏差红色
- [ ] 点击"AI 分析"后生成复盘分析文本
- [ ] AI 分析后自动将洞察写入 memories 表
- [ ] 数据概览显示平均播放、互动率、预测准确度
- [ ] 日历页面的已发布排期可一键跳转到录入复盘
- [ ] Agent 对话中说"记录发布数据"时能调用 record_review 工具
- [ ] 复盘数据按 account_id 隔离
