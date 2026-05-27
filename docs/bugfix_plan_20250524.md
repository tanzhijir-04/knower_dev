# 知更 Knower · Bug 修复与 UI 改进计划

**日期** 2025-05-24  
**状态** 待审核

---

## 问题汇总

| # | 问题 | 严重度 | 根因 |
|---|---|---|---|
| 1 | 数据分析页侧边栏显示 UID 而非用户名 | P0 | `main.ts` 中 `sourceName` 直接用了 `creatorId` |
| 2 | 创作者头像不显示 | P0 | MediaCrawler B站返回 `face` 字段，代码读 `avatar` |
| 3 | AI 分析结果不持久化，每次重开都要重新分析 | P1 | 分析结果只存在前端内存 `analysisCache`，未写入数据库 |
| 4 | 页面间数据不互通 | P1 | TopicsView 是占位页；ChatView 和 DataView 无数据通道 |
| 5 | Windows 字体渲染不锐利 | P1 | UI 全文使用 JetBrains Mono（等宽字体），Windows ClearType 不适配 |

---

## 问题 1：侧边栏显示 UID 而非用户名

### 根因

`electron/main.ts` 第 ~220 行：

```typescript
if (options.crawlerType === 'creator' && options.creatorId) {
    sourceUid = options.creatorId as string
    sourceName = options.creatorId as string  // ← BUG：直接用 UID 当名字
}
```

`sourceName` 被赋值为 UID（如 `440609243`），然后传给 `saveCrawlContentBatch` 写入 `crawl_content.source_name`。虽然后面 `saveCreator` 用了 `result.creators[0].nickname`，但 `crawl_content` 里的 `source_name` 已经是 UID 了。

### 修复方案

在 `crawler-run` handler 中，爬取完成后从结果中提取真实昵称：

```typescript
// 爬取完成后，从 creators 结果中提取真实昵称
let resolvedName = sourceName
if (result.creators && result.creators.length > 0) {
  const creator = result.creators[0]
  resolvedName = creator.nickname || creator.name || creator.user_id || sourceName
  // 用真实昵称更新 sourceName
  sourceName = resolvedName
}
// 再传给 saveCrawlContentBatch
await db.saveCrawlContentBatch(taskId, platform, result.contents, sourceUid, sourceName)
```

同时需要修复数据库中已有的脏数据：对 `crawl_content` 中 `source_name` 等于纯数字 UID 的记录，用 `creators` 表中的真实名称更新。

### 改动文件

- `electron/main.ts`：`crawler-run` handler

---

## 问题 2：创作者头像不显示

### 根因

两层问题：

1. **MediaCrawler 字段名不匹配**：B站爬虫返回的创作者头像字段是 `face`，但 `saveCrawlCreatorsBatch` 读取的是 `avatar`。

2. **`getSourceList` 头像回退逻辑不够**：先查 `creators` 表（`avatar_url`），再回退到 `crawl_content.raw_json`。但 `creators.avatar_url` 来自 `result.creators[0].avatar`（空值），`crawl_content.raw_json` 中的字段名可能是 `face` 而非 `avatar`。

### 修复方案

**a) `main.ts` 中提取头像时兼容两个字段名**：

```typescript
const creatorAvatar = result.creators?.[0]?.avatar
  || result.creators?.[0]?.face
  || result.creators?.[0]?.avatar_url
  || ''
```

**b) `db/index.js` 的 `getSourceList` 回退逻辑兼容 `face`**：

```javascript
const avatar = raw.face || raw.avatar || raw.author?.face || raw.author?.avatar || raw.pic || ''
```

**c) `saveCrawlCreatorsBatch` 兼容 `face` 字段**：

```javascript
c.avatar || c.face || c.avatar_url || ''
```

**d) 数据库修复**：对已有数据，从 `crawl_content.raw_json` 中重新提取头像更新 `creators` 表。

### 改动文件

- `electron/main.ts`：`crawler-run` handler
- `knower-agent/db/index.js`：`getSourceList`、`saveCrawlCreatorsBatch`

---

## 问题 3：AI 分析结果不持久化

### 根因

`analyze-video-data` IPC handler（`main.ts` 第 333 行）每次被调用都重新：

1. 查询视频数据
2. 构造 prompt
3. 调用 LLM 分析
4. 返回结果给前端

前端 `DataView` 用 `analysisCache`（React `useRef<Map>`）缓存结果，但这是**纯内存缓存**，页面切换或重开应用就丢失。

### 修复方案

**a) 新增 `video_analyses` 表存储分析结果**：

```sql
CREATE TABLE IF NOT EXISTS video_analyses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  platform TEXT NOT NULL,
  source_uid TEXT NOT NULL DEFAULT '',
  analysis_json TEXT NOT NULL,
  video_count INTEGER NOT NULL DEFAULT 0,
  created_at DATETIME DEFAULT (datetime('now','localtime')),
  UNIQUE(platform, source_uid)
)
```

**b) `main.ts` 的 `analyze-video-data` handler 改为"先查缓存，没有再分析"**：

```typescript
// 1. 先查数据库是否有已保存的分析
const existing = await db.getVideoAnalysis(platform, sourceUid || '')
if (existing) {
  return existing  // 直接返回，不调用 LLM
}

// 2. 没有则执行分析
const result = await callLLMForAnalysis(...)

// 3. 存入数据库
await db.saveVideoAnalysis(platform, sourceUid || '', result, enriched.length)

return result
```

