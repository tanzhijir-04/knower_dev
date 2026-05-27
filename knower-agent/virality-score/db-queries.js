/**
 * 数据库查询封装 — 为评分管线准备上下文数据
 */

const {
  getAllCrawlContent,
  getTopContent,
  getMemories,
} = require('../db')

/**
 * 获取指定平台的全部爬取内容
 */
async function fetchAllContent(platform) {
  const raw = await getAllCrawlContent(platform)
  return raw.map(r => ({
    id: r.id,
    title: r.title || '',
    desc: r.desc || '',
    category: r.category || '未分类',
    createdAt: r.createdAt,
    playCount: r.playCount || 0,
    likeCount: r.likeCount || 0,
    commentCount: r.commentCount || 0,
    shareCount: r.shareCount || 0,
    authorName: r.authorName || '',
    authorId: r.authorId || '',
    sourceUid: r.sourceUid || '',
    sourceName: r.sourceName || '',
  }))
}

/**
 * 获取指定创作者的历史数据（用于 creatorAffinity 维度）
 */
async function fetchCreatorHistory(platform, creatorUid) {
  const all = await fetchAllContent(platform)
  if (!creatorUid) return all
  return all.filter(r => r.sourceUid === creatorUid || r.authorId === creatorUid)
}

/**
 * 获取创作者的 memories（用于 style_consistency 指标）
 */
async function fetchMemories(accountId = 'default') {
  return getMemories(accountId)
}

/**
 * 获取中位数播放量（用于 category_match 判断）
 */
async function getMedianPlay(platform) {
  const all = await fetchAllContent(platform)
  if (!all.length) return 0
  const plays = all.map(r => r.playCount).sort((a, b) => a - b)
  const mid = Math.floor(plays.length / 2)
  return plays.length % 2 === 0
    ? (plays[mid - 1] + plays[mid]) / 2
    : plays[mid]
}

/**
 * 计算最近 N 天的总视频数（用于 topic_density）
 */
function countRecentDays(data, days, now) {
  const cutoff = new Date(now).getTime() - days * 24 * 60 * 60 * 1000
  return data.filter(r => new Date(r.createdAt).getTime() >= cutoff).length
}

module.exports = {
  fetchAllContent,
  fetchCreatorHistory,
  fetchMemories,
  getMedianPlay,
  countRecentDays,
}
