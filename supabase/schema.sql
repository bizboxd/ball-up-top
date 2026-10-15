-- Ball Up Top · Supabase schema
-- Run this whole file once in your Supabase project's SQL editor.

-- ============ Profiles (one per account) ============
create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  username text unique not null check (username ~ '^[a-z0-9_.]{3,20}$'),
  display_name text not null,
  avatar_url text,
  color text not null default '#c6ff3d',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Readable before login too, so sign-up can check whether a username is taken.
create policy "profiles are public"
  on public.profiles for select to anon, authenticated using (true);
create policy "you can create your own profile"
  on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "you can edit your own profile"
  on public.profiles for update to authenticated using (id = auth.uid());

-- Create the profile automatically when someone signs up.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username, display_name, color)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'username', 'Player'),
    (array['#c6ff3d','#38bdf8','#f97316','#a78bfa','#f472b6','#facc15','#2dd4bf','#fb7185','#818cf8','#4ade80'])[1 + floor(random() * 10)::int]
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============ Games ============
-- team_a / team_b JSON: { captainId, name, playerIds[], formation, gk, slots{}, positions{}, score }
create table if not exists public.games (
  id uuid primary key default gen_random_uuid(),
  sport text not null,
  played_on date not null,
  kickoff time,
  location text,
  created_by uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'open' check (status in ('open', 'ready', 'final')),
  team_a jsonb not null,
  team_b jsonb,
  ref jsonb,
  stats jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.games enable row level security;

create policy "games are visible to signed-in users"
  on public.games for select to authenticated using (true);

create policy "creator captains team A"
  on public.games for insert to authenticated
  with check (created_by = auth.uid() and team_a->>'captainId' = auth.uid()::text and team_b is null);

-- Captains can edit their game; anyone can claim an open side as the second captain.
create policy "captains edit, anyone can claim the open side"
  on public.games for update to authenticated
  using (
    team_a->>'captainId' = auth.uid()::text
    or team_b->>'captainId' = auth.uid()::text
    or team_b is null
  )
  with check (
    team_a->>'captainId' = auth.uid()::text
    or team_b->>'captainId' = auth.uid()::text
  );

create policy "creator can delete"
  on public.games for delete to authenticated using (created_by = auth.uid());

-- ============ Ratings ============
-- target = a teammate's profile id, or 'ref'
create table if not exists public.ratings (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games(id) on delete cascade,
  rater_id uuid not null references public.profiles(id) on delete cascade,
  target text not null,
  score numeric(3,1) not null check (score >= 1 and score <= 10),
  note text,
  created_at timestamptz not null default now(),
  unique (game_id, rater_id, target)
);

alter table public.ratings enable row level security;

create policy "ratings are visible to signed-in users"
  on public.ratings for select to authenticated using (true);

-- The core rule: you only rate your own teammates (never yourself, never the
-- other team) plus the ref, and only after the final whistle.
create or replace function public.can_rate(g public.games, rater uuid, tgt text)
returns boolean language sql stable as $$
  select g.status = 'final' and (
    (
      (g.team_a->'playerIds') ? rater::text
      and (tgt = 'ref' or ((g.team_a->'playerIds') ? tgt and tgt <> rater::text))
    ) or (
      (g.team_b->'playerIds') ? rater::text
      and (tgt = 'ref' or ((g.team_b->'playerIds') ? tgt and tgt <> rater::text))
    )
  )
  and (tgt <> 'ref' or (g.ref is not null and coalesce(g.ref->>'userId', '') <> rater::text));
$$;

create policy "rate your teammates and the ref"
  on public.ratings for insert to authenticated
  with check (
    rater_id = auth.uid()
    and exists (select 1 from public.games g where g.id = game_id and public.can_rate(g, auth.uid(), target))
  );

create policy "change your own ratings"
  on public.ratings for update to authenticated
  using (rater_id = auth.uid())
  with check (
    rater_id = auth.uid()
    and exists (select 1 from public.games g where g.id = game_id and public.can_rate(g, auth.uid(), target))
  );

-- ============ Profile pictures ============
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

create policy "anyone can view avatars"
  on storage.objects for select using (bucket_id = 'avatars');
create policy "upload your own avatar"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "replace your own avatar"
  on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
