create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select coalesce((select p.is_admin from public.profiles p where p.id = (select auth.uid())), false);
$$;
revoke execute on function private.is_admin() from public, anon;
grant execute on function private.is_admin() to authenticated;

alter policy "profiles read" on public.profiles using (id = (select auth.uid()) or (select private.is_admin()));

alter policy "exercises admin insert" on public.exercises with check ((select private.is_admin()));
alter policy "exercises admin update" on public.exercises using ((select private.is_admin())) with check ((select private.is_admin()));
alter policy "exercises admin delete" on public.exercises using ((select private.is_admin()));

alter policy "workouts admin insert" on public.workouts with check ((select private.is_admin()));
alter policy "workouts admin update" on public.workouts using ((select private.is_admin())) with check ((select private.is_admin()));
alter policy "workouts admin delete" on public.workouts using ((select private.is_admin()));

alter policy "workout_exercises admin insert" on public.workout_exercises with check ((select private.is_admin()));
alter policy "workout_exercises admin update" on public.workout_exercises using ((select private.is_admin())) with check ((select private.is_admin()));
alter policy "workout_exercises admin delete" on public.workout_exercises using ((select private.is_admin()));

create or replace function public.set_admin(p_user_id uuid, p_is_admin boolean)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'Only admins can change admin access';
  end if;
  if p_user_id = (select auth.uid()) and not p_is_admin then
    raise exception 'You cannot remove your own admin access';
  end if;
  update public.profiles set is_admin = p_is_admin where id = p_user_id;
end;
$$;

drop function public.is_admin();
