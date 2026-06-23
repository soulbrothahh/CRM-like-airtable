"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useData } from "./DataProvider";
import { useAuth } from "./AuthProvider";

const LINKS = [
  { href: "/", label: "Dashboard", icon: "🏠" },
  { href: "/contacts", label: "Contacts", icon: "👥" },
  { href: "/bottles", label: "Bottles", icon: "🍶" },
  { href: "/data", label: "Import / Export", icon: "⇄" },
];

export function Sidebar() {
  const pathname = usePathname();
  const { storageMode } = useData();
  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-white/5 bg-ink-900/60 p-4 md:flex">
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
                  ? "bg-kava-500/15 text-kava-200 ring-1 ring-kava-400/20"
                  : "text-slate-300 hover:bg-white/5"
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
    <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t border-white/5 bg-ink-900/90 backdrop-blur md:hidden">
      {LINKS.map((l) => {
        const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-[11px] font-medium ${
              active ? "text-kava-300" : "text-slate-400"
            }`}
          >
            <span className="text-lg">{l.icon}</span>
            {l.label === "Import / Export" ? "Data" : l.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-kava-400 to-kava-600 text-lg font-black text-ink-950 shadow-glow">
        N
      </span>
      <div className="leading-tight">
        <div className="text-sm font-bold tracking-tight">NuKava</div>
        <div className="text-[11px] uppercase tracking-widest text-kava-300/80">CRM</div>
      </div>
    </Link>
  );
}

function StorageChip({ mode }: { mode: "cloud" | "local" }) {
  const { email, signOut } = useAuth();
  return (
    <div className="rounded-xl bg-ink-850 px-3 py-2 text-[11px] ring-1 ring-white/5">
      <div className="flex items-center gap-2">
        <span
          className={`h-2 w-2 rounded-full ${
            mode === "cloud" ? "bg-palm-400" : "bg-kava-400"
          }`}
        />
        <span className="font-semibold text-slate-200">
          {mode === "cloud" ? "Cloud sync on" : "On-device mode"}
        </span>
      </div>
      {mode === "cloud" && email ? (
        <>
          <p className="mt-1 truncate text-slate-500" title={email}>
            {email}
          </p>
          <button
            onClick={signOut}
            className="mt-1.5 text-slate-400 hover:text-kava-300"
          >
            Sign out
          </button>
        </>
      ) : (
        <p className="mt-1 text-slate-500">
          {mode === "cloud"
            ? "Synced across your devices."
            : "Add Supabase keys to sync."}
        </p>
      )}
    </div>
  );
}
