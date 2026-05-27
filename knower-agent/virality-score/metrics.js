/**
 * 指标计算模块 — 从 crawl_content 原始数据计算 12 个指标
 *
 * 输入：crawl_content 行（来自 getAllCrawlContent）
 * 输出：每行附加 12 个原始指标值
 */

function hoursDiff(earlier, later) {
  const ms = new Date(later).getTime() - new Date(earlier).getTime()
  return Math.max(ms / (1000 * 60 * 60), 0.1) // 最小 0.1h 避免除零
}

/**
 * 从单条 crawl_content 行计算原始指标值
 */
function computeRawIndicators(row, ctx) {
  const hoursSincePublish = row.createdAt
    ? hoursDiff(row.createdAt, ctx.now)
    : 24 // 默认 24h

  const play = row.playCount || 0
  const like = row.likeCount || 0
  const comment = row.commentCount || 0
  const share = row.shareCount || 0
  const engagement = like + comment + share

  // === 维度 1: 互动速率 ===
  const play_velocity = play / hoursSincePublish
  const engagement_velocity = engagement / hoursSincePublish
  const engagement_rate = play > 0 ? engagement / play : 0

  // === 维度 2: 话题趋势 ===
  // trend_acceleration: 需要 ctx 中的分类统计数据
  const category = row.category || '未分类'
  const catStats = ctx.categoryStats?.[category]
  const trend_acceleration = catStats
    ? (catStats.avgPlay7d / (catStats.avgPlay30d || 1))
    : 1.0

  // topic_density: 该分类在近 7 天的视频占比
  const topic_density = catStats
    ? (catStats.count7d / (ctx.totalRecent7d || 1))
    : 0.05

  // freshness_decay: 该分类下 top 视频的平均年龄
  const freshness_decay = catStats
    ? Math.max(0, 1 - (catStats.avgAgeDays || 7) / 30)
    : 0.5

  // === 维度 3: 创作者亲和度 ===
  // category_match: 该创作者在该分类的历史 top 内容占比
  const creatorHistory = ctx.creatorHistory || []
  const creatorTopInCat = creatorHistory.filter(
    v => v.category === category && v.playCount > (ctx.medianPlay || 0)
  ).length
  const category_match = creatorHistory.length > 0
    ? creatorTopInCat / creatorHistory.length
    : 0.5

  // title_similarity: 简单版 — 关键词重叠度
  const titleWords = extractWords(row.title || '')
  const historyWords = new Set(creatorHistory.flatMap(v => extractWords(v.title || '')))
  const title_similarity = historyWords.size > 0
    ? titleWords.filter(w => historyWords.has(w)).length / Math.max(titleWords.length, 1)
    : 0.5

  // style_consistency: 基于 memories 的匹配度
  const memories = ctx.memories || []
  const style_consistency = memories.length > 0
    ? memories.filter(m => titleWords.some(w => m.value.includes(w))).length / memories.length
    : 0.5

  // === 维度 4: 内容模式 ===
  const title_structure = computeTitleStructure(row.title || '', ctx.topTitlePatterns)
  const duration_fit = 0.5 // MVP: 没有视频时长数据，给中间值
  const timing_fit = computeTimingFit(row.createdAt, ctx.bestHours)

  return {
    play_velocity,
    engagement_velocity,
    engagement_rate,
    trend_acceleration,
    topic_density,
    freshness_decay,
    category_match,
    title_similarity,
    style_consistency,
    title_structure,
    duration_fit,
    timing_fit,
  }
}

/**
 * 简单中文分词 — 按标点和空格切分，过滤单字
 */
function extractWords(text) {
  return text
    .replace(/[，。！？、；：""''（）【】《》\s]+/g, ' ')
    .split(' ')
    .filter(w => w.length > 1)
}

/**
 * 标题结构评分 — 检查数字、问句、情感词、列表体
 */
