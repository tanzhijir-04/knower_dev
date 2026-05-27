# 知更 Knower · 下一阶段规划：Agent 框架优化 + 自动化测试

**日期** 2025-05-25  
**目标** 让 Agent 更智能、更健壮；让 CC 能自动化验证所有功能

---

## 当前 Agent 架构分析

### 已有

```
knower-agent/
├── agent/
│   ├── core.js              ← ReAct 主循环（233行）
│   └── tools/
│       ├── analyze_script.js
│       ├── expand_script.js
│       ├── crawl_data.js
│       ├── query_data.js
│       ├── request_user_input.js
│       ├── save_result.js
│       └── suggest_topics.js
├── llm/
│   ├── index.js             ← 工厂函数
│   ├── anthropic.js         ← Anthropic 适配器
│   └── openai-compat.js     ← OpenAI 兼容适配器
├── db/index.js              ← SQLite（sql.js）
├── config/index.js
├── lib/crawler.js           ← MediaCrawler 封装
└── run.js                   ← stdin/stdout JSON 流
```

### 问题

| 问题 | 严重度 | 说明 |
|---|---|---|
| 无错误恢复 | P0 | 工具调用失败后 Agent 直接报错，不会重试或换方案 |
| 无任务规划 | P1 | Agent 不会分解复杂任务，一次性塞所有步骤 |
| 无自我评估 | P1 | Agent 不会检查自己的输出是否合理 |
| 无对话记忆 | P1 | 每次对话独立，不记得上一轮聊了什么 |
| 无工具结果缓存 | P2 | 同样数据重复查询/爬取 |
| 无超时控制 | P2 | 爬虫或 LLM 调用可能无限等待 |
| 无并发保护 | P2 | 多次快速发送可能导致状态混乱 |
| 测试为零 | P0 | 没有任何自动化测试 |

---

## 一、Agent 框架优化

### 1.1 错误恢复机制（P0）

**问题**：工具调用失败后 Agent 直接把错误信息返回给用户，不会尝试修复。

**方案**：在 `core.js` 的工具执行中增加重试 + 错误分类 + Agent 自主决策。

#### 改动文件

`knower-agent/agent/core.js`

#### 实现

```javascript
// 工具执行增加重试和错误处理
async function executeToolWithRetry(tool, input, maxRetries = 2) {
  let lastError = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await tool.execute(input)

      // 如果工具返回错误标记，判断是否可重试
      if (result.error) {
        const retryable = isRetryableError(result.error)
        if (retryable && attempt < maxRetries) {
          console.log(`[Agent] Tool "${tool.name}" returned error, retrying (${attempt + 1}/${maxRetries}): ${result.error}`)
          await sleep(1000 * (attempt + 1))  // 指数退避
          continue
        }
      }

      return result
    } catch (err) {
      lastError = err
      const retryable = isRetryableError(err.message)
      if (retryable && attempt < maxRetries) {
        console.log(`[Agent] Tool "${tool.name}" threw, retrying (${attempt + 1}/${maxRetries}): ${err.message}`)
        await sleep(1000 * (attempt + 1))
        continue
      }
    }
  }

  // 所有重试都失败
  return { error: lastError?.message || '工具执行失败', retryable: false }
}

function isRetryableError(message) {
  const retryablePatterns = [
    'timeout', 'ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED',
    'rate limit', '429', '503', '502',
    'network', 'fetch failed',
  ]
  return retryablePatterns.some(p => message.toLowerCase().includes(p.toLowerCase()))
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}
```

在 `stream()` 方法中替换工具执行：

```javascript
// 旧
result = await tool.execute(input)

// 新
result = await executeToolWithRetry(tool, input)
```

#### Agent 自主错误处理

在系统提示词中增加错误处理指引：

```
### 5. 错误处理

当工具调用失败时：
- 网络超时/限流 → 告诉用户"平台暂时繁忙，稍后再试"，不要重试
- 爬取失败 → 检查是否需要登录，提示用户
- 数据为空 → 说明该来源暂无数据，建议换关键词或平台
- LLM 调用失败 → 简要说明错误，建议用户检查 API Key
- 不要把技术错误细节暴露给用户，用友好的语言描述
```

### 1.2 任务规划器（P1）

**问题**：Agent 面对复杂任务（如"分析这个UP主并给我选题建议"）时，不会分步执行。

**方案**：在系统提示词中增加任务分解指引，让 Agent 先规划再执行。

#### 系统提示词新增

