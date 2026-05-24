import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'

interface Toast {
  id: number
  message: string
  type: 'success' | 'error' | 'info'
}

interface ToastContextValue {
  showToast: (message: string, type?: Toast['type']) => void
}

const ToastContext = createContext<ToastContextValue>({ showToast: () => {} })

export function useToast() {
  return useContext(ToastContext)
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const showToast = useCallback((message: string, type: Toast['type'] = 'success') => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message, type }])
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id))
    }, 3000)
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed top-16 right-4 z-50 space-y-2 pointer-events-none">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`animate-toast-in flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg backdrop-blur-sm text-sm pointer-events-auto ${
              toast.type === 'success' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
              toast.type === 'error' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
              'bg-surface-container text-on-surface border border-outline-variant/30'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">
              {toast.type === 'success' ? 'check_circle' : toast.type === 'error' ? 'error' : 'info'}
            </span>
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
