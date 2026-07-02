"use client";

import { useEffect, useState } from "react";

const KEY = "nukava_theme";
const META_LIGHT = "#FBF7F0";
const META_DARK = "#15110C";

function applyTheme(dark: boolean) {
  document.documentElement.classList.toggle("dark", dark);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", dark ? META_DARK : META_LIGHT);
}

// Sun/moon toggle. First visit follows the system preference (pre-applied by
// the inline script in layout.tsx); a tap stores an explicit choice.
export function ThemeToggle() {
  const [dark, setDark] = useState<boolean | null>(null);

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    applyTheme(next);
    try {
      window.localStorage.setItem(KEY, next ? "dark" : "light");
    } catch {
      /* ignore */
    }
  }

  return (
    <button
      onClick={toggle}
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
      title={dark ? "Light mode" : "Dark mode"}
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cream-50 text-base ring-1 ring-night-900/10 transition hover:bg-cream-200"
    >
      {/* render both to avoid a hydration flash; CSS picks the right one */}
      <span className="dark:hidden">🌙</span>
      <span className="hidden dark:inline">☀️</span>
    </button>
  );
}
