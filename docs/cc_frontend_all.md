# 给 CC 的提示词：前端全量（四功能页面 + 组件）

## 背景

知更要新增四个功能的前端：内容日历、评论舆情、内容复盘、竞品订阅。后端 CC 已经完成了数据库、IPC Handler、类型定义。你负责所有前端页面和组件。

项目路径：`C:\Users\20300\Desktop\knower_dev`

## 前置条件

后端 CC 已完成以下工作，你需要依赖它们：

1. `knower-agent/db/index.js` — 4 张新表 + CRUD 函数
2. `electron/main.ts` — 所有新 IPC Handler（schedule-*, comments-*, review-*, competitor-alerts*）
3. `src/types/electron.d.ts` — 类型定义（ScheduleItem, Comment, CommentSummary, ContentReview, ReviewStats, CompetitorAlert）+ ElectronAPI 方法

**先读 `src/types/electron.d.ts`**，确认所有类型和 IPC 方法已定义。如果没有，说明后端 CC 还没完成，等它。

## 你只改这些文件

| 文件 | 改动 |
|---|---|
| `src/components/CalendarView.tsx` | 新建，内容日历页面 |
| `src/components/data/CommentPanel.tsx` | 新建，评论分析面板 |
| `src/components/ReviewView.tsx` | 新建，内容复盘页面 |
| `src/components/Sidebar.tsx` | 加日历导航项 + 通知红点 |
| `src/components/DataView.tsx` | 加"复盘"Tab |
| `src/components/topics/CompetitorPanel.tsx` | 改造，加通知区域 |
| `src/App.tsx` | 加 calendar 路由 |
| `src/components/ChatView.tsx` | 不动 |
| `tailwind.config.js` | 不动 |

---

## 第一步：preload 暴露新 API

**文件**：`electron/preload.ts`

在 `contextBridge.exposeInMainWorld('electronAPI', { ... })` 中加入所有新方法：

```typescript
// 内容日历
scheduleCreate: (data) => ipcRenderer.invoke('schedule-create', data),
scheduleList: (startDate, endDate) => ipcRenderer.invoke('schedule-list', startDate, endDate),
scheduleUpdate: (id, updates) => ipcRenderer.invoke('schedule-update', id, updates),
scheduleDelete: (id) => ipcRenderer.invoke('schedule-delete', id),
scheduleRecommendedTimes: (platform) => ipcRenderer.invoke('schedule-recommended-times', platform),
// 评论舆情
commentsCrawl: (platform, videoId) => ipcRenderer.invoke('comments-crawl', platform, videoId),
commentsList: (videoId) => ipcRenderer.invoke('comments-list', videoId),
commentsAnalyze: (videoId) => ipcRenderer.invoke('comments-analyze', videoId),
commentsSummary: (platform) => ipcRenderer.invoke('comments-summary', platform),
commentsWriteMemories: (videoId) => ipcRenderer.invoke('comments-write-memories', videoId),
// 内容复盘
reviewCreate: (data) => ipcRenderer.invoke('review-create', data),
reviewList: (platform) => ipcRenderer.invoke('review-list', platform),
reviewUpdate: (id, updates) => ipcRenderer.invoke('review-update', id, updates),
reviewDelete: (id) => ipcRenderer.invoke('review-delete', id),
reviewStats: (platform) => ipcRenderer.invoke('review-stats', platform),
reviewAiAnalyze: (reviewId) => ipcRenderer.invoke('review-ai-analyze', reviewId),
// 竞品订阅
competitorCheckNow: () => ipcRenderer.invoke('competitor-check-now'),
competitorAlerts: (unreadOnly) => ipcRenderer.invoke('competitor-alerts', unreadOnly),
competitorAlertRead: (id) => ipcRenderer.invoke('competitor-alert-read', id),
competitorAlertReadAll: () => ipcRenderer.invoke('competitor-alert-read-all'),
```

---

## 第二步：App.tsx — 加 calendar 路由

**文件**：`src/App.tsx`

1. 导入 CalendarView：`import CalendarView from './components/CalendarView'`
2. `Page` 类型改为：`'chat' | 'data' | 'trending' | 'calendar' | 'topics' | 'settings'`
3. `PAGE_ORDER` 改为：`['chat', 'data', 'trending', 'calendar', 'topics', 'settings']`
4. `pageRefs.current` 加 `calendar: null`
5. 在页面渲染区域加 CalendarView 的 div：

