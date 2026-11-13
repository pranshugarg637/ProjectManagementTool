# Role-based access control (RBAC)

Every board has members, and every member has exactly one role: **owner**, **member** or **viewer**.
Someone who is not a member of a board can't see it at all.

## Permission matrix

| Action                                       | Viewer | Member | Owner |
| -------------------------------------------- | :----: | :----: | :---: |
| See the board, its lists, cards and members  |   ✅   |   ✅   |  ✅   |
| See the activity log                         |   ✅   |   ✅   |  ✅   |
| Generate the AI summary                      |   ✅   |   ✅   |  ✅   |
| Create / rename / reorder / delete **lists** |   ❌   |   ✅   |  ✅   |
| Create / edit / move / delete **cards**      |   ❌   |   ✅   |  ✅   |
| Rename / delete the **board**                |   ❌   |   ❌   |  ✅   |
| Invite people by email                       |   ❌   |   ❌   |  ✅   |
| Change someone's role                        |   ❌   |   ❌   |  ✅   |
| Remove a member                              |   ❌   |   ❌   |  ✅   |
| Leave the board yourself                     |   ✅   |   ✅   | ✅\*  |
| **Non-members**: anything at all             |   —    |   —    |   —   |

\* The **last owner** can't leave, be removed or be demoted — a board always keeps at least one
owner. Promote someone else to owner first.

## Where it is enforced

1. **Database (the real security)** — `supabase/migrations/20261113000000_init.sql`
   - Row Level Security is enabled on **every** table. Anything not allowed by a policy is denied.
   - Helper functions (all `security definer`, `stable`) look up the current user's role:

     | Function                 | Returns `true` for       | Used by                                      |
     | ------------------------ | ------------------------ | -------------------------------------------- |
     | `get_board_role(board)`  | returns the role or NULL | everything below                             |
     | `is_board_member(board)` | owner, member, viewer    | all SELECT policies                          |
     | `can_edit_board(board)`  | owner, member            | INSERT/UPDATE/DELETE on `lists` and `cards`  |
     | `is_board_owner(board)`  | owner                    | UPDATE/DELETE on `boards`, writes on members |

   - `invite_member(board, email, role)` — owner only; finds the user in `profiles` by email (users
     can edit only their own `full_name`, never their email) and
     returns a clear error if they haven't signed up yet.
   - `protect_last_owner` trigger — blocks removing/demoting the last owner.
   - `cards_before_write` trigger — copies `board_id` from the parent list, so a card can't be
     "smuggled" into a board you don't belong to.
   - `activity_log` has **no** insert/update/delete policy: only database triggers write to it.

2. **Server** — Server Actions (`lib/actions/*`) validate input with Zod and then run queries
   _as the signed-in user_, so RLS applies. If RLS silently filters a row out, the action returns
   "You don't have permission to do that."

3. **UI** — `lib/permissions.ts` mirrors the matrix so the interface can hide what you can't do:
   viewers get no drag handles, no "Add card/list" buttons, a read-only card dialog and a
   **Read-only** badge; only owners see the **Share** button.

The UI is a convenience only. Even if someone edits the JavaScript in their browser, the database
still refuses the change.

## How it is tested

- `tests/rls.test.ts` runs the real migration inside an in-memory Postgres (PGlite), signs in as
  owner / member / viewer / a stranger / an anonymous visitor, and checks every row of the table
  above (42 tests), including "you can't change your own email to hijack an invite".
- `tests/permissions.test.ts` checks the UI matrix and that it matches the SQL policies.
