# 给 CC 的开发提示词：知更 Knower UI 改进 + Bug 修复

## 背景

知更 Knower 是一个 Electron + React + TypeScript 的桌面应用，面向视频创作者。目前 UI 比较粗糙，需要对标 ChatGPT Codex 的体验进行全面改进。同时有几个必须修复的 bug。

项目路径：`C:\Users\20300\Desktop\knower_dev`

## 必须先读的文件

1. `docs/improvement_plan.md` — 完整的技术方案，包含每个文件的具体改动代码
2. `docs/knower_ui_prd.md` — UI 设计规范（参考用）
3. `docs/knower_prd_v2.md` — 产品 PRD（了解产品定位）

## Bug 修复（最高优先级，先做这些）

### Bug 1：数据分析页侧边栏显示 UID 而非用户名

**现象**：爬取 B站创作者后，左侧边栏显示 `440609243` 而非用户名。
**根因**：`electron/main.ts` 的 `crawler-run` handler 中，`sourceName = options.creatorId` 直接拿 UID 当名字。
**修复**：在 `saveCrawlContentBatch` 之前，从 `result.creators[0].nickname` 取真实昵称赋值给 `sourceName`。具体代码见 `improvement_plan.md` 的 P2 部分。

### Bug 2：创作者头像不显示

**现象**：侧边栏创作者头像是空的或显示首字母 fallback。
**根因**：MediaCrawler B站返回的头像字段是 `face`，但代码只读 `avatar`。
**修复**：`electron/main.ts` 和 `knower-agent/db/index.js` 中三处兼容 `face` / `avatar` / `avatar_url`。同时在 `db/index.js` 的 `initTables()` 末尾增加数据修复函数，用 `creators` 表的真实名称更新 `crawl_content` 中 UID 格式的 `source_name`。具体代码见 `improvement_plan.md` 的 P2 部分。

### Bug 3：AI 分析结果不持久化

**现象**：每次打开数据分析页点"AI 分析"都要重新调 LLM，切换页面后结果丢失。
**根因**：分析结果只存在前端内存 `useRef<Map>`，未写入数据库。
**修复**：
1. `knower-agent/db/index.js` 新增 `video_analyses` 表 + `saveVideoAnalysis` / `getVideoAnalysis` / `deleteVideoAnalysis` 三个函数
2. `electron/main.ts` 的 `analyze-video-data` handler 改为"先查 DB 缓存，没有再调 LLM"
3. `crawler-run` handler 中爬取完成后调用 `deleteVideoAnalysis` 清除旧缓存
具体代码见 `improvement_plan.md` 的 P3 部分。

---

## UI 改进（按顺序执行）

### 第一步：字体渲染修复（P0）

**问题**：UI 全文使用 JetBrains Mono（等宽字体），Windows 上渲染偏软偏细。
**改动三个文件**：

1. `index.html` — Google Fonts 链接增加 Inter + Noto Sans SC，body class 去掉 `antialiased`
2. `tailwind.config.js` — `fontFamily.sans` 改为 `['Inter', 'Noto Sans SC', '-apple-system', 'Segoe UI', ...]`
3. `src/index.css` — body font-family 改为 Inter 系统栈，增加 `text-rendering: optimizeLegibility`，末尾增加 `code, pre, .font-mono { font-family: 'JetBrains Mono' !important; }`

具体代码见 `improvement_plan.md` 的 P0 部分。

### 第二步：侧边栏重构（P1）

**改动**：`src/components/Sidebar.tsx` 重写为 240px 宽，包含 Logo + 产品名、导航项（图标 + 文字）、对话历史列表、底部折叠按钮。

**关键点**：
- 原来 ChatView 右上角的"新建对话"和"历史记录"按钮要删掉，历史记录功能迁移到左侧边栏
- `src/App.tsx` 需要传入 `onOpenConversation` 回调
- `src/components/ChatView.tsx` 需要接收 `initialConversationId` prop

具体代码见 `improvement_plan.md` 的 P1 部分。

### 第三步：创作台重构（P4）

**改动**：`src/components/ChatView.tsx` 大幅重构。

1. **消息布局**：从气泡改为全宽，用户消息右对齐浅绿背景，助手消息左对齐
2. **工具调用卡片**：新增 `ToolCallCard` 组件，可折叠卡片，左侧色条 + 状态图标 + 工具名 + 耗时，展开查看输入/输出 JSON
3. **物料面板**：`src/components/MaterialCards.tsx` 改为 `MaterialPanel`，全宽独立面板，每个物料字段独立一行带复制按钮
4. **消息操作栏**：每条消息 hover 时底部出现复制/点赞/踩按钮
5. **Message 类型扩展**：增加 `toolCalls`、`materialData`、`textContent` 字段

具体代码见 `improvement_plan.md` 的 P4 部分。

### 第四步：欢迎页重做（P5）

**改动**：`src/components/ChatView.tsx` 中 `showWelcome` 区域重写。

居中显示 Logo + "知更 Knower" + Slogan + "粘贴脚本"引导卡片 + 两个快捷操作（查看数据 / 配置 API）。ChatView 需要新增 `onNavigate` prop 用于跳转。

具体代码见 `improvement_plan.md` 的 P5 部分。

### 第五步：数据分析页布局优化（P6）

**改动**：`src/components/DataView.tsx` 顶部操作栏从一行拥挤布局改为两行。

具体代码见 `improvement_plan.md` 的 P6 部分。

### 第六步：页面数据互通（P7）

**改动**：
1. `knower-agent/db/index.js` 新增 `getRecentCrawlSummary()` 查询用户爬取数据概要
2. `electron/main.ts` 的 `agent-run` handler 中注入数据摘要到 prompt

具体代码见 `improvement_plan.md` 的 P7 部分。

### 第七步：动画与交互（P8）

**改动**：`src/index.css` 新增所有 keyframe 动画定义 + CSS 工具类。然后在各组件中应用：

- 流式输出绿色闪烁光标
- 新消息淡入上移动画
- 工具卡片从左侧滑入 + 状态转换动画
- 工具展开/折叠高度过渡
- 侧边栏折叠宽度过渡
- Tab 切换淡入
- Toast 通知系统（`App.tsx` 中管理）
- 按钮按下缩放反馈
- 数据分析页骨架屏加载态
- 对话自动滚动 + 手动上翻暂停

具体代码见 `improvement_plan.md` 的 P8 部分。

---

## 执行顺序

```
Bug 修复：P2（UID+头像）→ P3（分析持久化）
UI 改进：P0（字体）→ P1（侧边栏）→ P4（创作台）→ P5（欢迎页）→ P6（数据页）→ P7（数据互通）→ P8（动画）
```

## 注意事项

1. **先读 `improvement_plan.md`**，里面有每个文件的具体改动代码，不要靠猜
2. **改完每个 P 后手动测试**，确保不 break 现有功能
3. **侧边栏重构时注意**：原来 ChatView header 里的"新建对话 +"和"历史记录"按钮要删掉，功能已迁移到侧边栏
4. **字体改动后检查**：代码块（JSON 输出、脚本内容）必须仍然使用 JetBrains Mono
5. **数据库改动后**：重启应用确保新表自动创建，旧数据自动修复
6. **动画不要过度**：所有动画时长控制在 100-300ms，不要影响操作效率
