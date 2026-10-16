-- Who Cooked: reserved usernames (exact match, case-insensitive).
-- "messi" is reserved; "messi10" or "leo.messi" are allowed. Same list as reserved.js.

create table if not exists public.reserved_usernames (name text primary key);
alter table public.reserved_usernames enable row level security;
-- No policies: only reachable through the function below.

insert into public.reserved_usernames (name) values
  ('aaronjudge'),
  ('admin'),
  ('administrator'),
  ('ajawilson'),
  ('alexmorgan'),
  ('alisson'),
  ('alphonsodavies'),
  ('angelreese'),
  ('anonymous'),
  ('antman'),
  ('barkley'),
  ('beckham'),
  ('bellingham'),
  ('benzema'),
  ('bizboxd'),
  ('bonmati'),
  ('booker'),
  ('boskovic'),
  ('brady'),
  ('breannastewart'),
  ('bronny'),
  ('brunson'),
  ('buffon'),
  ('caitlinclark'),
  ('casillas'),
  ('colepalmer'),
  ('courtois'),
  ('cr7'),
  ('cristiano'),
  ('cristianoronaldo'),
  ('cruyff'),
  ('curry'),
  ('dame'),
  ('damianlillard'),
  ('debruyne'),
  ('dembele'),
  ('devinbooker'),
  ('djokovic'),
  ('doncic'),
  ('drogba'),
  ('duncan'),
  ('durant'),
  ('dwyanewade'),
  ('earvinngapeth'),
  ('edenhazard'),
  ('egonu'),
  ('embiid'),
  ('erlinghaaland'),
  ('everyone'),
  ('federer'),
  ('figo'),
  ('foden'),
  ('garnett'),
  ('gavi'),
  ('gerrard'),
  ('giannis'),
  ('giba'),
  ('griezmann'),
  ('haaland'),
  ('haliburton'),
  ('harden'),
  ('harrykane'),
  ('hazard'),
  ('help'),
  ('ibrahimovic'),
  ('iniesta'),
  ('irving'),
  ('iverson'),
  ('jamesharden'),
  ('jamorant'),
  ('jaysontatum'),
  ('jimmybutler'),
  ('jokic'),
  ('jordan'),
  ('julianalvarez'),
  ('kaka'),
  ('kante'),
  ('karch'),
  ('karchkiraly'),
  ('kareem'),
  ('kawhi'),
  ('kd'),
  ('kdb'),
  ('kevindurant'),
  ('kingjames'),
  ('kirakaraly'),
  ('kobe'),
  ('kobebryant'),
  ('kurek'),
  ('kvaratskhelia'),
  ('kylianmbappe'),
  ('kyrie'),
  ('lamineyamal'),
  ('lampard'),
  ('larrybird'),
  ('lautaro'),
  ('lebron'),
  ('lebronjames'),
  ('leomessi'),
  ('lewandowski'),
  ('lillard'),
  ('lionelmessi'),
  ('luissuarez'),
  ('luka'),
  ('lukadoncic'),
  ('magicjohnson'),
  ('mahomes'),
  ('maradona'),
  ('martinelli'),
  ('mbappe'),
  ('mcgregor'),
  ('mckennie'),
  ('melissavargas'),
  ('messi'),
  ('michaeljordan'),
  ('mj'),
  ('mod'),
  ('moderator'),
  ('modric'),
  ('morant'),
  ('mosalah'),
  ('musiala'),
  ('nadal'),
  ('neuer'),
  ('neymar'),
  ('neymarjr'),
  ('ngapeth'),
  ('nowitzki'),
  ('null'),
  ('odegaard'),
  ('official'),
  ('ohtani'),
  ('olajuwon'),
  ('osimhen'),
  ('paolaegonu'),
  ('patrickmahomes'),
  ('pedri'),
  ('pele'),
  ('phelps'),
  ('pippen'),
  ('pirlo'),
  ('pogba'),
  ('pulisic'),
  ('putellas'),
  ('puyol'),
  ('rapinoe'),
  ('rashford'),
  ('ref'),
  ('referee'),
  ('rivaldo'),
  ('rodman'),
  ('rodri'),
  ('ronaldinho'),
  ('ronaldo'),
  ('rooney'),
  ('root'),
  ('sadiomane'),
  ('saka'),
  ('salah'),
  ('serena'),
  ('serenawilliams'),
  ('sergioramos'),
  ('sga'),
  ('shai'),
  ('shaq'),
  ('shaquille'),
  ('simonebiles'),
  ('sonheungmin'),
  ('sportsboxd'),
  ('staff'),
  ('stephcurry'),
  ('stephencurry'),
  ('suarez'),
  ('support'),
  ('system'),
  ('tatum'),
  ('taurasi'),
  ('team'),
  ('thierryhenry'),
  ('tigerwoods'),
  ('timduncan'),
  ('tombrady'),
  ('totti'),
  ('undefined'),
  ('usainbolt'),
  ('valverde'),
  ('vandijk'),
  ('vini'),
  ('vinicius'),
  ('viniciusjr'),
  ('wembanyama'),
  ('wemby'),
  ('westbrook'),
  ('who_cooked'),
  ('whocooked'),
  ('whocookedapp'),
  ('wilfredoleon'),
  ('wilt'),
  ('wirtz'),
  ('xavi'),
  ('yamal'),
  ('zaytsev'),
  ('zhuting'),
  ('zidane'),
  ('zion'),
  ('zlatan')
on conflict do nothing;

create or replace function public.username_reserved(u text)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.reserved_usernames where name = lower(trim(u)));
$$;
grant execute on function public.username_reserved(text) to anon, authenticated;

-- Block picking a reserved username (temporary Google/phone usernames are never exact matches).
create or replace function public.block_reserved_username()
returns trigger language plpgsql as $$
begin
  if (tg_op = 'INSERT' or new.username is distinct from old.username) and public.username_reserved(new.username) then
    raise exception 'That username is taken.' using errcode = '23505';
  end if;
  return new;
end $$;

drop trigger if exists profiles_reserved_username on public.profiles;
create trigger profiles_reserved_username before insert or update of username on public.profiles
  for each row execute function public.block_reserved_username();

-- Email sign-up with a reserved name: give a temporary username instead of failing the sign-up;
-- the player then picks a real one on first login.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  picked text := meta->>'username';
  chose boolean := meta ? 'username';
  base text;
begin
  if picked is not null and public.username_reserved(picked) then
    picked := null;
    chose := false;
  end if;
  -- Email sign-ups choose a username up front. Google and phone sign-ups get a
  -- temporary unique one and pick their real username on first login.
  if picked is null then
    base := lower(regexp_replace(coalesce(split_part(new.email, '@', 1), ''), '[^a-zA-Z0-9_.]', '', 'g'));
    if length(base) < 3 then base := 'player'; end if;
    picked := left(base, 14) || '_' || substr(replace(new.id::text, '-', ''), 1, 5);
  end if;

  insert into public.profiles (id, username, display_name, avatar_url, onboarded, color)
  values (
    new.id,
    picked,
    coalesce(meta->>'display_name', meta->>'full_name', meta->>'name', meta->>'username', 'Player'),
    meta->>'avatar_url',
    chose,
    (array['#c6ff3d','#38bdf8','#f97316','#a78bfa','#f472b6','#facc15','#2dd4bf','#fb7185','#818cf8','#4ade80'])[1 + floor(random() * 10)::int]
  )
  on conflict (id) do nothing;
  return new;
end $$;
