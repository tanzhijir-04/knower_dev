const { getTopContent, getRecentTrends, getMemories } = require('../../db')
const loadSettings = require('../../config')

module.exports = {
  name: 'suggest_topics',
  description: '结合用户历史数据和平台趋势，生成个性化选题建议',
  input_schema: {
    type: 'object',
    properties: {
      platform: { type: 'string', description: '目标平台（bili/dy/xhs/wb）' },
      count: { type: 'number', description: '生成选题数量，默认 5' },
    },
    required: ['platform'],
  },
  async execute({ platform, count = 5 }) {
    try {
      const topContent = await getTopContent(platform, 20)
      const trends = await getRecentTrends(platform, 7)
      const memories = await getMemories('default')

      const settings = loadSettings()
      if (!settings.apiKey) {
        return { error: '缺少 API Key' }
      }

      const { createClient } = require('../../llm')
      const client = createClient(settings)

      const topContentStr = topContent.length
        ? topContent.map((v, i) => `${i + 1}. "${v.title}" | 播放: ${v.playCount} | 点赞: ${v.likeCount} | 分类: ${v.category || '未分类'}`).join('\n')
        : '暂无历史数据'

      const trendsStr = trends.length
        ? trends.map((v, i) => `${i + 1}. "${v.title}" | 播放: ${v.playCount} | 作者: ${v.authorName}`).join('\n')
        : '暂无趋势数据'

      const memoriesStr = memories.length
        ? memories.map(m => `- ${m.value}（${m.type}）`).join('\n')
        : '暂无偏好数据'

      const response = await client.chat({
        system: '你是一位视频选题策划专家。根据数据为创作者生成个性化选题建议。只返回 JSON 数组，不要有任何其他文字。',
        messages: [{
          role: 'user',
          content: `请为一位视频创作者生成 ${count} 个选题建议。

## 创作者历史高互动内容
${topContentStr}

## 当前平台趋势
${trendsStr}

## 创作者已知偏好
${memoriesStr}

## 要求
每个选题包含：
- title: 选题标题（有吸引力，15字以内）
- reason: 推荐理由（基于数据依据，30字以内）
- source: 灵感来源（"历史高互动"/"当前趋势"/"结合两者"）
- estimatedPerformance: 预估表现（"高"/"中"/"参考同类"）
- tags: 建议标签（3-5个）

返回 JSON 数组，不要有其他文字。`,
        }],
        maxTokens: 2048,
      })

      const text = response.content
        .filter(b => b.type === 'text')
        .map(b => b.text)
        .join('')
        .trim()

      let topics
      try {
        topics = JSON.parse(text)
      } catch {
        const match = text.match(/\[[\s\S]*\]/)
        if (match) {
          topics = JSON.parse(match[0])
        } else {
          return { topics: [] }
        }
      }

      return { topics: Array.isArray(topics) ? topics.slice(0, count) : [] }
    } catch (err) {
      console.error('[suggest_topics] 执行失败:', err)
      return { error: err.message, topics: [] }
    }
  },
}
