-- First sign-in creates the account.
-- Trade roles and Operator are approved immediately.
-- Planner, Supervisor, and Admin stay pending and can read until approved.

create or replace function app_private.can_read()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and (
        p.status = 'approved'
        or (p.status = 'pending' and p.role in ('Planner', 'Supervisor', 'Admin'))
      )
  );
$$;

create or replace function app_private.create_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  person text := btrim(coalesce(new.raw_user_meta_data->>'display_name', ''));
  requested text := btrim(coalesce(new.raw_user_meta_data->>'requested_role', ''));
  next_status text;
begin
  if length(person) < 2 then
    raise exception 'Enter your full name';
  end if;
  if not app_private.allowed_role(requested, true) then
    raise exception 'Choose a role from the list';
  end if;
  next_status := case when requested in ('Planner', 'Supervisor', 'Admin') then 'pending' else 'approved' end;
  insert into public.profiles (id, display_name, role, requested_role, status)
  values (new.id, person, requested, requested, next_status);
  return new;
end;
$$;
