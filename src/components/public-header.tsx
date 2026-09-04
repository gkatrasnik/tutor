import type { ReactNode } from "react";

import { Brand } from "@/components/brand";

export function PublicHeader({ children }: { children: ReactNode }) {
  return (
    <header className="relative z-30 border-b border-border/70 bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-5 sm:px-8">
        <Brand className="text-lg" />
        <nav
          className="flex items-center gap-1.5 sm:gap-2"
          aria-label="Primary navigation"
        >
          {children}
        </nav>
      </div>
    </header>
  );
}
