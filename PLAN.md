# 知更 Knower 重构实施计划

> 版本: v1.0 | 日期: 2026-05-30
> 策略: 基于 REFACTOR-PRD.md，增量加模块，不引入 LangChain/LangGraph

---

## 一、现状分析

### 1.1 已有能力

| 模块 | 状态 | 说明 |
|------|------|------|
| Agent 核心 | ✅ | state.js / core.js / router.js / processor.js / cache.js |
| 工具集 | ✅ | 8 个工具（crawl_data, query_data, analyze_script, expand_script, save_result, suggest_topics, crawl_data_batch, request_user_input） |
| LLM 客户端 | ✅ | OpenAI-compatible API，支持 streaming |
| 记忆系统 | ✅ | memories 表，按 account_id 隔离（但无多创作者切换） |
| 爬虫模块 | ✅ | MediaCrawler 集成，支持 B站/抖音/小红书/微博 |
| SQLite 存储 | ✅ | 完整的数据库层 |
| 前端 UI | ✅ | ChatView / SettingsView / TopicsView / DataView |

### 1.2 与 PRD 差距

| PRD 要求 | 当前状态 | 差距 |
|----------|----------|------|
| 多创作者隔离 | memories 有 account_id，但无 accounts 表和切换功能 | 需新增 accounts 表 + CRUD + 前端切换器 |
| RAG 语义检索 | 无 | 需新增 rag/ 模块 + vectra 依赖 + search_similar 工具 |
| 可观测性 | toolHistory 只记录 tool 名称和成功状态 | 需增强为完整执行轨迹追踪 |
| 断点续跑 | state.js 有 serialize/deserialize，但无持久化 | 需新增 checkpoint.js |

---

## 二、实施阶段

### 阶段一: 多创作者隔离（预计 1-2 天）

**目标**: 每个创作者有独立数据空间，切换后记忆、爬取数据、脚本、选题全部隔离。

#### 步骤 1.1: 数据库迁移 — accounts 表 + account_id 列

**文件**: `knower-agent/db/index.js`

改动内容:
1. 在 `initTables()` 中新增 `accounts` 表建表语句
2. 新增迁移逻辑：scripts / crawl_tasks / saved_topics / conversations / video_analyses 表添加 `account_id` 列
3. 旧数据的 account_id 设为 "default"

```sql
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  platform TEXT NOT NULL,
  uid TEXT,
  avatar_url TEXT DEFAULT '',
  description TEXT DEFAULT '',
  is_active INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT (datetime('now','localtime')),
  updated_at DATETIME DEFAULT (datetime('now','localtime'))
)
```

迁移策略（try-catch 方式）:
```javascript
try {
  db.exec('SELECT account_id FROM scripts LIMIT 1')
} catch {
  db.exec("ALTER TABLE scripts ADD COLUMN account_id TEXT DEFAULT 'default'")
  saveDb()
}
// 对 crawl_tasks, saved_topics, conversations, video_analyses 同理
```

#### 步骤 1.2: accounts/index.js — 创作者 CRUD

**文件**: `knower-agent/accounts/index.js`（新建）

功能清单:
- `createAccount({ name, platform, uid, avatarUrl, description })` → 创建创作者
- `listAccounts()` → 获取所有创作者（按 is_active, updated_at 排序）
- `switchAccount(accountId)` → 切换当前激活创作者
- `getActiveAccount()` → 获取当前激活的创作者
- `deleteAccount(accountId)` → 删除创作者
- `updateAccount(accountId, updates)` → 更新创作者信息

#### 步骤 1.3: 改造 agent/core.js

**文件**: `knower-agent/agent/core.js`

改动内容:
1. 构造函数接收 `accountId` 参数
2. `run()` 和 `stream()` 方法中，构建 messages 时注入 account_id 上下文
3. 传递 accountId 给工具调用

```javascript
class Agent {
  constructor(config) {
    // ... 现有代码 ...
    this.accountId = config.accountId || 'default'
  }
}
```

#### 步骤 1.4: 改造工具 — 接收 accountId

**需要改动的工具**:

| 工具文件 | 改动 |
|----------|------|
| `crawl_data.js` | execute 接收 accountId，存入 crawl_tasks |
| `crawl_data_batch.js` | 同上 |
| `query_data.js` | 查询时加 account_id 过滤 |
| `save_result.js` | 保存时加 account_id |
| `suggest_topics.js` | 查询历史数据时加 account_id 过滤 |

**无需改动的工具**: analyze_script / expand_script / request_user_input（纯分析/生成，不存数据）

#### 步骤 1.5: 前端 — SettingsView 创作者管理

**文件**: `src/components/SettingsView.tsx`

新增 tab: "创作者管理"
- 创作者列表（名称、平台、状态）
- 新建/编辑/删除创作者
- 切换当前激活创作者