```
### 6. 任务规划

收到复杂任务时，先在内部规划步骤，再逐步执行：

示例："分析B站UP主 440609243 并给出选题建议"
规划：
1. crawl_data 爬取该UP主数据
2. 基于数据分析内容特征
3. 结合分析结果给出选题建议

示例："帮我分析这段脚本并生成物料，然后保存"
规划：
1. 分析脚本内容
2. 生成各平台物料
3. 调用 save_result 保存
4. 输出总结

执行时每一步都要等上一步完成后再进行。
```

### 1.3 自我评估（P1）

**问题**：Agent 不会检查自己的输出是否合理。

**方案**：在系统提示词中增加自检规则。

#### 系统提示词新增

```
### 7. 输出自检

生成回复前，内部检查：
- 分析类回复：是否引用了具体数据？数据是否来自工具返回（非编造）？
- 物料类回复：标题字数是否符合平台规范？标签是否相关？
- 选题建议：是否基于用户实际数据？建议是否具体可执行？
- 如果自检不通过，修正后再输出
```

### 1.4 对话记忆（P1）

**问题**：每次对话独立，Agent 不记得上一轮聊了什么。

**方案**：在 `agent-run` handler 中，将最近 5 轮对话历史注入到 prompt 中。

#### 改动文件

`electron/main.ts` — `agent-run` handler

```typescript
ipcMain.handle('agent-run', async (event, script: string, platforms: string[], conversationId?: number) => {
  // ... 现有代码 ...

  // 获取最近对话历史（最多 5 轮）
  let historyContext = ''
  if (conversationId) {
    const messages = await db.getMessages(conversationId)
    const recent = messages.slice(-10)  // 最近 10 条（5轮对话）
    if (recent.length > 0) {
      historyContext = recent.map(m => {
        const role = m.role === 'user' ? '用户' : '助手'
        const content = m.content.slice(0, 500)  // 截断避免过长
        return `${role}：${content}`
      }).join('\n')
    }
  }

  let prompt = script
  if (historyContext) {
    prompt = `## 最近对话记录\n${historyContext}\n\n## 当前请求\n${script}`
  }

  // ... 后续代码 ...
})
```

#### 前端改动

`ChatView.tsx` — 发送消息时传入 conversationId：

```tsx
await api.runAgent(userContent, platforms, conversationId || undefined)
```

#### preload.ts 改动

```typescript
runAgent: (script: string, platforms: string[], conversationId?: number) =>
  ipcRenderer.invoke('agent-run', script, platforms, conversationId),
```

### 1.5 工具结果缓存（P2）

**问题**：同样数据重复查询。

**方案**：在 Agent 中增加简单的内存缓存。

```javascript
// agent/cache.js
const cache = new Map()
const TTL = 5 * 60 * 1000  // 5 分钟

function getCached(key) {
  const item = cache.get(key)
  if (!item) return null
  if (Date.now() - item.timestamp > TTL) {
    cache.delete(key)
    return null
  }
  return item.data
}

function setCache(key, data) {
  cache.set(key, { data, timestamp: Date.now() })
}

module.exports = { getCached, setCache }
```

在 `query_data` 工具中使用：

```javascript
const { getCached, setCache } = require('../cache')

// execute 中
const cacheKey = `query:${platform}:${sourceUid || 'all'}`
const cached = getCached(cacheKey)
if (cached) return cached

const result = { /* ... */ }
setCache(cacheKey, result)
return result
```

### 1.6 超时控制（P2）

**问题**：爬虫或 LLM 调用可能无限等待。

**方案**：

```javascript
// 工具执行超时
async function executeWithTimeout(fn, timeoutMs = 60000) {
  return Promise.race([
    fn(),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('操作超时')), timeoutMs)
    ),
  ])
}

// 在工具执行中使用
result = await executeWithTimeout(
  () => executeToolWithRetry(tool, input),
  tool.name === 'crawl_data' ? 120000 : 30000  // 爬虫 2分钟，其他 30秒
)
```

### 1.7 并发保护（P2）

**问题**：用户快速多次发送消息导致状态混乱。

**方案**：在 `agent-run` handler 中加锁。

```typescript
let agentLock = false

ipcMain.handle('agent-run', async (event, script, platforms, conversationId) => {
  if (agentLock) {
    return { error: 'Agent 正在处理中，请稍候' }
  }
  agentLock = true

  try {
    // ... 现有逻辑 ...
  } finally {
    agentLock = false
  }
})
```

---

## 二、自动化测试

### 2.1 测试框架选型

| 层 | 工具 | 说明 |
|---|---|---|
| 单元测试 | **Vitest** | 快速、ESM 原生支持、与 Vite 集成 |
| Agent 集成测试 | **Vitest** + 手写 mock | 测试 Agent 工具调用流程 |
| 爬虫测试 | **Node.js 脚本** | 手动/半自动验证各平台 |
| E2E 测试 | **Playwright**（Electron 模式） | 测试完整 UI 交互 |

### 2.2 安装

```bash
# 前端 + Agent 单元测试
npm install -D vitest @testing-library/react @testing-library/jest-dom jsdom

