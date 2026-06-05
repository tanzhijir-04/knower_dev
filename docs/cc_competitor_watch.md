# 给 CC 的提示词：竞品频道订阅（Competitor Watch）

## 背景

知更的灵感库（TopicsView）目前是手动触发爬取竞品数据。但创作者真正需要的是：**订阅竞品频道后，自动追踪他们的新内容和策略变化**。比如"你关注的 XX 最近开始做短剧了""竞品 A 的播放量本周下降了 15%"。

**目标**：支持订阅竞品频道，后台定时爬取新内容，AI 自动分析变化并推送通知。

项目路径：`C:\Users\20300\Desktop\knower_dev`

---

## 一、数据库改动

**文件**：`knower-agent/db/index.js`

现有的 `competitors` 表已经够用（有 `platform`, `user_id`, `nickname`, `account_id`, `last_checked_at`）。新增一个 `competitor_alerts` 表存储通知：

```sql
CREATE TABLE IF NOT EXISTS competitor_alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id TEXT NOT NULL DEFAULT 'default',
  competitor_id INTEGER NOT NULL,
  alert_type TEXT NOT NULL,         -- new_video / strategy_change / performance_drop
  title TEXT NOT NULL,
  detail TEXT DEFAULT '',
  is_read INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT (datetime('now','localtime'))
)
```

索引：

```javascript
try { db.run('CREATE INDEX IF NOT EXISTS idx_alerts_account ON competitor_alerts(account_id, is_read)') } catch {}
```

新增函数：

```javascript
// === 竞品订阅 ===

async function saveCompetitorAlert(alert, accountId = 'default') {
  const db = await getDb()
  db.run(
    `INSERT INTO competitor_alerts (account_id, competitor_id, alert_type, title, detail)
     VALUES (?, ?, ?, ?, ?)`,
    [accountId, alert.competitorId, alert.alertType, alert.title, alert.detail || '']
  )
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
    id: row[0], competitorId: row[1], alertType: row[2], title: row[3],
    detail: row[4], isRead: !!row[5], createdAt: row[6],
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
  const res = db.exec(
    `SELECT id, platform, user_id, nickname FROM competitors
     WHERE account_id = ? AND (last_checked_at IS NULL OR last_checked_at < datetime('now', '-${hoursThreshold} hours'))
     ORDER BY last_checked_at ASC NULLS FIRST`,
    [accountId]
  )
  if (!res.length) return []
  return res[0].values.map(row => ({
    id: row[0], platform: row[1], userId: row[2], nickname: row[3],
  }))
}
```

在 `module.exports` 中加上。

---

## 二、后台定时爬取

**文件**：`knower-agent/lib/competitorWatcher.js`（新建）

```javascript
const { getStaleCompetitors, updateCompetitorCheckTime, saveCompetitorAlert } = require('../db')
const { runCrawler } = require('./crawler')

let _interval = null

async function checkCompetitors(accountId = 'default') {
  const stale = await getStaleCompetitors(accountId, 24)
  if (!stale.length) return { checked: 0, alerts: 0 }

  let alertsCreated = 0

  for (const comp of stale) {
    try {
      // 爬取竞品最新内容
      const result = await runCrawler(comp.platform, comp.nickname, {
        type: 'creator',
        creatorId: comp.userId,
        limit: 5,
      })

      // 对比上次爬取的内容（crawl_content 表中该 UID 最近的记录）
      const { getDb } = require('../db')
      const db = await getDb()
      const existing = db.exec(
        'SELECT video_id, title FROM crawl_content WHERE source_uid = ? AND platform = ? ORDER BY created_at DESC LIMIT 5',
        [comp.userId, comp.platform]
      )

      const existingIds = existing.length ? existing[0].values.map(r => String(r[0])) : []
      const newVideos = (result.videos || []).filter(v => !existingIds.includes(String(v.id || v.videoId)))

      // 发现新内容 → 生成告警
      if (newVideos.length > 0) {
        const titles = newVideos.slice(0, 3).map(v => v.title || v.title || '未知标题').join('、')
        await saveCompetitorAlert({
          competitorId: comp.id,
          alertType: 'new_video',
          title: `${comp.nickname} 发布了 ${newVideos.length} 条新内容`,
          detail: titles,
        }, accountId)
        alertsCreated++
      }

      // 更新最后检查时间
      await updateCompetitorCheckTime(comp.id)
    } catch (e) {
      console.error(`竞品检查失败: ${comp.nickname}`, e.message)
    }
  }

  return { checked: stale.length, alerts: alertsCreated }
}

function startWatcher(intervalMs = 60 * 60 * 1000) {
  // 默认每小时检查一次
  if (_interval) return
  _interval = setInterval(async () => {
    try {
      // 遍历所有活跃账号
      const { listAccounts } = require('../accounts')
      const accounts = await listAccounts()
      for (const acc of accounts) {
        await checkCompetitors(acc.id)
      }
    } catch (e) {
      console.error('竞品监控出错:', e.message)
    }
  }, intervalMs)
}

function stopWatcher() {
  if (_interval) { clearInterval(_interval); _interval = null }
}

module.exports = { checkCompetitors, startWatcher, stopWatcher }
```

