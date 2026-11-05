# Beamlock — Shell IT integration checklist

Backend today: **Supabase Free (ca-central-1)**. Production may stay on Supabase Pro or move to Shell-approved hosting; the browser still only uses the publishable/anon key.

Sign-offs track **work progress only**. They do **not** issue/approve permits or authorize isolations/LOTO. External permit status must show source + freshness; unavailable/stale = grey/warning, never green.

## Needed from Shell IT

1. **Entra ID** — tenant, app registration, redirect URIs, group→role mapping (Planner, Supervisor, Operator, trades). Pluggable auth interface is ready; demo provider is default.  
2. **SAP** — test system, OData/BAPI preference, deep-link URL with `{workOrder}` / `{sapNotification}` / `{functionalLocation}`, technical user. Adapter stub exists.  
3. **Permit Vision** — version/tenant, status API, deep link `{permitVision}`, freshness SLA. Stub never returns “valid/green”.  
4. **Power BI** — workspace owner, license/embed method, secure embed URL; CSP already allows `app.powerbi.com` + `login.microsoftonline.com`.  
5. **Hosting** — approved Canadian region if required; HTTPS; turnaround concurrency.  
6. **Other tiles** — Teams, SharePoint, service desk, drawings/DMS base URLs.

See also the original TradeTrack notes under `/workspace/tradetrack/INTEGRATIONS.md` for the longer form.
