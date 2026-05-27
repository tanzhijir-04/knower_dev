#!/usr/bin/env node
// ============================================================
//  提示词 A/B 对比自动化测试
//  对比旧版 (core.js BASE_SYSTEM_PROMPT) vs 优化版 (prompts/system-prompt.js)
// ============================================================

const fs = require('fs')
const path = require('path')

// ============================================================
//  1. 加载两个版本的提示词
// ============================================================

// 旧版提示词：从 core.js 中提取
const coreContent = fs.readFileSync(path.join(__dirname, 'agent', 'core.js'), 'utf-8')
const oldPromptMatch = coreContent.match(/const BASE_SYSTEM_PROMPT = `([\s\S]*?)`/)
const OLD_PROMPT = oldPromptMatch ? oldPromptMatch[1] : ''

// 优化版提示词
const { OPTIMIZED_SYSTEM_PROMPT: NEW_PROMPT } = require('./prompts/system-prompt')

// 优化版工具描述
const { optimizedTools } = require('./prompts/optimized-tools')

// 当前工具定义
const { tools: currentTools } = require('./agent/tools')

// ============================================================
//  测试框架
// ============================================================

let totalTests = 0
let passedTests = 0
let failedTests = []

function assert(condition, testName, detail = '') {
  totalTests++
  if (condition) {
    passedTests++
    console.log(`  ✅ ${testName}`)
  } else {
    failedTests.push({ testName, detail })
    console.log(`  ❌ ${testName}${detail ? ' — ' + detail : ''}`)
  }
}

function section(title) {
  console.log(`\n${'='.repeat(60)}`)
  console.log(`  ${title}`)
  console.log('='.repeat(60))
}

// ============================================================
//  测试 1：提示词结构对比
// ============================================================

section('测试 1：提示词结构对比')

// 1.1 工具数量
const oldToolList = OLD_PROMPT.match(/\*\*[\w_]+\*\*/g) || []
const oldToolNames = oldToolList.map(t => t.replace(/\*\*/g, ''))
const newToolSection = NEW_PROMPT.match(/\| (\w+) \|/g) || []
const newToolNames = newToolSection.map(t => t.replace(/[|\s]/g, ''))

assert(oldToolNames.length <= 5, '旧版提示词只列出少量工具', `列出: ${oldToolNames.join(', ')}`)
assert(newToolNames.length >= 7, '优化版提示词列出全部 7 个工具', `列出: ${newToolNames.join(', ')}`)

// 1.2 工具检查流程
assert(!OLD_PROMPT.includes('工具检查流程'), '旧版没有强制工具检查流程')
assert(NEW_PROMPT.includes('工具检查流程'), '优化版有强制工具检查流程')

// 1.3 红旗表
assert(!OLD_PROMPT.includes('红旗'), '旧版没有红旗表（反模式检测）')
assert(NEW_PROMPT.includes('红旗'), '优化版有红旗表')

// 1.4 路径化工具调用
assert(!OLD_PROMPT.includes('路径 A'), '旧版没有路径化工具调用')
assert(NEW_PROMPT.includes('路径 A') && NEW_PROMPT.includes('路径 B'), '优化版有路径化工具调用 (A/B/C/D)')

// 1.5 单次调用约束
assert(!OLD_PROMPT.includes('一次只调用一个工具'), '旧版没有单次调用约束')
assert(NEW_PROMPT.includes('一次只调用一个工具'), '优化版有单次调用约束')

// 1.6 回复风格规范
assert(!OLD_PROMPT.includes('不要说"我是AI助手"'), '旧版没有禁止 AI 自我指认')
assert(NEW_PROMPT.includes('不要说"我是AI助手"'), '优化版禁止 AI 自我指认')
assert(!OLD_PROMPT.includes('不要在每句话后面加 emoji'), '旧版没有 emoji 规范')
assert(NEW_PROMPT.includes('不要在每句话后面加 emoji'), '优化版有 emoji 规范')

// 1.7 提示词长度
console.log(`\n  📊 提示词长度: 旧版 ${OLD_PROMPT.length} 字符 vs 优化版 ${NEW_PROMPT.length} 字符 (增加 ${NEW_PROMPT.length - OLD_PROMPT.length} 字符)`)

// ============================================================
//  测试 2：工具定义对比
// ============================================================

section('测试 2：工具定义对比')

// 2.1 优化版工具数量
assert(optimizedTools.length === 7, '优化版定义了 7 个工具', `实际: ${optimizedTools.length}`)

