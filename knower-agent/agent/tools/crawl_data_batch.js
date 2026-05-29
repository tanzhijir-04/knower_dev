const { runCrawler } = require('../../lib/crawler')

module.exports = {
  name: 'crawl_data_batch',
  description: `并行爬取多个平台的公开数据。当需要同时分析多个平台时使用，比逐个调用 crawl_data 更高效。

**什么时候必须调用：**
- 用户说"同时爬B站和抖音的数据"
- 用户要跨平台对比分析，需要多个平台的数据
- 用户说"全平台爬取"

**什么时候不要调用：**
- 只需要爬一个平台 -> 用 crawl_data 即可
- 用户没说要爬取数据

**常见错误：**
- 传了不支持的平台名 -> 只支持 bili, dy, xhs, wb`,
  input_schema: {
    type: 'object',
    properties: {
      platforms: {
        type: 'array',
        items: { type: 'string', enum: ['bili', 'dy', 'xhs', 'wb'] },
        description: '要爬取的平台列表',
      },
      keyword: { type: 'string', description: '搜索关键词' },
      creatorUid: { type: 'string', description: '创作者 UID' },
      maxNotes: { type: 'number', description: '每个平台最大爬取数量，默认 10' },
    },
    required: ['platforms'],
  },
  async execute({ platforms, keyword, creatorUid, maxNotes }) {
    const tasks = platforms.map(platform => {
      const options = { maxNotes: maxNotes || 10 }
      if (creatorUid) {
        options.crawlerType = 'creator'
        options.creatorId = creatorUid
      } else if (keyword) {
        options.crawlerType = 'search'
      }
      return runCrawler(platform, keyword || '', options).then(
        result => ({ platform, success: true, data: result }),
        error => ({ platform, success: false, error: error.message })
      )
    })

    const results = await Promise.allSettled(tasks)

    return {
      success: true,
      results: results.map(r => r.value || r.reason),
      totalCount: results.reduce((sum, r) => {
        const data = r.value?.data?.stats?.total_contents || 0
        return sum + data
      }, 0),
    }
  },
}
