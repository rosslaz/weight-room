-- Caller's logged exercises with session count, last date, best and most recent top weight.
create or replace function public.my_exercise_summary()
returns table (exercise_id uuid, name text, sessions bigint, last_date date, best_weight numeric, last_top_weight numeric)
language sql stable security invoker set search_path = ''
as $$
  with mine as (
    select sl.exercise_id, sl.workout_date, max(sl.weight) as top
    from public.set_logs sl
    where sl.user_id = (select auth.uid()) and sl.weight is not null
    group by sl.exercise_id, sl.workout_date
  )
  select m.exercise_id, e.name, count(*) as sessions, max(m.workout_date) as last_date, max(m.top) as best_weight,
         (array_agg(m.top order by m.workout_date desc))[1] as last_top_weight
  from mine m
  join public.exercises e on e.id = m.exercise_id
  group by m.exercise_id, e.name
  order by max(m.workout_date) desc, e.name;
$$;
revoke execute on function public.my_exercise_summary() from public, anon;
grant execute on function public.my_exercise_summary() to authenticated;
