import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import { AuthGate } from "@/components/AuthGate";
import { DataProvider } from "@/components/DataProvider";
import { DealsProvider } from "@/components/DealsProvider";
import { EventsProvider } from "@/components/EventsProvider";
import { SequencesProvider } from "@/components/SequencesProvider";
import { TasksProvider } from "@/components/TasksProvider";
import { BottomNav, Sidebar } from "@/components/Nav";
import { QuickAdd } from "@/components/QuickAdd";
import { ServiceWorker } from "@/components/ServiceWorker";

export const metadata: Metadata = {
  title: "núkava · Better Moments",
  description: "Track your connections and kava giveaways — built for better moments.",
  manifest: "/manifest.json",
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "núkava",
  },
};

export const viewport: Viewport = {
  themeColor: "#FBF7F0",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

// Applies the saved (or system) theme before first paint so there's no flash
// of the wrong theme. Must run inline in <head>, ahead of hydration.
const themeInit = `(function(){try{var t=localStorage.getItem("nukava_theme");var d=t==="dark"||(!t&&window.matchMedia("(prefers-color-scheme: dark)").matches);if(d){document.documentElement.classList.add("dark");var m=document.querySelector('meta[name="theme-color"]');if(m)m.setAttribute("content","#15110C");}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body>
        <AuthProvider>
          <AuthGate>
            <DataProvider>
              <DealsProvider>
                <EventsProvider>
                 <SequencesProvider>
                 <TasksProvider>
                  <div className="flex min-h-screen">
                    <Sidebar />
                    <main className="w-full min-w-0 flex-1 overflow-x-hidden pb-24 md:pb-8">
                      {children}
                    </main>
                  </div>
                  <QuickAdd />
                  <BottomNav />
                 </TasksProvider>
                 </SequencesProvider>
                </EventsProvider>
              </DealsProvider>
            </DataProvider>
          </AuthGate>
          <ServiceWorker />
        </AuthProvider>
      </body>
    </html>
  );
}
