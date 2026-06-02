const { findSimilarScripts, findSimilarContent, findHighEngagementPatterns } = require('../../rag/retriever')

module.exports = {
  name: 'search_similar',
  description: `语义检索历史数据。当你需要参考过去的脚本、内容、标题模式时，主动调用。

**必须调用的场景：**
- 用户提到"之前的""上次的""类似的""参考一下" → type="scripts"
- 用户问"什么标题好""爆款标题""哪种互动高""标题套路" → type="patterns"
- 用户问"这个创作者的内容特征""竞品在做什么" → type="content"
- 用户给你选题但你没有数据支撑分析 → 先搜再分析
- 生成物料前想参考历史高互动内容 → type="content"

**不要调用的场景：**
- 用户只要生成新物料且上下文已有足够数据 → 不需要搜
- 用户要爬新数据 → 用 crawl_data
- 上一轮刚搜过且结果还在上下文中 → 不重复搜

**query 写法：**
- 用自然语言描述，包含平台、内容类型、筛选条件
- 好："B站华为手机评测，互动率高的视频"
- 坏："手机"（太模糊）"视频"（无意义）
- 用户给了关键词就直接用，没给就自行补充

**结果使用：**
- score > 0.7 的在回复中引用：参考「标题」（平台，播放量）
- 结果为空告诉用户"暂未找到相似数据"，不要编造`,
  input_schema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: '搜索语义（自然语言描述你要找什么）' },
      type: { type: 'string', enum: ['scripts', 'content', 'patterns'], description: '检索类型' },
      platform: { type: 'string', description: '限定平台（可选）' },
      topK: { type: 'number', description: '返回条数，默认 5' },
    },
    required: ['query', 'type'],
  },
  async execute({ query, type, platform, topK = 5, accountId = 'default' }) {
    try {
      let results

      switch (type) {
        case 'scripts':
          results = await findSimilarScripts(accountId, query, topK)
          break
        case 'content':
          results = await findSimilarContent(accountId, query, platform, topK)
          break
        case 'patterns':
          results = await findHighEngagementPatterns(accountId, platform || 'bili', topK)
          break
        default:
          return { error: `未知检索类型: ${type}` }
      }

      return { success: true, type, query, results, count: results.length }
    } catch (err) {
      return { success: false, error: err.message }
    }
  },
}
