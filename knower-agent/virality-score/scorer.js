/**
 * 评分融合模块 — 维度内合并 + 维度间加权 + 置信度
 */

const DIMENSIONS = {
  velocity: {
    name: '互动速率',
    weight: 0.30,
    indicators: ['play_velocity', 'engagement_velocity', 'engagement_rate'],
    subWeights: [0.30, 0.40, 0.30],
  },
  trend: {
    name: '话题趋势',
    weight: 0.25,
    indicators: ['trend_acceleration', 'topic_density', 'freshness_decay'],
    subWeights: [0.50, 0.30, 0.20],
  },
  affinity: {
    name: '创作者亲和度',
    weight: 0.20,
    indicators: ['category_match', 'title_similarity', 'style_consistency'],
    subWeights: [0.40, 0.35, 0.25],
  },
  pattern: {
    name: '内容模式',
    weight: 0.15,
    indicators: ['title_structure', 'duration_fit', 'timing_fit'],
    subWeights: [0.50, 0.25, 0.25],
  },
  platformFit: {
    name: '平台适配',
    weight: 0.10,
    indicators: ['topic_density', 'freshness_decay'],
    subWeights: [0.60, 0.40],
  },
}

const PRESETS = {
  default: {
    velocity: 0.30, trend: 0.25, affinity: 0.20, pattern: 0.15, platformFit: 0.10,
  },
  newCreator: {
    velocity: 0.25, trend: 0.35, affinity: 0.05, pattern: 0.20, platformFit: 0.15,
  },
  mature: {
    velocity: 0.30, trend: 0.20, affinity: 0.30, pattern: 0.15, platformFit: 0.05,
  },
  trendHunter: {
    velocity: 0.20, trend: 0.45, affinity: 0.10, pattern: 0.15, platformFit: 0.10,
  },
}

/**
 * 计算单个维度的分数
 * @param {Object} normalizedScores - 归一化后的 12 个指标分数 (0-100)
 * @param {string} dimKey - 维度 key
 * @returns {number} 维度分数 (0-100)
 */
function computeDimensionScore(normalizedScores, dimKey) {
  const dim = DIMENSIONS[dimKey]
  if (!dim) return 0

  let total = 0
  let weightSum = 0
  for (let i = 0; i < dim.indicators.length; i++) {
    const val = normalizedScores[dim.indicators[i]] ?? 50
    total += val * dim.subWeights[i]
    weightSum += dim.subWeights[i]
  }
  return weightSum > 0 ? total / weightSum : 50
}

/**
 * 计算总分
 * @param {Object} normalizedScores - 归一化后的 12 个指标分数
 * @param {Object} weights - 维度权重覆盖（可选）
 * @returns {{ score: number, dimensions: Object }}
 */
function computeTotalScore(normalizedScores, weights = null) {
  const w = weights || Object.fromEntries(
    Object.entries(DIMENSIONS).map(([k, d]) => [k, d.weight])
  )

  const dimensions = {}
  let total = 0
  let weightSum = 0

  for (const [dimKey, dim] of Object.entries(DIMENSIONS)) {
    const dimScore = computeDimensionScore(normalizedScores, dimKey)
    dimensions[dimKey] = {
      name: dim.name,
      score: Math.round(dimScore),
      weight: w[dimKey] || dim.weight,
    }
    total += dimScore * (w[dimKey] || dim.weight)
    weightSum += (w[dimKey] || dim.weight)
  }

  const score = weightSum > 0 ? Math.round(total / weightSum) : 50

  return { score, dimensions }
}

/**
 * 计算置信度
 * @param {Object} dataAvailability - 各维度数据是否充足
 * @returns {{ level: string, score: number, missing: string[] }}
 */
function computeConfidence(dataAvailability) {
  const dimKeys = Object.keys(DIMENSIONS)
  const available = dimKeys.filter(k => dataAvailability[k])
  const missing = dimKeys.filter(k => !dataAvailability[k])

  let level
  if (available.length >= 5) level = 'high'
  else if (available.length >= 3) level = 'medium'
  else if (available.length >= 1) level = 'low'
  else level = 'none'

  return {
    level,
    score: available.length / dimKeys.length,
    missing,
    availableCount: available.length,
    total: dimKeys.length,
  }
}

/**
 * 生成人类可读的评分解读
 */
function generateInterpretation(scoreResult, confidence) {
  const { score, dimensions } = scoreResult
  const lines = []

  // 总评
  if (score >= 80) lines.push('这个选题的爆款潜力很高。')
  else if (score >= 60) lines.push('这个选题值得尝试，但有改进空间。')
  else lines.push('这个选题的风险较大，建议调整后再说。')

  // 最强维度
  const sorted = Object.entries(dimensions).sort((a, b) => b[1].score - a[1].score)
  const best = sorted[0]
  const worst = sorted[sorted.length - 1]

  lines.push(`最大优势：${best[1].name}（${best[1].score}分）`)
  lines.push(`最大短板：${worst[1].name}（${worst[1].score}分）`)

  // 置信度提示
  if (confidence.level === 'low') {
    lines.push(`⚠️ 数据不足（${confidence.availableCount}/${confidence.total}维度），评分仅供参考。`)
  } else if (confidence.level === 'medium') {
    lines.push(`部分维度数据不足（缺少：${confidence.missing.map(k => DIMENSIONS[k]?.name).join('、')}），评分有一定偏差。`)
  }

  return lines.join('\n')
}

module.exports = {
  DIMENSIONS,
  PRESETS,
  computeDimensionScore,
  computeTotalScore,
  computeConfidence,
  generateInterpretation,
}
