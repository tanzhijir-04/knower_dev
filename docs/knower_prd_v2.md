# 知更 Knower · 产品需求文档

**版本** PRD v2.1  
**作者** Jensen  
**状态** 开发中（截至 2025.05）  
**更新** 根据 M1 实际开发进度修订

---

## 1. 背景与目标

国内中小型视频创作者普遍同时运营 B站、抖音、小红书等多个平台，每条内容从选题到发布需要重复大量机械性工作：手动查看各平台后台数据、分析爆款规律、针对不同平台改写标题和简介、拆解脚本成拍摄清单。

现有工具的结构性缺陷：

- **平台系工具**（剪映/必剪）只服务自己的平台，天然无法做跨平台数据聚合
- **数据工具**（飞瓜/蝉妈妈）面向品牌方和 MCN，价格高、操作重，不做个人创作者
- **通用 AI 工具**不知道创作者自己的历史数据，给不出个性化建议

**知更的目标**：做一个越用越懂这个创作者的本地客户端。数据沉淀在本地，AI 基于创作者自己的历史规律 + 平台实时趋势给出建议，而不是通用废话。

---

## 2. 核心价值主张

> **越用越懂你这个创作者。不是通用 AI 工具，是你自己的创作记忆。**

知更鸟比你先感知到天亮。知更比你先看到下一条该做什么。

**结构性护城河**：没有任何平台系工具会做跨平台数据聚合，因为平台之间本身是竞争关系。知更的天花板是所有平台的总和。

---

## 3. 目标用户

### 核心用户

- 个人创作者
- 同时运营 2 个以上平台
- 1～3 人小团队
- 有稳定更新频率（至少月更）
- 有明确的内容定位

### 排除用户

- MCN 签约达人（有专属团队）
- 纯娱乐主播（无内容工作流意识）
- 刚起步新人（痛点尚未积累）
- 品牌方官方账号

### 典型用户画像

B站科技 UP 主，1万粉，同时运营抖音和小红书，一个人拍剪，每周更一条。最大痛点：每次发视频都要手动改三套标题简介，加上不知道下条做什么选题最稳。

---

## 4. 功能模块

### 模块一：创作台 `MVP · 第一期 · ✅ 已完成`

输入一份脚本，一键输出所有平台所需的创作物料。**零历史数据也能使用，第一天就有价值**。解决冷启动问题的核心入口。

**当前实现方式**：

Agent 通过系统提示词引导模型自主完成分析和物料生成，模型在文本中输出结构化 JSON（analysis + result），然后调用 `save_result` 工具写入本地数据库并异步提炼记忆。前端通过 `MaterialCards` 组件解析 JSON 并以 Tab 页形式展示各平台物料。

```
用户输入脚本
→ Agent（Anthropic Claude）自主规划
→ 模型直接输出 analysis JSON（脚本分析）
→ 模型直接输出 result JSON（各平台物料）
→ 模型调用 save_result 工具（存入 SQLite + 异步提炼记忆）
→ 流式输出自然语言总结
→ 前端 MaterialCards 解析 JSON 并结构化展示
```

**输出物料清单**：

- 拍摄 checklist（分镜 / 景别 / 道具 / 场地）
- B站标题 + 简介 + 标签
- YouTube 标题 + 描述 + 标签
- 抖音开头钩子文案（前 3 秒）+ 标题 + 标签
- 小红书封面标题 + 正文 + 标签

**各平台写作规范**：

| 平台 | 标题字数 | 核心策略 |
|---|---|---|
| B站 | ≤80字 | 专业感+信息量，极客调性 |
| YouTube | ≤60字符 | SEO 友好，前置核心关键词，国际化 |
| 抖音 | ≤55字 | 前3秒钩子制造悬念或冲突 |
| 小红书 | ≤20字 | 带emoji，像朋友聊天的种草感 |

**交互特性**：

- SSE 流式输出（通过 Electron IPC 事件流）
- 工具调用状态提示（"正在分析..."、"保存到数据库..."）
- 停止生成按钮
- 对话历史 CRUD（创建/加载/删除对话）
- 单条消息复制、导出为 txt、删除
- 结构化物料卡片（tab 切换各平台，一键复制）

**待优化项**：

- 将 analysis/result 从 prompt 文本输出改为独立工具调用（提高 JSON 结构稳定性）
- 支持脚本文件导入（.txt / .md / .docx）

---

### 模块二：数据概览 `第一期 · ✅ 已完成`

通过 MediaCrawler（Python）爬取各平台公开数据，存入本地 SQLite，提供 AI 驱动的数据分析。**不存储任何账号信息、密码或 Cookie**。

**当前实现方式**（与 PRD v2.0 的 CDP 方案不同）：

