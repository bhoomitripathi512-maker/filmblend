"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type HeaderVariant = "minimal" | "results";

type HeaderVariantContextValue = {
  variant: HeaderVariant;
  setVariant: (variant: HeaderVariant) => void;
};

const HeaderVariantContext = createContext<HeaderVariantContextValue | null>(
  null,
);

export function HeaderVariantProvider({ children }: { children: ReactNode }) {
  const [variant, setVariant] = useState<HeaderVariant>("minimal");

  const value = useMemo(
    () => ({
      variant,
      setVariant,
    }),
    [variant],
  );

  return (
    <HeaderVariantContext.Provider value={value}>
      {children}
    </HeaderVariantContext.Provider>
  );
}

export function useSetHeaderVariant() {
  const context = useContext(HeaderVariantContext);
  if (!context) {
    throw new Error("useSetHeaderVariant must be used within HeaderVariantProvider");
  }
  return context.setVariant;
}

function FilmblendMark() {
  return (
    <Link
      href="/"
      aria-label="Filmblend home"
      className="flex items-center gap-2.5 text-[16px] font-extrabold tracking-[-0.045em]"
    >
      <span>FILMBLEND</span>
      <span className="mark" aria-hidden="true">
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
      </span>
    </Link>
  );
}

export function SiteHeader() {
  const pathname = usePathname();
  const context = useContext(HeaderVariantContext);
  const isHome = pathname === "/";
  const isBlendPage = pathname.startsWith("/blend/");
  const showResultsHeader =
    isBlendPage && context?.variant === "results";

  if (isHome || (isBlendPage && !showResultsHeader)) {
    return (
      <header className="fixed inset-x-0 top-0 z-50 flex h-14 items-center justify-center border-b border-ink bg-paper px-5 sm:px-7">
        <FilmblendMark />
      </header>
    );
  }

  return (
    <header className="fixed inset-x-0 top-0 z-50 grid h-14 grid-cols-[1fr_auto_1fr] items-center border-b border-ink bg-paper px-5 sm:px-7">
      <FilmblendMark />
      <nav
        aria-label="Sections"
        className="hidden justify-center gap-5 text-[11px] uppercase tracking-[0.09em] md:flex"
      >
        <a href="#blend" className="opacity-70 hover:opacity-100">
          Blend
        </a>
        <a href="#films" className="opacity-70 hover:opacity-100">
          Films
        </a>
        <a href="#taste" className="opacity-70 hover:opacity-100">
          Taste
        </a>
        <a href="#recs" className="opacity-70 hover:opacity-100">
          Picks
        </a>
        <a href="#resync" className="opacity-70 hover:opacity-100">
          Re-sync
        </a>
      </nav>
      <div className="flex items-center justify-end gap-3">
        <Link href="/" className="btn fill">
          New blend
        </Link>
      </div>
    </header>
  );
}

export function useSyncHeaderVariant(variant: HeaderVariant) {
  const setVariant = useSetHeaderVariant();

  useEffect(() => {
    setVariant(variant);
    return () => setVariant("minimal");
  }, [setVariant, variant]);
}
