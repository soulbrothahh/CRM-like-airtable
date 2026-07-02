import type { Config } from "tailwindcss";

// Theme tokens resolve through CSS variables (declared in globals.css) so the
// whole app can flip between the warm-light and night themes by toggling the
// `dark` class — no per-component classes needed.
const v = (name: string) => `rgb(var(${name}) / <alpha-value>)`;

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        // NuKava palette — warm cream base, charcoal premium, kava-gold + earthy accents
        cream: {
          50: v("--cream-50"),
          100: v("--cream-100"),
          200: v("--cream-200"),
          300: v("--cream-300"),
        },
        sand: {
          200: v("--sand-200"),
          300: v("--sand-300"),
          400: v("--sand-400"),
        },
        night: {
          700: v("--night-700"),
          800: v("--night-800"),
          900: v("--night-900"),
        },
        taupe: {
          400: v("--taupe-400"),
          500: v("--taupe-500"),
          600: v("--taupe-600"),
        },
        gold: {
          300: v("--gold-300"),
          400: v("--gold-400"),
          500: v("--gold-500"),
          600: v("--gold-600"),
          700: v("--gold-700"),
        },
        clay: {
          400: v("--clay-400"),
          500: v("--clay-500"),
          600: v("--clay-600"),
        },
        sage: {
          400: v("--sage-400"),
          500: v("--sage-500"),
          600: v("--sage-600"),
        },
        sunset: {
          400: "#EE9468",
          500: "#E0764A",
          600: "#C75F36",
        },
        // Theme-stable literals for surfaces that stay dark (hero, code blocks)
        // in BOTH themes — paper is always light cream, charcoal always night.
        paper: {
          100: "#FBF7F0",
          200: "#F4ECDF",
        },
        charcoal: "#16120E",
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
