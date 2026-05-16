import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";
import Nav from "@/components/Nav";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Easy Review | Local-business review responses",
  description: "Reply to Google reviews faster — wiki-backed templates + Gemini drafts",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className={cn(inter.className, "h-full bg-slate-50 text-slate-900")}>
        <div className="flex flex-col min-h-screen">
          <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white/90 backdrop-blur-md">
            <div className="container mx-auto flex flex-col gap-2 px-4 py-3 sm:h-16 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:py-0">
              <div className="shrink-0 font-bold text-xl tracking-tight text-indigo-600">
                EASY REVIEW
              </div>
              <Nav />
            </div>
          </header>
          <main className="flex-1 container mx-auto px-4 py-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}