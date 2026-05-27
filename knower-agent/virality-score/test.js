/**
 * 病毒性评分 — 单元测试（纯内存 mock 数据，不依赖 DB）
 */

const { computeRawIndicators, computeCategoryStats, extractTopTitlePatterns, extractBestHours } = require('./metrics')
const { PercentileNormalizer, MinMaxNormalizer, ZScoreNormalizer, LogMinMaxNormalizer, fitNormalizers, transformRow } = require('./normalizer')
const { DIMENSIONS, PRESETS, computeDimensionScore, computeTotalScore, computeConfidence, generateInterpretation } = require('./scorer')

// ── Mock 数据 ──

function mockData() {
  const now = Date.now()
  const hour = 3600000
  const day = 86400000

  return [
    // 高表现内容
    { title: '2024年度十大震撼瞬间盘点', category: '科技', createdAt: new Date(now - 2 * hour).toISOString(), playCount: 500000, likeCount: 35000, commentCount: 4200, shareCount: 8000 },
    { title: '为什么这个方法太绝了', category: '生活', createdAt: new Date(now - 5 * hour).toISOString(), playCount: 320000, likeCount: 28000, commentCount: 3500, shareCount: 5000 },
    { title: '3个技巧让你的视频播放量翻倍', category: '教程', createdAt: new Date(now - 8 * hour).toISOString(), playCount: 180000, likeCount: 15000, commentCount: 2100, shareCount: 3000 },
    // 中等表现
    { title: '分享一下我的创作心得', category: '教程', createdAt: new Date(now - 1 * day).toISOString(), playCount: 45000, likeCount: 3200, commentCount: 450, shareCount: 800 },
    { title: '日常vlog第23期', category: '生活', createdAt: new Date(now - 2 * day).toISOString(), playCount: 30000, likeCount: 2100, commentCount: 300, shareCount: 500 },
    // 低表现
    { title: '随便拍的', category: '生活', createdAt: new Date(now - 5 * day).toISOString(), playCount: 8000, likeCount: 500, commentCount: 80, shareCount: 150 },
    { title: '今天天气真好', category: '生活', createdAt: new Date(now - 10 * day).toISOString(), playCount: 3000, likeCount: 200, commentCount: 30, shareCount: 50 },
    // 更多数据
    { title: '宝藏博主推荐合集', category: '科技', createdAt: new Date(now - 3 * hour).toISOString(), playCount: 420000, likeCount: 30000, commentCount: 3800, shareCount: 7000 },
    { title: '如何做出爆款视频？5个核心方法', category: '教程', createdAt: new Date(now - 12 * hour).toISOString(), playCount: 95000, likeCount: 7500, commentCount: 1100, shareCount: 1800 },
    { title: '这个操作太离谱了', category: '科技', createdAt: new Date(now - 6 * hour).toISOString(), playCount: 280000, likeCount: 22000, commentCount: 2800, shareCount: 4500 },
    { title: '深度解析AI绘画的未来', category: '科技', createdAt: new Date(now - 15 * hour).toISOString(), playCount: 120000, likeCount: 9000, commentCount: 1500, shareCount: 2500 },
    { title: '一周穿搭分享必看', category: '生活', createdAt: new Date(now - 1 * day).toISOString(), playCount: 65000, likeCount: 4800, commentCount: 650, shareCount: 1200 },
  ]
}

// ── 测试函数 ──

let pass = 0
let fail = 0

function assert(condition, msg) {
  if (condition) {
    pass++
    console.log(`  ✓ ${msg}`)
  } else {
    fail++
    console.log(`  ✗ ${msg}`)
  }
}

function assertRange(val, min, max, msg) {
  assert(typeof val === 'number' && val >= min && val <= max, `${msg} (got ${val})`)
}

// ── Test 1: 原始指标计算 ──

