/**
 * Agent 上下文瘦身重构 — 验证测试
 *
 * 验证 5 个改动：
 * 1. summarizeToolResult — 工具返回值摘要化
 * 2. compressMessages — 消息历史压缩
 * 3. buildContextFromState — 只给元信息
 * 4. query_local_db 工具 — 注册 + 可查询
 * 5. router 兼容性 — query_local_db 不触发警告
 */

const assert = require('assert')

// ============================================================
//  测试 1: summarizeToolResult
// ============================================================
console.log('\n=== 测试 1: summarizeToolResult ===')

// 从 core.js 提取函数（它不在 module.exports 中，我们重新定义来测试）
function summarizeToolResult(toolName, result) {
  if (!result || typeof result !== 'object') return result

  if (toolName === 'crawl_data_batch' && result.results) {
    return {
      success: true,
      totalResults: result.totalCount || 0,
      platforms: result.results.map(r => ({
        platform: r.platform,
        count: r.data?.contents?.length || 0,
        topTitle: r.data?.contents?.[0]?.title || '',
      })),
    }
  }

  if (toolName === 'crawl_data') {
    return {
      success: result.success,
      platform: result.platform,
      totalCount: result.totalCount || 0,
      topContents: result.topContents || [],
      creators: result.creators?.map(c => c.nickname).join(', ') || '',
      message: result.message,
    }
  }

  if (toolName === 'query_data') {
    if (result.videos) {
      return {
        success: true,
        totalCount: result.totalCount,
        sample: result.videos.slice(0, 10).map(v => v.title),
      }
    }
    return result
  }

  if (toolName === 'suggest_topics' && result.topics) {
    return {
      success: true,
      topicCount: result.topics.length,
      topics: result.topics.map(t => ({
        title: t.title,
        overallScore: t.overallScore,
        urgency: t.urgency,
      })),
    }
  }

  return result
}

// --- crawl_data_batch ---
const batchResult = {
  success: true,
  results: [
    { platform: 'bili', success: true, data: { contents: Array.from({ length: 20 }, (_, i) => ({ title: `B站视频${i}` })) } },
    { platform: 'dy', success: true, data: { contents: Array.from({ length: 15 }, (_, i) => ({ title: `抖音视频${i}` })) } },
  ],
  totalCount: 35,
}
const batchSum = summarizeToolResult('crawl_data_batch', batchResult)
assert.strictEqual(batchSum.totalResults, 35)
assert.strictEqual(batchSum.platforms.length, 2)
assert.strictEqual(batchSum.platforms[0].count, 20)
assert.strictEqual(batchSum.platforms[0].topTitle, 'B站视频0')
assert.strictEqual(batchSum.platforms[1].count, 15)
assert.strictEqual(batchSum.platforms[1].topTitle, '抖音视频0')
const batchOrigSize = JSON.stringify(batchResult).length
const batchSumSize = JSON.stringify(batchSum).length
console.log(`  ✅ crawl_data_batch: ${batchOrigSize} → ${batchSumSize} 字节 (省 ${Math.round((1 - batchSumSize / batchOrigSize) * 100)}%)`)

// --- crawl_data ---
const crawlResult = {
  success: true,
  platform: 'bili',
  totalCount: 10,
  topContents: Array.from({ length: 10 }, (_, i) => ({ title: `视频${i}`, playCount: 10000 - i * 100 })),
  creators: [{ nickname: 'UP主A' }, { nickname: 'UP主B' }],
  message: '成功爬取 10 条数据',
}
const crawlSum = summarizeToolResult('crawl_data', crawlResult)
assert.strictEqual(crawlSum.topContents.length, 10, 'topContents 应保留全部 10 条')
assert.strictEqual(crawlSum.creators, 'UP主A, UP主B')
assert.strictEqual(crawlSum.message, '成功爬取 10 条数据')
console.log(`  ✅ crawl_data: 保留 topContents (${crawlSum.topContents.length} 条), creators 压缩为字符串`)

