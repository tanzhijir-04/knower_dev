# 给 CC 的提示词：后端代码修复（3 个问题）

## 背景

后端 CC 已经完成了四功能的数据库 + IPC + 工具，但有 3 个问题需要修复。

项目路径：`C:\Users\20300\Desktop\knower_dev`

---

## 问题 1：preload.ts 未暴露新 API

**现象**：`electron/preload.ts` 没有加入新的 IPC 方法，前端无法调用。

**修复**：在 `electron/preload.ts` 的 `contextBridge.exposeInMainWorld('electronAPI', { ... })` 对象末尾（`onSyncEvent` 之后、`})` 之前）加入：

```typescript
  // 内容日历
  scheduleCreate: (data: { topicId?: number; platform: string; title: string; plannedDate?: string; plannedTime?: string; notes?: string }) =>
    ipcRenderer.invoke('schedule-create', data),
  scheduleList: (startDate?: string, endDate?: string) =>
    ipcRenderer.invoke('schedule-list', startDate, endDate),
  scheduleUpdate: (id: number, updates: Record<string, unknown>) =>
    ipcRenderer.invoke('schedule-update', id, updates),
  scheduleDelete: (id: number) =>
    ipcRenderer.invoke('schedule-delete', id),
  scheduleRecommendedTimes: (platform: string) =>
    ipcRenderer.invoke('schedule-recommended-times', platform),
  // 评论舆情
  commentsCrawl: (platform: string, videoId: string) =>
    ipcRenderer.invoke('comments-crawl', platform, videoId),
  commentsList: (videoId: string) =>
    ipcRenderer.invoke('comments-list', videoId),
  commentsAnalyze: (videoId: string) =>
    ipcRenderer.invoke('comments-analyze', videoId),
  commentsSummary: (platform?: string) =>
    ipcRenderer.invoke('comments-summary', platform),
  commentsWriteMemories: (videoId: string) =>
    ipcRenderer.invoke('comments-write-memories', videoId),
  // 内容复盘
  reviewCreate: (data: Record<string, unknown>) =>
    ipcRenderer.invoke('review-create', data),
  reviewList: (platform?: string) =>
    ipcRenderer.invoke('review-list', platform),
  reviewUpdate: (id: number, updates: Record<string, unknown>) =>
    ipcRenderer.invoke('review-update', id, updates),
  reviewDelete: (id: number) =>
    ipcRenderer.invoke('review-delete', id),
  reviewStats: (platform?: string) =>
    ipcRenderer.invoke('review-stats', platform),
  reviewAiAnalyze: (reviewId: number) =>
    ipcRenderer.invoke('review-ai-analyze', reviewId),
  // 竞品订阅
  competitorCheckNow: () =>
    ipcRenderer.invoke('competitor-check-now'),
  competitorAlerts: (unreadOnly?: boolean) =>
    ipcRenderer.invoke('competitor-alerts', unreadOnly),
  competitorAlertRead: (id: number) =>
    ipcRenderer.invoke('competitor-alert-read', id),
  competitorAlertReadAll: () =>
    ipcRenderer.invoke('competitor-alert-read-all'),
```

---

## 问题 2：getRecommendedTimes 查询了不存在的列

**文件**：`knower-agent/db/index.js`

**现象**：`getRecommendedTimes` 函数查询 `crawl_content` 表的 `coin_count`、`collect_count`、`publish_time` 列，但 `crawl_content` 表实际只有 `like_count`、`comment_count`、`share_count`、`play_count`，没有这三个列。运行时会报 SQL 错误。

**修复**：替换整个 `getRecommendedTimes` 函数：

```javascript
async function getRecommendedTimes(accountId = 'default', platform) {
  const db = await getDb()
  // crawl_content 没有 account_id 和 publish_time 列
  // 通过 crawl_tasks 关联 account_id，用 created_at 近似发布时间
  const res = db.exec(
    `SELECT substr(cc.created_at, 12, 2) as hour,
            AVG(cc.like_count + cc.comment_count + cc.share_count) as avg_engagement
     FROM crawl_content cc
     JOIN crawl_tasks ct ON cc.task_id = ct.id
     WHERE ct.account_id = ? AND cc.platform = ? AND cc.created_at IS NOT NULL
     GROUP BY hour
     ORDER BY avg_engagement DESC
     LIMIT 3`,
    [accountId, platform]
  )
  if (!res.length) return []
  return res[0].values.map(row => ({ hour: row[0], avgEngagement: row[1] }))
}
```

**要点**：
- 用 `crawl_tasks.account_id` 关联，不假设 `crawl_content` 有 `account_id`
- 用 `cc.created_at` 的小时部分代替 `publish_time`
- 互动指标用 `like_count + comment_count + share_count`（这三个列确实存在）
- 去掉 `coin_count` 和 `collect_count`（B站特有字段，其他平台没有）

---

## 问题 3：crawl_content 跨平台字段不一致

**现象**：不同平台爬取的数据字段不同（B站有 `coin_count`，抖音有 `digg_count`），但 `crawl_content` 表用统一字段存。`getRecommendedTimes` 硬编码了 B 站字段名，换到抖音/小红书就会出错。

**现状评估**：这个问题实际上已经被问题 2 的修复覆盖了——修复后的 SQL 只用了 `like_count`、`comment_count`、`share_count` 三个跨平台通用字段。不需要额外改动。

但如果未来要支持更精细的平台特有指标（如 B 站投币、收藏），应在 `raw_json` 列中存储完整原始数据，查询时按平台解析。**当前不做这个改动**，保持简单。

---

## 验证

1. 重启应用，确认控制台无 SQL 报错
2. 前端能调用 `window.electronAPI.scheduleList()` 等新方法（不返回 undefined）
3. 创建一个爬取任务后，调用 `getRecommendedTimes` 不报错