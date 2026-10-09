-- Exercises with history are archived, never deleted.
alter table public.exercises add column archived boolean not null default false;

alter table public.set_logs drop constraint set_logs_exercise_id_fkey;
alter table public.set_logs add constraint set_logs_exercise_id_fkey
  foreign key (exercise_id) references public.exercises(id) on delete restrict;

-- Per-user unit label.
alter table public.profiles add column unit text not null default 'lb' check (unit in ('lb','kg'));
grant update (unit) on public.profiles to authenticated;
