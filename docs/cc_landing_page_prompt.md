# 给 CC 的开发提示词：知更 Knower 产品发布落地页

## 任务

为「知更 Knower」制作一个**单文件产品发布落地页**（`landing.html`），全中文，风格参考 OpenAI Codex 官网（https://openai.com/zh-Hans-CN/codex/），设计规范严格遵循 Cursor 风格（见下方 design tokens）。页面需要有**交互式非线性动画**，不是静态展示页，而是一个有设计感的产品发布体验。

---

## 产品信息

**产品名**：知更 Knower
**定位**：面向个人视频创作者（B站/抖音/小红书）的本地 AI 桌面工作流客户端
**核心价值**：越用越懂你这个创作者。不是通用 AI 工具，是你自己的创作记忆。
**技术栈**：Electron 桌面应用，目前仅提供 **Windows** 版本下载（下载链接待定，先用占位符 `#download`）
**开源协议**：MIT

### 核心功能（落地页需要展示的）

1. **创作台** — 输入脚本，一键生成多平台发布物料（B站/YouTube/抖音/小红书标题、简介、标签、拍摄清单）
2. **数据概览** — 本地爬取各平台公开数据，AI 分析爆款规律
3. **灵感库** — 基于历史数据 + 平台趋势的个性化选题建议（即将上线）
4. **数据隐私** — 所有数据本地存储，不经过第三方服务器，用户自带 API Key

### Slogan 候选（CC 可以微调措辞，但核心信息不能丢）

- 主 Slogan：**「知更比你先看到下一条该做什么」**
- 副 Slogan：**「从选题到发布，一个就够」**
- 一句话介绍：「面向视频创作者的本地 AI 工作流，数据全在本地，越用越懂你。」

---

## 设计规范（Cursor 风格 Design Tokens）

以下是 `cursor_style_design.md` 中的完整规范摘要，落地页必须严格遵循。

### 颜色系统

**亮色主题（落地页默认）**：

| Token | 色值 | 用途 |
|-------|------|------|
| `{colors.canvas}` | #f7f7f4 | **暖奶白底色**，不是纯白。整个页面的地板 |
| `{colors.surface-card}` | #ffffff | 卡片表面，和底色形成微妙对比 |
| `{colors.ink}` | #26251e | 标题、强调文字（暖近黑，不是纯黑） |
| `{colors.body}` | #5a5852 | 正文 |
| `{colors.muted}` | #807d72 | 副标题、说明文字 |
| `{colors.muted-soft}` | #a09c92 | 更弱的文字 |
| `{colors.primary}` | #f54e00 | **唯一的 CTA 强调色（橙色）**，极少使用，只用于下载按钮和品牌 logo |
| `{colors.primary-active}` | #d04200 | 按下态 |
| `{colors.hairline}` | #e6e5e0 | 1px 分割线 |
| `{colors.hairline-strong}` | #cfcdc4 | 更强的边框线 |
| `{colors.surface-strong}` | #e6e5e0 | 标签、badge 背景 |

**AI 时间线色板（仅用于产品界面模拟截图中，不作为页面系统色）**：

| Token | 色值 | 含义 |
|-------|------|------|
| thinking | #dfa88f | 桃色 — AI 思考中 |
| grep | #9fc9a2 | 薄荷 — 搜索中 |
| read | #9fbbe0 | 浅蓝 — 读取中 |
| edit | #c0a8dd | 薰衣草 — 编辑中 |
| done | #c08532 | 暖金 — 完成 |

### 字体

| 用途 | 字体 | 字重 |
|------|------|------|
| 全站文字 | Inter, Noto Sans SC（Google Fonts 引入） | 400 / 500 / 600 |
| 代码/技术展示 | JetBrains Mono | 400 |

**关键原则**：
- 大标题字重 **永远 400**（杂志编辑感，不要 bold）
- 大标题用**负字间距**（letter-spacing: -1.5% 到 -2px）
- 代码展示区域全部用 JetBrains Mono

### 排版层级