```tsx
<div ref={el => pageRefs.current.calendar = el} style={{ display: currentPage === 'calendar' ? 'flex' : 'none' }} className="flex-1 flex flex-col overflow-hidden">
  <CalendarView onNavigate={navigateTo} />
</div>
```

---

## 第三步：Sidebar.tsx — 加日历导航 + 通知红点

**文件**：`src/components/Sidebar.tsx`

### 3.1 加日历导航项

在导航项列表中（`trending` 和 `topics` 之间）加入：

```tsx
{ key: 'calendar', label: '日历', Icon: CalendarBlank }
```

从 `@phosphor-icons/react` 导入 `CalendarBlank`。

### 3.2 加通知红点

在组件顶部加状态：

```tsx
const [unreadAlerts, setUnreadAlerts] = useState(0)
```

在 `useEffect` 中轮询（每 5 分钟）：

```tsx
useEffect(() => {
  const poll = async () => {
    try {
      const alerts = await window.electronAPI.competitorAlerts(true)
      setUnreadAlerts(alerts.length)
    } catch {}
  }
  poll()
  const timer = setInterval(poll, 5 * 60 * 1000)
  return () => clearInterval(timer)
}, [])
```

在"灵感库"导航项旁边显示红点：

```tsx
{unreadAlerts > 0 && currentPage !== 'topics' && (
  <span className="absolute top-0.5 right-1 w-2 h-2 bg-red-500 rounded-full" />
)}
```

---

## 第四步：CalendarView.tsx — 内容日历页面（新建）

### 4.1 布局

```
┌──────────────────────────────────────────────────────┐
│  内容日历                        [+ 新建排期]  [周|月] │
├──────────────────────────────────────────────────────┤
│  2026年6月  <  >                                      │
│  ┌─────┬─────┬─────┬─────┬─────┬─────┬─────┐        │
│  │ 日  │ 一  │ 二  │ 三  │ 四  │ 五  │ 六  │        │
│  ├─────┼─────┼─────┼─────┼─────┼─────┼─────┤        │
│  │     │  1  │  2  │  3  │  4  │ [5] │  6  │        │
│  │     │     │     │ 🎬B站│     │     │     │        │
│  └─────┴─────┴─────┴─────┴─────┴─────┴─────┘        │
├──────────────────────────────────────────────────────┤
│  本周排期                                              │
│  6/3 周三  🎬 B站  "iPhone 17 深度评测"  planned     │
│  6/5 周五  📱 抖音  "一分钟体验"  scheduled           │
└──────────────────────────────────────────────────────┘
```

### 4.2 组件结构

```tsx
import { useState, useEffect, useCallback } from 'react'
import { CalendarBlank, Plus, CaretLeft, CaretRight } from '@phosphor-icons/react'
import type { ScheduleItem, Page } from '../types/electron'

const PLATFORM_COLORS: Record<string, string> = {
  bili: 'bg-[#00a1d6]', dy: 'bg-[#010101]', xhs: 'bg-[#fe2c55]',
  wb: 'bg-[#ff8200]', youtube: 'bg-[#ff0000]',
}
const PLATFORM_LABELS: Record<string, string> = {
  bili: 'B站', dy: '抖音', xhs: '小红书', wb: '微博', youtube: 'YouTube',
}
const STATUS_LABELS: Record<string, string> = {
  planned: '待安排', scheduled: '已安排', published: '已发布', skipped: '已跳过',
}

interface Props { onNavigate?: (page: Page) => void }

export default function CalendarView({ onNavigate }: Props) {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [viewMode, setViewMode] = useState<'week' | 'month'>('month')
  const [items, setItems] = useState<ScheduleItem[]>([])
  const [showModal, setShowModal] = useState(false)
  const [editingItem, setEditingItem] = useState<ScheduleItem | null>(null)

  const loadSchedule = useCallback(async () => {
    const year = currentMonth.getFullYear()
    const month = currentMonth.getMonth()
    const start = `${year}-${String(month + 1).padStart(2, '0')}-01`
    const end = `${year}-${String(month + 1).padStart(2, '0')}-${new Date(year, month + 1, 0).getDate()}`
    const data = await window.electronAPI.scheduleList(start, end)
    setItems(data)
  }, [currentMonth])

  useEffect(() => { loadSchedule() }, [loadSchedule])

  // ... 日历网格渲染、弹窗、排期卡片等
}
```

### 4.3 日历网格

