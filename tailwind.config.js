/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#6bfb9a',
        'on-primary': '#003919',
        'primary-container': '#4ade80',
        background: '#0e150f',
        surface: '#141414',
        'surface-low': '#161d17',
        'surface-container': '#1a211b',
        'surface-high': '#242c25',
        'surface-highest': '#2f372f',
        'on-surface': '#dde5da',
        'on-surface-variant': '#bccabb',
        outline: '#869486',
        'outline-variant': '#3d4a3e',
        sidebar: '#0f0f0f',
        border: '#222222',
        body: '#a3a3a3',
        ink: '#f0f0f0',
        mute: '#525252',
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
