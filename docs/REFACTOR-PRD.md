# 知更 Agent 增量重构 PRD

> 版本: v1.0 | 日期: 2026-05-30 | 状态: 待执行
> 策略: 保持现有框架 + 增量加模块，不引入 LangChain/LangGraph

---

## 背景

当前 Agent 框架已具备: 状态机、路由器、数据处理器、8 个工具、LLM 客户端、记忆系统、爬虫、SQLite 存储。

用户需求升级:
1. **多创作者隔离** — 一个人管多个自媒体账号，数据不能混
2. **语义检索 (RAG)** — "找之前类似的脚本""哪种标题套路互动高"
3. **可观测性** — 看到 Agent 每一步在干什么
4. **断点续跑** — 崩溃后从上次进度恢复

---

## 总体架构

```
knower-agent/
  agent/                     # 核心（不动）
    core.js                  # 主循环
    state.js                 # 状态机
    router.js                # 路由器
    processor.js             # 数据处理器
    cache.js                 # 缓存
    tools/                   # 8 个工具（不动）
  llm/                       # LLM 客户端（不动）
  db/                        # 数据库（增量改造）
    index.js                 # 加新表 + 新查询函数
  rag/                       # [新增] RAG 模块
    embedder.js              # 文本向量化
    vectorStore.js           # 向量存储（基于 SQLite）
    retriever.js             # 检索器
    indexer.js               # 索引构建器
  accounts/                  # [新增] 多创作者管理
    index.js                 # 创作者 CRUD
  observability/             # [新增] 可观测性
    tracker.js               # 追踪器（包装 toolHistory）
    formatter.js             # 格式化输出
  crawler/                   # 爬虫（不动）
```

---

## 阶段一: 多创作者隔离

### 目标

每个创作者（自媒体账号）有独立的数据空间。切换创作者后，记忆、爬取数据、脚本、选题全部隔离。

### 数据库变更

#### 新增 accounts 表

```sql
CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,              -- 唯一标识，如 "bili_440609243"
  name TEXT NOT NULL,               -- 显示名，如 "科技老王"
  platform TEXT NOT NULL,           -- 主平台: bili/dy/xhs/wb
  uid TEXT,                         -- 平台 UID
  avatar_url TEXT DEFAULT '',
  description TEXT DEFAULT '',
  is_active INTEGER DEFAULT 0,     -- 是否当前激活
  created_at DATETIME DEFAULT (datetime('now','localtime')),
  updated_at DATETIME DEFAULT (datetime('now','localtime'))
)
```

#### 现有表加 account_id

需要加 `account_id` 列的表:

| 表 | 当前状态 | 改动 |
|---|---|---|
| memories | 已有 account_id | 无需改动 |
| scripts | 无 account_id | 加列 + 迁移 |
| crawl_tasks | 无 account_id | 加列 + 迁移 |
| crawl_content | 无 account_id（通过 task_id 关联） | 无需改动 |
| saved_topics | 无 account_id | 加列 + 迁移 |
| video_analyses | 无 account_id | 加列 + 迁移 |
| conversations | 无 account_id | 加列 + 迁移 |

迁移策略: 旧数据的 account_id 设为 "default"。

### 新增文件: accounts/index.js

```javascript
// accounts/index.js
// 功能: 创作者 CRUD + 切换当前激活创作者

const { getDb, saveDb } = require('../db')

// 创建创作者
async function createAccount({ name, platform, uid, avatarUrl, description }) {
  const db = await getDb()
  const id = `${platform}_${uid || Date.now()}`
  db.run(
    `INSERT OR REPLACE INTO accounts (id, name, platform, uid, avatar_url, description, is_active, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, datetime('now','localtime'), datetime('now','localtime'))`,
    [id, name, platform, uid || '', avatarUrl || '', description || '']
  )
  saveDb()
  return id
}

// 获取所有创作者
async function listAccounts() {
  const db = await getDb()
  const res = db.exec('SELECT id, name, platform, uid, avatar_url, description, is_active FROM accounts ORDER BY is_active DESC, updated_at DESC')
  if (!res.length) return []
  return res[0].values.map(row => ({
    id: row[0], name: row[1], platform: row[2], uid: row[3],
    avatarUrl: row[4], description: row[5], isActive: !!row[6],
  }))
}

// 切换当前创作者
async function switchAccount(accountId) {
  const db = await getDb()
  db.run('UPDATE accounts SET is_active = 0')
  db.run('UPDATE accounts SET is_active = 1, updated_at = datetime(\'now\',\'localtime\') WHERE id = ?', [accountId])
  saveDb()
}

// 获取当前激活的创作者
async function getActiveAccount() {
  const db = await getDb()
  const res = db.exec('SELECT id, name, platform, uid FROM accounts WHERE is_active = 1 LIMIT 1')
  if (!res.length || !res[0].values.length) return null
  const row = res[0].values[0]
  return { id: row[0], name: row[1], platform: row[2], uid: row[3] }
}

// 删除创作者
async function deleteAccount(accountId) {
  const db = await getDb()
  db.run('DELETE FROM accounts WHERE id = ?', [accountId])
  saveDb()
}

module.exports = { createAccount, listAccounts, switchAccount, getActiveAccount, deleteAccount }
```

### 改造 db/index.js

在 initTables 中追加 accounts 表建表语句，以及迁移逻辑:

```javascript
// 在 initTables 末尾追加
db.run(`
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
`)

// 迁移: scripts 表加 account_id
try {
  db.exec('SELECT account_id FROM scripts LIMIT 1')
} catch {
  db.exec("ALTER TABLE scripts ADD COLUMN account_id TEXT DEFAULT 'default'")
  saveDb()
}

// 迁移: crawl_tasks 表加 account_id
try {
  db.exec('SELECT account_id FROM crawl_tasks LIMIT 1')
} catch {
  db.exec("ALTER TABLE crawl_tasks ADD COLUMN account_id TEXT DEFAULT 'default'")
  saveDb()
}

// 迁移: saved_topics 表加 account_id
try {
  db.exec('SELECT account_id FROM saved_topics LIMIT 1')
} catch {
  db.exec("ALTER TABLE saved_topics ADD COLUMN account_id TEXT DEFAULT 'default'")
  saveDb()
}

// 迁移: conversations 表加 account_id
try {
  db.exec('SELECT account_id FROM conversations LIMIT 1')
} catch {
  db.exec("ALTER TABLE conversations ADD COLUMN account_id TEXT DEFAULT 'default'")
  saveDb()
}
```

### 改造 agent/core.js

Agent 构造函数接收 account_id，所有工具调用自动带上:

