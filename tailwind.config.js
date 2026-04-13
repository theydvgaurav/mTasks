/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/renderer/**/*.{js,jsx,ts,tsx,html}'],
  darkMode: ['class', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        panel: 'var(--color-panel)',
        ink: 'var(--color-ink)',
        accent: 'var(--color-accent)',
        surface: 'var(--color-surface)',
        border: 'var(--color-border)',
        muted: 'var(--color-muted)',
        success: 'var(--color-success)',
        danger: 'var(--color-danger)'
      },
      boxShadow: {
        panel: '0 14px 40px rgba(15, 23, 42, 0.14)'
      },
      fontFamily: {
        ui: ['"Avenir Next"', '"SF Pro Text"', 'ui-sans-serif', 'system-ui']
      },
      transitionTimingFunction: {
        app: 'cubic-bezier(0.2, 0.8, 0.2, 1)'
      }
    }
  },
  plugins: []
};