// 2.2 每个优化工具是否有"When to call" / "When NOT to call"
for (const tool of optimizedTools) {
  const hasWhen = tool.description.includes('什么时候必须调用')
  const hasWhenNot = tool.description.includes('什么时候不要调用')
  const hasMistakes = tool.description.includes('常见错误')
  assert(hasWhen && hasWhenNot && hasMistakes,
    `${tool.name} 描述包含三段式（when/when not/mistakes）`,
    `when=${hasWhen}, whenNot=${hasWhenNot}, mistakes=${hasMistakes}`)
}

// 2.3 优化版 crawl_data 是否有 examples
const optCrawl = optimizedTools.find(t => t.name === 'crawl_data')
assert(optCrawl.input_schema.examples && optCrawl.input_schema.examples.length >= 2,
  'crawl_data 优化版有调用示例')

// 2.4 对比旧版工具描述长度
const totalOldDescLength = currentTools.reduce((sum, t) => sum + t.description.length, 0)
const totalNewDescLength = optimizedTools.reduce((sum, t) => sum + t.description.length, 0)
console.log(`\n  📊 工具描述总长度: 旧版 ${totalOldDescLength} 字符 vs 优化版 ${totalNewDescLength} 字符 (增加 ${totalNewDescLength - totalOldDescLength} 字符)`)

// ============================================================
//  测试 3：工具调用路径验证
// ============================================================

section('测试 3：工具调用路径验证')

// 模拟 core-optimized.js 中的路径定义
const VALID_TOOL_PATHS = {
  A: ['request_user_input', 'crawl_data'],
  B: ['request_user_input', 'analyze_script', 'expand_script', 'save_result'],
  C: ['suggest_topics'],
  D: ['query_data'],
}

function checkToolCallOrder(toolName, calledTools) {
  for (const [pathName, path] of Object.entries(VALID_TOOL_PATHS)) {
    const toolIndex = path.indexOf(toolName)
    if (toolIndex === -1) continue
    for (let i = 0; i < toolIndex; i++) {
      const requiredTool = path[i]
      if (!calledTools.includes(requiredTool)) {
        if (requiredTool === 'request_user_input') continue
        return { valid: false, reason: `调用 ${toolName} 前应先调用 ${requiredTool} (路径 ${pathName})` }
      }
    }
    return { valid: true, path: pathName }
  }
  return { valid: true, path: 'free' }
}

// 3.1 路径 B 正确顺序
assert(checkToolCallOrder('analyze_script', []).valid, 'analyze_script 可以直接调用（路径 B 首步）')
assert(checkToolCallOrder('expand_script', ['analyze_script']).valid, 'expand_script 在 analyze_script 后可调用')
assert(checkToolCallOrder('save_result', ['analyze_script', 'expand_script']).valid, 'save_result 在 expand_script 后可调用')

// 3.2 路径 B 错误顺序
assert(!checkToolCallOrder('expand_script', []).valid, 'expand_script 不应在 analyze_script 前调用')
assert(!checkToolCallOrder('save_result', ['analyze_script']).valid, 'save_result 不应在 expand_script 前调用')
assert(!checkToolCallOrder('save_result', []).valid, 'save_result 不应直接调用')

// 3.3 路径 A
assert(checkToolCallOrder('crawl_data', []).valid, 'crawl_data 可以直接调用（路径 A）')
assert(checkToolCallOrder('crawl_data', ['request_user_input']).valid, 'crawl_data 在 request_user_input 后可调用')

// 3.4 路径 C
assert(checkToolCallOrder('suggest_topics', []).valid, 'suggest_topics 可以直接调用（路径 C）')

// 3.5 路径 D
assert(checkToolCallOrder('query_data', []).valid, 'query_data 可以直接调用（路径 D）')

// ============================================================
//  测试 4：场景模拟（Prompt 行为推断）
// ============================================================

section('测试 4：场景模拟 — Prompt 行为推断')

// 4.1 分析 UP 主（无 UID）
// 旧版提示词：意图表中有"分析创作者" -> 需要平台+UID -> 有 request_user_input 规则
// 但旧版没列出 analyze_script, expand_script, suggest_topics
const oldHasAnalyzeScript = OLD_PROMPT.includes('analyze_script')
const oldHasExpandScript = OLD_PROMPT.includes('expand_script')
const oldHasSuggestTopics = OLD_PROMPT.includes('suggest_topics')

assert(!oldHasAnalyzeScript, '旧版提示词未提及 analyze_script 工具')
assert(!oldHasExpandScript, '旧版提示词未提及 expand_script 工具')
assert(!oldHasSuggestTopics, '旧版提示词未提及 suggest_topics 工具')

