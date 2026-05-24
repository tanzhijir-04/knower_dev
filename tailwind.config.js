/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: 'var(--primary)',
        'on-primary': 'var(--on-primary)',
        'primary-container': '#4ade80',
        background: 'var(--bg)',
        surface: 'var(--surface)',
        'surface-low': 'var(--surface-low)',
        'surface-container': 'var(--surface-container)',
        'surface-high': 'var(--surface-high)',
        'surface-highest': 'var(--surface-highest)',
        'on-surface': 'var(--on-surface)',
        'on-surface-variant': 'var(--on-surface-variant)',
        outline: 'var(--outline)',
        'outline-variant': 'var(--outline-variant)',
        sidebar: 'var(--sidebar)',
        border: 'var(--border)',
        body: 'var(--body-text)',
        ink: 'var(--ink)',
        mute: 'var(--mute)',
      },
      fontFamily: {
        sans: [
          'Inter',
          'Noto Sans SC',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
        display: ['Source Serif 4', 'Georgia', 'serif'],
        mono: ['JetBrains Mono', 'Cascadia Code', 'Fira Code', 'Consolas', 'monospace'],
      },
      spacing: {
        sidebar: '56px',
      },
      borderRadius: {
        DEFAULT: '0.25rem',
        lg: '0.5rem',
        xl: '0.75rem',
      },
    },
  },
  plugins: [],
}
