/**
 * Next.js Proxy (this is what used to be called "middleware" before Next.js 16).
 * Runs before every matched request and keeps the Supabase session fresh.
 */
import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Run on everything except static files, images and API routes
  // (the API route checks auth itself).
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
