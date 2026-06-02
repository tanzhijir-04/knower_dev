# 知更 Knower · 全量改进计划（Bug 修复 + UI 重构）

**日期** 2025-05-24  
**面向** CC（开发执行）  
**状态** 待审核  

> 本文档是完整的执行手册。每个任务包含：问题描述、根因、改动文件、具体代码、验收标准。按优先级从上到下执行。

---

## 总览

| 批次 | 内容 | 预估工时 | 依赖 |
|---|---|---|---|
| P0 | 字体渲染修复（Windows + macOS 一致性） | 1h | 无 |
| P1 | 侧边栏重构（加文字 + 对话历史） | 2-3h | 无 |
| P2 | Bug 修复：UID 显示 + 头像 | 1-2h | 无 |
| P3 | Bug 修复：AI 分析结果持久化 | 2-3h | 无 |
| P4 | 创作台重构（工具调用卡片 + 物料面板） | 4-6h | P0 |
| P5 | 欢迎页重做 | 2-3h | P0 |
| P6 | 数据分析页布局优化 | 3-4h | P2 |
| P7 | 页面数据互通（Agent 注入数据摘要） | 2-3h | P3 |
| P8 | 动画与交互细节（对标 Codex） | 3-4h | P0, P4 |
| **合计** | | **约 3-4 天** | |

建议执行顺序：P0 → P2 → P1 → P3 → P5 → P4 → P6 → P7 → P8

---

## P0：字体渲染修复（Windows + macOS 一致性）

### 问题

UI 全文使用 JetBrains Mono（等宽字体），在 Windows ClearType 下渲染偏软偏细。`-webkit-font-smoothing: antialiased` 是 macOS 专属属性，对 Windows 无效。

### 改动文件

1. `index.html`
2. `tailwind.config.js`
3. `src/index.css`

### 具体改动

**`index.html`** — 修改 Google Fonts 加载链接，增加 Inter + Noto Sans SC：

```html
<!-- 旧 -->
<link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;700&family=Source+Serif+4:opsz,wght@8..60,400;8..60,700&display=swap" rel="stylesheet" />

<!-- 新 -->
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&family=Source+Serif+4:opsz,wght@8..60,400;8..60,700&family=Noto+Sans+SC:wght@400;500;600;700&display=swap" rel="stylesheet" />
```

同时修改 body class，去掉 `antialiased`：

```html
<!-- 旧 -->
<body class="bg-background text-on-surface font-sans antialiased">
<!-- 新 -->
<body class="bg-background text-on-surface font-sans">
```

**`tailwind.config.js`** — 修改 fontFamily：

```javascript
// 旧
fontFamily: {
  sans: ['JetBrains Mono', 'system-ui', 'sans-serif'],
  display: ['Source Serif 4', 'serif'],
  mono: ['JetBrains Mono', 'monospace'],
},

// 新
fontFamily: {
  sans: [
    'Inter',
    'Noto Sans SC',
    '-apple-system',
    'BlinkMacSystemFont',
    'Segoe UI',
    'Roboto',
    'Helvetica Neue',
    'Arial',
    'sans-serif',
  ],
  display: ['Source Serif 4', 'Georgia', 'serif'],
  mono: ['JetBrains Mono', 'Cascadia Code', 'Fira Code', 'Consolas', 'monospace'],
},
```

**`src/index.css`** — 修改 body 样式 + 增加代码块字体：

```css
body {
  font-family: 'Inter', 'Noto Sans SC', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  background: #0e150f;
  color: #dde5da;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
  overflow: hidden;
}

/* 在 @layer components 末尾增加 */
code, pre, .font-mono, .prose code, .prose pre {
  font-family: 'JetBrains Mono', 'Cascadia Code', 'Consolas', monospace !important;
}
```

### 验收标准

- [ ] Windows 上 UI 文本使用 Inter/Segoe UI，代码块用 JetBrains Mono
- [ ] macOS 上 UI 文本使用 Inter 系统字体
- [ ] 两平台字体视觉一致

---

## P1：侧边栏重构

### 问题

侧边栏只有 4 个图标（56px），无文字，无对话历史。和 Codex 体验差距大。

### 改动文件

