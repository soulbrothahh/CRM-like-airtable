"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useData } from "./DataProvider";
import { useAuth } from "./AuthProvider";

const LINKS = [
  { href: "/", label: "Better Moments", icon: "🏝️", short: "Home" },
  { href: "/contacts", label: "Connections", icon: "👋", short: "People" },
  { href: "/deals", label: "Deals", icon: "🤝", short: "Deals" },
  { href: "/bottles", label: "Kava Giveaways", icon: "🌿", short: "Kava" },
  { href: "/outreach", label: "Warm Intros", icon: "✉️", short: "Intros" },
  { href: "/data", label: "Import / Export", icon: "⇄", short: "Data" },
];

export function Sidebar() {
  const pathname = usePathname();
  const { storageMode } = useData();
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-night-900/5 bg-cream-50/60 p-4 md:flex">
      <Brand />
      <nav className="mt-6 flex flex-col gap-1">
        {LINKS.map((l) => {
          const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                active
                  ? "bg-gold-400/15 text-gold-700 ring-1 ring-gold-400/20"
                  : "text-taupe-600 hover:bg-night-900/[0.04]"
              }`}
            >
              <span className="text-base">{l.icon}</span>
              {l.label}
            </Link>
          );
        })}
      </nav>
      <div className="mt-auto pt-4">
        <StorageChip mode={storageMode} />
      </div>
    </aside>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-night-900/5 bg-cream-50/90 backdrop-blur md:hidden">
      {LINKS.map((l) => {
        const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[10px] font-medium ${
              active ? "text-gold-600" : "text-taupe-500"
            }`}
          >
            <span className="text-lg">{l.icon}</span>
            {l.short}
          </Link>
        );
      })}
    </nav>
  );
}

export function Brand({ className = "h-7" }: { className?: string }) {
  return (
    <Link href="/" aria-label="nukava" className="inline-flex items-center">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/nukava-logo.svg" alt="nukava" className={`${className} w-auto`} />
    </Link>
  );
}

function StorageChip({ mode }: { mode: "cloud" | "local" }) {
  const { email, signOut } = useAuth();
  return (
    <div className="rounded-xl bg-cream-50 px-3 py-2 text-[11px] ring-1 ring-night-900/5">
      <div className="flex items-center gap-2">
        <span
          className={`h-2 w-2 rounded-full ${
            mode === "cloud" ? "bg-sage-500" : "bg-gold-400"
          }`}
        />
        <span className="font-semibold text-night-800">
          {mode === "cloud" ? "Cloud sync on" : "On-device mode"}
        </span>
      </div>
      {mode === "cloud" && email ? (
        <>
          <p className="mt-1 truncate text-taupe-400" title={email}>
            {email}
          </p>
          <button
            onClick={signOut}
            className="mt-1.5 text-taupe-500 hover:text-gold-600"
          >
            Sign out
          </button>
        </>
      ) : (
        <p className="mt-1 text-taupe-400">
          {mode === "cloud"
            ? "Synced across your devices."
            : "Add Supabase keys to sync."}
        </p>
      )}
    </div>
  );
}