# E2E 测试
npm install -D @playwright/test
```

### 2.3 Agent 工具单元测试

**文件**：`knower-agent/agent/tools/__tests__/`

#### save_result.test.js

```javascript
import { describe, it, expect, beforeEach } from 'vitest'
import { saveScript, listScripts, getScript } from '../../../db'

describe('save_result tool', () => {
  it('should save script and return id', async () => {
    const tool = require('../save_result')
    const result = await tool.execute({
      script: '测试脚本内容',
      analysis: { videoType: '科技测评', topic: '测试', audience: '数码爱好者', duration: '5分钟', keyPoints: ['测试1'] },
      result: { bilibili: { title: 'B站标题', tags: ['test'] } },
    })
    expect(result.success).toBe(true)
    expect(result.id).toBeGreaterThan(0)
  })

  it('should handle missing required fields', async () => {
    const tool = require('../save_result')
    const result = await tool.execute({ script: '只有脚本' })
    // 应该能处理缺失字段
  })
})
```

#### crawl_data.test.js

```javascript
import { describe, it, expect } from 'vitest'

describe('crawl_data tool', () => {
  it('should have correct schema', () => {
    const tool = require('../crawl_data')
    expect(tool.name).toBe('crawl_data')
    expect(tool.input_schema.required).toContain('platform')
  })

  it('should return error for missing params', async () => {
    const tool = require('../crawl_data')
    const result = await tool.execute({ platform: 'bili' })
    // 既没有 keyword 也没有 creatorUid，应该返回错误提示
    expect(result.error || result.success === false).toBeTruthy()
  })
})
```

#### query_data.test.js

```javascript
import { describe, it, expect } from 'vitest'

describe('query_data tool', () => {
  it('should return source list', async () => {
    const tool = require('../query_data')
    const result = await tool.execute({ platform: 'bili' })
    expect(result.success).toBe(true)
    expect(Array.isArray(result.sources)).toBe(true)
  })

  it('should return videos by source', async () => {
    const tool = require('../query_data')
    const result = await tool.execute({ platform: 'bili', sourceUid: 'test_uid' })
    expect(result.success).toBe(true)
    expect(Array.isArray(result.videos)).toBe(true)
  })
})
```

### 2.4 Agent 集成测试

**文件**：`knower-agent/agent/__tests__/core.test.js`

```javascript
import { describe, it, expect, vi } from 'vitest'

describe('Agent core', () => {
  it('should detect analyze intent', async () => {
    // Mock LLM 返回
    const mockResponse = {
      content: [{ type: 'text', text: '我来帮你分析这个UP主' }],
      stop_reason: 'end_turn',
    }

    // 测试意图识别（通过系统提示词）
    const { BASE_SYSTEM_PROMPT } = require('../core')
    expect(BASE_SYSTEM_PROMPT).toContain('分析创作者')
    expect(BASE_SYSTEM_PROMPT).toContain('crawl_data')
  })

  it('should have all required tools registered', () => {
    const { tools } = require('../tools')
    const toolNames = tools.map(t => t.name)
    expect(toolNames).toContain('save_result')
    expect(toolNames).toContain('crawl_data')
    expect(toolNames).toContain('query_data')
    expect(toolNames).toContain('request_user_input')
  })

  it('should build system prompt with memories', async () => {
    // 这个测试需要 mock getMemories
  })
})
```

### 2.5 爬虫集成测试

**文件**：`knower-agent/crawler/test_crawler.js`（已在 `cc_file_and_crawl.md` 中定义）

### 2.6 E2E 测试

**文件**：`tests/e2e/`

#### chat.spec.ts

```typescript
import { test, expect, _electron as electron } from '@playwright/test'

test.describe('创作台', () => {
  let app: any

  test.beforeAll(async () => {
    app = await electron.launch({ args: ['.'] })
  })

  test.afterAll(async () => {
    await app.close()
  })

  test('should show welcome page', async () => {
    const window = await app.firstWindow()
    const title = await window.textContent('h1')
    expect(title).toContain('知更')
  })

  test('should send message and receive response', async () => {
    const window = await app.firstWindow()

    // 输入消息
    await window.fill('textarea', '你好')
    await window.click('button[title="发送"]')

    // 等待回复
    await expect(window.locator('.msg-assistant')).toBeVisible({ timeout: 30000 })
  })

  test('should show sidebar with conversations', async () => {
    const window = await app.firstWindow()
    await expect(window.locator('text=最近对话')).toBeVisible()
  })
})
```

#### settings.spec.ts

```typescript
import { test, expect, _electron as electron } from '@playwright/test'

