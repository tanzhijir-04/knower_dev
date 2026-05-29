# 重构提示词：给 Codex 的 Agent 架构升级指南

将以下内容直接粘贴给 CC 执行。

---

## 任务概述

重构 `knower-agent/agent/core.js`，将当前的 while 循环 ReAct 架构升级为**有状态的条件路由架构**。借鉴 LangGraph 的核心思想（状态机 + 数据流 + 条件路由），但不引入 LangChain/LangGraph 依赖。

## 当前问题

1. **无状态** — 只有一个 `while(true)` 循环，Agent 不知道自己处于什么阶段
2. **数据裸传** — 工具返回的 JSON 直接塞进 messages，没有结构化处理
3. **硬编码路径** — VALID_TOOL_PATHS 写死了 A/B/C/D 四条路径，无法动态调整
4. **串行执行** — 爬取多平台数据只能一个一个来，不能并行
5. **无反馈循环** — Agent 不会根据工具输出调整策略
6. **伪 Human-in-the-loop** — request_user_input 只是弹表单，不是真正的状态暂停

## 重构目标

### 1. 引入 AgentState 类（替代隐式 messages）

创建 `agent/state.js`，定义结构化状态：

```javascript
class AgentState {
  constructor() {
    this.phase = 'idle'           // idle → crawling → analyzing → generating → saving → done
    this.script = null            // 用户提供的脚本
    this.analysis = null          // analyze_script 的结构化输出
    this.materials = null         // expand_script 的结构化输出
    this.crawlData = null         // crawl_data 的结构化输出
    this.crawlStats = null        // 爬取统计
    this.topicSuggestions = null  // suggest_topics 的输出
    this.errors = []              // 错误收集
    this.warnings = []            // 警告信息
    this.userPreferences = {}     // 用户偏好（从 request_user_input 收集）
    this.toolHistory = []         // 工具调用历史
    this.metadata = {
      startTime: Date.now(),
      toolCallCount: 0,
      iterationCount: 0,
      platforms: [],
      targetPlatforms: [],
    }
  }

  // 状态转换检查
  canTransitionTo(newPhase) {
    const transitions = {
      idle: ['crawling', 'analyzing', 'querying', 'suggesting'],
      crawling: ['analyzing', 'idle', 'done'],
      analyzing: ['generating', 'idle', 'done'],
      generating: ['saving', 'idle', 'done'],
      saving: ['idle', 'done'],
      querying: ['idle', 'done'],
      suggesting: ['idle', 'done'],
      done: ['idle'],
    }
    return transitions[this.phase]?.includes(newPhase) ?? false
  }

  transition(newPhase) {
    if (!this.canTransitionTo(newPhase)) {
      throw new Error(`非法状态转换: ${this.phase} -> ${newPhase}`)
    }
    this.phase = newPhase
  }

  // 判断下一步应该做什么
  getNextAction() {
    if (this.errors.length > 0 && this.phase !== 'idle') {
      return { action: 'handle_error', reason: '有未处理的错误' }
    }

    switch (this.phase) {
      case 'idle':
        if (!this.script && !this.crawlData) {
          return { action: 'request_info', reason: '缺少脚本或爬取目标' }
        }
        if (this.script && !this.analysis) {
          return { action: 'analyze', reason: '有脚本但未分析' }
        }
        if (this.crawlData && !this.analysis) {
          return { action: 'analyze_from_data', reason: '有爬取数据但未分析' }
        }
        break

      case 'crawling':
        if (!this.crawlData) {
          return { action: 'wait_crawl', reason: '等待爬取完成' }
        }
        return { action: 'analyze_from_data', reason: '爬取完成，开始分析' }

      case 'analyzing':
        if (!this.analysis) {
          return { action: 'wait_analysis', reason: '等待分析完成' }
        }
        return { action: 'generate', reason: '分析完成，开始生成物料' }

      case 'generating':
        if (!this.materials) {
          return { action: 'wait_generation', reason: '等待生成完成' }
        }
        return { action: 'save', reason: '生成完成，开始保存' }

      case 'saving':
        return { action: 'done', reason: '保存完成' }

      case 'querying':
        return { action: 'done', reason: '查询完成' }

      case 'suggesting':
        return { action: 'done', reason: '建议生成完成' }

      case 'done':
        return { action: 'idle', reason: '任务完成，回到空闲' }
    }

    return { action: 'idle', reason: '无明确下一步' }
  }

  // 序列化（用于 persistence）
  serialize() {
    return JSON.parse(JSON.stringify(this))
  }

  // 反序列化
  static deserialize(data) {
    const state = new AgentState()
    Object.assign(state, data)
    return state
  }
}
```

