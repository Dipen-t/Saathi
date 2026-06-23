import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

import { AlertProvider } from "@/components/AlertProvider";

export const metadata: Metadata = {
  title: "Saath - Meet your local scene",
  description: "Find people nearby to do things with.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className={`min-h-full flex flex-col ${outfit.className}`}>
        <AlertProvider>
          {children}
        </AlertProvider>
      </body>
    </html>
  );
}
