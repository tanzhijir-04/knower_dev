const analyzeScript = require('./analyze_script')
const expandScript = require('./expand_script')
const saveResult = require('./save_result')
const suggestTopics = require('./suggest_topics')
const crawlData = require('./crawl_data')
const queryData = require('./query_data')
const requestUserInput = require('./request_user_input')

const tools = [crawlData, queryData, requestUserInput, saveResult, analyzeScript, expandScript, suggestTopics]

module.exports = { tools }
