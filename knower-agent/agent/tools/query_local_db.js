const db = require('../../db')

module.exports = {
  name: 'query_local_db',
  description: `按需查询本地数据库，获取爬取数据、脚本、选题、复盘、竞品、记忆等信息。

**什么时候必须调用：**
- 你已经爬取了数据，需要按条件筛选具体条目时
- 用户说"看看B站点赞最高的""筛选播放量过万的"
- 你之前的工具返回了摘要（stored: true），需要查看具体数据时
- 需要查看历史脚本、选题记录、复盘数据、竞品信息时

**什么时候不要调用：**
- 用户要爬新数据（用 crawl_data）
- 用户要生成新内容（用 expand_script）
- 数据还在 state.crawlData 中（直接引用即可）`,
  input_schema: {
    type: 'object',
    properties: {
      query_type: {
        type: 'string',
        enum: ['crawl_data', 'scripts', 'topics', 'reviews', 'competitors', 'memory'],
        description: '查询类型',
      },
      filters: {
        type: 'object',
        description: '查询条件。crawl_data 支持: platform, sourceUid, keyword, minLikes, minPlays, category。scripts 支持: scriptId。topics 支持: platform, starredOnly。reviews 支持: platform。competitors 支持: platform。memory 无需额外条件。',
      },
      limit: {
        type: 'number',
        description: '返回条数，默认 20，最大 50',
      },
    },
    required: ['query_type'],
  },
  async execute({ query_type, filters = {}, limit = 20, accountId }) {
    const aid = accountId || 'default'
    const maxLimit = Math.min(limit || 20, 50)

    try {
      switch (query_type) {
        case 'crawl_data':
          return await queryCrawlData(filters, maxLimit, aid)
        case 'scripts':
          return await queryScripts(filters, maxLimit, aid)
        case 'topics':
          return await queryTopics(filters, maxLimit, aid)
        case 'reviews':
          return await queryReviews(filters, maxLimit, aid)
        case 'competitors':
          return await queryCompetitors(filters, maxLimit, aid)
        case 'memory':
          return await queryMemory(aid)
        default:
          return { success: false, error: `不支持的查询类型: ${query_type}` }
      }
    } catch (err) {
      return { success: false, error: err.message }
    }
  },
}

// --- crawl_data 查询 ---
async function queryCrawlData(filters, limit, accountId) {
  const { platform, sourceUid, keyword, minLikes, minPlays, category } = filters

  if (sourceUid) {
    const videos = await db.getVideosBySource(platform || 'bili', sourceUid, accountId)
    let filtered = videos
    if (minLikes) filtered = filtered.filter(v => (v.likeCount || 0) >= minLikes)
    if (minPlays) filtered = filtered.filter(v => (v.playCount || 0) >= minPlays)
    return {
      success: true,
      queryType: 'crawl_data',
      sourceUid,
      totalCount: filtered.length,
      items: filtered.slice(0, limit).map(v => ({
        title: (v.title || '').slice(0, 80),
        playCount: v.playCount,
        likeCount: v.likeCount,
        commentCount: v.commentCount,
        category: v.category,
      })),
    }
  }

  // 使用 getAllCrawlContent 然后手动过滤
  const all = await db.getAllCrawlContent(platform === 'all' ? null : platform, accountId)
  let filtered = all
  if (keyword) {
    const kw = keyword.toLowerCase()
    filtered = filtered.filter(v =>
      (v.title || '').toLowerCase().includes(kw) ||
      (v.desc || '').toLowerCase().includes(kw) ||
      (v.authorName || '').toLowerCase().includes(kw)
    )
  }
  if (minLikes) filtered = filtered.filter(v => (v.likeCount || 0) >= minLikes)
  if (minPlays) filtered = filtered.filter(v => (v.playCount || 0) >= minPlays)
  if (category) {
    const cat = category.toLowerCase()
    filtered = filtered.filter(v => (v.category || '').toLowerCase().includes(cat))
  }

  return {
    success: true,
    queryType: 'crawl_data',
    totalCount: filtered.length,
    items: filtered.slice(0, limit).map(v => ({
      title: (v.title || '').slice(0, 80),
      authorName: v.authorName,
      playCount: v.playCount,
      likeCount: v.likeCount,
      commentCount: v.commentCount,
      category: v.category,
      platform: v.platform,
    })),
  }
}