| 层级 | 字号 | 字重 | 行高 | 字间距 | 用途 |
|------|------|------|------|--------|------|
| display-mega | 72px | 400 | 1.1 | -2.16px | Hero 主标题 |
| display-lg | 36px | 400 | 1.2 | -0.72px | 章节标题 |
| display-md | 26px | 400 | 1.25 | -0.325px | 子章节标题 |
| body-md | 16px | 400 | 1.5 | 0 | 正文 |
| body-sm | 14px | 400 | 1.5 | 0 | 辅助文字 |
| caption-uppercase | 11px | 600 | 1.4 | 0.88px | 标签、badge（大写） |
| button | 14px | 500 | 1.0 | 0 | CTA 按钮文字 |

### 布局系统

- 基础单位：4px
- 内容最大宽度：1200px 居中
- 章节间距：80px（vertical padding）
- 间距梯度：4 / 8 / 12 / 16 / 20 / 24 / 32 / 48 / 80px

### 深度与边框

- **零阴影**：不使用任何 drop-shadow / box-shadow
- 卡片和画布的区分靠：1px hairline + 白底与奶白底的微妙色差
- 唯一的「浮起」元素是 IDE/产品截图卡片（白底 + 1px hairline）

### 圆角

| 用途 | 值 |
|------|-----|
| CTA 按钮 | 8px |
| 卡片 | 12px |
| 大卡片 | 16px（极少用） |
| 标签/badge | 9999px（胶囊） |

---

## 页面结构（从上到下）

参考 Codex 官网的信息架构，但内容完全替换为知更的产品信息。页面由以下几个 section 组成，每个 section 之间 80px 间距：

### Section 0：顶部导航栏（固定）

- 左侧：知更 Logo（`logo-color.svg`） + "知更 Knower" 文字
- 右侧：「文档」链接 + 「GitHub」链接 + 「下载 Windows 版」CTA 按钮（`primary` 色）
- 背景：`{canvas}`，和页面底色一致
- 滚动时加一条 1px `{hairline}` 底线

### Section 1：Hero（首屏核心）

这是页面的灵魂。要让用户在 3 秒内理解：这是什么、为什么选它。

**布局**：
- 居中排版，文字 + 下载 CTA + 产品截图
- 主标题（display-mega 72px）：**「知更比你先看到下一条该做什么」**
- 副标题（body-md 16px，muted 色）：「面向视频创作者的本地 AI 工作流。数据全在本地，越用越懂你。」
- CTA：「下载 Windows 版」按钮（`primary` 背景白色文字）+ 右侧次要文字链接「查看源代码 →」
- 下方：一个产品截图卡片（模拟应用界面），白底 12px 圆角 1px hairline 边框

**产品截图卡片**：
这里放一个模拟的知更应用界面截图。可以用 CSS 手绘一个简化的应用界面示意（深色侧边栏 + 浅色内容区 + 聊天对话气泡），不需要真实截图，但要让人一眼看出这是一个 AI 聊天创作工具。截图卡片宽度 960px 最大，高度按比例缩放，居中展示。

### Section 2：核心功能展示

用 3 列卡片网格展示核心功能（桌面端 3 列，移动端 1 列）：

**卡片 1：创作台**
- 标题：「脚本进去，物料出来」
- 描述：「粘贴一份脚本，AI 自动生成 B站、YouTube、抖音、小红书的标题、简介、标签和拍摄清单。」
- 图标/视觉：可以用一个简化的代码/文本 → 多平台输出的示意

**卡片 2：数据概览**
- 标题：「你的数据，你说了算」
- 描述：「本地爬取各平台公开数据，AI 分析爆款规律。所有数据存储在本地 SQLite，零泄露。」
- 图标/视觉：数据图表/分析示意

**卡片 3：灵感库**
- 标题：「越用越懂你」
- 描述：「基于你的历史表现和平台趋势，AI 为你生成个性化选题建议。即将上线。」
- 图标/视觉：灯泡/灵感示意
- 加一个「即将上线」badge（`surface-strong` 背景）

卡片样式：`{surface-card}` 背景，12px 圆角，1px `{hairline}` 边框，24px padding。Hover 态：border-color 变为 `{primary}`。

### Section 3：产品工作流展示

用一个横向的时间线/流程图展示知更的工作流，模拟 Codex 官网的 AI Timeline 风格：

```
输入脚本 → AI 分析脚本 → 生成多平台物料 → 保存到本地数据库 → 下次自动学习你的偏好
```

每个步骤用一个「时间线胶囊」展示，颜色使用 AI 时间线色板：
- peach → thinking
- mint → grep  
- blue → read
- lavender → edit
- gold → done

