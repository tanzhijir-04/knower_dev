const { createClient } = require('../llm')
const { tools } = require('./tools')
const { getMemories } = require('../db')
const { getCached, setCache } = require('./cache')
const AgentState = require('./state')
const { processToolResult, buildContextFromState, suggestNextTools } = require('./processor')
const { determineNextAction } = require('./router')
const ExecutionTracker = require('../observability/tracker')
const { saveCheckpoint, loadCheckpoint, clearCheckpoint, cleanupOldCheckpoints } = require('../checkpoint')

const MAX_ITERATIONS = 10
const PROMPT_CACHE_KEY = 'system_prompt'

// ============================================================
//  工具函数
// ============================================================

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function isRetryableError(message) {
  const retryablePatterns = [
    'timeout', 'ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED',
    'rate limit', '429', '503', '502',
    'network', 'fetch failed',
  ]
  return retryablePatterns.some(p => message.toLowerCase().includes(p.toLowerCase()))
}

async function executeToolWithRetry(tool, input, maxRetries = 2) {
  let lastError = null

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const result = await tool.execute(input)
      if (result.error) {
        const retryable = isRetryableError(result.error)
        if (retryable && attempt < maxRetries) {
          console.log(`[Agent] Tool "${tool.name}" returned retryable error (${attempt + 1}/${maxRetries}): ${result.error}`)
          await sleep(1000 * (attempt + 1))
          continue
        }
      }
      return result
    } catch (err) {
      lastError = err
      const retryable = isRetryableError(err.message)
      if (retryable && attempt < maxRetries) {
        console.log(`[Agent] Tool "${tool.name}" threw retryable error (${attempt + 1}/${maxRetries}): ${err.message}`)
        await sleep(1000 * (attempt + 1))
        continue
      }
    }
  }
  return { error: lastError?.message || '工具执行失败', retryable: false }
}

async function executeWithTimeout(fn, timeoutMs = 60000) {
  return Promise.race([
    fn(),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('操作超时')), timeoutMs)
    ),
  ])
}

function getToolTimeout(toolName) {
  if (toolName === 'crawl_data' || toolName === 'crawl_data_batch') return 120000
  return 30000
}

// ============================================================
//  系统提示词
// ============================================================

const BASE_SYSTEM_PROMPT = `你是知更 AI，一个专为中文视频创作者服务的智能助手。

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
- 标签：5-8个

## 去 AI 味写作规范（humanizer-zh）

你生成的所有文本内容（物料、回复、分析）必须遵循以下规则，消除 AI 生成痕迹：

### 绝对禁止
- 禁止使用"值得注意的是"、"首先...其次...最后"、"总而言之"、"综上所述"、"不难发现"
- 禁止使用"在当今...的大背景下"、"随着...的发展"、"可以说"、"毋庸置疑"
- 禁止使用"让我们"、"接下来让我们一起"、"你准备好了吗"
- 禁止使用"赋能"、"助力"、"打造"、"解锁"、"开启"等互联网黑话
- 禁止使用"全方位"、"多维度"、"深层次"、"战略性"等空洞大词
- 禁止使用连续排比句式（三个以上的"xxx，xxx，xxx"）
- 禁止使用"首先...其次...再次...最后"的四段论结构

### 必须做到
- 用具体数字代替模糊表述："效果不错" → "转化率提升了 23%"
- 用口语化短句，每句话不超过 25 个字
- 用真实场景代替抽象概念："提升用户体验" → "用户刷到你的视频会多停留 3 秒"
- 用反问或设问代替陈述："这个方法很有效" → "你知道为什么这类视频播放量高吗？"
- 标题和正文要有"人味"，像一个真实的创作者在分享经验
- 适当使用不完美的表达：加入语气词（"说实话"、"其实吧"、"你想想"）
- 物料中的标签要接地气，不要用太官方的分类词

### 语气参照
- B站：像一个 UP 主在跟弹幕聊天
- 抖音：像朋友发语音消息一样简短有力
- 小红书：像在评论区跟闺蜜分享好物
- YouTube：像一个专业但不严肃的知识博主`

