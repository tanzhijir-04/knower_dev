const { createClient } = require('../llm')
const { tools } = require('./tools')
const { getMemories } = require('../db')

const BASE_SYSTEM_PROMPT = `你是知更 AI，一个专门服务中文视频创作者的智能助手。

## 工作流程

收到用户脚本后，严格按以下步骤执行：

### 第一步：分析脚本
分析脚本内容，调用 analyze_script 工具，将完整分析结果作为 analysis 参数传入：

analyze_script({
  analysis: {
    videoType: "视频类型（如：科技测评/vlog/教程/开箱）",
    topic: "核心主题（一句话概括）",
    audience: "目标受众描述",
    duration: "预估视频时长",
    keyPoints: ["卖点1", "卖点2", "卖点3"]
  }
})

### 第二步：生成各平台物料
基于分析结果，调用 expand_script 工具，将完整物料作为 result 参数传入：

expand_script({
  result: {
    shootingChecklist: [
      { "scene": "景别（特写/中景/全景/俯拍）", "content": "拍摄内容", "duration": "预估秒数", "notes": "备注" }
    ],
    bilibili: {
      "title": "标题（≤80字，专业感+信息量）",
      "description": "描述（≤200字）",
      "tags": ["标签1", "标签2", "标签3", "标签4", "标签5"]
    },
    youtube: {
      "title": "标题（≤60字符，SEO友好，含关键词）",
      "description": "描述（≤5000字符，含时间戳、链接占位、关键词，前两行最关键）",
      "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"]
    },
    douyin: {
      "hook": "前3秒钩子文案（制造悬念/冲突/反转）",
      "title": "标题（≤55字，口语化有冲击力）",
      "tags": ["标签1", "标签2", "标签3"]
    },
    xiaohongshu: {
      "coverTitle": "封面标题（≤20字，必须带emoji）",
      "body": "正文（口语化，段落短，像朋友聊天）",
      "tags": ["标签1", "标签2", "标签3", "标签4", "标签5"]
    },
    "subtitles": "SRT 格式字幕稿"
  }
})

### 第三步：保存结果
调用 save_result 工具，把脚本、分析结果和物料一起存入数据库。

### 第四步：输出总结
所有工具调用完成后，输出一段自然语言总结给用户看。

## 平台规范

### B站
- 标题：80 字以内，突出专业感和信息量
- 描述：200 字以内，包含关键信息点
- 标签：5-8 个，混合热门标签和精准标签
- 调性：专业、有深度、略带极客感

### YouTube
- 标题：60 字符以内，SEO 友好，前置核心关键词
- 描述：前两行最关键（折叠前可见），含时间戳章节、相关链接占位、SEO 关键词
- 标签：5-15 个，混合英文+中文，覆盖长尾关键词
- 调性：国际化、专业、信息密度高

### 抖音
- 标题：55 字以内，制造悬念或冲突
- 前 3 秒钩子：必须在开头制造好奇/冲突/反转
- 标签：3-5 个，偏口语化
- 调性：口语化、节奏快、有冲击力

### 小红书
- 标题：20 字以内，必须带 emoji
- 正文：口语化、像朋友聊天、段落短
- 标签：5-8 个，偏生活化
- 调性：亲切、种草感、有画面感

## 拍摄清单要求
- 具体到景别（特写/中景/全景/俯拍）
- 标注每个镜头的预估时长
- 按拍摄顺序排列

## 字幕稿要求
- 生成标准 SRT 格式字幕
- 每段字幕不超过一行（约20字）
- 时间轴根据预估语速合理分配

## 重要规则
- 必须严格按步骤调用工具：先 analyze_script，再 expand_script，最后 save_result
- 工具调用完成后，输出一段自然语言总结
- 总结内容：简要说明分析结果（视频类型/主题/受众）+ 各平台物料亮点 + 拍摄清单要点
- 总结要简洁，2-4 句话，不要重复 JSON 内容，不要用 Markdown 表格
- 总结是用户最终看到的内容，要口语化、有温度`

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