这是页面的**视觉签名**（signature element），和 Cursor 的 timeline pill 一样的存在感。

### Section 4：隐私与安全

一个全宽的深色 band（用 `{ink}` 背景，`{canvas}` 文字），强调数据隐私：

- 标题（display-md）：「数据永远在你手里」
- 3 个要点（横向排列）：
  1. 「本地存储」— 所有数据存储在本地 SQLite，不上传任何服务器
  2. 「自带 Key」— 你自己的 API Key，我们不接触你的 AI 服务
  3. 「开源可审」— MIT 协议，代码完全公开

### Section 5：技术栈展示（可选但推荐）

一行简约的技术栈 badge 展示，体现专业感：

Electron · React · TypeScript · SQLite · AI Agent · MediaCrawler

用 `{surface-strong}` 背景的胶囊标签，`caption-uppercase` 样式。

### Section 6：下载 CTA（Pre-footer）

- 标题（display-lg 36px）：「开始创作」
- 副标题：「免费下载，自带 API Key 即可使用。」
- 大号下载按钮：「下载 Windows 版」（`primary` 色，高度 48px，更大 padding）
- 下方小字：「支持 Windows 10+ · macOS 版本开发中」（muted 色）

### Section 7：Footer

- 背景：`{canvas}`
- 左侧：知更 Logo 小尺寸 + "© 2025 知更 Knower · MIT License"
- 右侧：GitHub / Gitee / B站 链接（图标 + 文字）
- 用 1px `{hairline}` 顶线和主内容分隔

---

## 交互式非线性动画要求

这是本页面和普通产品页的核心区别。所有动画使用 CSS `@keyframes` + Intersection Observer（或纯 CSS `animation-timeline: view()`），不依赖任何 JS 动画库。

### 全局动画原则

- **滚动驱动**：内容在进入视口时触发入场动画，离开时可选触发退场
- **非线性节奏**：用 `cubic-bezier` 替代 `ease`/`linear`，制造有弹性的运动感
- **Stagger 延迟**：同一行的多个元素依次入场，间隔 80-120ms
- **持续时间**：200-500ms，不能拖慢用户感知速度
- **减少运动偏好**：`@media (prefers-reduced-motion: reduce)` 下所有动画禁用

### 具体动画清单

**1. Hero 文字入场（页面加载时触发）**
- 主标题：从下方 40px 位置 + 透明度 0 → 原位 + 透明度 1，600ms，`cubic-bezier(0.16, 1, 0.3, 1)`
- 副标题：延迟 200ms 同样方式入场
- CTA 按钮：延迟 400ms，从 scale(0.9) + 透明度 0 → 正常
- 产品截图卡片：延迟 600ms，从下方 60px + 透明度 0 → 正常，800ms

**2. 功能卡片交错入场（滚动触发）**
- 3 张卡片依次从下方 30px + 透明度 0 入场，间隔 120ms
- 用 `IntersectionObserver`（threshold: 0.2）触发
- 入场动画：400ms，`cubic-bezier(0.16, 1, 0.3, 1)`

**3. 工作流时间线胶囊逐个点亮（滚动触发）**
- 5 个时间线胶囊从左到右依次出现
- 每个胶囊：从 scale(0.8) + 透明度 0 → 正常，300ms
- 间隔 200ms（非线性延迟，后面几个间隔略短）
- 连接线用 `scaleX` 从 0 → 1 动画展开

**4. 深色隐私 Band 文字入场**
- 标题和 3 个要点从下方 20px + 透明度 0 入场
- 要点间隔 100ms

**5. CTA 区域微交互**
- 下载按钮 hover：背景色过渡到 `primary-active`，同时 translateY(-1px)
- 下载按钮 active：scale(0.96)，100ms

**6. 页面顶部导航栏滚动变化**
- 滚动超过 Hero 区域后，导航栏背景从 transparent 过渡到 `{canvas}` + 底部 hairline
- 用 `scroll` 事件 + `requestAnimationFrame` 检测滚动位置

**7. Logo 微动画（可选但推荐）**
- 页面加载时，Logo 的鸟做一个微小的翅膀扇动（2-3 帧关键帧），500ms，只播放一次
- 用 CSS `transform: rotate()` 在 SVG 的 wing 路径上实现