console.log('\n=== Test 1: computeRawIndicators ===')
{
  const data = mockData()
  const now = new Date().toISOString()
  const categoryStats = computeCategoryStats(data, now)
  const topContent = data.filter(r => r.playCount > 30000)
  const topTitlePatterns = extractTopTitlePatterns(topContent)
  const bestHours = extractBestHours(topContent)

  const ctx = {
    now,
    categoryStats,
    creatorHistory: data,
    memories: [{ value: '科技' }, { value: '教程' }],
    medianPlay: 30000,
    totalRecent7d: data.length,
    topTitlePatterns,
    bestHours,
  }

  // 测试高表现内容
  const high = computeRawIndicators(data[0], ctx)
  assert(typeof high.play_velocity === 'number', 'play_velocity 是数字')
  assert(high.play_velocity > 0, '高表现内容 play_velocity > 0')
  assert(typeof high.engagement_rate === 'number', 'engagement_rate 是数字')
  assert(high.engagement_rate > 0, '高表现内容 engagement_rate > 0')
  assert(typeof high.trend_acceleration === 'number', 'trend_acceleration 是数字')
  assert(typeof high.title_structure === 'number', 'title_structure 是数字')
  assertRange(high.title_structure, 0, 100, 'title_structure 在 0-100')

  // 测试低表现内容
  const low = computeRawIndicators(data[6], ctx)
  assert(low.play_velocity < high.play_velocity, '低表现内容 play_velocity 更小')
  assert(low.engagement_rate < high.engagement_rate, '低表现内容 engagement_rate 更小')
}

// ── Test 2: 归一化器 ──

console.log('\n=== Test 2: Normalizers ===')
{
  // PercentileNormalizer
  const pn = new PercentileNormalizer()
  pn.fit([10, 20, 30, 40, 50, 60, 70, 80, 90, 100])
  assert(pn.transform(50) === 40, 'PercentileNormalizer: 50 → 40%')
  assert(pn.transform(10) === 0, 'PercentileNormalizer: min → 0')
  assert(pn.transform(100) === 90, 'PercentileNormalizer: max → 90')

  // MinMaxNormalizer
  const mm = new MinMaxNormalizer()
  mm.fit([10, 20, 30, 40, 50])
  assert(mm.transform(30) === 50, 'MinMaxNormalizer: 中值 → 50')
  assert(mm.transform(10) === 0, 'MinMaxNormalizer: min → 0')
  assert(mm.transform(50) === 100, 'MinMaxNormalizer: max → 100')

  // ZScoreNormalizer
  const zs = new ZScoreNormalizer()
  zs.fit([10, 20, 30, 40, 50])
  assertRange(zs.transform(30), 40, 60, 'ZScoreNormalizer: 均值附近 → ~50')

  // LogMinMaxNormalizer
  const lm = new LogMinMaxNormalizer()
  lm.fit([0, 10, 100, 1000, 10000])
  assertRange(lm.transform(100), 30, 70, 'LogMinMaxNormalizer: 中间值 → 中等分数')
  assert(lm.transform(10000) > lm.transform(10), 'LogMinMaxNormalizer: 大值 > 小值')
}

// ── Test 3: fitNormalizers + transformRow ──

console.log('\n=== Test 3: fitNormalizers + transformRow ===')
{
  const data = mockData()
  const now = new Date().toISOString()
  const categoryStats = computeCategoryStats(data, now)
  const ctx = {
    now,
    categoryStats,
    creatorHistory: data,
    memories: [{ value: '科技' }],
    medianPlay: 30000,
    totalRecent7d: data.length,
    topTitlePatterns: extractTopTitlePatterns(data),
    bestHours: extractBestHours(data),
  }

  const allIndicators = data.map(row => computeRawIndicators(row, ctx))
  const normalizers = fitNormalizers(allIndicators)
  assert(Object.keys(normalizers).length === 12, 'fitNormalizers 返回 12 个归一化器')

  const normalized = transformRow(allIndicators[0], normalizers)
  assert(Object.keys(normalized).length === 12, 'transformRow 返回 12 个归一化分数')

  for (const [key, val] of Object.entries(normalized)) {
    assertRange(val, 0, 100, `归一化 ${key} 在 0-100`)
  }
}