PRD v2.0 设想通过 Chrome CDP 拦截创作者后台接口，但实际开发中发现 MediaCrawler 已能覆盖公开数据采集需求，且不需要用户本地 Chrome 环境，遂采用 MediaCrawler 作为数据采集方案。

```
用户输入关键词 / 用户 UID
→ Electron 主进程调用 runCrawler()
→ Node.js 子进程调用 Python MediaCrawler
→ 爬取结果存入 SQLite（crawl_tasks + crawl_content + crawl_creators）
→ 前端 DataView 展示数据面板
```

**支持平台**：

| 平台 | platform 值 | 搜索 | 创作者主页 |
|------|------------|------|-----------|
| B站 | `bili` | ✅ | ✅（支持 creatorId） |
| 抖音 | `dy` | ✅ | 需要 Node.js JS 签名 |
| 小红书 | `xhs` | ✅ | ✅ |
| 微博 | `wb` | ✅ | - |

**DataView 功能清单**：

- 来源管理：按创作者 / 关键词分组，支持收藏、置顶、搜索
- AI 视频分析：基于爬取数据，LLM 分析选题方向、标题特征、最佳时长、发布时间
- AI 一键分类：自动将视频归类到内容类别（科技数码、游戏娱乐、生活日常等）
- 互动率排行：本地计算点赞/投币/收藏/评论/弹幕综合互动率
- 概览卡片：视频总数、总播放量、总点赞数、平均播放量
- 创作者管理：头像、收藏、置顶、删除、数据导出（JSON）
- 爬取进度实时日志展示

---

### 模块三：灵感库 `第二期 · ⏳ 待开发`

结合两个数据源给出个性化选题建议：

- **内部数据**：用户自己账号的历史表现数据（来自数据概览模块）
- **外部数据**：平台实时趋势数据（来自 MediaCrawler 爬取）

两个数据源缺一不可，这是自进化机制的核心燃料。

**当前进展**：

- `TopicsView` 页面已创建，目前是占位页（"即将推出"）
- DataView 中的 AI 分析已具备初步的选题建议能力（基于爬取数据的 `suggestions`）
- 但缺少：内外部数据融合、竞品追踪、自进化反馈闭环

**MediaCrawler 集成**：

MediaCrawler 已直接集成到 `knower-agent/crawler/`，通过 Python venv 运行。支持 B站、抖音、小红书、微博四个平台的公开数据爬取（热榜、热门内容、竞品账号数据）。

初始化方式：

```bash
cd knower-agent/crawler
setup_env.bat  # 创建 venv + 安装依赖 + 安装 Playwright
```

**分析维度**：

- 哪类选题在你的账号上完播率最高
- 当前平台什么内容在爆（外部趋势）
- 同赛道竞品在做什么内容
- 什么时间发布涨粉效率最好

**冷启动策略**：数据不足时，先用同类创作者的行业基准数据填充，随着自身数据积累逐渐替代行业基准。

---

### 模块四：设置 `✅ 已完成`

API 配置 + 本地持久化。

**已实现的配置项**：

| 配置项 | 说明 | 必填 |
|---|---|---|
| API Provider | 选择服务商（Claude / DeepSeek / OpenAI / Qwen / 自定义） | 是 |
| API Key | 用户自己的 key，通过 Electron localStorage 存储 | 是 |
| Base URL | 默认官方地址，支持自定义 | 否 |
| Model | 手动填写模型名 | 是 |

配置通过 Electron IPC (`get-store` / `set-store`) 持久化到 `{userData}/settings.json`。

---

## 5. Agent 架构

### 5.1 当前实现

基于 Anthropic SDK 的 ReAct 模式 Agent，流式输出。当前架构以**提示词驱动**为主，模型在文本中直接输出结构化 JSON，仅通过一个工具（`save_result`）完成数据持久化。

```
用户输入脚本
→ buildSystemPrompt()（注入 memories 记忆）
→ Agent.stream() 循环
  → Claude 自主生成文本（包含 analysis JSON + result JSON）
  → Claude 调用 save_result 工具
  → save_result 执行：存入 SQLite + 异步提炼记忆
  → Claude 输出自然语言总结
→ 流式返回事件（text / tool_call / tool_result / done）
```

**事件类型**：

| 事件 | 说明 |
|---|---|
| `text` | 文本流式输出 |
| `tool_call` | 工具调用开始（name + input） |
| `tool_result` | 工具调用结果 |
| `done` | 流式结束 |
| `error` | 错误信息 |

### 5.2 工具集