**文件**：`knower-agent/agent/core.js`

在 `stream()` 方法开头启动 watcher（如果还没启动）：

```javascript
const { startWatcher } = require('../lib/competitorWatcher')
startWatcher()  // 幂等，多次调用不会重复启动
```

---

## 三、IPC Handler

**文件**：`electron/main.ts`

```typescript
ipcMain.handle('competitor-check-now', async (_event) => {
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

ipcMain.handle('competitor-alert-read-all', async (_event) => {
  const { markAllAlertsRead } = require('../knower-agent/db')
  const active = await getActiveAccount()
  await markAllAlertsRead(active?.id || 'default')
  return { ok: true }
})

// 改造现有的 competitor-list handler，加上 last_checked_at 字段
// 已有，无需改动
```

---

## 四、前端类型

**文件**：`src/types/electron.d.ts`

```typescript
export interface CompetitorAlert {
  id: number
  competitorId: number
  alertType: 'new_video' | 'strategy_change' | 'performance_drop'
  title: string
  detail: string
  isRead: boolean
  createdAt: string
}
```

`ElectronAPI` 中新增：

```typescript
competitorCheckNow: () => Promise<{ checked: number; alerts: number }>
competitorAlerts: (unreadOnly?: boolean) => Promise<CompetitorAlert[]>
competitorAlertRead: (id: number) => Promise<{ ok: boolean }>
competitorAlertReadAll: () => Promise<{ ok: boolean }>
```

---

## 五、前端 UI

### 侧边栏通知红点

**文件**：`src/components/Sidebar.tsx`

在侧边栏底部或导航项旁边，显示未读告警数：

```tsx
// 在组件挂载时轮询告警数（每 5 分钟）
useEffect(() => {
  const poll = async () => {
    const alerts = await window.electronAPI.competitorAlerts(true)
    setUnreadCount(alerts.length)
  }
  poll()
  const timer = setInterval(poll, 5 * 60 * 1000)
  return () => clearInterval(timer)
}, [])

// 在导航项上显示红点
{unreadCount > 0 && (
  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
)}
```

### 灵感库中的竞品追踪 Tab

**文件**：`src/components/topics/CompetitorPanel.tsx`

改造现有的 `CompetitorPanel`，新增"通知"区域：

```
┌──────────────────────────────────────────────────────┐
│  竞品追踪                                              │
│                                                      │
│  ┌─ 我订阅的竞品 ─────────────────────────────────┐ │
│  │  🎬 科技美学  B站  上次检查: 2小时前  [立即检查] │ │
│  │  🎬 何同学    B站  上次检查: 5小时前  [立即检查] │ │
│  │  📱 数码闲聊  B站  上次检查: 1天前   [立即检查]  │ │
│  │                                                │ │
│  │  [+ 订阅新竞品]                                 │ │
│  └──────────────────────────────────────────────────┘ │
│                                                      │
│  ┌─ 最新通知 (3 条未读) ──────────────────────────┐ │
│  │  🔴 科技美学 发布了 2 条新内容                   │ │
│  │     "2026年最值得买的手机"、"M5 MacBook 评测"  │ │
│  │     10分钟前                      [标记已读]     │ │
│  │                                                │ │
│  │  🔴 何同学 发布了 1 条新内容                     │ │
│  │     "我用 AI 做了一个视频"                      │ │
│  │     3小时前                       [标记已读]     │ │
│  │                                                │ │
│  │  [全部标记已读]                                  │ │
│  └──────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────┘
```

