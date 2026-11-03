/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        deep: '#0F3A40', // deep teal: headings, sidebar
        teal: { DEFAULT: '#1C7C7D', 50: '#E7F1EF', 600: '#16696A' },
        coral: { DEFAULT: '#E0684B', 50: '#FBEAE5', 700: '#B4472E' },
        ivory: '#F7F4EE', // page background
        mint: '#E7F1EF', // cards / highlights
        ink: { DEFAULT: '#1D2B2D', muted: '#5B6B6C', faint: '#8A9898' },
        line: '#DCE3DF',
        amber: { DEFAULT: '#C9892B', 50: '#FBF1DF' },
      },
      fontFamily: {
        display: ['Inter', 'system-ui', 'sans-serif'], // sans throughout
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      boxShadow: { card: '0 1px 2px rgba(15,58,64,.05)', float: '0 10px 40px rgba(15,58,64,.12)' },
    },
  },
  plugins: [],
}
