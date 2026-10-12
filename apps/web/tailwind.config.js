/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'bg-0': '#0B1220',
        'bg-1': '#0E1626',
        surface: '#101828',
        'surface-2': '#141E30',
        'surface-3': '#18253C',
        border: '#1F2C44',
        'border-strong': '#2E3F5F',
        'text-1': '#E6ECF5',
        'text-2': '#9AA8BE',
        'text-3': '#5F7089',
        live: '#2DD4BF',
        'live-dim': 'rgba(45, 212, 191, 0.13)',
        warn: '#FBBF24',
        'warn-dim': 'rgba(251, 191, 36, 0.12)',
        crit: '#F87171',
        'crit-dim': 'rgba(248, 113, 113, 0.12)',
        ai: '#A5B4FC',
        'ai-tint': 'rgba(129, 140, 248, 0.07)',
        focus: '#67E8F9',
      },
      fontFamily: {
        ui: ['-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Consolas', 'Liberation Mono', 'monospace'],
      }
    },
  },
  plugins: [],
}
