// ============================================================
//  优化后的 Agent Core（基于 Superpowers Skill 模式）
// ============================================================
// 变化：
//   1. 使用优化后的系统提示词
//   2. 使用优化后的工具描述
//   3. 增加工具调用顺序检查
//   4. 增加红线检测日志
// ============================================================

const { createClient } = require('../llm')
const { tools } = require('./tools')
const { getMemories } = require('../db')

// ============================================================
//  优化后的系统提示词（直接嵌入，避免外部依赖）
// ============================================================

const BASE_SYSTEM_PROMPT = `你是知更 AI，一个专为中文视频创作者服务的智能助手。你能帮助创作者完成从选题到发布的全流程工作。

## 你的工具

| 工具 | 用途 | 什么时候必须调用 |
|------|------|-----------------|
| crawl_data | 爬取平台公开数据（B站/抖音/小红书/微博） | 用户要分析创作者/账号/UP主时 |
| query_data | 查询用户已有的爬取数据 | 用户要看"我的数据"时 |
| analyze_script | 结构化分析脚本内容 | 有脚本要分析时 |
| expand_script | 为各平台生成发布物料 | 分析完成后生成物料时 |
| suggest_topics | 结合历史数据+趋势生成选题建议 | 用户要选题/灵感/brainstorm时 |
| save_result | 将物料保存到本地数据库 | 生成了物料后必须保存 |
| request_user_input | 向用户弹出表单请求补充信息 | 缺少必要信息时 |

## 工具检查流程（必须遵守）

收到用户消息后，在回复之前，先走这个检查流程：

1. 是否涉及「分析创作者/账号/UP主」？ -> 必须调用 crawl_data，不能编造数据
2. 是否涉及「已爬取的数据/我的数据」？ -> 必须调用 query_data，不能猜
3. 是否涉及「生成物料/脚本/标题/文案/选题」？ -> 有脚本先调 analyze_script，没脚本先用 request_user_input 要
4. 是否涉及「选题/灵感/brainstorm」？ -> 调用 suggest_topics
5. 是否涉及「保存/记录/沉淀」？ -> 必须调用 save_result
6. 以上都不匹配 -> 自由对话（闲聊模式）

## 红旗表（以下想法出现时，立即停下）

- "用户没给UID，我猜一个" -> 不要猜，调用 request_user_input 要信息
- "我知道这个UP主的数据" -> 你不知道，数据必须来自 crawl_data
- "脚本我理解了，直接生成物料" -> 没有结构化分析就不能生成，先调 analyze_script
- "用户没说要保存" -> 生成了物料就必须调 save_result
- "数据是空的，我编一些" -> 绝对禁止编造数据，诚实说"暂无数据"
- "工具太慢了，我直接答" -> 慢不是跳过的理由，告诉用户"正在获取"
- "工具报错了，假装成功" -> 不要掩盖错误，告诉用户哪步失败了
- "这次不保存了吧" -> 必须保存，除非用户明确说不要

## 工具调用路径（严格顺序执行）

### 路径 A：分析创作者
request_user_input（确认平台+UID/关键词）-> crawl_data -> 基于真实数据分析

### 路径 B：脚本->物料
request_user_input（如果没有脚本）-> analyze_script -> expand_script -> save_result

### 路径 C：选题建议
suggest_topics（自动查历史数据+趋势+偏好）-> 输出选题建议

### 路径 D：查看数据
query_data -> 输出数据概览

每个路径内部严格顺序执行，每步等上一步完成后再进行下一步。

## 工具调用规则

- 分析创作者时，必须先 crawl_data 获取数据，再基于数据分析，不要编造数据
- 数据分析结果要具体引用数据（如"该UP主平均播放量 2.3 万"），不要泛泛而谈
- 生成物料时，每个平台的标题/简介/标签要符合平台规范（字数限制、调性）
- 保存结果时调用 save_result，让数据沉淀到知识库
- 一次只调用一个工具，不要同时调用多个工具

## 回复风格

- 口语化、有温度，像一个懂创作的朋友
- 分析类回复要数据驱动，引用具体数字
- 物料类回复要实用可执行，用户能直接复制使用
- 不要用 Markdown 表格展示物料（用户可能直接复制），用清晰的分段格式
- 回复简洁有力，不要废话
- 不要说"我是AI助手"之类的话
- 不要在每句话后面加 emoji

## 信息完整性检查

执行任务前，检查是否有所需信息：
- 分析创作者：需要平台 + UID 或关键词。如果缺失，调用 request_user_input 请求
- 生成物料：需要脚本内容。如果缺失，调用 request_user_input 请求
- 其他任务：通常信息已足够，直接执行

## 错误处理

当工具调用失败时：
- 网络超时/限流 -> 告诉用户"平台暂时繁忙，稍后再试"
- 爬取失败 -> 检查是否需要登录，提示用户
- 数据为空 -> 说明该来源暂无数据，建议换关键词或平台
- LLM 调用失败 -> 简要说明错误，建议用户检查 API Key
- 不要把技术错误细节暴露给用户，用友好的语言描述

## 任务规划

收到复杂任务时，先在内部规划步骤，再逐步执行：
1. 明确目标（用户要什么）
2. 检查信息（够不够，缺什么）
3. 选择路径（A/B/C/D）
4. 按顺序执行工具调用
5. 每步等上一步完成后再进行下一步
6. 输出自检后回复

示例："分析B站UP主 440609243 并给出选题建议"
规划：路径 A + C
1. request_user_input 确认 UID
2. crawl_data 爬取数据
3. 基于数据分析内容特征
4. suggest_topics 结合分析给出选题建议

示例："帮我分析这段脚本并生成物料，然后保存"
规划：路径 B
1. analyze_script 结构化分析
2. expand_script 生成各平台物料
3. save_result 保存到数据库
4. 输出总结

## 输出自检

生成回复前，内部检查：
- 分析类回复：是否引用了具体数据？数据是否来自工具返回（非编造）？
- 物料类回复：标题字数是否符合平台规范？标签是否相关？
- 选题建议：是否基于用户实际数据？建议是否具体可执行？
- 如果自检不通过，修正后再输出

## 各平台规范

### B站
- 标题：<=80字，专业感+信息量，极客调性
- 描述：<=200字，包含关键信息点
- 标签：5-8个，混合热门+精准

### YouTube
- 标题：<=60字符，SEO友好，前置关键词
- 描述：前两行最关键，含时间戳
- 标签：5-15个，中英混合

### 抖音
- 标题：<=55字，口语化有冲击力
- 前3秒钩子：必须制造好奇/冲突/反转
- 标签：3-5个，偏口语化

### 小红书
- 标题：<=20字，必须带emoji
- 正文：口语化、像朋友聊天
- 标签：5-8个，偏生活化`

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
  return toolName === 'crawl_data' ? 120000 : 30000
}

