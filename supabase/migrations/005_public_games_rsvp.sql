-- Player cap (set by the game's creator), public games on the nearby map, and "maybe" RSVPs.
alter table public.games add column if not exists cap int;
alter table public.games drop constraint if exists games_cap_check;
alter table public.games add constraint games_cap_check check (cap is null or (cap between 2 and 100));
alter table public.games add column if not exists is_public boolean not null default false;
alter table public.games add column if not exists lat double precision;
alter table public.games add column if not exists lng double precision;
create index if not exists games_public_idx on public.games (is_public, played_on) where is_public;

alter table public.rsvps drop constraint if exists rsvps_status_check;
alter table public.rsvps add constraint rsvps_status_check check (status in ('in', 'out', 'maybe'));
