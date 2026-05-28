import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import Sidebar from "../components/Sidebar";
import TopBar from "../components/TopBar";

export const metadata: Metadata = {
  title: "KendraBindu AI — AI Mail Tracking & Sending Platform",
  description: "Premium AI-powered email intelligence dashboard for enterprise growth teams.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/* Matte background scene */}
        <div className="bg-scene">
          <div className="bg-mesh" />
          <div className="bg-orb bg-orb-1" />
          <div className="bg-orb bg-orb-2" />
          <div className="bg-orb bg-orb-3" />
          <div className="bg-noise" />
        </div>

        {/* Layout */}
        <div className="app-shell">
          <Sidebar />
          <div className="app-main-wrap">
            <TopBar />
            <main className="app-main">
              {children}
            </main>
          </div>
        </div>

        <Toaster
          position="bottom-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: "rgba(8, 8, 8, 0.96)",
              color: "var(--text)",
              border: "1px solid var(--border-hov)",
              borderRadius: "14px",
              fontSize: "13px",
              padding: "14px 18px",
              backdropFilter: "blur(18px)",
              boxShadow: "0 16px 48px rgba(0,0,0,0.6)",
            },
            success: { iconTheme: { primary: "#F4F4F4", secondary: "#090909" } },
            error: { iconTheme: { primary: "#A8A8A8", secondary: "#090909" } },
          }}
        />
      </body>
    </html>
  );
}
