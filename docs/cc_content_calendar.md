# 给 CC 的提示词：内容日历（Content Calendar）

## 背景

知更目前有创作台（生成物料）、灵感库（选题建议）、数据概览（爬取分析），但缺少一个关键环节：**什么时候发**。创作者跨平台运营最头疼的就是排期——B站晚8点、抖音中午12点、小红书周末上午，每个平台的最佳窗口不同。

**目标**：做一个内容日历页面，让创作者可视化地管理发布排期，AI 根据历史数据推荐最佳发布时间。

项目路径：`C:\Users\20300\Desktop\knower_dev`

---

## 一、数据库改动

**文件**：`knower-agent/db/index.js`

在 `initTables()` 末尾新增 `publish_schedule` 表：

```sql
CREATE TABLE IF NOT EXISTS publish_schedule (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id TEXT NOT NULL DEFAULT 'default',
  topic_id INTEGER,                -- 关联 saved_topics.id，可为空（手动创建的排期）
  platform TEXT NOT NULL,           -- bili / dy / xhs / wb / youtube
  title TEXT NOT NULL,              -- 内容标题
  status TEXT DEFAULT 'planned',   -- planned / scheduled / published / skipped
  planned_date TEXT,                -- YYYY-MM-DD
  planned_time TEXT,                -- HH:MM
  actual_date TEXT,                 -- 发布后填入
  notes TEXT DEFAULT '',
  created_at DATETIME DEFAULT (datetime('now','localtime')),
  updated_at DATETIME DEFAULT (datetime('now','localtime'))
)
```

在 `initTables()` 末尾加索引：

```javascript
try { db.run('CREATE INDEX IF NOT EXISTS idx_schedule_date ON publish_schedule(account_id, planned_date)') } catch {}
```

新增 CRUD 函数：

```javascript
// === 内容日历 ===

async function createScheduleItem({ accountId, topicId, platform, title, plannedDate, plannedTime, notes }) {
  const db = await getDb()
  db.run(
    `INSERT INTO publish_schedule (account_id, topic_id, platform, title, planned_date, planned_time, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
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
  const fields = []
  const params = []
  for (const [key, val] of Object.entries(updates)) {
    const col = key.replace(/([A-Z])/g, '_$1').toLowerCase()
    fields.push(`${col} = ?`)
    params.push(val)
  }
  fields.push("updated_at = datetime('now','localtime')")
  params.push(id)
  db.run(`UPDATE publish_schedule SET ${fields.join(', ')} WHERE id = ?`, params)
  saveDb()
}

async function deleteScheduleItem(id) {
  const db = await getDb()
  db.run('DELETE FROM publish_schedule WHERE id = ?', [id])
  saveDb()
}

async function getRecommendedTimes(accountId = 'default', platform) {
  // 从 crawl_content 的 publish_time 字段统计互动率最高的时段
  const db = await getDb()
  const res = db.exec(
    `SELECT substr(publish_time, 1, 2) as hour, AVG(like_count + coin_count + collect_count + comment_count) as avg_engagement
     FROM crawl_content
     WHERE account_id = ? AND platform = ? AND publish_time IS NOT NULL
     GROUP BY hour ORDER BY avg_engagement DESC LIMIT 3`,
    [accountId, platform]
  )
  if (!res.length) return []
  return res[0].values.map(row => ({ hour: row[0], avgEngagement: row[1] }))
}
```

别忘了在模块末尾的 `module.exports` 中加上这四个函数。

---

## 二、IPC Handler

**文件**：`electron/main.ts`

在现有 handler 末尾新增：

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

---

## 三、前端类型

**文件**：`src/types/electron.d.ts`

在 `ElectronAPI` interface 中新增：

```typescript
scheduleCreate: (data: { topicId?: number; platform: string; title: string; plannedDate?: string; plannedTime?: string; notes?: string }) => Promise<{ ok: boolean }>
scheduleList: (startDate?: string, endDate?: string) => Promise<ScheduleItem[]>
scheduleUpdate: (id: number, updates: Record<string, unknown>) => Promise<{ ok: boolean }>
scheduleDelete: (id: number) => Promise<{ ok: boolean }>
scheduleRecommendedTimes: (platform: string) => Promise<{ hour: string; avgEngagement: number }[]>
```

在文件顶部新增类型：

```typescript
export interface ScheduleItem {
  id: number
  accountId: string
  topicId: number | null
  platform: string
  title: string
  status: 'planned' | 'scheduled' | 'published' | 'skipped'
  plannedDate: string | null
  plannedTime: string | null
  actualDate: string | null
  notes: string
  createdAt: string
}
```

---

## 四、前端页面

**新文件**：`src/components/CalendarView.tsx`

### 布局

```
┌──────────────────────────────────────────────────────┐
│  内容日历                        [+ 新建排期]  [周|月] │
├──────────────────────────────────────────────────────┤
│  2026年6月                                            │
│  ┌─────┬─────┬─────┬─────┬─────┬─────┬─────┐        │
│  │ 日  │ 一  │ 二  │ 三  │ 四  │ 五  │ 六  │        │
│  ├─────┼─────┼─────┼─────┼─────┼─────┼─────┤        │
│  │     │  1  │  2  │  3  │  4  │ [5] │  6  │        │
│  │     │     │     │ 🎬B站│     │     │     │        │
│  │     │     │     │     │     │     │     │        │
│  ├─────┼─────┼─────┼─────┼─────┼─────┼─────┤        │
│  │  7  │  8  │  9  │ 10  │ 11  │ 12  │ 13  │        │
│  │ 📱抖音│    │     │ 📕小红书│   │     │     │        │
│  └─────┴─────┴─────┴─────┴─────┴─────┴─────┘        │
├──────────────────────────────────────────────────────┤
│  本周排期                                              │
│  ┌──────────────────────────────────────────────┐    │
│  │ 6/3 周三  🎬 B站  "iPhone 17 深度评测"     │    │
│  │              状态: planned  时间: 20:00      │    │
│  │ 6/5 周五  📱 抖音  "iPhone 17 一分钟体验"   │    │
│  │              状态: planned  时间: 12:00      │    │
│  └──────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────┘
```

### 组件结构

```tsx
// CalendarView.tsx — 整个页面组件

