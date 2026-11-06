# Beamlock

**Trade sign-off. Real time.**

Static PWA + Supabase Free (ca-central-1). Sign-in is a name and code. New accounts stay pending until a planner or admin approves the role.

## Live URL (GitHub Pages)

**https://bezuko15.github.io/Beamlock/**

(also try `https://bezuko15.github.io/beamlock/` if your host folds case)

Do **not** use the Supabase Edge Function URL for the app UI (wrong MIME / CSP in browsers).

## Sign in

1. Open the live URL on phone or laptop
2. Sign in with your name and code, or create an account and wait for approval
3. A trade account only acts on that trade. Planner can import and manage jobs. Admin manages users and settings. An operator can view as any role except Admin

## Maintenance schedule import

Planners use **Import maintenance schedule** on the Planner tab. The sheet is the site planning export (one row per operation). Columns are detected automatically, including a title row above the headers. Re-import updates the same order and does not touch sign-offs, comments, photos, skips, permit holders, or radio channels. **Download maintenance schedule sample** is synthetic data only.

## Trades

Insulators, Electrical / EHT, Pipefitters, NDE, Team, Scaffold, Crane, Extra, Instrumentation, Boilermakers, Vac truck, Labourers, and HVAC. Admin can add, rename, reorder, set the short code, and deactivate trades. The list is stored in `app_settings.data_source.trades`. Sign-in, My trade, the board, job steps, and the schedule import all use it. Import maps `insul` to Insulators and `INST` / `instr` to Instrumentation.

## Plant units

Admin-editable list (stored in `app_settings.data_source.units`):

`RHC`, `A&V`, `SRU`, `COGEN`, `Waterblock`, `HMU`

Jobs are filtered and grouped by unit on Jobs and Live board. Import maps unit names case-insensitively (e.g. `Cogen`, `A and V`).

## Free-tier notes

- Supabase Free may pause after ~1 week idle — restore in the [dashboard](https://supabase.com/dashboard/project/ukvxubtuyeqszddlnjoc)
- Only the **anon** key is in the browser (`js/config.js`). Never add `service_role`.

## Local

```bash
npx --yes serve -l 4173
node scripts/seed.mjs   # re-seed demo data across all six units
```

## Brand

Navy `#324259`, steel `#3F5773`, amber `#D6802D`.
