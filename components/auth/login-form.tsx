"use client";

import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import { Loader2Icon, LogInIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn, type AuthFormState } from "@/lib/actions/auth";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "@/lib/demo";

export function LoginForm({ next, notice }: { next?: string; notice?: string }) {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(signIn, {});
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

  /** "Try demo": fill the form with a demo account and submit it. */
  function signInAsDemo(demoEmail: string) {
    setEmail(demoEmail);
    setPassword(DEMO_PASSWORD);
    // wait one tick so React has written the values into the inputs
    setTimeout(() => formRef.current?.requestSubmit(), 0);
  }

  return (
    <div className="w-full max-w-sm space-y-6">
      <div className="space-y-1.5 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
        <p className="text-muted-foreground text-sm">Sign in to your boards</p>
      </div>

      <form
        ref={formRef}
        action={formAction}
        className="bg-card space-y-4 rounded-xl border p-6 shadow-sm"
      >
        <input type="hidden" name="next" value={next ?? ""} />
        {notice && (
          <p className="rounded-md bg-amber-500/10 px-3 py-2 text-sm text-amber-800 dark:text-amber-300">
            {notice}
          </p>
        )}
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        {state.error && (
          <p role="alert" className="text-destructive text-sm">
            {state.error}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? <Loader2Icon className="animate-spin" /> : <LogInIcon />}
          Sign in
        </Button>
        <p className="text-muted-foreground text-center text-sm">
          No account?{" "}
          <Link
            href="/signup"
            className="text-foreground font-medium underline-offset-4 hover:underline"
          >
            Sign up
          </Link>
        </p>
      </form>

      {/* Try demo */}
      <section
        aria-labelledby="demo-heading"
        className="space-y-3 rounded-xl border border-dashed p-4"
      >
        <div>
          <h2 id="demo-heading" className="text-sm font-semibold">
            Try the demo
          </h2>
          <p className="text-muted-foreground text-xs">
            One click signs you in. Password for all three:{" "}
            <code className="font-mono">{DEMO_PASSWORD}</code>
          </p>
        </div>
        <ul className="space-y-2">
          {DEMO_ACCOUNTS.map((account) => (
            <li key={account.email}>
              <button
                type="button"
                disabled={pending}
                onClick={() => signInAsDemo(account.email)}
                className="bg-card hover:bg-accent flex w-full items-center gap-3 rounded-lg border px-3 py-2 text-left text-sm transition-colors disabled:opacity-50"
              >
                <Badge variant={account.role}>{account.role}</Badge>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{account.email}</span>
                  <span className="text-muted-foreground block truncate text-xs">
                    {account.blurb}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
