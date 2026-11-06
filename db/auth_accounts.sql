-- Real accounts: profiles, approval, and role-checked RLS.
-- Authorization lives in profiles, never in user-editable JWT metadata.

create schema if not exists app_private;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  role text not null,
  requested_role text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'deactivated')),
  acting_as text,
  approved_by uuid,
  approved_at timestamptz,
  last_sign_in_at timestamptz,
  failed_attempts integer not null default 0,
  locked_until timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists profiles_display_name_lower on public.profiles (lower(display_name));

alter table public.profiles enable row level security;

grant select on public.profiles to authenticated;

-- Seed the trade list so sign-up can offer it before anyone is signed in.
update public.app_settings
set data_source = jsonb_set(
  coalesce(data_source, '{}'::jsonb),
  '{trades}',
  '[
    {"id":"Insulator","label":"Insulators","short":"INS","color":"#5b21b6","active":true},
    {"id":"Electrician","label":"Electrical / EHT","short":"EHT","color":"#c2410c","active":true},
    {"id":"Pipefitter","label":"Pipefitters","short":"FIT","color":"#1d4ed8","active":true},
    {"id":"NDE","label":"NDE","short":"NDE","color":"#0f766e","active":true},
    {"id":"Team","label":"Team","short":"TEAM","color":"#be123c","active":true},
    {"id":"Scaffold","label":"Scaffold","short":"SCAF","color":"#a16207","active":true},
    {"id":"Crane","label":"Crane","short":"CRN","color":"#9a3412","active":true},
    {"id":"Extra","label":"Extra","short":"EX","color":"#334155","active":true},
    {"id":"Instrumentation","label":"Instrumentation","short":"INST","color":"#0369a1","active":true},
    {"id":"Boilermaker","label":"Boilermakers","short":"BM","color":"#9f1239","active":true},
    {"id":"VacTruck","label":"Vac truck","short":"VAC","color":"#155e75","active":true},
    {"id":"Labourer","label":"Labourers","short":"LBR","color":"#3f6212","active":true},
    {"id":"HVAC","label":"HVAC","short":"HVAC","color":"#3730a3","active":true}
  ]'::jsonb,
  true
)
where id = 'default'
  and (
    data_source->'trades' is null
    or jsonb_typeof(data_source->'trades') <> 'array'
    or jsonb_array_length(data_source->'trades') = 0
  );

create or replace function app_private.allowed_role(r text, allow_admin boolean)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select r is not null and length(btrim(r)) > 0 and (
    (allow_admin and r = 'Admin')
    or r in ('Planner', 'Supervisor', 'Operator')
    or exists (
      select 1
      from public.app_settings s
      cross join lateral jsonb_array_elements(coalesce(s.data_source->'trades', '[]'::jsonb)) t
      where s.id = 'default'
        and t->>'id' = r
        and coalesce(t->>'active', 'true') <> 'false'
    )
  );
$$;

create or replace function app_private.effective_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p.status is distinct from 'approved' then null
    when p.role = 'Operator' and p.acting_as is not null and p.acting_as <> 'Admin' then p.acting_as
    else p.role
  end
  from public.profiles p
  where p.id = auth.uid();
$$;

create or replace function app_private.is_approved()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles p where p.id = auth.uid() and p.status = 'approved'
  );
$$;

create or replace function app_private.real_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.role from public.profiles p where p.id = auth.uid() and p.status = 'approved';
$$;