### 2. 引入数据流处理层

创建 `agent/processor.js`，处理工具原始输出：

```javascript
// 处理工具输出，更新状态
function processToolResult(toolName, rawResult, state) {
  const result = typeof rawResult === 'string' ? JSON.parse(rawResult) : rawResult

  switch (toolName) {
    case 'crawl_data':
      state.crawlData = result.contents || []
      state.crawlStats = result.stats || {}
      state.metadata.platforms.push(result.platform)
      if (state.crawlData.length === 0) {
        state.warnings.push(`${result.platform} 平台暂无数据`)
      }
      break

    case 'query_data':
      state.crawlData = result.videos || result.sources || []
      state.crawlStats = { total: result.totalCount || result.totalSources || 0 }
      break

    case 'analyze_script':
      state.analysis = result.analysis || result
      break

    case 'expand_script':
      state.materials = result.result || result
      break

    case 'suggest_topics':
      state.topicSuggestions = result.topics || []
      break

    case 'save_result':
      state.metadata.saved = true
      state.metadata.savedId = result.id
      break

    case 'request_user_input':
      if (result.data) {
        Object.assign(state.userPreferences, result.data)
      }
      break
  }

  // 记录工具调用历史
  state.toolHistory.push({
    tool: toolName,
    timestamp: Date.now(),
    success: !result.error,
    error: result.error || null,
  })

  state.metadata.toolCallCount++
  return state
}

// 根据状态生成 LLM messages 的上下文注入
function buildContextFromState(state) {
  const parts = []

  if (state.crawlData?.length > 0) {
    parts.push(`## 已爬取的数据\n共 ${state.crawlData.length} 条数据`)
    // 取前 10 条作为示例
    const samples = state.crawlData.slice(0, 10)
    for (const item of samples) {
      parts.push(`- "${item.title}" | 播放: ${item.playCount || 0} | 点赞: ${item.likeCount || 0}`)
    }
  }

  if (state.analysis) {
    parts.push(`## 脚本分析结果\n- 类型: ${state.analysis.videoType}\n- 主题: ${state.analysis.topic}\n- 受众: ${state.analysis.audience}\n- 时长: ${state.analysis.duration}\n- 卖点: ${state.analysis.keyPoints?.join(', ')}`)
  }

  if (state.errors.length > 0) {
    parts.push(`## 遇到的问题\n${state.errors.map(e => `- ${e}`).join('\n')}`)
  }

  if (state.warnings.length > 0) {
    parts.push(`## 注意事项\n${state.warnings.map(w => `- ${w}`).join('\n')}`)
  }

  return parts.join('\n\n')
}

// 生成下一步工具调用建议（给 LLM 参考）
function suggestNextTools(state) {
  const suggestions = []

  switch (state.phase) {
    case 'idle':
      if (!state.script) suggestions.push('request_user_input（请求脚本内容）')
      if (state.script && !state.analysis) suggestions.push('analyze_script（分析脚本）')
      break
    case 'analyzing':
      if (state.analysis && !state.materials) suggestions.push('expand_script（生成物料）')
      break
    case 'generating':
      if (state.materials && !state.metadata.saved) suggestions.push('save_result（保存结果）')
      break
  }

  return suggestions
}

