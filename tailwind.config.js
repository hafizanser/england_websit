/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        // Body copy — clean humanist grotesque
        sans: ['"Plus Jakarta Sans"', 'Outfit', 'system-ui', 'sans-serif'],
        // Display / headings — expressive editorial grotesque
        display: ['"Bricolage Grotesque"', '"Plus Jakarta Sans"', 'system-ui', 'sans-serif'],
        urdu: ['"Noto Nastaliq Urdu"', 'serif'],
      },
      colors: {
        // Primary dark — warm brown → ink. Used for headings, body text,
        // dark surfaces (footer/hero bands) and the primary dark button.
        brand: {
          50: '#fbf5e9',
          100: '#efe2cc',
          200: '#e1cfa9',
          300: '#c9b89f',
          400: '#a1907c',
          500: '#6e5a47',
          600: '#5a4636', // brown2
          700: '#3a2a1c', // brown — primary dark button
          800: '#2c1f14',
          900: '#241910', // ink — headings
          950: '#1a1209', // near-black brown — footer / body text
        },
        // Warm gold accent — premium, "barkat"/prosperity
        saffron: {
          50: '#fdf6ec',
          100: '#f9e9cc',
          200: '#e7d4ac', // gold-soft
          300: '#e0c07e',
          400: '#c7a05b', // gold — main accent
          500: '#be9248',
          600: '#a8823d', // gold-deep
          700: '#8a6a30',
          800: '#6e5526',
          900: '#574420',
        },
        // Cream paper surfaces
        sand: {
          50: '#fbf5e9', // cream — page background
          100: '#f3e8d2', // cream2
          200: '#e7d4ac', // gold-soft border
        },
        // WhatsApp brand green — order / contact CTAs
        wa: {
          50: '#e7f9ef',
          500: '#1fa855', // emerald green - matches reference shadow
          600: '#17a34c',
          700: '#0e8a47', // darker emerald
        },
      },
      borderRadius: {
        '4xl': '2rem',
        '5xl': '2.5rem',
      },
      boxShadow: {
        soft: '0 18px 40px -22px rgba(58, 42, 28, 0.22)',
        lift: '0 28px 60px -24px rgba(58, 42, 28, 0.32)',
        glow: '0 0 0 1px rgba(58,42,28,0.05), 0 18px 40px -20px rgba(199,160,91,0.38)',
        // Premium "diffusion" shadows for the admin SaaS surfaces.
        card: '0 1px 2px rgba(58,42,28,0.04), 0 14px 34px -20px rgba(58,42,28,0.18)',
        cardhover: '0 2px 6px rgba(58,42,28,0.06), 0 30px 60px -22px rgba(58,42,28,0.28)',
        ring: 'inset 0 1px 0 0 rgba(255,255,255,0.6)',
        // Ultra-premium layered surfaces — KPI glass tiles + floating panels.
        kpi: '0 1px 0 0 rgba(255,255,255,0.7) inset, 0 1px 3px rgba(58,42,28,0.06), 0 20px 44px -24px rgba(58,42,28,0.30)',
        kpihover: '0 1px 0 0 rgba(255,255,255,0.8) inset, 0 6px 14px -6px rgba(58,42,28,0.14), 0 40px 70px -26px rgba(199,160,91,0.42)',
        glass: '0 1px 0 0 rgba(255,255,255,0.55) inset, 0 24px 60px -28px rgba(36,25,16,0.55)',
        haze: '0 30px 80px -30px rgba(199,160,91,0.45)',
        innerline: 'inset 0 0 0 1px rgba(255,255,255,0.6)',
      },
      keyframes: {
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
        floaty: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'pulse-ring': {
          '0%': { boxShadow: '0 0 0 0 rgba(199,160,91,0.45)' },
          '70%': { boxShadow: '0 0 0 6px rgba(199,160,91,0)' },
          '100%': { boxShadow: '0 0 0 0 rgba(199,160,91,0)' },
        },
        // Slow-panning mesh gradient for premium hero/backdrops.
        'gradient-pan': {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        // Diagonal light sweep across glass surfaces.
        sheen: {
          '0%': { transform: 'translateX(-120%) skewX(-12deg)' },
          '60%, 100%': { transform: 'translateX(220%) skewX(-12deg)' },
        },
        // Bars / panels rising into place.
        rise: {
          '0%': { opacity: '0', transform: 'translateY(14px) scale(0.98)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        'grow-y': {
          '0%': { transform: 'scaleY(0)' },
          '100%': { transform: 'scaleY(1)' },
        },
        'glow-pulse': {
          '0%, 100%': { opacity: '0.55' },
          '50%': { opacity: '1' },
        },
        'float-slow': {
          '0%, 100%': { transform: 'translate3d(0,0,0)' },
          '50%': { transform: 'translate3d(0,-14px,0)' },
        },
        'spin-slow': {
          '100%': { transform: 'rotate(360deg)' },
        },
      },
      animation: {
        marquee: 'marquee 28s linear infinite',
        shimmer: 'shimmer 2.2s infinite',
        floaty: 'floaty 6s ease-in-out infinite',
        'fade-up': 'fade-up 0.5s cubic-bezier(0.16,1,0.3,1) both',
        'pulse-ring': 'pulse-ring 2s ease-out infinite',
        'gradient-pan': 'gradient-pan 14s ease-in-out infinite',
        sheen: 'sheen 5.5s ease-in-out infinite',
        rise: 'rise 0.6s cubic-bezier(0.16,1,0.3,1) both',
        'grow-y': 'grow-y 0.9s cubic-bezier(0.16,1,0.3,1) both',
        'glow-pulse': 'glow-pulse 3.5s ease-in-out infinite',
        'float-slow': 'float-slow 9s ease-in-out infinite',
        'spin-slow': 'spin-slow 18s linear infinite',
      },
    },
  },
  plugins: [],
}
