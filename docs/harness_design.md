# 知更 Knower · Agent Harness 设计方案

> 基于 Anthropic "Harness design for long-running application development" 的思路，适配知更的 agent 架构。

---

## 为什么需要 Harness

知更的 Agent 是非确定性的——同样的脚本输入，可能走不同的工具调用路径，生成不同质量的物料。目前验证 agent 行为的方式是手动测试，问题：

1. 改了 system prompt 或工具逻辑后，不知道是否退步
2. 评论分析、复盘等新工具加入后，没有回归保障
3. 多平台场景下（B站/抖音/小红书/微博），每个平台的字段映射是否正确，全靠人肉检查

**Harness 的目标**：每次改动后，自动跑一组测试场景，验证 agent 的工具选择、数据流、输出质量。

---

## 架构：三角色分工

参考 Anthropic 文章的 Planner-Generator-Evaluator 模式，适配知更：

```
┌─────────────┐     ┌──────────────────┐     ┌─────────────┐
│   Planner   │────>│    Generator     │────>│  Evaluator  │
│  (测试编排)  │     │  (知更 Agent)     │     │  (结果验证)  │
└─────────────┘     └──────────────────┘     └─────────────┘
       │                    │                       │
       │              ┌─────┴─────┐                 │
       │              │  工具集    │                 │
       │              │  + DB     │                 │
       │              └───────────┘                 │
       │                                            │
       └────── 测试场景定义 ◄────── 断言规则 ◄────────┘
```

| 角色 | 在知更中是什么 | 怎么跑 |
|---|---|---|
| **Planner** | 测试编排脚本（Node.js） | 读取测试场景 YAML，准备 DB 初始状态，启动 agent |
| **Generator** | 知更 Agent（core.js） | 正常执行 ReAct 循环，调用工具，写入 DB |
| **Evaluator** | 验证脚本（Node.js） | 检查 DB 状态、工具调用序列、输出格式 |

**关键区别**：知更的 agent 不需要像 Web 应用那样用 Playwright 点击 UI。它的产出是 DB 里的数据和 LLM 输出文本，所以 evaluator 直接查 DB 验证即可。

---

## 测试场景设计

### 场景分类

| 类别 | 场景数 | 说明 |
|---|---|---|
| **核心物料生成** | 4 | 不同平台脚本输入 → 验证物料输出 |
| **工具选择** | 3 | 不同用户意图 → 验证 agent 选对工具 |
| **评论分析** | 2 | 评论爬取 + 情感分析 → 验证字段映射 |
| **内容复盘** | 2 | 录入数据 + AI 分析 → 验证 memories 写入 |
| **多创作者隔离** | 2 | 切换账号 → 验证数据隔离 |
| **错误恢复** | 2 | 缺失参数 / API 失败 → 验证降级行为 |

共 15 个场景，每个场景约 30 秒执行时间，全套跑完约 8 分钟。

---

## 场景示例

### 场景 1：B站脚本 → 四平台物料

```yaml
name: bili-script-to-materials
description: 输入一段B站科技评测脚本，验证 agent 生成四平台物料
category: core

# 初始 DB 状态
setup:
  - create_account: { id: "test_bili", name: "测试UP主", platform: "bili" }
  - switch_account: "test_bili"

# 用户输入
input: |
  请帮我分析以下脚本并生成各平台物料：
  今天给大家带来 iPhone 17 的深度评测。这次苹果终于用了 USB-C 接口，
  电池续航提升了 20%，但价格也涨了。我们从外观、性能、拍照三个维度来聊聊。

# 预期工具调用序列
expected_tools:
  - name: save_result
    must_contain: ["bili", "dy", "xhs"]

# DB 验证
assertions:
  - table: scripts
    where: { account_id: "test_bili" }
    count: 1
  - table: memories
    where: { account_id: "test_bili", type: "content_pattern" }
    min_count: 1
```

### 场景 2：评论字段映射（B站）

```yaml
name: bili-comment-mapping
description: 验证B站评论的字段映射正确
category: comments

setup:
  - create_account: { id: "test_comment", name: "评论测试", platform: "bili" }
  - insert_raw_comments:
      platform: bili
      count: 5
      # 模拟 B站 API 原始格式
      raw_fields: ["rpid", "content.message", "member.uname", "like", "rcount"]

# 不真的爬取，直接注入原始数据到 comments-crawl handler 的 mock 层
input: "分析这5条评论的情感"

assertions:
  - table: comments
    where: { account_id: "test_comment" }
    count: 5
    column_not_null: ["author_name", "content", "like_count"]
  - table: comments
    where: { sentiment: "positive" }
    min_count: 1
```