// ── Test 4: 评分融合 ──

console.log('\n=== Test 4: computeTotalScore ===')
{
  // 高分场景
  const highScores = {
    play_velocity: 90, engagement_velocity: 85, engagement_rate: 80,
    trend_acceleration: 75, topic_density: 70, freshness_decay: 85,
    category_match: 90, title_similarity: 80, style_consistency: 75,
    title_structure: 85, duration_fit: 70, timing_fit: 80,
  }
  const high = computeTotalScore(highScores)
  assertRange(high.score, 70, 100, '高分场景总分 > 70')
  assert(Object.keys(high.dimensions).length === 5, '返回 5 个维度')

  // 低分场景
  const lowScores = {
    play_velocity: 10, engagement_velocity: 15, engagement_rate: 20,
    trend_acceleration: 25, topic_density: 30, freshness_decay: 15,
    category_match: 10, title_similarity: 20, style_consistency: 25,
    title_structure: 30, duration_fit: 20, timing_fit: 15,
  }
  const low = computeTotalScore(lowScores)
  assertRange(low.score, 0, 40, '低分场景总分 < 40')

  // 自定义权重
  const custom = computeTotalScore(highScores, { velocity: 0.5, trend: 0.2, affinity: 0.15, pattern: 0.1, platformFit: 0.05 })
  assertRange(custom.score, 70, 100, '自定义权重仍在合理范围')
}

// ── Test 5: 预设权重 ──

console.log('\n=== Test 5: Weight Presets ===')
{
  const scores = {
    play_velocity: 60, engagement_velocity: 55, engagement_rate: 50,
    trend_acceleration: 45, topic_density: 40, freshness_decay: 55,
    category_match: 65, title_similarity: 60, style_consistency: 55,
    title_structure: 50, duration_fit: 45, timing_fit: 50,
  }

  const defaultResult = computeTotalScore(scores, PRESETS.default)
  const trendResult = computeTotalScore(scores, PRESETS.trendHunter)
  const matureResult = computeTotalScore(scores, PRESETS.mature)

  assert(typeof defaultResult.score === 'number', 'default 预设返回分数')
  assert(typeof trendResult.score === 'number', 'trendHunter 预设返回分数')
  assert(typeof matureResult.score === 'number', 'mature 预设返回分数')
}

// ── Test 6: 置信度 ──

console.log('\n=== Test 6: computeConfidence ===')
{
  const high = computeConfidence({ velocity: true, trend: true, affinity: true, pattern: true, platformFit: true })
  assert(high.level === 'high', '5/5 → high')
  assert(high.score === 1, 'score = 1.0')

  const medium = computeConfidence({ velocity: true, trend: true, affinity: true, pattern: false, platformFit: false })
  assert(medium.level === 'medium', '3/5 → medium')

  const low = computeConfidence({ velocity: true, trend: false, affinity: false, pattern: false, platformFit: false })
  assert(low.level === 'low', '1/5 → low')

  const none = computeConfidence({ velocity: false, trend: false, affinity: false, pattern: false, platformFit: false })
  assert(none.level === 'none', '0/5 → none')
}

// ── Test 7: 解读生成 ──

console.log('\n=== Test 7: generateInterpretation ===')
{
  const highResult = computeTotalScore({
    play_velocity: 90, engagement_velocity: 85, engagement_rate: 80,
    trend_acceleration: 75, topic_density: 70, freshness_decay: 85,
    category_match: 90, title_similarity: 80, style_consistency: 75,
    title_structure: 85, duration_fit: 70, timing_fit: 80,
  })
  const highConf = computeConfidence({ velocity: true, trend: true, affinity: true, pattern: true, platformFit: true })
  const highText = generateInterpretation(highResult, highConf)
  assert(highText.includes('爆款潜力很高'), '高分解读包含"爆款潜力很高"')
  assert(highText.includes('最大优势'), '解读包含最大优势')

  const lowResult = computeTotalScore({
    play_velocity: 10, engagement_velocity: 15, engagement_rate: 20,
    trend_acceleration: 25, topic_density: 30, freshness_decay: 15,
    category_match: 10, title_similarity: 20, style_consistency: 25,
    title_structure: 30, duration_fit: 20, timing_fit: 15,
  })
  const lowText = generateInterpretation(lowResult, highConf)
  assert(lowText.includes('风险较大'), '低分解读包含"风险较大"')

  // 低置信度提示
  const lowConf = computeConfidence({ velocity: true, trend: false, affinity: false, pattern: false, platformFit: false })
  const warnText = generateInterpretation(highResult, lowConf)
  assert(warnText.includes('数据不足'), '低置信度包含"数据不足"警告')
}

