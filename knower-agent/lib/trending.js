/**
 * 全网热点数据源模块
 * 从 newsnow 项目移植，支持 22+ 平台热点数据
 */

const cheerio = require('cheerio')

// ============================================================
//  缓存
// ============================================================

const CACHE_TTL = 10 * 60 * 1000 // 10 分钟
const cache = new Map()

function getCache(key) {
  const entry = cache.get(key)
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data
  cache.delete(key)
  return null
}

function setCache(key, data) {
  cache.set(key, { data, ts: Date.now() })
}

// ============================================================
//  通用 fetch 封装
// ============================================================

const DEFAULT_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'

async function myFetch(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'User-Agent': DEFAULT_UA, ...options.headers },
    signal: AbortSignal.timeout(10000),
    ...options,
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`)
  return res
}

// ============================================================
//  数据源定义
// ============================================================

const SOURCES = {
  bilibili: { name: 'B站', column: 'china', desc: '热搜+热门+排行' },
  douyin: { name: '抖音', column: 'china', desc: '热搜榜' },
  weibo: { name: '微博', column: 'china', desc: '实时热搜' },
  baidu: { name: '百度热搜', column: 'china', desc: '实时热点' },
  zhihu: { name: '知乎', column: 'china', desc: '热榜' },
  toutiao: { name: '今日头条', column: 'china', desc: '热榜' },
  kuaishou: { name: '快手', column: 'china', desc: '热榜' },
  tieba: { name: '百度贴吧', column: 'china', desc: '热议话题' },
  hupu: { name: '虎扑', column: 'china', desc: '每日热帖' },
  douban: { name: '豆瓣', column: 'china', desc: '热门电影' },
  smzdm: { name: '什么值得买', column: 'china', desc: '热门文章' },
  nowcoder: { name: '牛客', column: 'china', desc: '热榜' },
  ithome: { name: 'IT之家', column: 'tech', desc: '最新资讯' },
  '36kr': { name: '36氪', column: 'tech', desc: '快讯+热榜' },
  juejin: { name: '稀土掘金', column: 'tech', desc: '热门文章' },
  sspai: { name: '少数派', column: 'tech', desc: '热门文章' },
  v2ex: { name: 'V2EX', column: 'tech', desc: '最新主题' },
  coolapk: { name: '酷安', column: 'tech', desc: '今日热门' },
  github: { name: 'GitHub', column: 'tech', desc: 'Trending' },
  hackernews: { name: 'Hacker News', column: 'tech', desc: 'Top Stories' },
  producthunt: { name: 'Product Hunt', column: 'tech', desc: '热门产品' },
  steam: { name: 'Steam', column: 'world', desc: '在线人数排行' },
}

const DEFAULT_ENABLED = ['bilibili', 'douyin', 'weibo']

// ============================================================
//  各数据源实现（参照 newsnow 原始源码）
// ============================================================

async function fetchBilibili() {
  const results = []

  // 1. 热搜
  try {
    const res = await myFetch('https://s.search.bilibili.com/main/hotword?limit=30')
    const data = await res.json()
    for (const k of (data.list || [])) {
      results.push({
        id: k.keyword,
        title: k.show_name,
        url: `https://search.bilibili.com/all?keyword=${encodeURIComponent(k.keyword)}`,
        platform: 'bilibili',
        extra: { hotValue: k.icon ? '热搜' : '' },
      })
    }
  } catch {}

  // 2. 热门视频
  try {
    const res = await myFetch('https://api.bilibili.com/x/web-interface/popular')
    const data = await res.json()
    for (const video of (data.data?.list || [])) {
      const views = video.stat?.view || 0
      const likes = video.stat?.like || 0
      const viewStr = views >= 10000 ? `${Math.floor(views / 10000)}w+` : String(views)
      results.push({
        id: video.bvid,
        title: video.title,
        url: `https://www.bilibili.com/video/${video.bvid}`,
        platform: 'bilibili',
        extra: {
          author: video.owner?.name || '',
          view: views,
          like: likes,
          desc: video.desc || '',
          pubDate: (video.pubdate || 0) * 1000,
          info: `${video.owner?.name || ''} · ${viewStr}观看 · ${likes}点赞`,
        },
      })
    }
  } catch {}

  // 3. 排行榜
  try {
    const res = await myFetch('https://api.bilibili.com/x/web-interface/ranking/v2')
    const data = await res.json()
    for (const video of (data.data?.list || []).slice(0, 20)) {
      const views = video.stat?.view || 0
      const likes = video.stat?.like || 0
      const viewStr = views >= 10000 ? `${Math.floor(views / 10000)}w+` : String(views)
      results.push({
        id: `rank-${video.bvid}`,
        title: video.title,
        url: `https://www.bilibili.com/video/${video.bvid}`,
        platform: 'bilibili',
        extra: {
          author: video.owner?.name || '',
          view: views,
          like: likes,
          desc: video.desc || '',
          pubDate: (video.pubdate || 0) * 1000,
          info: `${video.owner?.name || ''} · ${viewStr}观看 · ${likes}点赞`,
        },
      })
    }
  } catch {}

  return results
}

