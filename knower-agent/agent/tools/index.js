const analyzeScript = require('./analyze_script')
const expandScript = require('./expand_script')
const saveResult = require('./save_result')
const suggestTopics = require('./suggest_topics')
const crawlData = require('./crawl_data')
const crawlDataBatch = require('./crawl_data_batch')
const queryData = require('./query_data')
const requestUserInput = require('./request_user_input')
const searchSimilar = require('./search_similar')
const analyzeComments = require('./analyze_comments')
const recordReview = require('./record_review')
const analyzeCompetitor = require('./analyze_competitor')

const tools = [crawlData, crawlDataBatch, queryData, requestUserInput, saveResult, analyzeScript, expandScript, suggestTopics, searchSimilar, analyzeComments, recordReview, analyzeCompetitor]

module.exports = { tools }