module.exports = { processToolResult, buildContextFromState, suggestNextTools }
```

### 3. 引入条件路由（替代硬编码路径）

修改 `core.js` 中的路由逻辑：

```javascript
// 删除旧的 VALID_TOOL_PATHS 和 checkToolCallOrder

// 替换为：基于状态的条件路由
function determineNextAction(state, llmResponse) {
  // 1. 如果 LLM 明确要调用工具，检查是否合理
  if (llmResponse.stopReason === 'tool_use') {
    const toolBlocks = llmResponse.content.filter(b => b.type === 'tool_use')

    for (const block of toolBlocks) {
      // 检查工具调用是否与当前状态兼容
      if (!isToolCompatibleWithPhase(block.name, state.phase)) {
        console.warn(`[Router] 工具 ${block.name} 在 ${state.phase} 阶段不兼容`)
        // 不阻止调用，但记录警告
        state.warnings.push(`在 ${state.phase} 阶段调用了 ${block.name}，可能不符合预期`)
      }
    }
    return { type: 'execute_tools', tools: toolBlocks }
  }

  // 2. LLM 没有调用工具，根据状态决定下一步
  const next = state.getNextAction()

  switch (next.action) {
    case 'handle_error':
      return { type: 'handle_error', errors: state.errors }
    case 'analyze':
      return { type: 'auto_analyze' }
    case 'generate':
      return { type: 'auto_generate' }
    case 'save':
      return { type: 'auto_save' }
    case 'done':
      return { type: 'done' }
    default:
      return { type: 'continue' }
  }
}