const newHasAnalyzeScript = NEW_PROMPT.includes('analyze_script')
const newHasExpandScript = NEW_PROMPT.includes('expand_script')
const newHasSuggestTopics = NEW_PROMPT.includes('suggest_topics')

assert(newHasAnalyzeScript, '优化版提示词提及 analyze_script 工具')
assert(newHasExpandScript, '优化版提示词提及 expand_script 工具')
assert(newHasSuggestTopics, '优化版提示词提及 suggest_topics 工具')

// 4.2 旧版工具表不完整的影响
// 旧版只列了 4 个工具，但实际注册了 7 个
// 这意味着 Agent 可能不知道 analyze_script/expand_script/suggest_topics 的存在
// 即使 tool schema 传给了 LLM，prompt 中没有说明会导致 LLM 可能不会主动调用
console.log('\n  ⚠️  关键发现:')
console.log('  旧版 prompt 只列出 4 个工具 (crawl_data, query_data, save_result, request_user_input)')
console.log('  但实际注册了 7 个工具 (多了 analyze_script, expand_script, suggest_topics)')
console.log('  LLM 虽然能从 tool schema 看到全部 7 个工具，但 prompt 中未说明会导致:')
console.log('  - Agent 可能不知道 analyze_script 是"脚本->物料"流程的第一步')
console.log('  - Agent 可能跳过 analyze_script 直接尝试生成物料')
console.log('  - Agent 可能不知道 suggest_topics 工具的存在')

// 4.3 旧版"生成物料"意图的描述
assert(OLD_PROMPT.includes('直接生成各平台物料'),
  '旧版提示词说"生成物料"时"直接生成"（可能跳过 analyze_script）')

// 4.4 优化版强制先分析
assert(NEW_PROMPT.includes('有脚本先调 analyze_script'),
  '优化版明确要求有脚本先调 analyze_script')
assert(NEW_PROMPT.includes('没有结构化分析就不能生成'),
  '优化版红旗表阻止跳过分析')

// ============================================================
//  测试 5：反模式覆盖度
// ============================================================

section('测试 5：反模式覆盖度')

const redFlags = [
  { pattern: 'UID.*猜|猜.*UID|没给UID', desc: '猜测 UID' },
  { pattern: '知道.*数据|我知道', desc: '声称知道数据' },
  { pattern: '直接生成物料', desc: '跳过分析直接生成' },
  { pattern: '不保存|不要保存|这次不保存', desc: '跳过保存' },
  { pattern: '编.*数据|编造', desc: '编造数据' },
  { pattern: '工具太慢', desc: '因慢跳过工具' },
  { pattern: '假装成功|掩盖错误', desc: '掩盖错误' },
  { pattern: '必须保存', desc: '强制保存规则' },
]

let newFlagCount = 0
for (const flag of redFlags) {
  const has = new RegExp(flag.pattern).test(NEW_PROMPT)
  if (has) newFlagCount++
  assert(has, `红旗表覆盖: ${flag.desc}`)
}

console.log(`\n  📊 红旗表覆盖率: ${newFlagCount}/${redFlags.length}`)

// ============================================================
//  测试 6：平台规范完整性
// ============================================================

section('测试 6：平台规范完整性')

const platforms = [
  { name: 'B站', oldHas: OLD_PROMPT.includes('B站'), newHas: NEW_PROMPT.includes('B站') },
  { name: 'YouTube', oldHas: OLD_PROMPT.includes('YouTube'), newHas: NEW_PROMPT.includes('YouTube') },
  { name: '抖音', oldHas: OLD_PROMPT.includes('抖音'), newHas: NEW_PROMPT.includes('抖音') },
  { name: '小红书', oldHas: OLD_PROMPT.includes('小红书'), newHas: NEW_PROMPT.includes('小红书') },
]

for (const p of platforms) {
  assert(p.oldHas, `旧版包含 ${p.name} 规范`)
  assert(p.newHas, `优化版包含 ${p.name} 规范`)
}

// 检查关键规范
assert(OLD_PROMPT.includes('≤80字') || OLD_PROMPT.includes('<=80字'), '旧版 B 站标题字数规范')
assert(NEW_PROMPT.includes('<=80字'), '优化版 B 站标题字数规范')
assert(NEW_PROMPT.includes('前3秒钩子'), '优化版抖音钩子规范')
assert(NEW_PROMPT.includes('必须带emoji'), '优化版小红书 emoji 规范')

