const { getTopContent, getRecentTrends, getMemories, getCompetitorRecentContent, getCompetitors } = require('../../db')
const settings = require('../../config')

const MODE_PROMPTS = {
  trend: `基于平台趋势数据，生成追热型选题。
重点：时效性、热点匹配度、快速执行。
每个选题必须关联至少一个具体热点事件。
标注 urgency（时效性："24h"/"3天"/"长期"）和 competitionLevel（竞争度："低"/"中"/"高"）。`,

  differentiated: `分析用户历史数据和平台内容分布，找到差异化方向。
重点：低竞争、高潜力、与用户风格契合。
避免推荐已经泛滥的选题方向。
competitionLevel 应倾向于"低"，强调蓝海机会。`,

  competitor: `基于竞品近期内容，找到差异化切入点。
重点：竞品覆盖但用户未覆盖的方向、竞品的薄弱环节。
给出具体的差异化角度和竞争度分析。`,

  series: `基于用户历史高互动内容，规划系列化内容。
重点：系列内部逻辑、每期独立价值、用户留存。
给出 5-10 期的系列规划，每期标注子主题。`,
}

// 无数据时的降级 prompt
const FALLBACK_SYSTEM_PROMPT = `你是一位视频选题策划专家。创作者目前还没有足够的平台数据，你需要基于你的通用知识为该平台创作者生成不过时的选题建议。

只返回 JSON 数组，不要有任何其他文字。

重要约束：
- 重点推荐常青内容方向（教程、评测方法、经验分享、行业分析等）
- 不要推荐特定日期的一次性事件
- 不要编造具体的数据或案例`

function log(msg) {
  console.log(`[suggest_topics] ${msg}`)
}

