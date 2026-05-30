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

        // 画布与表面 (Editorial Flats)
        canvas: 'var(--canvas)',
        'canvas-soft': 'var(--canvas-soft)',
        surface: 'var(--surface)',
        'surface-strong': 'var(--surface-strong)',
        'surface-low': 'var(--surface-low)',

        // 发丝线 (Hairlines - 代替阴影的核心)
        hairline: 'var(--hairline)',
        'hairline-soft': 'var(--hairline-soft)',
        'hairline-strong': 'var(--hairline-strong)',

        // 文字 (Warm Inks)
        ink: 'var(--ink)',
        body: 'var(--body)',
        'body-strong': 'var(--ink)',
        muted: 'var(--muted)',
        'muted-soft': 'var(--muted-soft)',

        // AI 时间线 (Signature Pastels)
        'timeline-thinking': 'var(--timeline-thinking)',
        'timeline-grep': 'var(--timeline-grep)',
        'timeline-read': 'var(--timeline-read)',
        'timeline-edit': 'var(--timeline-edit)',
        'timeline-done': 'var(--timeline-done)',

        // 语义
        'semantic-success': 'var(--semantic-success)',
        'semantic-error': 'var(--semantic-error)',
      },
      fontFamily: {
        sans: [
          'Inter', 'Noto Sans SC',
          'PingFang SC', 'Microsoft YaHei',
          'system-ui', '-apple-system', 'BlinkMacSystemFont',
          'Helvetica Neue', 'Helvetica', 'Arial',
          'sans-serif',
        ],
        mono: [
          'JetBrains Mono', 'SF Mono', 'Fira Code',
          'Cascadia Code', 'Consolas', 'monospace',
        ],
      },
      fontSize: {
        // 严格映射规范的排版层级
        'display-mega': ['72px', { lineHeight: '1.1', letterSpacing: '-2.16px', fontWeight: '400' }],
        'display-lg': ['36px', { lineHeight: '1.2', letterSpacing: '-0.72px', fontWeight: '400' }],
        'display-md': ['26px', { lineHeight: '1.25', letterSpacing: '-0.325px', fontWeight: '400' }],
        'display-sm': ['22px', { lineHeight: '1.3', letterSpacing: '-0.11px', fontWeight: '400' }],
        'title-md': ['18px', { lineHeight: '1.4', letterSpacing: '0px', fontWeight: '600' }],
        'title-sm': ['16px', { lineHeight: '1.4', letterSpacing: '0px', fontWeight: '600' }],
        'body-md': ['16px', { lineHeight: '1.5', letterSpacing: '0px', fontWeight: '400' }],
        'body-tracked': ['16px', { lineHeight: '1.5', letterSpacing: '0.08px', fontWeight: '400' }],
        'body-sm': ['14px', { lineHeight: '1.5', letterSpacing: '0px', fontWeight: '400' }],
        'caption': ['13px', { lineHeight: '1.4', letterSpacing: '0px', fontWeight: '400' }],
        'caption-uppercase': ['11px', { lineHeight: '1.4', letterSpacing: '0.88px', fontWeight: '600' }],
        'code': ['13px', { lineHeight: '1.5', letterSpacing: '0px', fontWeight: '400' }],
        'button': ['14px', { lineHeight: '1.0', letterSpacing: '0px', fontWeight: '500' }],
      },
      letterSpacing: {
        'display-mega': '-2.16px',
        'display-lg': '-0.72px',
        'display-md': '-0.325px',
        'display-sm': '-0.11px',
        'caption': '0.88px',
      },
      spacing: {
        xxs: '4px', xs: '8px', sm: '12px', base: '16px',
        md: '20px', lg: '24px', xl: '32px', xxl: '48px',
        section: '80px', sidebar: '56px',
      },
      borderRadius: {
        none: '0px',
        xs: '4px',   // 规范: Inline tags
        sm: '6px',   // 规范: Compact rows
        md: '8px',   // 规范: CTAs, Inputs
        lg: '12px',  // 规范: Cards, IDE panes
        xl: '16px',  // 规范: Rare large cards
        pill: '9999px', // Timeline, badges
      },
      boxShadow: {
        // 强制抹除所有默认阴影，确保设计只能使用发丝线(Hairline)
        sm: 'none', DEFAULT: 'none', md: 'none', lg: 'none', xl: 'none', '2xl': 'none', inner: 'none',
      }
    },
  },
  plugins: [],
}