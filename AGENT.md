# AGENT.md — AI Agent 协作指南

本文档帮助任何参与开发的 AI Agent 快速理解项目上下文和当前进度。

## 项目一句话

知更 Knower 是一个 Electron 桌面应用，帮视频创作者用 AI 生成多平台发布物料。用户自己的 API key，数据全在本地。

## 当前状态

**阶段：MVP 骨架已完成，爬虫模块已集成**

项目能跑起来（`npm run dev`），UI 已经搭好，AI 调用还是占位的。爬虫模块已集成（MediaCrawler），支持 B站/抖音/小红书/微博 四个平台的数据采集。

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
| `knower-agent/crawler/` | **爬虫模块**（MediaCrawler，Python 子进程） | 中 |
| `knower-agent/lib/crawler.js` | 爬虫 Node.js 封装 | 低 |
| `knower-agent/db/index.js` | 数据库层（含爬虫任务表） | 中 |

### 技术决策

1. **API 调用格式**：统一用 OpenAI-compatible 格式（`/v1/chat/completions`），Claude / DeepSeek / GPT / Qwen 都走这个。不要用各家 SDK，用 fetch 直接调。
2. **状态管理**：目前用 useState，复杂了再考虑 zustand 或 context。
3. **样式**：所有颜色从 tailwind.config.js 取，不要硬编码 hex 值。
4. **IPC 通信**：渲染进程 → preload → main，contextIsolation: true，不要直接用 nodeIntegration。

### 下一个要做的任务

**AI API 调用接入**（高优先级）

目标：在 ChatView 中实现真实的 LLM 对话。需要：
- 从 SettingsView 读取用户配置的 provider / key / baseUrl / model
- 用 fetch 调用支持 ANTHROPIC 协议的接口
- 实现流式输出（SSE），打字机效果
- 错误处理（key 无效、网络超时、模型不支持 tool use 等）

实现位置：`src/components/ChatView.tsx` + 新增 `src/lib/api.ts`

**数据展示页面**（中优先级）

目标：在 DataView 页面展示爬取的数据。需要：
- 调用 `window.electronAPI.listCrawlTasks()` 获取任务列表
- 调用 `window.electronAPI.getCrawlContent(taskId)` 获取详情
- 表格展示视频/笔记数据，支持排序和筛选

### 不要动的

- `tailwind.config.js` 的颜色体系（复用 STITCH 原型）
- Electron 窗口配置（main.ts）
- preload 的 API 暴露方式
- `knower-agent/crawler/mediasrc/` 内部文件（除非修复路径或兼容性问题）

## 爬虫模块

### 架构

```
Electron (main.ts)
  └─ IPC: crawler-run
       └─ crawler.js: spawn Python 子进程
            └─ run_crawler.py: CLI 入口
                 └─ mediasrc/: MediaCrawler 爬虫运行
                 └─ stdout: JSON 结果
       └─ 解析 JSON → 存入 knower.db → IPC 通知前端
```

### 关键文件

| 文件 | 职责 |
|------|------|
| `knower-agent/crawler/run_crawler.py` | Python CLI 入口，MemoryStore 收集数据，JSON 输出到 stdout |
| `knower-agent/lib/crawler.js` | Node.js 封装，spawn Python 子进程，解析 JSON |
| `knower-agent/db/index.js` | 扩展了 `crawl_tasks` 和 `crawl_content` 表 |
| `electron/main.ts` | IPC handler: `crawler-run`, `crawler-tasks`, `crawler-content` |
| `electron/preload.ts` | 暴露: `runCrawler`, `onCrawlerEvent`, `listCrawlTasks`, `getCrawlContent` |

### 调用方式

```javascript
// Node.js 直接调用
const { runCrawler } = require('./knower-agent/lib/crawler');
const result = await runCrawler('bili', '关键词', {
  maxNotes: 10,
  headless: true,
  getComment: false,
  crawlerType: 'search'  // search | detail | creator
});

// Electron 渲染进程
const result = await window.electronAPI.runCrawler('bili', '关键词', { maxNotes: 10 });
```

### 返回数据结构

```javascript
{
  platform: 'bili',
  keywords: '关键词',
  crawler_type: 'search',
  contents: [          // 视频/笔记列表
    {
      video_id: '123',
      title: '标题',
      desc: '描述',
      nickname: 'UP主',
      liked_count: '1000',
      video_play_count: '50000',
      // ... 更多字段
    }
  ],
  creators: [          // 创作者信息
    {
      user_id: '123',
      nickname: 'UP主',
      total_fans: 100000,
      // ...
    }
  ],
  comments: [],        // 评论（需开启 getComment）
  stats: {
    total_contents: 20,
    total_comments: 0,
    total_creators: 20
  }
}
```

### 平台参数

| 平台 | platform | 特殊参数 |
|------|----------|---------|
| B站 | `bili` | `specifiedId`, `creatorId` |
| 抖音 | `dy` | 需要 Node.js（JS 签名） |
| 小红书 | `xhs` | - |
| 微博 | `wb` | - |

### 注意事项

1. **首次运行需扫码登录**：登录状态保存在 `mediasrc/login_state/`
2. **CDP 模式**：默认关闭，除非有远程调试的 Chrome
3. **编码问题**：`run_crawler.py` 已设置 UTF-8 输出，Windows 下正常工作
4. **依赖安装**：运行 `setup_env.bat` 或手动 `pip install -r requirements.txt`
5. **不要修改 mediasrc/ 内部文件**：除非修复路径或兼容性问题

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