function computeTitleStructure(title, topPatterns) {
  let score = 0
  const total = 5

  // 包含数字
  if (/\d/.test(title)) score++
  // 问句
  if (/[？?为什么怎么如何]/.test(title)) score++
  // 情感词
  if (/震撼|太绝|惊艳|离谱|炸裂|绝了|必看|宝藏/.test(title)) score++
  // 列表体
  if (/盘点|合集|推荐|分享|总结|个方法|个技巧/.test(title)) score++
  // 长度在 10-30 字之间
  if (title.length >= 10 && title.length <= 30) score++

  // 如果有历史 pattern 数据，用历史 pattern 的匹配度加权
  if (topPatterns && topPatterns.length > 0) {
    const matchCount = topPatterns.filter(p => title.includes(p)).length
    const patternBonus = Math.min(matchCount / topPatterns.length, 0.3)
    return Math.min((score / total + patternBonus) * 100, 100)
  }

  return (score / total) * 100
}

/**
 * 发布时间适配 — 检查是否在最优时段
 */
function computeTimingFit(createdAt, bestHours) {
  if (!createdAt || !bestHours) return 50
  const hour = new Date(createdAt).getHours()
  return bestHours.includes(hour) ? 80 : 40
}

/**
 * 计算分类统计数据 — 用于 trend_acceleration, topic_density, freshness_decay
 */
function computeCategoryStats(allData, now) {
  const stats = {}
  const nowMs = new Date(now).getTime()
  const dayMs = 24 * 60 * 60 * 1000

  for (const row of allData) {
    const cat = row.category || '未分类'
    if (!stats[cat]) {
      stats[cat] = { plays7d: [], plays30d: [], ages7d: [], count7d: 0, count30d: 0 }
    }
    const s = stats[cat]
    const ageMs = nowMs - new Date(row.createdAt || now).getTime()
    const ageDays = ageMs / dayMs

    if (ageDays <= 30) {
      s.plays30d.push(row.playCount || 0)
      s.count30d++
    }
    if (ageDays <= 7) {
      s.plays7d.push(row.playCount || 0)
      s.ages7d.push(ageDays)
      s.count7d++
    }
  }

  const result = {}
  for (const [cat, s] of Object.entries(stats)) {
    result[cat] = {
      avgPlay7d: s.plays7d.length > 0 ? s.plays7d.reduce((a, b) => a + b, 0) / s.plays7d.length : 0,
      avgPlay30d: s.plays30d.length > 0 ? s.plays30d.reduce((a, b) => a + b, 0) / s.plays30d.length : 0,
      avgAgeDays: s.ages7d.length > 0 ? s.ages7d.reduce((a, b) => a + b, 0) / s.ages7d.length : 15,
      count7d: s.count7d,
      count30d: s.count30d,
    }
  }
  return result
}

/**
 * 提取历史高互动标题中的高频词 — 用于 title_structure pattern
 */
function extractTopTitlePatterns(topContent, limit = 10) {
  const wordFreq = {}
  for (const item of topContent) {
    const words = extractWords(item.title || '')
    for (const w of words) {
      wordFreq[w] = (wordFreq[w] || 0) + 1
    }
  }
  return Object.entries(wordFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word]) => word)
}

/**
 * 提取最优发布时间段 — 从历史数据中取 top 25% 的发布小时
 */
function extractBestHours(topContent) {
  const hourFreq = {}
  for (const item of topContent) {
    if (item.createdAt) {
      const hour = new Date(item.createdAt).getHours()
      hourFreq[hour] = (hourFreq[hour] || 0) + (item.playCount || 0)
    }
  }
  const sorted = Object.entries(hourFreq)
    .sort((a, b) => b[1] - a[1])
  const topQuarter = Math.max(1, Math.ceil(sorted.length * 0.25))
  return sorted.slice(0, topQuarter).map(([h]) => parseInt(h))
}

module.exports = {
  computeRawIndicators,
  computeCategoryStats,
  extractTopTitlePatterns,
  extractBestHours,
  extractWords,
}
