import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from 'react'
import { toastEnter, toastExit } from '../lib/gsap'
import { CheckCircle, WarningCircle, Info } from '@phosphor-icons/react'

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

function ToastItem({ toast, onDone }: { toast: Toast; onDone: (id: number) => void }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (ref.current) toastEnter(ref.current)
    const timer = setTimeout(() => {
      if (ref.current) {
        toastExit(ref.current, () => onDone(toast.id))
      } else {
        onDone(toast.id)
      }
    }, 3000)
    return () => clearTimeout(timer)
  }, [toast.id, onDone])

  return (
    <div
      ref={ref}
      className={`flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg backdrop-blur-sm text-sm pointer-events-auto ${
        toast.type === 'success' ? 'bg-green-500/20 text-green-400 border border-green-500/30' :
        toast.type === 'error' ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
        'bg-surface text-ink border border-hairline'
      }`}
    >
      <span className="text-[16px]">
        {toast.type === 'success' ? <CheckCircle className="w-4 h-4" /> : toast.type === 'error' ? <WarningCircle className="w-4 h-4" /> : <Info className="w-4 h-4" />}
      </span>
      {toast.message}
    </div>
  )
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const removeToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id))
  }, [])

  const showToast = useCallback((message: string, type: Toast['type'] = 'success') => {
    const id = Date.now()
    setToasts(prev => [...prev, { id, message, type }])
  }, [])

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed top-16 right-4 z-50 space-y-2 pointer-events-none">
        {toasts.map(toast => (
          <ToastItem key={toast.id} toast={toast} onDone={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}
