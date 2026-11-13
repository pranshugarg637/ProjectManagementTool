/**
 * Role-based access control — the UI side.
 *
 * The REAL enforcement is in Postgres (Row Level Security, see
 * supabase/migrations/*_init.sql). This file mirrors the same matrix so the UI can
 * hide buttons the user isn't allowed to press. Keep both in sync with docs/rbac.md.
 */

export const ROLES = ["owner", "member", "viewer"] as const;
export type Role = (typeof ROLES)[number];

export type Permission =
  | "board:read"
  | "board:rename"
  | "board:delete"
  | "members:read"
  | "members:invite"
  | "members:change-role"
  | "members:remove"
  | "list:create"
  | "list:edit"
  | "list:move"
  | "list:delete"
  | "card:create"
  | "card:edit"
  | "card:move"
  | "card:delete"
  | "ai:summary";

const EVERYONE: readonly Role[] = ["owner", "member", "viewer"];
const EDITORS: readonly Role[] = ["owner", "member"];
const OWNERS: readonly Role[] = ["owner"];

/** permission → roles that have it */
export const PERMISSION_MATRIX: Readonly<Record<Permission, readonly Role[]>> = {
  "board:read": EVERYONE,
  "members:read": EVERYONE,
  "ai:summary": EVERYONE,
  "list:create": EDITORS,
  "list:edit": EDITORS,
  "list:move": EDITORS,
  "list:delete": EDITORS,
  "card:create": EDITORS,
  "card:edit": EDITORS,
  "card:move": EDITORS,
  "card:delete": EDITORS,
  "board:rename": OWNERS,
  "board:delete": OWNERS,
  "members:invite": OWNERS,
  "members:change-role": OWNERS,
  "members:remove": OWNERS,
};

export function isRole(value: unknown): value is Role {
  return typeof value === "string" && (ROLES as readonly string[]).includes(value);
}

/** Can a user with `role` do `permission`? No role (non-member) → always false. */
export function can(role: Role | null | undefined, permission: Permission): boolean {
  if (!role) return false;
  return PERMISSION_MATRIX[permission].includes(role);
}

export const canEditContent = (role: Role | null | undefined) => can(role, "card:edit");
export const isReadOnly = (role: Role | null | undefined) => !canEditContent(role);

export const ROLE_LABELS: Record<Role, string> = {
  owner: "Owner",
  member: "Member",
  viewer: "Viewer",
};

export const ROLE_DESCRIPTIONS: Record<Role, string> = {
  owner: "Full control: edit content, rename/delete board, manage people",
  member: "Create, edit, move and delete lists and cards",
  viewer: "Read-only access",
};

type MemberLike = { user_id: string; role: Role };

export function countOwners(members: readonly MemberLike[]): number {
  return members.filter((m) => m.role === "owner").length;
}

/**
 * Would changing `targetUserId` to `newRole` (or removing them when newRole is
 * null) leave the board without an owner? Mirrors the protect_last_owner trigger.
 */
export function wouldRemoveLastOwner(
  members: readonly MemberLike[],
  targetUserId: string,
  newRole: Role | null,
): boolean {
  const target = members.find((m) => m.user_id === targetUserId);
  if (!target || target.role !== "owner") return false;
  if (newRole === "owner") return false;
  return countOwners(members) <= 1;
}