module.exports = {
  name: 'suggest_topics',
  description: `结合用户历史数据和平台趋势，生成个性化选题建议。工具内部会自动查询历史数据和趋势。

**什么时候必须调用：**
- 用户说"选题"、"灵感"、"brainstorm"、"做什么内容"、"帮我想想"
- 用户说"有什么好的选题"

**什么时候不要调用：**
- 用户只是在讨论某个具体话题（闲聊）
- 用户说"分析这个选题好不好"（这不是生成选题，是评估）

**常见错误：**
- 用户说"推荐选题"但没说平台 -> 默认用 bilibili，但最好先确认`,
  input_schema: {
    type: 'object',
    properties: {
      platform: { type: 'string', description: '目标平台（bili/dy/xhs/wb）' },
      count: { type: 'number', description: '生成选题数量，默认 5' },
      mode: {
        type: 'string',
        description: '选题策略：trend（趋势追热）/ differentiated（差异化切入）/ competitor（竞品对标）/ series（系列化），默认 trend',
        enum: ['trend', 'differentiated', 'competitor', 'series'],
      },
      competitorUids: {
        type: 'array',
        items: { type: 'string' },
        description: '竞品用户 ID 列表（仅 competitor 模式使用）',
      },
      seriesTopic: {
        type: 'string',
        description: '系列主题（仅 series 模式使用）',
      },
    },
    required: ['platform'],
  },
  async execute({ platform, count = 5, mode = 'trend', competitorUids, seriesTopic, accountId, onProgress }) {
    const progress = onProgress || (() => {})

    try {
      progress('检查 API Key...')
      log(`开始执行: platform=${platform}, mode=${mode}, count=${count}`)

      if (!settings.apiKey) {
        log('错误: 缺少 API Key')
        return { error: '缺少 API Key，请在设置页面配置 API Key' }
      }
      log(`API 配置: provider=${settings.provider}, model=${settings.model}`)

      const aid = accountId || 'default'

      // 查询数据
      progress('查询历史数据...')
      log('查询历史高互动内容...')
      let topContent = await getTopContent(platform, 20, aid)
      log(`  历史数据: ${topContent.length} 条`)

      progress('查询平台趋势...')
      log('查询近 7 天趋势数据...')
      let trends = await getRecentTrends(platform, 7, aid)
      log(`  趋势数据: ${trends.length} 条`)

      progress('查询用户偏好...')
      log('查询用户偏好记忆...')
      const memories = await getMemories(aid)
      log(`  偏好数据: ${memories.length} 条`)

      let hasData = topContent.length > 0 || trends.length > 0
      log(`数据充足性: ${hasData ? '有数据' : '无数据（将使用降级模式）'}`)

      // 如果没有数据，先尝试获取全网热点数据
      if (!hasData) {
        log('无本地数据，尝试获取全网热点...')
        progress('正在获取平台热点...')

        try {
          const { fetchTrending } = require('../../lib/trending')
          const platformSourceMap = {
            bili: 'bilibili',
            dy: 'douyin',
            wb: 'weibo',
            xhs: 'weibo',
          }
          const sourceId = platformSourceMap[platform] || 'bilibili'
          const trendingData = await fetchTrending([sourceId])
          const trendingItems = trendingData[sourceId] || []

          if (trendingItems.length > 0) {
            log(`获取到 ${trendingItems.length} 条热点`)
            // 将热点数据转换为 trends 格式
            trends = trendingItems.slice(0, 20).map(t => ({
              title: t.title,
              desc: t.extra?.desc || t.extra?.info || '',
              authorName: t.extra?.author || '',
              playCount: t.extra?.view || 0,
              likeCount: t.extra?.like || 0,
              commentCount: 0,
              createdAt: t.extra?.pubDate ? new Date(t.extra.pubDate).toISOString() : new Date().toISOString(),
            }))
            hasData = true
          }
        } catch (err) {
          log(`获取热点失败: ${err.message}`)
        }
      }

      // 如果没有数据，自动爬取一轮热点
      if (!hasData) {
        log('无本地数据，尝试自动爬取平台热点...')
        progress('正在爬取平台热点数据...')

        try {
          const { runCrawler } = require('../../lib/crawler')
          const platformNames = { bili: '热门', dy: '热门', xhs: '热门', wb: '热搜' }
          const crawlResult = await runCrawler(platform, platformNames[platform] || '热门', { maxNotes: 30 })

          // runCrawler 返回 { contents: [...] } 格式
          const crawledCount = crawlResult.contents?.length || 0
          if (crawledCount > 0) {
            log(`自动爬取成功: ${crawledCount} 条内容`)
            // 重新查询数据库获取爬取的数据
            topContent = await getTopContent(platform, 20, aid)
            trends = await getRecentTrends(platform, 7, aid)
            hasData = topContent.length > 0 || trends.length > 0
            log(`爬取后数据: 历史 ${topContent.length} 条, 趋势 ${trends.length} 条`)
          } else {
            log('自动爬取未获取到内容')
          }
        } catch (crawlErr) {
          log(`自动爬取失败: ${crawlErr.message}`)
        }
      }

      // competitor 模式下查询竞品数据
      let competitorStr = '暂无竞品数据'
      if (mode === 'competitor' && competitorUids?.length) {
        progress('查询竞品数据...')
        log(`查询竞品数据: ${competitorUids.length} 个竞品`)
        const compContent = await getCompetitorRecentContent(platform, competitorUids, 7, aid)
        log(`  竞品内容: ${compContent.length} 条`)
        if (compContent.length) {
          competitorStr = compContent.map((v, i) => `${i + 1}. "${v.title}" | 播放: ${v.playCount} | 作者: ${v.authorName} | 分类: ${v.category || '未分类'}`).join('\n')
        }
      }

      const { createClient } = require('../../llm')
      const client = createClient(settings)

      // 构建 prompt
      const topContentStr = topContent.length
        ? topContent.map((v, i) => `${i + 1}. "${v.title}" | 播放: ${v.playCount} | 点赞: ${v.likeCount} | 分类: ${v.category || '未分类'}`).join('\n')
        : '暂无历史数据'

      const trendsStr = trends.length
        ? trends.map((v, i) => `${i + 1}. "${v.title}" | 播放: ${v.playCount} | 作者: ${v.authorName}`).join('\n')
        : '暂无趋势数据'

      const memoriesStr = memories.length
        ? memories.map(m => `- ${m.value}（${m.type}）`).join('\n')
        : '暂无偏好数据'

      const modePrompt = MODE_PROMPTS[mode] || MODE_PROMPTS.trend

      const seriesHint = mode === 'series' && seriesTopic
        ? `\n系列主题方向：${seriesTopic}`
        : ''

      // 根据数据情况选择 prompt
      let systemPrompt
      let userContent

      if (hasData) {
        systemPrompt = `你是一位视频选题策划专家。根据数据为创作者生成个性化选题建议。
只返回 JSON 数组，不要有任何其他文字。

${modePrompt}

评分规则（每个选题必须包含 scores 对象）：
- heat（热度匹配度 0-100）：选题与当前平台热点的匹配程度
- competition（竞争度 0-100）：同类内容的数量和质量（越低越好）
- feasibility（可执行性 0-100）：基于用户资源的制作难度
- fit（账号契合度 0-100）：与用户历史高互动内容的相似度
- urgency（时效性 0-100）：热点的生命周期

综合评分 overallScore = heat*0.3 + (100-competition)*0.25 + feasibility*0.2 + fit*0.15 + urgency*0.1`

        userContent = `请为一位视频创作者生成 ${count} 个选题建议。

## 创作者历史高互动内容
${topContentStr}

## 当前平台趋势
${trendsStr}

## 创作者已知偏好
${memoriesStr}
${competitorStr !== '暂无竞品数据' ? `\n## 竞品近期内容\n${competitorStr}` : ''}
${seriesHint}

## 要求
每个选题包含：
- title: 选题标题（有吸引力，15字以内）
- reason: 推荐理由（基于数据依据，30字以内）
- source: 灵感来源（"历史高互动"/"当前趋势"/"结合两者"）
- estimatedPerformance: 预估表现（"高"/"中"/"参考同类"）
- tags: 建议标签（3-5个）
- scores: { heat: 0-100, competition: 0-100, feasibility: 0-100, fit: 0-100, urgency: 0-100 }
- overallScore: 综合评分（0-100）
- urgency: 时效性（"24h"/"3天"/"长期"）
- competitionLevel: 竞争度（"低"/"中"/"高"）
- actionPlan: 行动建议（一句话）

返回 JSON 数组，不要有其他文字。`
      } else {
        // 无数据降级模式
        log('使用降级模式: 无历史数据，基于平台知识生成选题')
        systemPrompt = FALLBACK_SYSTEM_PROMPT

        const platformNames = { bili: 'B站', dy: '抖音', xhs: '小红书', wb: '微博' }
        userContent = `请为一位${platformNames[platform] || platform}创作者生成 ${count} 个选题建议。

## 平台信息
目标平台：${platformNames[platform] || platform}
选题策略：${mode}

## 要求
由于创作者刚起步，没有足够的历史数据。请基于你对${platformNames[platform] || platform}平台的了解，生成有潜力的选题。
重点关注：
- 当前平台的热门内容方向
- 新兴的、竞争较少的细分领域
- 容易获得流量的选题类型

每个选题包含：
- title: 选题标题（有吸引力，15字以内）
- reason: 推荐理由（30字以内）
- source: 灵感来源（"平台趋势"/"专业判断"/"蓝海机会"）
- estimatedPerformance: 预估表现（"高"/"中"/"参考同类"）
- tags: 建议标签（3-5个）
- scores: { heat: 0-100, competition: 0-100, feasibility: 0-100, fit: 0-100, urgency: 0-100 }
- overallScore: 综合评分（0-100）
- urgency: 时效性（"24h"/"3天"/"长期"）
- competitionLevel: 竞争度（"低"/"中"/"高"）
- actionPlan: 行动建议（一句话）

返回 JSON 数组，不要有其他文字。`
      }

      // 注入当前日期到 systemPrompt
      const today = new Date().toLocaleDateString('zh-CN', {
        year: 'numeric', month: 'long', day: 'numeric', weekday: 'long'
      })
      systemPrompt += `\n\n重要：今天的日期是 ${today}。不要推荐已经过时的事件。`

      // 调用 LLM
      progress('AI 正在生成选题...')
      log(`调用 LLM: model=${settings.model}`)
      const startTime = Date.now()

      const response = await client.chat({
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: userContent,
        }],
        maxTokens: 4096,
      })

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
      log(`LLM 响应完成: ${elapsed}s`)

      // 解析响应
      progress('解析选题结果...')
      log(`响应 content 块数: ${response.content.length}`)
      log(`content 块类型: ${response.content.map(b => b.type).join(', ')}`)

      // 提取文本内容（兼容不同返回格式）
      let text = ''
      if (Array.isArray(response.content)) {
        text = response.content
          .filter(b => b.type === 'text')
          .map(b => b.text)
          .join('')
      } else if (typeof response.content === 'string') {
        text = response.content
      } else if (response.text) {
        text = response.text
      }
      text = text.trim()

      log(`原始响应长度: ${text.length} 字符`)
      log(`响应前 300 字: ${text.substring(0, 300)}`)
      log(`响应后 100 字: ${text.substring(text.length - 100)}`)

      let topics
      try {
        topics = JSON.parse(text)
        log('JSON 解析成功')
      } catch {
        log('JSON 直接解析失败，尝试提取...')

        // 多种提取策略
        const strategies = [
          // 1. 直接清理代码块标记
          () => {
            const cleaned = text.replace(/```(?:json)?\s*\n?/g, '').replace(/\n?```/g, '').trim()
            return JSON.parse(cleaned)
          },
          // 2. 提取代码块内容
          () => {
            const m = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/)
            return m ? JSON.parse(m[1].trim()) : null
          },
          // 3. 提取 [...] 数组
          () => {
            const m = text.match(/\[[\s\S]*\]/)
            return m ? JSON.parse(m[0]) : null
          },
          // 4. 移除前后缀文字 + 修复尾部逗号
          () => {
            let cleaned = text.replace(/^[\s\S]*?(\[[\s\S]*\])[\s\S]*$/, '$1')
            cleaned = cleaned.replace(/,\s*([\]}])/g, '$1')  // 移除尾部逗号
            return JSON.parse(cleaned)
          },
          // 5. 修复截断的 JSON（关闭未闭合的括号）
          () => {
            let cleaned = text.replace(/```(?:json)?\s*\n?/g, '').replace(/\n?```/g, '').trim()
            cleaned = cleaned.replace(/,\s*([\]}])/g, '$1')
            // 找到最后一个完整的对象，截断后面的内容
            const lastCompleteObj = cleaned.lastIndexOf('}')
            if (lastCompleteObj > 0) {
              cleaned = cleaned.substring(0, lastCompleteObj + 1)
              // 确保数组正确闭合
              const openBrackets = (cleaned.match(/\[/g) || []).length
              const closeBrackets = (cleaned.match(/]/g) || []).length
              cleaned += ']'.repeat(openBrackets - closeBrackets)
              return JSON.parse(cleaned)
            }
            return null
          },
          // 6. 尝试解析每个可能的 JSON 对象
          () => {
            const objects = text.match(/\{[\s\S]*?\}/g)
            if (objects) {
              return objects.map(o => {
                try { return JSON.parse(o) } catch { return null }
              }).filter(Boolean)
            }
            return null
          },
        ]

        for (const strategy of strategies) {
          try {
            topics = strategy()
            if (topics && (Array.isArray(topics) || topics.length > 0)) {
              log('提取策略成功')
              break
            }
          } catch {}
        }

        if (!topics || (Array.isArray(topics) && topics.length === 0)) {
          log('警告: 无法解析 LLM 响应')
          log(`完整响应: ${text}`)
          return { topics: [], error: `AI 返回格式异常，请重试\n\n返回内容:\n${text.substring(0, 500)}` }
        }
      }

      // 确保每个 topic 有 overallScore
      if (Array.isArray(topics)) {
        topics = topics.map(t => {
          if (!t.overallScore && t.scores) {
            const s = t.scores
            t.overallScore = Math.round(s.heat * 0.3 + (100 - s.competition) * 0.25 + s.feasibility * 0.2 + s.fit * 0.15 + s.urgency * 0.1)
          }
          return t
        })
        // 按综合评分降序排列
        topics.sort((a, b) => (b.overallScore || 0) - (a.overallScore || 0))
        log(`生成 ${topics.length} 个选题，最高分: ${topics[0]?.overallScore || '-'}`)
      }

      progress('选题生成完成')
      return { topics: Array.isArray(topics) ? topics.slice(0, count) : [] }
    } catch (err) {
      log(`执行失败: ${err.message}`)
      console.error('[suggest_topics] 执行失败:', err)
      return { error: err.message, topics: [] }
    }
  },
}
