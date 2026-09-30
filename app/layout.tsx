import type { Metadata } from "next";
import { Inter, IBM_Plex_Mono, Source_Serif_4 } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
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
      className={cn("h-full", "antialiased", inter.variable, plexMono.variable, sourceSerif.variable, "font-sans")}
    >
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
