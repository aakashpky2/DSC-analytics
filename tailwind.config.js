/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Refined Professional Palette
        slate: {
          950: '#0B1120', // Main background (Dark Navy)
          900: '#111827', // Sidebar & Elevated surfaces
          850: '#151E30', // Card background
          800: '#232F42', // Standard Borders & Dividers
          700: '#334155',
          600: '#475569',
          500: '#64748B',
          400: '#94A3B8',
          300: '#CBD5E1',
          200: '#E2E8F0',
          100: '#F1F5F9',
        },
        indigo: {
          950: '#181C30',
          900: '#23294C',
          800: '#323B6D',
          700: '#434E8F',
          600: '#5968C5', // Muted Primary Accent
          500: '#6877D0',
          400: '#8A97DC',
          300: '#B0BAE9',
          200: '#D5DCF5',
        },
        cyan: {
          950: '#0E1D2D',
          900: '#152C42',
          800: '#204363',
          700: '#32608B',
          600: '#4E7EAB',
          500: '#6486B0', // Muted Secondary Blue
          400: '#7E9EC1',
          300: '#A4BCD6',
          200: '#CDDAEB',
        },
        emerald: {
          950: '#0B1F1B',
          900: '#12302A',
          800: '#1B473E',
          700: '#276356',
          600: '#358270',
          500: '#3F9C83', // Muted Success Green
          400: '#5DB59E',
          300: '#86CCB9',
          200: '#B6E3D7',
        },
        amber: {
          950: '#24190B',
          900: '#3B2912',
          800: '#573C19',
          700: '#7A5422',
          600: '#A3722E',
          500: '#C49A53', // Muted Warning Amber
          400: '#D4B072',
          300: '#E3C898',
          200: '#F1DFC0',
        },
        purple: {
          950: '#1F142D',
          900: '#311E45',
          800: '#482D65',
          700: '#633F8B',
          600: '#7F56AD', // Muted Purple
          500: '#946DC0',
          400: '#AA88D1',
          300: '#C5ACE2',
          200: '#E0D2F1',
        },
      },
    },
  },
  plugins: [],
}