async function fetchDouyin() {
  try {
    // 先获取 cookie
    const loginRes = await myFetch('https://login.douyin.com/', { redirect: 'manual' })
    const setCookies = loginRes.headers.getSetCookie?.() || []
    const cookie = setCookies.join('; ')

    const res = await myFetch(
      'https://www.douyin.com/aweme/v1/web/hot/search/list/?device_platform=webapp&aid=6383&channel=channel_pc_web&detail_list=1',
      { headers: { cookie } }
    )
    const data = await res.json()
    return (data.data?.word_list || []).map(k => ({
      id: k.sentence_id,
      title: k.word,
      url: `https://www.douyin.com/hot/${k.sentence_id}`,
      platform: 'douyin',
      extra: { hotValue: k.hot_value ? String(k.hot_value) : '' },
    }))
  } catch {
    return []
  }
}

async function fetchWeibo() {
  try {
    const res = await myFetch('https://s.weibo.com/top/summary?cate=realtimehot', {
      headers: {
        'User-Agent': DEFAULT_UA,
        'Cookie': 'SUB=_2AkMWIuNSf8NxqwJRmP8dy2rhaoV2ygrEieKgfhKJJRMxHRl-yT9jqk86tRB6PaLNvQZR6zYUcYVT1zSjoSreQHidcUq7',
        'Referer': 'https://s.weibo.com/top/summary?cate=realtimehot',
      },
    })
    const html = await res.text()
    const $ = cheerio.load(html)
    const rows = $('#pl_top_realtimehot table tbody tr').slice(1)
    const results = []
    rows.each((_i, el) => {
      const $row = $(el)
      const $link = $row.find('td.td-02 a').filter((_j, a) => {
        const href = $(a).attr('href')
        return !!(href && !href.includes('javascript:void(0);'))
      }).first()
      const title = $link.text().trim()
      const href = $link.attr('href')
      if (!title || !href) return
      const flag = $row.find('td.td-03').text().trim()
      const flagMap = { '新': 'new', '热': 'hot', '爆': 'boom' }
      results.push({
        id: title,
        title,
        url: `https://s.weibo.com${href}`,
        platform: 'weibo',
        extra: { flag: flagMap[flag] || '', hotValue: flag || '' },
      })
    })
    return results
  } catch {
    return []
  }
}

async function fetchBaidu() {
  try {
    const res = await myFetch('https://top.baidu.com/board?tab=realtime')
    const html = await res.text()
    const match = html.match(/<!--s-data:(.*?)-->/s)
    if (!match) return []
    const data = JSON.parse(match[1])
    return (data.data?.cards?.[0]?.content || [])
      .filter(k => !k.isTop)
      .map(k => ({
        id: k.rawUrl || k.word,
        title: k.word,
        url: k.rawUrl,
        platform: 'baidu',
        extra: { desc: k.desc || '', hotValue: k.hotScore ? String(k.hotScore) : '' },
      }))
  } catch {
    return []
  }
}

async function fetchZhihu() {
  try {
    const res = await myFetch('https://www.zhihu.com/api/v3/feed/topstory/hot-list-web?limit=20&desktop=true')
    const data = await res.json()
    return (data.data || []).map(k => {
      const idMatch = k.target?.link?.url?.match(/(\d+)$/)
      return {
        id: idMatch?.[1] || k.target?.link?.url || '',
        title: k.target?.title_area?.text || '',
        url: k.target?.link?.url || '',
        platform: 'zhihu',
        extra: {
          info: k.target?.metrics_area?.text || '',
          desc: k.target?.excerpt_area?.text || '',
        },
      }
    })
  } catch {
    return []
  }
}

async function fetchToutiao() {
  try {
    const res = await myFetch('https://www.toutiao.com/hot-event/hot-board/?origin=toutiao_pc')
    const data = await res.json()
    return (data.data || []).map(k => ({
      id: k.ClusterIdStr,
      title: k.Title,
      url: `https://www.toutiao.com/trending/${k.ClusterIdStr}/`,
      platform: 'toutiao',
      extra: { hotValue: k.HotValue ? String(k.HotValue) : '' },
    }))
  } catch {
    return []
  }
}

