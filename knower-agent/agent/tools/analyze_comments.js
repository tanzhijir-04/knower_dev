module.exports = {
  name: 'analyze_comments',
  description: '分析已爬取的视频评论，提取情感分布和高频话题',
  input_schema: {
    type: 'object',
    properties: {
      videoId: { type: 'string', description: '视频 ID' },
      platform: { type: 'string', enum: ['bili', 'dy', 'xhs', 'wb'] },
    },
    required: ['videoId', 'platform'],
  },
  async execute({ videoId }) {
    const { getCommentsByVideo, updateCommentSentiment } = require('../../db')
    const { callLLM } = require('../../llm/client')
    const comments = await getCommentsByVideo(videoId)
    if (!comments.length) return { error: '暂无评论数据' }
    const batchSize = 20
    for (let i = 0; i < comments.length; i += batchSize) {
      const batch = comments.slice(i, i + batchSize)
      const text = batch.map((c, idx) => `[${idx}] (${c.likeCount}赞) ${c.content}`).join('\n')
      try {
        const result = await callLLM('分析评论情感和话题。输出JSON：[{"index":0,"sentiment":"positive","tags":["tag"]},...]\n\n' + text, { maxTokens: 2000 })
        const analyses = JSON.parse(result)
        for (const a of analyses) { if (batch[a.index]) await updateCommentSentiment(batch[a.index].id, a.sentiment, a.tags) }
      } catch { /* skip */ }
    }
    return { commentCount: comments.length, summary: '分析完成' }
  },
}
