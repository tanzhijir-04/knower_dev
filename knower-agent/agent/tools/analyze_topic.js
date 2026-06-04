const { getTopContent, getRecentTrends, getMemories } = require('../../db')
const loadSettings = require('../../config')

module.exports = {
  name: 'analyze_topic',
  description: `深度分析一个选题的可行性，包括竞品数据、用户画像、内容策略建议。

**什么时候调用：**
- 用户说"分析这个选题"、"这个选题怎么样"
- 用户点击选题详情面板的"深度分析"按钮

**什么时候不要调用：**
- 用户只是浏览选题列表
- 用户已经决定要做这个选题`,
  input_schema: {
    type: 'object',
    properties: {
      topicTitle: { type: 'string', description: '选题标题' },
      topicReason: { type: 'string', description: '选题理由' },
      platform: { type: 'string', description: '目标平台（bili/dy/xhs/wb）' },
    },
    required: ['topicTitle', 'platform'],
  },
  async execute({ topicTitle, topicReason, platform, accountId }) {
    try {
      const settings = loadSettings()
      const aid = accountId || 'default'
      const topContent = await getTopContent(platform, 20, aid)
      const trends = await getRecentTrends(platform, 7, aid)
      const memories = await getMemories(aid)

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
        system: `你是一位视频内容策略专家。深度分析一个选题的可行性，给出详细建议。
返回 JSON 格式，包含以下字段：
- feasibility: { score: 0-100, factors: ["因素1", "因素2", ...] }
- competitorAnalysis: [{ title: "竞品标题", playCount: 播放量, engagementRate: 互动率 }]
- contentStrategy: "内容策略建议（100字以内）"
- executionPlan: ["步骤1", "步骤2", "步骤3"]
- riskFactors: ["风险1", "风险2"]
- expectedOutcome: "预期效果描述"

只返回 JSON，不要有其他文字。`,
        messages: [{
          role: 'user',
          content: `请深度分析以下选题：

## 选题信息
标题：${topicTitle}
理由：${topicReason || '暂无'}

## 创作者历史高互动内容
${topContentStr}

## 当前平台趋势
${trendsStr}

## 创作者已知偏好
${memoriesStr}

请分析这个选题的可行性、竞品情况、内容策略和执行计划。`,
        }],
        maxTokens: 2048,
      })

      const text = response.content
        .filter(b => b.type === 'text')
        .map(b => b.text)
        .join('')
        .trim()

      let analysis
      try {
        analysis = JSON.parse(text)
      } catch {
        const match = text.match(/\{[\s\S]*\}/)
        if (match) {
          analysis = JSON.parse(match[0])
        } else {
          return { error: '无法解析分析结果' }
        }
      }

      return { analysis }
    } catch (err) {
      console.error('[analyze_topic] 执行失败:', err)
      return { error: err.message }
    }
  },
}
