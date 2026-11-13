import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  can,
  canEditContent,
  countOwners,
  isReadOnly,
  isRole,
  PERMISSION_MATRIX,
  ROLES,
  wouldRemoveLastOwner,
  type Permission,
  type Role,
} from "@/lib/permissions";

/** The expected matrix, written out by hand (same as docs/rbac.md). */
const EXPECTED: Record<Role, Permission[]> = {
  viewer: ["board:read", "members:read", "ai:summary"],
  member: [
    "board:read",
    "members:read",
    "ai:summary",
    "list:create",
    "list:edit",
    "list:move",
    "list:delete",
    "card:create",
    "card:edit",
    "card:move",
    "card:delete",
  ],
  owner: Object.keys(PERMISSION_MATRIX) as Permission[],
};

describe("permission matrix", () => {
  for (const role of ROLES) {
    for (const permission of Object.keys(PERMISSION_MATRIX) as Permission[]) {
      const allowed = EXPECTED[role].includes(permission);
      it(`${role} ${allowed ? "CAN" : "cannot"} ${permission}`, () => {
        expect(can(role, permission)).toBe(allowed);
      });
    }
  }

  it("non-members (no role) can do nothing", () => {
    for (const permission of Object.keys(PERMISSION_MATRIX) as Permission[]) {
      expect(can(null, permission)).toBe(false);
      expect(can(undefined, permission)).toBe(false);
    }
  });

  it("each role is a superset of the one below it", () => {
    const allowed = (role: Role) =>
      (Object.keys(PERMISSION_MATRIX) as Permission[]).filter((p) => can(role, p));
    expect(allowed("member")).toEqual(expect.arrayContaining(allowed("viewer")));
    expect(allowed("owner")).toEqual(expect.arrayContaining(allowed("member")));
  });
});

describe("helpers", () => {
  it("canEditContent / isReadOnly", () => {
    expect(canEditContent("owner")).toBe(true);
    expect(canEditContent("member")).toBe(true);
    expect(canEditContent("viewer")).toBe(false);
    expect(isReadOnly("viewer")).toBe(true);
    expect(isReadOnly(null)).toBe(true);
  });

  it("isRole only accepts the three roles", () => {
    expect(isRole("owner")).toBe(true);
    expect(isRole("admin")).toBe(false);
    expect(isRole(undefined)).toBe(false);
  });
});

describe("last-owner protection (mirrors the SQL trigger)", () => {
  const oneOwner = [
    { user_id: "a", role: "owner" as Role },
    { user_id: "b", role: "member" as Role },
  ];
  const twoOwners = [...oneOwner, { user_id: "c", role: "owner" as Role }];

  it("counts owners", () => {
    expect(countOwners(oneOwner)).toBe(1);
    expect(countOwners(twoOwners)).toBe(2);
  });
  it("blocks removing or demoting the only owner", () => {
    expect(wouldRemoveLastOwner(oneOwner, "a", null)).toBe(true);
    expect(wouldRemoveLastOwner(oneOwner, "a", "viewer")).toBe(true);
  });
  it("allows it when another owner exists", () => {
    expect(wouldRemoveLastOwner(twoOwners, "a", "member")).toBe(false);
  });
  it("never blocks non-owners or keeping the owner role", () => {
    expect(wouldRemoveLastOwner(oneOwner, "b", null)).toBe(false);
    expect(wouldRemoveLastOwner(oneOwner, "a", "owner")).toBe(false);
  });
});

describe("UI matrix matches the database policies", () => {
  const sql = readFileSync(
    path.resolve(__dirname, "../supabase/migrations/20261113000000_init.sql"),
    "utf8",
  );
  const policy = (name: string) => {
    const match = sql.match(new RegExp(`create policy "${name}"[\\s\\S]*?;`));
    if (!match) throw new Error(`policy not found: ${name}`);
    return match[0];
  };

  it("lists/cards writes use can_edit_board (owner + member)", () => {
    for (const name of [
      "lists: editors can create",
      "cards: editors can update",
      "cards: editors can delete",
    ]) {
      expect(policy(name)).toContain("can_edit_board");
    }
    expect(PERMISSION_MATRIX["card:edit"]).toEqual(["owner", "member"]);
  });

  it("board + member management use is_board_owner (owner only)", () => {
    for (const name of [
      "boards: owners can update",
      "boards: owners can delete",
      "board_members: owners can add",
      "board_members: owners can change roles",
    ]) {
      expect(policy(name)).toContain("is_board_owner");
    }
    expect(PERMISSION_MATRIX["members:invite"]).toEqual(["owner"]);
  });

  it("reads use is_board_member (all roles)", () => {
    for (const name of [
      "boards: members can read",
      "lists: members can read",
      "cards: members can read",
    ]) {
      expect(policy(name)).toContain("is_board_member");
    }
    expect(PERMISSION_MATRIX["board:read"]).toEqual(["owner", "member", "viewer"]);
  });
});