```javascript
class Agent {
  constructor(config) {
    // ... 现有代码 ...
    this.accountId = config.accountId || 'default'
  }

  async run(userInput, options = {}) {
    // ... 现有代码 ...
    // 在构建 messages 时注入 account_id 上下文
    const accountContext = this.accountId !== 'default'
      ? `\n\n## 当前创作者\nID: ${this.accountId}`
      : ''
    // 拼接到 systemPrompt 后面
  }
}
```

### 改造工具

每个需要 account_id 的工具，在 execute 中接收并传递:

| 工具 | 改动 |
|------|------|
| crawl_data | execute 接收 accountId，存入 crawl_tasks |
| crawl_data_batch | 同上 |
| query_data | 查询时加 account_id 过滤 |
| save_result | 保存时加 account_id |
| suggest_topics | 查询历史数据时加 account_id 过滤 |
| analyze_script | 无需改动（纯分析，不存数据） |
| expand_script | 无需改动（纯生成，不存数据） |
| request_user_input | 无需改动 |

### 验收标准

- [ ] 创建 2 个创作者，切换后爬取数据互不影响
- [ ] 记忆系统按创作者隔离
- [ ] 选题建议只基于当前创作者的历史数据
- [ ] 旧数据（account_id=default）仍可正常访问
---

## 阶段二: RAG 模块（语义检索）

### 目标

支持语义相似度搜索: "找之前类似的脚本""哪种标题套路互动高""这个创作者的内容模式是什么"。

### 技术选型

| 方案 | 优点 | 缺点 | 结论 |
|------|------|------|------|
| OpenAI text-embedding-3 | 质量高，API 简单 | 需要 API key，有成本 | **首选**（用户自带 key） |
| 本地 BGE 模型 | 免费，离线 | 需要 ONNX Runtime，打包体积 +200MB | 备选 |
| sqlite-vss | 原生 SQLite 扩展 | 编译困难，Windows 兼容性差 | 不选 |
| vectra | 轻量向量库，纯 JS | 功能简单 | **存储层首选** |

**最终方案: OpenAI embedding API + vectra 本地向量存储**

- 用户在 SettingsView 配置 embedding 模型（默认 text-embedding-3-small）
- 向量存在本地 vectra（JSON 文件，无需额外服务）
- 如果用户没有 OpenAI key，RAG 功能降级为关键词搜索

### 新增依赖

```bash
npm install vectra
```

vectra 是纯 JS 实现的本地向量数据库，零原生依赖，适合 Electron。

### 数据库变更

#### 新增 embeddings 表（元数据索引）

```sql
CREATE TABLE IF NOT EXISTS embeddings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id TEXT NOT NULL DEFAULT 'default',
  source_type TEXT NOT NULL,        -- 'script' | 'crawl_content' | 'topic' | 'material'
  source_id INTEGER NOT NULL,       -- 关联的原始记录 ID
  content_hash TEXT NOT NULL,       -- 内容哈希（去重用）
  created_at DATETIME DEFAULT (datetime('now','localtime')),
  UNIQUE(source_type, source_id)
)
```

向量数据存在 vectra 的 JSON 文件中，不在 SQLite 里。这张表只做元数据索引和去重。

### 新增文件

#### rag/embedder.js

```javascript
// rag/embedder.js
// 功能: 文本 → 向量

const loadSettings = require('../config')

// 缓存: 同一段文本不重复调 API
const cache = new Map()
const CACHE_TTL = 10 * 60 * 1000