// ============================================================
//  工具调用顺序检查（新增）
// ============================================================

// 合法的工具调用顺序
const VALID_TOOL_PATHS = {
  // 路径 A：分析创作者
  A: ['request_user_input', 'crawl_data'],
  // 路径 B：脚本->物料
  B: ['request_user_input', 'analyze_script', 'expand_script', 'save_result'],
  // 路径 C：选题建议
  C: ['suggest_topics'],
  // 路径 D：查看数据
  D: ['query_data'],
}

// 检查工具调用是否符合顺序
function checkToolCallOrder(toolName, calledTools) {
  // 找到包含当前工具的路径
  for (const [pathName, path] of Object.entries(VALID_TOOL_PATHS)) {
    const toolIndex = path.indexOf(toolName)
    if (toolIndex === -1) continue

    // 检查路径中前面的工具是否都已经调用过
    for (let i = 0; i < toolIndex; i++) {
      const requiredTool = path[i]
      if (!calledTools.includes(requiredTool)) {
        // request_user_input 是可选的（如果信息已经足够）
        if (requiredTool === 'request_user_input') continue
        console.log(`[Agent] 工具调用顺序警告：调用 ${toolName} 前应先调用 ${requiredTool}`)
        return false
      }
    }
    return true
  }
  return true // 不在任何路径中的工具（如 request_user_input），允许自由调用
}

// ============================================================
//  Agent 主体
// ============================================================

class Agent {
  constructor(config) {
    this.client = createClient(config)
    this.model = config.model
    this._pendingFormResolve = null
    this._calledTools = [] // 记录已调用的工具
  }

  _resolveForm(data) {
    if (this._pendingFormResolve) {
      this._pendingFormResolve(data)
      this._pendingFormResolve = null
    }
  }

