import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // NuKava brand palette — dark base with warm tropical accents
        ink: {
          950: "#0a0e0f",
          900: "#0f1518",
          850: "#141c20",
          800: "#1a242a",
          700: "#26343c",
          600: "#36474f",
        },
        kava: {
          // warm tropical amber/sunset
          50: "#fff8ed",
          100: "#ffefd4",
          200: "#ffdba8",
          300: "#ffc070",
          400: "#ff9d3c",
          500: "#f97f16",
          600: "#ea640c",
          700: "#c24a0c",
          800: "#9a3b12",
          900: "#7c3212",
        },
        palm: {
          // tropical green secondary accent
          400: "#3fd9a0",
          500: "#16c088",
          600: "#0f9d6f",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      boxShadow: {
        card: "0 1px 3px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3)",
        glow: "0 0 0 1px rgba(249,127,22,0.25), 0 8px 30px rgba(249,127,22,0.12)",
      },
    },
  },
  plugins: [],
};

export default config;
