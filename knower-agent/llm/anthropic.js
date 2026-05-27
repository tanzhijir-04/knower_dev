const Anthropic = require('@anthropic-ai/sdk')

class AnthropicClient {
  constructor(config) {
    const opts = { apiKey: config.apiKey }
    if (config.baseUrl) opts.baseURL = config.baseUrl
    this.client = new Anthropic(opts)
    this.model = config.model
  }

  async chat({ system, messages, tools, maxTokens = 8096 }) {
    const params = {
      model: this.model,
      max_tokens: maxTokens,
      messages,
    }
    if (system) params.system = system
    if (tools?.length) {
      params.tools = tools.map(t => ({
        name: t.name,
        description: t.description,
        input_schema: t.input_schema,
      }))
    }

    const response = await this.client.messages.create(params)
    return {
      content: response.content,
      stopReason: response.stop_reason,
      usage: response.usage,
    }
  }

  async *stream({ system, messages, tools, maxTokens = 8096, signal }) {
    const params = {
      model: this.model,
      max_tokens: maxTokens,
      messages,
    }
    if (system) params.system = system
    if (tools?.length) {
      params.tools = tools.map(t => ({
        name: t.name,
        description: t.description,
        input_schema: t.input_schema,
      }))
    }

    const apiStream = this.client.messages.stream(params)

    let currentToolUse = null
    const toolUseInputs = {}
    let hasToolUse = false

    for await (const event of apiStream) {
      if (signal?.aborted) return

      if (event.type === 'content_block_start') {
        if (event.content_block.type === 'tool_use') {
          currentToolUse = event.content_block.id
          hasToolUse = true
          toolUseInputs[currentToolUse] = {
            name: event.content_block.name,
            input: '',
          }
        }
      } else if (event.type === 'content_block_delta') {
        if (event.delta.type === 'text_delta') {
          if (!hasToolUse) {
            yield { type: 'text', text: event.delta.text }
          }
        } else if (event.delta.type === 'input_json_delta') {
          if (currentToolUse) {
            toolUseInputs[currentToolUse].input += event.delta.partial_json
          }
        }
      } else if (event.type === 'content_block_stop') {
        if (currentToolUse && toolUseInputs[currentToolUse]) {
          try {
            toolUseInputs[currentToolUse].input = JSON.parse(
              toolUseInputs[currentToolUse].input || '{}'
            )
          } catch {
            toolUseInputs[currentToolUse].input = {}
          }
        }
        currentToolUse = null
      }
    }

    const finalMessage = await apiStream.finalMessage()

    yield {
      type: 'final',
      content: finalMessage.content,
      stopReason: finalMessage.stop_reason,
      toolUseInputs,
      hasToolUse,
      usage: finalMessage.usage,
    }
  }
}

module.exports = AnthropicClient
