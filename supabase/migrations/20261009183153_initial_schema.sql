-- ============ Tables ============
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null default '',
  display_name text,
  is_admin boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  notes text,
  created_at timestamptz not null default now()
);
create unique index exercises_name_unique on public.exercises (lower(trim(name)));

create table public.workouts (
  id uuid primary key default gen_random_uuid(),
  scheduled_date date not null,
  title text not null default 'Workout',
  notes text,
  created_at timestamptz not null default now()
);
create index workouts_date_idx on public.workouts (scheduled_date);

create table public.workout_exercises (
  id uuid primary key default gen_random_uuid(),
  workout_id uuid not null references public.workouts(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete restrict,
  position int not null default 0,
  target_sets int not null default 3 check (target_sets between 1 and 20),
  target_reps text,
  notes text
);
create index workout_exercises_workout_idx on public.workout_exercises (workout_id, position);
create index workout_exercises_exercise_idx on public.workout_exercises (exercise_id);

-- One row per set a user logs. exercise_id and workout_date are copied from the
-- workout by a trigger so history survives if the admin later edits/deletes the workout.
create table public.set_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  workout_exercise_id uuid references public.workout_exercises(id) on delete set null,
  exercise_id uuid not null references public.exercises(id) on delete cascade,
  workout_date date not null,
  set_number int not null check (set_number between 1 and 50),
  weight numeric(7,2) check (weight >= 0),
  reps int check (reps between 0 and 1000),
  updated_at timestamptz not null default now(),
  constraint set_logs_unique_set unique (user_id, workout_exercise_id, set_number)
);
create index set_logs_user_exercise_date_idx on public.set_logs (user_id, exercise_id, workout_date desc);
create index set_logs_user_date_idx on public.set_logs (user_id, workout_date);
create index set_logs_workout_exercise_idx on public.set_logs (workout_exercise_id);
create index set_logs_exercise_idx on public.set_logs (exercise_id);

-- ============ Helper functions ============
create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = (select auth.uid())), false);
$$;
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- New sign-up -> profile row. The very first user becomes admin.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, is_admin)
  values (new.id, coalesce(new.email, ''), not exists (select 1 from public.profiles where is_admin));
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Fill exercise_id / workout_date on set_logs from the workout, and stamp updated_at.
create or replace function public.set_logs_fill()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if new.workout_exercise_id is not null then
    select we.exercise_id, w.scheduled_date
      into new.exercise_id, new.workout_date
    from public.workout_exercises we
    join public.workouts w on w.id = we.workout_id
    where we.id = new.workout_exercise_id;
    if new.exercise_id is null then
      raise exception 'Unknown workout exercise %', new.workout_exercise_id;
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
create trigger set_logs_fill_trg
  before insert or update on public.set_logs
  for each row execute function public.set_logs_fill();

-- Keep copied fields in sync when an admin moves a workout's date or swaps an exercise.
create or replace function public.sync_logs_on_workout_date()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.set_logs sl
     set workout_date = new.scheduled_date
    from public.workout_exercises we
   where we.id = sl.workout_exercise_id and we.workout_id = new.id;
  return new;
end;
$$;
revoke execute on function public.sync_logs_on_workout_date() from public, anon, authenticated;
create trigger workouts_date_sync
  after update of scheduled_date on public.workouts
  for each row when (old.scheduled_date is distinct from new.scheduled_date)
  execute function public.sync_logs_on_workout_date();

create or replace function public.sync_logs_on_exercise_swap()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.set_logs set exercise_id = new.exercise_id where workout_exercise_id = new.id;
  return new;
end;
$$;
revoke execute on function public.sync_logs_on_exercise_swap() from public, anon, authenticated;
create trigger workout_exercises_swap_sync
  after update of exercise_id on public.workout_exercises
  for each row when (old.exercise_id is distinct from new.exercise_id)
  execute function public.sync_logs_on_exercise_swap();

-- For each exercise, the caller's most recent session strictly before p_before.
create or replace function public.previous_sets(p_exercise_ids uuid[], p_before date)
returns table (exercise_id uuid, workout_date date, set_number int, weight numeric, reps int)
language sql stable security invoker set search_path = ''
as $$
  with latest as (
    select distinct on (sl.exercise_id) sl.exercise_id, sl.workout_date, sl.workout_exercise_id
    from public.set_logs sl
    where sl.user_id = (select auth.uid())
      and sl.exercise_id = any(p_exercise_ids)
      and sl.workout_date < p_before
      and sl.weight is not null
    order by sl.exercise_id, sl.workout_date desc, sl.updated_at desc
  )
  select sl.exercise_id, sl.workout_date, sl.set_number, sl.weight, sl.reps
  from public.set_logs sl
  join latest l
    on l.exercise_id = sl.exercise_id
   and l.workout_date = sl.workout_date
   and l.workout_exercise_id is not distinct from sl.workout_exercise_id
  where sl.user_id = (select auth.uid())
  order by sl.exercise_id, sl.set_number;
$$;
revoke execute on function public.previous_sets(uuid[], date) from public, anon;
grant execute on function public.previous_sets(uuid[], date) to authenticated;

-- Admins promote/demote other users.
create or replace function public.set_admin(p_user_id uuid, p_is_admin boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'Only admins can change admin access';
  end if;
  if p_user_id = (select auth.uid()) and not p_is_admin then
    raise exception 'You cannot remove your own admin access';
  end if;
  update public.profiles set is_admin = p_is_admin where id = p_user_id;
end;
$$;
revoke execute on function public.set_admin(uuid, boolean) from public, anon;
grant execute on function public.set_admin(uuid, boolean) to authenticated;

-- ============ Row level security ============
alter table public.profiles enable row level security;
alter table public.exercises enable row level security;
alter table public.workouts enable row level security;
alter table public.workout_exercises enable row level security;
alter table public.set_logs enable row level security;

-- profiles: see yourself (admins see everyone); edit only your display name
create policy "profiles read" on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_admin()));
create policy "profiles update self" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
revoke insert, update, delete on public.profiles from anon, authenticated;
grant update (display_name) on public.profiles to authenticated;

-- catalog tables: everyone signed in reads, admins write
create policy "exercises read" on public.exercises for select to authenticated using (true);
create policy "exercises admin insert" on public.exercises for insert to authenticated with check ((select public.is_admin()));
create policy "exercises admin update" on public.exercises for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "exercises admin delete" on public.exercises for delete to authenticated using ((select public.is_admin()));

create policy "workouts read" on public.workouts for select to authenticated using (true);
create policy "workouts admin insert" on public.workouts for insert to authenticated with check ((select public.is_admin()));
create policy "workouts admin update" on public.workouts for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "workouts admin delete" on public.workouts for delete to authenticated using ((select public.is_admin()));

create policy "workout_exercises read" on public.workout_exercises for select to authenticated using (true);
create policy "workout_exercises admin insert" on public.workout_exercises for insert to authenticated with check ((select public.is_admin()));
create policy "workout_exercises admin update" on public.workout_exercises for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "workout_exercises admin delete" on public.workout_exercises for delete to authenticated using ((select public.is_admin()));

-- set_logs: strictly your own
create policy "set_logs own select" on public.set_logs for select to authenticated using (user_id = (select auth.uid()));
create policy "set_logs own insert" on public.set_logs for insert to authenticated with check (user_id = (select auth.uid()));
create policy "set_logs own update" on public.set_logs for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "set_logs own delete" on public.set_logs for delete to authenticated using (user_id = (select auth.uid()));

-- anon gets nothing
revoke all on public.profiles, public.exercises, public.workouts, public.workout_exercises, public.set_logs from anon;