### 场景 3：多创作者隔离

```yaml
name: account-isolation
description: 验证切换创作者后排期数据隔离
category: isolation

setup:
  - create_account: { id: "acc_a", name: "账号A", platform: "bili" }
  - create_account: { id: "acc_b", name: "账号B", platform: "dy" }
  - switch_account: "acc_a"
  - schedule_create: { title: "A的排期", platform: "bili", plannedDate: "2026-06-10" }
  - switch_account: "acc_b"

assertions:
  - table: publish_schedule
    where: { account_id: "acc_b" }
    count: 0  # B看不到A的排期
  - table: publish_schedule
    where: { account_id: "acc_a" }
    count: 1
```

---

## Evaluator 评分标准

每个场景的 evaluator 按四个维度打分（参考 Anthropic 文章的四标准模式）：

| 维度 | 权重 | 说明 |
|---|---|---|
| **工具选择正确性** | 40% | agent 是否调用了正确的工具，参数是否合理 |
| **数据完整性** | 30% | DB 写入的数据是否完整，必填字段不为空 |
| **隔离正确性** | 20% | 多账号场景下数据是否正确隔离 |
| **输出质量** | 10% | LLM 输出的文本是否合理（用规则检查，不调 LLM） |

**阈值**：任何维度低于 60 分则该场景 FAIL。

---

## 实现方案

### 文件结构

```
knower-agent/
  harness/
    runner.js          # 主入口，读取场景、调度执行
    planner.js         # 场景加载 + DB 初始化
    evaluator.js       # 断言验证 + 评分
    mock-server.js     # Mock LLM 响应（可选，加速测试）
    scenarios/         # 测试场景 YAML
      01-core/
        bili-script.yaml
        dy-script.yaml
        xhs-script.yaml
        wb-script.yaml
      02-tools/
        intent-crawl.yaml
        intent-analyze.yaml
        intent-suggest.yaml
      03-comments/
        bili-comment.yaml
        xhs-comment.yaml
      04-review/
        create-review.yaml
        ai-analyze-review.yaml
      05-isolation/
        account-isolation.yaml
        schedule-isolation.yaml
      06-recovery/
        missing-params.yaml
        api-failure.yaml
    results/           # 测试结果输出
```

### runner.js 核心逻辑

```javascript
// harness/runner.js
const fs = require('fs')
const path = require('path')
const yaml = require('js-yaml')  // 需要加依赖

async function runHarness(options = {}) {
  const { scenarios = 'all', mock = false, verbose = false } = options
  const scenarioDir = path.join(__dirname, 'scenarios')
  const files = loadScenarioFiles(scenarioDir, scenarios)

  const results = []
  for (const file of files) {
    const scenario = yaml.load(fs.readFileSync(file, 'utf8'))
    console.log(`▶ ${scenario.name}: ${scenario.description}`)

    const result = await runScenario(scenario, { mock, verbose })
    results.push(result)

    const icon = result.passed ? '✅' : '❌'
    console.log(`  ${icon} ${result.passed ? 'PASS' : 'FAIL'} (${result.duration}ms)`)
    if (!result.passed) {
      for (const f of result.failures) {
        console.log(`    FAIL: ${f.dimension} - ${f.message}`)
      }
    }
  }

  // 汇总报告
  const passed = results.filter(r => r.passed).length
  console.log(`\n📊 ${passed}/${results.length} passed`)
  return results
}

async function runScenario(scenario, { mock, verbose }) {
  const start = Date.now()

  // 1. 准备环境
  const dbPath = path.join(__dirname, 'results', `${scenario.name}.db`)
  setupTestDb(dbPath, scenario.setup || [])

  // 2. 运行 agent
  const agentResult = await runAgent(scenario.input, {
    dbPath,
    mock,
    accountId: scenario.setup?.find(s => s.switch_account)?.[1] || 'default',
  })

  // 3. 验证
  const evalResult = evaluate(dbPath, agentResult, scenario.assertions)

  return {
    name: scenario.name,
    passed: evalResult.passed,
    duration: Date.now() - start,
    failures: evalResult.failures,
    toolCalls: agentResult.toolCalls,
  }
}
```

### evaluator.js 核心逻辑