create or replace function app_private.assert_can_manage(target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  caller public.profiles;
  subject public.profiles;
  eff text;
begin
  select * into caller from public.profiles where id = auth.uid();
  if caller.id is null or caller.status <> 'approved' then
    raise exception 'not allowed';
  end if;
  eff := app_private.effective_role();
  if caller.role <> 'Admin' and eff not in ('Admin', 'Planner') then
    raise exception 'not allowed';
  end if;
  select * into subject from public.profiles where id = target;
  if subject.id is null then
    raise exception 'account not found';
  end if;
  if subject.role = 'Admin' and caller.role <> 'Admin' then
    raise exception 'not allowed';
  end if;
  if target = auth.uid() and caller.role = 'Admin' then
    return;
  end if;
end;
$$;

create or replace function app_private.confirm_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.email_confirmed_at is null then
    new.email_confirmed_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists confirm_new_user on auth.users;
create trigger confirm_new_user
  before insert on auth.users
  for each row execute function app_private.confirm_new_user();

create or replace function app_private.create_profile()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  person text := btrim(coalesce(new.raw_user_meta_data->>'display_name', ''));
  requested text := btrim(coalesce(new.raw_user_meta_data->>'requested_role', ''));
  bootstrap boolean := current_setting('app.bootstrap', true) = 'yes';
begin
  if length(person) < 2 then
    raise exception 'Enter your full name';
  end if;
  if requested = 'Admin' and not bootstrap then
    raise exception 'That role cannot be requested';
  end if;
  if not app_private.allowed_role(requested, bootstrap) then
    raise exception 'Choose a role from the list';
  end if;
  insert into public.profiles (id, display_name, role, requested_role, status)
  values (new.id, person, requested, requested, 'pending');
  return new;
end;
$$;

drop trigger if exists create_profile on auth.users;
create trigger create_profile
  after insert on auth.users
  for each row execute function app_private.create_profile();

create or replace function app_private.stamp_audit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.profiles;
begin
  select * into p from public.profiles where id = auth.uid();
  if p.id is null or p.status <> 'approved' then
    raise exception 'not allowed';
  end if;
  new.actor_name := p.display_name;
  if p.role = 'Operator' and p.acting_as is not null then
    new.actor_role := 'Operator ' || p.display_name || ' acting as ' || p.acting_as;
  else
    new.actor_role := p.role;
  end if;
  return new;
end;
$$;

drop trigger if exists stamp_audit on public.audit_log;
create trigger stamp_audit
  before insert on public.audit_log
  for each row execute function app_private.stamp_audit();

create or replace function app_private.stamp_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.profiles;
begin
  select * into p from public.profiles where id = auth.uid();
  if p.id is null or p.status <> 'approved' then
    raise exception 'not allowed';
  end if;
  new.author_name := p.display_name;
  if p.role = 'Operator' and p.acting_as is not null then
    new.author_role := 'Operator ' || p.display_name || ' acting as ' || p.acting_as;
  else
    new.author_role := coalesce(app_private.effective_role(), p.role);
  end if;
  return new;
end;
$$;

drop trigger if exists stamp_comment on public.comments;
create trigger stamp_comment
  before insert on public.comments
  for each row execute function app_private.stamp_comment();

create or replace function app_private.guard_step()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  eff text := app_private.effective_role();
begin
  if current_setting('app.advancing', true) = 'yes' then
    if new.trade is distinct from old.trade
      or new.label is distinct from old.label
      or new.job_id is distinct from old.job_id
      or new.sort_order is distinct from old.sort_order
      or new.beam is distinct from old.beam
      or new.permit_holder is distinct from old.permit_holder
      or new.radio_channel is distinct from old.radio_channel
      or new.skip_reason is distinct from old.skip_reason
      or new.skipped_by is distinct from old.skipped_by
      or new.skipped_at is distinct from old.skipped_at then
      raise exception 'not allowed';
    end if;
    return new;
  end if;
  if eff in ('Admin', 'Planner') then
    return new;
  end if;
  if eff is null then
    raise exception 'not allowed';
  end if;
  if eff <> 'Supervisor' and eff is distinct from old.trade then
    raise exception 'not allowed';
  end if;
  if new.trade is distinct from old.trade
    or new.label is distinct from old.label
    or new.job_id is distinct from old.job_id
    or new.sort_order is distinct from old.sort_order
    or new.beam is distinct from old.beam then
    raise exception 'not allowed';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_step on public.steps;
create trigger guard_step
  before update on public.steps
  for each row execute function app_private.guard_step();

create or replace function app_private.guard_assignee()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  eff text := app_private.effective_role();
  step_trade text;
begin
  if eff in ('Admin', 'Planner') then
    return new;
  end if;
  select trade into step_trade from public.steps where id = old.step_id;
  if eff is null or (eff <> 'Supervisor' and eff is distinct from step_trade) then
    raise exception 'not allowed';
  end if;
  if new.step_id is distinct from old.step_id or new.person_id is distinct from old.person_id then
    raise exception 'not allowed';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_assignee on public.step_assignees;
create trigger guard_assignee
  before update on public.step_assignees
  for each row execute function app_private.guard_assignee();

-- Replace the open demo policies.
drop policy if exists settings_all on public.app_settings;
drop policy if exists tiles_all on public.app_tiles;
drop policy if exists audit_insert on public.audit_log;
drop policy if exists audit_select on public.audit_log;
drop policy if exists comments_all on public.comments;
drop policy if exists jobs_all on public.jobs;
drop policy if exists people_all on public.people;
drop policy if exists assignees_all on public.step_assignees;
drop policy if exists steps_all on public.steps;
drop policy if exists profiles_select on public.profiles;

create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or app_private.effective_role() in ('Admin', 'Planner'));

