-- Personal display preferences. One row per account. Not jobs, roles, or site setup.

create table if not exists public.user_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  prefs jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_preferences enable row level security;
revoke all on public.user_preferences from public, anon;
grant select, insert, update on public.user_preferences to authenticated;

drop policy if exists user_preferences_own on public.user_preferences;
create policy user_preferences_own on public.user_preferences
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create or replace function app_private.stamp_user_preferences()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not allowed';
  end if;
  new.user_id := auth.uid();
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists stamp_user_preferences on public.user_preferences;
create trigger stamp_user_preferences
  before insert or update on public.user_preferences
  for each row execute function app_private.stamp_user_preferences();