```javascript
// harness/evaluator.js
function evaluate(dbPath, agentResult, assertions) {
  const failures = []
  const db = loadTestDb(dbPath)

  // 检查工具调用序列
  if (assertions.expected_tools) {
    for (const expected of assertions.expected_tools) {
      const called = agentResult.toolCalls.some(t => t.name === expected.name)
      if (!called) {
        failures.push({ dimension: 'tool_selection', message: `未调用 ${expected.name}` })
      }
      if (expected.must_contain) {
        const toolCall = agentResult.toolCalls.find(t => t.name === expected.name)
        if (toolCall) {
          const inputStr = JSON.stringify(toolCall.input)
          for (const keyword of expected.must_contain) {
            if (!inputStr.includes(keyword)) {
              failures.push({ dimension: 'tool_selection', message: `${expected.name} 参数缺少 ${keyword}` })
            }
          }
        }
      }
    }
  }

  // 检查 DB 状态
  if (assertions.table) {
    const a = assertions
    const where = Object.entries(a.where || {}).map(([k, v]) => `${k} = '${v}'`).join(' AND ')
    const count = db.exec(`SELECT COUNT(*) FROM ${a.table} WHERE ${where}`)[0]?.values[0][0] || 0

    if (a.count !== undefined && count !== a.count) {
      failures.push({ dimension: 'data_completeness', message: `${a.table} 期望 ${a.count} 条，实际 ${count} 条` })
    }
    if (a.min_count !== undefined && count < a.min_count) {
      failures.push({ dimension: 'data_completeness', message: `${a.table} 期望至少 ${a.min_count} 条，实际 ${count} 条` })
    }
    if (a.column_not_null) {
      for (const col of a.column_not_null) {
        const nullCount = db.exec(`SELECT COUNT(*) FROM ${a.table} WHERE ${where} AND (${col} IS NULL OR ${col} = '')`)[0]?.values[0][0] || 0
        if (nullCount > 0) {
          failures.push({ dimension: 'data_completeness', message: `${a.table}.${col} 有 ${nullCount} 条空值` })
        }
      }
    }
  }

  return { passed: failures.length === 0, failures }
}
```

---

## Mock 模式

测试时不想真的调 LLM API（慢 + 贵 + 不确定），所以支持 mock 模式：

```javascript
// harness/mock-server.js
const MOCK_RESPONSES = {
  // 场景 1 的 mock LLM 输出
  'bili-script-to-materials': {
    text: '已分析脚本并生成物料。',
    toolCalls: [
      {
        name: 'save_result',
        input: {
          script: 'iPhone 17 评测...',
          analysis: { type: 'tech_review', platforms: ['bili', 'dy', 'xhs', 'wb'] },
          result: {
            bili: { title: 'iPhone 17 深度评测', tags: ['iPhone', '评测'] },
            dy: { hook: 'iPhone 17 值得买吗？', title: '一分钟看 iPhone 17' },
            xhs: { title: 'iPhone 17 真实体验分享', tags: ['#iPhone17'] },
            youtube: { title: 'iPhone 17 In-Depth Review', tags: ['iPhone17'] },
          },
        },
      },
    ],
  },
}
```

Mock 模式下：
- 跳过真实 LLM 调用
- agent 的 router 仍然正常运行（验证工具选择逻辑）
- tool 的 execute 函数正常执行（验证 DB 写入逻辑）
- 只有 LLM 推理部分被 mock

---

## 运行方式

```bash
# 跑全部场景
cd knower-agent && node harness/runner.js

# 只跑核心物料生成场景
node harness/runner.js --filter core

# 只跑评论分析场景
node harness/runner.js --filter comments

# 用 mock 模式（快速，不调 LLM）
node harness/runner.js --mock

# 详细输出
node harness/runner.js --verbose
```

---

## 与 CI 集成

在 `package.json` 中加脚本：

```json
{
  "scripts": {
    "test:harness": "node harness/runner.js",
    "test:harness:mock": "node harness/runner.js --mock",
    "test:harness:core": "node harness/runner.js --filter core"
  }
}
```

Git pre-commit hook 中跑 `test:harness:mock`，确保提交前 agent 核心逻辑没退步。

---

## 渐进式扩展

### Phase 1（现在）
- 15 个核心场景
- Mock LLM 模式
- DB 状态验证
- 本地运行

### Phase 2（模型升级后）
- 加入真实 LLM 调用的集成测试
- 加入前端 UI 验证（如果 Electron 支持自动化测试）
- 加入性能基准（agent 响应时间、token 消耗）

### Phase 3（多模型对比）
- 同一场景跑多个 LLM provider
- 对比不同模型的工具选择准确率和输出质量
- 为每个场景记录最佳模型推荐

---

## 依赖

```bash
cd knower-agent && npm install js-yaml
```

只加一个轻量依赖（js-yaml），不动其他包。