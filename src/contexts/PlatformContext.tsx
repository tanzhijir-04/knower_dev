import { createContext, useContext } from 'react'

const PlatformContext = createContext({ isWindows: false })

export function PlatformProvider({ children }: { children: React.ReactNode }) {
  const isWindows = window.electronAPI?.platform !== 'darwin'
  return (
    <PlatformContext.Provider value={{ isWindows }}>
      {children}
    </PlatformContext.Provider>
  )
}

export const usePlatform = () => useContext(PlatformContext)
