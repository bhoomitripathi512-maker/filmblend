import type { Metadata } from "next";
import "./globals.css";
import { HeaderVariantProvider, SiteHeader } from "@/components/SiteHeader";

export const metadata: Metadata = {
  title: "Filmblend",
  description:
    "Compare two Letterboxd profiles and find shared films.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full overflow-x-hidden bg-paper text-ink">
        <HeaderVariantProvider>
          <SiteHeader />
          <main className="mx-auto w-full max-w-[1440px] overflow-x-hidden pt-[var(--chrome-header)] pb-[var(--chrome-footer)]">
            {children}
          </main>
        </HeaderVariantProvider>
        <footer className="fixed inset-x-0 bottom-0 z-50 flex flex-col justify-between gap-2 border-t border-ink bg-paper px-7 py-5 text-[11px] uppercase tracking-[0.08em] text-muted sm:flex-row sm:items-center">
          <span>Not affiliated with Letterboxd or MUBI.</span>
          <span>by Aman &amp; Bhoomi</span>
          <span>Data via TMDB</span>
        </footer>
      </body>
    </html>
  );
}