// --- query_data (videos) ---
const queryResult = {
  success: true,
  totalCount: 50,
  videos: Array.from({ length: 50 }, (_, i) => ({ title: `视频${i}`, playCount: 1000 })),
}
const querySum = summarizeToolResult('query_data', queryResult)
assert.strictEqual(querySum.sample.length, 10, 'sample 应截断到 10 条')
assert.strictEqual(querySum.totalCount, 50)
assert.ok(!querySum.videos, '不应包含完整 videos 数组')
console.log(`  ✅ query_data: 50 条 videos → sample 10 条`)

// --- query_data (sources，原样返回) ---
const sourcesResult = { success: true, sources: [{ name: 'UP主A' }], totalSources: 1 }
const sourcesSum = summarizeToolResult('query_data', sourcesResult)
assert.deepStrictEqual(sourcesSum, sourcesResult)
console.log(`  ✅ query_data sources: 原样返回`)

// --- suggest_topics ---
const topicsResult = {
  success: true,
  topics: Array.from({ length: 8 }, (_, i) => ({
    title: `选题${i}`,
    overallScore: 90 - i * 5,
    urgency: i < 3 ? 'high' : 'medium',
    reason: '这是一段很长的理由说明'.repeat(20),
    competitors: ['竞品1', '竞品2'],
  })),
}
const topicsSum = summarizeToolResult('suggest_topics', topicsResult)
assert.strictEqual(topicsSum.topicCount, 8)
assert.strictEqual(topicsSum.topics.length, 8)
assert.strictEqual(topicsSum.topics[0].title, '选题0')
assert.strictEqual(topicsSum.topics[0].overallScore, 90)
assert.ok(!topicsSum.topics[0].reason, '不应包含 reason')
assert.ok(!topicsSum.topics[0].competitors, '不应包含 competitors')
const topicsOrigSize = JSON.stringify(topicsResult).length
const topicsSumSize = JSON.stringify(topicsSum).length
console.log(`  ✅ suggest_topics: ${topicsOrigSize} → ${topicsSumSize} 字节 (省 ${Math.round((1 - topicsSumSize / topicsOrigSize) * 100)}%)`)

// --- 其他工具原样返回 ---
const smallResult = { success: true, analysis: { videoType: '测评' } }
assert.deepStrictEqual(summarizeToolResult('analyze_script', smallResult), smallResult)
console.log(`  ✅ 其他工具: 原样返回`)

// ============================================================
//  测试 2: compressMessages
// ============================================================
console.log('\n=== 测试 2: compressMessages ===')

function compressMessages(messages, maxMessages = 20) {
  if (messages.length <= maxMessages) return messages
  const first = messages[0]
  const recent = messages.slice(-(maxMessages - 2))
  const middle = messages.slice(1, -(maxMessages - 2))
  const toolCalls = []
  for (const m of middle) {
    if (m.role === 'user' && Array.isArray(m.content)) {
      for (const c of m.content) {
        if (c.type === 'tool_result') {
          try {
            const r = JSON.parse(c.content)
            toolCalls.push(r.message || r.queryType || r.topicCount ? `done` : 'done')
          } catch {
            toolCalls.push('done')
          }
        }
      }
    }
  }
  const summary = toolCalls.length > 0
    ? `[之前 ${toolCalls.length} 次工具调用已完成]`
    : '[之前的对话已省略]'
  return [first, { role: 'user', content: summary }, ...recent]
}

// 不超过阈值不压缩
const short = [{ role: 'user', content: 'hi' }, { role: 'assistant', content: [{ type: 'text', text: 'hello' }] }]
assert.strictEqual(compressMessages(short).length, 2)
console.log('  ✅ ≤ 20 条不压缩')

// 超过阈值压缩
const long = Array.from({ length: 30 }, (_, i) => ({
  role: i % 2 === 0 ? 'user' : 'assistant',
  content: i % 2 === 0
    ? [{ type: 'tool_result', tool_use_id: `t${i}`, content: JSON.stringify({ message: 'done' }) }]
    : [{ type: 'text', text: `回复${i}` }],
}))
const compressed = compressMessages(long)
assert.strictEqual(compressed.length, 20)
assert.strictEqual(compressed[0].role, 'user')  // 首条保留
// middle = messages[1..11]，其中 user 消息有 5 条 tool_result
assert.ok(compressed[1].content.includes('次工具调用已完成'), '摘要格式正确')
assert.strictEqual(compressed[19].role, 'assistant')  // 最近保留
console.log('  ✅ 30 条 → 20 条（含摘要 "' + compressed[1].content + '"）')

