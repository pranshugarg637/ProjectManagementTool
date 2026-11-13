/**
 * Database security tests.
 *
 * Runs the REAL migration in an in-memory Postgres (PGlite, Postgres compiled to
 * WebAssembly), with a tiny stub of Supabase's `auth` schema, then logs in as
 * different users (by switching to the `authenticated` role and setting the JWT
 * "sub" claim exactly like Supabase does) and checks every rule in docs/rbac.md.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const root = path.resolve(__dirname, "..");
const migration = readFileSync(
  path.join(root, "supabase/migrations/20261113000000_init.sql"),
  "utf8",
);
const seed = readFileSync(path.join(root, "supabase/seed.sql"), "utf8");

// Minimal imitation of what Supabase provides out of the box.
const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text not null,
    raw_user_meta_data jsonb not null default '{}'::jsonb
  );
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  grant usage on schema auth to anon, authenticated;
  grant usage on schema public to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on sequences to anon, authenticated;
  alter default privileges in schema public grant execute on functions to anon, authenticated;
  create publication supabase_realtime;
`;

let db: PGlite;
const ids: Record<string, string> = {};

/** Run SQL as a signed-in user (or anon when userId is null). */
async function as<T = Record<string, unknown>>(
  userId: string | null,
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  await db.exec(
    userId
      ? `set role authenticated; select set_config('request.jwt.claim.sub', '${userId}', false);`
      : `set role anon; select set_config('request.jwt.claim.sub', '', false);`,
  );
  try {
    const res = await db.query<T>(sql, params);
    return res.rows;
  } finally {
    await db.exec(`reset role; select set_config('request.jwt.claim.sub', '', false);`);
  }
}

/** Run SQL as the database admin (bypasses RLS, like the Supabase SQL editor). */
async function admin<T = Record<string, unknown>>(sql: string, params: unknown[] = []) {
  return (await db.query<T>(sql, params)).rows;
}

async function signUp(email: string) {
  const [row] = await admin<{ id: string }>(
    `insert into auth.users (email) values ($1) returning id`,
    [email],
  );
  return row.id;
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_STUB);
  await db.exec(migration);

  ids.owner = await signUp("owner@demo.app");
  ids.member = await signUp("member@demo.app");
  ids.viewer = await signUp("viewer@demo.app");
  ids.stranger = await signUp("stranger@example.com");

  await db.exec(seed);
  const [board] = await admin<{ id: string }>(
    `select id from public.boards where title = 'Website Launch'`,
  );
  ids.board = board.id;
  const lists = await admin<{ id: string; title: string }>(
    `select id, title from public.lists where board_id = $1 order by position`,
    [ids.board],
  );
  ids.backlog = lists[0].id;
  ids.todo = lists[1].id;
  const [card] = await admin<{ id: string }>(
    `select id from public.cards where list_id = $1 order by position limit 1`,
    [ids.todo],
  );
  ids.card = card.id;
});

afterAll(async () => {
  await db?.close();
});

describe("sign-up + seed", () => {
  it("creates a profile for every new auth user", async () => {
    const rows = await admin(`select email from public.profiles order by email`);
    expect(rows).toHaveLength(4);
  });

  it("seed creates the demo board with 4 lists, 12 cards and 3 members", async () => {
    const [{ lists, cards, members }] = await admin<{
      lists: number;
      cards: number;
      members: number;
    }>(
      `select
         (select count(*)::int from public.lists where board_id = $1) as lists,
         (select count(*)::int from public.cards where board_id = $1) as cards,
         (select count(*)::int from public.board_members where board_id = $1) as members`,
      [ids.board],
    );
    expect({ lists, cards, members }).toEqual({ lists: 4, cards: 12, members: 3 });
  });

  it("board creator was made owner by the trigger", async () => {
    const [row] = await as<{ role: string }>(
      ids.owner,
      `select public.get_board_role($1) as role`,
      [ids.board],
    );
    expect(row.role).toBe("owner");
  });
});

