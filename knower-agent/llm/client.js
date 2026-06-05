const { createClient } = require('./index')

/**
 * 简易 LLM 调用封装（非流式），供 IPC handler 中的 AI 分析使用
 */
async function callLLM(prompt, options = {}) {
  const settings = require('../config')
  const client = createClient({
    apiKey: settings.apiKey,
    model: options.model || settings.model || 'claude-sonnet-4-20250514',
    baseUrl: settings.baseUrl || '',
    provider: settings.apiProvider || 'claude',
    temperature: typeof settings.temperature === 'number' ? settings.temperature : 0.7,
    maxTokens: options.maxTokens || 2000,
  })

  const response = await client.chat({
    messages: [{ role: 'user', content: prompt }],
    maxTokens: options.maxTokens || 2000,
    temperature: typeof settings.temperature === 'number' ? settings.temperature : 0.7,
  })

  // 提取文本内容
  if (typeof response === 'string') return response
  if (response?.content) {
    const textBlocks = response.content.filter(b => b.type === 'text')
    return textBlocks.map(b => b.text).join('')
  }
  return String(response)
}

module.exports = { callLLM }
