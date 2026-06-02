function determineNextAction(state, llmResponse) {
  if (llmResponse.stopReason === 'tool_use') {
    const toolBlocks = llmResponse.content.filter(b => b.type === 'tool_use')

    for (const block of toolBlocks) {
      if (!isToolCompatibleWithPhase(block.name, state.phase)) {
        console.warn(`[Router] 工具 ${block.name} 在 ${state.phase} 阶段不兼容`)
        state.warnings.push(`在 ${state.phase} 阶段调用了 ${block.name}，可能不符合预期`)
      }
    }
    return { type: 'execute_tools', tools: toolBlocks }
  }

  const next = state.getNextAction()

  switch (next.action) {
    case 'handle_error':
      return { type: 'handle_error', errors: state.errors }
    case 'analyze':
      return { type: 'auto_analyze' }
    case 'generate':
      return { type: 'auto_generate' }
    case 'save':
      return { type: 'auto_save' }
    case 'done':
      return { type: 'done' }
    default:
      return { type: 'continue' }
  }
}

function isToolCompatibleWithPhase(toolName, phase) {
  const compatibility = {
    idle: ['crawl_data', 'crawl_data_batch', 'query_data', 'suggest_topics', 'request_user_input', 'analyze_script', 'search_similar'],
    crawling: ['crawl_data', 'crawl_data_batch', 'query_data', 'search_similar'],
    analyzing: ['analyze_script', 'request_user_input', 'search_similar'],
    generating: ['expand_script', 'search_similar'],
    saving: ['save_result'],
    querying: ['query_data', 'search_similar'],
    suggesting: ['suggest_topics'],
    done: [],
  }
  return compatibility[phase]?.includes(toolName) ?? false
}

module.exports = { determineNextAction, isToolCompatibleWithPhase }
