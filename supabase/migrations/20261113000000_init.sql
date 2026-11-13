-- =============================================================================
-- Flowboard — initial schema
-- -----------------------------------------------------------------------------
-- Paste this whole file into Supabase → SQL Editor → "New query" → Run.
-- It is safe to run on a brand-new project. It creates:
--   1. Tables: profiles, boards, board_members, lists, cards, activity_log,
--      board_ai_usage (rate-limit bookkeeping for the AI summary)
--   2. Triggers: auto-create profile on sign-up, auto-add board creator as owner,
--      keep cards.board_id in sync, updated_at stamps, "last owner" protection,
--      activity log (audit trail)
--   3. Role helpers: get_board_role(), is_board_member(), can_edit_board(),
--      is_board_owner()
--   4. RPCs: invite_member(), rebalance_list_cards(), rebalance_board_lists(),
--      claim_ai_summary_slot()
--   5. Row Level Security policies on EVERY table (the real permission system)
--   6. Realtime: adds lists/cards/boards/board_members to supabase_realtime
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. TABLES
-- -----------------------------------------------------------------------------

-- One row per signed-up user (mirror of auth.users that the app can query).
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null unique,
  full_name   text,
  created_at  timestamptz not null default now()
);

create table public.boards (
  id           uuid primary key default gen_random_uuid(),
  title        text not null check (char_length(title) between 1 and 100),
  description  text check (char_length(description) <= 1000),
  -- The creator. Ownership itself lives in board_members (a board can have
  -- several owners); owner_id is kept for "created by" display/audit.
  owner_id     uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create table public.board_members (
  board_id    uuid not null references public.boards (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  role        text not null check (role in ('owner', 'member', 'viewer')),
  created_at  timestamptz not null default now(),
  primary key (board_id, user_id)
);

create table public.lists (
  id          uuid primary key default gen_random_uuid(),
  board_id    uuid not null references public.boards (id) on delete cascade,
  title       text not null check (char_length(title) between 1 and 100),
  -- Fractional ordering: see README "How drag-and-drop ordering works".
  position    double precision not null,
  created_at  timestamptz not null default now()
);

create table public.cards (
  id           uuid primary key default gen_random_uuid(),
  list_id      uuid not null references public.lists (id) on delete cascade,
  -- Denormalised for fast RLS checks + realtime filtering. Always copied from
  -- the parent list by a trigger, so a client can never spoof it.
  board_id     uuid not null references public.boards (id) on delete cascade,
  title        text not null check (char_length(title) between 1 and 200),
  description  text check (char_length(description) <= 5000),
  position     double precision not null,
  due_date     date,
  labels       text[] not null default '{}',
  created_by   uuid default auth.uid() references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- Simple audit trail, written ONLY by database triggers (users cannot insert).
create table public.activity_log (
  id          bigint generated always as identity primary key,
  board_id    uuid not null references public.boards (id) on delete cascade,
  user_id     uuid references public.profiles (id) on delete set null,
  action      text not null,
  details     jsonb not null default '{}'::jsonb,
  created_at  timestamptz not null default now()
);

-- Last time an AI summary was requested per board (server-side rate limit that
-- works across all Vercel serverless instances). No policies = no direct access.
create table public.board_ai_usage (
  board_id           uuid primary key references public.boards (id) on delete cascade,
  last_requested_at  timestamptz not null
);

-- Indexes for the queries the app runs (by board, by list, ordered by position).
create index board_members_user_id_idx on public.board_members (user_id);
create index lists_board_id_position_idx on public.lists (board_id, position);
create index cards_list_id_position_idx on public.cards (list_id, position);
create index cards_board_id_idx on public.cards (board_id);
create index activity_log_board_id_created_at_idx on public.activity_log (board_id, created_at desc);
create index boards_owner_id_idx on public.boards (owner_id);
create index cards_created_by_idx on public.cards (created_by);
create index activity_log_user_id_idx on public.activity_log (user_id);

-- -----------------------------------------------------------------------------
-- 2. ROLE HELPER FUNCTIONS
-- security definer = they run with the function owner's rights, so they can
-- read board_members without triggering board_members' own RLS (this avoids
-- the classic "infinite recursion in policy" problem).
-- stable = Postgres may cache the result within one statement.
-- -----------------------------------------------------------------------------

-- Returns 'owner' | 'member' | 'viewer' for the CURRENT user, or NULL.
create or replace function public.get_board_role(p_board_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select bm.role
  from public.board_members bm
  where bm.board_id = p_board_id
    and bm.user_id = auth.uid();
$$;

create or replace function public.is_board_member(p_board_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.get_board_role(p_board_id) is not null;
$$;

-- owner or member → may create/edit/move/delete lists and cards.
create or replace function public.can_edit_board(p_board_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.get_board_role(p_board_id) in ('owner', 'member'), false);
$$;

create or replace function public.is_board_owner(p_board_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(public.get_board_role(p_board_id) = 'owner', false);
$$;

-- True if the current user and p_user_id are on at least one common board
-- (used so members can see each other's name/email, but nobody else's).
create or replace function public.shares_board_with(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.board_members mine
    join public.board_members theirs on theirs.board_id = mine.board_id
    where mine.user_id = auth.uid()
      and theirs.user_id = p_user_id
  );
$$;

-- -----------------------------------------------------------------------------
-- 3. TRIGGERS
-- -----------------------------------------------------------------------------

-- 3a. Create a profile row whenever someone signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    lower(new.email),
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 3b. Boards: the creator becomes the first owner automatically.
create or replace function public.handle_new_board()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.owner_id is not null then
    insert into public.board_members (board_id, user_id, role)
    values (new.id, new.owner_id, 'owner')
    on conflict (board_id, user_id) do update set role = 'owner';
  end if;
  return new;
end;
$$;

create trigger on_board_created
  after insert on public.boards
  for each row execute function public.handle_new_board();

-- Boards: owner_id (creator) can never be changed after insert.
create or replace function public.boards_before_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.owner_id := old.owner_id;
  new.created_at := old.created_at;
  new.updated_at := now();
  return new;
end;
$$;

create trigger boards_before_update
  before update on public.boards
  for each row execute function public.boards_before_update();

-- 3c. Lists can't be moved to another board.
create or replace function public.lists_before_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.board_id := old.board_id;
  return new;
end;
$$;

create trigger lists_before_update
  before update on public.lists
  for each row execute function public.lists_before_update();

-- 3d. Cards: board_id is ALWAYS copied from the parent list; created_by is
-- set on insert and frozen afterwards.
create or replace function public.cards_before_write()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_board_id uuid;
begin
  select l.board_id into v_board_id from public.lists l where l.id = new.list_id;
  if v_board_id is null then
    raise exception 'List not found' using errcode = 'P0002';
  end if;
  new.board_id := v_board_id;

  if tg_op = 'INSERT' then
    new.created_by := coalesce(auth.uid(), new.created_by);
  else
    new.created_by := old.created_by;
    new.created_at := old.created_at;
    new.updated_at := now();
  end if;
  return new;
end;
$$;

create trigger cards_before_write
  before insert or update on public.cards
  for each row execute function public.cards_before_write();

-- 3e. Board members: only the role may change, and a board must ALWAYS keep at
-- least one owner (blocks removing or demoting the last owner).
create or replace function public.protect_last_owner()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_other_owners integer;
begin
  if tg_op = 'UPDATE' then
    new.board_id := old.board_id;
    new.user_id := old.user_id;
    new.created_at := old.created_at;
  end if;

  -- Only relevant when an owner is being removed or demoted.
  if old.role <> 'owner' or (tg_op = 'UPDATE' and new.role = 'owner') then
    return coalesce(new, old);
  end if;

  -- Allow the cascade when the whole board (or the user's account) is deleted.
  if not exists (select 1 from public.boards where id = old.board_id)
     or not exists (select 1 from public.profiles where id = old.user_id) then
    return coalesce(new, old);
  end if;

  select count(*) into v_other_owners
  from public.board_members
  where board_id = old.board_id
    and role = 'owner'
    and user_id <> old.user_id;

  if v_other_owners = 0 then
    raise exception 'A board must keep at least one owner. Make someone else an owner first.'
      using errcode = 'P0001';
  end if;

  return coalesce(new, old);
end;
$$;

create trigger board_members_protect_last_owner
  before update or delete on public.board_members
  for each row execute function public.protect_last_owner();

-- -----------------------------------------------------------------------------
-- 3f. ACTIVITY LOG (audit trail) — written by triggers, never by clients.
-- -----------------------------------------------------------------------------
create or replace function public.write_activity(p_board_id uuid, p_action text, p_details jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Skip when the board itself is being deleted (cascade) — nothing to log to.
  if not exists (select 1 from public.boards where id = p_board_id) then
    return;
  end if;
  insert into public.activity_log (board_id, user_id, action, details)
  values (
    p_board_id,
    (select id from public.profiles where id = auth.uid()),
    p_action,
    coalesce(p_details, '{}'::jsonb)
  );
end;
$$;

-- Internal helper: only triggers should call it.
revoke execute on function public.write_activity(uuid, text, jsonb) from public, anon, authenticated;

create or replace function public.log_card_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.write_activity(new.board_id, 'card.created',
      jsonb_build_object('card_id', new.id, 'title', new.title, 'list_id', new.list_id));
  elsif tg_op = 'UPDATE' then
    if new.list_id <> old.list_id then
      perform public.write_activity(new.board_id, 'card.moved',
        jsonb_build_object('card_id', new.id, 'title', new.title,
          'from_list_id', old.list_id, 'to_list_id', new.list_id));
    elsif (new.title, coalesce(new.description, ''), new.due_date, new.labels)
          is distinct from (old.title, coalesce(old.description, ''), old.due_date, old.labels) then
      perform public.write_activity(new.board_id, 'card.updated',
        jsonb_build_object('card_id', new.id, 'title', new.title));
    end if;
    -- Pure position changes (reordering within a list) are not logged: too noisy.
  elsif tg_op = 'DELETE' then
    -- If the parent list is being deleted, the list deletion is logged instead.
    if exists (select 1 from public.lists where id = old.list_id) then
      perform public.write_activity(old.board_id, 'card.deleted',
        jsonb_build_object('card_id', old.id, 'title', old.title));
    end if;
  end if;
  return null;
end;
$$;

create trigger cards_activity
  after insert or update or delete on public.cards
  for each row execute function public.log_card_activity();

create or replace function public.log_list_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    perform public.write_activity(new.board_id, 'list.created',
      jsonb_build_object('list_id', new.id, 'title', new.title));
  elsif tg_op = 'UPDATE' and new.title <> old.title then
    perform public.write_activity(new.board_id, 'list.renamed',
      jsonb_build_object('list_id', new.id, 'from', old.title, 'to', new.title));
  elsif tg_op = 'DELETE' then
    perform public.write_activity(old.board_id, 'list.deleted',
      jsonb_build_object('list_id', old.id, 'title', old.title));
  end if;
  return null;
end;
$$;

create trigger lists_activity
  after insert or update or delete on public.lists
  for each row execute function public.log_list_activity();

create or replace function public.log_member_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
begin
  select email into v_email from public.profiles where id = coalesce(new.user_id, old.user_id);
  if tg_op = 'INSERT' then
    perform public.write_activity(new.board_id, 'member.added',
      jsonb_build_object('email', v_email, 'role', new.role));
  elsif tg_op = 'UPDATE' and new.role <> old.role then
    perform public.write_activity(new.board_id, 'member.role_changed',
      jsonb_build_object('email', v_email, 'from', old.role, 'to', new.role));
  elsif tg_op = 'DELETE' then
    perform public.write_activity(old.board_id, 'member.removed',
      jsonb_build_object('email', v_email, 'role', old.role));
  end if;
  return null;
end;
$$;

create trigger board_members_activity
  after insert or update or delete on public.board_members
  for each row execute function public.log_member_activity();

create or replace function public.log_board_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.title <> old.title then
    perform public.write_activity(new.id, 'board.renamed',
      jsonb_build_object('from', old.title, 'to', new.title));
  end if;
  return null;
end;
$$;

create trigger boards_activity
  after update on public.boards
  for each row execute function public.log_board_activity();

-- -----------------------------------------------------------------------------
-- 4. RPC FUNCTIONS (called from the app with supabase.rpc(...))
-- -----------------------------------------------------------------------------

-- Invite an existing user to a board by email. Owner only.
create or replace function public.invite_member(p_board_id uuid, p_email text, p_role text)
returns public.board_members
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid;
  v_row public.board_members;
begin
  if auth.uid() is null then
    raise exception 'You must be signed in.' using errcode = '42501';
  end if;
  if not public.is_board_owner(p_board_id) then
    raise exception 'Only board owners can invite people.' using errcode = '42501';
  end if;
  if p_role not in ('owner', 'member', 'viewer') then
    raise exception 'Role must be owner, member or viewer.' using errcode = '22023';
  end if;

  select id into v_user_id from public.profiles where email = lower(trim(p_email));
  if v_user_id is null then
    raise exception 'No account found for %. Ask them to sign up first, then invite them again.',
      lower(trim(p_email)) using errcode = 'P0002';
  end if;

  if exists (select 1 from public.board_members where board_id = p_board_id and user_id = v_user_id) then
    raise exception '% is already on this board.', lower(trim(p_email)) using errcode = '23505';
  end if;

  insert into public.board_members (board_id, user_id, role)
  values (p_board_id, v_user_id, p_role)
  returning * into v_row;

  return v_row;
end;
$$;

-- Re-space all cards in a list to 1000, 2000, 3000… keeping their order.
-- security INVOKER: runs as the caller, so RLS still decides if it's allowed.
create or replace function public.rebalance_list_cards(p_list_id uuid)
returns void
language sql
security invoker
set search_path = public
as $$
  update public.cards c
  set position = r.rn * 1000
  from (
    select id, row_number() over (order by position, created_at, id) as rn
    from public.cards
    where list_id = p_list_id
  ) r
  where c.id = r.id;
$$;

create or replace function public.rebalance_board_lists(p_board_id uuid)
returns void
language sql
security invoker
set search_path = public
as $$
  update public.lists l
  set position = r.rn * 1000
  from (
    select id, row_number() over (order by position, created_at, id) as rn
    from public.lists
    where board_id = p_board_id
  ) r
  where l.id = r.id;
$$;

-- AI summary rate limit: 1 request per board per 30 seconds (fixed in SQL so a
-- client can't pass a smaller cooldown). Returns 0 when allowed, otherwise the
-- number of seconds to wait.
create or replace function public.claim_ai_summary_slot(p_board_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cooldown constant interval := interval '30 seconds';
  v_wait integer;
begin
  if not public.is_board_member(p_board_id) then
    raise exception 'You are not a member of this board.' using errcode = '42501';
  end if;

  insert into public.board_ai_usage as u (board_id, last_requested_at)
  values (p_board_id, now())
  on conflict (board_id) do update
    set last_requested_at = excluded.last_requested_at
    where u.last_requested_at <= now() - v_cooldown;

  if found then
    return 0;
  end if;

  select ceil(extract(epoch from (last_requested_at + v_cooldown - now())))::integer
  into v_wait
  from public.board_ai_usage
  where board_id = p_board_id;

  return greatest(coalesce(v_wait, 1), 1);
end;
$$;

-- -----------------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY
-- Every table has RLS on. Anything not explicitly allowed below is denied.
-- `(select auth.uid())` is wrapped in a sub-select so Postgres evaluates it
-- once per query instead of once per row (Supabase performance advice).
-- -----------------------------------------------------------------------------
alter table public.profiles       enable row level security;
alter table public.boards         enable row level security;
alter table public.board_members  enable row level security;
alter table public.lists          enable row level security;
alter table public.cards          enable row level security;
alter table public.activity_log   enable row level security;
alter table public.board_ai_usage enable row level security;

-- PROFILES: see yourself + people you share a board with. Edit only yourself.
create policy "profiles: read self and board-mates"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.shares_board_with(id));

create policy "profiles: update self"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Users may only change their display name. The email column is trusted by
-- invite_member(), so letting people edit it would allow claiming someone
-- else's address before they sign up.
revoke update on public.profiles from anon, authenticated;
grant update (full_name) on public.profiles to authenticated;

-- BOARDS
create policy "boards: members can read"
  on public.boards for select to authenticated
  using (public.is_board_member(id));

create policy "boards: signed-in users can create their own"
  on public.boards for insert to authenticated
  with check (owner_id = (select auth.uid()));

create policy "boards: owners can update"
  on public.boards for update to authenticated
  using (public.is_board_owner(id))
  with check (public.is_board_owner(id));

create policy "boards: owners can delete"
  on public.boards for delete to authenticated
  using (public.is_board_owner(id));

-- BOARD MEMBERS
create policy "board_members: members can read"
  on public.board_members for select to authenticated
  using (public.is_board_member(board_id));

create policy "board_members: owners can add"
  on public.board_members for insert to authenticated
  with check (public.is_board_owner(board_id));

create policy "board_members: owners can change roles"
  on public.board_members for update to authenticated
  using (public.is_board_owner(board_id))
  with check (public.is_board_owner(board_id));

create policy "board_members: owners remove anyone, anyone can leave"
  on public.board_members for delete to authenticated
  using (public.is_board_owner(board_id) or user_id = (select auth.uid()));

-- LISTS
create policy "lists: members can read"
  on public.lists for select to authenticated
  using (public.is_board_member(board_id));

create policy "lists: editors can create"
  on public.lists for insert to authenticated
  with check (public.can_edit_board(board_id));

create policy "lists: editors can update"
  on public.lists for update to authenticated
  using (public.can_edit_board(board_id))
  with check (public.can_edit_board(board_id));

create policy "lists: editors can delete"
  on public.lists for delete to authenticated
  using (public.can_edit_board(board_id));

-- CARDS (board_id is trusted because the trigger copies it from the list;
-- WITH CHECK runs after BEFORE triggers, so it checks the real board.)
create policy "cards: members can read"
  on public.cards for select to authenticated
  using (public.is_board_member(board_id));

create policy "cards: editors can create"
  on public.cards for insert to authenticated
  with check (public.can_edit_board(board_id));

create policy "cards: editors can update"
  on public.cards for update to authenticated
  using (public.can_edit_board(board_id))
  with check (public.can_edit_board(board_id));

create policy "cards: editors can delete"
  on public.cards for delete to authenticated
  using (public.can_edit_board(board_id));

-- ACTIVITY LOG: read-only for members. No insert/update/delete policies, so
-- only the security-definer triggers above can write to it.
create policy "activity_log: members can read"
  on public.activity_log for select to authenticated
  using (public.is_board_member(board_id));

-- BOARD_AI_USAGE: intentionally no policies (only claim_ai_summary_slot uses it).

-- Lock down function execution: helpers callable by signed-in users only.
revoke execute on function public.invite_member(uuid, text, text) from public, anon;
revoke execute on function public.claim_ai_summary_slot(uuid) from public, anon;
revoke execute on function public.rebalance_list_cards(uuid) from public, anon;
revoke execute on function public.rebalance_board_lists(uuid) from public, anon;
grant execute on function public.invite_member(uuid, text, text) to authenticated;
grant execute on function public.claim_ai_summary_slot(uuid) to authenticated;
grant execute on function public.rebalance_list_cards(uuid) to authenticated;
grant execute on function public.rebalance_board_lists(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 6. REALTIME — broadcast row changes for these tables. Realtime respects RLS,
-- so users only receive changes for boards they belong to.
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    foreach t in array array['boards', 'board_members', 'lists', 'cards'] loop
      if not exists (
        select 1 from pg_publication_tables
        where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
      ) then
        execute format('alter publication supabase_realtime add table public.%I', t);
      end if;
    end loop;
  end if;
end;
$$;