async function buildSystemPrompt(opts = {}) {
  const { accountId = 'default', contentStyle = '', scriptDuration = '', defaultLanguage = '',
          accountName = '', accountPlatform = '', accountUid = '' } = opts
  const cacheKey = PROMPT_CACHE_KEY + ':' + [accountId, contentStyle, scriptDuration, defaultLanguage, accountName, accountPlatform, accountUid].join('|')
  const cached = getCached(cacheKey)
  if (cached) return cached

  try {
    const memories = await getMemories(accountId)
    let prompt = BASE_SYSTEM_PROMPT

    // 注入创作者身份
    if (accountName) {
      const platformMap = { bili: 'B站', dy: '抖音', xhs: '小红书', wb: '微博' }
      const platformLabel = platformMap[accountPlatform] || accountPlatform
      prompt += `\n\n## 当前创作者身份\n你正在为 **${accountName}**（${platformLabel}，UID: ${accountUid}）服务。所有分析、建议和物料生成都应基于这个创作者的定位和风格。`
      if (accountPlatform) {
        prompt += `\n当前运营平台为 **${platformLabel}**，用户要求爬取数据时应优先使用此平台（${accountPlatform}），不需要询问用户选择平台。`
      }
    }

    if (memories.length) {
      const groups = {}
      const typeLabels = {
        style_preference: '风格偏好',
        content_pattern: '内容规律',
        platform_habit: '平台习惯',
      }

      for (const mem of memories) {
        const label = typeLabels[mem.type] || mem.type
        if (!groups[label]) groups[label] = []
        groups[label].push(`- ${mem.value}（依据：${mem.evidence}）`)
      }

      let section = '\n\n## 关于这位创作者的已知偏好\n'
      for (const [label, items] of Object.entries(groups)) {
        section += `\n### ${label}\n${items.join('\n')}\n`
      }
      prompt += section
    }

    if (contentStyle) {
      const styleMap = {
        '专业严谨': '用专业、严谨的语气，注重数据和逻辑，避免口语化表达。',
        '轻松活泼': '用轻松、活泼的语气，像朋友聊天一样自然，可以适当使用口语。',
        '故事化': '用讲故事的方式表达，注重叙事节奏和情感起伏，让内容有代入感。',
        '知识科普': '用知识科普的风格，注重信息密度和准确性，条理清晰。',
        '情感共鸣': '用能引起情感共鸣的方式表达，注重情感连接和价值观传递。',
      }
      const styleDirective = styleMap[contentStyle]
      if (styleDirective) {
        prompt += `\n\n## 内容风格要求\n${styleDirective}`
      }
    }

    if (scriptDuration) {
      prompt += `\n\n## 脚本时长要求\n用户偏好的视频时长为 ${scriptDuration}，生成物料时请据此调整内容密度和节奏。`
    }

    if (defaultLanguage && defaultLanguage !== '简体中文') {
      prompt += `\n\n## 语言要求\n请使用 ${defaultLanguage} 回复和生成物料。`
    }

    setCache(cacheKey, prompt)
    return prompt
  } catch (err) {
    console.error('[Agent] 读取记忆失败，使用基础 Prompt:', err)
    setCache(cacheKey, BASE_SYSTEM_PROMPT)
    return BASE_SYSTEM_PROMPT
  }
}

// ============================================================
//  Agent 主体
// ============================================================

