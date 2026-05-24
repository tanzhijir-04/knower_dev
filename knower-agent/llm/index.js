const AnthropicClient = require('./anthropic')
const OpenAICompatClient = require('./openai-compat')

function createClient(config) {
  const provider = (config.provider || 'claude').toLowerCase()
  if (provider === 'anthropic' || provider === 'claude') {
    return new AnthropicClient(config)
  }
  return new OpenAICompatClient(config)
}

module.exports = { createClient }
