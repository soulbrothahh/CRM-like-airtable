import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import { AuthGate } from "@/components/AuthGate";
import { DataProvider } from "@/components/DataProvider";
import { DealsProvider } from "@/components/DealsProvider";
import { BottomNav, Sidebar } from "@/components/Nav";
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <AuthGate>
            <DataProvider>
              <DealsProvider>
                <div className="flex min-h-screen">
                  <Sidebar />
                  <main className="w-full min-w-0 flex-1 overflow-x-hidden pb-24 md:pb-8">
                  {children}
                </main>
                </div>
                <BottomNav />
              </DealsProvider>
            </DataProvider>
          </AuthGate>
          <ServiceWorker />
        </AuthProvider>
      </body>
    </html>
  );
}