create policy jobs_select on public.jobs
  for select to authenticated
  using (app_private.is_approved());

create policy jobs_insert on public.jobs
  for insert to authenticated
  with check (app_private.effective_role() in ('Admin', 'Planner'));

create policy jobs_update on public.jobs
  for update to authenticated
  using (app_private.effective_role() in ('Admin', 'Planner', 'Supervisor'))
  with check (app_private.effective_role() in ('Admin', 'Planner', 'Supervisor'));

create policy steps_select on public.steps
  for select to authenticated
  using (app_private.is_approved());

create policy steps_insert on public.steps
  for insert to authenticated
  with check (app_private.effective_role() in ('Admin', 'Planner'));

create policy steps_update on public.steps
  for update to authenticated
  using (
    app_private.effective_role() in ('Admin', 'Planner', 'Supervisor')
    or trade = app_private.effective_role()
  )
  with check (
    app_private.effective_role() in ('Admin', 'Planner', 'Supervisor')
    or trade = app_private.effective_role()
  );

create policy assignees_select on public.step_assignees
  for select to authenticated
  using (app_private.is_approved());

create policy assignees_insert on public.step_assignees
  for insert to authenticated
  with check (app_private.effective_role() in ('Admin', 'Planner'));

create policy assignees_update on public.step_assignees
  for update to authenticated
  using (
    app_private.effective_role() in ('Admin', 'Planner', 'Supervisor')
    or exists (
      select 1 from public.steps s
      where s.id = step_assignees.step_id and s.trade = app_private.effective_role()
    )
  )
  with check (
    app_private.effective_role() in ('Admin', 'Planner', 'Supervisor')
    or exists (
      select 1 from public.steps s
      where s.id = step_assignees.step_id and s.trade = app_private.effective_role()
    )
  );

create policy comments_select on public.comments
  for select to authenticated
  using (app_private.is_approved());

create policy comments_insert on public.comments
  for insert to authenticated
  with check (
    app_private.is_approved()
    and (
      app_private.effective_role() in ('Admin', 'Planner', 'Supervisor')
      or (
        step_id is not null
        and exists (
          select 1 from public.steps s
          where s.id = step_id and s.job_id = comments.job_id and s.trade = app_private.effective_role()
        )
      )
    )
  );

create policy audit_select on public.audit_log
  for select to authenticated
  using (app_private.is_approved());

create policy audit_insert on public.audit_log
  for insert to authenticated
  with check (app_private.is_approved());

create policy settings_select on public.app_settings
  for select to authenticated
  using (app_private.is_approved());

create policy settings_write on public.app_settings
  for all to authenticated
  using (app_private.real_role() = 'Admin')
  with check (app_private.real_role() = 'Admin');

create policy tiles_select on public.app_tiles
  for select to authenticated
  using (app_private.is_approved());

create policy tiles_write on public.app_tiles
  for all to authenticated
  using (app_private.real_role() = 'Admin')
  with check (app_private.real_role() = 'Admin');

create policy people_select on public.people
  for select to authenticated
  using (app_private.is_approved());

create policy people_write on public.people
  for all to authenticated
  using (app_private.real_role() = 'Admin')
  with check (app_private.real_role() = 'Admin');

drop policy if exists comment_photos_anon_delete on storage.objects;
drop policy if exists comment_photos_anon_insert on storage.objects;
drop policy if exists comment_photos_anon_update on storage.objects;
drop policy if exists web_anon_delete on storage.objects;
drop policy if exists web_anon_update on storage.objects;
drop policy if exists web_anon_write on storage.objects;

create policy comment_photos_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'comment-photos' and app_private.is_approved());

create policy comment_photos_update on storage.objects
  for update to authenticated
  using (bucket_id = 'comment-photos' and app_private.is_approved())
  with check (bucket_id = 'comment-photos' and app_private.is_approved());

create policy comment_photos_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'comment-photos' and app_private.effective_role() in ('Admin', 'Planner'));

