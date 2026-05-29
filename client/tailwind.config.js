/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: '#0d0f1a',
          1: '#131629',
          2: '#1a1d2e',
          3: '#222540',
        },
        border: '#252840',
        accent: {
          DEFAULT: '#6366f1',
          hover: '#4f46e5',
        },
        muted: '#6b7280',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
