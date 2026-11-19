/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        graphite: {
          DEFAULT: '#242421',
          base: '#242421',
          surface: '#302F2B',
          elevated: '#41403A',
          stone: '#77746B',
        },
        champagne: {
          DEFAULT: '#C5B89D',
          hover: '#D4C8AE',
          active: '#B6A88C',
          subtle: 'rgba(197, 184, 157, 0.12)',
        },
        sage: {
          DEFAULT: '#9DAE9B',
          subtle: 'rgba(157, 174, 155, 0.14)',
        },
        warning: {
          DEFAULT: '#C9A77D',
          subtle: 'rgba(201, 167, 125, 0.14)',
        },
        danger: {
          DEFAULT: '#C58D85',
          subtle: 'rgba(197, 141, 133, 0.14)',
        },
        paper: {
          primary: '#F1EFE8',
          secondary: '#B7B3A9',
          muted: '#858178',
        },
      },
      borderRadius: {
        'manager': '12px',
        'sidebar': '8px',
        'widget': '14px',
        'widget-sm': '12px',
        'control': '7px',
        'menu': '9px',
        'capsule': '9999px',
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Text"',
          '"Segoe UI"',
          'Roboto',
          'sans-serif',
        ],
        mono: [
          '"SF Mono"',
          'Consolas',
          '"JetBrains Mono"',
          'ui-monospace',
          'monospace',
        ],
      },
      boxShadow: {
        'glass': '0 12px 36px rgba(0, 0, 0, 0.20), inset 0 1px 0 rgba(241, 239, 232, 0.06)',
        'capsule': '0 8px 24px rgba(0, 0, 0, 0.24), 0 2px 6px rgba(0, 0, 0, 0.16), inset 0 1px 0 rgba(241, 239, 232, 0.08)',
        'elevated': '0 16px 40px rgba(0, 0, 0, 0.28), inset 0 1px 0 rgba(241, 239, 232, 0.07)',
      },
    },
  },
  plugins: [],
}
