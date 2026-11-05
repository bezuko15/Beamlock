-- Comments can belong to a trade step or a job section, and can carry several photos.
-- Steps can be skipped. Jobs can be marked complete explicitly.

alter table public.comments
  add column if not exists step_id uuid references public.steps(id) on delete set null,
  add column if not exists section text,
  add column if not exists photo_paths jsonb not null default '[]'::jsonb;

alter table public.steps
  add column if not exists skip_reason text,
  add column if not exists skipped_by text,
  add column if not exists skipped_at timestamptz;

alter table public.jobs
  add column if not exists completed_by text,
  add column if not exists completed_at timestamptz;

notify pgrst, 'reload schema';
