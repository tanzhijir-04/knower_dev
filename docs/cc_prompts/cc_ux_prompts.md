# 知更 Knower · CC 提示词 — 用户体验优化三连

> 按顺序执行，每个提示词独立成一轮对话。
> 执行前确保 `pnpm dev` 能正常启动。

---

## 提示词 1：P4 创作台重构 — 工具调用卡片 + 物料面板升级

> 预估工时 4-6h，改 `ChatView.tsx` + `MaterialCards.tsx` + `index.css`

```
# 知更 Knower · 创作台 P4 重构

对 `src/components/ChatView.tsx` 和 `src/components/MaterialCards.tsx` 做以下改动。

## 项目约束

- React 18 + TypeScript 5.6 + Tailwind CSS 3.4
- 图标用 @phosphor-icons/react，不要用其他图标库
- 禁止 react-router / zustand / redux / axios
- CSS 变量在 src/index.css 的 :root 和 .dark 中定义，不要新增全局变量
- 已有动画类：animate-fade-in / animate-msg-enter / animate-tool-enter / typing-cursor / skeleton

## 一、工具调用卡片改造

当前 `msg.toolCalls` 渲染为一行 timeline pill（Thinking → Done），信息密度太低。

改为可折叠的 **tool-card** 卡片，结构如下：

### 1.1 卡片结构（替换现有 timeline pill 区域）

```
┌─────────────────────────────────────────────┐
│ [icon] 分析脚本结构              Thinking →  │  ← 点击展开/折叠
│       ─── ─── ─── ─── ─── ───（虚线进度条）  │  ← running 时显示
├─────────────────────────────────────────────┤
│                                             │  ← 展开后显示
│  输入: { ... }                              │
│  结果: { ... }                              │
│  耗时: 1.2s                                 │
│                                             │
└─────────────────────────────────────────────┘
```

### 1.2 卡片渲染逻辑

在 `ChatView.tsx` 的 messages.map 中，替换现有的 `msg.toolCalls` timeline pill 区域：

- 每个 toolCall 渲染为一个 `.tool-card` div
- 卡片左侧有 3px 色条：running=var(--primary), success=var(--semantic-success), error=var(--semantic-error)
- 卡片头部：icon（Spinner/CheckCircle/XCircle）+ 工具中文标签 + 状态 pill + 展开箭头 ▶
- 卡片 body（可折叠）：输入参数 JSON 和输出结果 JSON，用 `<pre>` 渲染
- 默认折叠，点击展开
- 用 `useState` 管理每张卡片的展开状态（`expandedTools: Set<number>`）

### 1.3 工具中文标签映射

```typescript
const TOOL_LABELS: Record<string, string> = {
  crawl_data: '爬取平台数据',
  crawl_data_batch: '批量爬取数据',
  query_data: '查询本地数据',
  analyze_script: '分析脚本结构',
  expand_script: '生成各平台物料',
  suggest_topics: '生成选题建议',
  save_result: '保存到数据库',
  request_user_input: '请求补充信息',
  search_similar: '语义检索历史数据',
  analyze_topic: '深度分析选题',
}
```

### 1.4 卡片交互

- running 状态：左侧色条加 `animate-pulse`（CSS 自带），icon 用 `<Spinner>` + animate-spin
- success 状态：icon 变 `<CheckCircle>`，色条静止
- error 状态：icon 变 `<XCircle>`，色条静止，背景加 `bg-semantic-error/5`
- 点击 header 切换 body 展开/折叠，折叠动画用 `max-height` transition

## 二、物料面板改造

### 2.1 移除侧边栏 Canvas 面板

删除 `canvasOpen` / `canvasData` 相关状态和渲染（右侧 420px 的 panel），物料展示统一用内联的 `MaterialCards`。

### 2.2 MaterialCards 升级

在 `MaterialCards.tsx` 中：

1. **分析卡片**（已有的 AnalysisCard）：保持不变
2. **平台 Tab 栏**：保持不变
3. **Tab 内容区改造**：

每个物料字段（标题 / 描述 / 标签 / 封面标题 / 钩子）改为 **独立字段卡片**：

```
┌─────────────────────────────────────┐
│ 标题                       [复制] 📋 │
│ B站标题内容在这里...                  │
└─────────────────────────────────────┘
```

- 每个字段用 `.card-sm` 样式
- 右上角有复制按钮
- 空字段不渲染
- 标签用 pill 标签展示（已有）

### 2.3 消息操作栏调整

删除"在面板查看"按钮（因为 Canvas 已移除），保留其余操作：
- 👍 👎 反馈
- 📋 复制
- 📤 导出
- 🔄 重新生成

### 2.4 一键复制全部

在 Tab 栏右侧加一个"复制全部"按钮，点击后把当前平台的标题+描述+标签拼成文本复制到剪贴板。

## 三、CSS 改动

在 `index.css` 的 `@layer components` 中确保以下样式存在（可能已有部分）：

```css
/* tool-card 折叠动画 */
.tool-card-body {
  overflow: hidden;
  transition: max-height 0.2s ease-out, opacity 0.2s ease-out;
}
.tool-card-body.collapsed {
  max-height: 0;
  opacity: 0;
}
.tool-card-body.expanded {
  max-height: 500px;
  opacity: 1;
}
```

## 验收标准

1. 工具调用显示为独立卡片，running/success/error 三态视觉清晰
2. 卡片可展开查看输入输出 JSON
3. 物料字段各自独立成卡片，每个有复制按钮
4. Canvas 侧边栏已移除
5. "复制全部"按钮可用
6. `pnpm dev` 启动无报错
```