#### 步骤 1.6: 前端 — 侧边栏创作者切换器

**文件**: `src/components/Sidebar.tsx`（或新建 `AccountSwitcher.tsx`）

位置: 侧边栏顶部，logo 下方
- 显示当前创作者名称和平台
- 下拉菜单切换创作者
- 新建创作者入口

#### 阶段一验收标准

- [ ] 创建 2 个创作者，切换后爬取数据互不影响
- [ ] 记忆系统按创作者隔离
- [ ] 选题建议只基于当前创作者的历史数据
- [ ] 旧数据（account_id=default）仍可正常访问

---

### 阶段二: RAG 模块（预计 2-3 天）

**目标**: 支持语义相似度搜索，如"找之前类似的脚本""哪种标题套路互动高"。

#### 技术选型

| 组件 | 方案 | 说明 |
|------|------|------|
| Embedding API | OpenAI / Qwen | 用户自带 key，支持多 provider |
| 向量存储 | vectra | 纯 JS 本地向量库，零原生依赖 |
| 降级方案 | BM25 关键词搜索 | 无 embedding key 时自动降级 |

#### 步骤 2.1: 安装依赖

```bash
cd knower-agent && npm install vectra
```

#### 步骤 2.2: 数据库变更 — embedding_config 表

**文件**: `knower-agent/db/index.js`

```sql
CREATE TABLE IF NOT EXISTS embedding_config (
  id INTEGER PRIMARY KEY DEFAULT 1,
  provider TEXT DEFAULT 'none',
  api_key TEXT DEFAULT '',
  base_url TEXT DEFAULT '',
  model TEXT DEFAULT '',
  updated_at DATETIME DEFAULT (datetime('now','localtime'))
)
```

#### 步骤 2.3: rag/embedder.js — 多 Provider Embedding

**文件**: `knower-agent/rag/embedder.js`（新建）

功能:
- `Embedder` 类: 支持 OpenAI / Qwen embedding API
- `BM25Search` 类: 本地关键词搜索（降级方案）
- 缓存机制: 同一段文本不重复调 API（TTL 10 分钟）
- 输入截断: 文本超过 8000 字符自动截断

#### 步骤 2.4: rag/vectorStore.js — 向量存储

**文件**: `knower-agent/rag/vectorStore.js`（新建）

功能:
- 基于 vectra 的本地向量存储
- 按 accountId 隔离存储目录
- `upsertVector(accountId, id, text, metadata)`
- `searchVectors(accountId, queryVector, topK)`
- `deleteVector(accountId, id)`

#### 步骤 2.5: rag/retriever.js — 检索接口

**文件**: `knower-agent/rag/retriever.js`（新建）

功能:
- `findSimilarScripts(accountId, queryText, topK)` — 找相似脚本
- `findSimilarContent(accountId, queryText, platform, topK)` — 找相似内容
- `findHighEngagementPatterns(accountId, platform, topK)` — 找高互动模式
- 自动选择检索策略（向量 or BM25）

#### 步骤 2.6: rag/indexer.js — 索引构建

**文件**: `knower-agent/rag/indexer.js`（新建）

功能:
- `indexScript(accountId, scriptId, content)` — 索引单条脚本
- `indexCrawlContent(accountId, contentId, title, desc, platform, ...)` — 索引爬取内容
- `indexCrawlBatch(accountId, contents)` — 批量索引
- 增量索引: 内容哈希去重，未变化则跳过

#### 步骤 2.7: 新增工具 search_similar

**文件**: `knower-agent/agent/tools/search_similar.js`（新建）

```javascript
module.exports = {
  name: 'search_similar',
  description: '语义检索历史数据...',
  input_schema: {
    type: 'object',
    properties: {
      query: { type: 'string' },
      type: { type: 'string', enum: ['scripts', 'content', 'patterns'] },
      platform: { type: 'string' },
      topK: { type: 'number', default: 5 },
    },
    required: ['query', 'type'],
  },
  async execute({ query, type, platform, topK = 5 }) {
    // 调用 retriever 模块
  },
}
```

#### 步骤 2.8: 改造 processor.js — 自动索引

**文件**: `knower-agent/agent/processor.js`

在 `processToolResult` 中加入自动索引:
- `crawl_data` 完成后 → 调用 `indexCrawlBatch`
- `save_result` 完成后 → 调用 `indexScript`

#### 步骤 2.9: 注册新工具

**文件**: `knower-agent/agent/tools/index.js`

```javascript
const searchSimilar = require('./search_similar')
const tools = [...existingTools, searchSimilar]
```

#### 步骤 2.10: 前端 — SettingsView Embedding 配置

**文件**: `src/components/SettingsView.tsx`