class Agent {
  constructor(config) {
    this.client = createClient(config)
    this.model = config.model
    this.temperature = config.temperature ?? 0.7
    this.maxTokens = config.maxTokens ?? 4096
    this.contentStyle = config.contentStyle || ''
    this.scriptDuration = config.scriptDuration || ''
    this.defaultLanguage = config.defaultLanguage || ''
    this.accountId = config.accountId || 'default'
    this.accountName = config.accountName || ''
    this.accountPlatform = config.accountPlatform || ''
    this.accountUid = config.accountUid || ''
    this._pendingFormResolve = null
    this.usage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 }
  }

  resetUsage() {
    this.usage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 }
  }

  _trackUsage(responseUsage) {
    if (!responseUsage) return
    const input = responseUsage.input_tokens || responseUsage.prompt_tokens || 0
    const output = responseUsage.output_tokens || responseUsage.completion_tokens || 0
    this.usage.inputTokens += input
    this.usage.outputTokens += output
    this.usage.totalTokens += input + output
  }

  _resolveForm(data) {
    if (this._pendingFormResolve) {
      this._pendingFormResolve(data)
      this._pendingFormResolve = null
    }
  }

  async run(userInput, options = {}) {
    const { onToolCall, onText, conversationId } = options

    cleanupOldCheckpoints()

    const tracker = new ExecutionTracker()
    let state = new AgentState()
    let messages = [{ role: 'user', content: userInput }]

    // Restore from checkpoint if available
    const checkpoint = loadCheckpoint(conversationId)
    if (checkpoint) {
      state = AgentState.deserialize(checkpoint.state)
      messages = checkpoint.messages || messages
      console.log(`[Agent] 从检查点恢复 conv=${conversationId} phase=${state.phase}`)
    } else {
      state.metadata.targetPlatforms = options.platforms || ['bilibili', 'douyin', 'xiaohongshu']
    }
    const systemPrompt = await buildSystemPrompt({
      accountId: this.accountId,
      contentStyle: this.contentStyle,
      scriptDuration: this.scriptDuration,
      defaultLanguage: this.defaultLanguage,
      accountName: this.accountName,
      accountPlatform: this.accountPlatform,
      accountUid: this.accountUid,
    })
    this.resetUsage()
    let iterations = 0

    while (iterations < MAX_ITERATIONS) {
      iterations++
      state.metadata.iterationCount = iterations

      const contextFromState = buildContextFromState(state)
      const fullPrompt = contextFromState
        ? systemPrompt + '\n\n' + contextFromState
        : systemPrompt

      const response = await this.client.chat({
        system: fullPrompt,
        messages,
        tools,
        maxTokens: this.maxTokens,
        temperature: this.temperature,
      })

      this._trackUsage(response.usage)

      for (const block of response.content) {
        if (block.type === 'text' && onText) {
          onText(block.text)
        }
      }

      const nextAction = determineNextAction(state, response)

      switch (nextAction.type) {
        case 'execute_tools': {
          messages.push({ role: 'assistant', content: response.content })
          const toolResults = []

          for (const block of nextAction.tools) {
            if (onToolCall) onToolCall(block.name, block.input)

            tracker.trackToolCall(block.name, block.input)
            const toolStart = Date.now()

            const tool = tools.find(t => t.name === block.name)
            let result

            if (tool) {
              try {
                result = await executeWithTimeout(
                  () => executeToolWithRetry(tool, { ...block.input, accountId: this.accountId }),
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

            tracker.trackToolResult(block.name, result, Date.now() - toolStart)
            processToolResult(block.name, result, state)

            // Save checkpoint after each tool call
            saveCheckpoint(conversationId, state, messages)

            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: JSON.stringify(result),
            })
          }

          messages.push({ role: 'user', content: toolResults })
          break
        }

        case 'handle_error': {
          const errorText = response.content.filter(b => b.type === 'text').map(b => b.text).join('\n')
          return errorText || '任务执行遇到了一些问题，请重试。'
        }

        case 'auto_analyze':
        case 'auto_generate':
        case 'auto_save':
          break

        case 'done': {
          clearCheckpoint(conversationId)
          const finalText = response.content.filter(b => b.type === 'text').map(b => b.text).join('\n')
          return finalText
        }

        case 'continue':
          break
      }
    }

    clearCheckpoint(conversationId)
    return '抱歉，任务执行步骤过多，已自动终止。请尝试简化你的请求。'
  }

  async *stream(userInput, options = {}) {
    const { signal, conversationId } = options

    cleanupOldCheckpoints()

    const tracker = new ExecutionTracker()
    let state = new AgentState()
    let messages = [{ role: 'user', content: userInput }]

    // Restore from checkpoint if available
    const checkpoint = loadCheckpoint(conversationId)
    if (checkpoint) {
      state = AgentState.deserialize(checkpoint.state)
      messages = checkpoint.messages || messages
      console.log(`[Agent] 从检查点恢复 conv=${conversationId} phase=${state.phase}`)
    } else {
      state.metadata.targetPlatforms = options.platforms || ['bilibili', 'douyin', 'xiaohongshu']
    }
    const systemPrompt = await buildSystemPrompt({
      accountId: this.accountId,
      contentStyle: this.contentStyle,
      scriptDuration: this.scriptDuration,
      defaultLanguage: this.defaultLanguage,
      accountName: this.accountName,
      accountPlatform: this.accountPlatform,
      accountUid: this.accountUid,
    })
    this.resetUsage()
    let iterations = 0

    while (iterations < MAX_ITERATIONS) {
      iterations++
      state.metadata.iterationCount = iterations

      if (signal?.aborted) return

      const contextFromState = buildContextFromState(state)
      const fullPrompt = contextFromState
        ? systemPrompt + '\n\n' + contextFromState
        : systemPrompt

      const stream = this.client.stream({
        system: fullPrompt,
        messages,
        tools,
        maxTokens: this.maxTokens,
        temperature: this.temperature,
        signal,
      })

      let finalEvent = null

      for await (const event of stream) {
        if (event.type === 'text') {
          if (!event.hasToolUse) {
            yield { type: 'text', text: event.text }
          }
        } else if (event.type === 'final') {
          finalEvent = event
        }
      }

      if (!finalEvent) break

      this._trackUsage(finalEvent.usage)

      if (finalEvent.stopReason === 'end_turn') {
        if (!finalEvent.hasToolUse) {
          const textBlocks = finalEvent.content.filter(b => b.type === 'text')
          for (const block of textBlocks) {
            yield { type: 'text', text: block.text }
          }
        }
        break
      }

      if (finalEvent.stopReason === 'tool_use') {
        messages.push({ role: 'assistant', content: finalEvent.content })

        const toolResults = []
        for (const block of finalEvent.content) {
          if (block.type === 'tool_use') {
            const input = finalEvent.toolUseInputs[block.id]?.input || block.input
            yield { type: 'tool_call', name: block.name, input }

            tracker.trackToolCall(block.name, input)
            const toolStart = Date.now()

            const tool = tools.find(t => t.name === block.name)
            let result
            if (tool) {
              try {
                const progressMessages = []
                const emitProgress = (msg) => progressMessages.push(msg)
                result = await executeWithTimeout(
                  () => executeToolWithRetry(tool, { ...input, accountId: this.accountId, onProgress: emitProgress }),
                  getToolTimeout(block.name)
                )
                for (const msg of progressMessages) {
                  yield { type: 'tool_progress', name: block.name, message: msg }
                }
                if (result.formRequest) {
                  yield { type: 'form_request', message: result.message, fields: result.fields }
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

            tracker.trackToolResult(block.name, result, Date.now() - toolStart)
            processToolResult(block.name, result, state)

            // Save checkpoint after each tool call
            saveCheckpoint(conversationId, state, messages)

            yield { type: 'tool_result', name: block.name, result }
            yield { type: 'execution_event', events: tracker.toDisplayEvents() }
            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: JSON.stringify(result),
            })
          }
        }

        messages.push({ role: 'user', content: toolResults })
      } else {
        break
      }
    }

    if (iterations >= MAX_ITERATIONS) {
      yield { type: 'text', text: '\n\n抱歉，任务执行步骤过多，已自动终止。' }
      console.warn(`[Agent] 达到最大迭代次数 ${MAX_ITERATIONS}，强制终止`)
    }

    clearCheckpoint(conversationId)
    yield { type: 'execution_done', summary: tracker.getSummary(), events: tracker.toDisplayEvents() }
  }
}

module.exports = Agent
