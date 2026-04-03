import type { Metadata } from "next";
import { DM_Sans, JetBrains_Mono } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";
import { Sidebar } from "@/components/layout/sidebar";

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FilingLens — European Filing Intelligence",
  description: "Search, compare and analyze Universal Registration Documents",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="fr"
      className={`${dmSans.variable} ${jetbrainsMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          <div className="flex h-screen">
            <Sidebar />
            <main className="flex-1 overflow-auto">
              <div className="p-8 lg:p-10">{children}</div>
            </main>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
