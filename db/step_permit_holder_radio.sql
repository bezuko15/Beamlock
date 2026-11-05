-- Each trade step keeps its own permit holder and radio channel.
-- crew_source is 'manual' today. A future Permit Vision adapter may set 'permit_vision';
-- those values must pass a freshness check before the UI treats them as current.

alter table public.steps
  add column if not exists permit_holder text not null default '',
  add column if not exists radio_channel text not null default '',
  add column if not exists crew_source text not null default 'manual',
  add column if not exists crew_updated_by text,
  add column if not exists crew_updated_at timestamptz;

notify pgrst, 'reload schema';
