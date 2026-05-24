# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## 项目概述

知更 Knower — 面向个人视频创作者（B站/抖音/小红书）的本地 AI 桌面工作流客户端。帮助从选题到发布，生成多平台发布物料（脚本、标题、标签、封面文案、字幕稿等）。用户自带 API key，数据全在本地，不经过第三方服务器。

## 构建命令

```bash
npm run dev       # 启动开发（Vite HMR + Electron 热重载）
npm run build     # tsc 类型检查 + Vite 打包 + electron-builder 打包
npm run preview   # 预览前端产物
```

## 技术栈

- Electron 33 + React 18 + TypeScript 5.6（strict mode）
- Vite 6 + `vite-plugin-electron`（主进程/preload 分别构建到 `dist-electron/`）
- Tailwind CSS 3.4，暗色主题，配色复用 STITCH 原型
- 路径别名 `@` → `./src`（vite.config.ts 中定义）
- 无测试框架、无 linter 已配置

## 架构要点

**页面路由：** `App.tsx` 用 `useState<Page>` 手动切换（非 react-router），四个页面：chat（创作台）/ topics（灵感库）/ data（数据分析）/ settings（设置）。

**Electron IPC：** 渲染进程 → preload（`contextBridge`）→ main，`contextIsolation: true`，`nodeIntegration: false`。preload 暴露 `window.electronAPI`（`getStore` / `setStore`）。main.ts 中 IPC handler 目前是 stub。

**API 调用约定：** 所有 AI 调用统一使用 OpenAI-compatible `/v1/chat/completions` 格式，通过 raw `fetch` 调用，不用各家 SDK。需支持 SSE 流式输出。

**样式：** 所有颜色定义在 `tailwind.config.js`，组件中不硬编码 hex 值。自定义组件类在 `src/index.css`（sidebar-btn, chat-bubble, suggestion-card, input-bar）。字体：JetBrains Mono（正文）、Source Serif 4（标题）、Material Symbols Outlined（图标，Google Fonts CDN）。

## 关键文件

| 文件 | 职责 |
|------|------|
| `electron/main.ts` | 主进程：窗口创建（1200x800, macOS hiddenInset）、IPC handler |
| `electron/preload.ts` | 暴露 electronAPI 给渲染进程 |
| `src/App.tsx` | 页面路由（`Page` 类型） |
| `src/components/ChatView.tsx` | 创作台聊天界面，**MVP 核心** |
| `knower-agent/` | Agent Core 子项目（Node.js，独立于 Electron） |
| `knower-agent/crawler/` | **爬虫模块**（MediaCrawler 集成，支持 B站/抖音/小红书/微博） |
| `knower-agent/lib/crawler.js` | 爬虫 Node.js 封装（子进程调用 Python） |
| `src/components/SettingsView.tsx` | API 配置页（provider/key/baseUrl/model） |
| `src/index.css` | Tailwind 组件样式 + 滚动条 + macOS 拖拽区域 |
| `tailwind.config.js` | 全部颜色和字体定义 |
| `AGENT.md` | AI agent 协作指南（文件职责、技术决策、分支约定） |

## 开发阶段

### 已完成
- 项目骨架（Electron + React + TS + Vite）
- 暗色主题 UI，侧边栏导航，聊天界面基础组件，设置页，占位页
- Agent Core 子项目（knower-agent/）：tool use 主循环、流式输出、SQLite 存储

### 待开发（按优先级）
1. **创作台接入 Agent** — ChatView 通过 IPC 调用 Agent Core，SSE 流式展示物料
2. **electron-store 持久化** — 设置页配置项本地保存（main.ts IPC handler 待实现）
3. **输出物料展示** — 结构化展示各平台物料，支持复制导出
4. **脚本输入体验** — 富文本编辑、文件导入

### 后续阶段（PRD 第二、三期）
- ~~Chrome CDP 数据采集模块~~ ✅ 已集成 MediaCrawler
- SQLite 本地数据存储
- AI 选题建议（基于历史数据分析爆款规律）

## 爬虫模块（已集成）

MediaCrawler 多平台爬虫已集成到 `knower-agent/crawler/`，支持 B站、抖音、小红书、微博 四个平台。

### 初始化

```bash
cd knower-agent/crawler
setup_env.bat  # 创建 venv + 安装依赖 + 安装 Playwright
```

### 使用方式

```javascript
// Node.js 调用
const { runCrawler } = require('./knower-agent/lib/crawler');
const result = await runCrawler('bili', '关键词', { maxNotes: 10 });

// Electron IPC 调用
const result = await window.electronAPI.runCrawler('bili', '关键词', { maxNotes: 10 });
```

### 平台参数

| 平台 | platform 值 | 说明 |
|------|------------|------|
| B站 | `bili` | 支持 `specifiedId`, `creatorId` |
| 抖音 | `dy` | 需要 Node.js（JS 签名） |
| 小红书 | `xhs` | - |
| 微博 | `wb` | - |

### 数据库表

新增 `crawl_tasks` 和 `crawl_content` 表，自动存储爬取结果到 `knower.db`。

### 注意事项

1. 首次运行需扫码登录，登录状态保存在 `mediasrc/login_state/`
2. 建议 `ENABLE_CDP_MODE = False`（除非有远程调试 Chrome）
3. `.gitignore` 已排除 `.venv/`、`data/`、`*_user_data_dir/`、`login_state/`

## 重要约定

- 所有 AI 调用使用 OpenAI-compatible API 格式，用户自配 key，不硬编码
- 数据全部本地存储，不经过任何第三方服务器
- 每个功能模块独立，互不耦合
- 代码开源（MIT 协议）

## 提交约定

分支：`main`（稳定）/ `dev`（开发）/ `feat/xxx`（功能分支）

提交格式：`type(scope): 描述`
- type: feat / fix / refactor / style / docs / chore
- 示例: `feat(chat): 接入 streaming API`
