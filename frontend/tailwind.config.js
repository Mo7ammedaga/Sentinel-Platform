/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}', './public/index.html'],
  theme: {
    extend: {
      colors: {
        // Professional, minimal palette (constitution: no fake enterprise styling)
        ink: '#0f172a',
        panel: '#111827',
        muted: '#64748b',
        critical: '#dc2626',
        suspicious: '#d97706',
        normal: '#059669',
        accent: '#2563eb',
      },
    },
  },
  plugins: [],
};
