const { getStaleCompetitors, updateCompetitorCheckTime, saveCompetitorAlert, getDb } = require('../db')
const { runCrawler } = require('./crawler')
let _interval = null

async function checkCompetitors(accountId = 'default') {
  const stale = await getStaleCompetitors(accountId, 24)
  if (!stale.length) return { checked: 0, alerts: 0 }
  let alertsCreated = 0
  for (const comp of stale) {
    try {
      const result = await runCrawler(comp.platform, comp.nickname, { type: 'creator', creatorId: comp.userId, limit: 5 })
      const db = await getDb()
      const existing = db.exec('SELECT content_id FROM crawl_content WHERE source_uid = ? AND platform = ? ORDER BY created_at DESC LIMIT 5', [comp.userId, comp.platform])
      const existingIds = existing.length ? existing[0].values.map(r => String(r[0])) : []
      const newVideos = (result.videos || []).filter(v => !existingIds.includes(String(v.id || v.videoId)))
      if (newVideos.length > 0) {
        await saveCompetitorAlert({ competitorId: comp.id, alertType: 'new_video',
          title: comp.nickname + ' 发布了 ' + newVideos.length + ' 条新内容',
          detail: newVideos.slice(0, 3).map(v => v.title || '未知').join('、') }, accountId)
        alertsCreated++
      }
      await updateCompetitorCheckTime(comp.id)
    } catch (e) { console.error('竞品检查失败: ' + comp.nickname, e.message) }
  }
  return { checked: stale.length, alerts: alertsCreated }
}

function startWatcher(intervalMs = 60 * 60 * 1000) {
  if (_interval) return
  _interval = setInterval(async () => {
    try {
      const { listAccounts } = require('../accounts')
      const accounts = await listAccounts()
      for (const acc of accounts) { await checkCompetitors(acc.id) }
    } catch (e) { console.error('竞品监控出错:', e.message) }
  }, intervalMs)
}
function stopWatcher() { if (_interval) { clearInterval(_interval); _interval = null } }
module.exports = { checkCompetitors, startWatcher, stopWatcher }
