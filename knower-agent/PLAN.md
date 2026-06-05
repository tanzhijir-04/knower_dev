# Agent 上下文瘦身重构 — 任务状态

## 已完成（第二轮修正）

### 1. 工具返回值摘要化 ✅
**文件:** `agent/core.js`

按新 spec 重写了 `summarizeToolResult(toolName, result)`：

| 工具 | 摘要策略 | 节省 |
|------|----------|------|
| `crawl_data_batch` | 每平台只保留 count + topTitle，不塞全量 contents | 82% |
| `crawl_data` | 保留 topContents（已截断 10 条），creators 压缩为逗号分隔字符串 | creators 部分 |
| `query_data` (videos) | 截断到 10 条标题 sample，不塞完整 videos 数组 | 大幅 |
| `query_data` (sources) | 原样返回（本身不大） | 0% |
| `suggest_topics` | 只保留 title/overallScore/urgency，去掉 reason/competitors | 82% |
| 其他工具 | 原样返回 | 0% |

`run()` 和 `stream()` 中 `toolResults.push` 前统一调用 `summarizeToolResult`。

### 2. 消息历史压缩 ✅
**文件:** `agent/core.js`

按新 spec 重写了 `compressMessages(messages, maxMessages = 20)`：

- 超过 20 条时：保留首条 user message + 最近 18 条 + 压缩摘要
- 摘要格式简洁：`[之前 N 次工具调用已完成]` 或 `[之前的对话已省略]`
- `run()` 和 `stream()` 的 while 循环开头、LLM 调用前调用

### 3. buildContextFromState 瘦身 ✅
**文件:** `agent/processor.js`

按新 spec 修正：
- `crawlData`：只给"共 N 条，已存入数据库。用 query_local_db 按条件查询具体数据。"
  - 不再逐条列出标题，不再提取平台列表
- `analysis`：保留但截断到 500 字符
- 移除了 `topicSuggestions` 分支（不在 spec 中）
- `errors`/`warnings`：保持不变

### 4. router 兼容性修复 ✅
**文件:** `agent/router.js`

在 `isToolCompatibleWithPhase` 的兼容性列表中加入 `query_local_db`：
- `idle`: ✅ 已加入
- `crawling`: ✅ 已加入
- `querying`: ✅ 已加入
- 其他阶段（analyzing/generating/saving/suggesting/done）：不加入

LLM 调用 query_local_db 时不再触发 "工具在阶段不兼容" 警告。

### 5. query_local_db 工具 ✅（此前已存在）
**文件:** `agent/tools/query_local_db.js`、`agent/tools/index.js`
- 已注册到 tools 数组，工具总数 13 个
- 支持 6 种查询类型，返回值控制在 limit 条以内

## 测试结果

所有测试通过 (`test-context-slim.js`)：
```
=== 测试 1: summarizeToolResult ===
  ✅ crawl_data_batch: 801 → 146 字节 (省 82%)
  ✅ crawl_data: 保留 topContents (10 条), creators 压缩为字符串
  ✅ query_data: 50 条 videos → sample 10 条
  ✅ query_data sources: 原样返回
  ✅ suggest_topics: 2525 → 460 字节 (省 82%)
  ✅ 其他工具: 原样返回

=== 测试 2: compressMessages ===
  ✅ ≤ 20 条不压缩
  ✅ 30 条 → 20 条（含摘要 "[之前 5 次工具调用已完成]"）
  ✅ 无工具调用时摘要为 "[之前的对话已省略]"

=== 测试 3: buildContextFromState ===
  ✅ crawlData 只给元信息（94 字符），不含具体标题，不含 topicSuggestions

=== 测试 4: router 兼容性 ===
  ✅ query_local_db 在 idle/crawling/querying 兼容，其他阶段不兼容

=== 测试 5: query_local_db 工具 ===
  ✅ 工具定义完整，6 种查询类型
  ✅ memory 查询: 0 条
  ✅ crawl_data 查询: 0 条
```

## 改动文件清单

| 文件 | 改动 |
|------|------|
| `agent/core.js` | 重写 summarizeToolResult（4 种工具摘要）+ compressMessages（简洁计数）+ run/stream 集成 |
| `agent/processor.js` | 修正 buildContextFromState（去掉 topicSuggestions，简化 crawlData） |
| `agent/router.js` | query_local_db 加入 idle/crawling/querying 兼容性列表 |
| `agent/tools/query_local_db.js` | 已存在（此前创建） |
| `agent/tools/index.js` | 已注册（此前完成） |
| `test-context-slim.js` | 更新验证测试 |
| `PLAN.md` | 本文档 |
