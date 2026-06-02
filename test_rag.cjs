/**
 * RAG 功能测试脚本
 * 测试 BM25 关键词搜索路径（vectra 因 ESM 兼容问题暂不可用）
 */
const { getDb } = require('./knower-agent/db')
const { BM25Search, simpleHash } = require('./knower-agent/rag/embedder')

async function testRAG() {
  const db = await getDb()
  let passed = 0
  let failed = 0

  function assert(name, condition, detail = '') {
    if (condition) {
      console.log(`  ✓ ${name}`)
      passed++
    } else {
      console.log(`  ✗ ${name}${detail ? ' — ' + detail : ''}`)
      failed++
    }
  }

  // ===== 1. BM25 基础测试 =====
  console.log('\n[1] BM25 中文分词')
  const bm25 = new BM25Search()

  const docs = [
    { id: 'd1', text: '华为手机评测：Mate 60 Pro 拍照体验' },
    { id: 'd2', text: 'iPhone 15 值不值得买？真实用户告诉你' },
    { id: 'd3', text: '2024年最值得买的平板电脑推荐' },
    { id: 'd4', text: '华为手机拍照对比 iPhone 谁更强' },
    { id: 'd5', text: '抖音短视频运营技巧分享' },
  ]

  for (const d of docs) {
    bm25.addDocument(d.id, d.text)
  }

  assert('文档数量', bm25.totalDocs === 5, `got ${bm25.totalDocs}`)

  const results = bm25.search('华为手机拍照', 3)
  assert('搜索返回结果', results.length > 0, `got ${results.length}`)
  // BM25 search returns: { id, score, metadata }
  assert('最相关结果包含"华为"',
    results[0]?.id === 'd1' || results[0]?.id === 'd4',
    `top: ${results[0]?.id}`)

  const results2 = bm25.search('抖音运营', 2)
  assert('抖音相关搜索',
    results2.length > 0 && results2[0]?.id === 'd5',
    `top: ${results2[0]?.id}`)

  // ===== 2. 中文字符级分词 =====
  console.log('\n[2] 中文字符级分词')
  const tokenize = (() => {
    const text = '华为手机评测'
    const tokens = []
    let i = 0
    while (i < text.length) {
      const ch = text[i]
      if (ch >= '一' && ch <= '鿿') { tokens.push(ch); i++ }
      else if (/\w/.test(ch)) {
        let w = ''
        while (i < text.length && /\w/.test(text[i])) { w += text[i]; i++ }
        tokens.push(w)
      } else { i++ }
    }
    return tokens.filter(t => t.length > 0)
  })()

  assert('6个中文字分为6个token', tokenize.length === 6, `got: ${tokenize.join('/')}`)
  assert('分词结果', tokenize.join(',') === '华,为,手,机,评,测')

  // ===== 3. simpleHash =====
  console.log('\n[3] simpleHash')
  assert('相同输入相同哈希', simpleHash('abc') === simpleHash('abc'))
  assert('不同输入不同哈希', simpleHash('abc') !== simpleHash('xyz'))

  // ===== 4. 真实数据 BM25 检索 =====
  console.log('\n[4] 真实数据 BM25 检索')

  // scripts
  const allScripts = db.exec('SELECT id, content FROM scripts WHERE account_id = ? ORDER BY id DESC LIMIT 200', ['default'])
  if (allScripts.length > 0 && allScripts[0].values.length > 0) {
    const scriptBM25 = new BM25Search()
    for (const row of allScripts[0].values) {
      scriptBM25.addDocument(`script_${row[0]}`, row[1] || '', { sourceType: 'script', sourceId: row[0] })
    }
    const sampleContent = allScripts[0].values[0][1] || ''
    const query = sampleContent.slice(0, 20)
    const found = scriptBM25.search(query, 5)
    assert('脚本 BM25 检索有结果', found.length > 0, `query="${query.slice(0, 10)}..." => ${found.length} hits`)
    assert('检索到正确脚本', found[0]?.id === `script_${allScripts[0].values[0][0]}`)
  } else {
    console.log('  (无脚本数据，跳过)')
  }

  // crawl_content
  const allContent = db.exec('SELECT id, title, "desc" FROM crawl_content ORDER BY like_count DESC LIMIT 200')
  if (allContent.length > 0 && allContent[0].values.length > 0) {
    const contentBM25 = new BM25Search()
    for (const row of allContent[0].values) {
      const text = `${row[1] || ''} ${row[2] || ''}`
      contentBM25.addDocument(`content_${row[0]}`, text, { sourceType: 'crawl_content', sourceId: row[0] })
    }
    const query = (allContent[0].values[0][1] || '').slice(0, 15)
    if (query) {
      const found = contentBM25.search(query, 5)
      assert('爬取内容 BM25 检索有结果', found.length > 0, `query="${query}" => ${found.length} hits`)
    }
  } else {
    console.log('  (无爬取数据，跳过)')
  }

  // ===== 5. VectorStore 懒加载 =====
  console.log('\n[5] VectorStore 懒加载')
  const vectorStore = require('./knower-agent/rag/vectorStore')
  try {
    await vectorStore.searchVectors('default', [0.1], 1)
    assert('应抛出错误', false, 'did not throw')
  } catch (err) {
    assert('vectra 不可用时抛出明确错误', err.message.includes('vectra'), err.message)
  }

  // ===== 6. Retriever BM25 降级 =====
  console.log('\n[6] Retriever BM25 降级')
  const { findSimilarScripts, findSimilarContent, findHighEngagementPatterns } = require('./knower-agent/rag/retriever')

  try {
    const r = await findSimilarScripts('default', '手机评测', 3)
    assert('findSimilarScripts 正常', Array.isArray(r))
  } catch (err) {
    assert('findSimilarScripts 不崩溃', false, err.message)
  }

  try {
    const r = await findSimilarContent('default', '短视频', 'bili', 3)
    assert('findSimilarContent 正常', Array.isArray(r))
  } catch (err) {
    assert('findSimilarContent 不崩溃', false, err.message)
  }

  try {
    const r = await findHighEngagementPatterns('default', 'bili', 5)
    assert('findHighEngagementPatterns 正常', Array.isArray(r))
  } catch (err) {
    assert('findHighEngagementPatterns 不崩溃', false, err.message)
  }

  // ===== 7. search_similar 工具 =====
  console.log('\n[7] search_similar 工具')
  const searchTool = require('./knower-agent/agent/tools/search_similar')
  assert('工具名称', searchTool.name === 'search_similar')

  try {
    const r = await searchTool.execute({ query: '手机评测', type: 'scripts', accountId: 'default' })
    assert('工具执行成功', r !== null)
    assert('返回 results 数组', Array.isArray(r.results))
  } catch (err) {
    assert('工具不崩溃', false, err.message)
  }

  // ===== 汇总 =====
  console.log(`\n${'='.repeat(40)}`)
  console.log(`通过: ${passed}  失败: ${failed}  总计: ${passed + failed}`)
  if (failed > 0) process.exit(1)
}

testRAG().catch(err => {
  console.error('测试失败:', err)
  process.exit(1)
})
