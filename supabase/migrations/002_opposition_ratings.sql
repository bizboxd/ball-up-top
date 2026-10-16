-- Who Cooked: opposition ratings (Pro extra).
-- Players may also rate the other team. Those ratings are shown separately in the app
-- and are left out of the "everyone has voted" count that triggers an early reveal.

create or replace function public.game_revealed(gid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select g.status = 'final' and g.final_at is not null and (
    g.final_at <= now() - interval '24 hours'
    or (
      select count(*) from public.ratings r
      where r.game_id = g.id and (
        r.target = 'ref'
        or ((g.team_a->'playerIds') ? r.rater_id::text and (g.team_a->'playerIds') ? r.target)
        or ((g.team_b->'playerIds') ? r.rater_id::text and (g.team_b->'playerIds') ? r.target)
      )
    ) >= (
      coalesce(jsonb_array_length(g.team_a->'playerIds'), 0) * (coalesce(jsonb_array_length(g.team_a->'playerIds'), 0) - 1)
      + coalesce(jsonb_array_length(g.team_b->'playerIds'), 0) * (coalesce(jsonb_array_length(g.team_b->'playerIds'), 0) - 1)
      + case when g.ref is not null
          then coalesce(jsonb_array_length(g.team_a->'playerIds'), 0) + coalesce(jsonb_array_length(g.team_b->'playerIds'), 0)
          else 0 end
    )
  )
  from public.games g where g.id = gid;
$$;

-- Teammates (never yourself), the ref, or (Pro, checked in the app) the other team.
create or replace function public.can_rate(g public.games, rater uuid, tgt text)
returns boolean language sql stable as $$
  select g.status = 'final' and not public.game_revealed(g.id) and (
    (g.team_a->'playerIds') ? rater::text or (g.team_b->'playerIds') ? rater::text
  ) and (
    (tgt = 'ref' and g.ref is not null and coalesce(g.ref->>'userId', '') <> rater::text)
    or (tgt <> 'ref' and tgt <> rater::text
        and ((g.team_a->'playerIds') ? tgt or (g.team_b->'playerIds') ? tgt))
  );
$$;