| 工具函数 | 状态 | 职责 |
|---|---|---|
| `save_result()` | ✅ 已实现 | 存入原始数据 + 异步提炼风格特征写入 memories 表 |
| `analyze_script()` | ❌ 未实现 | 分析脚本结构（当前由模型在文本中直接输出） |
| `expand_script()` | ❌ 未实现 | 基于分析结果生成物料（当前由模型在文本中直接输出） |
| `fetch_platform_data()` | ❌ 未实现 | 触发浏览器采集后台数据 |
| `fetch_trend_data()` | ❌ 未实现 | 调用 MediaCrawler 爬取趋势数据 |
| `suggest_topics()` | ❌ 未实现 | 结合内外部数据生成选题建议 |
| `record_feedback()` | ❌ 未实现 | 记录用户采纳结果，反哺知识库权重 |

**待改进**：当前分析和物料生成依赖模型在文本中输出 JSON，前端通过正则解析。这种方式对 JSON 格式的稳定性要求较高，后续应拆分为独立工具以提高可靠性。

### 5.3 自进化机制（已部分实现）

**已实现的闭环**：

```
每次生成完物料
→ save_result 调用 extractAndSaveMemories()（异步）
→ LLM 提炼 5 条以内的风格偏好（style_preference / content_pattern / platform_habit）
→ upsertMemory() 写入 memories 表（weight 递增，上限 1.0）
→ 下次对话 buildSystemPrompt() 读取 memories 注入 System Prompt
```

**待实现**：

- `record_feedback`：用户发布视频后数据回来，关联选题和实际表现，更新 weight
- 表现数据层（需要数据概览模块的数据回流）

---

## 6. 知识库结构

知识库分三层：

### 第一层：原始数据
每次生成的完整记录，原样存储，是所有分析的数据源。

```
scripts 表：
- id, content（原始脚本）, analysis（JSON）, result（JSON）, created_at

conversations 表：
- id, title, created_at, updated_at

messages 表：
- id, conversation_id, role, content, created_at
```

### 第二层：提炼后的偏好记忆

从原始数据里提炼的规律，AI 真正"记住"的东西。存储在 `memories` 表：

```sql
CREATE TABLE memories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id TEXT NOT NULL DEFAULT 'default',
  type TEXT NOT NULL,  -- style_preference / content_pattern / platform_habit
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  evidence TEXT,
  weight REAL NOT NULL DEFAULT 0.5,  -- 出现越频繁越高，上限 1.0
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)
```

### 第三层：表现数据
爬取的竞品/趋势数据，存储在 `crawl_tasks`、`crawl_content`、`crawl_creators`、`creators` 表。用于数据分析和选题建议。

### 记忆注入格式

每次对话开始时，读取 memories 表按 weight 降序，拼入 System Prompt 末尾：

```
## 关于这位创作者的已知偏好

### 风格偏好
- B站标题偏短（30字以内），倾向口语化（依据：用户上次将标题从58字改为31字）

### 内容规律
- 科技测评类内容占主要比例（依据：近5次生成均为数码评测类型）

### 平台习惯
- 抖音钩子偏好用疑问句（依据：expand_script 生成结果用户未修改钩子部分）
```

---

## 7. 技术架构

### 整体结构

```
Electron 壳
├── React UI（渲染进程）
│   ├── ChatView（创作台）     ← 核心 MVP
│   ├── DataView（数据概览）   ← MediaCrawler 数据展示 + AI 分析
│   ├── TopicsView（灵感库）   ← 占位页，待开发
│   └── SettingsView（设置）   ← API 配置
├── Electron 主进程（main.ts）
│   ├── IPC Handlers（agent-run / crawler-run / conv-* / analyze-*）
│   ├── Settings 持久化（settings.json）
│   └── 进程管理（Agent 子进程 / 爬虫子进程）
├── Agent Core（knower-agent/）
│   ├── agent/core.js          ← ReAct 主循环（Anthropic SDK 流式）
│   ├── agent/tools/save_result.js  ← 唯一工具
│   ├── db/index.js            ← SQLite（sql.js WASM）
│   ├── config/index.js        ← 配置读取
│   ├── run.js                 ← stdin/stdout JSON 流（供 Electron spawn）
│   └── lib/crawler.js         ← MediaCrawler Node.js 封装
├── MediaCrawler（knower-agent/crawler/）
│   ├── run_crawler.py         ← Python 爬虫脚本
│   ├── .venv/                 ← Python 虚拟环境（已集成）
│   └── setup_env.bat          ← 初始化脚本
└── SQLite（本地数据持久化）
    ├── scripts（原始脚本记录）
    ├── conversations + messages（对话历史）
    ├── memories（知识库记忆）
    ├── crawl_tasks（爬取任务）
    ├── crawl_content（爬取内容）
    ├── crawl_creators（爬取创作者信息）
    └── creators（创作者管理：收藏/置顶）
```

### 技术选型

