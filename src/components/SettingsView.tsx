import { useState, useEffect } from 'react'

interface Settings {
  apiProvider: string
  apiKey: string
  baseUrl: string
  model: string
}

const PROVIDERS = [
  { id: 'claude', name: 'Claude (Anthropic)', baseUrl: 'https://api.anthropic.com/v1' },
  { id: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1' },
  { id: 'deepseek', name: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1' },
  { id: 'qwen', name: '通义千问 (Qwen)', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1' },
  { id: 'custom', name: '自定义', baseUrl: '' },
]

export default function SettingsView() {
  const [settings, setSettings] = useState<Settings>({
    apiProvider: 'claude',
    apiKey: '',
    baseUrl: '',
    model: 'claude-sonnet-4-20250514',
  })

  const [showApiKey, setShowApiKey] = useState(false)
  const [saved, setSaved] = useState(false)

  // 加载已保存的配置
  useEffect(() => {
    window.electronAPI?.getStoreAll().then((all) => {
      if (all && Object.keys(all).length > 0) {
        setSettings((s) => ({
          ...s,
          apiProvider: (all.apiProvider as string) || s.apiProvider,
          apiKey: (all.apiKey as string) || s.apiKey,
          baseUrl: (all.baseUrl as string) || s.baseUrl,
          model: (all.model as string) || s.model,
        }))
      }
    })
  }, [])

  const handleSave = async () => {
    const api = window.electronAPI
    if (api) {
      await api.setStore('apiProvider', settings.apiProvider)
      await api.setStore('apiKey', settings.apiKey)
      await api.setStore('baseUrl', settings.baseUrl)
      await api.setStore('model', settings.model)
    }
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const selectedProvider = PROVIDERS.find((p) => p.id === settings.apiProvider)

  return (
    <div className="flex-1 overflow-y-auto">
      <header className="titlebar-drag h-12 flex items-center px-5 border-b border-border/30 shrink-0">
        <h1 className="text-sm font-medium text-on-surface no-drag">设置</h1>
      </header>

      <div className="max-w-xl mx-auto px-6 py-8 space-y-8">
        {/* API Configuration */}
        <section>
          <h2 className="text-xs uppercase tracking-wider text-mute mb-4">API 配置</h2>
          <div className="space-y-4">
            {/* Provider */}
            <div>
              <label className="block text-xs text-on-surface-variant mb-1.5">Provider</label>
              <select
                value={settings.apiProvider}
                onChange={(e) => setSettings((s) => ({ ...s, apiProvider: e.target.value }))}
                className="w-full bg-surface-container border border-outline-variant/30 rounded-lg px-3 py-2.5 text-sm text-on-surface outline-none focus:border-primary/50 transition-colors appearance-none cursor-pointer"
              >
                {PROVIDERS.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* API Key */}
            <div>
              <label className="block text-xs text-on-surface-variant mb-1.5">API Key</label>
              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={settings.apiKey}
                  onChange={(e) => setSettings((s) => ({ ...s, apiKey: e.target.value }))}
                  placeholder="sk-..."
                  className="w-full bg-surface-container border border-outline-variant/30 rounded-lg px-3 py-2.5 pr-10 text-sm text-on-surface outline-none focus:border-primary/50 transition-colors placeholder:text-mute"
                />
                <button
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-mute hover:text-on-surface-variant transition-colors"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {showApiKey ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
              <p className="text-[11px] text-mute mt-1">Key 仅存储在本地，不会上传到任何服务器</p>
            </div>

            {/* Base URL */}
            <div>
              <label className="block text-xs text-on-surface-variant mb-1.5">
                Base URL
                <span className="text-mute ml-1">(可选)</span>
              </label>
              <input
                type="text"
                value={settings.baseUrl || selectedProvider?.baseUrl || ''}
                onChange={(e) => setSettings((s) => ({ ...s, baseUrl: e.target.value }))}
                placeholder={selectedProvider?.baseUrl || 'https://api.example.com/v1'}
                className="w-full bg-surface-container border border-outline-variant/30 rounded-lg px-3 py-2.5 text-sm text-on-surface outline-none focus:border-primary/50 transition-colors placeholder:text-mute"
              />
              <p className="text-[11px] text-mute mt-1">支持自定义中转站或本地 Ollama</p>
            </div>

            {/* Model */}
            <div>
              <label className="block text-xs text-on-surface-variant mb-1.5">Model</label>
              <input
                type="text"
                value={settings.model}
                onChange={(e) => setSettings((s) => ({ ...s, model: e.target.value }))}
                placeholder="claude-sonnet-4-20250514"
                className="w-full bg-surface-container border border-outline-variant/30 rounded-lg px-3 py-2.5 text-sm text-on-surface outline-none focus:border-primary/50 transition-colors placeholder:text-mute"
              />
            </div>
          </div>
        </section>

        {/* About */}
        <section>
          <h2 className="text-xs uppercase tracking-wider text-mute mb-4">关于</h2>
          <div className="bg-surface-container rounded-xl px-4 py-3 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-on-surface-variant">版本</span>
              <span className="text-on-surface">v0.1.0</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-on-surface-variant">开源协议</span>
              <span className="text-on-surface">MIT</span>
            </div>
          </div>
        </section>

        {/* Save button */}
        <button
          onClick={handleSave}
          className="w-full py-3 bg-primary/10 hover:bg-primary/20 text-primary font-medium rounded-xl transition-all duration-150"
        >
          {saved ? (
            <span className="flex items-center justify-center gap-2">
              <span className="material-symbols-outlined text-[18px]">check</span>
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