用 CSS Grid 渲染 7 列，每列等宽，每行高度固定。有排期的日期格子内显示平台色点 + 标题缩略。点击格子选中该天，下方显示该天的排期列表。

### 4.4 新建/编辑弹窗

表单字段：平台（下拉）、标题（文本）、日期（日期选择器）、时间（时间选择器）、备注（可选）。选择平台后显示 AI 推荐时间。

---

## 第五步：CommentPanel.tsx — 评论分析面板（新建 `src/components/data/`）

### 5.1 布局

```
┌──────────────────────────────────────┐
│  评论分析                              │
│  [爬取评论]  [AI 分析]  [写入记忆]    │
│                                      │
│  情感分布:                            │
│  ████████░░ 65% 正面                 │
│  ███░░░░░░░ 25% 中性                 │
│  █░░░░░░░░░ 10% 负面                 │
│                                      │
│  热门话题:                            │
│  #续航 12次  #屏幕 8次  #价格 6次     │
│                                      │
│  评论列表 (按点赞排序):                │
│  🟢 "续航太强了" (23赞)              │
│  ⚪ "什么时候出" (15赞)               │
│  🔴 "价格太贵了" (8赞)               │
└──────────────────────────────────────┘
```

### 5.2 组件

```tsx
interface Props {
  videoId: string
  platform: string
}

export default function CommentPanel({ videoId, platform }: Props) {
  const [comments, setComments] = useState<Comment[]>([])
  const [summary, setSummary] = useState<CommentSummary | null>(null)
  const [loading, setLoading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)

  const handleCrawl = async () => {
    setLoading(true)
    await window.electronAPI.commentsCrawl(platform, videoId)
    const data = await window.electronAPI.commentsList(videoId)
    setComments(data)
    setLoading(false)
  }

  const handleAnalyze = async () => {
    setAnalyzing(true)
    await window.electronAPI.commentsAnalyze(videoId)
    const data = await window.electronAPI.commentsList(videoId)
    setComments(data)
    const s = await window.electronAPI.commentsSummary(platform)
    setSummary(s)
    setAnalyzing(false)
  }

  // ... 渲染逻辑
}
```

### 5.3 情感色标

```tsx
const SENTIMENT_COLOR: Record<string, string> = {
  positive: 'text-emerald-400', neutral: 'text-gray-400',
  negative: 'text-red-400', '': 'text-gray-500',
}
```

---

## 第六步：ReviewView.tsx — 内容复盘页面（新建）

### 6.1 集成方式

在 `DataView.tsx` 的 Tab 栏新增"复盘"Tab：

```tsx
const TABS = [
  { key: 'overview', label: '概览' },
  { key: 'videos', label: '视频' },
  { key: 'creators', label: '创作者' },
  { key: 'reviews', label: '复盘' },  // 新增
]
```

在 `currentTab === 'reviews'` 时渲染 `<ReviewView />`。

### 6.2 布局

```
┌──────────────────────────────────────────────────────┐
│  内容复盘                                              │
│                                                      │
│  ┌─ 数据概览 ──────────────────────────────────────┐ │
│  │  总发布 12条  平均播放 8,500  平均互动率 4.2%   │ │
│  └──────────────────────────────────────────────────┘ │
│                                                      │
│  [+ 录入数据]                                          │
│                                                      │
│  6/3  🎬 B站  "iPhone 17 深度评测"                    │
│        播放 12.3万 / 预测 10万  ↑23%                  │
│        互动率 5.1%  ⭐⭐⭐⭐                            │
│        [AI 分析] [编辑] [删除]                          │
│                                                      │
│  6/1  📱 抖音  "一分钟看 iPhone 17"                    │
│        播放 3.2万 / 预测 5万  ↓36%                    │
│        互动率 2.1%  ⭐⭐                                │
│        [AI 分析] [编辑] [删除]                          │
└──────────────────────────────────────────────────────┘
```

### 6.3 组件

```tsx
import { useState, useEffect, useCallback } from 'react'
import { Plus, TrendUp, TrendDown, Star, StarHalf } from '@phosphor-icons/react'
import type { ContentReview, ReviewStats } from '../types/electron'

export default function ReviewView() {
  const [reviews, setReviews] = useState<ContentReview[]>([])
  const [stats, setStats] = useState<ReviewStats | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [editingReview, setEditingReview] = useState<ContentReview | null>(null)

  const load = useCallback(async () => {
    const [r, s] = await Promise.all([
      window.electronAPI.reviewList(),
      window.electronAPI.reviewStats(),
    ])
    setReviews(r)
    setStats(s)
  }, [])

  useEffect(() => { load() }, [load])

  // ... 渲染逻辑
}
```