### 订阅新竞品弹窗

```tsx
// 在 CompetitorPanel 中

// 表单字段：
// - 平台：下拉选择
// - 用户 ID / UID：文本输入
// - 昵称：文本输入（可选，AI 自动获取）

// 交互：
// 1. 输入 UID 后自动查询昵称（调用现有的 get-creators API）
// 2. 保存后立即触发一次 checkCompetitors
```

### 通知卡片

```tsx
// AlertCard 组件

// 显示：
// - 未读红点 / 已读灰色
// - 告警类型 icon（new_video → Play, strategy_change → TrendUp, performance_drop → TrendDown）
// - 标题（竞品名 + 动作）
// - 详情（新视频标题列表）
// - 时间（相对时间：10分钟前、3小时前）
// - 操作：标记已读 / 查看详情

// 新视频标题可点击 → 跳转到 DataView 查看该竞品的完整数据
```

---

## 六、Agent 工具集成

**文件**：`knower-agent/agent/tools/analyze_competitor.js`（新建）

```javascript
module.exports = {
  name: 'analyze_competitor',
  description: '分析竞品频道的最新内容变化，识别策略调整和表现趋势',
  input_schema: {
    type: 'object',
    properties: {
      competitorId: { type: 'number', description: '竞品 ID（competitors 表的 id）' },
    },
    required: ['competitorId'],
  },
  async execute({ competitorId }) {
    const { getDb } = require('../../db')
    const { callLLM } = require('../../llm/client')
    const db = await getDb()

    // 获取竞品信息
    const comp = db.exec('SELECT platform, user_id, nickname FROM competitors WHERE id = ?', [competitorId])
    if (!comp.length || !comp[0].values.length) return { error: '竞品不存在' }
    const [platform, userId, nickname] = comp[0].values[0]

    // 获取最近爬取的内容
    const content = db.exec(
      'SELECT title, view_count, like_count, comment_count, created_at FROM crawl_content WHERE source_uid = ? AND platform = ? ORDER BY created_at DESC LIMIT 10',
      [userId, platform]
    )
    if (!content.length) return { error: '暂无数据，请先爬取该竞品的内容' }

    const videos = content[0].values.map(r => ({
      title: r[0], views: r[1], likes: r[2], comments: r[3], date: r[4],
    }))

    const prompt = `分析竞品「${nickname}」在${platform}平台的最近内容表现：

${videos.map((v, i) => `${i + 1}. ${v.title} | 播放 ${v.views} | 点赞 ${v.likes} | 评论 ${v.comments} | ${v.date}`).join('\n')}

请分析：
1. 内容主题变化趋势
2. 标题策略特点
3. 互动率表现（点赞/播放）
4. 对我们的选题启发

直接输出分析，200字以内。`

    const analysis = await callLLM(prompt, { maxTokens: 500 })
    return { nickname, platform, videoCount: videos.length, analysis }
  },
}
```

注册到 `tools/index.js`。

---

## 七、数据库迁移

确保 `competitors` 表有 `last_checked_at` 列（检查现有迁移逻辑是否已覆盖）。如果没有，在 `initTables()` 中加：

```javascript
try {
  db.exec('SELECT last_checked_at FROM competitors LIMIT 1')
} catch {
  db.exec("ALTER TABLE competitors ADD COLUMN last_checked_at TEXT")
  saveDb()
}
```

---

## 验收标准

- [ ] 灵感库"竞品追踪"Tab 显示已订阅的竞品列表
- [ ] 点击"+ 订阅新竞品"可添加竞品（输入 UID，自动获取昵称）
- [ ] 点击"立即检查"触发一次爬取，更新 last_checked_at
- [ ] 有新内容时自动生成通知（红色未读标记）
- [ ] 通知列表显示新视频标题，可点击查看详情
- [ ] 侧边栏显示未读通知红点
- [ ] Agent 对话中说"分析竞品"时能调用 analyze_competitor 工具
- [ ] 后台每小时自动检查竞品更新
- [ ] 不同创作者的竞品订阅和通知按 account_id 隔离
- [ ] 关闭应用后 watcher 停止，重启后自动恢复
