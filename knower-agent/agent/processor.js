function processToolResult(toolName, rawResult, state, accountId = 'default') {
  const result = typeof rawResult === 'string' ? JSON.parse(rawResult) : rawResult

  switch (toolName) {
    case 'crawl_data':
      state.crawlData = result.contents || []
      state.crawlStats = result.stats || {}
      state.metadata.platforms.push(result.platform)
      if (state.crawlData.length === 0) {
        state.warnings.push(`${result.platform} 平台暂无数据`)
      }
      // Auto-index crawled content for RAG
      if (state.crawlData.length > 0) {
        try {
          const { indexCrawlBatch } = require('../rag/indexer')
          indexCrawlBatch(accountId, state.crawlData).catch(err => {
            console.error('[Processor] 自动索引失败:', err.message)
          })
        } catch { /* rag module not available */ }
        if (state.crawlData.length > 20) {
          state.warnings.push(`数据较多（${state.crawlData.length}条），建议用 search_similar 按语义筛选重点内容`)
        }
      }
      break

    case 'crawl_data_batch':
      if (result.results) {
        for (const r of result.results) {
          if (r.success && r.data) {
            state.crawlData = state.crawlData || []
            state.crawlData.push(...(r.data.contents || []))
            state.metadata.platforms.push(r.platform)
          }
        }
        state.crawlStats = { total: result.totalCount || 0 }
      }
      break

    case 'query_data':
      state.crawlData = result.videos || result.sources || []
      state.crawlStats = { total: result.totalCount || result.totalSources || 0 }
      break

    case 'analyze_script':
      state.analysis = result.analysis || result
      break

    case 'expand_script':
      state.materials = result.result || result
      break

    case 'suggest_topics':
      state.topicSuggestions = result.topics || []
      break

    case 'save_result':
      state.metadata.saved = true
      state.metadata.savedId = result.id
      // Auto-index saved script for RAG
      if (result.id && state.script) {
        try {
          const { indexScript } = require('../rag/indexer')
          indexScript(accountId, result.id, state.script).catch(err => {
            console.error('[Processor] 索引脚本失败:', err.message)
          })
        } catch { /* rag module not available */ }
      }
      break

    case 'request_user_input':
      if (result.data) {
        Object.assign(state.userPreferences, result.data)
      }
      break
  }

  state.toolHistory.push({
    tool: toolName,
    timestamp: Date.now(),
    success: !result.error,
    error: result.error || null,
  })

  state.metadata.toolCallCount++
  return state
}

function buildContextFromState(state) {
  const parts = []

  // crawlData 只有 crawl_data_batch 会填充
  if (state.crawlData?.length > 0) {
    parts.push(`## 已爬取的数据\n共 ${state.crawlData.length} 条，已存入数据库。用 query_local_db 按条件查询具体数据。`)
    // 不再逐条列出标题，节省 token
  }

  if (state.analysis) {
    // 分析结果通常不大，保留但截断
    const analysisStr = JSON.stringify(state.analysis)
    parts.push(`## 脚本分析结果\n${analysisStr.slice(0, 500)}`)
  }

  if (state.errors.length > 0) {
    parts.push(`## 遇到的问题\n${state.errors.map(e => `- ${e}`).join('\n')}`)
  }
  if (state.warnings.length > 0) {
    parts.push(`## 注意事项\n${state.warnings.map(w => `- ${w}`).join('\n')}`)
  }

  return parts.join('\n\n')
}

function suggestNextTools(state) {
  const suggestions = []

  switch (state.phase) {
    case 'idle':
      if (!state.script) suggestions.push('request_user_input（请求脚本内容）')
      if (state.script && !state.analysis) suggestions.push('analyze_script（分析脚本）')
      break
    case 'analyzing':
      if (state.analysis && !state.materials) suggestions.push('expand_script（生成物料）')
      break
    case 'generating':
      if (state.materials && !state.metadata.saved) suggestions.push('save_result（保存结果）')
      break
  }

  return suggestions
}

module.exports = { processToolResult, buildContextFromState, suggestNextTools }
