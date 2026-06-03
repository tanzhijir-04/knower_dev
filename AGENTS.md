本文档帮助任何参与开发的 AI Agent 快速理解项目上下文和当前进度。

## 项目一句话

知更 Knower 是一个 Electron 桌面应用，帮视频创作者用 AI 生成多平台发布物料。用户自己的 API key，数据全在本地。

## 当前状态

**阶段：M1+M2 已完成，正在推进 REFACTOR-PRD 四阶段优化**

创作台、数据概览、灵感库、全网热点、设置页五个页面均已实现。Agent Core 具备完整的 ReAct 循环、状态机、8 个工具、双协议 LLM 适配、错误重试。多创作者隔离已完成。爬虫（MediaCrawler）和爆款评分模块已集成。

## 技术栈（严格限定）

仅使用以下技术，不要引入列表之外的框架：

| 层 | 技术 |
|---|---|
| 前端 | React 18 + TypeScript 5.6 + Tailwind CSS 3.4 |
| 图标 | @phosphor-icons/react |
| 图表 | echarts-for-react |
| 动画 | gsap |
| Markdown | react-markdown |
| Electron | Electron 33 |
| 构建 | Vite 6 + vite-plugin-electron |
| AI | @anthropic-ai/sdk（Anthropic）+ 原生 fetch（OpenAI-compat） |
| 数据库 | sql.js（SQLite WASM） |
| 爬虫 | MediaCrawler（Python 子进程） |

禁止：react-router、zustand/redux、LangChain、Prisma、axios、前端直接 import Node 模块。

## 文件职责速查

| 文件 | 干什么的 | 改动频率 |
|------|----------|----------|
| `electron/main.ts` | 主进程，所有 IPC handler | 中 |
| `electron/preload.ts` | 暴露 electronAPI | 低 |
| `src/App.tsx` | 页面路由（useState）、gsap 动画、Toast | 中 |
| `src/types/electron.d.ts` | 前端类型定义 + ElectronAPI 接口 | 中 |
| `src/components/ChatView.tsx` | 创作台（核心页面） | 高 |
| `src/components/DataView.tsx` | 数据概览 | 中 |
| `src/components/TrendingView.tsx` | 全网热点 | 低 |
| `src/components/TopicsView.tsx` | 灵感库 | 中 |
| `src/components/SettingsView.tsx` | 设置页 | 低 |
| `src/components/Sidebar.tsx` | 侧边栏导航 | 低 |
| `src/components/AccountSwitcher.tsx` | 创作者切换器 | 低 |
| `src/components/MaterialCards.tsx` | 物料卡片展示 | 中 |
| `src/components/data/*.tsx` | 数据图表（6 个组件） | 低 |
| `src/components/topics/*.tsx` | 灵感库子组件（7 个） | 中 |
| `src/contexts/*.tsx` | React Context（3 个） | 低 |
| `knower-agent/agent/core.js` | Agent ReAct 主循环 | 中 |
| `knower-agent/agent/state.js` | 状态机 | 低 |
| `knower-agent/agent/router.js` | 动作路由 | 低 |
| `knower-agent/agent/processor.js` | 工具结果处理 | 中 |
| `knower-agent/agent/tools/*.js` | 8 个工具 | 中 |
| `knower-agent/llm/*.js` | LLM 适配层 | 低 |
| `knower-agent/db/index.js` | 数据库层（14 张表 + CRUD） | 高 |
| `knower-agent/config/index.js` | 配置读取 | 低 |
| `knower-agent/prompts/system-prompt.js` | Agent 系统提示词 | 中 |
| `knower-agent/lib/crawler.js` | 爬虫封装 | 低 |
| `knower-agent/lib/trending.js` | 热点数据 | 低 |
| `knower-agent/virality-score/` | 爆款评分 | 低 |

## 架构要点

### Agent 核心

用户输入
→ core.js stream() 主循环
→ buildSystemPrompt()（注入 memories 记忆 + 创作者身份）
→ LLM 调用（Anthropic SDK 或 OpenAI-compat fetch）
→ router.js 判断下一步动作
→ tools/*.js 执行工具（带 executeToolWithRetry + executeWithTimeout）
→ processor.js 更新 AgentState
→ 循环直到 done 或达到 MAX_ITERATIONS=10
→ 流式返回事件（text / tool_call / tool_result / form_request / done）


### 状态机（state.js）

idle → crawling / analyzing / querying / suggesting → generating → saving → done

每个阶段有合法的目标转换，非法转换会抛错。

### 数据库（db/index.js）

14 张表，全部支持 account_id 多创作者隔离。sql.js WASM 实现，无原生依赖。

### IPC 通信

渲染进程 → preload（contextBridge）→ main.ts IPC handler → Agent/DB/爬虫 → 事件流返回。

## 工具检查流程

收到用户消息后，检查当前状态上下文：
1. 如果上下文中有爬取数据 → 直接分析，不要重新爬取
2. 如果上下文中有分析结果 → 直接生成物料，不要重新分析
3. 如果上下文中有物料 → 直接保存，不要重新生成
4. 如果缺少必要信息 → 调用 request_user_input 请求

## 红旗表

- "用户没给UID，我猜一个" → 不要猜，调用 request_user_input
- "我知道这个UP主的数据" → 你不知道，看上下文中有没有爬取数据
- "脚本我理解了，直接生成物料" → 先调用 analyze_script
- "数据是空的，我编一些" → 绝对禁止编造数据
- "这次不保存了吧" → 必须保存，除非用户明确说不要

## 开发阶段

### 已完成
- 项目骨架 + 暗色主题 UI + 侧边栏 + gsap 动画
- Agent Core：状态机 + 路由器 + 8 个工具 + 流式输出 + 错误重试 + 超时控制
- LLM 双协议适配（Anthropic + OpenAI-compat）
- 创作台：流式输出、对话历史、物料卡片、文件导入
- 数据概览：来源管理、AI 分析（含缓存）、AI 分类、6 种图表、导出、创作者管理
- 全网热点：多平台聚合
- 灵感库：选题生成、趋势面板、竞品追踪、雷达评分
- 设置页：API 配置、连接测试、创作者管理
- 多创作者隔离（account_id 全表覆盖）
- 爬虫（MediaCrawler）+ 爆款评分
- 记忆系统（自进化闭环）

### 下一步（按优先级）
1. **RAG 语义检索** — vectra 向量存储 + embedding API + search_similar 工具
2. **可观测性面板** — Agent 执行追踪时间线 + 实时状态指示器
3. **断点续跑** — 崩溃后从检查点恢复

### 参考文档
- `docs/knower_prd_v2.md` — 产品 PRD
- `docs/REFACTOR-PRD.md` — Agent 增量重构 PRD（四阶段）
- `PLAN.md` — 重构实施计划
- `docs/task_board.md` — 全局任务清单（部分内容已过时）
- `docs/improvement_plan.md` — 全量改进计划 P0-P8

## 不要动的

- `tailwind.config.js` 的颜色体系
- Electron 窗口配置（main.ts）
- preload 的 API 暴露方式
- `knower-agent/crawler/mediasrc/` 内部文件

## 分支约定

- `main` — 稳定版本
- `dev` — 开发中
- 功能分支：`feat/xxx`

## 提交信息格式

type(scope): 简短描述

feat(chat): 接入 streaming API
fix(settings): 修复 provider 切换后 baseUrl 未更新
refactor(api): 抽取通用 fetch 函数


type: feat / fix / refactor / style / docs / chore