async function embed(text) {
  const hash = simpleHash(text)
  const cached = cache.get(hash)
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.vec

  const settings = loadSettings()
  const baseUrl = (settings.baseUrl || 'https://api.openai.com').replace(/\/+$/, '')
  const apiKey = settings.apiKey

  if (!apiKey) throw new Error('缺少 API Key，无法调用 embedding 接口')

  // 判断是否 OpenAI 官方
  const isOfficial = baseUrl.includes('api.openai.com')

  const body = {
    model: settings.embeddingModel || 'text-embedding-3-small',
    input: text.slice(0, 8000),  // 截断防超限
  }

  const resp = await fetch(`${baseUrl}/v1/embeddings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  })

  if (!resp.ok) {
    const err = await resp.text()
    throw new Error(`Embedding API error ${resp.status}: ${err}`)
  }

  const data = await resp.json()
  const vec = data.data[0].embedding

  cache.set(hash, { vec, ts: Date.now() })
  return vec
}

function simpleHash(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0
  }
  return String(hash)
}

// 批量向量化
async function embedBatch(texts) {
  const results = []
  for (const text of texts) {
    results.push(await embed(text))
  }
  return results
}

module.exports = { embed, embedBatch }
```

#### rag/vectorStore.js

```javascript
// rag/vectorStore.js
// 功能: 基于 vectra 的本地向量存储

const { Index } = require('vectra')
const path = require('path')
const fs = require('fs')

const VECTRA_DIR = path.join(__dirname, '..', '.vectra')

function getIndex(accountId = 'default') {
  const dir = path.join(VECTRA_DIR, accountId)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  return new Index(path.join(dir, 'vectors'))
}

// 存入向量
async function upsertVector(accountId, id, text, metadata = {}) {
  const index = getIndex(accountId)
  await index.upsertVector({
    id: String(id),
    vector: metadata._vector,  // 外部传入
    metadata: { text, ...metadata },
  })
}

// 语义搜索
async function searchVectors(accountId, queryVector, topK = 10) {
  const index = getIndex(accountId)
  const results = await index.queryVectors(queryVector, topK)
  return results.map(r => ({
    id: r.id,
    score: r.score,
    text: r.metadata.text,
    ...r.metadata,
  }))
}

// 删除向量
async function deleteVector(accountId, id) {
  const index = getIndex(accountId)
  await index.deleteVector(String(id))
}

// 按 source_type 删除
async function deleteBySourceType(accountId, sourceType) {
  const index = getIndex(accountId)
  // vectra 没有批量删除，需要遍历
  // 实际实现中可以维护一个 ID 列表
}

module.exports = { upsertVector, searchVectors, deleteVector, getIndex }
```

#### rag/retriever.js

```javascript
// rag/retriever.js
// 功能: 对外暴露的检索接口

const { embed } = require('./embedder')
const { searchVectors } = require('./vectorStore')
const { getDb, saveDb } = require('../db')

// 检索相似脚本
async function findSimilarScripts(accountId, queryText, topK = 5) {
  const queryVec = await embed(queryText)
  const results = await searchVectors(accountId, queryVec, topK)
  return results
    .filter(r => r.sourceType === 'script')
    .map(r => ({
      id: r.sourceId,
      score: r.score,
      text: r.text.slice(0, 200) + '...',
    }))
}

// 检索相似爬取内容（找爆款模式）
async function findSimilarContent(accountId, queryText, platform, topK = 10) {
  const queryVec = await embed(queryText)
  const results = await searchVectors(accountId, queryVec, topK * 2)
  return results
    .filter(r => r.sourceType === 'crawl_content' && (!platform || r.platform === platform))
    .slice(0, topK)
    .map(r => ({
      id: r.sourceId,
      score: r.score,
      title: r.title || r.text?.slice(0, 50),
      platform: r.platform,
      playCount: r.playCount || 0,
      likeCount: r.likeCount || 0,
    }))
}

// 检索高互动标题模式
async function findHighEngagementPatterns(accountId, platform, topK = 20) {
  const db = await getDb()
  // 先从数据库取高互动内容
  const res = db.exec(
    `SELECT id, title, like_count, comment_count, share_count
     FROM crawl_content
     WHERE platform = ? AND like_count > 100
     ORDER BY like_count DESC
     LIMIT ?`,
    [platform, topK]
  )
  if (!res.length) return []
  return res[0].values.map(row => ({
    id: row[0], title: row[1],
    likeCount: row[2], commentCount: row[3], shareCount: row[4],
  }))
}

module.exports = { findSimilarScripts, findSimilarContent, findHighEngagementPatterns }
```

#### rag/indexer.js

```javascript
// rag/indexer.js
// 功能: 构建/更新向量索引

const { embed } = require('./embedder')
const { upsertVector, deleteVector } = require('./vectorStore')
const { getDb, saveDb } = require('../db')

// 索引单条脚本
async function indexScript(accountId, scriptId, content) {
  const db = await getDb()
  // 检查是否已索引
  const existing = db.exec(
    'SELECT id, content_hash FROM embeddings WHERE source_type = ? AND source_id = ?',
    ['script', scriptId]
  )
  const hash = simpleHash(content)

  if (existing.length && existing[0].values.length) {
    if (existing[0].values[0][1] === hash) return  // 内容没变，跳过
    // 内容变了，更新
    await deleteVector(accountId, `script_${scriptId}`)
  }

  const vector = await embed(content.slice(0, 3000))
  await upsertVector(accountId, `script_${scriptId}`, content.slice(0, 3000), {
    _vector: vector,
    sourceType: 'script',
    sourceId: scriptId,
    text: content.slice(0, 3000),
  })

  // 更新元数据索引
  db.run(
    `INSERT OR REPLACE INTO embeddings (account_id, source_type, source_id, content_hash, created_at)
     VALUES (?, 'script', ?, ?, datetime('now','localtime'))`,
    [accountId, scriptId, hash]
  )
  saveDb()
}

// 索引爬取内容
async function indexCrawlContent(accountId, contentId, title, desc, platform, playCount, likeCount) {
  const db = await getDb()
  const text = `${title || ''} ${desc || ''}`.trim()
  if (!text) return

  const hash = simpleHash(text)
  const existing = db.exec(
    'SELECT id, content_hash FROM embeddings WHERE source_type = ? AND source_id = ?',
    ['crawl_content', contentId]
  )
  if (existing.length && existing[0].values.length && existing[0].values[0][1] === hash) return

  const vector = await embed(text.slice(0, 3000))
  await upsertVector(accountId, `crawl_${contentId}`, text.slice(0, 3000), {
    _vector: vector,
    sourceType: 'crawl_content',
    sourceId: contentId,
    title,
    platform,
    playCount: playCount || 0,
    likeCount: likeCount || 0,
    text: text.slice(0, 3000),
  })

  db.run(
    `INSERT OR REPLACE INTO embeddings (account_id, source_type, source_id, content_hash, created_at)
     VALUES (?, 'crawl_content', ?, ?, datetime('now','localtime'))`,
    [accountId, contentId, hash]
  )
  saveDb()
}

// 批量索引爬取内容（crawl_data 完成后调用）
async function indexCrawlBatch(accountId, contents) {
  let indexed = 0
  for (const c of contents) {
    try {
      await indexCrawlContent(
        accountId,
        c.video_id || c.note_id || c.id,
        c.title, c.desc, c.platform,
        c.video_play_count || c.play_count || 0,
        c.liked_count || 0
      )
      indexed++
    } catch (err) {
      console.error(`[Indexer] 索引失败 content_id=${c.id}:`, err.message)
    }
  }
  console.log(`[Indexer] 已索引 ${indexed}/${contents.length} 条内容`)
  return indexed
}

function simpleHash(str) {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0
  }
  return String(hash)
}

module.exports = { indexScript, indexCrawlContent, indexCrawlBatch }
```

### 新增工具: search_similar

```javascript
// agent/tools/search_similar.js
const { findSimilarScripts, findSimilarContent, findHighEngagementPatterns } = require('../../rag/retriever')

module.exports = {
  name: 'search_similar',
  description: `语义检索历史数据。支持找相似脚本、相似内容、高互动模式。

**什么时候必须调用：**
- 用户说"找类似的脚本""参考之前的"
- 用户说"哪种标题互动高""爆款模式"
- 用户说"这个创作者的内容模式是什么"

**什么时候不要调用：**
- 用户只是要生成新内容（用 expand_script）
- 用户要爬新数据（用 crawl_data）`,
  input_schema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: '搜索语义（自然语言描述你要找什么）' },
      type: { type: 'string', enum: ['scripts', 'content', 'patterns'], description: '检索类型' },
      platform: { type: 'string', description: '限定平台（可选）' },
      topK: { type: 'number', description: '返回条数，默认 5' },
    },
    required: ['query', 'type'],
  },
  async execute({ query, type, platform, topK = 5 }) {
    try {
      const accountId = this.accountId || 'default'
      let results

      switch (type) {
        case 'scripts':
          results = await findSimilarScripts(accountId, query, topK)
          break
        case 'content':
          results = await findSimilarContent(accountId, query, platform, topK)
          break
        case 'patterns':
          results = await findHighEngagementPatterns(accountId, platform || 'bili', topK)
          break
        default:
          return { error: `未知检索类型: ${type}` }
      }

      return { success: true, type, query, results, count: results.length }
    } catch (err) {
      return { success: false, error: err.message }
    }
  },
}
```

### 改造 processor.js

在 processToolResult 中加入自动索引:

```javascript
case 'crawl_data':
  // 现有代码...
  // 新增: 自动索引爬取内容
  if (state.crawlData?.length > 0) {
    const { indexCrawlBatch } = require('../rag/indexer')
    indexCrawlBatch(accountId, state.crawlData).catch(err => {
      console.error('[Processor] 自动索引失败:', err.message)
    })
  }
  break

case 'save_result':
  // 现有代码...
  // 新增: 自动索引脚本
  if (result.id && state.script) {
    const { indexScript } = require('../rag/indexer')
    indexScript(accountId, result.id, state.script).catch(err => {
      console.error('[Processor] 索引脚本失败:', err.message)
    })
  }
  break
```

### 验收标准

- [ ] 爬取数据后，search_similar 能找到语义相似的内容
- [ ] 保存脚本后，search_similar(type='scripts') 能找到它
- [ ] 不同创作者的向量索引隔离
- [ ] 没有 OpenAI embedding key 时，RAG 功能优雅降级
- [ ] 索引过程异步执行，不阻塞主流程
---

## 阶段三: 可观测性

### 目标

Agent 每一步操作可视化: 调了什么工具、传了什么参数、返回了什么、耗时多少、状态怎么变的。

### 现有基础

toolHistory 已经在 AgentState 中记录了每次工具调用:

```javascript
state.toolHistory.push({
  tool: toolName,
  timestamp: Date.now(),
  success: !result.error,
  error: result.error || null,
})
```

### 新增文件: observability/tracker.js

```javascript
// observability/tracker.js
// 功能: 增强版追踪器，记录完整的执行轨迹

class ExecutionTracker {
  constructor() {
    this.events = []
    this.startTime = Date.now()
  }

  // 记录事件
  track(type, data) {
    this.events.push({
      type,                          // 'tool_call' | 'tool_result' | 'state_change' | 'llm_call' | 'error' | 'text_chunk'
      timestamp: Date.now(),
      elapsed: Date.now() - this.startTime,
      ...data,
    })
  }

  // 记录工具调用
  trackToolCall(name, input) {
    this.track('tool_call', {
      tool: name,
      input: JSON.stringify(input).slice(0, 500),
    })
  }

  // 记录工具结果
  trackToolResult(name, result, durationMs) {
    this.track('tool_result', {
      tool: name,
      success: !result.error,
      error: result.error || null,
      durationMs,
      outputSize: JSON.stringify(result).length,
    })
  }

  // 记录状态变化
  trackStateChange(from, to, reason) {
    this.track('state_change', { from, to, reason })
  }

  // 记录 LLM 调用
  trackLLMCall(model, tokenCount) {
    this.track('llm_call', { model, tokenCount })
  }

  // 记录错误
  trackError(tool, error) {
    this.track('error', { tool, error: String(error) })
  }

  // 获取摘要
  getSummary() {
    const toolCalls = this.events.filter(e => e.type === 'tool_call').length
    const toolResults = this.events.filter(e => e.type === 'tool_result')
    const successes = toolResults.filter(e => e.success).length
    const failures = toolResults.filter(e => !e.success).length
    const totalTime = Date.now() - this.startTime

    return {
      totalEvents: this.events.length,
      toolCalls,
      successes,
      failures,
      totalTimeMs: totalTime,
      avgToolTime: toolResults.length
        ? Math.round(toolResults.reduce((s, e) => s + (e.durationMs || 0), 0) / toolResults.length)
        : 0,
      stateChanges: this.events.filter(e => e.type === 'state_change').map(e => `${e.from}→${e.to}`),
    }
  }

  // 格式化输出（给前端展示）
  toDisplayEvents() {
    return this.events.map(e => {
      switch (e.type) {
        case 'tool_call':
          return { icon: '🔧', text: `调用 ${e.tool}`, detail: e.input, time: e.elapsed }
        case 'tool_result':
          return {
            icon: e.success ? '✅' : '❌',
            text: `${e.tool} ${e.success ? '成功' : '失败'}`,
            detail: e.error || `耗时 ${e.durationMs}ms`,
            time: e.elapsed,
          }
        case 'state_change':
          return { icon: '🔄', text: `状态 ${e.from} → ${e.to}`, detail: e.reason, time: e.elapsed }
        case 'llm_call':
          return { icon: '🧠', text: `LLM 调用`, detail: `${e.model} | ${e.tokenCount} tokens`, time: e.elapsed }
        case 'error':
          return { icon: '💥', text: `错误`, detail: `${e.tool}: ${e.error}`, time: e.elapsed }
        default:
          return { icon: '📝', text: e.type, detail: JSON.stringify(e).slice(0, 200), time: e.elapsed }
      }
    })
  }
}

module.exports = ExecutionTracker
```

### 改造 core.js

在 Agent.run 和 Agent.stream 中接入 tracker:

```javascript
const ExecutionTracker = require('../observability/tracker')

// 在 run() 和 stream() 开头创建 tracker
const tracker = new ExecutionTracker()

// 在工具调用前后记录
tracker.trackToolCall(block.name, block.input)
const startTime = Date.now()
// ... 执行工具 ...
tracker.trackToolResult(block.name, result, Date.now() - startTime)

// 在状态变化时记录
tracker.trackStateChange(oldPhase, newPhase, reason)

// 返回时附带 tracker
return { result: finalResult, tracker: tracker.getSummary() }
```

### 前端展示（ChatView 中）

在工具调用事件流中，前端已经能收到 onToolCall 回调。增强:

```javascript
// ChatView.tsx 中
onToolCall: (name, input) => {
  // 现有: 显示工具调用
  // 新增: 显示耗时、状态变化
  setToolEvents(prev => [...prev, {
    type: 'call', name, input,
    timestamp: Date.now(),
  }])
}

onToolResult: (name, result, duration) => {
  setToolEvents(prev => [...prev, {
    type: 'result', name, success: !result.error,
    duration, timestamp: Date.now(),
  }])
}
```

### 验收标准

- [ ] 每次对话显示完整的工具调用链路
- [ ] 每个工具调用显示耗时
- [ ] 状态变化可视化
- [ ] 错误高亮显示
- [ ] 可折叠/展开详情

---

## 阶段四: 断点续跑

### 目标

Agent 执行中途崩溃（网络断开、进程被杀），重启后能从上次断点恢复继续执行。

### 现有基础

state.js 已有 serialize/deserialize:

```javascript
serialize() { return JSON.parse(JSON.stringify(this)) }
static deserialize(data) {
  const state = new AgentState()
  Object.assign(state, data)
  return state
}
```

### 新增文件: checkpoint.js

```javascript
// checkpoint.js
// 功能: Agent 状态的持久化保存和恢复

const fs = require('fs')
const path = require('path')

const CHECKPOINT_DIR = path.join(__dirname, '.checkpoints')

function getCheckpointPath(conversationId) {
  if (!fs.existsSync(CHECKPOINT_DIR)) fs.mkdirSync(CHECKPOINT_DIR, { recursive: true })
  return path.join(CHECKPOINT_DIR, `${conversationId}.json`)
}

// 保存检查点
function saveCheckpoint(conversationId, state, messages) {
  const data = {
    version: 1,
    savedAt: Date.now(),
    state: state.serialize(),
    messages: messages,  // 保留完整对话历史
  }
  const p = getCheckpointPath(conversationId)
  fs.writeFileSync(p, JSON.stringify(data, null, 2), 'utf-8')
  console.log(`[Checkpoint] 已保存: ${conversationId}`)
}

// 加载检查点
function loadCheckpoint(conversationId) {
  const p = getCheckpointPath(conversationId)
  if (!fs.existsSync(p)) return null
  try {
    const data = JSON.parse(fs.readFileSync(p, 'utf-8'))
    return {
      state: AgentState.deserialize(data.state),
      messages: data.messages,
      savedAt: data.savedAt,
    }
  } catch (err) {
    console.error(`[Checkpoint] 加载失败:`, err)
    return null
  }
}

// 删除检查点（任务完成后）
function clearCheckpoint(conversationId) {
  const p = getCheckpointPath(conversationId)
  if (fs.existsSync(p)) fs.unlinkSync(p)
  console.log(`[Checkpoint] 已清除: ${conversationId}`)
}

// 列出所有检查点
function listCheckpoints() {
  if (!fs.existsSync(CHECKPOINT_DIR)) return []
  return fs.readdirSync(CHECKPOINT_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => {
      const data = JSON.parse(fs.readFileSync(path.join(CHECKPOINT_DIR, f), 'utf-8'))
      return {
        conversationId: f.replace('.json', ''),
        savedAt: data.savedAt,
        phase: data.state?.phase,
      }
    })
}

module.exports = { saveCheckpoint, loadCheckpoint, clearCheckpoint, listCheckpoints }
```

### 改造 core.js

在每次工具调用后自动保存检查点:

```javascript
const { saveCheckpoint, loadCheckpoint, clearCheckpoint } = require('../checkpoint')

// run() 方法中
async run(userInput, options = {}) {
  const conversationId = options.conversationId || `conv_${Date.now()}`

  // 尝试恢复
  const checkpoint = loadCheckpoint(conversationId)
  if (checkpoint && checkpoint.state.phase !== 'done' && checkpoint.state.phase !== 'idle') {
    console.log(`[Agent] 从检查点恢复: phase=${checkpoint.state.phase}`)
    state = checkpoint.state
    messages = checkpoint.messages
    // 追加新的用户输入
    messages.push({ role: 'user', content: userInput })
  }

  // 在每次工具调用后保存
  // 在 toolResults push 之后:
  saveCheckpoint(conversationId, state, messages)

  // 任务完成后清除检查点
  if (state.phase === 'done') {
    clearCheckpoint(conversationId)
  }
}
```

### 验收标准

- [ ] 执行 crawl_data 时杀进程，重启后自动从爬取完成恢复
- [ ] 执行 expand_script 时断网，重连后从分析完成恢复
- [ ] 任务正常完成后检查点自动清除
- [ ] 检查点文件不超过 1MB（截断过长的 messages）

---

## 实施计划

### 阶段一: 多创作者隔离（预计 1-2 天）

| 步骤 | 文件 | 改动 |
|------|------|------|
| 1 | db/index.js | 新增 accounts 表 + 迁移脚本 |
| 2 | accounts/index.js | 新建，创作者 CRUD |
| 3 | agent/tools/*.js | 工具接收 accountId 参数 |
| 4 | agent/core.js | 构造函数接收 accountId |
| 5 | 前端 SettingsView | 创作者管理 UI |

### 阶段二: RAG 模块（预计 2-3 天）

| 步骤 | 文件 | 改动 |
|------|------|------|
| 1 | npm install vectra | 新增依赖 |
| 2 | rag/embedder.js | 新建，文本向量化 |
| 3 | rag/vectorStore.js | 新建，向量存储 |
| 4 | rag/retriever.js | 新建，检索接口 |
| 5 | rag/indexer.js | 新建，索引构建 |
| 6 | agent/tools/search_similar.js | 新建，检索工具 |
| 7 | agent/processor.js | crawl_data/save_result 后自动索引 |
| 8 | agent/tools/index.js | 注册新工具 |

### 阶段三: 可观测性（预计 1 天）

| 步骤 | 文件 | 改动 |
|------|------|------|
| 1 | observability/tracker.js | 新建，追踪器 |
| 2 | agent/core.js | 接入 tracker |
| 3 | 前端 ChatView | 工具调用可视化 |

### 阶段四: 断点续跑（预计 0.5 天）

| 步骤 | 文件 | 改动 |
|------|------|------|
| 1 | checkpoint.js | 新建，检查点管理 |
| 2 | agent/core.js | 接入保存/恢复 |

### 总计: 约 5-7 天

---

## 风险与注意事项

1. **vectra 兼容性** — vectra 是纯 JS，理论上跨平台，但需要验证 Electron 打包后是否正常
2. **Embedding API 成本** — 每次索引消耗 tokens，需要在 UI 上提示用户
3. **向量索引体积** — 1000 条内容约 50MB，需要监控
4. **旧数据迁移** — account_id 默认值 "default"，确保向后兼容
5. **检查点文件清理** — 需要定期清理过期检查点（7 天以上）

---

## 不做的事

- [ ] 不引入 LangChain/LangGraph
- [ ] 不引入 Python 运行时
- [ ] 不引入外部向量数据库（Qdrant/ChromaDB）
- [ ] 不做分布式工作流
- [ ] 不做 Reranker（第一版不需要）
- [ ] 不做多模态 embedding（文本足够）

---

## 补充: Embedding 多 Provider 策略

### 设计原则

用户自带 API key，embedding 服务应该和 LLM 服务一样灵活：支持多个 provider，可配置，有降级方案。

### 支持的 Embedding Provider

| Provider | API 端点 | 模型 | 中文效果 | 需要的 key |
|----------|---------|------|---------|-----------|
| OpenAI | /v1/embeddings | text-embedding-3-small | 好 | OpenAI key |
| Qwen (通义千问) | /v1/embeddings | text-embedding-v1 | 很好 | DashScope key |
| 本地 BM25 | 无需 API | - | 够用（关键词匹配） | 无 |

### SettingsView 新增配置项

```
Embedding 配置（可选）
├── Provider: [OpenAI] [Qwen] [关闭]
├── API Key: [________________]（和 LLM key 分开）
├── Base URL: [________________]（自定义端点）
└── 模型: [text-embedding-3-small]（可编辑）
```

如果用户选择"关闭"或未配置 key，RAG 自动降级为 BM25 关键词搜索。

### rag/embedder.js 改造

```javascript
// rag/embedder.js
// 支持多 provider + BM25 降级

const loadSettings = require('../config')
const crypto = require('crypto')

class Embedder {
  constructor(config = {}) {
    this.provider = config.embeddingProvider || 'none'
    this.apiKey = config.embeddingApiKey || ''
    this.baseUrl = config.embeddingBaseUrl || ''
    this.model = config.embeddingModel || ''
    this._cache = new Map()
    this._cacheTTL = 10 * 60 * 1000
  }

  // 判断是否可用
  isAvailable() {
    return this.provider !== 'none' && this.apiKey
  }

  // 向量化
  async embed(text) {
    if (!this.isAvailable()) return null

    const hash = this._hash(text)
    const cached = this._cache.get(hash)
    if (cached && Date.now() - cached.ts < this._cacheTTL) return cached.vec

    let vec
    switch (this.provider) {
      case 'openai':
        vec = await this._embedOpenAI(text)
        break
      case 'qwen':
        vec = await this._embedQwen(text)
        break
      default:
        return null
    }

    if (vec) this._cache.set(hash, { vec, ts: Date.now() })
    return vec
  }

  async _embedOpenAI(text) {
    const baseUrl = (this.baseUrl || 'https://api.openai.com').replace(/\/+$/, '')
    const model = this.model || 'text-embedding-3-small'
    return this._callEmbeddingAPI(`${baseUrl}/v1/embeddings`, model, text)
  }

  async _embedQwen(text) {
    const baseUrl = (this.baseUrl || 'https://dashscope.aliyuncs.com/compatible-mode').replace(/\/+$/, '')
    const model = this.model || 'text-embedding-v1'
    return this._callEmbeddingAPI(`${baseUrl}/v1/embeddings`, model, text)
  }

  async _callEmbeddingAPI(url, model, text) {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model,
        input: text.slice(0, 8000),
      }),
    })
    if (!resp.ok) throw new Error(`Embedding API ${resp.status}`)
    const data = await resp.json()
    return data.data[0].embedding
  }

  _hash(str) {
    return crypto.createHash('md5').update(str).digest('hex').slice(0, 16)
  }
}

// BM25 降级方案（纯本地，零 API 调用）
class BM25Search {
  constructor() {
    this.documents = []  // { id, text, tokens }
  }

  addDocument(id, text) {
    const tokens = this._tokenize(text)
    this.documents.push({ id, text, tokens })
  }

  search(query, topK = 10) {
    const queryTokens = this._tokenize(query)
    const scores = this.documents.map(doc => {
      let score = 0
      for (const qt of queryTokens) {
        const tf = doc.tokens.filter(t => t === qt).length
        const df = this.documents.filter(d => d.tokens.includes(qt)).length
        const idf = Math.log((this.documents.length + 1) / (df + 1))
        score += tf * idf
      }
      return { id: doc.id, score, text: doc.text }
    })
    return scores.sort((a, b) => b.score - a.score).slice(0, topK)
  }

  _tokenize(text) {
    // 中文: 按字/词切分; 英文: 按空格
    return text
      .toLowerCase()
      .replace(/[^\u4e00-\u9fa5a-z0-9]/g, ' ')
      .split(/\s+/)
      .filter(t => t.length > 0)
  }
}

module.exports = { Embedder, BM25Search }
```

### rag/retriever.js 改造

```javascript
// 根据 embedding 是否可用，自动选择检索策略
async function retrieve(accountId, queryText, options = {}) {
  const { topK = 10, sourceType, platform } = options

  // 尝试向量检索
  if (embedder.isAvailable()) {
    const queryVec = await embedder.embed(queryText)
    if (queryVec) {
      const results = await searchVectors(accountId, queryVec, topK * 2)
      return results
        .filter(r => !sourceType || r.sourceType === sourceType)
        .filter(r => !platform || r.platform === platform)
        .slice(0, topK)
        .map(r => ({ ...r, method: 'vector' }))
    }
  }

  // 降级: BM25 关键词搜索
  return bm25Search(accountId, queryText, { topK, sourceType, platform })
}
```

### 数据库变更: embedding_config 表

```sql
CREATE TABLE IF NOT EXISTS embedding_config (
  id INTEGER PRIMARY KEY DEFAULT 1,
  provider TEXT DEFAULT 'none',        -- 'none' | 'openai' | 'qwen'
  api_key TEXT DEFAULT '',
  base_url TEXT DEFAULT '',
  model TEXT DEFAULT '',
  updated_at DATETIME DEFAULT (datetime('now','localtime'))
)
```

### 验收标准（追加）

- [ ] 配置 OpenAI embedding key 后，search_similar 返回语义相似结果
- [ ] 配置 Qwen embedding key 后，同样功能正常
- [ ] 未配置任何 key 时，search_similar 降级为 BM25 关键词搜索
- [ ] embedding 调用失败时，自动降级到 BM25
- [ ] embedding 缓存生效，同一文本不重复调 API

---

## 补充: 前端 UI 规格

> UI 实现使用 frontend-design skill，遵循项目现有的暗色主题 + Tailwind CSS + JetBrains Mono 字体体系。

### 阶段一 UI: 多创作者管理

#### 1. 顶栏创作者切换器

位置: 侧边栏顶部，logo 下方

```
┌─────────────────────┐
│  🟢 科技老王 (B站)   │  ← 点击展开创作者列表
│  ▾                   │
├─────────────────────┤
│  科技老王 (B站)      │  ← 当前激活，高亮
│  数码小妹 (抖音)     │
│  生活博主 (小红书)   │
│  ─────────────────  │
│  + 新建创作者        │
└─────────────────────┘
```

设计要点:
- 当前创作者用绿色圆点 + 平台 icon 标识
- 下拉菜单用 backdrop-filter: blur 毛玻璃效果
- 切换创作者时，整个数据视图刷新（带 fade 过渡动画）
- 新建创作者用 + 按钮，点击弹出模态框

#### 2. 创作者管理页（SettingsView 新增 tab）

```
┌─ 设置 ────────────────────────────────┐
│ [API 配置] [创作者管理] [关于]          │
├───────────────────────────────────────┤
│                                       │
│  创作者列表                            │
│  ┌─────────────────────────────────┐  │
│  │ 🟢 科技老王        B站  ⭐  ⋮   │  │
│  │ 数码小妹            抖音  ⭐  ⋮   │  │
│  │ 生活博主          小红书  ⭐  ⋮   │  │
│  └─────────────────────────────────┘  │
│  [+ 添加创作者]                        │
│                                       │
│  创作者详情 (点击展开)                  │
│  ┌─────────────────────────────────┐  │
│  │ 名称: [科技老王          ]       │  │
│  │ 平台: [B站  ▾]                  │  │
│  │ UID:  [440609243        ]       │  │
│  │ 备注: [科技数码测评博主   ]       │  │
│  │ 脚本数: 12  爬取数据: 156 条     │  │
│  │ [保存] [删除]                    │  │
│  └─────────────────────────────────┘  │
└───────────────────────────────────────┘
```

#### 3. 空状态

首次使用时，创作者切换器显示:

```
┌─────────────────────┐
│  未设置创作者         │
│  [点击设置 →]        │
└─────────────────────┘
```

点击跳转到创作者管理页。

---

### 阶段二 UI: RAG 检索面板

#### 1. ChatView 右侧 "参考历史" 面板

位置: ChatView 右侧，可折叠

```
┌─ 创作台 ──────────────────────┬─ 参考历史 ─┐
│                               │            │
│  [聊天消息区域]                │  语义检索   │
│                               │ [搜索框___] │
│                               │            │
│                               │  结果列表   │
│                               │  ┌──────┐  │
│                               │  │相似脚本│  │
│                               │  │0.92  │  │
│                               │  │...   │  │
│                               │  └──────┘  │
│                               │  ┌──────┐  │
│                               │  │爆款标题│  │
│                               │  │0.87  │  │
│                               │  │...   │  │
│                               │  └──────┘  │
│                               │            │
│  [输入框________________]     │  [插入引用] │
└───────────────────────────────┴────────────┘
```

设计要点:
- 面板宽度: 280px，可拖拽调整
- 搜索框: 带 magnifier icon，回车触发搜索
- 结果卡片: 显示相似度分数（进度条）、标题摘要、来源平台
- 点击结果: 展开详情，显示完整内容
- "插入引用" 按钮: 将选中的历史内容插入到当前对话

#### 2. 搜索结果卡片

```
┌──────────────────────────┐
│ 📄 相似脚本        0.92  │  ← 相似度分数用渐变色进度条
│ ═══════════════════════  │
│ 华为Mate70Pro深度体验... │  ← 标题，截断显示
│ 来源: 本地脚本 #12       │
│ 时间: 2026-05-15         │
│ [查看详情] [插入引用]     │
└──────────────────────────┘
```

#### 3. 工具调用中的检索结果展示

当 Agent 调用 search_similar 时，在聊天流中显示:

```
┌──────────────────────────────────┐
│ 🔍 语义检索: "科技测评标题套路"   │
│ 找到 5 条相关内容                  │
│ ┌────────────────────────────┐  │
│ │ 1. 华为Mate70Pro...  0.92  │  │
│ │ 2. 小米14Ultra...    0.88  │  │
│ │ 3. iPhone16测评...   0.85  │  │
│ └────────────────────────────┘  │
│ 已注入 Agent 上下文              │
└──────────────────────────────────┘
```

---

### 阶段三 UI: 可观测性面板

#### 1. ChatView 底部 "执行追踪" 折叠面板

位置: 聊天消息下方，可折叠

```
┌──────────────────────────────────────┐
│ ▶ 执行追踪 (3 步, 4.2s)              │  ← 点击展开
├──────────────────────────────────────┤
│                                      │
│  🔧 crawl_data              +1.2s   │
│  ├─ 平台: bili                       │
│  ├─ UID: 440609243                   │
│  └─ ✅ 成功: 15 条数据               │
│                                      │
│  🧠 LLM 分析              +0.8s     │
│  ├─ 模型: claude-sonnet-4            │
│  └─ tokens: 1,234                    │
│                                      │
│  🔧 expand_script           +2.1s   │
│  ├─ 生成 4 个平台物料                 │
│  └─ ✅ 成功                          │
│                                      │
│  🔄 状态: idle → analyzing → generating │
│                                      │
└──────────────────────────────────────┘
```

设计要点:
- 折叠状态只显示摘要: "3 步, 4.2s"
- 展开后显示完整时间线
- 每个步骤用不同颜色 icon 区分类型
- 失败步骤用红色高亮 + 错误详情
- 状态变化用虚线箭头连接

#### 2. 实时执行指示器

工具调用期间，在输入框上方显示:

```
┌──────────────────────────────────────┐
│ ⏳ 正在爬取 B 站数据... (预计 30s)    │  ← 脉冲动画
└──────────────────────────────────────┘
```

---

### 阶段四 UI: 断点恢复提示

#### 1. 恢复提示条

Agent 启动时，如果检测到未完成的检查点:

```
┌──────────────────────────────────────┐
│ ↩️ 上次对话未完成 (分析阶段)          │
│    2 分钟前保存                       │
│ [继续执行] [重新开始]                 │
└──────────────────────────────────────┘
```

设计要点:
- 提示条在聊天区域顶部，黄色边框
- "继续执行" 按钮: 恢复状态，从断点继续
- "重新开始" 按钮: 清除检查点，从头开始
- 5 秒后自动消失（除非用户 hover）

#### 2. 自动保存指示器

每次工具调用后，在状态栏显示:

```
┌──────────────────────────────────────┐
│ ✅ 进度已自动保存                     │  ← 0.5秒后淡出
└──────────────────────────────────────┘
```

---

### 通用 UI 规范

遵循项目现有风格:
- **背景**: #0a0a0f (最深) / #0d1117 (次深) / #161b22 (卡片)
- **边框**: #21262d (默认) / #30363d (hover)
- **主色**: #e94560 (知更红)
- **成功**: #3fb950 | **警告**: #e3b341 | **错误**: #f85149
- **字体**: JetBrains Mono (代码) / Source Serif 4 (标题)
- **圆角**: 8px (卡片) / 6px (按钮) / 12px (模态框)
- **动效**: 0.2s ease (hover) / 0.3s ease (展开折叠) / fadeIn (新内容)
- **间距**: 16px (卡片间距) / 12px (内边距) / 8px (紧凑间距)

### 组件清单（需新建）

| 组件 | 位置 | 说明 |
|------|------|------|
| AccountSwitcher | 侧边栏顶栏 | 创作者切换下拉 |
| AccountManager | SettingsView tab | 创作者 CRUD |
| SearchPanel | ChatView 右侧 | RAG 检索面板 |
| SearchCard | SearchPanel 内 | 单条搜索结果 |
| ExecutionTimeline | ChatView 底部 | 工具调用时间线 |
| RestoreBanner | ChatView 顶部 | 断点恢复提示 |
| ProgressIndicator | 输入框上方 | 实时执行状态 |

### 保留的现有组件

| 组件 | 保持不变 |
|------|---------|
| Sidebar | 侧边栏导航（加 AccountSwitcher） |
| ChatView | 聊天主区域（加面板和追踪） |
| SettingsView | 设置页（加创作者管理 tab） |
| TopicsView | 灵感库（加 account_id 过滤） |
| DataView | 数据分析（加 account_id 过滤） |

---

## 完整文件变更清单

### 新增文件

| 文件 | 说明 |
|------|------|
| accounts/index.js | 创作者 CRUD |
| rag/embedder.js | 多 provider embedding + BM25 降级 |
| rag/vectorStore.js | vectra 向量存储 |
| rag/retriever.js | 检索接口 |
| rag/indexer.js | 索引构建 |
| agent/tools/search_similar.js | 语义检索工具 |
| observability/tracker.js | 执行追踪器 |
| checkpoint.js | 断点续跑管理 |

### 修改文件

| 文件 | 改动 |
|------|------|
| db/index.js | 新增 accounts / embedding_config 表 + 迁移 |
| agent/core.js | 接入 accountId / tracker / checkpoint |
| agent/processor.js | crawl_data/save_result 后自动索引 |
| agent/tools/index.js | 注册 search_similar |
| agent/tools/crawl_data.js | 接收 accountId |
| agent/tools/crawl_data_batch.js | 接收 accountId |
| agent/tools/query_data.js | account_id 过滤 |
| agent/tools/save_result.js | account_id + 自动索引 |
| agent/tools/suggest_topics.js | account_id 过滤 |
| agent/state.js | 新增 accountId 字段 |
| config/index.js | 新增 embedding 配置 |
| src/components/SettingsView.tsx | 创作者管理 tab + embedding 配置 |
| src/components/ChatView.tsx | 参考历史面板 + 执行追踪 + 恢复提示 |

### 新增依赖

| 包 | 用途 | 体积 |
|---|------|------|
| vectra | 本地向量存储 | ~50KB |

---

## 实施顺序（推荐）

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

# 知更 Agent 重构验收手册

> 每个阶段完成后，按对应章节逐项验收。全部通过再进入下一阶段。

---

## 阶段一验收: 多创作者隔离

### 1.1 基础功能

**测试: 创建创作者**

```bash
cd knower-agent
node -e "
const { createAccount, listAccounts, getActiveAccount } = require('./accounts')
async function test() {
  const id1 = await createAccount({ name: '科技老王', platform: 'bili', uid: '440609243' })
  const id2 = await createAccount({ name: '数码小妹', platform: 'dy', uid: '12345678' })
  console.log('创建:', id1, id2)
  const list = await listAccounts()
  console.log('列表:', list)
  const active = await getActiveAccount()
  console.log('当前:', active)
}
test()
"
```

预期输出:
- 创建: bili_440609243 dy_12345678
- 列表: 2 条记录
- 当前: null（未激活）

**测试: 切换创作者**

```bash
node -e "
const { switchAccount, getActiveAccount, listAccounts } = require('./accounts')
async function test() {
  await switchAccount('bili_440609243')
  console.log('切换后:', await getActiveAccount())
  await switchAccount('dy_12345678')
  console.log('再切换:', await getActiveAccount())
}
test()
"
```

预期: 每次切换后 getActiveAccount 返回对应创作者

### 1.2 数据隔离

**测试: 不同创作者的爬取数据互不影响**

```bash
node -e "
const Agent = require('./agent/core')
const config = require('./config')

async function test() {
  // 用创作者 1 爬取
  const agent1 = new Agent({ ...config, accountId: 'bili_440609243' })
  // 用创作者 2 爬取
  const agent2 = new Agent({ ...config, accountId: 'dy_12345678' })

  // 验证: 各自的 query_data 只返回自己的数据
  // 手动检查数据库
  const { getDb } = require('./db')
  const db = await getDb()
  const res1 = db.exec(\"SELECT COUNT(*) FROM crawl_tasks WHERE account_id = 'bili_440609243'\")
  const res2 = db.exec(\"SELECT COUNT(*) FROM crawl_tasks WHERE account_id = 'dy_12345678'\")
  console.log('创作者1爬取任务:', res1[0].values[0][0])
  console.log('创作者2爬取任务:', res2[0].values[0][0])
}
test()
"
```

预期: 两个数字分别只统计各自 account_id 的数据

**测试: 记忆系统隔离**

```bash
node -e "
const { upsertMemory, getMemories } = require('./db')
async function test() {
  await upsertMemory('bili_440609243', 'style_preference', 'title_style', '专业严谨', '测试')
  await upsertMemory('dy_12345678', 'style_preference', 'title_style', '轻松活泼', '测试')

  const mem1 = await getMemories('bili_440609243')
  const mem2 = await getMemories('dy_12345678')
  console.log('创作者1记忆:', mem1)
  console.log('创作者2记忆:', mem2)
}
test()
"
```

预期: 创作者1 只看到"专业严谨"，创作者2 只看到"轻松活泼"

### 1.3 向后兼容

**测试: 旧数据（account_id=default）仍可访问**

```bash
node -e "
const { listScripts } = require('./db')
const scripts = listScripts(5)
console.log('旧脚本:', scripts.length, '条')
// 确认 account_id 都是 default
"
```

预期: 旧数据正常返回，account_id 为 'default'

### 1.4 前端验收

| 检查项 | 通过条件 |
|--------|---------|
| 顶栏显示创作者切换器 | 显示当前创作者名称和平台 icon |
| 切换创作者后数据刷新 | 切换后爬取数据、脚本、选题全部更新 |
| SettingsView 创作者管理 tab | 能创建/编辑/删除创作者 |
| 空状态提示 | 未设置创作者时显示引导 |
| 旧数据正常显示 | account_id=default 的数据仍可见 |

---

## 阶段二验收: RAG 模块

### 2.1 Embedding 基础

**测试: Embedder 初始化**

```bash
node -e "
const { Embedder, BM25Search } = require('./rag/embedder')

// 测试 1: 无 key 时降级
const e1 = new Embedder({ provider: 'none' })
console.log('无key可用:', e1.isAvailable())  // false

// 测试 2: 有 key 时可用
const e2 = new Embedder({ provider: 'openai', apiKey: 'test-key' })
console.log('有key可用:', e2.isAvailable())  // true

// 测试 3: BM25 降级
const bm25 = new BM25Search()
bm25.addDocument(1, '华为Mate70Pro深度体验评测')
bm25.addDocument(2, '小米14Ultra拍照测试')
bm25.addDocument(3, 'iPhone16Pro对比评测')
const results = bm25.search('华为手机评测', 2)
console.log('BM25结果:', results)
"
```

预期:
- 无key可用: false
- 有key可用: true
- BM25 结果: 第一条是华为相关，分数最高

### 2.2 向量存储

**测试: vectra 写入和查询**

```bash
node -e "
const { upsertVector, searchVectors } = require('./rag/vectorStore')

async function test() {
  // 写入（需要真实 embedding vector，这里用随机向量模拟）
  const fakeVec = Array(1536).fill(0).map(() => Math.random())
  await upsertVector('test_account', 'script_1', '华为Mate70Pro深度体验', {
    _vector: fakeVec,
    sourceType: 'script',
    sourceId: 1,
    text: '华为Mate70Pro深度体验',
  })

  // 查询
  const results = await searchVectors('test_account', fakeVec, 5)
  console.log('查询结果:', results.length, '条')
  console.log('第一条:', results[0])
}
test()
"
```

预期: 查询返回 1 条结果，score 接近 1.0（因为用同一个向量查询）

### 2.3 索引构建

**测试: 爬取后自动索引**

```bash
node -e "
const { indexCrawlBatch } = require('./rag/indexer')

async function test() {
  const mockContents = [
    { id: 1, title: '华为Mate70Pro评测', desc: '深度体验报告', platform: 'bili', video_play_count: 50000, liked_count: 3000 },
    { id: 2, title: '小米14Ultra拍照', desc: '影像旗舰对比', platform: 'bili', video_play_count: 30000, liked_count: 2000 },
  ]
  const count = await indexCrawlBatch('test_account', mockContents)
  console.log('索引完成:', count, '条')
}
test()
"
```

预期: 输出 "索引完成: 2 条"

### 2.4 语义检索

**测试: search_similar 工具**

```bash
node -e "
const searchSimilar = require('./agent/tools/search_similar')

async function test() {
  // 需要先有索引数据
  const result = await searchSimilar.execute.call(
    { accountId: 'test_account' },
    { query: '手机评测', type: 'content', topK: 5 }
  )
  console.log('检索结果:', JSON.stringify(result, null, 2))
}
test()
"
```

预期: 返回 success: true, results 数组非空

### 2.5 降级测试

**测试: 无 embedding key 时自动降级 BM25**

```bash
node -e "
const { retrieve } = require('./rag/retriever')

async function test() {
  // 确保 embedder 不可用
  process.env.EMBEDDING_PROVIDER = 'none'
  const results = await retrieve('test_account', '华为手机', { topK: 5 })
  console.log('降级检索:', results.length, '条')
  console.log('检索方式:', results[0]?.method)  // 应为 'bm25'
}
test()
"
```

预期: 返回 results, method 为 'bm25'

### 2.6 前端验收

| 检查项 | 通过条件 |
|--------|---------|
| SettingsView embedding 配置 | 能选择 provider / 填写 key / 测试连接 |
| ChatView 参考历史面板 | 能搜索、显示结果、查看详情 |
| 搜索结果卡片 | 显示相似度分数、标题摘要、来源 |
| 插入引用按钮 | 点击后将内容插入对话 |
| 工具调用中的检索展示 | Agent 调用 search_similar 时显示结果 |
| 无 key 时降级提示 | 显示"使用关键词搜索模式" |

---

## 阶段三验收: 可观测性

### 3.1 追踪器

**测试: ExecutionTracker 记录事件**

```bash
node -e "
const ExecutionTracker = require('./observability/tracker')

const tracker = new ExecutionTracker()
tracker.trackToolCall('crawl_data', { platform: 'bili', keyword: '手机' })
tracker.trackToolResult('crawl_data', { success: true, totalCount: 15 }, 1200)
tracker.trackStateChange('idle', 'crawling', '开始爬取')
tracker.trackLLMCall('claude-sonnet-4', 1500)

console.log('摘要:', tracker.getSummary())
console.log('显示事件:', tracker.toDisplayEvents())
"
```

预期:
- summary 包含 toolCalls: 1, successes: 1, totalTimeMs > 0
- displayEvents 有 4 条记录，每条有 icon / text / time

### 3.2 前端验收

| 检查项 | 通过条件 |
|--------|---------|
| 执行追踪面板 | 对话完成后显示折叠面板 |
| 展开后时间线 | 每个工具调用显示 icon + 名称 + 耗时 |
| 实时执行指示器 | 工具调用期间显示"正在..."状态 |
| 失败步骤高亮 | 工具失败时显示红色 + 错误详情 |
| 状态变化显示 | 显示 idle → crawling → analyzing 等 |

---

## 阶段四验收: 断点续跑

### 4.1 检查点管理

**测试: 保存和恢复**

```bash
node -e "
const { saveCheckpoint, loadCheckpoint, clearCheckpoint, listCheckpoints } = require('./checkpoint')
const AgentState = require('./agent/state')

// 创建一个中间状态
const state = new AgentState()
state.phase = 'analyzing'
state.script = '测试脚本内容'
state.crawlData = [{ title: '测试数据' }]

// 保存
saveCheckpoint('test_conv_1', state, [{ role: 'user', content: '测试' }])
console.log('保存后:', listCheckpoints())

// 恢复
const restored = loadCheckpoint('test_conv_1')
console.log('恢复状态:', restored.state.phase)
console.log('恢复脚本:', restored.state.script)
console.log('恢复消息数:', restored.messages.length)

// 清除
clearCheckpoint('test_conv_1')
console.log('清除后:', listCheckpoints())
"
```

预期:
- 保存后: 1 个检查点
- 恢复状态: analyzing
- 恢复脚本: 测试脚本内容
- 恢复消息数: 1
- 清除后: 0 个检查点

### 4.2 模拟崩溃恢复

**测试: Agent 执行中断后恢复**

```bash
node -e "
const Agent = require('./agent/core')
const config = require('./config')
const { saveCheckpoint, loadCheckpoint } = require('./checkpoint')
const AgentState = require('./agent/state')

// 模拟: Agent 在 analyzing 阶段崩溃
const state = new AgentState()
state.phase = 'analyzing'
state.script = '测试脚本'
saveCheckpoint('crash_test', state, [{ role: 'user', content: '继续' }])

// 重启后检查
const checkpoint = loadCheckpoint('crash_test')
if (checkpoint && checkpoint.state.phase === 'analyzing') {
  console.log('检测到未完成任务，phase:', checkpoint.state.phase)
  console.log('可以继续执行')
} else {
  console.log('无未完成任务')
}
"
```

预期: 检测到未完成任务，phase 为 analyzing

### 4.3 前端验收

| 检查项 | 通过条件 |
|--------|---------|
| 恢复提示条 | 启动时检测到检查点，显示黄色提示 |
| 继续执行按钮 | 点击后从断点恢复 |
| 重新开始按钮 | 点击后清除检查点 |
| 自动保存指示器 | 工具调用后显示"进度已保存" |
| 任务完成后自动清除 | phase=done 后检查点删除 |

---

## 整体验收清单

### 功能验收

| # | 功能 | 验收方式 | 通过 |
|---|------|---------|------|
| 1 | 创建多个创作者 | accounts/index.js 测试 | [ ] |
| 2 | 切换创作者 | switchAccount 测试 | [ ] |
| 3 | 数据按创作者隔离 | DB 查询验证 | [ ] |
| 4 | 旧数据向后兼容 | listScripts 验证 | [ ] |
| 5 | Embedding 多 provider | embedder.js 测试 | [ ] |
| 6 | BM25 降级 | 无 key 时检索测试 | [ ] |
| 7 | 语义检索 | search_similar 测试 | [ ] |
| 8 | 自动索引 | crawl_data 后验证 | [ ] |
| 9 | 执行追踪 | tracker 测试 | [ ] |
| 10 | 断点保存/恢复 | checkpoint 测试 | [ ] |
| 11 | 创作者管理 UI | 前端操作验证 | [ ] |
| 12 | 检索面板 UI | 前端操作验证 | [ ] |
| 13 | 执行时间线 UI | 前端操作验证 | [ ] |
| 14 | 恢复提示 UI | 前端操作验证 | [ ] |

### 性能验收

| 指标 | 目标 | 测试方式 |
|------|------|---------|
| Embedding 延迟 | < 2s (单条) | 计时 |
| BM25 检索延迟 | < 50ms | 计时 |
| 向量检索延迟 | < 100ms | 计时 |
| 索引构建速度 | > 10 条/秒 | 批量索引计时 |
| 检查点保存 | < 100ms | 计时 |
| 检查点恢复 | < 200ms | 计时 |
| 向量存储体积 | < 100MB (1000条) | 文件大小检查 |

### 兼容性验收

| 环境 | 验收项 |
|------|--------|
| Windows 10/11 | Electron 打包后所有功能正常 |
| macOS | Electron 打包后所有功能正常 |
| 无 embedding key | RAG 降级为 BM25 正常工作 |
| 无创作者设置 | 默认 account_id=default 正常工作 |
| 旧数据库 | 迁移后旧数据不丢失 |
| 无网络 | BM25 本地搜索正常，embedding 报错优雅降级 |

---

## 快速验收脚本

每个阶段完成后，运行对应的一键验收:

```bash
# 阶段一
cd knower-agent && node tests/verify-phase1.js

# 阶段二
cd knower-agent && node tests/verify-phase2.js

# 阶段三
cd knower-agent && node tests/verify-phase3.js

# 阶段四
cd knower-agent && node tests/verify-phase4.js
```

注意: 验收脚本需要在实现阶段创建（tests/ 目录），每个脚本包含对应阶段的所有自动化测试用例。