新增 section: "Embedding 配置（可选）"
- Provider 选择: OpenAI / Qwen / 关闭
- API Key 输入
- Base URL 输入
- 模型输入

#### 步骤 2.11: 前端 — ChatView 参考历史面板

**文件**: `src/components/ChatView.tsx`

新增组件: SearchPanel（右侧可折叠面板）
- 搜索框 + 搜索结果列表
- 结果卡片: 相似度分数、标题摘要、来源平台
- 插入引用功能

#### 阶段二验收标准

- [ ] 爬取数据后，search_similar 能找到语义相似的内容
- [ ] 保存脚本后，search_similar(type='scripts') 能找到它
- [ ] 不同创作者的向量索引隔离
- [ ] 没有 OpenAI embedding key 时，RAG 功能降级为 BM25
- [ ] 索引过程异步执行，不阻塞主流程
- [ ] Embedding 调用失败时，自动降级到 BM25

---

### 阶段三: 可观测性（预计 1 天）

**目标**: Agent 每一步操作可视化，包括工具调用、参数、返回值、耗时、状态变化。

#### 步骤 3.1: observability/tracker.js — 执行追踪器

**文件**: `knower-agent/observability/tracker.js`（新建）

`ExecutionTracker` 类功能:
- `track(type, data)` — 记录事件
- `trackToolCall(name, input)` — 记录工具调用
- `trackToolResult(name, result, durationMs)` — 记录工具结果
- `trackStateChange(from, to, reason)` — 记录状态变化
- `trackLLMCall(model, tokenCount)` — 记录 LLM 调用
- `trackError(tool, error)` — 记录错误
- `getSummary()` — 获取摘要（总事件数、成功/失败数、总耗时）
- `toDisplayEvents()` — 格式化为前端展示格式

#### 步骤 3.2: 改造 core.js — 接入 tracker

**文件**: `knower-agent/agent/core.js`

在 `run()` 和 `stream()` 中:
1. 创建 tracker 实例
2. 工具调用前后记录事件
3. 状态变化时记录
4. 返回时附带 tracker summary

#### 步骤 3.3: 前端 — ChatView 执行追踪面板

**文件**: `src/components/ChatView.tsx`

新增组件: ExecutionTimeline（底部可折叠面板）
- 折叠状态显示摘要: "3 步, 4.2s"
- 展开后显示完整时间线
- 每个步骤用不同颜色 icon 区分
- 失败步骤红色高亮 + 错误详情
- 状态变化用虚线箭头连接

#### 步骤 3.4: 前端 — 实时执行指示器

**文件**: `src/components/ChatView.tsx`

工具调用期间，在输入框上方显示:
```
正在爬取 B 站数据... (预计 30s)
```

#### 阶段三验收标准

- [ ] 每次对话显示完整的工具调用链路
- [ ] 每个工具调用显示耗时
- [ ] 状态变化可视化
- [ ] 错误高亮显示
- [ ] 可折叠/展开详情

---

### 阶段四: 断点续跑（预计 0.5 天）

**目标**: Agent 执行中途崩溃后，重启后能从上次断点恢复。

#### 步骤 4.1: checkpoint.js — 检查点管理

**文件**: `knower-agent/checkpoint.js`（新建）

功能:
- `saveCheckpoint(conversationId, state, messages)` — 保存检查点
- `loadCheckpoint(conversationId)` — 加载检查点
- `clearCheckpoint(conversationId)` — 清除检查点（任务完成后）
- `listCheckpoints()` — 列出所有检查点

存储位置: `knower-agent/.checkpoints/` 目录

#### 步骤 4.2: 改造 core.js — 接入保存/恢复

**文件**: `knower-agent/agent/core.js`

改动内容:
1. `run()` 方法接收 `conversationId` 参数
2. 启动时尝试加载检查点并恢复状态
3. 每次工具调用后自动保存检查点
4. 任务完成后清除检查点

#### 步骤 4.3: 前端 — ChatView 恢复提示

**文件**: `src/components/ChatView.tsx`

新增组件: RestoreBanner（顶部提示条）
- 检测到未完成检查点时显示
- "继续执行" 按钮: 恢复状态
- "重新开始" 按钮: 清除检查点
- 5 秒后自动消失（除非用户 hover）

#### 阶段四验收标准

- [ ] 执行 crawl_data 时杀进程，重启后自动从爬取完成恢复
- [ ] 执行 expand_script 时断网，重连后从分析完成恢复
- [ ] 任务正常完成后检查点自动清除
- [ ] 检查点文件不超过 1MB（截断过长的 messages）

---

## 三、完整文件变更清单

### 新增文件（8 个）