async function fetchKuaishou() {
  try {
    const res = await myFetch('https://www.kuaishou.com/?isHome=1')
    const html = await res.text()
    const match = html.match(/window\.__APOLLO_STATE__\s*=\s*(\{.+?\});/)
    if (!match) return []
    const apollo = JSON.parse(match[1])
    const rootQuery = apollo.defaultClient?.ROOT_QUERY
    const hotRankKey = Object.keys(rootQuery || {}).find(k => k.startsWith('visionHotRank'))
    if (!hotRankKey) return []
    const hotRankId = rootQuery[hotRankKey].id
    const hotRankData = apollo.defaultClient?.[hotRankId]
    if (!hotRankData?.items) return []
    return hotRankData.items
      .filter(item => {
        const node = apollo.defaultClient?.[item.id]
        return node && node.tagType !== '置顶'
      })
      .map(item => {
        const node = apollo.defaultClient?.[item.id] || {}
        const name = node.name || ''
        return {
          id: item.id?.replace('VisionHotRankItem:', '') || name,
          title: name,
          url: `https://www.kuaishou.com/search/video?searchKey=${encodeURIComponent(name)}`,
          platform: 'kuaishou',
        }
      })
  } catch {
    return []
  }
}

async function fetchTieba() {
  try {
    const res = await myFetch('https://tieba.baidu.com/hottopic/browse/topicList')
    const data = await res.json()
    return (data.data?.bang_topic?.topic_list || []).map(k => ({
      id: k.topic_id,
      title: k.topic_name,
      url: k.topic_url,
      platform: 'tieba',
    }))
  } catch {
    return []
  }
}

async function fetchHupu() {
  try {
    const res = await myFetch('https://bbs.hupu.com/topic-daily-hot')
    const html = await res.text()
    const regex = /<li class="bbs-sl-web-post-body">[\s\S]*?<a href="(\/[^"]+?\.html)"[^>]*?class="p-title"[^>]*>([^<]+)<\/a>/g
    const results = []
    let m
    while ((m = regex.exec(html)) !== null) {
      const [, path, title] = m
      if (path && title) {
        results.push({
          id: path,
          title: title.trim(),
          url: `https://bbs.hupu.com${path}`,
          platform: 'hupu',
        })
      }
    }
    return results
  } catch {
    return []
  }
}

async function fetchDouban() {
  try {
    const res = await myFetch('https://m.douban.com/rexxar/api/v2/subject/recent_hot/movie', {
      headers: {
        'Referer': 'https://movie.douban.com/',
        'Accept': 'application/json, text/plain, */*',
      },
    })
    const data = await res.json()
    return (data.items || []).map(m => ({
      id: m.id,
      title: m.title,
      url: `https://movie.douban.com/subject/${m.id}`,
      platform: 'douban',
      extra: {
        info: m.card_subtitle?.split(' / ').slice(0, 3).join(' / ') || '',
        desc: m.card_subtitle || '',
      },
    }))
  } catch {
    return []
  }
}

async function fetchSmzdm() {
  try {
    const res = await myFetch('https://post.smzdm.com/hot_1/')
    const html = await res.text()
    const $ = cheerio.load(html)
    const results = []
    $('#feed-main-list .z-feed-title').each((_i, el) => {
      const a = $(el).find('a').first()
      const title = a.text().trim()
      const url = a.attr('href')
      if (title && url) {
        results.push({ id: url, title, url, platform: 'smzdm' })
      }
    })
    return results
  } catch {
    return []
  }
}

async function fetchNowcoder() {
  try {
    const ts = Date.now()
    const res = await myFetch(`https://gw-c.nowcoder.com/api/sparta/hot-search/top-hot-pc?size=20&_=${ts}&t=`)
    const data = await res.json()
    return (data.data?.result || []).map(k => {
      let url, id
      if (k.type === 74) {
        url = `https://www.nowcoder.com/feed/main/detail/${k.uuid}`
        id = k.uuid
      } else if (k.type === 0) {
        url = `https://www.nowcoder.com/discuss/${k.id}`
        id = k.id
      } else {
        url = `https://www.nowcoder.com`
        id = k.id
      }
      return { id, title: k.title, url, platform: 'nowcoder' }
    })
  } catch {
    return []
  }
}

async function fetchIthome() {
  try {
    const res = await myFetch('https://www.ithome.com/list/')
    const html = await res.text()
    const $ = cheerio.load(html)
    const results = []
    const adKeywords = ['神券', '优惠', '补贴', '京东']
    $('#list > div.fl > ul > li').each((_i, el) => {
      const $el = $(el)
      const url = $el.find('a.t').attr('href') || ''
      const title = $el.find('a.t').text().trim()
      if (url.includes('lapin') || adKeywords.some(kw => title.includes(kw))) return
      if (url && title) {
        results.push({ id: url, title, url, platform: 'ithome' })
      }
    })
    return results
  } catch {
    return []
  }
}

