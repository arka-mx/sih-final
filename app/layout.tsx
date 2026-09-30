import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  weight: "variable",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  weight: "variable",
});

export const metadata: Metadata = {
  title: "APIx — Airfare Price Index",
  description: "National CPI Augmentation Engine for Transport & Communication — Ministry of Statistics & Programme Implementation (MoSPI)",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={cn("h-full", "antialiased", geistSans.className, geistMono.variable, "font-san", )}
    >
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
