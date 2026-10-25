/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'rgb(var(--bg) / <alpha-value>)',
        panel: 'rgb(var(--panel) / <alpha-value>)',
        'panel-2': 'rgb(var(--panel-2) / <alpha-value>)',
        'panel-3': 'rgb(var(--panel-3) / <alpha-value>)',
        // alias antigo (mantido para não quebrar classes existentes)
        panel2: 'rgb(var(--panel-2) / <alpha-value>)',
        line: 'rgb(var(--line) / <alpha-value>)',
        ink: 'rgb(var(--ink) / <alpha-value>)',
        mute: 'rgb(var(--mute) / <alpha-value>)',
        accent: 'rgb(var(--accent) / <alpha-value>)',
        'accent-ink': 'rgb(var(--accent-ink) / <alpha-value>)',
        playhead: 'rgb(var(--playhead) / <alpha-value>)',
        danger: 'rgb(var(--danger) / <alpha-value>)',
        ok: 'rgb(var(--ok) / <alpha-value>)',
        warn: 'rgb(var(--warn) / <alpha-value>)',
        clip: {
          video: 'rgb(var(--clip-video) / <alpha-value>)',
          audio: 'rgb(var(--clip-audio) / <alpha-value>)',
          text: 'rgb(var(--clip-text) / <alpha-value>)',
          caption: 'rgb(var(--clip-caption) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '"Segoe UI Variable"', '"Segoe UI"', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', '"Cascadia Mono"', 'SFMono-Regular', 'Consolas', 'monospace'],
      },
      fontSize: { '2xs': ['10.5px', '14px'] },
      boxShadow: {
        pop: '0 12px 40px -8px rgb(0 0 0 / 0.55), 0 0 0 1px rgb(var(--line))',
        stage: '0 20px 60px -10px rgb(0 0 0 / 0.65), 0 0 0 1px rgb(var(--line) / 0.8)',
      },
    },
  },
  plugins: [],
};