**c) 新增 IPC 事件 `invalidate-analysis`**：当爬取新数据后，删除对应来源的旧分析缓存。

**d) `db/index.js` 新增函数**：

- `saveVideoAnalysis(platform, sourceUid, analysis, videoCount)`
- `getVideoAnalysis(platform, sourceUid)`
- `deleteVideoAnalysis(platform, sourceUid)`

### 改动文件

- `electron/main.ts`：`analyze-video-data` handler、`crawler-run` handler（爬取后清除旧分析）
- `knower-agent/db/index.js`：新增 3 个函数 + 建表

---

## 问题 4：页面间数据不互通

### 根因

当前四个页面完全独立：

- **ChatView**：独立对话，不感知 DataView 的爬取数据
- **DataView**：独立数据分析，不向其他页面输出
- **TopicsView**：占位页，无功能
- **SettingsView**：独立设置

### 修复方案（分阶段）

**阶段一（当前可做）**：

1. **ChatView 增加上下文注入**：发送消息时，自动查询用户已有的爬取数据摘要，注入到 Agent 的 system prompt 中。Agent 就能"看到"用户的实际数据。

```typescript
// main.ts agent-run handler
const recentData = await db.getRecentCrawlSummary()
if (recentData) {
  prompt = `## 用户已有数据摘要\n${recentData}\n\n${prompt}`
}
```

2. **DataView "发到创作台"**：数据分析页面的 AI 分析结果或某个视频条目，可以一键发送到 ChatView 作为创作上下文。

**阶段二（M3 灵感库开发时）**：

3. **TopicsView**：完整开发，直接读取 DataView 的爬取数据 + memories 表
4. **跨页面数据总线**：通过 Electron IPC 实现页面间事件通信

### 改动文件

- `electron/main.ts`：`agent-run` handler（注入数据摘要）
- `knower-agent/db/index.js`：新增 `getRecentCrawlSummary()`
- `src/components/DataView.tsx`：增加"发到创作台"按钮

---

## 问题 5：Windows 字体渲染不锐利

### 根因

当前字体配置：

```
tailwind.config.js:  sans: ['JetBrains Mono', 'system-ui', 'sans-serif']
index.css:           body { font-family: 'JetBrains Mono'...; -webkit-font-smoothing: antialiased }
```

- **JetBrains Mono 是等宽字体**，为代码设计，字符宽度统一，用在 UI 文本上在 Windows ClearType 下渲染偏软、偏细
- **`-webkit-font-smoothing: antialiased`** 是 macOS 专属属性，在 Windows 上无效，反而禁用了 macOS 上的次像素渲染
- **Codex/ChatGPT** 使用系统字体栈（Windows 上为 Segoe UI），针对 ClearType 优化

### 修复方案

**核心原则：UI 文本和代码字体分离。**

**a) `tailwind.config.js` 改为系统字体栈**：

```javascript
fontFamily: {
  sans: [
    'Inter',                    // 跨平台一致性（Google Fonts）
    '-apple-system',            // macOS
    'BlinkMacSystemFont',       // macOS Chrome
    'Segoe UI',                 // Windows（ClearType 优化）
    'Roboto',                   // Android/Linux
    'Helvetica Neue',           // macOS fallback
    'Arial',                    // 通用 fallback
    'Noto Sans SC',             // 中文兜底
    'sans-serif',
  ],
  display: ['Source Serif 4', 'Georgia', 'serif'],
  mono: ['JetBrains Mono', 'Cascadia Code', 'Fira Code', 'Consolas', 'monospace'],
}
```

**b) `index.html` 加载 Inter 字体**：

```html
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&family=Source+Serif+4:opsz,wght@8..60,400;8..60,700&display=swap" rel="stylesheet" />
```

**c) `index.css` 修复渲染属性**：

```css
body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
  /* Windows DirectWrite 优化 */
  font-feature-settings: 'cv02', 'cv03', 'cv04', 'cv11';
}

/* 代码块保持 JetBrains Mono */
code, pre, .font-mono {
  font-family: 'JetBrains Mono', 'Cascadia Code', 'Consolas', monospace;
}
```

**d) 代码块和等宽内容单独标记**：

- ChatView 中的代码块、JSON 输出：加 `font-mono` class
- DataView 表格中的数字列：保持等宽
- 其他所有 UI 文本：使用 `font-sans`（Inter）

### 字体对比

| 场景 | 当前 | 改后 |
|---|---|---|
| UI 标签/按钮 | JetBrains Mono | Inter / Segoe UI |
| 正文/消息 | JetBrains Mono | Inter / Segoe UI |
| 代码/JSON | JetBrains Mono | JetBrains Mono（不变） |
| 标题（Display） | Source Serif 4 | Source Serif 4（不变） |

### 改动文件

- `index.html`：字体加载增加 Inter
- `tailwind.config.js`：`fontFamily.sans` 改为系统字体栈
- `src/index.css`：body 字体 + 渲染属性 + 代码块字体

---

## 实施顺序

| 阶段 | 内容 | 预估工时 |
|---|---|---|
| 第一批 | 问题 1（UID 显示）+ 问题 2（头像） | 1-2 小时 |
| 第二批 | 问题 3（分析结果持久化） | 2-3 小时 |
| 第三批 | 问题 5（字体渲染） | 1 小时 |
| 第四批 | 问题 4（数据互通，阶段一） | 2-3 小时 |

**总计约 1 天工作量**（不含测试和 UI PRD 更新）。

---

*知更 Knower · Bug 修复计划 2025-05-24*
