<p align="center">
  <img src="assets/logo-color.svg" width="120" alt="知更 Knower" />
</p>

<h1 align="center">知更 Knower</h1>

<p align="center">
  面向个人视频创作者的本地 AI 桌面工作流客户端
</p>

<p align="center">
  <a href="https://knower-ai.page.dev">官网</a> ·
  <a href="#快速开始">快速开始</a> ·
  <a href="#功能特性">功能</a> ·
  <a href="https://github.com/tanzhijir-04/knower_dev/issues">反馈</a>
</p>

---

**知更**帮助视频创作者（B站 / 抖音 / 小红书 / YouTube）从选题到发布，一键生成多平台发布物料。用户自带 API Key，数据全部本地存储，不经过任何第三方服务器。

## 功能特性

- **创作台** — 粘贴视频脚本，AI 自动分析并生成 B 站、抖音、小红书、YouTube 的标题、标签、描述、封面文案
- **灵感库** — AI 基于历史数据和全网趋势推荐选题方向
- **数据分析** — 可视化账号数据表现，发现爆款规律
- **多平台爬虫** — 集成 MediaCrawler，支持 B 站、抖音、小红书、微博数据采集
- **本地 Embedding** — ONNX 本地语义搜索模型，离线可用，三层降级（本地模型 → 远程 API → BM25）
- **数据同步** — 支持 Git / WebDAV / 本地文件夹多端同步
- **创作者管理** — 多账号切换，按创作者维度管理数据和偏好
- **记忆系统** — 越用越懂你，自动提炼你的内容风格偏好

## 技术栈

| 层 | 技术 |
|---|------|
| 桌面框架 | Electron 33 |
| 前端 | React 18 + TypeScript 5.6 + Vite 6 |
| 样式 | Tailwind CSS 3.4，暗色 / 亮色主题 |
| AI 调用 | OpenAI-compatible API（Claude / GPT / DeepSeek / Qwen） |
| Agent | 自研主循环 + 状态机，零框架依赖 |
| 数据库 | SQLite（sql.js） |
| 爬虫 | MediaCrawler（Python，Playwright） |
| 语义搜索 | ONNX Runtime + HuggingFace 模型 / BM25 降级 |
| 动画 | GSAP |

## 快速开始

### 环境要求

- Node.js 18+
- Python 3.10+（爬虫功能需要）

### 安装

```bash
git clone https://github.com/tanzhijir-04/knower_dev.git
cd knower_dev
npm install
```

### 启动开发

```bash
npm run dev
```

### 构建

```bash
npm run build
```

产物输出到 `release/` 目录。

### 配置 API Key

启动后进入 **设置** 页面，配置你的 API Key 和模型。支持 Claude、OpenAI、DeepSeek、通义千问，以及任何 OpenAI 兼容接口。

## 项目结构

```
knower_dev/
├── electron/              # Electron 主进程
│   ├── main.ts            # 窗口创建、IPC handler
│   └── preload.ts         # contextBridge 暴露 electronAPI
├── src/                   # React 前端
│   ├── components/
│   │   ├── ChatView.tsx   # 创作台（核心页面）
│   │   ├── TopicsView.tsx # 灵感库
│   │   ├── SettingsView.tsx
│   │   ├── Sidebar.tsx
│   │   └── MaterialCards.tsx
│   ├── App.tsx            # 页面路由
│   └── index.css          # 全局样式 + CSS 变量
├── knower-agent/          # Agent Core（Node.js）
│   ├── agent/
│   │   ├── core.js        # 主循环（while + LLM）
│   │   ├── state.js       # 状态机
│   │   ├── router.js      # 条件路由
│   │   └── tools/         # 8 个工具
│   ├── llm/               # LLM 客户端封装
│   ├── rag/               # 语义搜索 + Embedding
│   ├── db/                # SQLite 数据库
│   └── crawler/           # MediaCrawler 爬虫
├── assets/                # Logo
└── docs/                  # 文档 + 架构图解
```

## 架构图解

详细的架构说明和交互演示，查看 [架构图解页面](docs/architecture.html)。

## 数据安全

- 所有数据存储在本地 SQLite 数据库
- API Key 仅存储在本地，不上传任何服务器
- 支持数据同步到你自己的 Git 仓库 / WebDAV / NAS

## 分支约定

- `main` — 稳定版本
- `dev` — 开发中
- `feat/xxx` — 功能分支

## 提交规范

```
type(scope): 描述

feat(chat): 接入 streaming API
fix(settings): 修复 provider 切换后 baseUrl 未更新
```

type: `feat` / `fix` / `refactor` / `style` / `docs` / `chore`

## License

[MIT](LICENSE)

## 联系

- GitHub: [tanzhijir-04](https://github.com/tanzhijir-04)
- 官网: [knower-ai.page.dev](https://knower-ai.page.dev)
