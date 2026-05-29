class AgentState {
  constructor() {
    this.phase = 'idle'
    this.script = null
    this.analysis = null
    this.materials = null
    this.crawlData = null
    this.crawlStats = null
    this.topicSuggestions = null
    this.errors = []
    this.warnings = []
    this.userPreferences = {}
    this.toolHistory = []
    this.metadata = {
      startTime: Date.now(),
      toolCallCount: 0,
      iterationCount: 0,
      platforms: [],
      targetPlatforms: [],
    }
  }

  canTransitionTo(newPhase) {
    const transitions = {
      idle: ['crawling', 'analyzing', 'querying', 'suggesting'],
      crawling: ['analyzing', 'idle', 'done'],
      analyzing: ['generating', 'idle', 'done'],
      generating: ['saving', 'idle', 'done'],
      saving: ['idle', 'done'],
      querying: ['idle', 'done'],
      suggesting: ['idle', 'done'],
      done: ['idle'],
    }
    return transitions[this.phase]?.includes(newPhase) ?? false
  }

  transition(newPhase) {
    if (!this.canTransitionTo(newPhase)) {
      throw new Error(`非法状态转换: ${this.phase} -> ${newPhase}`)
    }
    this.phase = newPhase
  }

  getNextAction() {
    if (this.errors.length > 0 && this.phase !== 'idle') {
      return { action: 'handle_error', reason: '有未处理的错误' }
    }

    switch (this.phase) {
      case 'idle':
        if (!this.script && !this.crawlData) {
          return { action: 'request_info', reason: '缺少脚本或爬取目标' }
        }
        if (this.script && !this.analysis) {
          return { action: 'analyze', reason: '有脚本但未分析' }
        }
        if (this.crawlData && !this.analysis) {
          return { action: 'analyze_from_data', reason: '有爬取数据但未分析' }
        }
        break

      case 'crawling':
        if (!this.crawlData) {
          return { action: 'wait_crawl', reason: '等待爬取完成' }
        }
        return { action: 'analyze_from_data', reason: '爬取完成，开始分析' }

      case 'analyzing':
        if (!this.analysis) {
          return { action: 'wait_analysis', reason: '等待分析完成' }
        }
        return { action: 'generate', reason: '分析完成，开始生成物料' }

      case 'generating':
        if (!this.materials) {
          return { action: 'wait_generation', reason: '等待生成完成' }
        }
        return { action: 'save', reason: '生成完成，开始保存' }

      case 'saving':
        return { action: 'done', reason: '保存完成' }

      case 'querying':
        return { action: 'done', reason: '查询完成' }

      case 'suggesting':
        return { action: 'done', reason: '建议生成完成' }

      case 'done':
        return { action: 'idle', reason: '任务完成，回到空闲' }
    }

    return { action: 'idle', reason: '无明确下一步' }
  }

  serialize() {
    return JSON.parse(JSON.stringify(this))
  }

  static deserialize(data) {
    const state = new AgentState()
    Object.assign(state, data)
    return state
  }
}

module.exports = AgentState
