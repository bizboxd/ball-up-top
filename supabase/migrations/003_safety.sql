-- Who Cooked: reporting and blocking (App Store guideline 1.2 for user-generated content).

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('comment', 'user')),
  target_id text not null,
  reason text not null default '',
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.reports enable row level security;
drop policy if exists "file a report" on public.reports;
create policy "file a report" on public.reports for insert to authenticated with check (reporter = auth.uid());
-- No select policy: reports are only visible in the Supabase dashboard (Table Editor > reports).

create table if not exists public.blocks (
  blocker uuid not null references public.profiles(id) on delete cascade,
  blocked uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked),
  check (blocker <> blocked)
);
alter table public.blocks enable row level security;
drop policy if exists "see your blocks" on public.blocks;
drop policy if exists "block someone" on public.blocks;
drop policy if exists "unblock someone" on public.blocks;
create policy "see your blocks" on public.blocks for select to authenticated using (blocker = auth.uid());
create policy "block someone" on public.blocks for insert to authenticated with check (blocker = auth.uid());
create policy "unblock someone" on public.blocks for delete to authenticated using (blocker = auth.uid());
