import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Yggdrasil — Asgard Dashboard",
  description: "Real-time monitoring dashboard for Asgard multi-agent system",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" className="dark">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="bg-bg-primary min-h-screen antialiased">
        {children}
      </body>
    </html>
  );
}