### 非线性 timing 参考

```css
/* 弹性入场 */
cubic-bezier(0.16, 1, 0.3, 1)

/* 平滑减速 */
cubic-bezier(0.33, 1, 0.68, 1)

/* 带回弹的出场 */
cubic-bezier(0.34, 1.56, 0.64, 1)
```

---

## SVG Logo 使用说明

项目中有 3 个 SVG logo 文件，路径：`assets/`

### 1. `logo-color.svg`（彩色版，**落地页主用**）

- 深海军蓝背景（#101A2F）
- 蓝色知更鸟（#4F7CFF）
- 橙色太阳（#FF9E4D）
- 白色星星
- Squircle 圆角裁剪（rx=115）
- **用途**：导航栏 Logo、Hero 区域 Logo、Footer Logo

### 2. `logo-circle.svg`（白色版）

- 同样设计但所有元素为白色
- 圆形裁剪
- **用途**：深色背景区域（如隐私 Band）的 Logo

### 3. `logo-sidebar.svg`（白色底版）

- 白色背景，深色元素
- Squircle 裁剪
- **用途**：不需要，落地页不用此版本

### Logo 尺寸规范

| 位置 | 尺寸 |
|------|------|
| 导航栏 | 32×32px |
| Hero 区域 | 80×80px 或 96×96px |
| Footer | 24×24px |
| 深色 Band | 48×48px（用白色版） |

---

## 技术要求

### 单文件交付

整个落地页为一个 `landing.html` 文件，所有 CSS 内联在 `<style>` 中，所有 JS 内联在 `<script>` 中。不依赖任何外部框架（React/Vue 等），不依赖任何 CDN（除了 Google Fonts）。

### 外部依赖

唯一允许的外部依赖：
- Google Fonts：Inter + Noto Sans SC + JetBrains Mono（`<link>` 引入）
- 不要引入任何其他 CDN / JS 库 / CSS 框架

### CSS 要求

- 使用 CSS Custom Properties 定义所有颜色（和 Knower 的 tailwind.config.js 变量名一致）
- 使用 CSS `@keyframes` 定义所有动画
- 使用 `IntersectionObserver` API 驱动滚动触发动画
- 使用 `matchMedia('(prefers-reduced-motion: reduce)')` 尊重用户设置
- 使用 CSS Grid 或 Flexbox 布局
- 响应式设计：移动端（< 640px）单列，平板（640-1024px）两列，桌面（> 1024px）三列/全宽

### HTML 要求

- 语义化 HTML5 标签（`<header>` / `<main>` / `<section>` / `<footer>` / `<nav>`）
- `<meta>` viewport 设置
- `<title>` 设为「知更 Knower — 面向视频创作者的本地 AI 工作流」
- 中文 lang 属性：`lang="zh-CN"`

### 性能要求

- 首屏渲染 < 1s（纯静态 HTML，不依赖网络资源加载内容）
- 动画帧率 ≥ 30fps（使用 `transform` 和 `opacity` 而非 `top`/`left`/`width`）
- 图片资源：Logo 用 SVG 内联（直接粘贴 SVG 代码到 HTML 中），不使用 `<img>` 引用

---

## 交付物

一个文件：`landing.html`

放在项目根目录：`C:\Users\20300\Desktop\knower_dev\landing.html`

---

## 注意事项

1. **所有文案必须是中文**，包括按钮、标签、描述
2. **下载按钮用占位链接** `#download`，下载链接还没准备好
3. **不要用渐变背景或渐变卡片**，保持 Cursor 风格的克制感
4. **不要用 emoji**，用文字或图标代替
5. **产品截图区域**用 CSS 手绘一个简化的应用界面示意，不需要真实截图
6. **卡片 hover 效果**：border-color 变为 primary 色，不要加 shadow
7. **导航栏滚动变色**：从透明到不透明的过渡要平滑
8. **时间线胶囊**是页面的视觉签名，要做得精致
9. **保持代码简洁可读**，适当加注释
10. **先读 `docs/cursor_style_design.md`** 获取完整的设计规范，不要偏离
11. **Logo SVG 代码直接内联到 HTML 中**（`<svg>...</svg>`），不要用 `<img src="assets/...">`，这样落地页才能独立运行
