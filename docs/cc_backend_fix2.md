# 给 CC 的提示词：后端代码修复 v2（2 个问题）

项目路径：`C:\Users\20300\Desktop\knower_dev`

---

## 问题 1：crawlVideoComments 调用方式完全错误

**文件**：`knower-agent/lib/crawler.js`

**现状**：`crawlVideoComments` 用 `execFile('python', [scriptPath, 'comments', platform, videoId, ...])` 调用，但 `run_crawler.py` 是 argparse CLI，只接受 `--platform`、`--keywords`、`--crawler-type`、`--get-comment`、`--max-notes`、`--max-comments` 等命名参数，不认识 `comments` 位置参数。直接报错。

**同时**：MediaCrawler 的评论是跟着视频爬取走的（`--get-comment` 标志），不能单独爬评论。正确做法是用 `--crawler-type detail --get-comment --specified-id videoId` 来爬取单个视频的评论。

**替换整个 `crawlVideoComments` 函数**：

```javascript
async function crawlVideoComments(platform, videoId, maxCount = 50) {
  const { execFile } = require('child_process')
  const scriptPath = require('path').join(__dirname, '..', 'crawler', 'run_crawler.py')
  const pythonPath = getPythonPath()
  return new Promise((resolve, reject) => {
    execFile(pythonPath, [
      scriptPath,
      '--platform', platform,
      '--crawler-type', 'detail',
      '--specified-id', videoId,
      '--get-comment',
      '--max-comments', String(maxCount),
    ], {
      cwd: require('path').join(__dirname, '..', 'crawler'),
      timeout: 60000,
      env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
    }, (err, stdout) => {
      if (err) return reject(err)
      try {
        const result = JSON.parse(stdout)
        resolve(result.comments || [])
      } catch { resolve([]) }
    })
  })
}
```

要点：
- 用 `getPythonPath()` 拿 Python 路径（跟 `runCrawler` 一致），不要硬编码 `python`
- 用 `--crawler-type detail --specified-id videoId` 指定单个视频
- 加 `--get-comment` 开启评论爬取
- 返回值从 `result.comments` 数组取（Python 脚本输出的 JSON 格式）

---

## 问题 2：评论字段名不匹配

**文件**：`electron/main.ts` — `comments-crawl` handler

**现状**：`saveComments` 函数期望 camelCase 字段（`videoId`、`authorName`、`likeCount`、`replyCount`），但 MediaCrawler 返回的 B站评论是原始 API 格式：

| MediaCrawler 字段 | saveComments 期望 |
|---|---|
| `rpid` | 不需要 |
| `content.message` | `content` |
| `member.uname` | `authorName` |
| `member.mid` | `authorUid` |
| `like` | `likeCount` |
| `rcount` | `replyCount` |

抖音/小红书/微博的字段名也不同。

**修复**：在 `comments-crawl` handler 中，爬取完后做字段映射。替换 handler 内的映射逻辑：

```typescript
ipcMain.handle('comments-crawl', async (_event, platform: string, videoId: string) => {
  const { crawlVideoComments } = require('../knower-agent/lib/crawler')
  const active = await db.getActiveAccount()
  try {
    const rawComments = await crawlVideoComments(platform, videoId)
    // 映射不同平台的字段名到统一格式
    const comments = rawComments.map((c: any) => {
      if (platform === 'bili') {
        return {
          videoId,
          authorName: c.member?.uname || '',
          authorUid: String(c.member?.mid || ''),
          content: c.content?.message || c.content || '',
          likeCount: c.like || 0,
          replyCount: c.rcount || 0,
        }
      } else if (platform === 'dy') {
        return {
          videoId,
          authorName: c.user?.nickname || '',
          authorUid: String(c.user?.uid || ''),
          content: c.text || '',
          likeCount: c.digg_count || 0,
          replyCount: c.reply_comment_total || 0,
        }
      } else if (platform === 'xhs') {
        return {
          videoId,
          authorName: c.user_info?.nickname || '',
          authorUid: String(c.user_info?.user_id || ''),
          content: c.content || '',
          likeCount: c.like_count || 0,
          replyCount: c.sub_comment_count || 0,
        }
      } else {
        // wb / 通用降级
        return {
          videoId,
          authorName: c.user?.screen_name || c.user?.nickname || '',
          authorUid: String(c.user?.id || ''),
          content: c.text || c.content || '',
          likeCount: c.like_count || c.attitudes_count || 0,
          replyCount: c.reply_count || 0,
        }
      }
    })
    await db.saveComments(comments, active?.id || 'default')
    return { ok: true, count: comments.length }
  } catch (e: any) { return { ok: false, error: e.message } }
})
```

---

## 验证

1. 在 B站爬取一个有评论的视频，确认 `comments-crawl` 返回 `{ ok: true, count: N }`
2. 确认 comments 表中有数据，author_name 和 content 不为空
3. 在抖音/小红书上同样测试，确认字段映射正确