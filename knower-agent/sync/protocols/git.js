const { execFile } = require('child_process')
const path = require('path')
const fs = require('fs')
const { promisify } = require('util')
const execFileAsync = promisify(execFile)

const GIT_TIMEOUT = 30000

async function git(args, cwd) {
  try {
    const { stdout, stderr } = await execFileAsync('git', args, { cwd, timeout: GIT_TIMEOUT, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } })
    return { ok: true, stdout: stdout.trim(), stderr: stderr.trim() }
  } catch (err) {
    return { ok: false, stdout: '', stderr: err.stderr || err.message }
  }
}

async function testConnection(config) {
  const { repoUrl } = config
  if (!repoUrl) return { ok: false, message: '请输入仓库地址' }

  // Check if git is available
  const versionCheck = await git(['--version'])
  if (!versionCheck.ok) return { ok: false, message: '未检测到 Git，请先安装 Git' }

  // Try to access the remote
  const result = await git(['ls-remote', '--exit-code', repoUrl])
  if (result.ok) return { ok: true, message: '连接成功' }
  return { ok: false, message: `无法访问仓库: ${result.stderr.slice(0, 200)}` }
}

async function push(localDir, config) {
  const { repoUrl, branch = 'main' } = config

  // Init if not a git repo
  if (!fs.existsSync(path.join(localDir, '.git'))) {
    await git(['init'], localDir)
    await git(['checkout', '-b', branch], localDir)
  }

  // Set remote
  const remoteCheck = await git(['remote', 'get-url', 'origin'], localDir)
  if (remoteCheck.ok) {
    await git(['remote', 'set-url', 'origin', repoUrl], localDir)
  } else {
    await git(['remote', 'add', 'origin', repoUrl], localDir)
  }

  // Stage and commit
  await git(['add', '.'], localDir)
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const commitResult = await git(['commit', '-m', `knower-sync ${timestamp}`, '--allow-empty'], localDir)
  if (!commitResult.ok && !commitResult.stderr.includes('nothing to commit')) {
    throw new Error(`Git commit failed: ${commitResult.stderr}`)
  }

  // Push
  const pushResult = await git(['push', 'origin', branch, '--force'], localDir)
  if (!pushResult.ok) throw new Error(`Git push failed: ${pushResult.stderr}`)

  // Count files changed
  const files = fs.readdirSync(localDir).filter((f) => f !== '.git')

  return { success: true, filesChanged: files.length, bytesTransferred: 0 }
}

async function pull(remoteDir, config) {
  const { repoUrl, branch = 'main' } = config

  // Clone into remoteDir
  if (!fs.existsSync(path.join(remoteDir, '.git'))) {
    const cloneResult = await git(['clone', '--branch', branch, repoUrl, remoteDir])
    if (!cloneResult.ok) throw new Error(`Git clone failed: ${cloneResult.stderr}`)
  } else {
    const pullResult = await git(['pull', 'origin', branch, '--rebase'], remoteDir)
    if (!pullResult.ok) throw new Error(`Git pull failed: ${pullResult.stderr}`)
  }

  // Count files
  const files = fs.readdirSync(remoteDir).filter((f) => f !== '.git')

  return { success: true, filesChanged: files.length }
}

module.exports = { testConnection, push, pull }
