/**
 * Session refresh, run by /proxy.ts (Next.js 16's new name for middleware) on
 * every page request:
 *  1. Refreshes the Supabase auth token if it is about to expire and writes the
 *     new cookies to the response.
 *  2. Redirects signed-out visitors away from private pages, and signed-in
 *     users away from /login and /signup.
 * This is a convenience redirect only — real security is RLS in the database.
 */
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getSupabaseEnv, hasSupabaseEnv } from "@/lib/env";
import type { Database } from "@/types/database";

const PUBLIC_PATHS = ["/login", "/signup", "/auth"];

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (!hasSupabaseEnv()) return response; // lets the app boot to show a setup error

  const { url, anonKey } = getSupabaseEnv();
  const supabase = createServerClient<Database>(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        Object.entries(headers ?? {}).forEach(([key, value]) => response.headers.set(key, value));
      },
    },
  });

  // IMPORTANT: don't run code between createServerClient and getClaims().
  const { data } = await supabase.auth.getClaims();
  const isSignedIn = Boolean(data?.claims?.sub);

  const path = request.nextUrl.pathname;
  const isPublic = path === "/" || PUBLIC_PATHS.some((p) => path.startsWith(p));
  const isAuthPage = path.startsWith("/login") || path.startsWith("/signup");

  const redirectTo = (pathname: string, keepNext = false) => {
    const target = request.nextUrl.clone();
    target.pathname = pathname;
    target.search = keepNext ? `?next=${encodeURIComponent(path)}` : "";
    const redirect = NextResponse.redirect(target);
    // Carry over any refreshed auth cookies.
    response.cookies.getAll().forEach((c) => redirect.cookies.set(c));
    return redirect;
  };

  if (!isSignedIn && !isPublic) return redirectTo("/login", true);
  if (isSignedIn && (isAuthPage || path === "/")) return redirectTo("/boards");
  if (!isSignedIn && path === "/") return redirectTo("/login");

  return response;
}
