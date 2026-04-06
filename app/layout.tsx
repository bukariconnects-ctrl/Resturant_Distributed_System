import type { Metadata } from "next";
import "./globals.css";
import { Geist } from "next/font/google";
import { cn } from "@/lib/utils";
import { Toaster } from "@/components/ui/sonner";
import { SyncProvider } from "@/components/providers/SyncProvider";
import { CartProvider } from "@/components/providers/CartProvider";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

export const metadata: Metadata = {
  title: "Restaurant Distributed System",
  description: "Distributed system for managing restaurant orders",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" className={cn("font-sans", geist.variable)}>
      <body className="antialiased">
        <SyncProvider>
          <CartProvider>
            {children}
          </CartProvider>
        </SyncProvider>
        <Toaster position="top-center" richColors />
      </body>
    </html>
  );
}
