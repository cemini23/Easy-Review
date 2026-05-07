import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { cn } from "@/lib/utils";

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
            <div className="container flex h-16 items-center justify-between px-4 mx-auto">
              <div className="font-bold text-xl tracking-tight text-indigo-600">
                EASY REVIEW
              </div>
              <nav className="flex items-center space-x-4">
                <Link href="/" className="text-sm font-medium text-slate-700 hover:text-indigo-600 transition-colors">Reviews</Link>
              </nav>
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