### 6.4 偏差标注

```tsx
function DeviationBadge({ actual, predicted }: { actual: number; predicted: number }) {
  if (!predicted) return null
  const pct = ((actual - predicted) / predicted * 100).toFixed(0)
  const isPositive = actual >= predicted
  return (
    <span className={isPositive ? 'text-emerald-400' : 'text-red-400'}>
      {isPositive ? '↑' : '↓'}{Math.abs(Number(pct))}%
    </span>
  )
}
```

### 6.5 录入数据弹窗

表单字段：平台（下拉）、标题（文本）、发布日期（日期选择器）、播放/点赞/评论/收藏/分享/新增粉丝（数字输入）、自评分（1-5 星点击）、备注（可选）。

---

## 第七步：CompetitorPanel.tsx — 改造，加通知区域

**文件**：`src/components/topics/CompetitorPanel.tsx`

在现有的竞品列表下方，新增通知区域：

```tsx
// 在 CompetitorPanel 组件内部加状态
const [alerts, setAlerts] = useState<CompetitorAlert[]>([])
const [checking, setChecking] = useState(false)

// 加载通知
useEffect(() => {
  window.electronAPI.competitorAlerts().then(setAlerts)
}, [])

// 立即检查
const handleCheckNow = async () => {
  setChecking(true)
  await window.electronAPI.competitorCheckNow()
  const updated = await window.electronAPI.competitorAlerts()
  setAlerts(updated)
  setChecking(false)
}
```

### 通知区域布局

```
┌─ 最新通知 (3 条未读) ──────────────────────────┐
│  🔴 科技美学 发布了 2 条新内容                   │
│     "2026年最值得买的手机"、"M5 MacBook 评测"  │
│     10分钟前                      [标记已读]     │
│                                                │
│  🔴 何同学 发布了 1 条新内容                     │
│     "我用 AI 做了一个视频"                      │
│     3小时前                       [标记已读]     │
│                                                │
│  [全部标记已读]                                  │
└──────────────────────────────────────────────────┘
```

### 通知卡片组件

```tsx
function AlertCard({ alert, onRead }: { alert: CompetitorAlert; onRead: (id: number) => void }) {
  const timeAgo = getTimeAgo(alert.createdAt)
  return (
    <div className={`p-3 rounded-lg border ${alert.isRead ? 'border-border/50 opacity-60' : 'border-border bg-surface'}`}>
      <div className="flex items-center gap-2 mb-1">
        {!alert.isRead && <span className="w-2 h-2 bg-red-500 rounded-full shrink-0" />}
        <span className="text-sm text-on-surface font-medium">{alert.title}</span>
      </div>
      {alert.detail && <p className="text-xs text-muted ml-4">{alert.detail}</p>}
      <div className="flex items-center justify-between mt-2 ml-4">
        <span className="text-xs text-muted">{timeAgo}</span>
        {!alert.isRead && (
          <button onClick={() => onRead(alert.id)} className="text-xs text-accent hover:underline">标记已读</button>
        )}
      </div>
    </div>
  )
}
```

---

## 样式规范

- 所有新组件使用项目现有 Tailwind 暗色主题色：`bg-surface`、`bg-elevated`、`text-on-surface`、`text-muted`、`border-border`
- 弹窗用 `bg-elevated` 背景 + `rounded-lg` + `shadow-xl`
- 按钮用 `btn-ghost` 或 `btn-primary`（如果项目有定义）
- 平台色点用小圆点（`w-2 h-2 rounded-full`），不用大色块
- 表格/列表用 `divide-y divide-border` 分隔
- 所有动画时长 100-200ms，用 `transition-colors` 或 `transition-opacity`

---

## 完成后验证

1. 侧边栏点击"日历"进入 CalendarView，月视图正确渲染
2. 日历弹窗可创建排期，保存后刷新日历
3. DataView 切到"复盘"Tab 显示 ReviewView
4. 录入数据后显示偏差百分比（绿涨红跌）
5. 点击"AI 分析"生成复盘文本
6. 视频详情面板显示 CommentPanel（如果 videoId 存在）
7. 竞品追踪 Tab 显示通知列表
8. 侧边栏红点正确显示未读数
9. preload 暴露所有新 API，前端可调用