| 层 | 技术 | 说明 |
|---|---|---|
| 客户端壳 | Electron 33 | 跨平台，打包 .exe / .dmg |
| 前端 UI | React 18 + TypeScript 5.6 | 四个核心页面，strict mode |
| 构建工具 | Vite 6 + vite-plugin-electron | 主进程/preload 分别构建 |
| 样式 | Tailwind CSS 3.4 | 暗色主题，STITCH 配色 |
| AI 框架 | Anthropic SDK（@anthropic-ai/sdk）| ReAct 模式，流式输出 |
| 本地存储 | sql.js（WASM SQLite）| 无需编译原生模块 |
| 趋势爬取 | MediaCrawler（Python）| 已集成到 knower-agent/crawler/ |
| 模型接入 | Anthropic API | 用户自配 API Key + Base URL |
| 进程通信 | Electron IPC + contextBridge | contextIsolation: true |

### 页面路由

`App.tsx` 用 `useState<Page>` 手动切换（非 react-router），四个页面：chat / data / topics / settings。

### IPC 通信模式

渲染进程通过 `window.electronAPI`（preload contextBridge 暴露）调用主进程。Agent 流式输出通过 `ipcRenderer.on('agent-event')` 事件监听。爬虫进度通过 `ipcRenderer.on('crawler-event')` 事件监听。

### 多模型适配

⚠️ **当前状态**：Agent 核心 (`agent/core.js`) 硬编码使用 Anthropic SDK，仅支持 Anthropic 协议的 API。设置页虽支持配置不同 Provider，但 Agent 实际只使用 `@anthropic-ai/sdk` 调用。

**待实现**：支持 OpenAI-compatible API 协议（`/v1/chat/completions`），需改造 Agent 核心为协议适配层。

---

## 8. 用户配置（设置页）

| 配置项 | 说明 | 必填 |
|---|---|---|
| API Provider | Claude / DeepSeek / OpenAI / Qwen / 自定义 | 是 |
| API Key | 用户自己的 key，本地存储 | 是 |
| Base URL | 默认官方地址，支持自定义 | 否 |
| Model | 手动填写模型名 | 是 |

配置通过 Electron IPC 持久化到 `{userData}/settings.json`，Agent 启动时读取。

---

## 9. 非功能需求

| 维度 | 要求 |
|---|---|
| 隐私安全 | 不存储账号信息、密码、Cookie；数据全部在用户本地；代码开源可审计 |
| 性能 | 创作台首次输出 ≤ 15s；数据采集单次 ≤ 30s；SQLite 查询 ≤ 200ms |
| 兼容性 | macOS 12+、Windows 10+；数据爬取依赖 Python venv（含 Playwright） |
| 可维护性 | 开源；每个平台采集逻辑对应独立模块文件，互不耦合 |
| 合规 | 用户在自己登录态下获取自己的数据；产品说明附免责声明 |

---

## 10. 分发策略

### 主安装包
- 体积目标：200MB 以内
- 分发平台：Gitee Releases（国内主渠道）+ GitHub Releases（开源展示）
- 格式：Windows .exe 安装程序 / macOS .dmg

### MediaCrawler 组件
- 已集成到项目中（`knower-agent/crawler/.venv/`）
- 用户首次使用前运行 `setup_env.bat` 初始化 Python 环境
- 后续考虑打包为预编译可执行文件以降低用户初始化门槛

### 构建自动化
GitHub Actions 同时推送到 GitHub Releases 和 Gitee Releases，一次配置永久自动化。

---

## 11. 商业化策略

### 阶段一：开源免费（前 3 个月）
完整功能开源，配合正切Jensen 频道记录开发过程，积累用户和口碑。

### 阶段二：买断制付费版
- 定价：¥99～199 买断，无订阅
- 开源版：保留创作台基础功能
- 付费版：解锁数据概览、灵感库、多账号管理、知识库记忆

**选择买断制的理由**：核心 AI 能力依赖用户自己的 API key，无边际成本。买断符合频道反消费主义调性。

---

## 12. 风险与应对

| 风险 | 应对策略 |
|---|---|
| 平台反爬策略升级 | MediaCrawler 社区持续维护；公开数据爬取风险低；灵感库可降级为纯历史数据模式 |
| Anthropic API 稳定性 | 用户自配 key，可切换其他兼容 API；后续增加 OpenAI 协议支持 |
| 冷启动体验差 | 创作台不依赖历史数据，第一天即有价值 |
| 付费意愿未验证 | 先免费开源验证需求，有用户基础后再推付费版 |
| 个人维护精力有限 | 开源社区分摊；模块化架构，各平台模块独立 |
| Agent JSON 输出不稳定 | 后续将分析/物料生成拆分为独立工具，提高可靠性 |
| 法律合规 | 用户访问自己的数据，本质合规；附免责声明 |

---

## 13. 开发里程碑

### M1：创作台上线 ✅ 主要完成

