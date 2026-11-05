# Beamlock

**Trade sign-off. Real time.**

Static PWA + Supabase Free (ca-central-1). Demo auth only — production would use Entra ID.

## Live URL (GitHub Pages)

**https://bezuko15.github.io/Beamlock/**

(also try `https://bezuko15.github.io/beamlock/` if your host folds case)

Do **not** use the Supabase Edge Function URL for the app UI (wrong MIME / CSP in browsers).

## Sign in

1. Open the live URL on phone or laptop  
2. Name: **Chris Alvarez**, **Alex Rivera**, **Sam Okonkwo**, etc.  
3. Pick a role (Planner / Supervisor see Planner + Admin)  
4. Optional PIN: **1234**

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
