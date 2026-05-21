const fs = require('fs')
const path = require('path')

// 优先读取 Electron 写入的 settings.json
function getElectronSettingsPath() {
  const platform = process.platform
  let appData
  if (platform === 'win32') {
    appData = process.env.APPDATA || path.join(require('os').homedir(), 'AppData', 'Roaming')
  } else if (platform === 'darwin') {
    appData = path.join(require('os').homedir(), 'Library', 'Application Support')
  } else {
    appData = process.env.XDG_CONFIG_HOME || path.join(require('os').homedir(), '.config')
  }
  return path.join(appData, 'knower', 'settings.json')
}

function loadSettings() {
  // 尝试读 Electron 的 settings.json
  const settingsPath = getElectronSettingsPath()
  try {
    if (fs.existsSync(settingsPath)) {
      const raw = JSON.parse(fs.readFileSync(settingsPath, 'utf-8'))
      if (raw.apiKey) {
        return {
          apiKey: raw.apiKey,
          model: raw.model || 'claude-sonnet-4-20250514',
          baseUrl: raw.baseUrl || '',
          provider: raw.apiProvider || 'claude',
        }
      }
    }
  } catch { /* ignore */ }

  // fallback: 读 .env
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') })
  return {
    apiKey: process.env.ANTHROPIC_API_KEY,
    model: process.env.MODEL || 'claude-sonnet-4-20250514',
    baseUrl: '',
    provider: 'claude',
  }
}

module.exports = loadSettings()
