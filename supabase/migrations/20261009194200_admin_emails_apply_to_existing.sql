-- Adding an email to the admin list also promotes an account that already exists.
create or replace function private.apply_admin_email()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.profiles set is_admin = true where lower(email) = new.email;
  return new;
end;
$$;
revoke execute on function private.apply_admin_email() from public, anon, authenticated;
create trigger admin_emails_apply
  after insert on private.admin_emails
  for each row execute function private.apply_admin_email();
