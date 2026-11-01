/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          50: '#f6f8f7',
          100: '#e9eeec',
          200: '#d3ddd9',
          300: '#adbfb8',
          400: '#7f9a90',
          500: '#5c7c71',
          600: '#456158',
          700: '#374e47',
          800: '#2b3c37',
          900: '#1d2a26',
          950: '#0c1a16',
        },
        brand: {
          50: '#ecfdf5',
          100: '#d1fae5',
          200: '#a7f3d0',
          300: '#6ee7b7',
          400: '#34d399',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          800: '#065f46',
          900: '#064e3b',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
        display: ['"Plus Jakarta Sans"', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(16,24,40,0.04), 0 12px 32px -16px rgba(16,24,40,0.16)',
        lift: '0 2px 4px rgba(16,24,40,0.05), 0 20px 40px -20px rgba(16,24,40,0.25)',
        ring: '0 0 0 1px rgba(16,24,40,0.06)',
      },
      borderRadius: { '2xl': '1rem', '3xl': '1.5rem' },
      keyframes: {
        'fade-up': { '0%': { opacity: '0', transform: 'translateY(8px)' }, '100%': { opacity: '1', transform: 'translateY(0)' } },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        pulseRing: { '0%,100%': { opacity: '0.9' }, '50%': { opacity: '0.4' } },
        scan: { '0%': { top: '0%' }, '100%': { top: '100%' } },
      },
      animation: {
        'fade-up': 'fade-up .35s cubic-bezier(.16,1,.3,1) both',
        shimmer: 'shimmer 1.6s infinite',
        'pulse-ring': 'pulseRing 2.4s ease-in-out infinite',
        scan: 'scan 2.2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
