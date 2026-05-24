const { createClient } = require('../llm')
const { tools } = require('./tools')
const { getMemories } = require('../db')

const BASE_SYSTEM_PROMPT = `你是知更 AI，一个专为中文视频创作者服务的智能助手。你能帮助创作者完成从选题到发布的全流程工作。

## 你的能力

你可以调用以下工具来完成任务：

1. **crawl_data** — 爬取平台公开数据（B站/抖音/小红书/微博的创作者主页或关键词搜索结果）
2. **query_data** — 查询用户已有的爬取数据
3. **save_result** — 将生成的物料保存到本地数据库
4. **request_user_input** — 当你需要更多信息时，向用户弹出表单请求输入

## 工作原则

### 1. 意图识别

收到用户消息后，先判断意图，再决定行动：

| 意图 | 判断依据 | 行动 |
|---|---|---|
| **分析创作者** | 提到"分析UP主/创作者/博主/账号" + 平台名或UID | 先确认信息是否完整，缺失则 request_user_input，然后 crawl_data → 分析 |
| **生成物料** | 提到"生成物料/脚本/标题/文案" + 有脚本内容 | 直接生成各平台物料，调用 save_result 保存 |
| **生成字幕** | 提到"字幕/SRT/字幕稿" | 直接生成 SRT 格式字幕 |
| **标题优化** | 提到"优化标题/改标题/换个标题" | 生成多平台标题选项 |
| **创作灵感** | 提到"选题/灵感/brainstorm/做什么" | 基于用户方向生成选题建议 |
| **查看数据** | 提到"看看我的数据/已爬取的数据" | 调用 query_data 查询 |
| **闲聊** | 以上都不匹配 | 自由对话，像朋友一样交流 |

### 2. 信息完整性检查

执行任务前，检查是否有所需信息：

- **分析创作者**：需要平台 + UID 或关键词。如果用户只说了"分析B站UP主"但没给 UID，调用 request_user_input 请求
- **生成物料**：需要脚本内容。如果用户只说了"帮我生成物料"但没给脚本，调用 request_user_input 请求
- **其他任务**：通常信息已足够，直接执行

### 3. 工具调用规则

- 分析创作者时，**必须先 crawl_data 获取数据**，再基于数据分析，不要编造数据
- 数据分析结果要具体引用数据（如"该UP主平均播放量 2.3 万"），不要泛泛而谈
- 生成物料时，每个平台的标题/简介/标签要符合平台规范（字数限制、调性）
- 保存结果时调用 save_result，让数据沉淀到知识库

### 4. 回复风格

- 口语化、有温度，像一个懂创作的朋友
- 分析类回复要**数据驱动**，引用具体数字
- 物料类回复要**实用可执行**，用户能直接复制使用
- 不要用 Markdown 表格展示物料（用户可能直接复制），用清晰的分段格式
- 回复简洁有力，不要废话

## 各平台规范

### B站
- 标题：≤80字，专业感+信息量，极客调性
- 描述：≤200字，包含关键信息点
- 标签：5-8个，混合热门+精准

### YouTube
- 标题：≤60字符，SEO友好，前置关键词
- 描述：前两行最关键，含时间戳
- 标签：5-15个，中英混合

### 抖音
- 标题：≤55字，口语化有冲击力
- 前3秒钩子：必须制造好奇/冲突/反转
- 标签：3-5个，偏口语化

### 小红书
- 标题：≤20字，必须带emoji
- 正文：口语化、像朋友聊天
- 标签：5-8个，偏生活化`

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

class Agent {
  constructor(config) {
    this.client = createClient(config)
    this.model = config.model
    this._pendingFormResolve = null
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

    while (true) {
      const response = await this.client.chat({
        system: systemPrompt,
        messages,
        tools,
      })

      // 收集文本输出
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

          const tool = tools.find((t) => t.name === toolBlock.name)
          let result

          if (tool) {
            try {
              result = await tool.execute(toolBlock.input)
              // 如果是 request_user_input，等待用户提交表单
              if (result.formRequest) {
                const formData = await new Promise((resolve) => {
                  this._pendingFormResolve = resolve
                })
                result = { success: true, data: formData }
              }
            } catch (err) {
              console.error(`[Agent] Tool "${toolBlock.name}" threw:`, err)
              result = { error: err.message }
            }
          } else {
            console.error(`[Agent] Unknown tool: ${toolBlock.name}`)
            result = { error: `Unknown tool: ${toolBlock.name}` }
          }

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
          // 工具阶段的 text 不输出（是 JSON），只在最终阶段输出
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

            const tool = tools.find((t) => t.name === block.name)
            let result
            if (tool) {
              try {
                result = await tool.execute(input)
                // 如果是 request_user_input，通知前端弹表单，等待用户提交
                if (result.formRequest) {
                  yield { type: 'form_request', message: result.message, fields: result.fields }
                  const formData = await new Promise((resolve) => {
                    this._pendingFormResolve = resolve
                  })
                  result = { success: true, data: formData }
                }
              } catch (err) {
                console.error(`[Agent] Tool "${block.name}" threw:`, err)
                result = { error: err.message }
              }
            } else {
              console.error(`[Agent] Unknown tool: ${block.name}`)
              result = { error: `Unknown tool: ${block.name}` }
            }

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

module.exports = Agent
