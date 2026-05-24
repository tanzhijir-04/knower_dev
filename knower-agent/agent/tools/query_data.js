const { getSourceList, getVideosBySource, getAllCrawlContent } = require('../../db')

module.exports = {
  name: 'query_data',
  description: '查询用户已有的爬取数据。可以按来源查询，也可以查询全部。',
  input_schema: {
    type: 'object',
    properties: {
      platform: {
        type: 'string',
        enum: ['bili', 'dy', 'xhs', 'wb', 'all'],
        description: '平台，all 表示所有平台',
      },
      sourceUid: {
        type: 'string',
        description: '来源 UID（可选，不填则查全部来源）',
      },
      limit: {
        type: 'number',
        description: '返回条数，默认 20',
      },
    },
  },
  async execute({ platform, sourceUid, limit }) {
    try {
      if (sourceUid) {
        const videos = await getVideosBySource(platform || 'bili', sourceUid)
        return {
          success: true,
          sourceUid,
          totalCount: videos.length,
          videos: videos.slice(0, limit || 20).map(v => ({
            title: v.title,
            playCount: v.playCount,
            likeCount: v.likeCount,
            commentCount: v.commentCount,
            category: v.category,
          })),
        }
      } else {
        const sources = await getSourceList(platform === 'all' ? null : platform)
        return {
          success: true,
          sources: sources.map(s => ({
            name: s.sourceName,
            uid: s.sourceUid,
            type: s.type,
            count: s.count,
          })),
          totalSources: sources.length,
        }
      }
    } catch (err) {
      return { success: false, error: err.message }
    }
  },
}