- [x] Electron + React + TypeScript + Vite 骨架
- [x] 暗色主题 UI，侧边栏导航
- [x] Agent ReAct 主循环跑通（Anthropic SDK 流式输出）
- [x] save_result 工具 + memories 知识库记忆模块
- [x] ChatView 创作台界面（流式输出、对话历史、物料卡片展示）
- [x] SettingsView 设置页（API 配置持久化）
- [x] 多平台物料输出（B站 / YouTube / 抖音 / 小红书）
- [x] SQLite 本地存储（sql.js）
- [x] GitHub + Gitee 开源

**M1 遗留项**：

- [ ] Agent 核心支持 OpenAI-compatible 协议（当前仅支持 Anthropic）
- [ ] 将 analyze_script / expand_script 拆为独立 tool
- [ ] 脚本文件导入

### M2：数据概览上线 ✅ 主要完成

- [x] MediaCrawler 集成（B站 / 抖音 / 小红书 / 微博）
- [x] DataView 数据面板（来源管理、视频列表、分类筛选）
- [x] AI 视频分析（选题方向、标题特征、发布策略）
- [x] AI 一键分类
- [x] 互动率排行
- [x] 创作者管理（收藏 / 置顶 / 导出）
- [x] 爬取进度实时日志
- [x] 多账号隔离支持（按 source_uid 分组）

**M2 遗留项**：

- [ ] CDP 方案作为补充（直接采集创作者后台数据，无需手动爬取）
- [ ] 跨平台数据聚合对比分析

### M3：灵感库上线 ⏳ 待开发

- [ ] TopicsView 灵感库页面开发
- [ ] 内外部数据融合分析（历史表现 + 平台趋势）
- [ ] 个性化选题建议 Agent
- [ ] 自进化反馈机制（record_feedback）
- [ ] 表现数据回流（发布后数据 → 更新 memories weight）
- [ ] 竞品追踪（定期爬取竞品账号更新）
- [ ] 付费版 License 体系

---

## 附录 A：技术实现方案

> 以下为各待开发模块的具体技术实现方案，基于当前技术栈（Electron 33 + React 18 + Anthropic SDK + sql.js + MediaCrawler）设计。

---

### A.1 Agent 多模型适配

**目标**：Agent 核心支持 Anthropic 和 OpenAI-compatible 两种 API 协议，用户可自由切换。

**方案：LLM Adapter 模式**

在 `knower-agent/` 下新增 `llm/` 目录，抽象统一接口：

```
knower-agent/llm/
├── index.js            ← createClient(config) 工厂函数
├── anthropic.js        ← Anthropic SDK 适配器
└── openai-compat.js    ← OpenAI-compatible fetch 适配器
```

统一接口定义：

```js
// 每个适配器实现相同的方法签名
{
  // 非流式（用于 save_result 记忆提炼、数据分析等不需要流式的场景）
  async chat({ system, messages, tools, maxTokens }) → { content, stopReason }

  // 流式（用于创作台主对话）
  async *stream({ system, messages, tools, maxTokens, signal })
    → AsyncGenerator<{ type: 'text'|'tool_use'|'tool_result'|'done', ... }>
}
```

**Anthropic 适配器**（`anthropic.js`）：

- 直接封装现有 `@anthropic-ai/sdk` 调用逻辑
- 将 `agent/core.js` 中的 `this.client.messages.create()` 和 `this.client.messages.stream()` 迁移至此
- 工具定义格式：`{ name, description, input_schema }`

**OpenAI-compatible 适配器**（`openai-compat.js`）：

- 使用 raw `fetch` + SSE 解析，不引入额外 SDK（保持依赖精简）
- 端点：`{baseUrl}/v1/chat/completions`
- 系统提示词作为 `system` 角色消息拼入 messages 数组（OpenAI 格式）
- 工具定义格式转换：`input_schema` → `parameters`，顶层包装为 `{ type: 'function', function: { name, description, parameters } }`
- 流式 SSE 解析：逐行读取 `data: {...}` 行，解析 `choices[0].delta`
- Tool call 重组：OpenAI 流式中 tool_calls 是分片到达的（`index` + `function.arguments` 片段），需要按 index 拼接完整 JSON 后再执行
- 统一输出为与 Anthropic 相同的事件格式

**工厂函数**（`index.js`）：

```js
function createClient(config) {
  switch (config.provider) {
    case 'anthropic':
    case 'claude':
      return new AnthropicClient(config)
    case 'openai':
    case 'deepseek':
    case 'qwen':
    default:
      return new OpenAICompatClient(config)  // 其他 provider 走 OpenAI 兼容协议
  }
}
```

**需要改动的文件**：