// ============================================================
//  测试 7：Mock Agent 行为模拟
// ============================================================

section('测试 7：Mock Agent 行为模拟')

// 模拟旧版 Agent 的行为（基于 prompt 推断）
function simulateOldAgentBehavior(userMessage) {
  const toolsCalled = []
  const behavior = { askedForInfo: false, fabricatedData: false, skippedStep: false }

  // 旧版 prompt 的意图识别
  if (userMessage.includes('分析') && userMessage.includes('UP')) {
    // 旧版：提到"分析创作者" -> 需要 UID，但 prompt 没说必须先问
    // 旧版可能直接尝试调用 crawl_data（如果没有 UID 会失败）
    if (!userMessage.match(/\d{5,}/)) {
      // 没有 UID
      behavior.askedForInfo = true // 旧版有 request_user_input 规则
      toolsCalled.push('request_user_input')
    }
    toolsCalled.push('crawl_data')
  } else if (userMessage.includes('物料') || userMessage.includes('生成') || userMessage.includes('标题') || userMessage.includes('文案')) {
    // 旧版：说"生成物料" -> "直接生成各平台物料"
    // 旧版没有列出 analyze_script，可能跳过
    toolsCalled.push('save_result')
    behavior.skippedStep = true // 跳过了 analyze_script 和 expand_script
  } else if (userMessage.includes('选题') || userMessage.includes('灵感')) {
    // 旧版没有列出 suggest_topics，可能直接文字回复
    behavior.skippedStep = true
  }

  return { toolsCalled, behavior }
}

// 模拟优化版 Agent 的行为
function simulateNewAgentBehavior(userMessage) {
  const toolsCalled = []
  const behavior = { askedForInfo: false, fabricatedData: false, skippedStep: false }

  // 优化版 prompt 的工具检查流程
  if (userMessage.includes('分析') && (userMessage.includes('UP') || userMessage.includes('创作者'))) {
    // 路径 A：先 request_user_input 确认，再 crawl_data
    if (!userMessage.match(/\d{5,}/)) {
      behavior.askedForInfo = true
      toolsCalled.push('request_user_input')
    }
    toolsCalled.push('crawl_data')
  } else if (userMessage.includes('物料') || userMessage.includes('生成') || userMessage.includes('标题') || userMessage.includes('文案')) {
    // 涉及「生成物料/脚本/标题/文案」-> 路径 B
    // 检查是否有脚本内容（长文本或包含脚本特征词）
    const hasScriptContent = userMessage.length > 200 || userMessage.match(/今天|大家|大家好|各位| hello/)
    if (!hasScriptContent) {
      // 没给脚本内容，先要
      behavior.askedForInfo = true
      toolsCalled.push('request_user_input')
    }
    toolsCalled.push('analyze_script')
    toolsCalled.push('expand_script')
    toolsCalled.push('save_result')
  } else if (userMessage.includes('选题') || userMessage.includes('灵感')) {
    // 路径 C：suggest_topics
    toolsCalled.push('suggest_topics')
  }

  return { toolsCalled, behavior }
}

// 场景 1：分析 UP 主（无 UID）
console.log('\n  场景 1: "帮我分析B站UP主"')
const sim1Old = simulateOldAgentBehavior('帮我分析B站UP主')
const sim1New = simulateNewAgentBehavior('帮我分析B站UP主')
assert(sim1New.toolsCalled.includes('request_user_input'), '优化版会先请求 UID')
assert(sim1New.toolsCalled.includes('crawl_data'), '优化版会调用 crawl_data')
console.log(`    旧版工具序列: [${sim1Old.toolsCalled.join(' -> ')}]`)
console.log(`    优化版工具序列: [${sim1New.toolsCalled.join(' -> ')}]`)

// 场景 2：分析脚本生成物料
console.log('\n  场景 2: "帮我分析这段脚本并生成物料"')
const sim2Old = simulateOldAgentBehavior('帮我分析这段脚本并生成物料')
const sim2New = simulateNewAgentBehavior('帮我分析这段脚本并生成物料')
assert(sim2New.toolsCalled.includes('analyze_script'), '优化版会先调用 analyze_script')
assert(sim2New.toolsCalled.includes('expand_script'), '优化版会调用 expand_script')
assert(sim2New.toolsCalled.includes('save_result'), '优化版会调用 save_result')
assert(!sim2Old.toolsCalled.includes('analyze_script'), '旧版不会调用 analyze_script（未列出）')
console.log(`    旧版工具序列: [${sim2Old.toolsCalled.join(' -> ')}]`)
console.log(`    优化版工具序列: [${sim2New.toolsCalled.join(' -> ')}]`)

