const analyzeScript = require('./analyze_script')
const expandScript = require('./expand_script')
const saveResult = require('./save_result')
const suggestTopics = require('./suggest_topics')

const tools = [analyzeScript, expandScript, saveResult, suggestTopics]

module.exports = { tools }
