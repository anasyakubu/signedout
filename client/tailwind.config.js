/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Flat palette. No gradients anywhere.
        paper: '#F6F7F4',    // page background
        ink: '#161D18',      // primary text
        stone: '#5C6660',    // secondary text
        line: '#D9DED9',     // borders, dividers
        laurel: '#1C5A3F',   // accent — deep laurel green
        'laurel-dark': '#134430',
        'laurel-pale': '#E4EEE7',
        danger: '#9B2C2C',
      },
      fontFamily: {
        display: ['"Young Serif"', 'Georgia', 'serif'],
        body: ['"Public Sans"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
