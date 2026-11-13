import type { Metadata } from "next";
import { LoginForm } from "@/components/auth/login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : undefined;
  const notice =
    params.error === "confirm"
      ? "That confirmation link is invalid or expired. Try signing in, or sign up again."
      : undefined;
  return <LoginForm next={next} notice={notice} />;
}
