// test_crawler.js — 验证各平台爬取功能
const { runCrawler } = require('../lib/crawler')

const TESTS = [
  { platform: 'bili', keyword: '科技', expected: 'videos' },
  { platform: 'xhs', keyword: '穿搭', expected: 'notes' },
  { platform: 'dy', keyword: '美食', expected: 'videos' },
  { platform: 'wb', keyword: '科技', expected: 'posts' },
]

async function runTests() {
  for (const test of TESTS) {
    console.log(`\n--- 测试 ${test.platform} 关键词搜索 ---`)
    try {
      const result = await runCrawler(test.platform, test.keyword, { maxNotes: 3 })
      console.log(`✅ ${test.platform}: 获取到 ${result.contents?.length || 0} 条数据`)
      if (result.creators?.length) {
        console.log(`   创作者: ${result.creators[0].nickname}`)
      }
      if (result.contents?.length) {
        console.log(`   第一条: ${result.contents[0].title}`)
      }
    } catch (err) {
      console.log(`❌ ${test.platform}: ${err.message}`)
    }
  }
}

runTests()
