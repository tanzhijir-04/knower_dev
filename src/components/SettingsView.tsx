import { useState, useEffect, useCallback } from 'react'
import { usePlatform } from '../contexts/PlatformContext'
import { useAccount } from '../contexts/AccountContext'
import { Eye, EyeSlash, Check, ArrowClockwise, Trash, Export, Link, Spinner, Download, Plus, PencilSimple, CaretDown, CaretUp } from '@phosphor-icons/react'

interface Settings {
  apiProvider: string
  apiKey: string
  baseUrl: string
  model: string
  temperature: number
  maxTokens: number
  defaultPlatforms: string[]
  contentStyle: string
  scriptDuration: string
  defaultLanguage: string
  defaultCrawlCount: number
}

const PROVIDERS = [
  { id: 'claude', name: 'Claude (Anthropic)', baseUrl: 'https://api.anthropic.com' },
  { id: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com' },
  { id: 'deepseek', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com' },
  { id: 'qwen', name: '通义千问 (Qwen)', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode' },
  { id: 'custom', name: '自定义', baseUrl: '' },
]

const PLATFORMS = [
  { key: 'bili', label: 'B站' },
  { key: 'douyin', label: '抖音' },
  { key: 'xiaohongshu', label: '小红书' },
  { key: 'weibo', label: '微博' },
]

const CONTENT_STYLES = ['专业严谨', '轻松活泼', '故事化', '知识科普', '情感共鸣']
const SCRIPT_DURATIONS = ['30秒以内', '1-3分钟', '3-5分钟', '5-10分钟', '10分钟以上']
const LANGUAGES = ['简体中文', 'English']
const LOGIN_PLATFORMS = ['bili', 'dy', 'xhs', 'wb']
const LOGIN_LABELS = ['B站', '抖音', '小红书', '微博']

const inputCls = 'w-full bg-surface border border-hairline rounded-lg px-3 py-2.5 text-sm text-ink outline-none focus:border-primary/50 transition-colors'

const PLATFORM_LABELS: Record<string, string> = {
  bili: 'B站',
  dy: '抖音',
  xhs: '小红书',
  wb: '微博',
}

const PLATFORM_COLORS: Record<string, string> = {
  bili: 'bg-[#00a1d6]',
  dy: 'bg-[#fe2c55]',
  xhs: 'bg-[#ff2442]',
  wb: 'bg-[#ff8200]',
}

function CreatorManagement() {
  const { accounts, activeAccount, createAccount, updateAccount, deleteAccount, switchAccount } = useAccount()
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    platform: 'bili',
    uid: '',
    description: '',
  })

  const resetForm = () => {
    setFormData({ name: '', platform: 'bili', uid: '', description: '' })
    setShowForm(false)
    setEditingId(null)
  }

  const handleSubmit = async () => {
    if (!formData.name.trim()) return

    if (editingId) {
      await updateAccount(editingId, formData)
    } else {
      const id = await createAccount(formData)
      // If this is the first account, it's auto-activated
    }

    resetForm()
  }

  const handleEdit = (account: typeof accounts[0]) => {
    setFormData({
      name: account.name,
      platform: account.platform,
      uid: account.uid || '',
      description: account.description || '',
    })
    setEditingId(account.id)
    setShowForm(true)
  }

  const handleDelete = async (id: string) => {
    if (!confirm('确定删除此创作者？相关数据将一并删除，此操作不可恢复。')) return
    await deleteAccount(id)
  }

  return (
    <div className="space-y-4">
      {/* Add button */}
      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 border border-dashed border-hairline rounded-lg text-xs text-muted hover:text-ink hover:border-hairline-strong transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          添加创作者
        </button>
      )}

      {/* Add/Edit form */}
      {showForm && (
        <div className="border border-hairline rounded-lg p-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-ink">
              {editingId ? '编辑创作者' : '添加创作者'}
            </span>
            <button
              onClick={resetForm}
              className="text-xs text-muted hover:text-ink transition-colors"
            >
              取消
            </button>
          </div>

          <div>
            <label className="block text-[11px] text-muted mb-1">名称</label>
            <input
              value={formData.name}
              onChange={e => setFormData(f => ({ ...f, name: e.target.value }))}
              placeholder="如：科技老王"
              className={inputCls}
            />
          </div>

          <div>
            <label className="block text-[11px] text-muted mb-1">平台</label>
            <select
              value={formData.platform}
              onChange={e => setFormData(f => ({ ...f, platform: e.target.value }))}
              className={inputCls + ' appearance-none cursor-pointer'}
            >
              {Object.entries(PLATFORM_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] text-muted mb-1">
              UID <span className="text-muted-soft">(可选)</span>
            </label>
            <input
              value={formData.uid}
              onChange={e => setFormData(f => ({ ...f, uid: e.target.value }))}
              placeholder="平台用户ID"
              className={inputCls}
            />
          </div>

          <div>
            <label className="block text-[11px] text-muted mb-1">
              备注 <span className="text-muted-soft">(可选)</span>
            </label>
            <input
              value={formData.description}
              onChange={e => setFormData(f => ({ ...f, description: e.target.value }))}
              placeholder="创作者备注信息"
              className={inputCls}
            />
          </div>

          <button
            onClick={handleSubmit}
            disabled={!formData.name.trim()}
            className="btn-primary w-full text-xs disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {editingId ? '保存修改' : '添加创作者'}
          </button>
        </div>
      )}

      {/* Account list */}
      {accounts.length === 0 && !showForm && (
        <p className="text-[11px] text-muted text-center py-4">
          暂无创作者账号，点击上方按钮添加
        </p>
      )}

      {accounts.map(account => (
        <div
          key={account.id}
          className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
            account.isActive ? 'bg-primary/10 border border-primary/20' : 'hover:bg-canvas'
          }`}
        >
          <span className={`w-2.5 h-2.5 rounded-full ${PLATFORM_COLORS[account.platform] || 'bg-muted'}`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs text-ink truncate">{account.name}</span>
              {account.isActive && (
                <span className="text-[10px] text-primary bg-primary/10 px-1.5 py-0.5 rounded">当前</span>
              )}
            </div>
            <span className="text-[11px] text-muted">{PLATFORM_LABELS[account.platform] || account.platform}</span>
          </div>
          <div className="flex items-center gap-1">
            {!account.isActive && (
              <button
                onClick={() => switchAccount(account.id)}
                className="text-[11px] text-muted hover:text-primary transition-colors px-1.5 py-0.5"
              >
                切换
              </button>
            )}
            <button
              onClick={() => handleEdit(account)}
              className="p-1 text-muted hover:text-ink transition-colors"
              title="编辑"
            >
              <PencilSimple className="w-3 h-3" />
            </button>
            <button
              onClick={() => handleDelete(account.id)}
              className="p-1 text-muted hover:text-semantic-error transition-colors"
              title="删除"
            >
              <Trash className="w-3 h-3" />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}

export default function SettingsView() {
  const [settings, setSettings] = useState<Settings>({
    apiProvider: 'claude',
    apiKey: '',
    baseUrl: '',
    model: 'claude-sonnet-4-20250514',
    temperature: 0.7,
    maxTokens: 4096,
    defaultPlatforms: ['bili'],
    contentStyle: '专业严谨',
    scriptDuration: '1-3分钟',
    defaultLanguage: '简体中文',
    defaultCrawlCount: 20,
  })

  const [showApiKey, setShowApiKey] = useState(false)
  const [saved, setSaved] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null)
  const [dataCount, setDataCount] = useState<number | null>(null)
  const [loadingCount, setLoadingCount] = useState(false)
  const [loginStates, setLoginStates] = useState<Record<string, boolean>>({})
  const { isWindows } = usePlatform()

  // Load settings from store
  useEffect(() => {
    window.electronAPI?.getStoreAll().then((all) => {
      if (all && Object.keys(all).length > 0) {
        setSettings(s => ({
          ...s,
          apiProvider: (all.apiProvider as string) || s.apiProvider,
          apiKey: (all.apiKey as string) || s.apiKey,
          baseUrl: (all.baseUrl as string) || s.baseUrl,
          model: (all.model as string) || s.model,
          temperature: typeof all.temperature === 'number' ? all.temperature : s.temperature,
          maxTokens: typeof all.maxTokens === 'number' ? all.maxTokens : s.maxTokens,
          defaultPlatforms: Array.isArray(all.defaultPlatforms) ? all.defaultPlatforms as string[] : s.defaultPlatforms,
          contentStyle: (all.contentStyle as string) || s.contentStyle,
          scriptDuration: (all.scriptDuration as string) || s.scriptDuration,
          defaultLanguage: (all.defaultLanguage as string) || s.defaultLanguage,
          defaultCrawlCount: typeof all.defaultCrawlCount === 'number' ? all.defaultCrawlCount : s.defaultCrawlCount,
        }))
      }
    })
  }, [])

  // Load login states from actual browser profile directories
  const loadLoginStates = useCallback(async () => {
    try {
      const states = await window.electronAPI?.checkLoginStates()
      if (states) setLoginStates(states)
    } catch {
      // Fallback: mark all as unknown
      setLoginStates({})
    }
  }, [])

  useEffect(() => { loadLoginStates() }, [loadLoginStates])

  // Load data count
  const loadDataCount = useCallback(async () => {
    setLoadingCount(true)
    try {
      const all = await window.electronAPI?.getAllCrawlContent()
      setDataCount(all?.length ?? 0)
    } catch { setDataCount(0) }
    setLoadingCount(false)
  }, [])

  useEffect(() => { loadDataCount() }, [loadDataCount])

  // Connection test — routed through main process to avoid CORS
  const handleTestConnection = async () => {
    setTesting(true)
    setTestResult(null)
    try {
      const result = await window.electronAPI?.testConnection({
        provider: settings.apiProvider,
        apiKey: settings.apiKey,
        baseUrl: settings.baseUrl,
        model: settings.model,
      })
      setTestResult(result || { ok: false, msg: 'IPC 不可用' })
    } catch (e) {
      setTestResult({ ok: false, msg: `连接失败: ${(e as Error).message}` })
    }
    setTesting(false)
  }

  // Save all settings
  const handleSave = async () => {
    const api = window.electronAPI
    if (!api) return
    const entries: [string, unknown][] = [
      ['apiProvider', settings.apiProvider],
      ['apiKey', settings.apiKey],
      ['baseUrl', settings.baseUrl],
      ['model', settings.model],
      ['temperature', settings.temperature],
      ['maxTokens', settings.maxTokens],
      ['defaultPlatforms', settings.defaultPlatforms],
      ['contentStyle', settings.contentStyle],
      ['scriptDuration', settings.scriptDuration],
      ['defaultLanguage', settings.defaultLanguage],
      ['defaultCrawlCount', settings.defaultCrawlCount],
    ]
    for (const [k, v] of entries) await api.setStore(k, v)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const update = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    setSettings(s => ({ ...s, [key]: value }))

  const togglePlatform = (p: string) => {
    setSettings(s => ({
      ...s,
      defaultPlatforms: s.defaultPlatforms.includes(p)
        ? s.defaultPlatforms.filter(x => x !== p)
        : [...s.defaultPlatforms, p],
    }))
  }

  const selectedProvider = PROVIDERS.find(p => p.id === settings.apiProvider)

  return (
    <div className="flex-1 overflow-y-auto">
      <header className={`titlebar-drag h-12 flex items-center px-5 shrink-0 ${isWindows ? '' : 'border-b border-hairline'}`}>
        <h1 className="text-sm font-medium text-ink no-drag">设置</h1>
      </header>

      <div className="max-w-xl mx-auto px-6 py-8 space-y-8">

        {/* ============================================================ */}
        {/*  1. API 配置                                                  */}
        {/* ============================================================ */}
        <section>
          <h2 className="text-xs uppercase tracking-wider text-muted mb-4">API 配置</h2>
          <div className="card-sm space-y-4">
            {/* Provider */}
            <div>
              <label className="block text-xs text-muted mb-1.5">Provider</label>
              <select
                value={settings.apiProvider}
                onChange={e => update('apiProvider', e.target.value)}
                className={inputCls + ' appearance-none cursor-pointer'}
              >
                {PROVIDERS.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>

            {/* API Key */}
            <div>
              <label className="block text-xs text-muted mb-1.5">API Key</label>
              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={settings.apiKey}
                  onChange={e => update('apiKey', e.target.value)}
                  placeholder="sk-..."
                  className={inputCls + ' pr-10'}
                />
                <button
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink transition-colors"
                >
                  {showApiKey ? <EyeSlash className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[11px] text-muted mt-1">Key 仅存储在本地，不会上传到任何服务器</p>
            </div>

            {/* Base URL */}
            <div>
              <label className="block text-xs text-muted mb-1.5">
                Base URL <span className="text-muted ml-1">(可选)</span>
              </label>
              <input
                type="text"
                value={settings.baseUrl || selectedProvider?.baseUrl || ''}
                onChange={e => update('baseUrl', e.target.value)}
                placeholder={selectedProvider?.baseUrl || 'https://api.example.com/v1'}
                className={inputCls}
              />
              <p className="text-[11px] text-muted mt-1">支持自定义中转站或本地 Ollama</p>
            </div>

            {/* Model */}
            <div>
              <label className="block text-xs text-muted mb-1.5">Model</label>
              <input
                type="text"
                value={settings.model}
                onChange={e => update('model', e.target.value)}
                placeholder="claude-sonnet-4-20250514"
                className={inputCls}
              />
            </div>

            {/* Temperature */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs text-muted">Temperature</label>
                <span className="text-xs text-ink font-mono">{settings.temperature.toFixed(1)}</span>
              </div>
              <input
                type="range"
                min={0} max={2} step={0.1}
                value={settings.temperature}
                onChange={e => update('temperature', parseFloat(e.target.value))}
                className="w-full h-1.5 bg-hairline rounded-full appearance-none cursor-pointer accent-primary"
              />
              <div className="flex justify-between text-[10px] text-muted-soft mt-0.5">
                <span>精确 0</span><span>平衡 1</span><span>创意 2</span>
              </div>
            </div>

            {/* Max Tokens */}
            <div>
              <label className="block text-xs text-muted mb-1.5">Max Tokens</label>
              <input
                type="number"
                min={256} max={32768} step={256}
                value={settings.maxTokens}
                onChange={e => update('maxTokens', Math.max(256, Math.min(32768, parseInt(e.target.value) || 4096)))}
                className={inputCls}
              />
              <p className="text-[11px] text-muted mt-1">范围 256 – 32768，默认 4096</p>
            </div>

            {/* Connection Test */}
            <div className="flex items-center gap-3 pt-1">
              <button
                onClick={handleTestConnection}
                disabled={testing || !settings.apiKey}
                className="btn-secondary text-xs flex items-center gap-1.5"
              >
                {testing ? <Spinner className="w-3.5 h-3.5 animate-spin" /> : <Link className="w-3.5 h-3.5" />}
                {testing ? '测试中...' : '测试连接'}
              </button>
              {testResult && (
                <span className={`text-xs ${testResult.ok ? 'text-semantic-success' : 'text-semantic-error'}`}>
                  {testResult.msg}
                </span>
              )}
            </div>
          </div>
        </section>

        {/* ============================================================ */}
        {/*  2. 创作偏好                                                  */}
        {/* ============================================================ */}
        <section>
          <h2 className="text-xs uppercase tracking-wider text-muted mb-4">创作偏好</h2>
          <div className="card-sm space-y-4">
            {/* Default platforms */}
            <div>
              <label className="block text-xs text-muted mb-2">默认发布平台</label>
              <div className="flex flex-wrap gap-2">
                {PLATFORMS.map(p => (
                  <label
                    key={p.key}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs cursor-pointer transition-colors ${
                      settings.defaultPlatforms.includes(p.key)
                        ? 'border-primary/40 bg-primary/10 text-primary'
                        : 'border-hairline text-muted hover:border-hairline-strong'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={settings.defaultPlatforms.includes(p.key)}
                      onChange={() => togglePlatform(p.key)}
                      className="sr-only"
                    />
                    <span className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${
                      settings.defaultPlatforms.includes(p.key) ? 'bg-primary border-primary' : 'border-hairline-strong'
                    }`}>
                      {settings.defaultPlatforms.includes(p.key) && <Check className="w-2.5 h-2.5 text-on-primary" />}
                    </span>
                    {p.label}
                  </label>
                ))}
              </div>
            </div>

            {/* Content style */}
            <div>
              <label className="block text-xs text-muted mb-1.5">内容风格</label>
              <select
                value={settings.contentStyle}
                onChange={e => update('contentStyle', e.target.value)}
                className={inputCls + ' appearance-none cursor-pointer'}
              >
                {CONTENT_STYLES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {/* Script duration */}
            <div>
              <label className="block text-xs text-muted mb-1.5">脚本默认时长</label>
              <select
                value={settings.scriptDuration}
                onChange={e => update('scriptDuration', e.target.value)}
                className={inputCls + ' appearance-none cursor-pointer'}
              >
                {SCRIPT_DURATIONS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>

            {/* Language */}
            <div>
              <label className="block text-xs text-muted mb-1.5">默认语言</label>
              <select
                value={settings.defaultLanguage}
                onChange={e => update('defaultLanguage', e.target.value)}
                className={inputCls + ' appearance-none cursor-pointer'}
              >
                {LANGUAGES.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          </div>
        </section>

        {/* ============================================================ */}
        {/*  3. 数据管理                                                  */}
        {/* ============================================================ */}
        <section>
          <h2 className="text-xs uppercase tracking-wider text-muted mb-4">数据管理</h2>
          <div className="card-sm space-y-4">
            {/* DB path */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted">数据库位置</p>
                <p className="text-sm text-ink font-mono mt-0.5">~/.knower/knower.db</p>
              </div>
            </div>

            {/* Data count */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted">已爬取数据量</p>
                <p className="text-sm text-ink mt-0.5">
                  {loadingCount ? '加载中...' : `${dataCount ?? 0} 条记录`}
                </p>
              </div>
              <button onClick={loadDataCount} className="btn-ghost text-xs flex items-center gap-1" title="刷新">
                <ArrowClockwise className={`w-3.5 h-3.5 ${loadingCount ? 'animate-spin' : ''}`} />
                刷新
              </button>
            </div>

            {/* Action buttons */}
            <div className="flex gap-2 pt-1">
              <button
                onClick={async () => {
                  if (!confirm('确定要清除旧数据？此操作不可恢复。')) return
                  await window.electronAPI?.cleanOldData()
                  loadDataCount()
                }}
                className="btn-secondary text-xs flex items-center gap-1.5"
              >
                <Trash className="w-3.5 h-3.5" />
                清除旧数据
              </button>
              <button
                onClick={async () => {
                  const result = await window.electronAPI?.importDb()
                  if (result?.success) {
                    alert(`数据库导入成功！包含表: ${result.tables?.join(', ')}`)
                    loadDataCount()
                  } else if (!result?.canceled) {
                    alert(`导入失败: ${result?.error || '未知错误'}`)
                  }
                }}
                className="btn-secondary text-xs flex items-center gap-1.5"
              >
                <Download className="w-3.5 h-3.5" />
                导入数据库
              </button>
            </div>
          </div>
        </section>

        {/* ============================================================ */}
        {/*  4. 爬虫设置                                                  */}
        {/* ============================================================ */}
        <section>
          <h2 className="text-xs uppercase tracking-wider text-muted mb-4">爬虫设置</h2>
          <div className="card-sm space-y-4">
            {/* Default crawl count */}
            <div>
              <label className="block text-xs text-muted mb-1.5">每次爬取条数</label>
              <input
                type="number"
                min={1} max={100} step={1}
                value={settings.defaultCrawlCount}
                onChange={e => update('defaultCrawlCount', Math.max(1, Math.min(100, parseInt(e.target.value) || 20)))}
                className={inputCls}
              />
              <p className="text-[11px] text-muted mt-1">范围 1 – 100，默认 20</p>
            </div>

            {/* Login states */}
            <div>
              <label className="block text-xs text-muted mb-2">登录状态</label>
              <div className="space-y-2">
                {LOGIN_PLATFORMS.map((platform, i) => (
                  <div key={platform} className="flex items-center justify-between py-1.5">
                    <div className="flex items-center gap-2">
                      <span className={`w-2 h-2 rounded-full ${loginStates[platform] ? 'bg-semantic-success' : 'bg-muted-soft'}`} />
                      <span className="text-xs text-ink">{LOGIN_LABELS[i]}</span>
                      <span className={`text-[11px] ${loginStates[platform] ? 'text-semantic-success' : 'text-muted'}`}>
                        {loginStates[platform] ? '已登录' : '未登录'}
                      </span>
                    </div>
                    {loginStates[platform] && (
                      <button
                        onClick={async () => {
                          await window.electronAPI?.clearLoginState(platform)
                          loadLoginStates()
                        }}
                        className="text-[11px] text-muted hover:text-semantic-error transition-colors"
                      >
                        清除登录
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ============================================================ */}
        {/*  5. 创作者管理                                                */}
        {/* ============================================================ */}
        <section>
          <h2 className="text-xs uppercase tracking-wider text-muted mb-4">创作者管理</h2>
          <div className="card-sm space-y-4">
            <CreatorManagement />
          </div>
        </section>

        {/* ============================================================ */}
        {/*  6. 关于                                                      */}
        {/* ============================================================ */}
        <section>
          <h2 className="text-xs uppercase tracking-wider text-muted mb-4">关于</h2>
          <div className="card-sm space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted">项目</span>
              <span className="text-ink font-medium">知更 Knower</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted">版本</span>
              <span className="text-ink">v0.1.0</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted">开源协议</span>
              <span className="text-ink">MIT</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted">GitHub</span>
              <a
                href="https://github.com/tanzhijir-04"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline text-xs"
              >
                github.com/tanzhijir-04
              </a>
            </div>
            <div className="h-px bg-hairline" />
            <div className="flex justify-between text-sm">
              <span className="text-muted">系统</span>
              <span className="text-ink text-xs font-mono">
                {window.electronAPI?.platform === 'darwin' ? 'macOS' :
                 window.electronAPI?.platform === 'win32' ? 'Windows' : 'Linux'}
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted">Electron</span>
              <span className="text-ink text-xs font-mono">{navigator.userAgent.match(/Electron\/([\d.]+)/)?.[1] || '-'}</span>
            </div>
            <div className="h-px bg-hairline" />
            <div>
              <p className="text-xs text-muted mb-2">开源技术栈</p>
              <div className="flex flex-wrap gap-1.5">
                {[
                  'Electron', 'React', 'TypeScript', 'Vite',
                  'Tailwind CSS', 'Node.js', 'SQLite',
                  'Anthropic SDK', 'Playwright', 'MediaCrawler',
                  'Phosphor Icons', 'GSAP',
                ].map(tech => (
                  <span key={tech} className="px-2 py-0.5 bg-surface rounded text-[11px] text-muted-soft border border-hairline">
                    {tech}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ============================================================ */}
        {/*  Save button                                                  */}
        {/* ============================================================ */}
        <button onClick={handleSave} className="btn-primary w-full">
          {saved ? (
            <span className="flex items-center justify-center gap-2">
              <Check className="w-4 h-4" />
              已保存
            </span>
          ) : (
            '保存设置'
          )}
        </button>
      </div>
    </div>
  )
}
