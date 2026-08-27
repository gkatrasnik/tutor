import type { Metadata } from "next";

import { Toaster } from "@/components/ui/sonner";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Tutor — Learn from your own material",
    template: "%s | Tutor",
  },
  description:
    "Turn private reading material into a focused course with a grounded, Socratic AI tutor.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        {children}
        <Toaster position="top-right" richColors />
      </body>
    </html>
  );
}