| 文件 | 改动 |
|---|---|
| `knower-agent/llm/anthropic.js` | 从 `agent/core.js` 抽取 Anthropic 调用逻辑 |
| `knower-agent/llm/openai-compat.js` | 新建，实现 OpenAI-compatible fetch + SSE |
| `knower-agent/llm/index.js` | 工厂函数 |
| `knower-agent/agent/core.js` | 将 `this.client` 替换为 LLM adapter 接口 |
| `knower-agent/agent/tools/save_result.js` | 记忆提炼也改用 LLM adapter |
| `electron/main.ts` | `analyze-video-data` 和 `auto-categorize` 改用 LLM adapter |

**不需要改动**：`config/index.js` 已支持读取 provider/baseUrl/apiKey/model。

---

### A.2 Agent 工具拆分（analyze_script + expand_script）

**目标**：将当前 prompt 文本输出 JSON 的方式改为独立工具调用，提高输出结构稳定性。

**新工具定义**：

```js
// analyze_script.js
{
  name: 'analyze_script',
  description: '分析脚本结构，输出视频类型、主题、受众、时长、卖点',
  input_schema: {
    type: 'object',
    properties: {
      script: { type: 'string', description: '原始脚本文本' }
    },
    required: ['script']
  },
  // execute 内部直接返回结构化对象（不调用 LLM，纯本地解析）
  // 或者：让 LLM 在 tool call 中返回分析结果
}
```

**架构决策**：`analyze_script` 和 `expand_script` 的 execute 应该返回空结果（让模型在下一轮 tool_result 后继续推理），还是在 execute 中调用 LLM 生成？

**推荐方案**：这两个工具的 execute 返回空占位结果 `{ placeholder: true }`，模型在调用工具时已经通过 input 参数传递了分析/物料的 JSON。工具的作用是**确认并规范化输出格式**，而非生成内容。具体流程：

```
1. Claude 调用 analyze_script({ script: "..." })
   → execute 返回 { status: 'received' }
   → Claude 在下一轮回复中输出 analysis JSON

2. Claude 调用 expand_script({ script, analysis, platforms })
   → execute 返回 { status: 'received' }
   → Claude 在下一轮回复中输出 result JSON

3. Claude 调用 save_result({ script, analysis, result })
   → execute 存入数据库 + 异步提炼记忆
```

**另一种更可靠的方案**：analyze_script 和 expand_script 的 execute 内部直接调用 LLM 生成结果，确保输出格式由代码控制：

```
1. Claude 调用 analyze_script({ script })
   → execute 内部调用 LLM（专用 prompt，强制 JSON schema）
   → 返回 { videoType, topic, audience, duration, keyPoints }

2. Claude 调用 expand_script({ script, analysis, platforms })
   → execute 内部调用 LLM（专用 prompt，强制 JSON schema）
   → 返回 { bilibili, youtube, douyin, xiaohongshu, shootingChecklist }

3. Claude 调用 save_result({ script, analysis, result })
   → execute 存入数据库
```

这种方案下 Agent 主循环只负责编排调用顺序，实际内容生成由各工具内部的 LLM 调用完成。**缺点**是每次创作消耗 3 次 LLM API 调用（analyze + expand + save），成本和延迟增加。**优点**是每个工具的输出格式完全可控。

**推荐折中方案**：保留当前 prompt 驱动方式（1 次 API 调用），但将 JSON 输出从文本改为 tool call。即 Claude 在一次 response 中连续调用 `analyze_script` 和 `expand_script`，将 JSON 作为工具参数传递。这样既保持 1 次 API 调用，又保证了 JSON 格式的结构化。

实现步骤：

1. 新建 `agent/tools/analyze_script.js` — execute 直接返回 `{ success: true }`，模型通过 input 传递分析结果
2. 新建 `agent/tools/expand_script.js` — 同上
3. 修改 Agent system prompt：不再要求文本输出 JSON，改为指示模型调用这两个工具
4. 修改 `agent/tools/index.js` 注册新工具
5. 修改 `ChatView.tsx` 和 `MaterialCards.tsx`：从 tool_call 事件中提取数据，不再从文本正则解析

**改动文件**：

| 文件 | 改动 |
|---|---|
| `knower-agent/agent/tools/analyze_script.js` | 新建 |
| `knower-agent/agent/tools/expand_script.js` | 新建 |
| `knower-agent/agent/tools/index.js` | 注册新工具 |
| `knower-agent/agent/core.js` | 更新 system prompt |
| `src/components/MaterialCards.tsx` | 数据源从文本解析改为 tool_call 事件 |
| `src/components/ChatView.tsx` | 处理 tool_call 事件中的分析/物料数据 |

---

### A.3 灵感库（TopicsView）

**目标**：基于内外部数据融合，生成个性化选题建议。

**页面布局**：

