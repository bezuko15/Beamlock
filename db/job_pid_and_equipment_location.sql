-- Applied to the Beamlock Supabase project (ukvxubtuyeqszddlnjoc).
-- Table-level grants already cover new columns for anon and authenticated.

alter table public.jobs
  add column if not exists pid_number text not null default '',
  add column if not exists equipment_location text not null default '';

comment on column public.jobs.pid_number is 'P&ID / drawing number';
comment on column public.jobs.equipment_location is 'Equipment location such as area, elevation, or grid';

update public.jobs
set pid_number = 'PID-RHC-210-04',
    equipment_location = 'Reactor deck / EL 42 / Grid C-3'
where wo_number = 'WO-45210'
  and coalesce(pid_number, '') = ''
  and coalesce(equipment_location, '') = '';

update public.jobs
set pid_number = 'PID-AV-PRB-118',
    equipment_location = 'Pipe rack B / EL 28 / Grid B-7'
where wo_number = 'WO-45218'
  and coalesce(pid_number, '') = ''
  and coalesce(equipment_location, '') = '';

notify pgrst, 'reload schema';
