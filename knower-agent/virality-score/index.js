/**
 * 病毒性评分 — 主入口
 *
 * 流程：DB 数据 → 原始指标 → 归一化 → 加权融合 → 分数 + 解读
 */

const { computeRawIndicators, computeCategoryStats, extractTopTitlePatterns, extractBestHours } = require('./metrics')
const { fitNormalizers, transformRow } = require('./normalizer')
const { computeTotalScore, computeConfidence, generateInterpretation, PRESETS } = require('./scorer')
const { fetchAllContent, fetchCreatorHistory, fetchMemories, getMedianPlay, countRecentDays } = require('./db-queries')

/**
 * 对单条内容计算病毒性评分
 * @param {Object} target - 目标内容（需要评分的选题/内容）
 * @param {Object} opts - 可选参数
 * @param {string} opts.platform - 平台 ('bili'|'dy'|'xhs'|'wb')
 * @param {string} opts.creatorUid - 目标创作者 UID（可选）
 * @param {string} opts.preset - 权重预设 ('default'|'newCreator'|'mature'|'trendHunter')
 * @param {Object} opts.weights - 自定义维度权重覆盖（可选）
 * @returns {Promise<Object>} 评分结果
 */
async function computeScore(target, opts = {}) {
  const {
    platform = 'bili',
    creatorUid = null,
    preset = 'default',
    weights = null,
  } = opts

  const now = new Date().toISOString()

  // 1. 从 DB 拉取数据
  const allData = await fetchAllContent(platform)
  if (allData.length === 0) {
    return {
      score: 50,
      dimensions: {},
      confidence: { level: 'none', score: 0, missing: ['velocity', 'trend', 'affinity', 'pattern', 'platformFit'], availableCount: 0, total: 5 },
      interpretation: '数据库中没有爬取数据，无法评分。请先运行爬虫获取内容数据。',
      rawIndicators: null,
      normalizedScores: null,
    }
  }

  // 2. 构建上下文
  const creatorHistory = creatorUid
    ? await fetchCreatorHistory(platform, creatorUid)
    : allData
  const memories = await fetchMemories()
  const medianPlay = await getMedianPlay(platform)
  const categoryStats = computeCategoryStats(allData, now)
  const topContent = allData.filter(r => r.playCount > medianPlay)
  const topTitlePatterns = extractTopTitlePatterns(topContent.length > 0 ? topContent : allData.slice(0, 20))
  const bestHours = extractBestHours(topContent.length > 0 ? topContent : allData.slice(0, 20))

  const ctx = {
    now,
    categoryStats,
    creatorHistory,
    memories,
    medianPlay,
    totalRecent7d: countRecentDays(allData, 7, now),
    topTitlePatterns,
    bestHours,
  }

  // 3. 为全部数据计算原始指标（用于归一化的训练集）
  const allIndicators = allData.map(row => computeRawIndicators(row, ctx))

  // 4. 在训练集上 fit normalizers
  const normalizers = fitNormalizers(allIndicators)

  // 5. 对目标内容计算原始指标
  const targetRow = {
    title: target.title || '',
    desc: target.desc || '',
    category: target.category || '未分类',
    createdAt: target.createdAt || now,
    playCount: target.playCount || 0,
    likeCount: target.likeCount || 0,
    commentCount: target.commentCount || 0,
    shareCount: target.shareCount || 0,
  }

  // 如果有目标创作者，补充 creatorHistory 上下文
  if (creatorUid) {
    ctx.creatorHistory = creatorHistory
  }

  const targetRaw = computeRawIndicators(targetRow, ctx)

  // 6. 用训练集分布归一化目标
  const normalized = transformRow(targetRaw, normalizers)

  // 7. 评分融合
  const weightSource = weights || PRESETS[preset] || null
  const scoreResult = computeTotalScore(normalized, weightSource)

  // 8. 置信度
  const dataAvailability = {}
  for (const [dimKey, dim] of Object.entries(require('./scorer').DIMENSIONS)) {
    const hasData = dim.indicators.some(ind => allIndicators.some(ai => ai[ind] !== undefined && ai[ind] !== null))
    dataAvailability[dimKey] = hasData
  }
  const confidence = computeConfidence(dataAvailability)

  // 9. 生成解读
  const interpretation = generateInterpretation(scoreResult, confidence)

  return {
    score: scoreResult.score,
    dimensions: scoreResult.dimensions,
    confidence,
    interpretation,
    rawIndicators: targetRaw,
    normalizedScores: normalized,
    meta: {
      platform,
      preset,
      dataCount: allData.length,
      categoryCount: Object.keys(categoryStats).length,
    },
  }
}

/**
 * 批量评分 — 对多条内容同时打分
 */
async function batchScore(targets, opts = {}) {
  const results = []
  for (const target of targets) {
    const result = await computeScore(target, opts)
    results.push({ target, ...result })
  }
  return results.sort((a, b) => b.score - a.score)
}

module.exports = {
  computeScore,
  batchScore,
  // 导出子模块供测试/调试
  metrics: require('./metrics'),
  normalizer: require('./normalizer'),
  scorer: require('./scorer'),
}