---

## 提示词 2：P5 欢迎页重做

> 预估工时 2-3h，改 `ChatView.tsx`

```
# 知更 Knower · P5 欢迎页重做

对 `src/components/ChatView.tsx` 中的 welcome 区域（`showWelcome` 为 true 时渲染的内容）做以下改动。

## 项目约束

同提示词 1。

## 一、当前状态

当前欢迎页已有：
- Logo + "知更 Knower" + Slogan
- "粘贴脚本，一键生成物料" 卡片
- "查看数据" / "配置 API" 快捷按钮

## 二、改造内容

### 2.1 布局调整

改为三栏卡片布局（grid），替换现有的单一卡片：

```
┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│  ⚡           │ │  📊           │ │  💡           │
│  生成物料     │ │  数据分析     │ │  选题灵感     │
│              │ │              │ │              │
│  粘贴脚本，   │ │  爬取平台数据 │ │  基于热点和   │
│  一键生成     │ │  AI 深度分析  │ │  历史数据     │
│  四平台物料   │ │  多维图表     │ │  生成选题     │
│              │ │              │ │              │
│  [开始创作 →] │ │  [查看数据 →] │ │  [获取灵感 →] │
└──────────────┘ └──────────────┘ └──────────────┘
```

### 2.2 三张卡片

1. **生成物料**（点击聚焦输入框）
   - Icon: `Lightning`（Phosphor）
   - 标题: "生成物料"
   - 描述: "粘贴脚本，一键生成 B站 / YouTube / 抖音 / 小红书 四平台发布物料"
   - 按钮: "开始创作" → 调用 `textareaRef.current?.focus()`

2. **数据分析**（跳转数据页）
   - Icon: `ChartBar`（Phosphor）
   - 标题: "数据分析"
   - 描述: "爬取平台数据，AI 深度分析，多维图表可视化"
   - 按钮: "查看数据" → 调用 `onNavigate?.('data')`

3. **选题灵感**（跳转灵感库）
   - Icon: `Lightbulb`（Phosphor）
   - 标题: "选题灵感"
   - 描述: "基于热点趋势和历史数据，AI 生成选题方向"
   - 按钮: "获取灵感" → 调用 `onNavigate?.('topics')`

### 2.3 卡片样式

每张卡片用 `.card` 样式，内部 flex col 布局：
- 顶部：icon（大号，带 primary 色背景圆形底色）
- 中部：标题（text-sm font-medium）+ 描述（text-xs text-muted）
- 底部：按钮（btn-secondary text-xs，右侧有 → 箭头）

hover 时 `border-primary/30` 过渡效果（已有 group hover）。

### 2.4 底部快捷提示

三张卡片下方加一行快捷提示文字：

```
💡 试试直接粘贴一段视频脚本到输入框，知更会自动分析并生成物料
```

### 2.5 保留顶部 Logo 区域

Logo + "知更 Knower" + Slogan 保持不变。

## 验收标准

1. 欢迎页显示三栏卡片：生成物料 / 数据分析 / 选题灵感
2. 每张卡片有 icon + 标题 + 描述 + 按钮
3. 点击"生成物料"聚焦输入框，点击其他两个跳转对应页面
4. hover 效果正常
5. `pnpm dev` 启动无报错
```

---

## 提示词 3：P8 动画与交互细节

> 预估工时 3-4h，改 `index.css` + `ChatView.tsx` + `Sidebar.tsx`

