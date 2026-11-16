/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter"', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
      },
      colors: {
        brand: {
          50: '#f0f5ff',
          100: '#e0eafc',
          200: '#c7d9f9',
          300: '#9ebcf4',
          400: '#6e97ec',
          500: '#3f72e0',
          600: '#2656c7',
          700: '#1e44a3',
          800: '#1c3a85',
          900: '#1b336d',
          950: '#122045',
        },
      },
      boxShadow: {
        soft: '0 1px 2px 0 rgba(15, 23, 42, 0.04)',
        card: '0 1px 2px 0 rgba(15, 23, 42, 0.04), 0 1px 1px -1px rgba(15, 23, 42, 0.03)',
        'card-hover': '0 4px 12px -2px rgba(15, 23, 42, 0.07), 0 1px 3px -1px rgba(15, 23, 42, 0.04)',
        glass: '0 8px 24px -6px rgba(15, 23, 42, 0.08), 0 2px 6px -2px rgba(15, 23, 42, 0.04)',
      },
    },
  },
  plugins: [],
};