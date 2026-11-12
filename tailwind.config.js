/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        navy: {
          950: 'rgb(var(--color-navy-950) / <alpha-value>)',
          900: 'rgb(var(--color-navy-900) / <alpha-value>)',
          850: 'rgb(var(--color-navy-850) / <alpha-value>)',
          800: 'rgb(var(--color-navy-800) / <alpha-value>)',
          750: 'rgb(var(--color-navy-750) / <alpha-value>)',
          700: 'rgb(var(--color-navy-700) / <alpha-value>)',
          600: '#2A4374',
          500: '#3D5F9F',
        },
        surface: {
          darkest: '#090D18',
          darker: '#0D1322',
          card: '#121A2D',
          hover: '#18233D',
          border: 'rgb(var(--color-surface-border) / <alpha-value>)',
          borderLight: 'rgb(var(--color-surface-border-light) / <alpha-value>)',
        },
        status: {
          todo: '#64748B',
          inprogress: '#3B82F6',
          review: '#A855F7',
          done: '#10B981',
          blocked: '#EF4444',
          slaRisk: '#F59E0B',
        },
        priority: {
          highest: '#EF4444',
          high: '#F97316',
          medium: '#F59E0B',
          low: '#3B82F6',
          lowest: '#64748B',
        }
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Text"',
          '"SF Pro Display"',
          'system-ui',
          'sans-serif',
        ],
        mono: [
          '"SF Mono"',
          'Menlo',
          'Monaco',
          'Consolas',
          'monospace',
        ],
      },
    },
  },
  plugins: [],
}

