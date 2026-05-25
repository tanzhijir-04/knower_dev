/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // 核心
        primary: 'var(--primary)',
        'primary-active': 'var(--primary-active)',
        'on-primary': 'var(--on-primary)',

        // 画布
        canvas: 'var(--canvas)',
        'canvas-soft': 'var(--canvas-soft)',

        // 表面
        surface: 'var(--surface)',
        'surface-strong': 'var(--surface-strong)',
        'surface-low': 'var(--surface-low)',

        // 发丝线
        hairline: 'var(--hairline)',
        'hairline-soft': 'var(--hairline-soft)',
        'hairline-strong': 'var(--hairline-strong)',

        // 文字
        ink: 'var(--ink)',
        body: 'var(--body)',
        'body-strong': 'var(--ink)',
        muted: 'var(--muted)',
        'muted-soft': 'var(--muted-soft)',

        // AI 时间线
        'timeline-thinking': 'var(--timeline-thinking)',
        'timeline-grep': 'var(--timeline-grep)',
        'timeline-read': 'var(--timeline-read)',
        'timeline-edit': 'var(--timeline-edit)',
        'timeline-done': 'var(--timeline-done)',

        // 语义
        'semantic-success': 'var(--semantic-success)',
        'semantic-error': 'var(--semantic-error)',

        // 兼容旧名
        background: 'var(--canvas)',
        'on-surface': 'var(--ink)',
        'on-surface-variant': 'var(--body)',
        'outline-variant': 'var(--hairline)',
        border: 'var(--hairline)',
        mute: 'var(--muted)',
        sidebar: 'var(--canvas-soft)',
      },
      fontFamily: {
        sans: [
          'Inter',
          'Noto Sans SC',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'sans-serif',
        ],
        mono: ['JetBrains Mono', 'Cascadia Code', 'Consolas', 'monospace'],
      },
      spacing: {
        xxs: '4px',
        xs: '8px',
        sm: '12px',
        base: '16px',
        md: '20px',
        lg: '24px',
        xl: '32px',
        xxl: '48px',
        section: '80px',
        sidebar: '56px',
      },
      borderRadius: {
        none: '0px',
        xs: '4px',
        sm: '6px',
        md: '8px',
        lg: '12px',
        xl: '16px',
        pill: '9999px',
        full: '9999px',
      },
    },
  },
  plugins: [],
}