```
# 知更 Knower · P8 动画与交互细节

对以下文件做动画增强：`src/index.css`、`src/components/ChatView.tsx`、`src/components/Sidebar.tsx`。

## 项目约束

同提示词 1。已有的 keyframes 和动画类不要重复定义，只补充缺失的。

## 一、全局动画补充（index.css）

在 @keyframes 区域补充以下缺失的动画（如果还没有的话）：

```css
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

/* 卡片展开 */
@keyframes expand-in {
  from { opacity: 0; max-height: 0; }
  to { opacity: 1; max-height: 500px; }
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
```

在 @layer components 中补充：

```css
.animate-msg-enter {
  animation: msg-enter 0.2s ease-out forwards;
}
.animate-tool-enter {
  animation: tool-enter 0.25s ease-out forwards;
}
.animate-pulse-green {
  animation: pulse-green 1.5s ease-in-out infinite;
}
.animate-toast-in {
  animation: toast-in 0.2s ease-out forwards;
}
.animate-toast-out {
  animation: toast-out 0.2s ease-in forwards;
}
```

## 二、ChatView 动画增强

### 2.1 新消息进入动画

在 messages.map 中，对最新一条消息（`isNewMsg === true`）加 `animate-msg-enter` class。当前代码已有 `animateMessage(el, msg.role)` 的 GSAP 调用，如果 GSAP 动画已经处理了进入效果，就不要再加 CSS animation 以免冲突。检查 `src/lib/gsap.ts` 中 `animateMessage` 的实现，如果它已经做了淡入+位移，就跳过这步。

### 2.2 工具卡片展开/折叠动画

在 P4 提示词中已创建的 tool-card，确保展开 body 时有高度过渡动画：

```tsx
<div className={`tool-card-body ${expanded ? 'expanded' : 'collapsed'}`}>
```

CSS 中（已在 P4 中定义）：
```css
.tool-card-body { overflow: hidden; transition: max-height 0.2s ease-out, opacity 0.2s ease-out; }
.tool-card-body.collapsed { max-height: 0; opacity: 0; }
.tool-card-body.expanded { max-height: 500px; opacity: 1; }
```

### 2.3 滚动行为优化

当前已有 `autoScroll` + `handleScroll` 逻辑和"有新消息"按钮。确保：
- "有新消息"按钮有 `animate-fade-in` class（当前已有）
- 点击后 smooth scroll 到底部

### 2.4 流式输入区动画

在输入框上方的 `currentToolName` 指示器中，左侧的脉冲圆点已有 `animate-pulse`，保持不变。

## 三、Sidebar 折叠动画

检查 `src/components/Sidebar.tsx`：

### 3.1 宽度过渡

确保侧边栏 `<aside>` 有 `transition: width 0.25s ease-in-out`（或等价的 Tailwind `transition-all duration-250`）。

### 3.2 文字淡入

折叠/展开时，导航项文字应该有淡入效果。如果当前直接用 `{!collapsed && <span>...}` 控制显隐，改为用 CSS transition：

方案 A（简单）：文字区域加 `overflow-hidden whitespace-nowrap`，宽度由父级 flex 控制自然收缩/展开。

方案 B（精细）：用 `opacity` + `max-width` transition：

```tsx
<span className={`text-sm whitespace-nowrap overflow-hidden transition-all duration-200 ${collapsed ? 'max-w-0 opacity-0' : 'max-w-[160px] opacity-100'}`}>
  {item.label}
</span>
```

## 四、按钮交互统一

检查全局是否已有：

```css
button:active:not(:disabled) { transform: scale(0.96); transition: transform 0.1s ease-out; }
button:disabled { opacity: 0.4; cursor: not-allowed; }
```

如果已有则跳过。如果没有则在 `index.css` 的 `@layer base` 末尾添加。

## 五、Tab 切换动画

在 `MaterialCards.tsx` 中，Tab 内容区已有 `key={activeTab}` + `animate-msg-enter`，确保这个组合存在。如果缺少 `key` prop，加上它（`key={activeTab}` 会触发 React 重新挂载，从而触发动画）。

## 验收标准

1. 新消息出现有淡入上移动画（不与 GSAP 冲突）
2. 工具卡片展开/折叠有高度过渡
3. 侧边栏折叠/展开宽度过渡平滑，文字有淡入效果
4. 按钮按下有缩放反馈
5. Tab 切换内容区有淡入动画
6. 所有动画时长在 100-300ms，不卡顿
7. `pnpm dev` 启动无报错
```

---

以上三个提示词按顺序使用。建议执行顺序：**P4 → P5 → P8**，因为 P8 的动画增强依赖 P4 的工具卡片结构。