test.describe('设置页', () => {
  test('should save API settings', async () => {
    const app = await electron.launch({ args: ['.'] })
    const window = await app.firstWindow()

    // 导航到设置
    await window.click('text=设置')

    // 填写 API Key
    await window.fill('input[placeholder="sk-..."]', 'test-key-123')
    await window.click('text=保存设置')

    // 验证保存成功
    await expect(window.locator('text=已保存')).toBeVisible()

    await app.close()
  })
})
```

### 2.7 测试配置

**vitest.config.ts**（根目录）：

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['knower-agent/**/__tests__/**/*.test.js'],
    exclude: ['**/node_modules/**', '**/crawler/.venv/**'],
  },
})
```

**playwright.config.ts**（根目录）：

```typescript
import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60000,
  use: {
    headless: true,
  },
})
```

### 2.8 package.json 新增脚本

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "test:crawler": "node knower-agent/crawler/test_crawler.js"
  }
}
```

---

## 三、执行计划

### 第一批：测试基础设施（1天）

| 任务 | 说明 | 预估 |
|---|---|---|
| 安装 Vitest + 配置 | vitest.config.ts + package.json | 30min |
| Agent 工具单元测试 | save_result / crawl_data / query_data | 2h |
| Agent 核心集成测试 | 意图识别 / 工具注册 / Prompt 构建 | 2h |
| 爬虫测试脚本 | test_crawler.js | 1h |

### 第二批：Agent 框架优化（2天）

| 任务 | 说明 | 预估 |
|---|---|---|
| 错误恢复机制 | 重试 + 错误分类 + 指数退避 | 3h |
| 对话记忆注入 | 最近 5 轮历史注入 prompt | 2h |
| 超时控制 | 工具执行超时 + Agent 整体超时 | 1h |
| 并发保护 | agentLock 防重复发送 | 30min |
| 工具结果缓存 | 5分钟 TTL 内存缓存 | 1h |
| 系统提示词增强 | 任务规划 + 自检 + 错误处理指引 | 2h |

### 第三批：E2E 测试（1天）

| 任务 | 说明 | 预估 |
|---|---|---|
| Playwright E2E 配置 | playwright.config.ts + Electron 启动 | 1h |
| 创作台 E2E 测试 | 发消息 / 收回复 / 侧边栏 | 3h |
| 设置页 E2E 测试 | 保存配置 / 读取配置 | 1h |
| 数据分析页 E2E 测试 | 爬取 / 查看 / 导出 | 2h |

### 第四批：CI/CD（半天）

| 任务 | 说明 | 预估 |
|---|---|---|
| GitHub Actions 配置 | push 时自动运行 vitest | 1h |
| 测试报告 | 生成测试覆盖率报告 | 30min |

---

## 四、测试运行命令

```bash
# 单元测试
npm test                    # 运行所有 Vitest 测试
npm run test:watch          # 监听模式

# 爬虫测试
npm run test:crawler        # 验证各平台爬取

# E2E 测试
npm run test:e2e            # 运行 Playwright E2E

# 全部测试
npm test && npm run test:crawler && npm run test:e2e
```

---

## 五、CC 执行提示词

以下是给 CC 的执行入口提示词：

### 任务 1：搭建测试基础设施

```bash
cd C:\Users\20300\Desktop\knower_dev
npm install -D vitest
# 创建 vitest.config.ts
# 创建 knower-agent/agent/tools/__tests__/ 目录
# 编写 save_result.test.js, crawl_data.test.js, query_data.test.js
# 运行 npm test 验证
```

### 任务 2：Agent 框架优化

```bash
# 修改 knower-agent/agent/core.js：
# 1. 增加 executeWithTimeout 函数
# 2. 增加 isRetryableError 函数
# 3. 工具执行改用 executeToolWithRetry
# 4. 系统提示词增加任务规划 + 自检 + 错误处理

# 修改 electron/main.ts：
# 1. agent-run handler 增加 conversationId 参数
# 2. 获取最近 10 条消息注入 prompt
# 3. 增加 agentLock 并发保护

# 修改 electron/preload.ts：
# 1. runAgent 增加 conversationId 参数
```

### 任务 3：爬虫验证

```bash
# 创建 knower-agent/crawler/test_crawler.js
# 运行 node knower-agent/crawler/test_crawler.js
# 记录各平台测试结果
# 修复发现的问题
```

### 任务 4：E2E 测试

```bash
npm install -D @playwright/test
npx playwright install chromium
# 创建 tests/e2e/chat.spec.ts
# 创建 tests/e2e/settings.spec.ts
# 运行 npm run test:e2e 验证
```

---

*知更 Knower · 下一阶段规划 v1.0*
