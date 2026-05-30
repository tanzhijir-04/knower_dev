const { runCrawler } = require('../../lib/crawler')
const db = require('../../db')

module.exports = {
  name: 'crawl_data',
  description: `爬取指定平台的公开数据。支持按关键词搜索或爬取创作者主页。

**什么时候必须调用：**
- 用户提到"分析UP主/创作者/博主/账号" + 平台名或UID
- 用户说"帮我看看这个人的数据"
- 用户说"爬一下B站/抖音/小红书/微博的数据"

**什么时候不要调用：**
- 用户只是随口提到了一个平台名，但没有分析意图
- 用户说"我之前爬过的数据"（应该用 query_data）

**常见错误：**
- 用户只说了"分析UP主"但没给UID -> 不要猜，先调用 request_user_input
- 用户说"分析B站"但没给具体目标 -> 先确认是关键词搜索还是创作者主页`,
  input_schema: {
    type: 'object',
    properties: {
      platform: {
        type: 'string',
        enum: ['bili', 'dy', 'xhs', 'wb'],
        description: '平台：bili=B站, dy=抖音, xhs=小红书, wb=微博',
      },
      keyword: {
        type: 'string',
        description: '搜索关键词（关键词搜索模式时使用）',
      },
      creatorUid: {
        type: 'string',
        description: '创作者 UID（创作者主页模式时使用）',
      },
      maxNotes: {
        type: 'number',
        description: '最大爬取数量，默认 15',
      },
    },
    required: ['platform'],
  },
  async execute({ platform, keyword, creatorUid, maxNotes, accountId, onProgress }) {
    const options = { maxNotes: maxNotes || 15 }

    if (creatorUid) {
      options.crawlerType = 'creator'
      options.creatorId = creatorUid
    } else if (keyword) {
      options.crawlerType = 'search'
    } else {
      return { error: '请提供 keyword 或 creatorUid' }
    }

    try {
      const result = await runCrawler(platform, keyword || '', options, onProgress)

      // 保存到数据库
      const taskId = await db.saveCrawlTask(platform, keyword || creatorUid || '', 'agent_crawl', 'completed', '', accountId)

      // 保存创作者数据
      const sourceUid = result.creators?.[0]?.user_id || creatorUid || ''
      const sourceName = result.creators?.[0]?.nickname || ''
      if (result.creators && result.creators.length > 0) {
        for (const creator of result.creators) {
          const uid = creator.user_id || creator.uid || ''
          const creatorName = creator.nickname || creator.name || ''
          const creatorAvatar = creator.avatar || creator.face || creator.avatar_url || ''
          const totalFans = parseInt(creator.total_fans) || 0
          await db.saveCreator(uid, creatorName, creatorAvatar, totalFans, accountId)
        }
        await db.saveCrawlCreatorsBatch(taskId, platform, result.creators)
      }

      // 保存内容数据
      if (result.contents && result.contents.length > 0) {
        await db.saveCrawlContentBatch(taskId, platform, result.contents, sourceUid, sourceName)
      }

      return {
        success: true,
        platform,
        taskId,
        totalCount: result.stats?.total_contents || 0,
        creators: (result.creators || []).map(c => ({
          nickname: c.nickname,
          userId: c.user_id,
          fans: c.total_fans,
        })),
        topContents: (result.contents || []).slice(0, 10).map(c => ({
          title: c.title,
          playCount: c.video_play_count || c.play_count || 0,
          likeCount: c.liked_count || 0,
          commentCount: c.video_comment || c.comment_count || 0,
        })),
        message: `成功爬取 ${result.stats?.total_contents || 0} 条数据`,
      }
    } catch (err) {
      return { success: false, error: err.message }
    }
  },
}
