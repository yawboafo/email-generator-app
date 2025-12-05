import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";
import "@/lib/startWorkers"; // Auto-start workers

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "The Second Coming - Email Management Platform",
  description: "Professional email generation, verification, and management suite. Generate verified emails, manage batches, and automate email workflows with AI-powered tools.",
  keywords: ["email generator", "email verification", "bulk email", "verified emails", "email management", "email automation"],
  authors: [{ name: "The Second Coming Team" }],
  creator: "The Second Coming",
  publisher: "The Second Coming",
  applicationName: "The Second Coming Email Platform",
  icons: {
    icon: '/favicon.ico',
    apple: '/favicon.ico',
  },
  openGraph: {
    title: "The Second Coming - Email Management Platform",
    description: "Professional email generation, verification, and management suite",
    type: "website",
    siteName: "The Second Coming",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  );
}
