import type { ReactNode } from "react";
import { ThemeToggle } from "./ThemeToggle";

type PublicPageShellProps = {
  children: ReactNode;
};

export function PublicPageShell({ children }: PublicPageShellProps) {
  return (
    <div className="public-page">
      <header className="public-header glass-surface">
        <ThemeToggle />
      </header>
      {children}
    </div>
  );
}
