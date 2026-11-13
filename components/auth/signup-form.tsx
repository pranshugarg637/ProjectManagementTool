"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Loader2Icon, MailCheckIcon, UserPlusIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signUp, type AuthFormState } from "@/lib/actions/auth";

export function SignupForm() {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(signUp, {});

  if (state.message) {
    return (
      <div className="bg-card w-full max-w-sm space-y-3 rounded-xl border p-6 text-center shadow-sm">
        <MailCheckIcon className="text-primary mx-auto size-8" />
        <h1 className="text-lg font-semibold">Check your email</h1>
        <p className="text-muted-foreground text-sm">{state.message}</p>
        <Button asChild variant="outline" className="w-full">
          <Link href="/login">Back to sign in</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full max-w-sm space-y-6">
      <div className="space-y-1.5 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Create your account</h1>
        <p className="text-muted-foreground text-sm">Start organising work in minutes</p>
      </div>
      <form action={formAction} className="bg-card space-y-4 rounded-xl border p-6 shadow-sm">
        <div className="space-y-2">
          <Label htmlFor="fullName">Name</Label>
          <Input id="fullName" name="fullName" autoComplete="name" required maxLength={80} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
          />
          <p className="text-muted-foreground text-xs">At least 8 characters.</p>
        </div>
        {state.error && (
          <p role="alert" className="text-destructive text-sm">
            {state.error}
          </p>
        )}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? <Loader2Icon className="animate-spin" /> : <UserPlusIcon />}
          Create account
        </Button>
        <p className="text-muted-foreground text-center text-sm">
          Already have an account?{" "}
          <Link
            href="/login"
            className="text-foreground font-medium underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
