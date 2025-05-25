/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{vue,js,ts,jsx,tsx}",
  ],
  darkMode: 'class', 
  theme: {
    extend: { 
      fontFamily: {
          poppins: ['Poppins', 'sans-serif'],
      },
      colors: {
          // Primary Colors
          accent: '#00CFFD', // Cyan Accent
          danger: '#EF4444', // Red for alerts/logout
          primary: '#4F46E5', // Indigo
          secondary: '#6D28D9', // Purple
          lightBg: '#F8F9FA',
          lightSurface: '#FFFFFF',
          lightText: '#1F2937',
          lightTextSecondary: '#6B7280',
          // Dark Theme
          darkBg: '#0B132B',
          darkSurface: '#1C2541',
          darkSurfaceLighter: '#2A385E',
          darkText: '#E0E1E7',
          darkTextSecondary: '#A0AEC0',
          darkAccent: '#00CFFD',
          darkBorder: '#3A476F',
      },
      boxShadow: {
          'md-dark': '0 4px 6px -1px rgba(0, 207, 253, 0.05), 0 2px 4px -1px rgba(0, 207, 253, 0.03)',
          'lg-dark': '0 10px 15px -3px rgba(0, 207, 253, 0.05), 0 4px 6px -2px rgba(0, 207, 253, 0.03)',
      },
      animation: {
          'pulse-subtle': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
          'fade-in': 'fadeIn 0.5s ease-out forwards',
          'slide-up': 'slideUp 0.6s ease-out forwards',
      },
      keyframes: {
         fadeIn: { '0%': { opacity: 0 }, '100%': { opacity: 1 } },
         slideUp: { '0%': { opacity: 0, transform: 'translateY(15px)' }, '100%': { opacity: 1, transform: 'translateY(0)' } }
      }
    },
  },
  plugins: [],
}