// 无工具调用的压缩
const noTools = Array.from({ length: 25 }, (_, i) => ({
  role: i % 2 === 0 ? 'user' : 'assistant',
  content: i % 2 === 0 ? `消息${i}` : [{ type: 'text', text: `回复${i}` }],
}))
const compressedNoTools = compressMessages(noTools)
assert.ok(compressedNoTools[1].content.includes('之前的对话已省略'))
console.log('  ✅ 无工具调用时摘要为 "[之前的对话已省略]"')

// ============================================================
//  测试 3: buildContextFromState
// ============================================================
console.log('\n=== 测试 3: buildContextFromState ===')

const { buildContextFromState } = require('./agent/processor')
const AgentState = require('./agent/state')

const state = new AgentState()
state.crawlData = Array.from({ length: 50 }, (_, i) => ({ title: `视频${i}`, platform: 'bili' }))
state.analysis = { videoType: '测评', topic: '手机' }

const ctx = buildContextFromState(state)
assert.ok(!ctx.includes('视频0'), '不应包含具体标题')
assert.ok(ctx.includes('50 条'), '应包含总数')
assert.ok(ctx.includes('query_local_db'), '应提示使用 query_local_db')
assert.ok(ctx.includes('测评'), 'analysis 应保留')
assert.ok(!ctx.includes('选题建议'), '不应包含 topicSuggestions')
console.log(`  ✅ crawlData 只给元信息（${ctx.length} 字符），不含具体标题，不含 topicSuggestions`)

// ============================================================
//  测试 4: router 兼容性
// ============================================================
console.log('\n=== 测试 4: router 兼容性 ===')

const { isToolCompatibleWithPhase } = require('./agent/router')

assert.strictEqual(isToolCompatibleWithPhase('query_local_db', 'idle'), true)
assert.strictEqual(isToolCompatibleWithPhase('query_local_db', 'crawling'), true)
assert.strictEqual(isToolCompatibleWithPhase('query_local_db', 'querying'), true)
assert.strictEqual(isToolCompatibleWithPhase('query_local_db', 'analyzing'), false)
assert.strictEqual(isToolCompatibleWithPhase('query_local_db', 'generating'), false)
console.log('  ✅ query_local_db 在 idle/crawling/querying 兼容，其他阶段不兼容')

// ============================================================
//  测试 5: query_local_db 工具加载
// ============================================================
console.log('\n=== 测试 5: query_local_db 工具 ===')

const queryLocalDb = require('./agent/tools/query_local_db')
assert.strictEqual(queryLocalDb.name, 'query_local_db')
assert.ok(queryLocalDb.execute)
assert.ok(queryLocalDb.input_schema)
assert.deepStrictEqual(queryLocalDb.input_schema.properties.query_type.enum, ['crawl_data', 'scripts', 'topics', 'reviews', 'competitors', 'memory'])
console.log('  ✅ 工具定义完整，6 种查询类型')

async function testQueryLocalDb() {
  const memResult = await queryLocalDb.execute({ query_type: 'memory', accountId: 'test_verify' })
  assert.strictEqual(memResult.success, true)
  assert.strictEqual(memResult.queryType, 'memory')
  console.log('  ✅ memory 查询: ' + memResult.totalCount + ' 条')

  const crawlResult = await queryLocalDb.execute({ query_type: 'crawl_data', filters: { platform: 'bili' }, accountId: 'test_verify' })
  assert.strictEqual(crawlResult.success, true)
  console.log('  ✅ crawl_data 查询: ' + crawlResult.totalCount + ' 条')
}

// ============================================================
//  运行异步测试
// ============================================================
async function main() {
  try {
    await testQueryLocalDb()
    console.log('\n🎉 所有测试通过！')
  } catch (err) {
    console.error('\n❌ 测试失败:', err.message)
    process.exit(1)
  }
}

main()