| 文件 | 说明 |
|------|------|
| `knower-agent/accounts/index.js` | 创作者 CRUD |
| `knower-agent/rag/embedder.js` | 多 provider embedding + BM25 降级 |
| `knower-agent/rag/vectorStore.js` | vectra 向量存储 |
| `knower-agent/rag/retriever.js` | 检索接口 |
| `knower-agent/rag/indexer.js` | 索引构建 |
| `knower-agent/agent/tools/search_similar.js` | 语义检索工具 |
| `knower-agent/observability/tracker.js` | 执行追踪器 |
| `knower-agent/checkpoint.js` | 断点续跑管理 |

### 修改文件（12 个）

| 文件 | 改动 |
|------|------|
| `knower-agent/db/index.js` | 新增 accounts / embedding_config 表 + 迁移 |
| `knower-agent/agent/core.js` | 接入 accountId / tracker / checkpoint |
| `knower-agent/agent/processor.js` | crawl_data/save_result 后自动索引 |
| `knower-agent/agent/tools/index.js` | 注册 search_similar |
| `knower-agent/agent/tools/crawl_data.js` | 接收 accountId |
| `knower-agent/agent/tools/crawl_data_batch.js` | 接收 accountId |
| `knower-agent/agent/tools/query_data.js` | account_id 过滤 |
| `knower-agent/agent/tools/save_result.js` | account_id + 自动索引 |
| `knower-agent/agent/tools/suggest_topics.js` | account_id 过滤 |
| `knower-agent/config/index.js` | 新增 embedding 配置 |
| `src/components/SettingsView.tsx` | 创作者管理 tab + embedding 配置 |
| `src/components/ChatView.tsx` | 参考历史面板 + 执行追踪 + 恢复提示 |

### 新增依赖

| 包 | 用途 | 体积 |
|---|------|------|
| vectra | 本地向量存储 | ~50KB |

---

## 四、风险与注意事项

| 风险 | 影响 | 缓解措施 |
|------|------|----------|
| vectra Electron 打包兼容性 | RAG 功能不可用 | 纯 JS 实现，理论上无问题；需测试打包后是否正常 |
| Embedding API 成本 | 用户额外开销 | UI 提示用户；支持 BM25 降级 |
| 向量索引体积 | 磁盘占用 | 1000 条内容约 50MB；可监控并提示用户 |
| 旧数据迁移 | 数据丢失 | account_id 默认值 "default"；迁移脚本用 try-catch |
| 检查点文件清理 | 磁盘占用 | 7 天以上自动清理；UI 提示用户 |

---

## 五、实施顺序（推荐）

```
阶段一 (1-2天)
  Day 1: db/index.js 迁移 + accounts/index.js + config 改造
  Day 2: 工具改造 + 前端 AccountSwitcher + AccountManager

阶段二 (2-3天)
  Day 1: npm install vectra + rag/embedder.js + rag/vectorStore.js
  Day 2: rag/retriever.js + rag/indexer.js + search_similar 工具
  Day 3: processor.js 自动索引 + 前端 SearchPanel + SearchCard

阶段三 (1天)
  Day 1: observability/tracker.js + core.js 接入 + 前端 ExecutionTimeline

阶段四 (0.5天)
  Day 1: checkpoint.js + core.js 接入 + 前端 RestoreBanner
```

---

## 六、验收清单汇总

### 阶段一
- [ ] 创建 2 个创作者，切换后爬取数据互不影响
- [ ] 记忆系统按创作者隔离
- [ ] 选题建议只基于当前创作者的历史数据
- [ ] 旧数据（account_id=default）仍可正常访问

### 阶段二
- [ ] 爬取数据后，search_similar 能找到语义相似的内容
- [ ] 保存脚本后，search_similar(type='scripts') 能找到它
- [ ] 不同创作者的向量索引隔离
- [ ] 没有 OpenAI embedding key 时，RAG 功能降级为 BM25
- [ ] 索引过程异步执行，不阻塞主流程
- [ ] Embedding 调用失败时，自动降级到 BM25
- [ ] Embedding 缓存生效，同一文本不重复调 API

### 阶段三
- [ ] 每次对话显示完整的工具调用链路
- [ ] 每个工具调用显示耗时
- [ ] 状态变化可视化
- [ ] 错误高亮显示
- [ ] 可折叠/展开详情

### 阶段四
- [ ] 执行 crawl_data 时杀进程，重启后自动从爬取完成恢复
- [ ] 执行 expand_script 时断网，重连后从分析完成恢复
- [ ] 任务正常完成后检查点自动清除
- [ ] 检查点文件不超过 1MB

---

## 七、不做的事

- 不引入 LangChain/LangGraph
- 不引入 Python 运行时
- 不引入外部向量数据库（Qdrant/ChromaDB）
- 不做分布式工作流
- 不做 Reranker（第一版不需要）
- 不做多模态 embedding（文本足够）

---

**状态**: 待用户验收
