/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["'Playfair Display'", "Georgia", "serif"],
        body: ["'DM Sans'", "system-ui", "sans-serif"],
      },
      colors: {
        felt: {
          900: "#0a1f0e",
          800: "#0f2d14",
          700: "#163d1c",
          600: "#1e5228",
          500: "#276634",
        },
        gold: {
          400: "#f4c842",
          500: "#e6b020",
          600: "#c8940a",
        },
        card: {
          bg: "#faf7f2",
          border: "#e8e0d0",
        },
      },
      animation: {
        "deal-in": "dealIn 0.35s cubic-bezier(0.34,1.56,0.64,1) both",
        "float-up": "floatUp 0.4s ease-out both",
        "pulse-slow": "pulse 3s ease-in-out infinite",
        "slide-up": "slideUp 0.3s ease-out both",
      },
      keyframes: {
        dealIn: {
          "0%": { opacity: 0, transform: "translateY(40px) scale(0.8) rotate(-5deg)" },
          "100%": { opacity: 1, transform: "translateY(0) scale(1) rotate(0deg)" },
        },
        floatUp: {
          "0%": { opacity: 0, transform: "translateY(20px)" },
          "100%": { opacity: 1, transform: "translateY(0)" },
        },
        slideUp: {
          "0%": { opacity: 0, transform: "translateY(16px)" },
          "100%": { opacity: 1, transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};