describe("non-members and anonymous users see nothing", () => {
  for (const table of ["boards", "lists", "cards", "board_members", "activity_log"]) {
    it(`stranger cannot read ${table}`, async () => {
      const rows = await as(ids.stranger, `select * from public.${table}`);
      expect(rows).toHaveLength(0);
    });
    it(`anon cannot read ${table}`, async () => {
      const rows = await as(null, `select * from public.${table}`);
      expect(rows).toHaveLength(0);
    });
  }

  it("stranger only sees their own profile", async () => {
    const rows = await as<{ email: string }>(ids.stranger, `select email from public.profiles`);
    expect(rows.map((r) => r.email)).toEqual(["stranger@example.com"]);
  });

  it("users can rename themselves but cannot change their email (used for invites)", async () => {
    const rows = await as<{ full_name: string }>(
      ids.stranger,
      `update public.profiles set full_name = 'Sam' where id = $1 returning full_name`,
      [ids.stranger],
    );
    expect(rows[0].full_name).toBe("Sam");
    await expect(
      as(ids.stranger, `update public.profiles set email = 'boss@example.com' where id = $1`, [
        ids.stranger,
      ]),
    ).rejects.toThrow(/permission denied/);
  });

  it("stranger cannot add a list to someone else's board", async () => {
    await expect(
      as(ids.stranger, `insert into public.lists (board_id, title, position) values ($1, 'x', 1)`, [
        ids.board,
      ]),
    ).rejects.toThrow(/row-level security/);
  });
});