create or replace function public.signup_roles()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(jsonb_agg(item order by item->>'sort', item->>'label'), '[]'::jsonb)
  from (
    select jsonb_build_object('id', id, 'label', label, 'sort', sort) as item
    from (
      values
        ('Planner', 'Planner', '1'),
        ('Supervisor', 'Supervisor', '2'),
        ('Operator', 'Operator', '3')
    ) as fixed(id, label, sort)
    union all
    select jsonb_build_object('id', t->>'id', 'label', coalesce(t->>'label', t->>'id'), 'sort', '4')
    from public.app_settings s
    cross join lateral jsonb_array_elements(coalesce(s.data_source->'trades', '[]'::jsonb)) t
    where s.id = 'default' and coalesce(t->>'active', 'true') <> 'false'
  ) listed;
$$;

create or replace function public.login_guard(person text, code text)
returns text
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  p public.profiles;
  hash text;
  attempts integer;
  until_at timestamptz;
begin
  select * into p from public.profiles where lower(display_name) = lower(btrim(coalesce(person, '')));
  if p.id is null then
    return 'bad';
  end if;
  if p.status = 'deactivated' then
    return 'deactivated';
  end if;
  if p.locked_until is not null and p.locked_until > now() then
    return 'locked';
  end if;
  if p.locked_until is not null and p.locked_until <= now() then
    update public.profiles set failed_attempts = 0, locked_until = null where id = p.id;
    p.failed_attempts := 0;
    p.locked_until := null;
  end if;
  select encrypted_password into hash from auth.users where id = p.id;
  if hash is not null and hash = extensions.crypt(coalesce(code, ''), hash) then
    update public.profiles set failed_attempts = 0, locked_until = null where id = p.id;
    update auth.users set banned_until = null where id = p.id and banned_until is not null and banned_until < '9999-01-01'::timestamptz;
    return 'ok';
  end if;
  update public.profiles
  set failed_attempts = failed_attempts + 1,
      locked_until = case when failed_attempts + 1 >= 5 then now() + interval '15 minutes' else locked_until end
  where id = p.id
  returning failed_attempts, locked_until into attempts, until_at;
  if until_at is not null and until_at > now() then
    update auth.users set banned_until = until_at where id = p.id;
    return 'locked';
  end if;
  return 'bad';
end;
$$;

create or replace function public.touch_sign_in()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles set last_sign_in_at = now() where id = auth.uid();
end;
$$;