```
┌─────────────────────────────────────────────────┐
│ 顶部操作栏：[平台选择] [一键获取趋势] [AI 生成选题]  │
├──────────┬──────────────────────────────────────┤
│ 左侧边栏  │  主内容区                              │
│          │                                      │
│ 趋势来源  │  ┌─────────────┐ ┌─────────────┐     │
│ - 热榜    │  │ 选题卡片 1   │ │ 选题卡片 2   │     │
│ - 竞品    │  │ 标题 + 推荐  │ │ 标题 + 推荐  │     │
│ - 行业    │  │ 理由 + 数据  │ │ 理由 + 数据  │     │
│          │  └──────┬──────┘ └──────┬──────┘     │
│ 我的数据  │         │              │             │
│ - 热门内容│  ┌──────┴──────────────┴──────┐     │
│ - 高互动  │  │ 选题详情面板                  │     │
│ - 分类    │  │ 详细分析 + 预估表现 +         │     │
│          │  │ [发到创作台] [收藏选题]        │     │
│ 收藏选题  │  └─────────────────────────────┘     │
│ - 已保存  │                                      │
└──────────┴──────────────────────────────────────┘
```

**技术实现**：

**1) 新增 Agent 工具 `suggest_topics`**

```js
// knower-agent/agent/tools/suggest_topics.js
module.exports = {
  name: 'suggest_topics',
  description: '结合用户历史数据和平台趋势，生成个性化选题建议',
  input_schema: {
    type: 'object',
    properties: {
      platform: { type: 'string', description: '目标平台（bili/dy/xhs）' },
      count: { type: 'number', description: '生成选题数量，默认 5' },
    },
  },
  async execute({ platform, count }) {
    // 1. 查询用户历史数据（高互动内容）
    const topContent = await getTopContent(platform, 20)

    // 2. 查询最近趋势数据（近期爬取的热榜/搜索结果）
    const trends = await getRecentTrends(platform, 30)

    // 3. 查询用户记忆（风格偏好、内容规律）
    const memories = await getMemories('default')

    // 4. 构造 prompt，调用 LLM 生成选题
    const topics = await generateTopics({ platform, topContent, trends, memories, count })

    return { topics }
  }
}
```

**数据库查询**（新增到 `db/index.js`）：

```js
// 获取用户某平台高互动内容
async function getTopContent(platform, limit) {
  // 查询 crawl_content 中 play_count + like_count 综合排序的 top 内容
  // 返回标题、描述、互动数据、分类
}

// 获取最近爬取的趋势数据
async function getRecentTrends(platform, limit) {
  // 查询最近 7 天内的 crawl_content，按 fetched_at 排序
  // 返回热门标题、互动数据、来源
}
```

**LLM 选题生成 prompt**：

```
你是一位视频选题策划专家。根据以下数据为创作者生成个性化选题建议。

## 创作者历史高互动内容
${topContent.map(v => `- "${v.title}" | 播放: ${v.playCount} | 点赞: ${v.likeCount} | 分类: ${v.category}`).join('\n')}

## 当前平台趋势
${trends.map(v => `- "${v.title}" | 播放: ${v.playCount} | 作者: ${v.authorName}`).join('\n')}

## 创作者已知偏好
${memories.map(m => `- ${m.value}（${m.type}）`).join('\n')}

## 要求
生成 ${count} 个选题建议，每个包含：
- title: 选题标题
- reason: 推荐理由（基于数据依据，30字以内）
- source: 灵感来源（"历史高互动"/"当前趋势"/"结合两者"）
- estimatedPerformance: 预估表现（"高"/"中"/"参考同类"）
- platforms: 适合发布的平台列表
- tags: 建议标签

返回 JSON 数组，不要有其他文字。
```

**2) 页面组件结构**

```
src/components/TopicsView.tsx          ← 主组件（重构占位页）
src/components/topics/TrendPanel.tsx   ← 左侧趋势面板
src/components/topics/TopicCard.tsx    ← 选题卡片
src/components/topics/TopicDetail.tsx  ← 选题详情面板
src/components/topics/SavedTopics.tsx  ← 收藏的选题
```

**3) IPC 接口**

| IPC 事件 | 方向 | 说明 |
|---|---|---|
| `topics-suggest` | renderer → main | 触发 AI 选题生成（通过 Agent 流式输出） |
| `topics-trends` | renderer → main | 获取指定平台最近趋势数据 |
| `topics-save` | renderer → main | 收藏选题到数据库 |
| `topics-saved` | renderer → main | 获取已收藏选题列表 |
| `topics-to-chat` | renderer → main | 将选题发送到创作台（创建新对话并预填） |

**4) 数据库新增表**

```sql
CREATE TABLE saved_topics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  platform TEXT NOT NULL,
  title TEXT NOT NULL,
  reason TEXT,
  source TEXT,
  estimated_performance TEXT,
  tags TEXT,  -- JSON array
  full_data TEXT,  -- 完整选题 JSON
  created_at DATETIME DEFAULT (datetime('now','localtime'))
)
```

