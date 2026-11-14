-- =============================================================================
-- Flowboard — demo data
-- -----------------------------------------------------------------------------
-- BEFORE running this, create the 3 demo users in Supabase:
--   Authentication → Users → "Add user" → "Create new user"
--     owner@demo.app   / DemoPass123!   (tick "Auto Confirm User")
--     member@demo.app  / DemoPass123!   (tick "Auto Confirm User")
--     viewer@demo.app  / DemoPass123!   (tick "Auto Confirm User")  
-- Then paste this file into SQL Editor → Run.
--
-- Safe to run again: it deletes the old "Website Launch" demo board first.
-- Due dates are relative to today, so the demo always has overdue / upcoming work.
-- =============================================================================
do $$
declare
  v_owner  uuid;
  v_member uuid;
  v_viewer uuid;
  v_board  uuid := gen_random_uuid();
  v_backlog uuid := gen_random_uuid();
  v_todo    uuid := gen_random_uuid();
  v_doing   uuid := gen_random_uuid();
  v_done    uuid := gen_random_uuid();
begin
  select id into v_owner  from public.profiles where email = 'owner@demo.app';
  select id into v_member from public.profiles where email = 'member@demo.app';
  select id into v_viewer from public.profiles where email = 'viewer@demo.app';

  if v_owner is null or v_member is null or v_viewer is null then
    raise exception 'Create the 3 demo users first (owner@demo.app, member@demo.app, viewer@demo.app). See the comment at the top of seed.sql.';
  end if;

  -- Start fresh.
  delete from public.boards where title = 'Website Launch' and owner_id = v_owner;

  -- The board-creation trigger adds owner@demo.app as 'owner' automatically.
  insert into public.boards (id, title, description, owner_id)
  values (v_board, 'Website Launch',
          'Everything we need to ship the new marketing website by the end of the month.',
          v_owner);

  insert into public.board_members (board_id, user_id, role) values
    (v_board, v_member, 'member'),
    (v_board, v_viewer, 'viewer');

  insert into public.lists (id, board_id, title, position) values
    (v_backlog, v_board, 'Backlog',     1000),
    (v_todo,    v_board, 'To Do',       2000),
    (v_doing,   v_board, 'In Progress', 3000),
    (v_done,    v_board, 'Done',        4000);

  insert into public.cards (list_id, board_id, title, description, position, due_date, labels, created_by) values
    -- Backlog
    (v_backlog, v_board, 'Blog section with MDX',
     'Let marketing publish posts without a developer. Needs categories and an RSS feed.',
     1000, current_date + 21, array['feature', 'frontend'], v_owner),
    (v_backlog, v_board, 'Customer case study pages',
     'Template for 3 case studies. Waiting on approved quotes from customers.',
     2000, null, array['content'], v_member),
    (v_backlog, v_board, 'Localise site for German market',
     'Explore next-intl. Translation budget not approved yet.',
     3000, null, array['research'], v_owner),

    -- To Do
    (v_todo, v_board, 'Write pricing page copy',
     'Three tiers: Free, Team, Enterprise. Highlight annual discount.',
     1000, current_date + 3, array['content', 'marketing'], v_member),
    (v_todo, v_board, 'Set up analytics & cookie banner',
     'Privacy-friendly analytics. Banner must default to "reject non-essential".',
     2000, current_date + 5, array['backend', 'legal'], v_owner),
    (v_todo, v_board, 'Create Open Graph images',
     'Auto-generate OG images for every page so links look good on social media.',
     3000, current_date + 7, array['design'], v_member),
    (v_todo, v_board, 'Contact form spam protection',
     'Add a honeypot field + rate limit on the API route.',
     4000, current_date + 6, array['backend', 'security'], v_member),

    -- In Progress
    (v_doing, v_board, 'Homepage hero redesign',
     'New illustration + shorter headline. Design review with the team on Friday.',
     1000, current_date + 2, array['design', 'frontend'], v_member),
    (v_doing, v_board, 'Fix Lighthouse performance issues',
     'LCP is 3.8s on mobile. Compress hero image and lazy-load the video.',
     2000, current_date - 2, array['bug', 'urgent'], v_owner),
    (v_doing, v_board, 'Migrate DNS to new host',
     'Blocked: waiting for IT to give us access to the domain registrar.',
     3000, current_date - 1, array['blocked', 'devops'], v_owner),

    -- Done
    (v_done, v_board, 'Choose tech stack',
     'Next.js + Tailwind, hosted on Vercel.',
     1000, current_date - 14, array['research'], v_owner),
    (v_done, v_board, 'Brand colour palette & typography',
     'Signed off by the founders.',
     2000, current_date - 9, array['design'], v_member);
end;
$$;