async function fetch36kr() {
  try {
    const res = await myFetch('https://www.36kr.com/newsflashes')
    const html = await res.text()
    const $ = cheerio.load(html)
    const results = []
    $('.newsflash-item').each((_i, el) => {
      const $el = $(el)
      const href = $el.find('a.item-title').attr('href') || ''
      const title = $el.find('a.item-title').text().trim()
      if (href && title) {
        results.push({
          id: href,
          title,
          url: href.startsWith('http') ? href : `https://www.36kr.com${href}`,
          platform: '36kr',
        })
      }
    })
    return results
  } catch {
    return []
  }
}

async function fetchJuejin() {
  try {
    const res = await myFetch('https://api.juejin.cn/content_api/v1/content/article_rank?category_id=1&type=hot&spider=0')
    const data = await res.json()
    return (data.data || []).map(k => ({
      id: k.content?.content_id,
      title: k.content?.title,
      url: `https://juejin.cn/post/${k.content?.content_id}`,
      platform: 'juejin',
    }))
  } catch {
    return []
  }
}

async function fetchSspai() {
  try {
    const ts = Date.now()
    const res = await myFetch(`https://sspai.com/api/v1/article/tag/page/get?limit=30&offset=0&created_at=${ts}&tag=%E7%83%AD%E9%97%A8%E6%96%87%E7%AB%A0&released=false`)
    const data = await res.json()
    return (data.data || []).map(k => ({
      id: k.id,
      title: k.title,
      url: `https://sspai.com/post/${k.id}`,
      platform: 'sspai',
    }))
  } catch {
    return []
  }
}

async function fetchV2ex() {
  try {
    const feeds = ['create', 'ideas', 'programmer', 'share']
    const results = await Promise.all(feeds.map(async feed => {
      try {
        const res = await myFetch(`https://www.v2ex.com/feed/${feed}.json`)
        const data = await res.json()
        return (data.items || []).map(k => ({
          id: k.id,
          title: k.title,
          url: k.url,
          platform: 'v2ex',
          extra: { date: k.date_modified || k.date_published },
        }))
      } catch { return [] }
    }))
    return results.flat().sort((a, b) => (a.extra?.date || '') < (b.extra?.date || '') ? 1 : -1)
  } catch {
    return []
  }
}

async function fetchCoolapk() {
  try {
    // 简化 token 生成（不需要 md5，直接构造一个基本 token）
    const deviceId = Array.from({ length: 5 }, (_, i) => {
      const len = [10, 6, 6, 6, 14][i]
      return Math.random().toString(36).substring(2, 2 + len)
    }).join('-')
    const now = Math.round(Date.now() / 1000)
    const hexNow = `0x${now.toString(16)}`
    // 简化的 token（不依赖 md5）
    const token = `${deviceId}${hexNow}`

    const url = 'https://api.coolapk.com/v6/page/dataList?url=%2Ffeed%2FstatList%3FcacheExpires%3D300%26statType%3Dday%26sortField%3Ddetailnum%26title%3D%E4%BB%8A%E6%97%A5%E7%83%AD%E9%97%A8&title=%E4%BB%8A%E6%97%A5%E7%83%AD%E9%97%A8&subTitle=&page=1'
    const res = await myFetch(url, {
      headers: {
        'X-Requested-With': 'XMLHttpRequest',
        'X-App-Id': 'com.coolapk.market',
        'X-App-Token': token,
        'X-Sdk-Int': '29',
        'X-Sdk-Locale': 'zh-CN',
        'X-App-Version': '11.0',
        'X-Api-Version': '11',
        'X-App-Code': '2101202',
        'User-Agent': 'Dalvik/2.1.0 (Linux; U; Android 10; Redmi K30 5G MIUI/V12.0.3.0.QGICMXM) +CoolMarket/11.0-2101202',
      },
    })
    const data = await res.json()
    if (!data.data?.length) return []
    return data.data.filter(k => k.id).map(i => {
      const $ = cheerio.load(i.message || '')
      const title = i.editor_title || $.text().split('\n')[0].trim()
      return {
        id: i.id,
        title,
        url: `https://www.coolapk.com${i.url}`,
        platform: 'coolapk',
        extra: { info: i.targetRow?.subTitle || '' },
      }
    })
  } catch {
    return []
  }
}

