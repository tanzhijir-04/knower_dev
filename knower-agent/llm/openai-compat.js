class OpenAICompatClient {
  constructor(config) {
    this.apiKey = config.apiKey
    this.model = config.model
    this.baseUrl = (config.baseUrl || 'https://api.openai.com').replace(/\/+$/, '')
  }

  _buildHeaders() {
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
    }
  }

  _convertTools(tools) {
    if (!tools?.length) return undefined
    return tools.map(t => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        parameters: t.input_schema,
      },
    }))
  }

  _convertMessages(system, messages) {
    const result = []
    if (system) {
      result.push({ role: 'system', content: system })
    }
    for (const msg of messages) {
      if (typeof msg.content === 'string') {
        result.push({ role: msg.role, content: msg.content })
      } else if (Array.isArray(msg.content)) {
        // Anthropic-style content blocks — convert for tool results
        for (const block of msg.content) {
          if (block.type === 'tool_result') {
            result.push({
              role: 'tool',
              tool_call_id: block.tool_use_id,
              content: block.content,
            })
          } else if (block.type === 'tool_use') {
            // This is from assistant — handled by tool_calls below
          } else if (block.type === 'text') {
            result.push({ role: msg.role, content: block.text })
          }
        }
        // Handle assistant messages with tool_use blocks
        const toolUseBlocks = msg.content.filter(b => b.type === 'tool_use')
        if (toolUseBlocks.length && msg.role === 'assistant') {
          result.push({
            role: 'assistant',
            content: null,
            tool_calls: toolUseBlocks.map(b => ({
              id: b.id,
              type: 'function',
              function: {
                name: b.name,
                arguments: typeof b.input === 'string' ? b.input : JSON.stringify(b.input),
              },
            })),
          })
        }
      }
    }
    return result
  }

  async chat({ system, messages, tools, maxTokens = 8096 }) {
    const body = {
      model: this.model,
      max_tokens: maxTokens,
      messages: this._convertMessages(system, messages),
    }
    const convertedTools = this._convertTools(tools)
    if (convertedTools) body.tools = convertedTools

    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: this._buildHeaders(),
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      const err = await response.text()
      throw new Error(`OpenAI API error ${response.status}: ${err}`)
    }

    const data = await response.json()
    const choice = data.choices?.[0]
    if (!choice) throw new Error('No choices in response')

    // Convert to Anthropic-like content blocks
    const content = []
    if (choice.message.content) {
      content.push({ type: 'text', text: choice.message.content })
    }
    if (choice.message.tool_calls?.length) {
      for (const tc of choice.message.tool_calls) {
        let input = {}
        try { input = JSON.parse(tc.function.arguments) } catch { /* ignore */ }
        content.push({
          type: 'tool_use',
          id: tc.id,
          name: tc.function.name,
          input,
        })
      }
    }

    const stopReason = choice.finish_reason === 'tool_calls' ? 'tool_use' : 'end_turn'
    return { content, stopReason }
  }

  async *stream({ system, messages, tools, maxTokens = 8096, signal }) {
    const body = {
      model: this.model,
      max_tokens: maxTokens,
      stream: true,
      messages: this._convertMessages(system, messages),
    }
    const convertedTools = this._convertTools(tools)
    if (convertedTools) body.tools = convertedTools

    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: 'POST',
      headers: this._buildHeaders(),
      body: JSON.stringify(body),
      signal,
    })

    if (!response.ok) {
      const err = await response.text()
      throw new Error(`OpenAI API error ${response.status}: ${err}`)
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    // Track streaming tool calls by index
    const toolCalls = {}
    let hasToolUse = false
    let textContent = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed || !trimmed.startsWith('data: ')) continue
        const data = trimmed.slice(6)
        if (data === '[DONE]') break

        let parsed
        try { parsed = JSON.parse(data) } catch { continue }

        const delta = parsed.choices?.[0]?.delta
        if (!delta) continue

        // Text content
        if (delta.content) {
          textContent += delta.content
          if (!hasToolUse) {
            yield { type: 'text', text: delta.content }
          }
        }

        // Tool calls (streamed in fragments)
        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index ?? 0
            if (!toolCalls[idx]) {
              toolCalls[idx] = {
                id: tc.id || '',
                name: '',
                arguments: '',
              }
              hasToolUse = true
            }
            if (tc.id) toolCalls[idx].id = tc.id
            if (tc.function?.name) toolCalls[idx].name = tc.function.name
            if (tc.function?.arguments) toolCalls[idx].arguments += tc.function.arguments
          }
        }
      }
    }

    // Reassemble tool calls into content blocks
    const content = []
    if (textContent) {
      content.push({ type: 'text', text: textContent })
    }

    const toolUseInputs = {}
    for (const idx of Object.keys(toolCalls).sort((a, b) => a - b)) {
      const tc = toolCalls[idx]
      let input = {}
      try { input = JSON.parse(tc.arguments || '{}') } catch { /* ignore */ }
      content.push({
        type: 'tool_use',
        id: tc.id,
        name: tc.name,
        input,
      })
      toolUseInputs[tc.id] = { name: tc.name, input }
    }

    const finishReason = parsed?.choices?.[0]?.finish_reason
    const stopReason = hasToolUse ? 'tool_use' : (finishReason === 'stop' ? 'end_turn' : 'end_turn')

    yield {
      type: 'final',
      content,
      stopReason,
      toolUseInputs,
      hasToolUse,
    }
  }
}

module.exports = OpenAICompatClient
