import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/components/AuthProvider";
import { AuthGate } from "@/components/AuthGate";
import { DataProvider } from "@/components/DataProvider";
import { BottomNav, Sidebar } from "@/components/Nav";
import { ServiceWorker } from "@/components/ServiceWorker";

export const metadata: Metadata = {
  title: "NuKava CRM",
  description: "Track NuKava relationships and bottle gifting.",
  manifest: "/manifest.json",
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/apple-touch-icon.png",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "NuKava CRM",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0e0f",
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
              <div className="flex min-h-screen">
                <Sidebar />
                <main className="flex-1 pb-24 md:pb-8">{children}</main>
              </div>
              <BottomNav />
            </DataProvider>
          </AuthGate>
          <ServiceWorker />
        </AuthProvider>
      </body>
    </html>
  );
}