// Props: { onNavigate?: (page: Page) => void }

// State:
// - currentMonth: Date（当前显示的月份）
// - viewMode: 'week' | 'month'
// - items: ScheduleItem[]
// - showModal: boolean（新建/编辑弹窗）

// 核心逻辑：
// 1. 组件挂载时调用 loadSchedule() 加载当月数据
// 2. 日历网格用纯 CSS Grid 渲染，每个格子 120px 高
// 3. 有排期的日期格子内显示平台 icon + 标题缩略
// 4. 点击日期格子 → 打开该天的排期列表
// 5. 点击"+ 新建排期" → 弹出表单

// 平台颜色映射：
const PLATFORM_COLORS: Record<string, string> = {
  bili: 'bg-[#00a1d6]',     // B站蓝
  dy: 'bg-[#010101]',       // 抖音黑
  xhs: 'bg-[#fe2c55]',      // 小红书红
  wb: 'bg-[#ff8200]',       // 微博橙
  youtube: 'bg-[#ff0000]',  // YouTube红
}
```

### 新建/编辑排期弹窗

```tsx
// ScheduleModal 组件（在 CalendarView.tsx 内部）

// 表单字段：
// - 平台：下拉选择（bili/dy/xhs/wb/youtube）
// - 标题：文本输入
// - 日期：日期选择器
// - 时间：时间选择器
// - 备注：可选文本
// - AI 推荐时间：选择平台后自动调用 scheduleRecommendedTimes，显示推荐时段

// 关键交互：
// 1. 选择平台后，下方显示"AI 推荐时段：20:00-22:00（互动率最高）"
// 2. 如果该排期关联了 saved_topics，自动填充标题
// 3. 保存后刷新日历
```

### 样式要求

- 使用项目现有的 Tailwind 暗色主题色（`bg-surface`、`text-on-surface`、`border-border`）
- 日历格子 hover 态用 `bg-surface-hover`
- 平台用小圆点 color code，不用大色块
- 整体风格跟 DataView 保持一致：紧凑、信息密度高、无装饰性元素
- 弹窗用 `bg-elevated` 背景，`rounded-lg` 圆角

---

## 五、侧边栏入口

**文件**：`src/components/Sidebar.tsx`

在导航项列表中（`chat`、`data`、`trending`、`topics`、`settings` 之间）加入：

```tsx
{ key: 'calendar', label: '日历', Icon: CalendarBlank }
```

从 `@phosphor-icons/react` 导入 `CalendarBlank`。

**文件**：`src/App.tsx`

1. `Page` 类型新增 `'calendar'`
2. `PAGE_ORDER` 中插入 `'calendar'`（放在 `'trending'` 之后、`'topics'` 之前）
3. 在 `pageRefs.current` 中加 `calendar: null`
4. 在页面渲染区域加 `CalendarView` 的 div

---

## 六、从选题到排期的快捷操作

**文件**：`src/components/topics/TopicCard.tsx`（或 TopicsView 中的选题卡片）

在已保存的选题卡片上新增"排期"按钮：

```tsx
<button
  onClick={() => {
    window.electronAPI.scheduleCreate({
      topicId: topic.id,
      platform: topic.platform,
      title: topic.title,
    })
    // toast 提示"已添加到排期"
  }}
  className="btn-ghost"
>
  <CalendarBlank className="w-4 h-4" />
  排期
</button>
```

---

## 验收标准

- [ ] 侧边栏点击"日历"进入日历页面
- [ ] 月视图正确渲染当月日历格子，有排期的日期显示平台色点和标题
- [ ] 周视图只显示当前周
- [ ] 点击"+ 新建排期"弹出表单，选择平台后显示 AI 推荐时间
- [ ] 保存排期后日历刷新，对应日期出现排期卡片
- [ ] 点击排期卡片可编辑/删除
- [ ] 选题卡片有"排期"按钮，点击后自动创建排期
- [ ] 排期状态可切换：planned → scheduled → published
- [ ] 排期数据按 account_id 隔离
