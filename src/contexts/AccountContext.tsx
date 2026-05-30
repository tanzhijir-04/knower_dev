import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import type { Account, AccountData } from '../types/electron'

interface AccountContextType {
  accounts: Account[]
  activeAccount: Account | null
  activeAccountId: string
  loading: boolean
  switchAccount: (id: string) => Promise<void>
  createAccount: (data: AccountData) => Promise<string>
  updateAccount: (id: string, updates: Partial<AccountData>) => Promise<void>
  deleteAccount: (id: string) => Promise<void>
  reloadAccounts: () => Promise<void>
}

const AccountContext = createContext<AccountContextType | null>(null)

export function useAccount() {
  const ctx = useContext(AccountContext)
  if (!ctx) throw new Error('useAccount must be used within AccountProvider')
  return ctx
}

export function AccountProvider({ children }: { children: ReactNode }) {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [activeAccount, setActiveAccount] = useState<Account | null>(null)
  const [loading, setLoading] = useState(true)

  const reloadAccounts = useCallback(async () => {
    const api = window.electronAPI
    if (!api) return
    try {
      const list = await api.listAccounts()
      setAccounts(list)
      const active = await api.getActiveAccount()
      setActiveAccount(active)
    } catch (err) {
      console.error('[AccountContext] 加载账号失败:', err)
    }
  }, [])

  useEffect(() => {
    reloadAccounts().finally(() => setLoading(false))
  }, [reloadAccounts])

  const switchAccount = useCallback(async (id: string) => {
    const api = window.electronAPI
    if (!api) return
    await api.switchAccount(id)
    await reloadAccounts()
  }, [reloadAccounts])

  const createAccount = useCallback(async (data: AccountData) => {
    const api = window.electronAPI
    if (!api) return ''
    const id = await api.createAccount(data)
    await reloadAccounts()
    return id
  }, [reloadAccounts])

  const updateAccount = useCallback(async (id: string, updates: Partial<AccountData>) => {
    const api = window.electronAPI
    if (!api) return
    await api.updateAccount(id, updates)
    await reloadAccounts()
  }, [reloadAccounts])

  const deleteAccount = useCallback(async (id: string) => {
    const api = window.electronAPI
    if (!api) return
    await api.deleteAccount(id)
    await reloadAccounts()
  }, [reloadAccounts])

  const activeAccountId = activeAccount?.id || 'default'

  return (
    <AccountContext.Provider value={{
      accounts,
      activeAccount,
      activeAccountId,
      loading,
      switchAccount,
      createAccount,
      updateAccount,
      deleteAccount,
      reloadAccounts,
    }}>
      {children}
    </AccountContext.Provider>
  )
}
