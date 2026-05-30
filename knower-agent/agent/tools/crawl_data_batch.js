const { runCrawler } = require('../../lib/crawler')
const db = require('../../db')

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
  async execute({ platforms, keyword, creatorUid, maxNotes, accountId, onProgress }) {
    const tasks = platforms.map(platform => {
      const options = { maxNotes: maxNotes || 10 }
      if (creatorUid) {
        options.crawlerType = 'creator'
        options.creatorId = creatorUid
      } else if (keyword) {
        options.crawlerType = 'search'
      }
      const platformProgress = onProgress ? (msg) => onProgress(`[${platform}] ${msg}`) : undefined
      return runCrawler(platform, keyword || '', options, platformProgress).then(
        result => ({ platform, success: true, data: result }),
        error => ({ platform, success: false, error: error.message })
      )
    })

    const results = await Promise.allSettled(tasks)

    // 保存爬取结果到数据库
    for (const result of results) {
      if (result.status === 'fulfilled' && result.value.success) {
        const { platform, data } = result.value
        const taskId = await db.saveCrawlTask(platform, keyword || creatorUid || '', 'agent_crawl_batch', 'completed', '', accountId)

        // 保存创作者数据
        const sourceUid = data.creators?.[0]?.user_id || creatorUid || ''
        const sourceName = data.creators?.[0]?.nickname || ''
        if (data.creators && data.creators.length > 0) {
          for (const creator of data.creators) {
            const uid = creator.user_id || creator.uid || ''
            const creatorName = creator.nickname || creator.name || ''
            const creatorAvatar = creator.avatar || creator.face || creator.avatar_url || ''
            const totalFans = parseInt(creator.total_fans) || 0
            await db.saveCreator(uid, creatorName, creatorAvatar, totalFans, accountId)
          }
          await db.saveCrawlCreatorsBatch(taskId, platform, data.creators)
        }

        // 保存内容数据
        if (data.contents && data.contents.length > 0) {
          await db.saveCrawlContentBatch(taskId, platform, data.contents, sourceUid, sourceName)
        }
      }
    }

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