// 工具与阶段兼容性检查
function isToolCompatibleWithPhase(toolName, phase) {
  const compatibility = {
    idle: ['crawl_data', 'query_data', 'suggest_topics', 'request_user_input', 'analyze_script'],
    crawling: ['crawl_data', 'query_data'],
    analyzing: ['analyze_script', 'request_user_input'],
    generating: ['expand_script'],
    saving: ['save_result'],
    querying: ['query_data'],
    suggesting: ['suggest_topics'],
    done: [],
  }
  return compatibility[phase]?.includes(toolName) ?? false
}
```

### 4. 引入并行爬取

修改 `agent/tools/crawl_data.js`，支持批量爬取：

```javascript
// 新增工具：并行爬取多平台
module.exports = {
  name: 'crawl_data_batch',
  description: '并行爬取多个平台的公开数据。当需要同时分析多个平台时使用。',
  input_schema: {
    type: 'object',
    properties: {
      platforms: {
        type: 'array',
        items: { type: 'string', enum: ['bili', 'dy', 'xhs', 'wb'] },
        description: '要爬取的平台列表',
      },
      keyword: { type: 'string', description: '搜索关键词' },
      creatorUid: { type: 'string', description: '创作者 UID' },
      maxNotes: { type: 'number', description: '每个平台最大爬取数量，默认 10' },
    },
    required: ['platforms'],
  },
  async execute({ platforms, keyword, creatorUid, maxNotes }) {
    const { runCrawler } = require('../../lib/crawler')

    const tasks = platforms.map(platform => {
      const options = { maxNotes: maxNotes || 10 }
      if (creatorUid) {
        options.crawlerType = 'creator'
        options.creatorId = creatorUid
      } else if (keyword) {
        options.crawlerType = 'search'
      }
      return runCrawler(platform, keyword || '', options).then(
        result => ({ platform, success: true, data: result }),
        error => ({ platform, success: false, error: error.message })
      )
    })

    const results = await Promise.allSettled(tasks)

    return {
      success: true,
      results: results.map(r => r.value || r.reason),
      totalCount: results.reduce((sum, r) => {
        const data = r.value?.data?.stats?.total_contents || 0
        return sum + data
      }, 0),
    }
  },
}
```

### 5. 重构 Agent 主循环

重写 `core.js` 的 `run` 和 `stream` 方法：

```javascript
async run(userInput, options = {}) {
  const { onToolCall, onText } = options

  // 1. 初始化状态
  const state = new AgentState()
  state.metadata.targetPlatforms = options.platforms || ['bilibili', 'douyin', 'xiaohongshu']

  // 2. 构建初始 messages
  const messages = [{ role: 'user', content: userInput }]
  const systemPrompt = await buildSystemPrompt()

  // 3. 主循环（有最大迭代限制）
  let iterations = 0
  while (iterations < MAX_ITERATIONS) {
    iterations++
    state.metadata.iterationCount = iterations

    // 3.1 构建带上下文的 system prompt
    const contextFromState = buildContextFromState(state)
    const fullPrompt = contextFromState
      ? systemPrompt + '\n\n' + contextFromState
      : systemPrompt

    // 3.2 调用 LLM
    const response = await this.client.chat({
      system: fullPrompt,
      messages,
      tools,
      maxTokens: this.maxTokens,
      temperature: this.temperature,
    })

    this._trackUsage(response.usage)

    // 3.3 处理 LLM 输出
    for (const block of response.content) {
      if (block.type === 'text' && onText) {
        onText(block.text)
      }
    }

    // 3.4 判断下一步
    const nextAction = determineNextAction(state, response)

    switch (nextAction.type) {
      case 'execute_tools':
        // 执行工具
        messages.push({ role: 'assistant', content: response.content })
        const toolResults = []

        for (const block of nextAction.tools) {
          if (onToolCall) onToolCall(block.name, block.input)

          const tool = tools.find(t => t.name === block.name)
          let result

          if (tool) {
            try {
              result = await executeWithTimeout(
                () => executeToolWithRetry(tool, block.input),
                getToolTimeout(block.name)
              )
              if (result.formRequest) {
                const formData = await new Promise(resolve => {
                  this._pendingFormResolve = resolve
                })
                result = { success: true, data: formData }
              }
            } catch (err) {
              result = { error: err.message }
              state.errors.push(`${block.name} 执行失败: ${err.message}`)
            }
          } else {
            result = { error: `Unknown tool: ${block.name}` }
          }

          // 4. 处理工具结果，更新状态
          processToolResult(block.name, result, state)

          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: JSON.stringify(result),
          })
        }

        messages.push({ role: 'user', content: toolResults })
        break

      case 'handle_error':
        // 错误处理：告诉用户遇到了什么问题
        const errorText = response.content.filter(b => b.type === 'text').map(b => b.text).join('\n')
        return errorText || '任务执行遇到了一些问题，请重试。'

      case 'auto_analyze':
      case 'auto_generate':
      case 'auto_save':
        // 自动执行下一步（让 LLM 自己决定调用哪个工具）
        // 这里不需要额外处理，LLM 会在下一轮自行决定
        break

      case 'done':
        const finalText = response.content.filter(b => b.type === 'text').map(b => b.text).join('\n')
        return finalText

      case 'continue':
        // 继续循环
        break
    }
  }

  // 超过最大迭代次数
  return '抱歉，任务执行步骤过多，已自动终止。请尝试简化你的请求。'
}
```

### 6. 优化系统提示词

在系统提示词中加入状态感知：

```javascript
const OPTIMIZED_SYSTEM_PROMPT = `你是知更 AI，一个专为中文视频创作者服务的智能助手。

## 你的工作模式

你在一个有状态的工作流中运行。系统会跟踪你的进度，你不需要自己管理状态。

### 工作阶段
- **idle**: 空闲，等待用户指令
- **crawling**: 正在爬取平台数据
- **analyzing**: 正在分析脚本或数据
- **generating**: 正在生成各平台物料
- **saving**: 正在保存结果

### 上下文信息
系统会在每次调用时提供当前状态的上下文信息（已爬取的数据、分析结果等），请基于这些信息做决策，不要重复调用已经完成的工具。

## 工具检查流程

收到用户消息后，检查当前状态上下文：
1. 如果上下文中有爬取数据 → 直接分析，不要重新爬取
2. 如果上下文中有分析结果 → 直接生成物料，不要重新分析
3. 如果上下文中有物料 → 直接保存，不要重新生成
4. 如果缺少必要信息 → 调用 request_user_input 请求

## 红旗表

- "用户没给UID，我猜一个" -> 不要猜，调用 request_user_input
- "我知道这个UP主的数据" -> 你不知道，看上下文中有没有爬取数据
- "脚本我理解了，直接生成物料" -> 先调用 analyze_script，即使你觉得自己理解了
- "数据是空的，我编一些" -> 绝对禁止编造数据
- "这次不保存了吧" -> 必须保存，除非用户明确说不要

## 工具调用规则

- 一次只调用一个工具，不要同时调用多个
- 调用前检查：这个工具在当前阶段是否合理？
- 调用后检查：结果是否符合预期？是否需要调整策略？

## 回复风格

- 口语化、有温度，像一个懂创作的朋友
- 分析类回复要数据驱动，引用具体数字
- 物料类回复要实用可执行，用户能直接复制使用
- 不要用 Markdown 表格展示物料

## 各平台规范

### B站
- 标题：<=80字，专业感+信息量
- 描述：<=200字
- 标签：5-8个

### YouTube
- 标题：<=60字符，SEO友好
- 描述：前两行最关键，含时间戳
- 标签：5-15个，中英混合

### 抖音
- 标题：<=55字，口语化有冲击力
- 前3秒钩子必须有
- 标签：3-5个

### 小红书
- 标题：<=20字，必须带emoji
- 正文：口语化，像朋友聊天
- 标签：5-8个`
```

## 文件变更清单

| 操作 | 文件 | 说明 |
|------|------|------|
| 新增 | `agent/state.js` | AgentState 类 |
| 新增 | `agent/processor.js` | 数据流处理层 |
| 新增 | `agent/router.js` | 条件路由逻辑 |
| 新增 | `agent/tools/crawl_data_batch.js` | 并行爬取工具 |
| 修改 | `agent/core.js` | 重写主循环，使用新的 state/processor/router |
| 修改 | `agent/tools/index.js` | 注册新工具 |
| 修改 | `agent/tools/crawl_data.js` | 优化 description |
| 修改 | `agent/tools/query_data.js` | 优化 description |
| 修改 | `agent/tools/analyze_script.js` | 优化 description |
| 修改 | `agent/tools/expand_script.js` | 优化 description |
| 修改 | `agent/tools/save_result.js` | 优化 description |
| 修改 | `agent/tools/suggest_topics.js` | 优化 description |
| 修改 | `agent/tools/request_user_input.js` | 优化 description |

## 验证步骤

1. **基础功能测试**：运行 `node run.js`，用示例脚本测试，确认能正常生成物料
2. **状态转换测试**：观察日志，确认 phase 从 idle → analyzing → generating → saving 正确转换
3. **并行爬取测试**：调用 crawl_data_batch，确认 4 个平台同时爬取
4. **错误处理测试**：模拟工具失败，确认 state.errors 正确收集
5. **Human-in-the-loop 测试**：测试 request_user_input 是否能正确暂停和恢复

## 注意事项

1. **向后兼容**：保留原有的工具接口，不要破坏现有功能
2. **渐进式重构**：可以先引入 state.js 和 processor.js，再逐步替换 core.js
3. **不要引入新依赖**：所有功能用原生 Node.js 实现
4. **保持流式输出**：stream 方法要保留，状态更新要实时 yield
5. **测试覆盖**：至少覆盖正常流程、错误流程、并行爬取三个场景