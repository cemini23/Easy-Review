import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";
import Image from "next/image";
import "./globals.css";
import { cn } from "@/lib/utils";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "EasyReview by Cemini",
  description: "Micro-SaaS for high-end restaurant operations",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className={cn(inter.className, "h-full bg-gray-50 text-gray-900")}>
        <div className="flex flex-col min-h-screen">
          <header className="sticky top-0 z-50 w-full border-b bg-white shadow-sm">
            <div className="container flex h-16 items-center justify-between px-4 mx-auto">
              <Link href="/" className="flex items-center gap-2 group">
                <div className="relative w-8 h-8 overflow-hidden rounded-lg border border-gray-200 shadow-sm">
                  <Image 
                    src="/logo.png" 
                    alt="Logo" 
                    fill
                    className="object-cover"
                  />
                </div>
                <div>
                  <div className="font-bold text-base leading-none text-gray-900">EasyReview</div>
                  <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">By Cemini</div>
                </div>
              </Link>
              <nav className="flex items-center space-x-6">
                <Link href="/" className="text-sm font-semibold text-gray-600 hover:text-indigo-600 transition-colors">Reviews</Link>
                <Link href="/guests" className="text-sm font-semibold text-gray-600 hover:text-indigo-600 transition-colors">VIPs</Link>
                <Link href="/settings" className="text-sm font-semibold text-gray-600 hover:text-indigo-600 transition-colors">Settings</Link>
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