const { saveScript, upsertMemory } = require('../../db')
const loadSettings = require('../../config')

module.exports = {
  name: 'save_result',
  description: '将脚本分析结果和生成的各平台物料存入本地 SQLite 数据库。调用时必须提供完整的 script、analysis 和 result 参数。',
  input_schema: {
    type: 'object',
    properties: {
      script: {
        type: 'string',
        description: '原始脚本文本',
      },
      analysis: {
        type: 'object',
        description: '脚本分析结果',
        properties: {
          videoType: { type: 'string' },
          topic: { type: 'string' },
          audience: { type: 'string' },
          duration: { type: 'string' },
          keyPoints: { type: 'array', items: { type: 'string' } },
        },
        required: ['videoType', 'topic', 'audience', 'duration', 'keyPoints'],
      },
      result: {
        type: 'object',
        description: '各平台发布物料',
        properties: {
          shootingChecklist: { type: 'array', items: { type: 'object' } },
          bilibili: { type: 'object' },
          youtube: { type: 'object' },
          douyin: { type: 'object' },
          xiaohongshu: { type: 'object' },
        },
      },
    },
    required: ['script', 'analysis', 'result'],
  },
  async execute({ script, analysis, result }) {
    try {
      const id = await saveScript(script, analysis, result)

      // 异步提炼记忆，不阻塞主流程
      extractAndSaveMemories(script, analysis, result).catch((err) => {
        console.error('[save_result] 记忆提炼失败:', err)
      })

      return { success: true, id, message: `已保存到数据库，记录 ID: ${id}` }
    } catch (err) {
      console.error('[save_result] 执行失败:', err)
      return { success: false, error: err.message }
    }
  },
}

async function extractAndSaveMemories(script, analysis, result) {
  const settings = loadSettings()
  if (!settings.apiKey) {
    console.error('[save_result] 无法提炼记忆：缺少 API Key')
    return
  }

  const { createClient } = require('../../llm')
  const client = createClient(settings)

  const dataSummary = JSON.stringify({ analysis, result }, null, 2)

  const response = await client.chat({
    system: '你是一个内容分析助手，专门从视频创作数据中提炼创作者的风格偏好。只返回 JSON 数组，不要有任何其他文字，不要有 markdown 代码块。',
    messages: [{
      role: 'user',
      content: `根据以下这次视频创作的数据，提炼这个创作者的风格偏好。
返回一个 JSON 数组，每个元素包含：
{
  "type": "style_preference | content_pattern | platform_habit",
  "key": "简短的英文 key，如 bilibili_title_style",
  "value": "具体的偏好描述，中文，15字以内",
  "evidence": "依据，引用具体数据，30字以内"
}
最多返回 5 条，只提炼有明确依据的偏好，不要猜测。

数据如下：
${dataSummary}`,
    }],
    maxTokens: 2048,
  })

  const text = response.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim()

  // 尝试解析 JSON 数组
  let memories
  try {
    memories = JSON.parse(text)
  } catch {
    // 可能被 markdown 代码块包裹
    const match = text.match(/\[[\s\S]*\]/)
    if (match) {
      memories = JSON.parse(match[0])
    } else {
      console.error('[save_result] 记忆 JSON 解析失败:', text)
      return
    }
  }

  if (!Array.isArray(memories)) {
    console.error('[save_result] 记忆结果不是数组:', memories)
    return
  }

  const VALID_TYPES = ['style_preference', 'content_pattern', 'platform_habit']

  for (const mem of memories) {
    if (!mem.type || !mem.key || !mem.value || !VALID_TYPES.includes(mem.type)) {
      continue
    }
    try {
      await upsertMemory('default', mem.type, mem.key, mem.value, mem.evidence || '')
    } catch (err) {
      console.error(`[save_result] 写入记忆失败 (key=${mem.key}):`, err)
    }
  }

  console.log(`[save_result] 已提炼 ${memories.length} 条记忆`)
}