async function fetchGithub() {
  try {
    const res = await myFetch('https://github.com/trending?spoken_language_code=')
    const html = await res.text()
    const $ = cheerio.load(html)
    const results = []
    $('main .Box div[data-hpc] > article').each((_i, el) => {
      const $el = $(el)
      const a = $el.find('> h2 a')
      const title = a.text().replace(/\n+/g, '').trim()
      const href = a.attr('href') || ''
      const star = $el.find('[href$=stargazers]').text().replace(/\s+/g, ' ').trim()
      const desc = $el.find('> p').text().replace(/\n+/g, '').trim()
      if (title && href) {
        results.push({
          id: href,
          title,
          url: `https://github.com${href}`,
          platform: 'github',
          extra: { info: star ? `✰ ${star}` : '', desc },
        })
      }
    })
    return results
  } catch {
    return []
  }
}

async function fetchHackernews() {
  try {
    const res = await myFetch('https://news.ycombinator.com')
    const html = await res.text()
    const $ = cheerio.load(html)
    const results = []
    $('.athing').each((_i, el) => {
      const $el = $(el)
      const id = $el.attr('id') || ''
      const title = $el.find('.titleline a').first().text().trim()
      const score = $(`#score_${id}`).text().trim()
      if (title && id) {
        results.push({
          id,
          title,
          url: `https://news.ycombinator.com/item?id=${id}`,
          platform: 'hackernews',
          extra: { info: score || '' },
        })
      }
    })
    return results
  } catch {
    return []
  }
}

async function fetchProducthunt() {
  const token = process.env.PRODUCTHUNT_API_TOKEN
  if (!token) return []
  try {
    const res = await myFetch('https://api.producthunt.com/v2/api/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        query: 'query { posts(first: 30, order: VOTES) { edges { node { id name tagline votesCount url slug } } } }',
      }),
    })
    const data = await res.json()
    const posts = data?.data?.posts?.edges || []
    return posts.map(edge => {
      const p = edge.node
      return {
        id: p.id,
        title: p.name,
        url: p.url || `https://www.producthunt.com/posts/${p.slug}`,
        platform: 'producthunt',
        extra: { info: `△ ${p.votesCount || 0}`, desc: p.tagline || '' },
      }
    })
  } catch {
    return []
  }
}

async function fetchSteam() {
  try {
    const res = await myFetch('https://store.steampowered.com/stats/stats/')
    const html = await res.text()
    const $ = cheerio.load(html)
    const results = []
    $('#detailStats tr.player_count_row').each((_i, el) => {
      const $el = $(el)
      const url = $el.find('a.gameLink').attr('href') || ''
      const title = $el.find('a.gameLink').text().trim()
      const players = $el.find('td:first-child .currentServers').text().trim()
      if (url && title) {
        results.push({
          id: url,
          title,
          url,
          platform: 'steam',
          extra: { info: players ? `${players} 在线` : '' },
        })
      }
    })
    return results
  } catch {
    return []
  }
}

// ============================================================
//  数据源 fetch 函数映射
// ============================================================

const FETCHERS = {
  bilibili: fetchBilibili,
  douyin: fetchDouyin,
  weibo: fetchWeibo,
  baidu: fetchBaidu,
  zhihu: fetchZhihu,
  toutiao: fetchToutiao,
  kuaishou: fetchKuaishou,
  tieba: fetchTieba,
  hupu: fetchHupu,
  douban: fetchDouban,
  smzdm: fetchSmzdm,
  nowcoder: fetchNowcoder,
  ithome: fetchIthome,
  '36kr': fetch36kr,
  juejin: fetchJuejin,
  sspai: fetchSspai,
  v2ex: fetchV2ex,
  coolapk: fetchCoolapk,
  github: fetchGithub,
  hackernews: fetchHackernews,
  producthunt: fetchProducthunt,
  steam: fetchSteam,
}

// ============================================================
//  公开接口
// ============================================================

async function fetchSource(sourceId) {
  const cached = getCache(sourceId)
  if (cached) return cached

  const fetcher = FETCHERS[sourceId]
  if (!fetcher) throw new Error(`Unknown source: ${sourceId}`)

  const data = await fetcher()
  setCache(sourceId, data)
  return data
}

async function fetchTrending(platforms) {
  const results = {}
  await Promise.allSettled(
    platforms.map(async (id) => {
      try {
        results[id] = await fetchSource(id)
      } catch (err) {
        console.error(`[trending] ${id} 失败: ${err.message}`)
        results[id] = []
      }
    })
  )
  return results
}

module.exports = { SOURCES, DEFAULT_ENABLED, fetchSource, fetchTrending }