// ── Test 8: 分类统计 ──

console.log('\n=== Test 8: computeCategoryStats ===')
{
  const data = mockData()
  const stats = computeCategoryStats(data, new Date().toISOString())
  assert(Object.keys(stats).length >= 3, '统计出 ≥3 个分类')

  for (const [cat, s] of Object.entries(stats)) {
    assert(typeof s.avgPlay7d === 'number', `${cat} avgPlay7d 是数字`)
    assert(typeof s.avgPlay30d === 'number', `${cat} avgPlay30d 是数字`)
    assert(typeof s.count7d === 'number', `${cat} count7d 是数字`)
    assert(s.count7d <= s.count30d, `${cat} 7d ≤ 30d`)
  }
}

// ── Test 9: 标题模式提取 ──

console.log('\n=== Test 9: extractTopTitlePatterns ===')
{
  const data = mockData()
  const patterns = extractTopTitlePatterns(data, 5)
  assert(Array.isArray(patterns), '返回数组')
  assert(patterns.length <= 5, '不超过 limit')
  assert(patterns.length > 0, '有提取到模式')
}

// ── Test 10: 端到端管线 ──

console.log('\n=== Test 10: End-to-End Pipeline ===')
{
  const data = mockData()
  const now = new Date().toISOString()
  const categoryStats = computeCategoryStats(data, now)
  const ctx = {
    now,
    categoryStats,
    creatorHistory: data,
    memories: [{ value: '科技' }, { value: '教程' }, { value: '震撼' }],
    medianPlay: 30000,
    totalRecent7d: data.length,
    topTitlePatterns: extractTopTitlePatterns(data),
    bestHours: extractBestHours(data),
  }

  // 1) 原始指标
  const allIndicators = data.map(row => computeRawIndicators(row, ctx))
  assert(allIndicators.length === data.length, `原始指标数量匹配 (${allIndicators.length})`)

  // 2) 归一化
  const normalizers = fitNormalizers(allIndicators)
  const allNormalized = allIndicators.map(row => transformRow(row, normalizers))
  assert(allNormalized.length === data.length, `归一化数量匹配 (${allNormalized.length})`)

  // 3) 评分
  const target = allNormalized[0] // 取第一条
  const result = computeTotalScore(target)
  assertRange(result.score, 0, 100, `端到端总分 ${result.score} 在 0-100`)

  // 4) 置信度
  const conf = computeConfidence({ velocity: true, trend: true, affinity: true, pattern: true, platformFit: true })
  assert(conf.level === 'high', '端到端置信度 high')

  // 5) 解读
  const interp = generateInterpretation(result, conf)
  assert(interp.length > 0, '解读非空')
  console.log(`\n  ── 示例输出 ──`)
  console.log(`  总分: ${result.score}`)
  for (const [k, v] of Object.entries(result.dimensions)) {
    console.log(`  ${v.name}: ${v.score} (权重 ${v.weight})`)
  }
  console.log(`  置信度: ${conf.level}`)
  console.log(`  解读:\n  ${interp.split('\n').join('\n  ')}`)
}

// ── 汇总 ──

console.log(`\n${'='.repeat(40)}`)
console.log(`  通过: ${pass}  |  失败: ${fail}`)
console.log(`${'='.repeat(40)}`)

if (fail > 0) {
  process.exit(1)
}