describe("viewer is read-only", () => {
  it("can read the board, lists, cards and members", async () => {
    const [counts] = await as<{ b: number; l: number; c: number; m: number }>(
      ids.viewer,
      `select (select count(*)::int from public.boards) b, (select count(*)::int from public.lists) l,
              (select count(*)::int from public.cards) c, (select count(*)::int from public.board_members) m`,
    );
    expect(counts).toEqual({ b: 1, l: 4, c: 12, m: 3 });
  });

  it("can see board-mates' profiles", async () => {
    const rows = await as(ids.viewer, `select email from public.profiles`);
    expect(rows).toHaveLength(3);
  });

  it("cannot create a list or card", async () => {
    await expect(
      as(ids.viewer, `insert into public.lists (board_id, title, position) values ($1, 'x', 9)`, [
        ids.board,
      ]),
    ).rejects.toThrow(/row-level security/);
    await expect(
      as(
        ids.viewer,
        `insert into public.cards (list_id, board_id, title, position) values ($1, $2, 'x', 9)`,
        [ids.todo, ids.board],
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("cannot update, move or delete cards (0 rows affected)", async () => {
    const upd = await as(
      ids.viewer,
      `update public.cards set title = 'hacked' where id = $1 returning id`,
      [ids.card],
    );
    const mv = await as(
      ids.viewer,
      `update public.cards set list_id = $2 where id = $1 returning id`,
      [ids.card, ids.backlog],
    );
    const del = await as(ids.viewer, `delete from public.cards where id = $1 returning id`, [
      ids.card,
    ]);
    expect([upd.length, mv.length, del.length]).toEqual([0, 0, 0]);
  });

  it("cannot rename the board or invite people", async () => {
    const upd = await as(
      ids.viewer,
      `update public.boards set title = 'x' where id = $1 returning id`,
      [ids.board],
    );
    expect(upd).toHaveLength(0);
    await expect(
      as(ids.viewer, `select public.invite_member($1, 'stranger@example.com', 'viewer')`, [
        ids.board,
      ]),
    ).rejects.toThrow(/Only board owners/);
  });

  it("rebalance RPC has no effect for a viewer", async () => {
    await as(ids.viewer, `select public.rebalance_list_cards($1)`, [ids.todo]);
    const rows = await admin<{ position: number }>(
      `select position from public.cards where list_id = $1 order by position`,
      [ids.todo],
    );
    expect(rows.map((r) => r.position)).toEqual([1000, 2000, 3000, 4000]);
  });
});

describe("member can edit content but not manage the board", () => {
  it("can create a list and a card", async () => {
    const [list] = await as<{ id: string }>(
      ids.member,
      `insert into public.lists (board_id, title, position) values ($1, 'QA', 5000) returning id`,
      [ids.board],
    );
    const [card] = await as<{ id: string; created_by: string }>(
      ids.member,
      `insert into public.cards (list_id, board_id, title, position) values ($1, $2, 'Test forms', 1000)
       returning id, created_by`,
      [list.id, ids.board],
    );
    expect(card.created_by).toBe(ids.member);
    ids.qaList = list.id;
    ids.qaCard = card.id;
  });

  it("can move a card to another list and reorder it", async () => {
    const rows = await as<{ list_id: string }>(
      ids.member,
      `update public.cards set list_id = $2, position = 500 where id = $1 returning list_id`,
      [ids.qaCard, ids.todo],
    );
    expect(rows[0].list_id).toBe(ids.todo);
  });

  it("cannot spoof card.board_id (trigger copies it from the list)", async () => {
    // The app creates boards with a client-generated id and no RETURNING (see
    // lib/actions/boards.ts), because RETURNING is checked before the
    // "add creator as owner" trigger has run.
    ids.strangerBoard = crypto.randomUUID();
    await as(ids.stranger, `insert into public.boards (id, title) values ($1, 'Stranger board')`, [
      ids.strangerBoard,
    ]);
    const visible = await as(ids.stranger, `select id from public.boards where id = $1`, [
      ids.strangerBoard,
    ]);
    expect(visible).toHaveLength(1);
    const [card] = await as<{ board_id: string }>(
      ids.member,
      `insert into public.cards (list_id, board_id, title, position) values ($1, $2, 'sneaky', 1)
       returning board_id`,
      [ids.todo, ids.strangerBoard],
    );
    expect(card.board_id).toBe(ids.board);
  });

  it("cannot move a card into a board they don't belong to", async () => {
    const [list] = await admin<{ id: string }>(
      `insert into public.lists (board_id, title, position) values ($1, 'Private', 1000) returning id`,
      [ids.strangerBoard],
    );
    await expect(
      as(ids.member, `update public.cards set list_id = $2 where id = $1`, [ids.qaCard, list.id]),
    ).rejects.toThrow(/List not found|row-level security/);
  });

  it("cannot rename or delete the board", async () => {
    const upd = await as(
      ids.member,
      `update public.boards set title = 'x' where id = $1 returning id`,
      [ids.board],
    );
    const del = await as(ids.member, `delete from public.boards where id = $1 returning id`, [
      ids.board,
    ]);
    expect([upd.length, del.length]).toEqual([0, 0]);
  });

  it("cannot invite, change roles or remove other members", async () => {
    await expect(
      as(ids.member, `select public.invite_member($1, 'stranger@example.com', 'viewer')`, [
        ids.board,
      ]),
    ).rejects.toThrow(/Only board owners/);
    await expect(
      as(
        ids.member,
        `insert into public.board_members (board_id, user_id, role) values ($1, $2, 'viewer')`,
        [ids.board, ids.stranger],
      ),
    ).rejects.toThrow(/row-level security/);
    const promote = await as(
      ids.member,
      `update public.board_members set role = 'owner' where board_id = $1 and user_id = $2 returning role`,
      [ids.board, ids.member],
    );
    const remove = await as(
      ids.member,
      `delete from public.board_members where board_id = $1 and user_id = $2 returning user_id`,
      [ids.board, ids.viewer],
    );
    expect([promote.length, remove.length]).toEqual([0, 0]);
  });

  it("cannot write to the activity log directly", async () => {
    await expect(
      as(ids.member, `insert into public.activity_log (board_id, action) values ($1, 'fake')`, [
        ids.board,
      ]),
    ).rejects.toThrow(/row-level security/);
  });

  it("can delete cards and lists", async () => {
    const rows = await as(ids.member, `delete from public.lists where id = $1 returning id`, [
      ids.qaList,
    ]);
    expect(rows).toHaveLength(1);
  });
});

describe("owner manages the board", () => {
  it("can rename the board", async () => {
    const rows = await as<{ title: string }>(
      ids.owner,
      `update public.boards set title = 'Website Launch' where id = $1 returning title`,
      [ids.board],
    );
    expect(rows[0].title).toBe("Website Launch");
  });

  it("invite_member gives a clear error for unknown emails and duplicates", async () => {
    await expect(
      as(ids.owner, `select public.invite_member($1, 'nobody@example.com', 'member')`, [ids.board]),
    ).rejects.toThrow(/No account found for nobody@example.com/);
    await expect(
      as(ids.owner, `select public.invite_member($1, 'member@demo.app', 'member')`, [ids.board]),
    ).rejects.toThrow(/already on this board/);
    await expect(
      as(ids.owner, `select public.invite_member($1, 'stranger@example.com', 'admin')`, [
        ids.board,
      ]),
    ).rejects.toThrow(/Role must be/);
  });

  it("can invite by email (case-insensitive) and change roles", async () => {
    await as(ids.owner, `select public.invite_member($1, '  Stranger@Example.com ', 'viewer')`, [
      ids.board,
    ]);
    const rows = await as<{ role: string }>(
      ids.owner,
      `update public.board_members set role = 'member' where board_id = $1 and user_id = $2 returning role`,
      [ids.board, ids.stranger],
    );
    expect(rows[0].role).toBe("member");
  });

  it("can remove a member", async () => {
    const rows = await as(
      ids.owner,
      `delete from public.board_members where board_id = $1 and user_id = $2 returning user_id`,
      [ids.board, ids.stranger],
    );
    expect(rows).toHaveLength(1);
  });

  it("cannot demote or remove the LAST owner", async () => {
    await expect(
      as(
        ids.owner,
        `update public.board_members set role = 'member' where board_id = $1 and user_id = $2`,
        [ids.board, ids.owner],
      ),
    ).rejects.toThrow(/at least one owner/);
    await expect(
      as(ids.owner, `delete from public.board_members where board_id = $1 and user_id = $2`, [
        ids.board,
        ids.owner,
      ]),
    ).rejects.toThrow(/at least one owner/);
  });

  it("can step down once another owner exists", async () => {
    await as(
      ids.owner,
      `update public.board_members set role = 'owner' where board_id = $1 and user_id = $2`,
      [ids.board, ids.member],
    );
    await as(
      ids.owner,
      `update public.board_members set role = 'member' where board_id = $1 and user_id = $2`,
      [ids.board, ids.owner],
    );
    const [row] = await as<{ role: string }>(ids.owner, `select public.get_board_role($1) role`, [
      ids.board,
    ]);
    expect(row.role).toBe("member");
    // restore
    await as(
      ids.member,
      `update public.board_members set role = 'owner' where board_id = $1 and user_id = $2`,
      [ids.board, ids.owner],
    );
    await as(
      ids.owner,
      `update public.board_members set role = 'member' where board_id = $1 and user_id = $2`,
      [ids.board, ids.member],
    );
  });

  it("a viewer can leave the board themselves", async () => {
    await as(ids.owner, `select public.invite_member($1, 'stranger@example.com', 'viewer')`, [
      ids.board,
    ]);
    const rows = await as(
      ids.stranger,
      `delete from public.board_members where board_id = $1 and user_id = $2 returning user_id`,
      [ids.board, ids.stranger],
    );
    expect(rows).toHaveLength(1);
  });

  it("can rebalance positions", async () => {
    await admin(
      `update public.cards set position = 1.0000001 where list_id = $1 and position = 2000`,
      [ids.todo],
    );
    await as(ids.owner, `select public.rebalance_list_cards($1)`, [ids.todo]);
    const rows = await admin<{ position: number }>(
      `select position from public.cards where list_id = $1 order by position`,
      [ids.todo],
    );
    expect(rows.map((r) => r.position)).toEqual(rows.map((_, i) => (i + 1) * 1000));
  });
});

describe("activity log + AI rate limit", () => {
  it("records actions with the acting user", async () => {
    const rows = await as<{ action: string }>(
      ids.viewer,
      `select action from public.activity_log where board_id = $1`,
      [ids.board],
    );
    const actions = new Set(rows.map((r) => r.action));
    for (const a of [
      "card.created",
      "card.moved",
      "list.created",
      "list.deleted",
      "member.added",
      "member.role_changed",
      "member.removed",
    ]) {
      expect(actions.has(a)).toBe(true);
    }
  });

  it("allows one AI summary per board per 30 seconds, members only", async () => {
    const [first] = await as<{ wait: number }>(
      ids.viewer,
      `select public.claim_ai_summary_slot($1) as wait`,
      [ids.board],
    );
    const [second] = await as<{ wait: number }>(
      ids.owner,
      `select public.claim_ai_summary_slot($1) as wait`,
      [ids.board],
    );
    expect(first.wait).toBe(0);
    expect(second.wait).toBeGreaterThan(0);
    expect(second.wait).toBeLessThanOrEqual(30);
    await expect(
      as(ids.stranger, `select public.claim_ai_summary_slot($1)`, [ids.board]),
    ).rejects.toThrow(/not a member/);
  });
});

describe("deleting a board", () => {
  it("only an owner can delete; everything cascades (last-owner rule doesn't block it)", async () => {
    const del = await as(ids.owner, `delete from public.boards where id = $1 returning id`, [
      ids.board,
    ]);
    expect(del).toHaveLength(1);
    const [left] = await admin<{ n: number }>(
      `select (select count(*) from public.lists where board_id = $1)
            + (select count(*) from public.cards where board_id = $1)
            + (select count(*) from public.board_members where board_id = $1)
            + (select count(*) from public.activity_log where board_id = $1) as n`,
      [ids.board],
    );
    expect(Number(left.n)).toBe(0);
  });

  it("deleting a user account doesn't get stuck on the last-owner rule", async () => {
    await admin(`delete from auth.users where id = $1`, [ids.stranger]);
    const rows = await admin(`select 1 from public.profiles where id = $1`, [ids.stranger]);
    expect(rows).toHaveLength(0);
  });
});