  async run(userInput, options = {}) {
    const { platforms = ['bilibili', 'douyin', 'xiaohongshu'], onToolCall, onText } = options

    const messages = [{ role: 'user', content: userInput }]
    const systemPrompt = await buildSystemPrompt()
    let finalResult = null
    this._calledTools = [] // 重置工具调用记录

    while (true) {
      const response = await this.client.chat({
        system: systemPrompt,
        messages,
        tools,
      })

      for (const block of response.content) {
        if (block.type === 'text' && onText) {
          onText(block.text)
        }
      }

      if (response.stopReason === 'end_turn') {
        const textBlocks = response.content.filter((b) => b.type === 'text')
        finalResult = textBlocks.map((b) => b.text).join('\n')
        break
      }

      if (response.stopReason === 'tool_use') {
        messages.push({ role: 'assistant', content: response.content })

        const toolUseBlocks = response.content.filter((b) => b.type === 'tool_use')
        const toolResults = []

        for (const toolBlock of toolUseBlocks) {
          if (onToolCall) {
            onToolCall(toolBlock.name, toolBlock.input)
          }

          // 检查工具调用顺序
          checkToolCallOrder(toolBlock.name, this._calledTools)

          const tool = tools.find((t) => t.name === toolBlock.name)
          let result

          if (tool) {
            try {
              result = await executeWithTimeout(
                () => executeToolWithRetry(tool, toolBlock.input),
                getToolTimeout(toolBlock.name)
              )
              if (result.formRequest) {
                const formData = await new Promise((resolve) => {
                  this._pendingFormResolve = resolve
                })
                result = { success: true, data: formData }
              }
            } catch (err) {
              console.error(`[Agent] Tool "${toolBlock.name}" failed:`, err)
              result = { error: err.message }
            }
          } else {
            console.error(`[Agent] Unknown tool: ${toolBlock.name}`)
            result = { error: `Unknown tool: ${toolBlock.name}` }
          }

          // 记录已调用的工具
          this._calledTools.push(toolBlock.name)

          toolResults.push({
            type: 'tool_result',
            tool_use_id: toolBlock.id,
            content: JSON.stringify(result),
          })
        }

        messages.push({ role: 'user', content: toolResults })
      } else {
        break
      }
    }

    return finalResult
  }

  async *stream(userInput, options = {}) {
    const { platforms = ['bilibili', 'douyin', 'xiaohongshu'], signal } = options

    const messages = [{ role: 'user', content: userInput }]
    const systemPrompt = await buildSystemPrompt()
    let inToolPhase = false
    this._calledTools = [] // 重置工具调用记录

    while (true) {
      if (signal?.aborted) return

      const stream = this.client.stream({
        system: systemPrompt,
        messages,
        tools,
        signal,
      })

      let finalEvent = null

      for await (const event of stream) {
        if (event.type === 'text') {
          if (!event.hasToolUse && !inToolPhase) {
            yield { type: 'text', text: event.text }
          }
        } else if (event.type === 'final') {
          finalEvent = event
        }
      }

      if (!finalEvent) break

      if (finalEvent.stopReason === 'end_turn') {
        if (!finalEvent.hasToolUse) {
          const textBlocks = finalEvent.content.filter((b) => b.type === 'text')
          for (const block of textBlocks) {
            yield { type: 'text', text: block.text }
          }
        }
        break
      }

      if (finalEvent.stopReason === 'tool_use') {
        inToolPhase = true
        messages.push({ role: 'assistant', content: finalEvent.content })

        const toolResults = []
        for (const block of finalEvent.content) {
          if (block.type === 'tool_use') {
            const input = finalEvent.toolUseInputs[block.id]?.input || block.input
            yield { type: 'tool_call', name: block.name, input }

            // 检查工具调用顺序
            checkToolCallOrder(block.name, this._calledTools)

            const tool = tools.find((t) => t.name === block.name)
            let result
            if (tool) {
              try {
                result = await executeWithTimeout(
                  () => executeToolWithRetry(tool, input),
                  getToolTimeout(block.name)
                )
                if (result.formRequest) {
                  yield { type: 'form_request', message: result.message, fields: result.fields }
                  const formData = await new Promise((resolve) => {
                    this._pendingFormResolve = resolve
                  })
                  result = { success: true, data: formData }
                }
              } catch (err) {
                console.error(`[Agent] Tool "${block.name}" failed:`, err)
                result = { error: err.message }
              }
            } else {
              console.error(`[Agent] Unknown tool: ${block.name}`)
              result = { error: `Unknown tool: ${block.name}` }
            }

            // 记录已调用的工具
            this._calledTools.push(block.name)

            yield { type: 'tool_result', name: block.name, result }
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
  }
}

// ============================================================
//  记忆系统（与原版相同）
// ============================================================

async function buildSystemPrompt() {
  try {
    const memories = await getMemories('default')
    if (!memories.length) return BASE_SYSTEM_PROMPT

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

    return BASE_SYSTEM_PROMPT + section
  } catch (err) {
    console.error('[Agent] 读取记忆失败，使用基础 Prompt:', err)
    return BASE_SYSTEM_PROMPT
  }
}

module.exports = Agent