---

### A.4 自进化反馈机制（record_feedback）

**目标**：记录用户对生成物料的采纳情况和发布后表现，反哺知识库权重。

**新工具 `record_feedback`**：

```js
// knower-agent/agent/tools/record_feedback.js
module.exports = {
  name: 'record_feedback',
  description: '记录用户对生成物料的反馈，更新知识库权重',
  input_schema: {
    type: 'object',
    properties: {
      scriptId: { type: 'number', description: '关联的 scripts 表 ID' },
      feedback: {
        type: 'string',
        enum: ['adopted', 'partially_adopted', 'rejected', 'modified_title', 'modified_hook'],
        description: '反馈类型'
      },
      notes: { type: 'string', description: '用户备注（可选）' },
    },
    required: ['scriptId', 'feedback'],
  },
  async execute({ scriptId, feedback, notes }) {
    // 1. 查询原始 script 的 memories
    // 2. 根据 feedback 类型调整 weight
    //    - adopted: 相关 memory weight +0.15
    //    - modified_title: 标题相关 memory weight -0.1
    //    - rejected: 所有相关 memory weight -0.05
    // 3. 记录反馈到 feedback_log 表
    return { success: true }
  }
}
```

**数据库新增表**：

```sql
CREATE TABLE feedback_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  script_id INTEGER,
  feedback TEXT NOT NULL,
  notes TEXT,
  created_at DATETIME DEFAULT (datetime('now','localtime')),
  FOREIGN KEY (script_id) REFERENCES scripts(id)
)
```

**前端交互**：

在 ChatView 的助手消息气泡下方增加反馈按钮：

```
[👍 采纳] [✏️ 改了标题] [🔄 改了钩子] [👎 没用]
```

点击后通过 IPC 调用 `record_feedback`，不需要 Agent 介入（直接操作数据库）。

---



### A.6 脚本文件导入

**目标**：支持从本地文件导入脚本文本到创作台。

**方案**：

在 ChatView 输入栏的附件按钮（已存在 `attach_file` 图标）触发文件选择器：

```
支持格式：
- .txt  → FileReader.readAsText()
- .md   → FileReader.readAsText()
- .docx → mammoth 库解析（~50KB gzipped，纯浏览器运行）
```

**依赖安装**：

```bash
npm install mammoth  # docx 解析
```

**实现**：

```tsx
// ChatView.tsx 中新增
const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0]
  if (!file) return

  let text = ''
  if (file.name.endsWith('.txt') || file.name.endsWith('.md')) {
    text = await file.text()
  } else if (file.name.endsWith('.docx')) {
    const mammoth = await import('mammoth')
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })
    text = result.value
  }

  if (text) {
    setInput(prev => prev ? prev + '\n\n' + text : text)
    textareaRef.current?.focus()
  }
}
```

UI 改动：附件按钮绑定 `<input type="file" accept=".txt,.md,.docx">`。

---

### A.7 创作台 → 灵感库联动

**目标**：灵感库中选中的选题可以一键发送到创作台开始创作。

**实现**：

1. `TopicsView` 中选题卡片增加"发到创作台"按钮
2. 点击后通过 IPC 调用 `topics-to-chat`，传递选题内容
3. `ChatView` 监听新对话事件，自动创建对话并预填 prompt：

```
请帮我基于以下选题生成各平台的发布物料：

选题：{title}
方向：{reason}
目标平台：{platforms}
```

4. 自动切换到 chat 页面并触发发送

**IPC 接口**：

```ts
// preload.ts 新增
sendTopicToChat: (topic: { title: string; reason: string; platforms: string[] }) =>
  ipcRenderer.invoke('topic-to-chat', topic)

// ChatView.tsx 监听
useEffect(() => {
  const unsub = window.electronAPI?.onTopicToChat((topic) => {
    setInput(generatePromptFromTopic(topic))
    setCurrentPage('chat')
  })
  return unsub
}, [])
```

---

## 附录 B：开发优先级排序

基于用户价值和实现复杂度，推荐的开发顺序：

### 第一优先级（近期）

1. **Agent 工具拆分**（A.2）— 提升创作台输出稳定性，改动集中，风险低
2. **Agent 多模型适配**（A.1）— 解锁更多用户群，技术改动独立
3. **脚本文件导入**（A.6）— 小功能，快速提升体验

### 第二优先级（灵感库核心）

4. **灵感库页面**（A.3）— 核心新功能，需要 DB 新表 + 新工具 + 新 UI
5. **创作台联动**（A.7）— 灵感库完成后的体验闭环

### 第三优先级（自进化）

7. **record_feedback**（A.4）— 需要一定用户量才有意义
8. **表现数据回流** — 依赖用户实际发布行为

---

*知更 Knower · 让创作者比平台更早知道下一步该做什么*