1. `src/components/Sidebar.tsx`（重写）
2. `src/App.tsx`（传入对话点击回调）
3. `src/components/ChatView.tsx`（接收 initialConversationId）

### Sidebar.tsx 核心结构

240px 宽，包含：Logo + 产品名、导航项（图标 + 文字）、对话历史列表、底部折叠按钮。

```tsx
export default function Sidebar({ currentPage, onNavigate, onOpenConversation }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [conversations, setConversations] = useState([])
  const width = collapsed ? 56 : 240

  return (
    <aside className="h-full border-r border-border/50 flex flex-col shrink-0 transition-all duration-250 bg-sidebar" style={{ width }}>
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-border/30">
        <img src={logoSvg} className="w-8 h-8 rounded-lg shrink-0" />
        {!collapsed && <span className="text-sm font-semibold text-on-surface">知更 Knower</span>}
      </div>

      {/* 导航 */}
      <nav className="flex flex-col gap-0.5 px-2 pt-3">
        {navItems.map(item => (
          <button key={item.id} onClick={() => onNavigate(item.id)}
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-left ${
              currentPage === item.id ? 'bg-surface-container text-primary border-l-2 border-primary' : 'text-on-surface-variant hover:text-on-surface hover:bg-surface-container/50'
            }`}>
            <span className="material-symbols-outlined text-[20px] shrink-0">{item.icon}</span>
            {!collapsed && <span className="text-sm">{item.label}</span>}
          </button>
        ))}
      </nav>

      {/* 对话历史（仅 chat + 展开时） */}
      {currentPage === 'chat' && !collapsed && (
        <div className="flex-1 flex flex-col mt-4 overflow-hidden">
          <div className="px-4 mb-2"><span className="text-[11px] uppercase tracking-wider text-mute">最近对话</span></div>
          <div className="flex-1 overflow-y-auto px-2">
            {conversations.map(conv => (
              <button key={conv.id} onClick={() => onOpenConversation?.(conv.id)}
                className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-left hover:bg-surface-container/50 group">
                <span className="text-xs text-on-surface truncate flex-1">{conv.title}</span>
                {/* hover 时显示删除 */}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* 折叠按钮 */}
      <div className="px-2 py-3 border-t border-border/30">
        <button onClick={() => setCollapsed(!collapsed)} className="w-full py-2 rounded-lg text-mute hover:text-on-surface hover:bg-surface-container/50">
          <span className={`material-symbols-outlined text-[18px] transition-transform ${collapsed ? 'rotate-180' : ''}`}>chevron_left</span>
        </button>
      </div>
    </aside>
  )
}
```

### App.tsx 改动

```tsx
const [openConversationId, setOpenConversationId] = useState<number | null>(null)

<Sidebar
  currentPage={currentPage}
  onNavigate={setCurrentPage}
  onOpenConversation={(id) => {
    setOpenConversationId(id)
    setCurrentPage('chat')
  }}
/>

<ChatView initialConversationId={openConversationId} />
```

### ChatView.tsx 改动

新增 prop `initialConversationId`，收到时自动加载对应对话。

### 验收标准

- [ ] 侧边栏 240px，显示 Logo + "知更 Knower" + 四个导航项（图标 + 文字）
- [ ] 点击折叠按钮收窄到 56px
- [ ] 切到创作台时显示对话历史
- [ ] 点击对话历史自动加载

---

## P2：Bug 修复 — UID 显示 + 头像

### 问题

数据分析页侧边栏显示 UID 而非用户名，头像不显示。

### 根因

1. `main.ts`：`sourceName = options.creatorId` 直接拿 UID 当名字
2. MediaCrawler B站返回 `face` 字段，代码只读 `avatar`

### 改动文件

1. `electron/main.ts`
2. `knower-agent/db/index.js`

### main.ts 改动

在 `crawler-run` handler 中，`saveCrawlContentBatch` 之前，从结果提取真实信息：

```typescript
// 新增：从 creators 结果中提取真实昵称和头像
let resolvedName = sourceName
let resolvedAvatar = ''
if (result.creators && result.creators.length > 0) {
  const creator = result.creators[0]
  resolvedName = creator.nickname || creator.name || sourceName
  resolvedAvatar = creator.avatar || creator.face || creator.avatar_url || ''
  sourceName = resolvedName
}
// 从内容 raw_json 回补头像
if (!resolvedAvatar && result.contents?.length > 0) {
  const raw = result.contents[0]
  resolvedAvatar = raw.face || raw.author_face || ''
}

// saveCreator 调用兼容 face 字段
const creatorAvatar = result.creators?.[0]?.avatar
  || result.creators?.[0]?.face
  || result.creators?.[0]?.avatar_url
  || resolvedAvatar || ''
```

### db/index.js 改动

1. `saveCrawlCreatorsBatch` 中 `c.avatar` 改为 `c.avatar || c.face || c.avatar_url || ''`
2. `getSourceList` avatar fallback 增加 `raw.pic || raw.upic`
3. `initTables()` 末尾增加数据修复函数，用 `creators` 表的真实名称更新 `crawl_content` 中 UID 格式的 `source_name`

### 验收标准

- [ ] 侧边栏显示用户名而非 UID
- [ ] 头像正常显示
- [ ] 已有脏数据重启后自动修复

---

## P3：AI 分析结果持久化

### 问题

每次打开数据分析页都要重新调 LLM 分析，结果不保存。

### 改动文件

1. `knower-agent/db/index.js`
2. `electron/main.ts`

### db/index.js 改动

`initTables()` 中新增建表：

```sql
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
```

新增三个函数并导出：

- `saveVideoAnalysis(platform, sourceUid, analysis, videoCount)`
- `getVideoAnalysis(platform, sourceUid)` — 返回 `{ analysis, videoCount, createdAt }` 或 null
- `deleteVideoAnalysis(platform, sourceUid)`

### main.ts 改动

`analyze-video-data` handler 改为"先查 DB 缓存，没有再调 LLM"：

```typescript
// 1. 先查缓存
const cached = await db.getVideoAnalysis(platform, sourceUid || '')
if (cached) {
  const videos = sourceUid ? await db.getVideosBySource(platform, sourceUid) : await db.getAllCrawlContent(platform)
  if (videos.length === cached.videoCount) return cached.analysis
  await db.deleteVideoAnalysis(platform, sourceUid || '')
}
// 2. 执行分析...（现有代码）
// 3. 存入 DB
await db.saveVideoAnalysis(platform, sourceUid || '', result, enriched.length)
```

`crawler-run` handler 中爬取完成后清除旧缓存：`await db.deleteVideoAnalysis(platform, sourceUid)`

### 验收标准

- [ ] AI 分析结果重启后仍在
- [ ] 爬取新数据后旧分析自动失效
- [ ] 切换页面再切回，分析结果从 DB 加载

---

## P4：创作台重构（工具调用卡片 + 物料面板）

### 问题

工具调用只显示一行文字，物料嵌套在气泡内 Tab 拥挤。

### 改动文件

1. `src/components/ChatView.tsx`
2. `src/components/MaterialCards.tsx`（改为 MaterialPanel）
3. `src/index.css`（新增样式）

### index.css 新增样式

```css
/* 工具调用卡片 */
.tool-card { @apply border border-outline-variant/30 rounded-xl overflow-hidden bg-surface-low; }
.tool-card-header { @apply flex items-center gap-2.5 px-4 py-2.5 cursor-pointer hover:bg-surface-container/50; }
.tool-card-header .tool-icon.running { @apply bg-primary/20 text-primary; }
.tool-card-header .tool-icon.success { @apply bg-green-500/20 text-green-400; }
.tool-card-header .tool-icon.error { @apply bg-red-500/20 text-red-400; }
.tool-card-body { @apply px-4 pb-3 border-t border-outline-variant/20; }

/* 物料面板（全宽独立） */
.material-panel { @apply border border-outline-variant/30 rounded-xl overflow-hidden bg-surface-low; }
.material-tab { @apply px-3.5 py-2.5 text-xs font-medium text-on-surface-variant border-b-2 border-transparent hover:text-on-surface; }
.material-tab.active { @apply text-primary border-primary; }
.material-field-label { @apply text-[11px] text-mute uppercase tracking-wider mb-1.5; }
.material-field-value { @apply bg-surface-container rounded-lg px-3.5 py-2.5 text-sm text-on-surface leading-relaxed whitespace-pre-wrap; }

/* 消息操作栏 */
.msg-actions { @apply flex items-center gap-1 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity; }
.msg-action-btn { @apply p-1.5 rounded-md text-mute hover:text-on-surface hover:bg-surface-container transition-colors; }
```

### ChatView.tsx 核心改动

1. Message 类型增加 `toolCalls?: ToolCallInfo[]`、`materialData?: MaterialData`、`textContent?: string`
2. agent-event 监听中，`tool_call` 事件追加到消息的 `toolCalls` 数组，`tool_result` 更新状态
3. 消息渲染从气泡改为全宽布局，先渲染工具卡片，再渲染文本，最后渲染物料面板
4. 新增 `ToolCallCard` 组件：可折叠卡片，左侧色条 + 状态图标 + 工具名 + 耗时

### MaterialCards.tsx 改动

重命名为 `MaterialPanel`，改为全宽独立面板：
- Tab 栏横排（B站 / YouTube / 抖音 / 小红书 / 拍摄清单）
- 每个物料字段独立一行，label + value + 复制按钮
- 不再嵌套在气泡内

### 验收标准

- [ ] 工具调用显示为独立卡片，可展开查看详情
- [ ] 工具执行中图标旋转，完成后变绿色勾
- [ ] 物料面板独立全宽，每个字段带复制按钮
- [ ] 消息 hover 时底部出现操作栏

---

## P5：欢迎页重做

### 问题

当前欢迎页太朴素。

### 改动文件

1. `src/components/ChatView.tsx`（替换 showWelcome 区域）

### 核心结构

居中显示 Logo + "知更 Knower" + Slogan + 粘贴脚本引导卡片 + 两个快捷操作（查看数据 / 配置 API）。

ChatView 需要新增 `onNavigate` prop 用于跳转到其他页面。

### 验收标准

- [ ] 居中 Logo + 产品名 + Slogan
- [ ] 醒目的"粘贴脚本"引导卡片
- [ ] 快捷操作按钮可跳转

---

## P6：数据分析页布局优化

### 问题

顶部操作栏太拥挤。

### 改动文件

1. `src/components/DataView.tsx`（修改顶部栏）

### 改动

将顶部栏从一行改为两行：
- 第一行：标题 + 模式切换（用户主页 / 关键词搜索）
- 第二行：平台选择 + 输入框 + 爬取按钮 + AI分析按钮 + AI分类按钮

### 验收标准

- [ ] 顶部栏分两行，不再拥挤
- [ ] 输入框占据剩余空间

---

## P7：页面数据互通

### 问题

ChatView 不知道 DataView 的爬取数据。

### 改动文件

1. `electron/main.ts`（agent-run handler）
2. `knower-agent/db/index.js`（新增 getRecentCrawlSummary）

### db/index.js 新增

```javascript
async function getRecentCrawlSummary() {
  const db = await getDb()
  const res = db.exec(`
    SELECT source_name, platform, COUNT(*) as cnt, SUM(play_count) as total_play, SUM(like_count) as total_like
    FROM crawl_content WHERE source_uid != '' AND source_uid IS NOT NULL
    GROUP BY source_uid, platform ORDER BY total_play DESC LIMIT 10
  `)
  if (!res.length) return ''
  return res[0].values.map(row => {
    const platform = row[1] === 'bili' ? 'B站' : row[1] === 'dy' ? '抖音' : row[1] === 'xhs' ? '小红书' : row[1]
    return `- ${row[0] || '未知'}（${platform}）：${row[2]} 个视频，播放 ${row[3]?.toLocaleString() || 0}`
  }).join('\n')
}
```

### main.ts 改动

`agent-run` handler 中，构造 prompt 前注入：

```typescript
const dataSummary = await db.getRecentCrawlSummary()
if (dataSummary) {
  prompt = `## 你的账号数据摘要\n${dataSummary}\n\n## 任务\n${prompt}\n\n请参考上面的数据。`
}
```

### 验收标准

- [ ] 有爬取数据时，Agent 能在总结中引用用户数据
- [ ] 无数据时功能不受影响

---

*知更 Knower · 全量改进计划 v1.0*

## P8：动画与交互细节（对标 Codex）

### 目标

每个交互都有明确的视觉反馈，动画流畅自然，不卡顿不突兀。参考 ChatGPT Codex 的交互动画风格：简洁、快速、有目的性。

### 改动文件

1. `src/index.css`（全局动画定义）
2. `src/components/ChatView.tsx`（流式输出 + 消息动画）
3. `src/components/Sidebar.tsx`（折叠动画）
4. `src/components/DataView.tsx`（卡片进入动画）

---

### 8.1 全局动画基础（index.css）

在 `@layer base` 中新增：

```css
/* ========== 动画定义 ========== */

/* 消息进入：淡入 + 上移 */
@keyframes msg-enter {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

/* 工具卡片进入：淡入 + 左滑 */
@keyframes tool-enter {
  from { opacity: 0; transform: translateX(-12px); }
  to { opacity: 1; transform: translateX(0); }
}

/* 卡片展开/折叠 */
@keyframes expand-in {
  from { opacity: 0; max-height: 0; }
  to { opacity: 1; max-height: 500px; }
}

@keyframes collapse-out {
  from { opacity: 1; max-height: 500px; }
  to { opacity: 0; max-height: 0; }
}

/* 打字光标闪烁 */
@keyframes blink {
  0%, 50% { opacity: 1; }
  51%, 100% { opacity: 0; }
}

/* 旋转加载（工具执行中） */
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* 脉冲（执行中色条） */
@keyframes pulse-green {
  0%, 100% { opacity: 0.6; }
  50% { opacity: 1; }
}

/* Toast 进入/退出 */
@keyframes toast-in {
  from { opacity: 0; transform: translateY(-12px) scale(0.95); }
  to { opacity: 1; transform: translateY(0) scale(1); }
}

@keyframes toast-out {
  from { opacity: 1; transform: translateY(0) scale(1); }
  to { opacity: 0; transform: translateY(-12px) scale(0.95); }
}

/* 侧边栏宽度过渡由 transition-all 处理，无需额外 keyframe */

/* 按钮点击缩放 */
@keyframes btn-press {
  0% { transform: scale(1); }
  50% { transform: scale(0.96); }
  100% { transform: scale(1); }
}

/* 卡片骨架屏闪烁 */
@keyframes shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
```

在 `@layer components` 中新增工具类：

```css
/* ========== 动画工具类 ========== */

/* 消息进入动画 */
.animate-msg-enter {
  animation: msg-enter 0.2s ease-out forwards;
}

/* 工具卡片进入动画 */
.animate-tool-enter {
  animation: tool-enter 0.25s ease-out forwards;
}

/* 打字光标 */
.typing-cursor::after {
  content: '█';
  color: var(--color-primary);
  animation: blink 0.8s step-end infinite;
  margin-left: 1px;
  font-size: 0.9em;
}

/* 工具执行中图标旋转 */
.animate-spin {
  animation: spin 1s linear infinite;
}

/* 工具执行中色条脉冲 */
.animate-pulse-green {
  animation: pulse-green 1.5s ease-in-out infinite;
}

/* 按钮点击反馈 */
.btn-press:active {
  animation: btn-press 0.15s ease-out;
}

/* Toast */
.animate-toast-in {
  animation: toast-in 0.2s ease-out forwards;
}
.animate-toast-out {
  animation: toast-out 0.2s ease-in forwards;
}

/* 骨架屏 */
.skeleton {
  background: linear-gradient(90deg, var(--color-surface-container) 25%, var(--color-surface-high) 50%, var(--color-surface-container) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 6px;
}

/* 页面切换淡入 */
.animate-page-enter {
  animation: msg-enter 0.2s ease-out forwards;
}
```

---

### 8.2 ChatView 流式输出动画

**打字光标**：流式输出时，文本末尾显示绿色闪烁光标。

实现方式：在 `msg-assistant-content` 的最末尾（最后一条正在流式输出的消息），追加一个 `<span className="typing-cursor" />`。

```tsx
{/* 在 messages.map 中，最后一条 assistant 消息且 isStreaming 时 */}
{isStreaming && msg.id === assistantIdRef.current && (
  <span className="typing-cursor" />
)}
```

**流式文本逐字显示**：当前已有逐字追加（`last.content + event.text`），这是正确的。不需要额外动画，因为 React 的 DOM 更新本身就是逐帧追加的。关键是光标要跟着文字走。

**流式结束**：光标消失。当 `isStreaming` 变为 false 时，光标自然消失。

---

### 8.3 工具调用卡片动画

**进入动画**：卡片从左侧滑入 + 淡入。

```tsx
<div className="tool-card mb-3 animate-tool-enter">
```

**状态转换动画**：

执行中 → 完成时，图标从旋转的 `sync` 切换为 `check_circle`，色条从脉冲变为静态绿色。

```tsx
{/* 状态图标 */}
<div className={`tool-icon ${toolCall.status}`}>
  <span className={`material-symbols-outlined text-[14px] ${
    toolCall.status === 'running' ? 'animate-spin' : ''
  }`}>
    {toolCall.status === 'running' ? 'sync' : toolCall.status === 'success' ? 'check_circle' : 'error'}
  </span>
</div>

{/* 左侧色条 */}
<div className={`w-0.5 self-stretch rounded-full ${
  toolCall.status === 'running' ? 'bg-primary animate-pulse-green' :
  toolCall.status === 'success' ? 'bg-green-400' : 'bg-red-400'
}`} />
```

**展开/折叠动画**：使用 CSS transition 处理高度变化。

```tsx
<div className={`tool-card-body overflow-hidden transition-all duration-200 ease-out ${
  expanded ? 'max-h-[500px] opacity-100 pt-2' : 'max-h-0 opacity-0'
}`}>
  {/* 展开内容 */}
</div>
```

---

### 8.4 消息出现动画

每条新消息淡入 + 上移。

```tsx
<div className="group animate-msg-enter">
  {/* 消息内容 */}
</div>
```

注意：只有**新追加**的消息需要动画，已存在的消息不需要。可以通过判断消息 ID 是否是最新来决定是否加 class：

```tsx
const isNewMsg = msg.id === messages[messages.length - 1]?.id

<div className={`group ${isNewMsg ? 'animate-msg-enter' : ''}`}>
```

---

### 8.5 物料面板 Tab 切换动画

Tab 切换时内容区域淡入。

```tsx
<div key={activeTab} className="p-5 space-y-4 animate-msg-enter">
  {/* Tab 内容 */}
</div>
```

`key={activeTab}` 确保每次切换 Tab 都触发重新挂载，从而触发进入动画。

---

### 8.6 侧边栏折叠/展开动画

宽度过渡由 `transition-all duration-250 ease-in-out` 处理（已在 P1 中设置）。

导航项文字和对话历史的显示/隐藏需要配合宽度过渡：

```tsx
{/* 文字区域用 overflow-hidden + 白色 nowrap 处理 */}
{!collapsed && (
  <span className="text-sm whitespace-nowrap overflow-hidden animate-msg-enter">
    {item.label}
  </span>
)}
```

对话历史列表同理。

---

### 8.7 Toast 通知系统

全局 Toast 组件，在 `App.tsx` 中管理。

```tsx
// App.tsx 新增
const [toasts, setToasts] = useState<{ id: number; message: string; type: 'success' | 'error' | 'info' }[]>([])

const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
  const id = Date.now()
  setToasts(prev => [...prev, { id, message, type }])
  setTimeout(() => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, 3000)
}

// 通过 context 或 prop 传递给子组件
```

Toast 渲染（右上角）：

```tsx
<div className="fixed top-16 right-4 z-50 space-y-2">
  {toasts.map(toast => (
    <div key={toast.id} className={`animate-toast-in flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg backdrop-blur-sm text-sm ${
      toast.type === 'success' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
      toast.type === 'error' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
      'bg-surface-container text-on-surface border border-outline-variant/30'
    }`}>
      <span className="material-symbols-outlined text-[16px]">
        {toast.type === 'success' ? 'check_circle' : toast.type === 'error' ? 'error' : 'info'}
      </span>
      {toast.message}
    </div>
  ))}
</div>
```

MaterialCards 复制按钮改为使用 Toast：

```tsx
const handleCopy = async (text: string) => {
  await navigator.clipboard.writeText(text)
  showToast('已复制到剪贴板', 'success')
}
```

---

### 8.8 按钮交互状态

所有可点击按钮统一添加：

- **Hover**：背景色变亮 10-20%（已有 `hover:bg-*`）
- **Active（按下）**：缩放到 0.96 + 背景色变暗
- **Disabled**：opacity 40% + cursor not-allowed

```css
/* 在 index.css 中 */
button:active:not(:disabled) {
  transform: scale(0.96);
  transition: transform 0.1s ease-out;
}

button:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
```

---

### 8.9 加载状态（骨架屏）

数据分析页加载时显示骨架屏，而非空白。

```tsx
{loading ? (
  <div className="p-6 space-y-5 max-w-[1100px]">
    {/* 概览卡片骨架 */}
    <div className="grid grid-cols-4 gap-3">
      {[1,2,3,4].map(i => (
        <div key={i} className="bg-surface-container rounded-xl px-4 py-3">
          <div className="skeleton h-3 w-16 mb-3" />
          <div className="skeleton h-7 w-24" />
        </div>
      ))}
    </div>
    {/* 表格骨架 */}
    <div className="bg-surface-container rounded-xl p-5">
      <div className="skeleton h-4 w-32 mb-4" />
      {[1,2,3,4,5].map(i => (
        <div key={i} className="flex items-center gap-4 py-2.5 border-b border-outline-variant/20">
          <div className="skeleton h-3 w-8" />
          <div className="skeleton h-3 flex-1" />
          <div className="skeleton h-3 w-16" />
        </div>
      ))}
    </div>
  </div>
) : (
  /* 正常内容 */
)}
```

---

### 8.10 滚动行为

对话区域自动滚动到底部，但用户手动上翻后暂停自动滚动，新消息到来时显示"有新消息"提示。

```tsx
const [autoScroll, setAutoScroll] = useState(true)
const messagesEndRef = useRef<HTMLDivElement>(null)
const scrollContainerRef = useRef<HTMLDivElement>(null)

// 监听用户滚动
const handleScroll = () => {
  const el = scrollContainerRef.current
  if (!el) return
  const isAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50
  setAutoScroll(isAtBottom)
}

// 自动滚动
useEffect(() => {
  if (autoScroll) {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }
}, [messages, autoScroll])
```

在滚动容器上绑定 `onScroll`，在消息列表底部附近显示"有新消息 ↓"按钮（当 `!autoScroll && isStreaming` 时）。

---

### 动画时间规范

| 场景 | 时长 | 缓动函数 | 说明 |
|---|---|---|---|
| 消息出现 | 200ms | ease-out | 淡入 + 上移 8px |
| 工具卡片进入 | 250ms | ease-out | 淡入 + 左移 12px |
| 工具展开/折叠 | 200ms | ease-out | 高度 + 透明度 |
| 侧边栏折叠 | 250ms | ease-in-out | 宽度过渡 |
| Tab 切换 | 200ms | ease-out | 内容淡入 |
| Toast 进入 | 200ms | ease-out | 淡入 + 上移 + 缩放 |
| Toast 退出 | 200ms | ease-in | 反向 |
| 按钮按下 | 100ms | ease-out | 缩放 0.96 |
| 页面切换 | 200ms | ease-out | 淡入 |
| 骨架屏闪烁 | 1500ms | linear | 循环 |

---

### 验收标准

- [ ] 流式输出时有绿色闪烁光标跟随文字
- [ ] 新消息出现有淡入上移动画
- [ ] 工具卡片从左侧滑入，执行中图标旋转，完成后变绿色勾
- [ ] 工具卡片展开/折叠有高度过渡动画
- [ ] 侧边栏折叠/展开有宽度过渡
- [ ] Tab 切换有淡入动画
- [ ] 复制操作有 Toast 反馈
- [ ] 按钮按下有缩放反馈
- [ ] 数据分析页加载时显示骨架屏
- [ ] 对话滚动到底部，手动上翻后暂停自动滚动
- [ ] 所有动画时长在 100-300ms 范围内，不卡顿

---

*知更 Knower · 全量改进计划 v1.0*

