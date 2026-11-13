/**
 * Turn Postgres / Supabase errors into short, human messages.
 * Our SQL functions raise friendly messages themselves (e.g. "A board must keep
 * at least one owner"), so those are passed through as-is.
 */
type PgLikeError = { code?: string; message?: string } | null | undefined;

export function friendlyDbError(error: PgLikeError, fallback = "Something went wrong"): string {
  if (!error) return fallback;
  switch (error.code) {
    case "42501": // insufficient_privilege / RLS violation
      return error.message && !error.message.includes("row-level security")
        ? error.message
        : "You don't have permission to do that.";
    case "P0001": // raise exception from our triggers
    case "P0002": // not found (our invite_member)
    case "22023": // invalid parameter (our invite_member)
    case "23505": // unique violation (already a member)
      return error.message ?? fallback;
    case "23514": // check constraint
      return "That value isn't allowed (too long or empty).";
    case "PGRST116": // .single() found no rows
      return "Not found, or you don't have access.";
    default:
      return error.message || fallback;
  }
}
