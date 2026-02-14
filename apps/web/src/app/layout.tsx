import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth/auth-context";
import { QueryProvider } from "@/lib/query/query-client";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Moni - Personal Finance",
  description: "Privacy-focused personal finance management",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          <QueryProvider>{children}</QueryProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