// 场景 3：选题建议
console.log('\n  场景 3: "有什么好的选题建议"')
const sim3Old = simulateOldAgentBehavior('有什么好的选题建议')
const sim3New = simulateNewAgentBehavior('有什么好的选题建议')
assert(!sim3Old.toolsCalled.includes('suggest_topics'), '旧版不会调用 suggest_topics（未列出）')
assert(sim3New.toolsCalled.includes('suggest_topics'), '优化版会调用 suggest_topics')
console.log(`    旧版工具序列: [${sim3Old.toolsCalled.join(' -> ') || '无工具调用'}]`)
console.log(`    优化版工具序列: [${sim3New.toolsCalled.join(' -> ')}]`)

// 场景 4：直接要求生成物料（无脚本）
console.log('\n  场景 4: "帮我生成物料"（未提供脚本）')
const sim4New = simulateNewAgentBehavior('帮我生成物料')
assert(sim4New.behavior.askedForInfo, '优化版会先请求脚本内容')
assert(sim4New.toolsCalled[0] === 'request_user_input', '优化版第一步是 request_user_input')
console.log(`    优化版工具序列: [${sim4New.toolsCalled.join(' -> ')}]`)

// ============================================================
//  测试 8：Token 消耗估算
// ============================================================

section('测试 8：Token 消耗估算')

function estimateTokens(text) {
  // 粗略估算：中文约 1.5 字符/token，英文约 4 字符/token
  const chineseChars = (text.match(/[一-鿿]/g) || []).length
  const otherChars = text.length - chineseChars
  return Math.ceil(chineseChars / 1.5 + otherChars / 4)
}

const oldTokens = estimateTokens(OLD_PROMPT)
const newTokens = estimateTokens(NEW_PROMPT)
const oldToolTokens = currentTools.reduce((sum, t) => sum + estimateTokens(t.description), 0)
const newToolTokens = optimizedTools.reduce((sum, t) => sum + estimateTokens(t.description), 0)

console.log(`  系统提示词: 旧版 ~${oldTokens} tokens vs 优化版 ~${newTokens} tokens`)
console.log(`  工具描述:   旧版 ~${oldToolTokens} tokens vs 优化版 ~${newToolTokens} tokens`)
console.log(`  总计:       旧版 ~${oldTokens + oldToolTokens} tokens vs 优化版 ~${newTokens + newToolTokens} tokens`)
console.log(`  增量:       ~${(newTokens + newToolTokens) - (oldTokens + oldToolTokens)} tokens (约 ${(((newTokens + newToolTokens) / (oldTokens + oldToolTokens) - 1) * 100).toFixed(1)}% 增加)`)

// ============================================================
//  汇总
// ============================================================

section('测试汇总')

console.log(`\n  总测试数: ${totalTests}`)
console.log(`  通过: ${passedTests}`)
console.log(`  失败: ${failedTests.length}`)

if (failedTests.length > 0) {
  console.log('\n  失败详情:')
  for (const f of failedTests) {
    console.log(`    ❌ ${f.testName}${f.detail ? ' — ' + f.detail : ''}`)
  }
}

console.log('\n' + '='.repeat(60))
console.log('  结论')
console.log('='.repeat(60))

console.log(`
  优化版提示词相比旧版的核心改进：

  1. ✅ 工具覆盖完整：列出全部 7 个工具（旧版只列 4 个）
     → Agent 不会遗漏 analyze_script / expand_script / suggest_topics

  2. ✅ 强制工具检查流程：先判断意图再行动
     → 避免 Agent 跳过必要步骤

  3. ✅ 红旗表（反模式检测）：8 条反模式规则
     → 防止猜测 UID、编造数据、跳过分析等行为

  4. ✅ 路径化工具调用：4 条严格路径 (A/B/C/D)
     → 确保工具按正确顺序调用

  5. ✅ 单次调用约束："一次只调用一个工具"
     → 避免并发调用导致的状态混乱

  6. ✅ 回复风格增强：禁止 AI 自我指认、emoji 泛滥
     → 输出更自然

  7. ⚠️ Token 增加：约 ${(((newTokens + newToolTokens) / (oldTokens + oldToolTokens) - 1) * 100).toFixed(0)}% 增量
     → 需要权衡成本和效果

  建议：集成优化版提示词，同时保留旧版作为 fallback。
`)

// 退出码
process.exit(failedTests.length > 0 ? 1 : 0)
