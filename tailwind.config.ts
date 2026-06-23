import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // NuKava palette — warm cream base, charcoal premium, kava-gold + earthy accents
        cream: {
          50: "#FEFCF8",
          100: "#FBF7F0",
          200: "#F4ECDF",
          300: "#EADCC6",
        },
        sand: {
          200: "#EFE6D6",
          300: "#E4D7C0",
          400: "#D8C6A8",
        },
        night: {
          700: "#2C2620",
          800: "#201B16",
          900: "#16120E",
        },
        taupe: {
          400: "#9A8C7B",
          500: "#7C6F5F",
          600: "#5E5346",
        },
        gold: {
          300: "#E8C97C",
          400: "#D8A33E",
          500: "#C5871F",
          600: "#A06B16",
          700: "#7E5410",
        },
        clay: {
          400: "#B5764A",
          500: "#8A5A3B",
          600: "#6F472D",
        },
        sage: {
          400: "#8FA382",
          500: "#6E8268",
          600: "#54684F",
        },
        sunset: {
          400: "#EE9468",
          500: "#E0764A",
          600: "#C75F36",
        },
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Plus Jakarta Sans", "system-ui", "sans-serif"],
      },
      boxShadow: {
        soft: "0 1px 2px rgba(33,28,22,0.04), 0 4px 16px rgba(33,28,22,0.06)",
        lift: "0 2px 6px rgba(33,28,22,0.06), 0 12px 32px rgba(33,28,22,0.10)",
        gold: "0 8px 30px rgba(197,135,31,0.18)",
      },
      backgroundImage: {
        "night-grad":
          "linear-gradient(135deg, #221C16 0%, #16120E 60%, #2C2620 100%)",
        "warm-grad":
          "linear-gradient(135deg, #FBF7F0 0%, #F4ECDF 55%, #EADCC6 100%)",
      },
    },
  },
  plugins: [],
};

export default config;
