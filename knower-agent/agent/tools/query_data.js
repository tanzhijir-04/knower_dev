const { getSourceList, getVideosBySource, getAllCrawlContent } = require('../../db')

module.exports = {
  name: 'query_data',
  description: `查询用户已有的爬取数据。这些数据是之前通过 crawl_data 爬取并保存到本地数据库的。

**什么时候必须调用：**
- 用户说"看看我的数据"、"我之前爬的"、"数据库里有什么"
- 用户说"查一下B站的数据"

**什么时候不要调用：**
- 用户说"分析这个UP主"（应该用 crawl_data 先爬取）
- 用户说"爬一下数据"（应该用 crawl_data）

**常见错误：**
- 用户说"看看B站数据"但数据库里没有 -> 诚实说"暂无数据，需要先爬取"`,
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
  async execute({ platform, sourceUid, limit, accountId }) {
    try {
      const aid = accountId || 'default'
      if (sourceUid) {
        const videos = await getVideosBySource(platform || 'bili', sourceUid, aid)
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
        const sources = await getSourceList(platform === 'all' ? null : platform, aid)
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