create or replace function public.set_acting_as(next_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.profiles;
  chosen text := nullif(btrim(coalesce(next_role, '')), '');
begin
  select * into p from public.profiles where id = auth.uid();
  if p.id is null or p.status <> 'approved' or p.role <> 'Operator' then
    raise exception 'not allowed';
  end if;
  if chosen is not null and (chosen = 'Admin' or not app_private.allowed_role(chosen, false)) then
    raise exception 'not allowed';
  end if;
  update public.profiles set acting_as = chosen where id = p.id;
end;
$$;

create or replace function public.manage_account(target uuid, action text, new_role text)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  subject public.profiles;
  caller_role text;
  chosen text := nullif(btrim(coalesce(new_role, '')), '');
begin
  perform app_private.assert_can_manage(target);
  select * into subject from public.profiles where id = target;
  select role into caller_role from public.profiles where id = auth.uid();
  if action = 'approve' then
    if chosen is null then chosen := coalesce(subject.requested_role, subject.role); end if;
    if chosen = 'Admin' and caller_role <> 'Admin' then raise exception 'not allowed'; end if;
    if not app_private.allowed_role(chosen, caller_role = 'Admin') then raise exception 'Choose a valid role'; end if;
    update public.profiles
    set status = 'approved', role = chosen, acting_as = case when chosen = 'Operator' then acting_as else null end,
        approved_by = auth.uid(), approved_at = now(), failed_attempts = 0, locked_until = null
    where id = target;
    update auth.users set banned_until = null where id = target;
  elsif action = 'reject' then
    update public.profiles set status = 'rejected', acting_as = null where id = target;
  elsif action = 'deactivate' then
    if target = auth.uid() then raise exception 'not allowed'; end if;
    update public.profiles set status = 'deactivated', acting_as = null where id = target;
    update auth.users set banned_until = 'infinity' where id = target;
  elsif action = 'reactivate' then
    update public.profiles set status = 'approved', failed_attempts = 0, locked_until = null where id = target;
    update auth.users set banned_until = null where id = target;
  elsif action = 'set_role' then
    if chosen is null or (chosen = 'Admin' and caller_role <> 'Admin') then raise exception 'not allowed'; end if;
    if not app_private.allowed_role(chosen, caller_role = 'Admin') then raise exception 'Choose a valid role'; end if;
    update public.profiles
    set role = chosen, acting_as = case when chosen = 'Operator' then acting_as else null end
    where id = target;
  else
    raise exception 'unknown action';
  end if;
end;
$$;

create or replace function public.reset_user_code(target uuid, new_code text)
returns void
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
begin
  perform app_private.assert_can_manage(target);
  if new_code !~ '^[0-9]{6,}$' then
    raise exception 'Code must be 6 or more digits';
  end if;
  update auth.users
  set encrypted_password = extensions.crypt(new_code, extensions.gen_salt('bf')), updated_at = now()
  where id = target;
  update public.profiles set failed_attempts = 0, locked_until = null where id = target;
  update auth.users set banned_until = null
  where id = target and banned_until is not null and banned_until < '9999-01-01'::timestamptz;
end;
$$;

create or replace function public.advance_job(target_job uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  eff text := app_private.effective_role();
  rec record;
  prev_done boolean := true;
  all_done boolean;
  any_active boolean;
begin
  if eff is null then raise exception 'not allowed'; end if;
  perform set_config('app.advancing', 'yes', true);
  if eff not in ('Admin', 'Planner', 'Supervisor') and not exists (
    select 1 from public.steps s where s.job_id = target_job and s.trade = eff
  ) then
    raise exception 'not allowed';
  end if;
  for rec in
    select s.id, s.status,
      coalesce((select bool_and(a.signed_off) and count(*) > 0 from public.step_assignees a where a.step_id = s.id), false) as all_signed,
      coalesce((select bool_or(a.signed_off) from public.step_assignees a where a.step_id = s.id), false) as any_signed
    from public.steps s
    where s.job_id = target_job
    order by s.sort_order, s.id
  loop
    if rec.status = 'skipped' then
      prev_done := true;
      continue;
    end if;
    if rec.all_signed then
      update public.steps set status = 'done' where id = rec.id and status is distinct from 'done';
      prev_done := true;
      continue;
    end if;
    if not prev_done then
      update public.steps set status = 'pending' where id = rec.id and status is distinct from 'pending';
    elsif rec.any_signed then
      update public.steps set status = 'in_progress' where id = rec.id and status is distinct from 'in_progress';
    else
      update public.steps set status = 'ready' where id = rec.id and status is distinct from 'ready';
    end if;
    prev_done := false;
  end loop;
  if exists (select 1 from public.jobs j where j.id = target_job and j.on_hold) then
    update public.jobs set status = 'on_hold', updated_at = now() where id = target_job;
    return;
  end if;
  if exists (select 1 from public.jobs j where j.id = target_job and j.completed_at is not null) then
    update public.jobs set status = 'done', updated_at = now() where id = target_job;
    return;
  end if;
  select coalesce(bool_and(status = 'done'), false), coalesce(bool_or(status in ('done', 'skipped', 'ready', 'in_progress')), false)
    into all_done, any_active
  from public.steps where job_id = target_job;
  update public.jobs
  set status = case when all_done then 'done' when any_active then 'in_progress' else 'not_started' end,
      updated_at = now()
  where id = target_job;
end;
$$;

revoke all on function public.signup_roles() from public;
revoke all on function public.login_guard(text, text) from public;
revoke all on function public.touch_sign_in() from public;
revoke all on function public.set_acting_as(text) from public;
revoke all on function public.manage_account(uuid, text, text) from public;
revoke all on function public.reset_user_code(uuid, text) from public;
revoke all on function public.advance_job(uuid) from public;

grant execute on function public.signup_roles() to anon, authenticated;
grant execute on function public.login_guard(text, text) to anon, authenticated;
grant execute on function public.touch_sign_in() to authenticated;
grant execute on function public.set_acting_as(text) to authenticated;
grant execute on function public.manage_account(uuid, text, text) to authenticated;
grant execute on function public.reset_user_code(uuid, text) to authenticated;
grant execute on function public.advance_job(uuid) to authenticated;

grant usage on schema app_private to authenticated;
grant execute on function app_private.effective_role() to authenticated;
grant execute on function app_private.is_approved() to authenticated;
grant execute on function app_private.real_role() to authenticated;

alter publication supabase_realtime add table public.profiles;
