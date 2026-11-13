import { Logo } from "@/components/layout/logo";
import { ThemeToggle } from "@/components/layout/theme-toggle";

/** Shared layout for /login and /signup. */
export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="relative flex min-h-dvh flex-col">
      {/* soft background glow */}
      <div
        aria-hidden
        className="from-primary/10 pointer-events-none absolute inset-x-0 top-0 -z-10 h-80 bg-gradient-to-b to-transparent"
      />
      <header className="flex h-14 items-center justify-between px-4 sm:px-6">
        <Logo href="/login" />
        <ThemeToggle />
      </header>
      <main className="flex flex-1 items-start justify-center px-4 pt-6 pb-16 sm:items-center sm:pt-0">
        {children}
      </main>
    </div>
  );
}
