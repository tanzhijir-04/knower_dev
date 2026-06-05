/**
 * Python crawler subprocess wrapper for knower_dev.
 * Calls run_crawler.py and returns parsed JSON results.
 */

const { spawn } = require('child_process')
const path = require('path')

const CRAWLER_DIR = path.join(__dirname, '..', 'crawler')

/**
 * Get Python executable path from venv
 */
function getPythonPath() {
  const isWin = process.platform === 'win32'
  const pythonPath = isWin
    ? path.join(CRAWLER_DIR, '.venv', 'Scripts', 'python.exe')
    : path.join(CRAWLER_DIR, '.venv', 'bin', 'python')
  return pythonPath
}

/**
 * Run crawler and return results as JSON
 * @param {string} platform - bili, dy, xhs, wb
 * @param {string} keywords - Search keywords
 * @param {object} options - Additional options
 * @param {function} onProgress - Progress callback (message: string) => void
 * @returns {Promise<object>} Crawler results
 */
function runCrawler(platform, keywords, options = {}, onProgress) {
  return new Promise((resolve, reject) => {
    const pythonPath = getPythonPath()
    const scriptPath = path.join(CRAWLER_DIR, 'run_crawler.py')

    const args = [
      scriptPath,
      '--platform', platform,
      '--keywords', keywords || '',
      '--crawler-type', options.crawlerType || 'search',
      '--max-notes', String(options.maxNotes || 15),
      '--max-comments', String(options.maxComments || 10),
    ]

    if (options.headless === false) {
      args.push('--no-headless')
    }

    if (options.specifiedId) {
      args.push('--specified-id', options.specifiedId)
    }

    if (options.creatorId) {
      args.push('--creator-id', options.creatorId)
    }

    if (options.getComment) {
      args.push('--get-comment')
    }

    const proc = spawn(pythonPath, args, {
      cwd: CRAWLER_DIR,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: {
        ...process.env,
        PYTHONIOENCODING: 'utf-8',
      },
    })

    let stdout = ''
    let stderr = ''

    proc.stdout.on('data', (chunk) => {
      const text = chunk.toString('utf-8')
      stdout += text
      const lines = text.split('\n').filter(l => l.trim())
      for (const line of lines) {
        if (onProgress && line.trim()) {
          onProgress(line.trim())
        }
      }
    })

    proc.stderr.on('data', (chunk) => {
      const text = chunk.toString('utf-8').trim()
      stderr += text
      if (onProgress && text) {
        // loguru 格式: "2024-01-01 12:00:00 | INFO | module:func:line - message"
        const loguruMatch = text.match(/\|\s*\w+\s*\|.*\|\s*(.*)/)
        if (loguruMatch) {
          onProgress(loguruMatch[1].trim())
        } else if (!text.startsWith('Traceback') && !text.startsWith('File "') && !text.match(/^\s+at\s/)) {
          onProgress(text)
        }
      }
    })

    proc.on('close', (code) => {
      try {
        // Extract JSON object from stdout (may contain non-JSON progress lines)
        let jsonStr = stdout.trim()
        const jsonStart = jsonStr.indexOf('{')
        if (jsonStart > 0) {
          jsonStr = jsonStr.slice(jsonStart)
        }
        const result = JSON.parse(jsonStr)
        // If we got valid JSON with contents, the crawl succeeded even if exit code != 0
        // (Python may throw cleanup errors after data is collected)
        if (result.contents && result.contents.length > 0) {
          resolve(result)
          return
        }
        if (code !== 0) {
          reject(new Error(`Crawler failed (code ${code}): ${stderr}`))
          return
        }
        resolve(result)
      } catch (e) {
        if (code !== 0) {
          reject(new Error(`Crawler failed (code ${code}): ${stderr}`))
        } else {
          reject(new Error(`Failed to parse crawler output: ${e.message}\nstdout: ${stdout.slice(0, 500)}`))
        }
      }
    })

    proc.on('error', (err) => {
      reject(new Error(`Failed to start crawler: ${err.message}`))
    })
  })
}

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

module.exports = { runCrawler, crawlVideoComments }
