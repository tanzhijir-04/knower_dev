# 迁移指南：如何将优化后的提示词集成到 knower-agent

## 文件清单

```
knower-agent/prompts/
  AGENT-SKILL.md          # Agent 行为规范文档（供开发者和 AI 阅读）
  system-prompt.js         # 优化后的系统提示词（替换 core.js 中的 BASE_SYSTEM_PROMPT）
  optimized-tools.js       # 优化后的工具描述（替换各工具的 description 和 input_schema）
  MIGRATION.md             # 本文件
```

## 步骤 1：替换系统提示词

在 `knower-agent/agent/core.js` 中：

```javascript
// 删除旧的 BASE_SYSTEM_PROMPT（约 80 行）
// const BASE_SYSTEM_PROMPT = `...`

// 替换为：
const { OPTIMIZED_SYSTEM_PROMPT: BASE_SYSTEM_PROMPT } = require('../prompts/system-prompt')
```

或者直接把 `prompts/system-prompt.js` 中的 `OPTIMIZED_SYSTEM_PROMPT` 内容复制到 `core.js` 的 `BASE_SYSTEM_PROMPT` 变量中。

## 步骤 2：替换工具描述

有两个方案：

### 方案 A：只替换 description（推荐，改动最小）

只更新每个工具文件中的 `description` 字段，保留 `input_schema` 和 `execute` 不变。

参考 `prompts/optimized-tools.js` 中每个工具的 `description`，替换对应文件：

- `agent/tools/crawl_data.js` -> description
- `agent/tools/query_data.js` -> description
- `agent/tools/analyze_script.js` -> description
- `agent/tools/expand_script.js` -> description
- `agent/tools/suggest_topics.js` -> description
- `agent/tools/save_result.js` -> description
- `agent/tools/request_user_input.js` -> description

### 方案 B：整体替换（改动较大）

直接用 `prompts/optimized-tools.js` 中的 `optimizedTools` 数组替换 `agent/tools/index.js` 中的 `tools` 数组。

注意：这需要确保每个工具的 `execute` 函数仍然正确引用。

## 步骤 3：验证

运行测试脚本验证：

```bash
cd knower-agent
node run.js
```

观察：
1. Agent 是否在回复前先检查工具
2. 是否正确调用了 crawl_data（而不是编造数据）
3. 是否在生成物料后调用了 save_result
4. 错误处理是否友好

## 关键改进点

### 1. 强制工具检查流程
旧版：Agent 可能跳过工具调用，直接编造回复
新版：系统提示词中有明确的检查流程，Agent 必须先走流程再回复

### 2. 红旗表（反模式检测）
旧版：没有反模式检测
新版：10 条红旗规则，Agent 遇到这些情况时会"停下来"

### 3. 路径化工具调用
旧版：工具调用顺序不明确
新版：4 条明确路径（A/B/C/D），每条路径有严格顺序

### 4. 工具描述增强
旧版：description 只说明工具做什么
新版：description 包含「什么时候必须调用」「什么时候不要调用」「常见错误」

### 5. 信息完整性检查
旧版：Agent 可能猜测缺失信息
新版：有明确的检查清单，缺什么就问什么

## 注意事项

- 优化后的 system prompt 更长（约 120 行 vs 原来 80 行），会增加 token 消耗
- 工具描述也更详细，同样增加 token
- 建议在非生产环境先测试，观察 Agent 行为是否符合预期
- 如果发现 Agent 过于"谨慎"（频繁调用 request_user_input），可以适当放宽红旗表中的某些规则