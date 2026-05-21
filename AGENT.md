# AGENT.md — AI Agent 协作指南

本文档帮助任何参与开发的 AI Agent 快速理解项目上下文和当前进度。

## 项目一句话

知更 Knower 是一个 Electron 桌面应用，帮视频创作者用 AI 生成多平台发布物料。用户自己的 API key，数据全在本地。

## 当前状态

**阶段：MVP 骨架已完成，核心功能待接入**

项目能跑起来（`npm run dev`），UI 已经搭好，但 AI 调用还是占位的。下一步是让 ChatView 能真正调 LLM 接口。

## 你需要知道的

### 文件职责速查

| 文件 | 干什么的 | 改动频率 |
|------|----------|----------|
| `electron/main.ts` | Electron 主进程，窗口创建，IPC handler | 低 |
| `electron/preload.ts` | 暴露 electronAPI 给渲染进程 | 低 |
| `src/App.tsx` | 页面路由，Page 状态管理 | 中 |
| `src/components/ChatView.tsx` | 脚本工厂聊天界面，**MVP 核心** | 高 |
| `src/components/SettingsView.tsx` | API 配置页 | 中 |
| `src/index.css` | Tailwind 组件样式（sidebar-btn, chat-bubble 等） | 中 |
| `tailwind.config.js` | 全部颜色和字体定义 | 低 |

### 技术决策

1. **API 调用格式**：统一用 OpenAI-compatible 格式（`/v1/chat/completions`），Claude / DeepSeek / GPT / Qwen 都走这个。不要用各家 SDK，用 fetch 直接调。
2. **状态管理**：目前用 useState，复杂了再考虑 zustand 或 context。
3. **样式**：所有颜色从 tailwind.config.js 取，不要硬编码 hex 值。
4. **IPC 通信**：渲染进程 → preload → main，contextIsolation: true，不要直接用 nodeIntegration。

### 下一个要做的任务

**AI API 调用接入**（最高优先级）

目标：在 ChatView 中实现真实的 LLM 对话。需要：
- 从 SettingsView 读取用户配置的 provider / key / baseUrl / model
- 用 fetch 调用 OpenAI-compatible 接口
- 实现流式输出（SSE），打字机效果
- 错误处理（key 无效、网络超时、模型不支持 tool use 等）

实现位置：`src/components/ChatView.tsx` + 新增 `src/lib/api.ts`

### 不要动的

- `tailwind.config.js` 的颜色体系（复用 STITCH 原型）
- Electron 窗口配置（main.ts）
- preload 的 API 暴露方式

## 分支约定

- `main` — 稳定版本
- `dev` — 开发中
- 功能分支：`feat/xxx`

## 提交信息格式

```
type(scope): 简短描述

feat(chat): 接入 streaming API
fix(settings): 修复 provider 切换后 baseUrl 未更新
refactor(api): 抽取通用 fetch 函数
```

type: feat / fix / refactor / style / docs / chore
