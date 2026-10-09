-- Admins are set by email instead of "first person to sign in".
create table private.admin_emails (
  email text primary key check (email = lower(trim(email)))
);
revoke all on private.admin_emails from public, anon, authenticated;
insert into private.admin_emails (email) values ('ross.lazar@gmail.com');

create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, is_admin)
  values (
    new.id,
    coalesce(new.email, ''),
    exists (select 1 from private.admin_emails a where a.email = lower(trim(coalesce(new.email, ''))))
  );
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- In case the account already exists.
update public.profiles p set is_admin = true
from private.admin_emails a where lower(p.email) = a.email;
