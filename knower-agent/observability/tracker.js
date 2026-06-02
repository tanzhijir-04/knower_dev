class ExecutionTracker {
  constructor() {
    this.events = []
    this.startTime = Date.now()
  }

  track(type, data) {
    this.events.push({
      type,
      timestamp: Date.now(),
      elapsed: Date.now() - this.startTime,
      ...data,
    })
  }

  trackToolCall(name, input) {
    this.track('tool_call', {
      tool: name,
      input: JSON.stringify(input).slice(0, 500),
    })
  }

  trackToolResult(name, result, durationMs) {
    this.track('tool_result', {
      tool: name,
      success: !result.error,
      error: result.error || null,
      durationMs,
      outputSize: JSON.stringify(result).length,
    })
  }

  trackStateChange(from, to, reason) {
    this.track('state_change', { from, to, reason })
  }

  trackLLMCall(model, tokenCount) {
    this.track('llm_call', { model, tokenCount })
  }

  getSummary() {
    const toolCalls = this.events.filter(e => e.type === 'tool_call').length
    const toolResults = this.events.filter(e => e.type === 'tool_result')
    const successes = toolResults.filter(e => e.success).length
    const failures = toolResults.filter(e => !e.success).length
    const totalTimeMs = Date.now() - this.startTime

    return {
      totalEvents: this.events.length,
      toolCalls,
      successes,
      failures,
      totalTimeMs,
      avgToolTime: toolResults.length
        ? Math.round(toolResults.reduce((s, e) => s + (e.durationMs || 0), 0) / toolResults.length)
        : 0,
      stateChanges: this.events.filter(e => e.type === 'state_change').map(e => `${e.from}→${e.to}`),
    }
  }

  toDisplayEvents() {
    return this.events.map(e => {
      switch (e.type) {
        case 'tool_call':
          return {
            icon: '🔧',
            text: `调用 ${e.tool}`,
            detail: e.input,
            time: e.elapsed,
            status: 'running',
          }
        case 'tool_result':
          return {
            icon: e.success ? '✅' : '❌',
            text: `${e.tool} ${e.success ? '成功' : '失败'}`,
            detail: e.error || `耗时 ${e.durationMs}ms`,
            time: e.elapsed,
            status: e.success ? 'success' : 'error',
            durationMs: e.durationMs,
          }
        case 'state_change':
          return {
            icon: '🔄',
            text: `${e.from} → ${e.to}`,
            detail: e.reason,
            time: e.elapsed,
            status: 'info',
          }
        case 'llm_call':
          return {
            icon: '🧠',
            text: 'LLM 分析',
            detail: e.tokenCount ? `${e.tokenCount} tokens` : '',
            time: e.elapsed,
            status: 'success',
          }
        default:
          return {
            icon: '📋',
            text: e.type,
            detail: JSON.stringify(e).slice(0, 200),
            time: e.elapsed,
            status: 'info',
          }
      }
    })
  }
}

module.exports = ExecutionTracker
