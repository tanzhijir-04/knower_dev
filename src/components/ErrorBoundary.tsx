import { Component, type ReactNode } from 'react'
import { WarningCircle, ArrowsClockwise } from '@phosphor-icons/react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo)
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null })
    window.location.reload()
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen items-center justify-center bg-canvas">
          <div className="text-center max-w-md px-6">
            <WarningCircle className="w-12 h-12 text-semantic-error mx-auto mb-4" />
            <h2 className="text-lg font-medium text-ink mb-2">应用出现错误</h2>
            <p className="text-sm text-body mb-1">
              {this.state.error?.message || '未知错误'}
            </p>
            <p className="text-xs text-muted mb-6">
              错误已记录到控制台，请检查 Electron 主进程日志。
            </p>
            <button
              onClick={this.handleReload}
              className="btn-primary inline-flex items-center gap-2"
            >
              <ArrowsClockwise className="w-4 h-4" />
              重新加载
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
