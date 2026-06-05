module.exports = {
  name: 'analyze_competitor',
  description: '分析竞品频道的最新内容变化和策略趋势',
  input_schema: {
    type: 'object',
    properties: { competitorId: { type: 'number', description: '竞品 ID（competitors 表）' } },
    required: ['competitorId'],
  },
  async execute({ competitorId }) {
    const { getDb } = require('../../db')
    const { callLLM } = require('../../llm/client')
    const db = await getDb()
    const comp = db.exec('SELECT platform, user_id, nickname FROM competitors WHERE id = ?', [competitorId])
    if (!comp.length || !comp[0].values.length) return { error: '竞品不存在' }
    const [platform, userId, nickname] = comp[0].values[0]
    const content = db.exec('SELECT title, play_count, like_count, comment_count FROM crawl_content WHERE source_uid = ? AND platform = ? ORDER BY created_at DESC LIMIT 10', [userId, platform])
    if (!content.length) return { error: '暂无数据' }
    const videos = content[0].values.map((r) => ({ title: r[0], views: r[1], likes: r[2], comments: r[3] }))
    const prompt = '分析竞品「' + nickname + '」在' + platform + '的内容表现：\n' + videos.map((v, i) => (i+1) + '. ' + v.title + ' | 播放' + v.views + ' | 赞' + v.likes).join('\n') + '\n分析主题趋势、标题策略、互动率，200字内。'
    const analysis = await callLLM(prompt, { maxTokens: 500 })
    return { nickname, platform, videoCount: videos.length, analysis }
  },
}