// --- scripts 查询 ---
async function queryScripts(filters, limit, accountId) {
  if (filters.scriptId) {
    const script = await db.getScript(filters.scriptId)
    if (!script) return { success: true, queryType: 'scripts', items: [] }
    return {
      success: true,
      queryType: 'scripts',
      items: [{
        id: script.id,
        content: (script.content || '').slice(0, 200),
        analysis: script.analysis,
        createdAt: script.created_at,
      }],
    }
  }

  const scripts = await db.listScripts(limit, accountId)
  return {
    success: true,
    queryType: 'scripts',
    totalCount: scripts.length,
    items: scripts.map(s => ({ id: s.id, createdAt: s.created_at })),
  }
}

// --- topics 查询 ---
async function queryTopics(filters, limit, accountId) {
  const items = []

  // 查询 saved_topics
  const saved = await db.getSavedTopics(filters.platform || null, accountId)
  if (saved.length > 0) {
    items.push(...saved.slice(0, limit).map(t => ({
      source: 'saved',
      id: t.id,
      title: t.title,
      reason: (t.reason || '').slice(0, 100),
      platform: t.platform,
      tags: t.tags,
    })))
  }

  // 查询 topic_history
  const history = await db.getTopicHistory(filters.platform || null, accountId, limit)
  if (history.length > 0) {
    const historyItems = history
      .filter(h => !filters.starredOnly || h.isStarred)
      .slice(0, limit)
      .map(h => ({
        source: 'history',
        id: h.id,
        platform: h.platform,
        mode: h.mode,
        topicCount: h.topicCount,
        isStarred: h.isStarred,
        createdAt: h.createdAt,
        topics: (h.topics || []).slice(0, 3).map(t => ({
          title: (t.title || '').slice(0, 60),
          score: t.totalScore,
        })),
      }))
    items.push(...historyItems)
  }

  return {
    success: true,
    queryType: 'topics',
    totalCount: items.length,
    items: items.slice(0, limit),
  }
}

// --- reviews 查询 ---
async function queryReviews(filters, limit, accountId) {
  const reviews = await db.getReviews(accountId, filters.platform || undefined)
  return {
    success: true,
    queryType: 'reviews',
    totalCount: reviews.length,
    items: reviews.slice(0, limit).map(r => ({
      id: r.id,
      title: (r.title || '').slice(0, 80),
      platform: r.platform,
      publishDate: r.publishDate,
      views: r.views,
      likes: r.likes,
      comments: r.comments,
      rating: r.rating,
    })),
  }
}

// --- competitors 查询 ---
async function queryCompetitors(filters, limit, accountId) {
  const competitors = await db.getCompetitors(filters.platform || 'bili', accountId)
  const items = competitors.slice(0, limit).map(c => ({
    id: c.id,
    platform: c.platform,
    userId: c.userId,
    nickname: c.nickname,
    lastCheckedAt: c.lastCheckedAt,
  }))

  // 如果有竞品，获取最近内容摘要
  if (items.length > 0) {
    const uids = items.map(c => c.userId)
    const recent = await db.getCompetitorRecentContent(filters.platform || 'bili', uids, 7, accountId)
    return {
      success: true,
      queryType: 'competitors',
      totalCount: items.length,
      items,
      recentContentCount: recent.length,
      recentSample: recent.slice(0, 5).map(r => ({
        title: (r.title || '').slice(0, 60),
        likeCount: r.likeCount,
        playCount: r.playCount,
      })),
    }
  }

  return {
    success: true,
    queryType: 'competitors',
    totalCount: 0,
    items: [],
  }
}

// --- memory 查询 ---
async function queryMemory(accountId) {
  const memories = await db.getMemories(accountId)
  return {
    success: true,
    queryType: 'memory',
    totalCount: memories.length,
    items: memories.map(m => ({
      type: m.type,
      key: m.key,
      value: (m.value || '').slice(0, 100),
      evidence: (m.evidence || '').slice(0, 100),
      weight: m.weight,
    })),
  }
}
