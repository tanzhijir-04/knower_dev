const { findSimilarScripts, findSimilarContent, findHighEngagementPatterns } = require('../../rag/retriever')

module.exports = {
  name: 'search_similar',
  description: `语义检索历史数据。支持找相似脚本、相似内容、高互动模式。

**什么时候必须调用：**
- 用户说"找类似的脚本""参考之前的"
- 用户说"哪种标题互动高""爆款模式"
- 用户说"这个创作者的内容模式是什么"

**什么时候不要调用：**
- 用户只是要生成新内容（用 expand_script）
- 用户要爬新数据（用 crawl_data）`,
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
