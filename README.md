# 知更 Knower

> 面向个人视频创作者的本地 AI 桌面工作流客户端

把脚本丢给知更，一键生成 B站 / YouTube / 抖音 / 小红书的发布物料——标题、标签、描述、封面文案、拍摄清单，全部本地运行，数据不经第三方。

## 核心特性

- **AI 脚本分析** — 自动识别视频类型、受众、核心卖点
- **多平台物料生成** — 一次输入，输出四大平台的发布内容，风格各自适配
- **拍摄清单** — 按景别拆解分镜，标注预估时长
- **创作者记忆** — 自动提炼你的风格偏好，越用越懂你
- **本地优先** — API key 自带，SQLite 本地存储，数据不上云
- **会话管理** — 对话历史持久化，随时回溯

## 技术栈

| 层 | 技术 |
|---|------|
| 桌面框架 | Electron 33 |
| 前端 | React 18 + TypeScript 5.6 |
| 构建 | Vite 6 + vite-plugin-electron |
| 样式 | Tailwind CSS 3.4（暗色主题） |
| AI | Anthropic SDK（tool use + streaming） |
| 存储 | sql.js（WASM SQLite） |

## 快速开始

### 环境要求

- Node.js >= 18
- npm >= 9

### 安装

```bash
git clone https://github.com/tanzhijir-04/knower_dev.git
cd knower_dev
npm install
```

### 开发

```bash
npm run dev
```

启动后在设置页配置你的 API Key、模型和 Base URL，即可开始使用。

### 构建

```bash
npm run build
```

产物输出到 `release/` 目录。

## 项目结构

```
knower_dev/
├── electron/              # Electron 主进程
│   ├── main.ts            # 窗口创建、IPC handler、Agent 调用
│   └── preload.ts         # contextBridge 暴露 electronAPI
├── src/                   # 渲染进程（React）
│   ├── App.tsx            # 页面路由
│   ├── components/
│   │   ├── ChatView.tsx   # 创作台（核心交互界面）
│   │   ├── MaterialCards.tsx  # 结构化物料展示
│   │   ├── Sidebar.tsx    # 侧边栏导航
│   │   └── SettingsView.tsx   # API 配置页
│   └── types/
│       └── electron.d.ts  # IPC 类型定义
├── knower-agent/          # Agent Core（Node.js）
│   ├── agent/
│   │   ├── core.js        # Agent 主循环（tool use + streaming）
│   │   └── tools/
│   │       ├── save_result.js   # 保存结果 + 记忆提炼
│   │       └── index.js
│   ├── db/
│   │   └── index.js       # SQLite 数据层（scripts/conversations/memories）
│   └── config/
│       └── index.js       # API 配置读取
├── assets/                # SVG logo 源文件
├── scripts/               # 构建脚本
├── tailwind.config.js     # 主题色与字体定义
└── vite.config.ts         # Vite + Electron 构建配置
```

## Agent 工作流

```
用户输入脚本
    ↓
Claude 分析脚本 → 输出 analysis JSON
    ↓
Claude 生成物料 → 输出 result JSON（B站/YouTube/抖音/小红书/拍摄清单）
    ↓
调用 save_result → 存入 SQLite
    ↓
异步提炼创作者记忆 → 风格偏好/内容规律/平台习惯
    ↓
输出自然语言总结给用户
```

下次对话时，已有的创作者记忆会自动注入 System Prompt，Agent 会据此调整生成策略。

## 配置说明

在应用设置页或 `%APPDATA%/knower/settings.json` 中配置：

| 字段 | 说明 | 示例 |
|------|------|------|
| `apiKey` | API 密钥 | `sk-ant-...` |
| `model` | 模型名称 | `claude-sonnet-4-20250514` |
| `baseUrl` | API 代理地址（可选） | `https://your-proxy.com/anthropic` |

## 分支约定

- `main` — 稳定版本
- `dev` — 开发中
- `feat/xxx` — 功能分支

## 提交规范

```
type(scope): 描述

feat(chat): 接入 streaming API
fix(settings): 修复 provider 切换后 baseUrl 未更新
refactor(api): 抽取通用 fetch 函数
```

type: `feat` / `fix` / `refactor` / `style` / `docs` / `chore`

## License

MIT
