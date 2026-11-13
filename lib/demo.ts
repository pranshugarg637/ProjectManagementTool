/**
 * Public demo accounts for reviewers (also listed in the README).
 * These are intentionally public test credentials — not secrets. They only
 * work after you create the users in Supabase (see README → Demo accounts).
 */
export const DEMO_PASSWORD = "DemoPass123!";

export const DEMO_ACCOUNTS = [
  { email: "owner@demo.app", role: "owner", blurb: "Full control, can share & manage roles" },
  { email: "member@demo.app", role: "member", blurb: "Can create, edit and move cards & lists" },
  {
    email: "viewer@demo.app",
    role: "viewer",
    blurb: "Read-only — sees everything, changes nothing",
  },
] as const;
