/* Beamlock — static PWA client (Supabase) */
(function () {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const cfg = window.BEAMLOCK_CONFIG;
  const { createClient } = window.supabase;
  const sb = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storage: window.localStorage },
  });

  const DEFAULT_TRADES = [
    { id: 'Insulator', label: 'Insulators', short: 'INS', color: '#5b21b6', active: true },
    { id: 'Electrician', label: 'Electrical / EHT', short: 'EHT', color: '#c2410c', active: true },
    { id: 'Pipefitter', label: 'Pipefitters', short: 'FIT', color: '#1d4ed8', active: true },
    { id: 'NDE', label: 'NDE', short: 'NDE', color: '#0f766e', active: true },
    { id: 'Team', label: 'Team', short: 'TEAM', color: '#be123c', active: true },
    { id: 'Scaffold', label: 'Scaffold', short: 'SCAF', color: '#a16207', active: true },
    { id: 'Crane', label: 'Crane', short: 'CRN', color: '#9a3412', active: true },
    { id: 'Extra', label: 'Extra', short: 'EX', color: '#334155', active: true },
    { id: 'Instrumentation', label: 'Instrumentation', short: 'INST', color: '#0369a1', active: true },
    { id: 'Boilermaker', label: 'Boilermakers', short: 'BM', color: '#9f1239', active: true },
    { id: 'VacTruck', label: 'Vac truck', short: 'VAC', color: '#155e75', active: true },
    { id: 'Labourer', label: 'Labourers', short: 'LBR', color: '#3f6212', active: true },
    { id: 'HVAC', label: 'HVAC', short: 'HVAC', color: '#3730a3', active: true },
  ];
  const TEMPLATES = {
    full_valve: { name: 'Full valve weld-in', steps: [
      { trade: 'Insulator', label: 'Insulators — remove insulation' },
      { trade: 'Electrician', label: 'Electrical — remove EHT / heat trace' },
      { trade: 'Pipefitter', label: 'Pipefitters — cut / weld / install' },
      { trade: 'NDE', label: 'NDE — inspection / testing' },
      { trade: 'Pipefitter', label: 'Pipefitters — reinstate / close out' },
      { trade: 'Electrician', label: 'Electrical — reinstall EHT' },
      { trade: 'Insulator', label: 'Insulators — reinstall insulation' },
    ]},
    fitters_nde: { name: 'Fitters + NDE', steps: [
      { trade: 'Pipefitter', label: 'Pipefitters — work' },
      { trade: 'NDE', label: 'NDE — inspection / testing' },
    ]},
    insulation_elec: { name: 'Insulation + Electrical', steps: [
      { trade: 'Insulator', label: 'Insulators — remove / work' },
      { trade: 'Electrician', label: 'Electrical — EHT work' },
      { trade: 'Electrician', label: 'Electrical — reinstall EHT' },
      { trade: 'Insulator', label: 'Insulators — reinstall' },
    ]},
    elec_only: { name: 'Electrical only', steps: [{ trade: 'Electrician', label: 'Electrical — work' }] },
    fitters_only: { name: 'Fitters only', steps: [{ trade: 'Pipefitter', label: 'Pipefitters — work' }] },
  };
  const DEFAULT_UNITS = ['RHC', 'A&V', 'SRU', 'COGEN', 'Waterblock', 'HMU'];
  const DEFAULT_UNIT_PATTERNS = [
    { pattern: 'Waterblock', unit: 'Waterblock' },
    { pattern: 'COGEN', unit: 'COGEN' },
    { pattern: 'RHC', unit: 'RHC' },
    { pattern: 'SRU', unit: 'SRU' },
    { pattern: 'HMU', unit: 'HMU' },
    { pattern: 'A&V', unit: 'A&V' },
    { pattern: 'A and V', unit: 'A&V' },
    { pattern: 'AV', unit: 'A&V' },
  ];
  const DEFAULT_SITES = [
    { name: 'Upgrader South', processUnits: [
      { name: 'PU1', units: ['HMU', 'RHC'] },
      { name: 'PU2', units: ['A&V', 'SRU', 'COGEN', 'Waterblock'] },
    ] },
  ];
  const UNIT_ALIASES = {
    rhc: 'RHC', sru: 'SRU', cogen: 'COGEN', cogeneration: 'COGEN',
    hmu: 'HMU', waterblock: 'Waterblock', water: 'Waterblock',
    av: 'A&V', aandv: 'A&V', 'a&v': 'A&V', aandvessels: 'A&V',
  };

  function getUnits() {
    const raw = state.settings?.data_source?.units;
    if (Array.isArray(raw) && raw.length) {
      return raw.map((u) => String(u).trim()).filter(Boolean);
    }
    return DEFAULT_UNITS.slice();
  }
  function unitKey(s) {
    return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  }
  function normalizeUnit(raw) {
    const s = String(raw ?? '').trim();
    if (!s) return '';
    const units = getUnits();
    const exact = units.find((u) => u.toLowerCase() === s.toLowerCase());
    if (exact) return exact;
    const key = unitKey(s);
    for (const u of units) {
      if (unitKey(u) === key) return u;
    }
    const alias = UNIT_ALIASES[key];
    if (alias) {
      const hit = units.find((u) => u.toLowerCase() === alias.toLowerCase() || unitKey(u) === unitKey(alias));
      if (hit) return hit;
    }
    // "A and V" / "A & V" style
    if (/^a\s*(and|&)\s*v/i.test(s)) {
      const hit = units.find((u) => unitKey(u) === 'av' || u === 'A&V');
      if (hit) return hit;
    }
    return s;
  }
  function cloneSites(sites) {
    return (sites || []).map((s) => ({
      name: s.name,
      processUnits: (s.processUnits || []).map((p) => ({ name: p.name, units: (p.units || []).slice() })),
    }));
  }
  function getSites() {
    const raw = state.settings?.data_source?.sites;
    if (Array.isArray(raw) && raw.length && raw.some((s) => s && s.name && (s.processUnits || []).length)) return cloneSites(raw);
    return cloneSites(DEFAULT_SITES);
  }
  function parseSites(text) {
    const sites = [];
    let current = null;
    for (const line of String(text || '').split(/\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const m = trimmed.match(/^([^:]+):\s*(.*)$/);
      if (m) {
        if (!current) { current = { name: 'Site', processUnits: [] }; sites.push(current); }
        current.processUnits.push({ name: m[1].trim(), units: m[2].split(/[,;]/).map((s) => s.trim()).filter(Boolean) });
      } else {
        current = { name: trimmed, processUnits: [] };
        sites.push(current);
      }
    }
    return sites.filter((s) => s.name && s.processUnits.length);
  }
  function formatSites(sites) {
    return cloneSites(sites).map((s) => s.name + '\n' + s.processUnits.map((p) => p.name + ': ' + p.units.join(', ')).join('\n')).join('\n');
  }
  function puForUnit(raw) {
    const unit = normalizeUnit(raw);
    for (const site of getSites()) {
      for (const pu of site.processUnits) {
        if (pu.units.some((u) => (normalizeUnit(u) || u) === unit || unitKey(u) === unitKey(unit))) {
          return { site: site.name, pu: pu.name, unit };
        }
      }
    }
    return { site: '', pu: '', unit };
  }
  function unitsForPu(puName) {
    if (!puName) return getUnits();
    for (const site of getSites()) {
      const pu = site.processUnits.find((p) => p.name === puName);
      if (pu) return pu.units.map((u) => normalizeUnit(u) || u);
    }
    return getUnits();
  }
  function puTabsHtml(selected, jobs, idPrefix) {
    const sel = selected || '';
    const counts = {};
    for (const j of jobs) {
      const info = puForUnit(j.unit);
      if (info.pu) counts[info.pu] = (counts[info.pu] || 0) + 1;
    }
    let html = '<button type="button" class="pu-chip' + (!sel ? ' on' : '') + '" data-pu="" data-pu-tab="' + idPrefix + '">All<span class="count">' + jobs.length + '</span></button>';
    for (const site of getSites()) {
      html += '<span class="pu-site">' + esc(site.name) + '</span>';
      for (const pu of site.processUnits) {
        html += '<button type="button" class="pu-chip' + (sel === pu.name ? ' on' : '') + '" data-pu="' + esc(pu.name) + '" data-pu-tab="' + idPrefix + '">' + esc(pu.name) + '<span class="count">' + (counts[pu.name] || 0) + '</span></button>';
      }
    }
    return html;
  }
  function groupedSectionsHtml(jobs, gridClass) {
    const used = new Set();
    let html = '';
    const grid = 'job-grid' + (gridClass ? ' ' + gridClass : '');
    for (const site of getSites()) {
      for (const pu of site.processUnits) {
        const blocks = [];
        let n = 0;
        for (const unitName of pu.units) {
          const canon = normalizeUnit(unitName) || unitName;
          const group = jobs.filter((j) => normalizeUnit(j.unit) === canon);
          if (!group.length) continue;
          group.forEach((j) => used.add(j.id));
          n += group.length;
          blocks.push('<div class="unit-section"><div class="unit-section-head"><span>' + esc(canon) + '</span><span class="count">' + group.length + '</span></div><div class="' + grid + '">' + group.map(jobCard).join('') + '</div></div>');
        }
        if (!n) continue;
        html += '<section class="pu-section"><div class="pu-section-head"><span>' + esc(site.name) + ' · ' + esc(pu.name) + '</span><span class="count">' + n + '</span></div>' + blocks.join('') + '</section>';
      }
    }
    const other = jobs.filter((j) => !used.has(j.id));
    if (other.length) {
      html += '<section class="pu-section"><div class="pu-section-head"><span>Other / unassigned</span><span class="count">' + other.length + '</span></div><div class="' + grid + '">' + other.map(jobCard).join('') + '</div></section>';
    }
    return html;
  }
  function unitCounts(jobs, units) {
    const list = units || getUnits();
    const counts = Object.fromEntries(list.map((u) => [u, 0]));
    let other = 0;
    for (const j of jobs) {
      const u = normalizeUnit(j.unit) || j.unit || '';
      if (u && counts[u] !== undefined) counts[u]++;
      else if (j.unit) other++;
    }
    return { counts, other, total: jobs.length };
  }
  function unitTabsHtml(selected, jobs, idPrefix, unitsOverride) {
    const units = unitsOverride || listUnits();
    const { counts, total } = unitCounts(jobs, units);
    const sel = selected || '';
    let html = '<button type="button" class="unit-chip' + (!sel ? ' on' : '') + '" data-unit="" data-unit-tab="' + idPrefix + '">All<span class="count">' + total + '</span></button>';
    for (const u of units) {
      html += '<button type="button" class="unit-chip' + (sel === u ? ' on' : '') + '" data-unit="' + esc(u) + '" data-unit-tab="' + idPrefix + '">' + esc(u) + '<span class="count">' + (counts[u] || 0) + '</span></button>';
    }
    return html;
  }

  const state = {
    user: null, people: [], jobs: [], reactions: [], settings: null, tiles: [], view: 'jobs', weather: null, adminPreview: '', explicitSignOut: false,
    filters: { q: '', status: '', priority: '', trade: '', unit: '', pu: '', when: '' }, boardUnit: '', boardPu: '', channels: {}, tradeDraft: null, prefs: null,
  };

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function toast(msg, ms = 4500) {
    const el = document.createElement('div'); el.className = 'toast'; el.textContent = msg;
    $('#toast-wrap').appendChild(el); setTimeout(() => el.remove(), ms);
  }
  function fmtTime(iso) {
    const d = new Date(iso);
    if (!iso || Number.isNaN(d.getTime())) return '';
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: zoneName(), year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', hourCycle: state.prefs?.clock === '12' ? 'h12' : 'h23', timeZoneName: 'short',
    }).formatToParts(d);
    const g = (t) => parts.find((p) => p.type === t)?.value || '';
    const period = g('dayPeriod');
    return g('day') + ' ' + g('month') + ' ' + g('year') + ', ' + g('hour') + ':' + g('minute') + (period ? ' ' + period : '') + ' ' + g('timeZoneName');
  }
  function fmtDate(iso) {
    const d = new Date(iso);
    if (!iso || Number.isNaN(d.getTime())) return '';
    const parts = new Intl.DateTimeFormat('en-CA', { timeZone: zoneName(), day: 'numeric', month: 'short', year: 'numeric' }).formatToParts(d);
    const g = (t) => parts.find((p) => p.type === t)?.value || '';
    return g('day') + ' ' + g('month') + ' ' + g('year');
  }
  function getTrades() {
    const raw = state.settings?.data_source?.trades;
    const list = Array.isArray(raw) && raw.length ? raw : DEFAULT_TRADES;
    return list.map((t) => ({
      id: String(t.id || '').trim(),
      label: String(t.label || t.id || 'Trade').trim(),
      short: String(t.short || '').trim().slice(0, 6).toUpperCase() || String(t.id || 'T').slice(0, 4).toUpperCase(),
      color: /^#[0-9a-fA-F]{6}$/.test(String(t.color || '')) ? t.color : '#334155',
      active: t.active !== false,
    })).filter((t) => t.id);
  }
  function activeTrades() { return getTrades().filter((t) => t.active); }
  function tradeById(id) { return getTrades().find((t) => t.id === id) || null; }
  function tradeLabel(id) { return tradeById(id)?.label || id || ''; }
  function tradeShort(id) { return tradeById(id)?.short || String(id || '').slice(0, 4).toUpperCase(); }
  function tradeColor(id) { return tradeById(id)?.color || '#5b6b7c'; }
  function signInRoles() {
    return [{ id: 'Planner', label: 'Planner' }, { id: 'Supervisor', label: 'Supervisor' }, { id: 'Operator', label: 'Operator' }]
      .concat(activeTrades().map((t) => ({ id: t.id, label: t.label })));
  }
  function roleTrade(role) {
    return getTrades().some((t) => t.id === role) ? role : null;
  }
  function tradePip(step) {
    return '<span class="step-pip ' + step.status + '" style="--tc:' + esc(tradeColor(step.trade)) + '" title="' + esc(tradeLabel(step.trade) + ' — ' + (step.label || '')) + '">' + esc(tradeShort(step.trade)) + '</span>';
  }
  function saveUser(u) { localStorage.setItem('bl_user', JSON.stringify(u)); state.user = u; }
  function loadUser() { try { return JSON.parse(localStorage.getItem('bl_user') || 'null'); } catch { return null; } }

  async function audit(jobId, action, detail) {
    let text = detail || null;
    if (state.user?.preview && action !== 'view_as') {
      const mark = 'admin viewing as ' + tradeLabel(state.user.preview);
      text = text ? text + ' · ' + mark : mark;
    }
    await sb.from('audit_log').insert({
      job_id: jobId || null, action, actor_name: state.user?.name, actor_role: state.user?.realRole || state.user?.role, detail: text,
    });
  }
  const REACTIONS = [
    { id: 'gotit', emoji: '👍', label: 'Got it / understood' },
    { id: 'done', emoji: '✅', label: 'Confirmed done' },
    { id: 'look', emoji: '👀', label: 'Looking into it' },
    { id: 'concern', emoji: '⚠️', label: 'Concern' },
    { id: 'clap', emoji: '👏', label: 'Good job' },
    { id: 'question', emoji: '❓', label: 'Question' },
  ];
  function reactionLabel(kind) { return REACTIONS.find((item) => item.id === kind)?.label || 'Reaction'; }
  function isMyReaction(row) {
    if (!row) return false;
    if (state.profile?.id && row.user_id === state.profile.id) return true;
    return !!(state.demoOn && state.user?.name && row.actor_name === state.user.name);
  }
  function reactionsFor(type, id) {
    return (state.reactions || []).filter((row) => row.target_type === type && row.target_id === id);
  }
  function reactionNames(type, id, kinds) {
    const allow = new Set(kinds);
    return [...new Set(reactionsFor(type, id).filter((row) => allow.has(row.kind || 'gotit')).map((row) => row.actor_name).filter(Boolean))];
  }
  function gotItHtml(type, id, jobId) {
    const rows = reactionsFor(type, id);
    const pills = REACTIONS.map((kind) => {
      const people = rows.filter((row) => (row.kind || 'gotit') === kind.id);
      if (!people.length) return '';
      const names = people.map((row) => row.actor_name).filter(Boolean);
      const mine = people.some(isMyReaction);
      const who = names.join(', ') || 'Someone';
      return '<button type="button" class="react-pill' + (mine ? ' on' : '') + '" aria-label="' + esc(kind.label) + ', ' + names.length + ', ' + esc(who) + '">' + kind.emoji + '<span>' + names.length + '</span><span class="react-who">' + esc(kind.label) + ': ' + esc(who) + '</span></button>';
    }).join('');
    const menu = REACTIONS.map((kind) => {
      const mine = rows.some((row) => (row.kind || 'gotit') === kind.id && isMyReaction(row));
      return '<button type="button" class="react-choice' + (mine ? ' on' : '') + '" data-react="' + esc(type) + '" data-id="' + esc(id) + '" data-job="' + esc(jobId) + '" data-kind="' + kind.id + '">' + kind.emoji + ' ' + esc(kind.label) + '</button>';
    }).join('');
    return '<span class="react-bar">' + pills + '<span class="react-add-wrap"><button type="button" class="react-add" aria-label="Add a reaction">+</button><span class="react-menu">' + menu + '</span></span></span>';
  }
  function paintOpenJob() {
    const openId = document.querySelector('#job-overlay')?.dataset.jobId;
    renderAll();
    if (!openId) return;
    const job = activeList().find((item) => item.id === openId);
    if (job) showJobModal(job);
  }
  function noteConcern(row) {
    if (!row || row.kind !== 'concern' || row.target_type !== 'step' || !canSeeDash()) return;
    if (state.profile?.id && row.user_id === state.profile.id) return;
    const job = activeList().find((item) => item.id === row.job_id) || state.jobs.find((item) => item.id === row.job_id);
    const step = job?.steps?.find((item) => item.id === row.target_id);
    const text = (job?.wo_number || 'Job') + (step ? ' — ' + step.label : '') + (row.actor_name ? ' · ' + row.actor_name : '');
    toast('Concern: ' + text);
    notify('Concern on a step', text);
  }
  async function toggleReaction(type, id, jobId, kind) {
    kind = kind || 'gotit';
    if (!state.user || !type || !id) return;
    const mine = reactionsFor(type, id).find((row) => (row.kind || 'gotit') === kind && isMyReaction(row));
    const on = !mine;
    const row = { id: 'local-' + type + '-' + id + '-' + kind, kind, target_type: type, target_id: id, job_id: jobId, user_id: state.demoOn ? 'demo-me' : (state.profile?.id || null), actor_name: state.user.name, created_at: new Date().toISOString() };
    state.reactions = (state.reactions || []).filter((item) => !(item.target_type === type && item.target_id === id && (item.kind || 'gotit') === kind && isMyReaction(item)));
    if (on) state.reactions.push(row);
    paintOpenJob();
    if (state.demoOn) return;
    if (!navigator.onLine) {
      await queueOffline({ id: 'react-' + type + '-' + id + '-' + kind, kind: 'reaction', at: Date.now(), targetType: type, targetId: id, jobId, reactKind: kind, on });
      toast((on ? '' : 'Removed ') + reactionLabel(kind) + ' on this device');
      return;
    }
    const result = on
      ? await sb.from('reactions').insert({ target_type: type, target_id: id, job_id: jobId, kind })
      : await sb.from('reactions').delete().eq('target_type', type).eq('target_id', id).eq('kind', kind);
    if (result.error) {
      toast(result.error.message);
      refreshAll(false);
    }
  }
  function windThresholds() {
    const wind = state.settings?.data_source?.wind || {};
    const amber = Number(wind.amber);
    const red = Number(wind.red);
    return {
      amber: Number.isFinite(amber) && amber > 0 ? amber : 30,
      red: Number.isFinite(red) && red > 0 ? red : 40,
    };
  }
  function gustLevel(gust) {
    const limits = windThresholds();
    if (gust >= limits.red) return 'red';
    if (gust >= limits.amber) return 'amber';
    return '';
  }
  function compassDir(deg) {
    const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const n = Number(deg);
    if (!Number.isFinite(n)) return '';
    return dirs[Math.round((((n % 360) + 360) % 360) / 45) % 8];
  }
  function wxIcon(code) {
    const n = Number(code);
    if (n === 0) return '☀';
    if (n <= 2) return '⛅';
    if (n === 3) return '☁';
    if (n <= 48) return '🌫';
    if (n <= 67) return '🌧';
    if (n <= 77) return '❄';
    if (n <= 82) return '🌧';
    if (n >= 95) return '⛈';
    return '☁';
  }
  function paintWeather(pack) {
    const btn = $('#wx-chip');
    if (!btn) return;
    state.weather = pack || state.weather;
    const current = pack?.current;
    if (!current) { btn.textContent = 'Weather …'; return; }
    const gust = Math.round(Number(current.wind_gusts_10m) || 0);
    const speed = Math.round(Number(current.wind_speed_10m) || 0);
    const temp = Math.round(Number(current.temperature_2m) || 0);
    const dir = compassDir(current.wind_direction_10m);
    const level = gustLevel(gust);
    btn.classList.toggle('gust-amber', level === 'amber');
    btn.classList.toggle('gust-red', level === 'red');
    const flag = level === 'red' ? ' high' : (level === 'amber' ? ' adv' : '');
    btn.innerHTML = '<span class="wx-ico" aria-hidden="true">' + wxIcon(current.weather_code) + '</span><span class="wx-main">' + temp + '° ' + speed + ' g' + gust + flag + ' ' + dir + '</span>';
    const when = pack.fetchedAt ? fmtTime(pack.fetchedAt) : '';
    btn.title = 'Shell Scotford · updated ' + when;
    btn.setAttribute('aria-label', 'Shell Scotford, ' + temp + ' degrees, wind ' + speed + ' kilometres per hour, gusts ' + gust + (level ? ', ' + level + ' advisory' : '') + ', from the ' + dir + '. Updated ' + when);
  }
  function readWeatherCache() {
    try { return JSON.parse(localStorage.getItem('bl_weather') || 'null'); } catch { return null; }
  }
  async function refreshWeather() {
    const cached = readWeatherCache();
    if (cached) paintWeather(cached);
    if (!navigator.onLine) return;
    try {
      const wxUrl = 'https://api.open-meteo.com/v1/forecast?latitude=53.78&longitude=-113.23&current=temperature_2m,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m&hourly=temperature_2m,weather_code,wind_speed_10m,wind_direction_10m,wind_gusts_10m&wind_speed_unit=kmh&timezone=America%2FEdmonton&forecast_hours=12';
      const alertUrl = 'https://api.weather.gc.ca/collections/weather-alerts/items?f=json&lang=en&limit=5&skipGeometry=true&bbox=-113.45,53.68,-113.05,53.90';
      const [wxRes, alertRes] = await Promise.all([fetch(wxUrl), fetch(alertUrl).catch(() => null)]);
      if (!wxRes.ok) throw new Error('weather');
      const wx = await wxRes.json();
      let alerts = cached?.alerts || [];
      if (alertRes && alertRes.ok) {
        const body = await alertRes.json();
        alerts = (body.features || []).map((feature) => ({
          name: feature.properties?.alert_name_en || 'Alert',
          text: String(feature.properties?.alert_text_en || '').replace(/\s+/g, ' ').trim().slice(0, 280),
        }));
      }
      const pack = { fetchedAt: new Date().toISOString(), current: wx.current, hourly: wx.hourly, alerts };
      localStorage.setItem('bl_weather', JSON.stringify(pack));
      paintWeather(pack);
      if (document.querySelector('#wx-sheet')) openWeatherSheet();
    } catch (_) {
      if (cached) paintWeather(cached);
    }
  }
  function startWeather() {
    const cached = readWeatherCache();
    if (cached) paintWeather(cached);
    refreshWeather();
    if (state.wxTimer) return;
    state.wxTimer = setInterval(refreshWeather, 10 * 60 * 1000);
  }
  function openWeatherSheet() {
    const pack = state.weather || readWeatherCache();
    const root = $('#modal-root');
    if (!root || !pack?.current) { toast('Weather is not available yet'); return; }
    const limits = windThresholds();
    const current = pack.current;
    const hours = pack.hourly || {};
    const rows = (hours.time || []).slice(0, 12).map((time, i) => {
      const gust = Math.round(Number(hours.wind_gusts_10m?.[i]) || 0);
      const level = gustLevel(gust);
      return '<tr><td>' + esc(String(time).slice(11, 16)) + '</td><td>' + Math.round(Number(hours.temperature_2m?.[i]) || 0) + '°</td><td>' + Math.round(Number(hours.wind_speed_10m?.[i]) || 0) + '</td><td class="wx-gust ' + level + '">' + gust + '</td><td>' + esc(compassDir(hours.wind_direction_10m?.[i])) + '</td></tr>';
    }).join('');
    const alerts = (pack.alerts || []).map((alert) => '<p><strong>' + esc(alert.name) + '</strong><br>' + esc(alert.text) + '</p>').join('') || '<p>No Environment Canada alerts for this area.</p>';
    const hadJob = document.querySelector('#job-overlay');
    root.innerHTML = '<div class="overlay" id="wx-sheet"><div class="modal" role="dialog" aria-label="Shell Scotford weather"><div class="modal-head"><strong>Shell Scotford</strong><button class="btn btn-sm" id="wx-close" type="button">Close</button></div><div class="modal-body wx-sheet">' +
      '<p>' + wxIcon(current.weather_code) + ' ' + Math.round(current.temperature_2m) + '° · wind ' + Math.round(current.wind_speed_10m) + ' km/h · gusts ' + Math.round(current.wind_gusts_10m) + ' km/h · ' + esc(compassDir(current.wind_direction_10m)) + '</p>' +
      '<p>Last updated ' + esc(fmtTime(pack.fetchedAt)) + (navigator.onLine ? '' : ' · saved on this device') + '</p>' +
      '<p class="wx-advisory">Advisory only. Follow site crane and work-at-height procedures. Amber from ' + limits.amber + ' km/h, red from ' + limits.red + ' km/h. The next 12 hours are Shell Scotford local time (America/Edmonton). Last updated is shown in ' + esc(zoneName()) + '.</p>' +
      '<h3>Environment Canada</h3>' + alerts +
      '<h3>Next 12 hours</h3><div class="table-wrap"><table><thead><tr><th>Time</th><th>Temp</th><th>Wind</th><th>Gust</th><th>Dir</th></tr></thead><tbody>' + rows + '</tbody></table></div></div></div></div>';
    $('#wx-close').onclick = () => { root.innerHTML = ''; if (hadJob) { const job = activeList().find((item) => item.id === hadJob.dataset.jobId); if (job) showJobModal(job); } };
    $('#wx-sheet').onclick = (e) => { if (e.target.id === 'wx-sheet') $('#wx-close').click(); };
  }

  async function refreshStepReadiness(jobId) {
    const { error } = await sb.rpc('advance_job', { target_job: jobId });
    if (error) throw new Error(error.message);
  }

  async function loadFullJobs() {
    const { data: jobs, error } = await sb.from('jobs').select('*').eq('archived', false).order('updated_at', { ascending: false });
    if (error) throw error;
    const ids = jobs.map((j) => j.id);
    if (!ids.length) { state.jobs = []; state.reactions = []; return; }
    const { data: steps } = await sb.from('steps').select('*, step_assignees(*)').in('job_id', ids).order('sort_order');
    const { data: comments } = await sb.from('comments').select('*').in('job_id', ids).order('created_at');
    const { data: audits } = await sb.from('audit_log').select('*').in('job_id', ids).order('created_at', { ascending: false }).limit(500);
    const rx = await sb.from('reactions').select('id,kind,target_type,target_id,job_id,user_id,actor_name,created_at').in('job_id', ids);
    state.reactions = rx.error ? (state.reactions || []) : (rx.data || []);
    state.jobs = jobs.map((j) => ({
      ...j,
      steps: (steps || []).filter((s) => s.job_id === j.id).map((s) => ({ ...s, assignees: s.step_assignees || [] })),
      comments: (comments || []).filter((c) => c.job_id === j.id),
      audit: (audits || []).filter((a) => a.job_id === j.id),
    }));
  }

  async function loadMeta() {
    const [{ data: people }, { data: settings }, { data: tiles }] = await Promise.all([
      sb.from('people').select('*').eq('active', true).order('role').order('name'),
      sb.from('app_settings').select('*').eq('id', 'default').maybeSingle(),
      sb.from('app_tiles').select('*').order('sort_order'),
    ]);
    state.people = people || [];
    state.settings = settings || { url_templates: {}, power_bi_embed: {}, data_source: { units: DEFAULT_UNITS.slice() } };
    if (!state.settings.data_source) state.settings.data_source = {};
    if (!Array.isArray(state.settings.data_source.units) || !state.settings.data_source.units.length) {
      state.settings.data_source.units = DEFAULT_UNITS.slice();
    }
    if (!Array.isArray(state.settings.data_source.sites) || !state.settings.data_source.sites.length) {
      state.settings.data_source.sites = cloneSites(DEFAULT_SITES);
    }
    if (!Array.isArray(state.settings.data_source.unit_patterns) || !state.settings.data_source.unit_patterns.length) {
      state.settings.data_source.unit_patterns = DEFAULT_UNIT_PATTERNS.map((p) => ({ ...p }));
    }
    if (!Array.isArray(state.settings.data_source.trades) || !state.settings.data_source.trades.length) {
      state.settings.data_source.trades = DEFAULT_TRADES.map((t) => ({ ...t }));
    }
    state.tiles = tiles || [];
  }

  function waitingTrade(job) {
    if (job.on_hold || job.status === 'done') return null;
    return job.steps.find((x) => x.status === 'ready' || x.status === 'in_progress') || null;
  }
  function isMyTurn(job) {
    const t = state.user?.trade; if (!t) return false;
    const w = waitingTrade(job); return w && w.trade === t;
  }

  function boardStats() {
    const jobs = activeList();
    const byTradeWaiting = {};
    let notStarted = 0, inProgress = 0, done = 0, onHold = 0;
    for (const j of jobs) {
      if (j.on_hold) onHold++;
      else if (j.status === 'done') done++;
      else if (j.status === 'not_started') notStarted++;
      else inProgress++;
      const ready = waitingTrade(j);
      if (ready && !j.on_hold && j.status !== 'done') byTradeWaiting[ready.trade] = (byTradeWaiting[ready.trade] || 0) + 1;
    }
    return { total: jobs.length, notStarted, inProgress, done, onHold, byTradeWaiting, jobs };
  }

  function subscribeRealtime() {
    const channel = sb.channel('beamlock-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, () => refreshLive())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'steps' }, () => refreshLive())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'step_assignees' }, async (payload) => {
        await refreshLive();
        if (payload.eventType === 'UPDATE' && payload.new?.signed_off) {
          // your-turn toast for next trade
          const job = state.jobs.find((j) => j.steps.some((s) => s.assignees.some((a) => a.id === payload.new.id)));
          if (!job) return;
          const ready = waitingTrade(job);
          if (ready && state.user?.trade === ready.trade) {
            toast('Your turn: ' + job.wo_number + ' — ' + ready.label);
            notify('Beamlock — your turn', job.wo_number + ': ' + job.title);
          }
        }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, () => refreshLive())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings' }, () => loadMeta().then(renderDataSource))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_tiles' }, () => loadMeta().then(() => { if (state.view === 'apps') renderApps(); }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'turnarounds' }, () => { if (state.view === 'turn') renderTurnaround(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'turnaround_jobs' }, () => { if (state.view === 'turn') renderTurnaround(); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'unit_safety' }, () => loadSafety().then(() => { if (state.view === 'safety') renderSafety(); }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'reactions' }, (payload) => {
        if (state.demoOn) return;
        if (payload.eventType === 'INSERT') noteConcern(payload.new);
        refreshLive();
      })
      .subscribe((status) => {
        if (!navigator.onLine) setLiveStatus('offline');
        else setLiveStatus(status === 'SUBSCRIBED' ? 'live' : 'reconnecting');
      });
    state.channels.main = channel;
  }

  function setLiveStatus(mode) {
    const dot = $('#live-dot');
    const label = $('#live-label');
    const banner = $('#net-banner');
    if (dot) dot.classList.toggle('off', mode !== 'live');
    if (label) label.textContent = mode === 'live' ? 'Live' : mode === 'offline' ? 'Offline' : 'Reconnecting';
    if (!banner) return;
    banner.classList.toggle('hidden', mode === 'live');
    banner.classList.toggle('offline', mode === 'offline');
    banner.textContent = mode === 'offline' ? 'You are offline. Changes will sync when the connection returns.' : (mode === 'reconnecting' ? 'Reconnecting…' : '');
  }
  function wantsNotify() {
    return !!state.prefs?.notify && typeof Notification !== 'undefined' && Notification.permission === 'granted';
  }
  function notify(title, body) {
    playAlertSound();
    if (!wantsNotify()) return;
    try { new Notification(title, { body: body || '', icon: './icons/icon-192.png' }); } catch (_) {}
  }

  async function refreshLive() {
    await refreshAll(false);
    if (document.querySelector('.reason-overlay') || document.querySelector('.lightbox')) return;
    const typing = document.activeElement && ['TEXTAREA', 'INPUT'].includes(document.activeElement.tagName);
    const id = document.querySelector('#job-overlay')?.dataset.jobId;
    if (!id || typing) return;
    const open = state.jobs.find((j) => j.id === id);
    if (open) showJobModal(open);
  }
  function activeList() { return state.demoOn ? (state.demoJobs || []) : state.jobs; }
  async function refreshAll(showErr) {
    if (state.demoOn) { renderAll(); return; }
    const prev = (state.jobs || []).map((j) => ({ id: j.id, on_hold: j.on_hold, beam: j.beam, steps: j.steps }));
    try {
      await loadMeta();
      renderDataSource();
      await loadFullJobs();
      scanAlerts(prev, state.jobs);
      renderAll();
    } catch (e) {
      console.error(e);
      if (showErr) toast('Refresh failed: ' + e.message);
    }
  }

  function accountEmail(name) {
    const slug = String(name || '').trim().toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '.').replace(/^\.+|\.+$/g, '');
    return (slug || 'user') + '@beamlock.local';
  }
  function isApproved() { return state.profile?.status === 'approved'; }
  function isRealAdmin() { return isApproved() && state.profile?.role === 'Admin' && !state.user?.preview; }
  function profileIsAdmin() { return isApproved() && state.profile?.role === 'Admin'; }
  function canManageUsers() { return isApproved() && ['Admin', 'Planner'].includes(state.user?.role); }
  function canPlan() { return isApproved() && ['Admin', 'Planner'].includes(state.user?.role); }
  function canSupervise() { return isApproved() && ['Admin', 'Planner', 'Supervisor'].includes(state.user?.role); }
  function canActOnStep(step) {
    if (!isApproved()) return false;
    if (canSupervise()) return true;
    return !!state.user?.trade && state.user.trade === step.trade;
  }
  function needsApproval(role) { return ['Planner', 'Supervisor', 'Admin'].includes(role); }
  function applyProfile(p) {
    state.profile = p;
    const staff = ['Admin', 'Planner', 'Supervisor', 'Operator'];
    let eff = p.status === 'approved' && p.role === 'Operator' && p.acting_as ? p.acting_as : p.role;
    let preview = '';
    if (p.status === 'approved' && p.role === 'Admin' && state.adminPreview && state.adminPreview !== 'Admin') {
      preview = state.adminPreview;
      eff = preview;
    }
    state.user = {
      name: p.display_name,
      role: p.status === 'approved' ? eff : p.role,
      realRole: p.role,
      actingAs: p.acting_as || '',
      preview,
      trade: p.status === 'approved' && !staff.includes(eff) ? eff : null,
      personId: p.id,
      status: p.status,
    };
  }
  function paintRememberedLogin() {
    const name = localStorage.getItem('bl_last_name') || '';
    const input = $('#login-name');
    if (input && name) input.value = name;
    $('#login-extra')?.classList.add('hidden');
  }
  function showLogin(message) {
    $('#app')?.classList.add('hidden');
    $('#gate')?.classList.add('hidden');
    $('#login')?.classList.remove('hidden');
    paintRememberedLogin();
    applyAppearance(defaultPrefs());
    const err = $('#login-error');
    if (err) { err.textContent = message || ''; err.classList.toggle('hidden', !message); }
  }
  function readonlyCopy(profile) {
    const who = profile.role === 'Admin' ? 'an admin' : 'a planner or admin';
    return 'Read only until ' + who + ' approves your ' + (profile.role || 'role') + ' role. You can look at jobs. You cannot change them yet.';
  }
  async function signOut(message) {
    state.explicitSignOut = true;
    try { if (state.channels.main) sb.removeChannel(state.channels.main); } catch (_) {}
    try { if (state.channels.profile) sb.removeChannel(state.channels.profile); } catch (_) {}
    if (state.profileTimer) clearInterval(state.profileTimer);
    state.profileTimer = null;
    state.channels = {};
    state.adminPreview = '';
    localStorage.removeItem('bl_admin_preview');
    state.user = null;
    state.profile = null;
    state.jobs = [];
    try { await sb.auth.signOut({ scope: 'local' }); } catch (_) {}
    setTimeout(() => { state.explicitSignOut = false; }, 1000);
    showLogin(message || '');
  }
  async function loadSignupRoles() {
    const { data, error } = await sb.rpc('signup_roles');
    if (error) throw error;
    const roles = Array.isArray(data) ? data : [];
    const sel = $('#login-role');
    if (sel && !sel.dataset.filled) {
      sel.innerHTML = roles.map((r) => '<option value="' + esc(r.id) + '">' + esc(r.label) + '</option>').join('');
      sel.dataset.filled = '1';
    }
    return roles;
  }
  function watchProfile(id) {
    if (state.channels.profile) sb.removeChannel(state.channels.profile);
    if (state.profileTimer) clearInterval(state.profileTimer);
    state.profileTimer = setInterval(async () => {
      if (!state.profile?.id) return;
      const { data } = await sb.from('profiles').select('status').eq('id', state.profile.id).maybeSingle();
      if (data?.status === 'deactivated') signOut('This account is deactivated.');
    }, 8000);
    state.channels.profile = sb.channel('profile-' + id)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: 'id=eq.' + id }, async (payload) => {
        const next = payload.new;
        if (!next) return;
        if (next.status === 'deactivated') { await signOut('This account is deactivated.'); return; }
        if (next.status === 'rejected') { await signOut('This account was not approved.'); return; }
        applyProfile(next);
        if ($('#app').classList.contains('hidden')) { await enterApp(); return; }
        paintIdentity();
        renderAll();
      })
      .subscribe();
  }
  function cachedProfile(id) {
    try { return JSON.parse(localStorage.getItem('bl_profile_' + id) || 'null'); } catch { return null; }
  }
  async function openSession() {
    const { data: sessionData } = await sb.auth.getSession();
    const user = sessionData?.session?.user;
    if (!user) { showLogin(''); return; }
    let profile = null;
    const { data, error } = await sb.from('profiles').select('*').eq('id', user.id).single();
    if (data) profile = data;
    else profile = cachedProfile(user.id);
    if (!profile) {
      if (error && !navigator.onLine) { showLogin('Still offline. The saved session will open when the connection returns.'); return; }
      await signOut('This account has no profile.');
      return;
    }
    if (profile.status === 'deactivated') { await signOut('This account is deactivated.'); return; }
    if (profile.status === 'rejected') { await signOut('This account was not approved.'); return; }
    localStorage.setItem('bl_profile_' + user.id, JSON.stringify(profile));
    if (profile.display_name) localStorage.setItem('bl_last_name', profile.display_name);
    state.adminPreview = localStorage.getItem('bl_admin_preview') || '';
    applyProfile(profile);
    watchProfile(profile.id);
    if (navigator.onLine) { try { await sb.rpc('touch_sign_in'); } catch (_) {} }
    await enterApp();
  }
  function bindAuth() {
    const fail = (message) => { const el = $('#login-error'); if (!el) return; el.textContent = message; el.classList.remove('hidden'); };
    $('#gate-signout') && ($('#gate-signout').onclick = () => signOut(''));
    $('#login-btn').onclick = async () => {
      const name = $('#login-name').value.trim();
      const code = $('#login-code').value;
      const again = $('#login-code2').value;
      const role = $('#login-role').value;
      if (name.length < 2 || !code) return fail('Enter your name and code.');
      const guard = await sb.rpc('login_guard', { person: name, code });
      if (guard.error) return fail(guard.error.message);
      if (guard.data === 'locked') return fail('Too many wrong codes. Try again in 15 minutes.');
      if (guard.data === 'deactivated') return fail('This account is deactivated.');
      if (guard.data === 'rejected') return fail('This account was not approved.');
      if (guard.data === 'new') {
        const extra = $('#login-extra');
        if (extra && extra.classList.contains('hidden')) {
          extra.classList.remove('hidden');
          return fail('Confirm the code and choose your trade or role, then sign in.');
        }
        if (!/^\d{6,}$/.test(code)) return fail('The code must be 6 or more digits.');
        if (code !== again) return fail('Confirm the code to create this account.');
        if (!role) return fail('Choose your trade or role.');
        const { error } = await sb.auth.signUp({ email: accountEmail(name), password: code, options: { data: { display_name: name, requested_role: role } } });
        if (error) return fail(/already/i.test(error.message) ? 'That name is already in use.' : error.message);
        const signed = await sb.auth.signInWithPassword({ email: accountEmail(name), password: code });
        if (signed.error) return fail(signed.error.message);
        localStorage.setItem('bl_last_name', name);
        $('#login-error').classList.add('hidden');
        await openSession();
        return;
      }
      if (guard.data !== 'ok') return fail('Name or code is wrong.');
      const { error } = await sb.auth.signInWithPassword({ email: accountEmail(name), password: code });
      if (error) return fail('Name or code is wrong.');
      localStorage.setItem('bl_last_name', name);
      $('#login-error').classList.add('hidden');
      await openSession();
      const choosing = !$('#login-extra')?.classList.contains('hidden');
      if (choosing && role && state.profile && role !== state.profile.role) toast('Your role is locked as ' + tradeLabel(state.profile.role) + '.');
    };
  }
  function paintIdentity() {
    if (!state.user) return;
    const viewing = state.user?.preview
      ? ' · viewing as ' + tradeLabel(state.user.preview)
      : (state.profile?.role === 'Operator' && state.profile?.acting_as ? ' · viewing as ' + tradeLabel(state.profile.acting_as) : '');
    $('#user-label').textContent = state.user.name + ' · ' + state.user.realRole + (state.profile?.status === 'pending' ? ' · read only' : '') + viewing;
    const banner = $('#readonly-banner');
    if (banner) {
      const pending = state.profile?.status === 'pending';
      banner.classList.toggle('hidden', !pending);
      if (pending) banner.textContent = readonlyCopy(state.profile);
    }
    $('#tab-planner').style.display = canPlan() ? '' : 'none';
    $('#tab-admin').style.display = canManageUsers() ? '' : 'none';
    const seeDash = isApproved() && ['Supervisor', 'Planner', 'Admin'].includes(state.user?.role);
    $('#tab-dash')?.classList.toggle('hidden', !seeDash);
    $('#tab-turn')?.classList.toggle('hidden', !seeDash);
    $('#btn-demo')?.classList.toggle('hidden', !isRealAdmin());
    $('#adm-settings')?.classList.toggle('hidden', !isRealAdmin());
    $('#act-as-wrap')?.classList.toggle('hidden', state.profile?.role !== 'Operator');
    $('#admin-view-wrap')?.classList.toggle('hidden', !profileIsAdmin());
    $('#admin-view-exit')?.classList.toggle('hidden', !(profileIsAdmin() && state.user?.preview));
    const adminSel = $('#admin-view');
    if (adminSel && document.activeElement !== adminSel) adminSel.value = state.user?.preview || '';
    if (!canPlan() && state.view === 'planner') setView('jobs');
    if (!canManageUsers() && state.view === 'admin') setView('jobs');
    if (!seeDash && (state.view === 'dash' || state.view === 'turn')) setView('jobs');
  }
  async function fillActAs() {
    const sel = $('#act-as');
    if (!sel || state.profile?.role !== 'Operator') return;
    sel.onchange = async () => {
      const { error } = await sb.rpc('set_acting_as', { next_role: sel.value });
      if (error) return toast(error.message);
      const { data: profile, error: readError } = await sb.from('profiles').select('*').eq('id', state.profile.id).single();
      if (readError) return toast(readError.message);
      applyProfile(profile);
      await audit(null, 'act_as', profile.acting_as ? 'Operator ' + profile.display_name + ' acting as ' + profile.acting_as : 'Operator ' + profile.display_name + ' returned to Operator');
      paintIdentity();
      renderAll();
    };
    const roles = await loadSignupRoles();
    const current = state.profile.acting_as || '';
    sel.innerHTML = '<option value="">Operator</option>' + roles.filter((r) => r.id !== 'Admin').map((r) => '<option value="' + esc(r.id) + '"' + (current === r.id ? ' selected' : '') + '>' + esc(r.label) + '</option>').join('');
  }
  async function setAdminPreview(role) {
    if (!profileIsAdmin()) return;
    const next = role && role !== 'Admin' ? role : '';
    const prev = state.adminPreview || '';
    if (next === prev) return;
    state.adminPreview = next;
    if (next) localStorage.setItem('bl_admin_preview', next);
    else localStorage.removeItem('bl_admin_preview');
    applyProfile(state.profile);
    paintIdentity();
    renderAll();
    await audit(null, 'view_as', next ? 'admin viewing as ' + tradeLabel(next) : 'admin exited preview');
  }
  async function fillAdminView() {
    const sel = $('#admin-view');
    if (!sel || !profileIsAdmin()) return;
    let roles = [];
    try { roles = await loadSignupRoles(); } catch (_) { roles = []; }
    const staff = [
      { id: 'Operator', label: 'Operator' },
      { id: 'Planner', label: 'Planner' },
      { id: 'Supervisor', label: 'Supervisor' },
    ];
    const trades = (roles.length ? roles : getTrades().map((t) => ({ id: t.id, label: t.label })))
      .filter((r) => r.id && r.id !== 'Admin' && !staff.some((s) => s.id === r.id));
    const options = [{ id: '', label: 'Admin' }].concat(staff).concat(trades);
    sel.innerHTML = options.map((r) => '<option value="' + esc(r.id) + '">' + esc(r.label) + '</option>').join('');
    sel.value = state.adminPreview || '';
    sel.onchange = () => { setAdminPreview(sel.value).catch((err) => toast(err.message || 'Could not switch view')); };
    $('#admin-view-exit') && ($('#admin-view-exit').onclick = () => { sel.value = ''; setAdminPreview('').catch(() => {}); });
  }

  async function enterApp() {
    $('#login').classList.add('hidden');
    $('#gate').classList.add('hidden');
    $('#app').classList.remove('hidden');
    paintIdentity();
    await loadPrefs();
    const land = resolvedLanding();
    if (land !== state.view) {
      state.view = land;
      $$('#main-tabs .tab').forEach((t) => t.classList.toggle('active', t.dataset.view === land));
      ['jobs', 'mine', 'history', 'board', 'dash', 'turn', 'safety', 'planner', 'apps', 'dashboards', 'admin', 'audit', 'security', 'settings'].forEach((v) => {
        $('#view-' + v)?.classList.toggle('hidden', v !== land);
      });
    }
    fillActAs().catch(() => {});
    fillAdminView().catch(() => {});
    restoreFilters();
    syncFilterControls();
    renderDataSource();
    loadSafety().then(() => { if (state.view === 'safety') renderSafety(); }).catch(() => {});
    startWeather();
    if (state.channels.main) { try { sb.removeChannel(state.channels.main); } catch (_) {} }
    subscribeRealtime();
    refreshAll(true);
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
  }

  function isoWeekFromKey(dayKey) {
    const [y, m, d] = String(dayKey || '').split('-').map(Number);
    const date = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
    const dayNum = date.getUTCDay() || 7;
    date.setUTCDate(date.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    const week = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
    return { year: date.getUTCFullYear(), week };
  }
  function weekKeys(dayKey) {
    const [y, m, d] = String(dayKey || '').split('-').map(Number);
    const date = new Date(Date.UTC(y, (m || 1) - 1, d || 1));
    const day = date.getUTCDay() || 7;
    const monday = new Date(date);
    monday.setUTCDate(date.getUTCDate() - (day - 1));
    const keys = [];
    for (let i = 0; i < 7; i++) {
      const x = new Date(monday);
      x.setUTCDate(monday.getUTCDate() + i);
      keys.push(x.toISOString().slice(0, 10));
    }
    return keys;
  }
  function jobDateKeys(job) {
    const keys = [];
    if (job.job_date) keys.push(String(job.job_date).slice(0, 10));
    if (job.beam?.dueDate) {
      const due = new Date(job.beam.dueDate);
      if (!Number.isNaN(due.getTime())) keys.push(edmontonParts(due).dayKey);
    }
    for (const step of job.steps || []) {
      const iso = step.beam?.earlyStartIso;
      if (!iso) continue;
      const when = new Date(iso);
      if (!Number.isNaN(when.getTime())) keys.push(edmontonParts(when).dayKey);
    }
    return keys;
  }
  function samePlanningWeek(value, current) {
    const m = String(value || '').match(/(\d{4})\.(\d{1,2})/);
    return !!(m && current && Number(m[1]) === current.year && Number(m[2]) === current.week);
  }
  function renderTradeFilter() {
    const sel = $('#filter-trade');
    if (!sel) return;
    const cur = state.filters.trade || '';
    const trades = activeTrades();
    const extra = cur && !trades.some((t) => t.id === cur) ? [{ id: cur, label: tradeLabel(cur) }] : [];
    sel.innerHTML = '<option value="">All trades</option>' + trades.concat(extra).map((t) => '<option value="' + esc(t.id) + '"' + (cur === t.id ? ' selected' : '') + '>' + esc(t.label) + '</option>').join('');
  }
  function rememberFilters() {
    if (!state.user?.name) return;
    const { q, status, priority, trade, unit, pu, when } = state.filters;
    localStorage.setItem('bl_filters_' + state.user.name, JSON.stringify({ q, status, priority, trade, unit, pu, when }));
  }
  function restoreFilters() {
    try {
      const saved = JSON.parse(localStorage.getItem('bl_filters_' + (state.user?.name || '')) || 'null');
      if (!saved) return;
      state.filters = { q: '', status: '', priority: '', trade: '', unit: '', pu: '', when: '', ...saved };
    } catch { /* ignore */ }
  }
  function syncFilterControls() {
    if ($('#search')) $('#search').value = state.filters.q || '';
    if ($('#filter-status')) $('#filter-status').value = state.filters.status || '';
    if ($('#filter-priority')) $('#filter-priority').value = state.filters.priority || '';
    if ($('#filter-when')) $('#filter-when').value = state.filters.when || '';
    renderTradeFilter();
  }

  function filteredJobs() {
    let list = activeList().slice();
    const { q, status, priority, trade, unit, pu } = state.filters;
    if (q) {
      const qq = q.toLowerCase();
      list = list.filter((j) => {
        const place = puForUnit(j.unit);
        return [j.wo_number, j.title, j.equipment_tag, j.unit, j.area, j.description, j.sap_work_order, j.sap_notification, j.permit_vision_id, j.functional_location, j.pid_number, j.equipment_location, place.pu, place.site, beamText(j)].join(' ').toLowerCase().includes(qq);
      });
    }
    if (status === 'on_hold') list = list.filter((j) => j.on_hold);
    else if (status) list = list.filter((j) => j.status === status && !j.on_hold);
    if (priority) list = list.filter((j) => j.priority === priority);
    if (trade) list = list.filter((j) => j.steps.some((s) => s.trade === trade));
    if (pu) list = list.filter((j) => puForUnit(j.unit).pu === pu);
    if (unit) list = list.filter((j) => normalizeUnit(j.unit) === unit);
    if (state.filters.when) {
      const today = edmontonParts(new Date()).dayKey;
      const week = new Set(weekKeys(today));
      const current = isoWeekFromKey(today);
      list = list.filter((j) => {
        const dates = jobDateKeys(j);
        if (state.filters.when === 'today') return dates.includes(today);
        return dates.some((d) => week.has(d)) || samePlanningWeek(j.beam?.planningWeek, current);
      });
    }
    return list;
  }

  function jobCard(job) {
    const wait = waitingTrade(job);
    const mine = isMyTurn(job);
    const place = puForUnit(job.unit);
    const due = dueInfo(job);
    const steps = job.steps.map(tradePip).join('');
    const quiet = [
      job.equipment_tag ? 'Tag ' + job.equipment_tag : '',
      job.functional_location ? 'FL ' + job.functional_location : '',
      job.sap_notification ? 'Notif ' + job.sap_notification : '',
      job.permit_vision_id ? 'PV ' + job.permit_vision_id : '',
      job.pid_number ? 'P&ID ' + job.pid_number : '',
      job.equipment_location ? 'Loc ' + job.equipment_location : '',
    ].filter(Boolean);
    return '<article class="job-card priority-' + esc(job.priority) + (job.on_hold ? ' on-hold' : '') + (mine ? ' your-turn' : '') + '" data-id="' + job.id + '" data-pu="' + esc(place.pu) + '" data-site="' + esc(place.site) + '">' +
      '<div class="job-top"><div><div class="title">' + esc(job.title) + '</div><div class="job-kicker">' + esc(job.wo_number) + (job.functional_location ? ' · ' + esc(job.functional_location) : '') + '</div></div><div class="chip ' + (job.on_hold ? 'bad' : job.status === 'done' ? 'ok' : 'hot') + '">' + (job.on_hold ? 'ON HOLD' : esc(String(job.status).replace('_', ' '))) + '</div></div>' +
      '<div class="meta">' +
      '<span class="chip">' + esc(job.unit || '—') + '</span>' +
      (place.pu ? '<span class="chip pu">' + esc(place.pu) + '</span>' : '') +
      (job.demo ? '<span class="chip hot">DEMO</span>' : '') +
      '<span class="chip">' + esc(job.priority) + '</span>' +
      (due ? '<span class="chip ' + due.cls + '">' + esc(due.label) + '</span>' : '') +
      (wait ? '<span class="chip hot" style="--tc:' + esc(tradeColor(wait.trade)) + '">Waiting: ' + esc(tradeLabel(wait.trade)) + '</span>' : '') +
      (mine ? '<span class="chip hot">YOUR TURN</span>' : '') +
      '</div>' +
      (quiet.length ? '<div class="meta quiet">' + quiet.map((t) => '<span class="chip">' + esc(t) + '</span>').join('') + '</div>' : '') +
      '<div class="steps-mini">' + steps + '</div>' +
      (job.on_hold ? '<div style="margin-top:8px;color:var(--red);font-size:13px;font-weight:700">' + esc(job.hold_reason || '') + '</div>' : '') +
      '</article>';
  }

  function renderMiniStats() {
    const b = boardStats();
    $('#mini-stats').innerHTML =
      '<div class="stat ns"><div class="n">' + b.notStarted + '</div><div class="l">Not started</div></div>' +
      '<div class="stat ip"><div class="n">' + b.inProgress + '</div><div class="l">In progress</div></div>' +
      '<div class="stat hold"><div class="n">' + b.onHold + '</div><div class="l">On hold</div></div>' +
      '<div class="stat done"><div class="n">' + b.done + '</div><div class="l">Done</div></div>' +
      '<div class="stat wait"><div class="n">' + b.total + '</div><div class="l">Active jobs</div></div>';
  }
  function renderUnitFilterSelect() {
    const sel = $('#filter-unit');
    if (!sel) return;
    const cur = state.filters.unit || '';
    const seen = new Set();
    let html = '<option value="">All units</option>';
    for (const site of getSites()) {
      for (const pu of site.processUnits) {
        const opts = pu.units.map((u) => {
          const name = normalizeUnit(u) || u;
          seen.add(name);
          return '<option value="' + esc(name) + '"' + (cur === name ? ' selected' : '') + '>' + esc(name) + '</option>';
        }).join('');
        html += '<optgroup label="' + esc(site.name + ' · ' + pu.name) + '">' + opts + '</optgroup>';
      }
    }
    const rest = listUnits().filter((u) => !seen.has(u));
    if (rest.length) html += '<optgroup label="Other">' + rest.map((u) => '<option value="' + esc(u) + '"' + (cur === u ? ' selected' : '') + '>' + esc(u) + '</option>').join('') + '</optgroup>';
    sel.innerHTML = html;
  }
  function renderUnitTabs() {
    const el = $('#unit-tabs');
    const puEl = $('#pu-tabs');
    const savedUnit = state.filters.unit;
    const savedPu = state.filters.pu;
    state.filters.unit = '';
    state.filters.pu = '';
    const forPu = filteredJobs();
    state.filters.pu = savedPu;
    const forUnits = filteredJobs();
    state.filters.unit = savedUnit;
    state.filters.pu = savedPu;
    if (puEl) puEl.innerHTML = puTabsHtml(savedPu, forPu, 'jobs');
    if (el) el.innerHTML = unitTabsHtml(savedUnit, forUnits, 'jobs', unitsForPu(savedPu));
  }
  function renderJobList() {
    renderUnitTabs();
    renderUnitFilterSelect();
    renderTradeFilter();
    const list = filteredJobs();
    const host = $('#job-list');
    if (!list.length) { host.innerHTML = '<div class="empty"><strong>No jobs match</strong><p>Try an order number or functional location, or clear the filters.</p></div>'; return; }
    if (state.filters.unit) {
      host.innerHTML = list.map(jobCard).join('');
      return;
    }
    host.innerHTML = groupedSectionsHtml(list, '') || '<div class="empty">No jobs match.</div>';
  }
  function nameIs(value) {
    return String(value || '').trim().toLowerCase() === String(state.user?.name || '').trim().toLowerCase() && !!state.user?.name;
  }
  function myJobNote(job) {
    const bits = [];
    if (nameIs(job.created_by)) bits.push('Created');
    if (nameIs(job.completed_by)) bits.push('Completed');
    if ((job.comments || []).some((c) => nameIs(c.author_name))) bits.push('Commented');
    if ((job.steps || []).some((s) => (s.assignees || []).some((a) => nameIs(a.person_name) && a.signed_off))) bits.push('Signed off');
    if ((job.steps || []).some((s) => nameIs(s.permit_holder))) bits.push('Permit holder');
    if ((job.steps || []).some((s) => nameIs(s.skipped_by))) bits.push('Skipped a step');
    return bits.join(' · ') || 'Your name is on this job';
  }
  function isMyHistory(job) {
    if (!state.user?.name) return false;
    if (nameIs(job.created_by) || nameIs(job.completed_by) || nameIs(job.hold_by)) return true;
    if ((job.comments || []).some((c) => nameIs(c.author_name))) return true;
    return (job.steps || []).some((s) => nameIs(s.permit_holder) || nameIs(s.skipped_by) || nameIs(s.crew_updated_by) || (s.assignees || []).some((a) => nameIs(a.person_name)));
  }
  function renderHistory() {
    const host = $('#history-list');
    if (!host) return;
    const list = activeList().filter(isMyHistory);
    host.innerHTML = list.length ? list.map((job) => '<div class="history-job"><div class="meta" style="margin-bottom:6px"><span class="chip">' + esc(myJobNote(job)) + '</span></div>' + jobCard(job) + '</div>').join('') : '<div class="empty"><strong>No jobs yet</strong><p>Sign off, comment, or create a job and it will show up here under your name.</p></div>';
  }
  function renderMine() {
    const list = activeList().filter(isMyTurn);
    $('#mine-count').textContent = String(list.length);
    $('#mine-list').innerHTML = list.length ? list.map(jobCard).join('') : '<div class="empty"><strong>Nothing waiting</strong><p>' + (state.user?.trade ? 'No jobs are ready for ' + esc(tradeLabel(state.user.trade)) + '.' : 'Sign in as a trade role to see your work.') + '</p></div>';
  }
  function renderBoard() {
    const puFilter = state.boardPu || '';
    const unitFilter = state.boardUnit || '';
    let jobs = activeList().slice();
    const puTabs = $('#board-pu-tabs');
    if (puTabs) puTabs.innerHTML = puTabsHtml(puFilter, jobs, 'board');
    if (puFilter) jobs = jobs.filter((j) => puForUnit(j.unit).pu === puFilter);
    const tabs = $('#board-unit-tabs');
    if (tabs) tabs.innerHTML = unitTabsHtml(unitFilter, jobs, 'board', unitsForPu(puFilter));
    if (unitFilter) jobs = jobs.filter((j) => normalizeUnit(j.unit) === unitFilter);
    // stats for filtered set
    const byTradeWaiting = {};
    let notStarted = 0, inProgress = 0, done = 0, onHold = 0;
    for (const j of jobs) {
      if (j.on_hold) onHold++;
      else if (j.status === 'done') done++;
      else if (j.status === 'not_started') notStarted++;
      else inProgress++;
      const ready = waitingTrade(j);
      if (ready && !j.on_hold && j.status !== 'done') byTradeWaiting[ready.trade] = (byTradeWaiting[ready.trade] || 0) + 1;
    }
    $('#board-stats').innerHTML =
      '<div class="stat ns"><div class="n">' + notStarted + '</div><div class="l">Not started</div></div>' +
      '<div class="stat ip"><div class="n">' + inProgress + '</div><div class="l">In progress</div></div>' +
      '<div class="stat hold"><div class="n">' + onHold + '</div><div class="l">On hold</div></div>' +
      '<div class="stat done"><div class="n">' + done + '</div><div class="l">Done</div></div>' +
      '<div class="trade-wait-row" style="grid-column:1/-1">' + activeTrades().map((t) => '<span class="trade-wait" style="--tc:' + esc(t.color) + '"><span class="trade-dot"></span>' + esc(t.short) + ' ' + esc(t.label) + ' · ' + (byTradeWaiting[t.id] || 0) + '</span>').join('') + '</div>';
    const host = $('#board-list');
    if (!jobs.length) { host.innerHTML = '<div class="empty"><strong>Board is clear</strong><p>No jobs in this process unit.</p></div>'; return; }
    if (unitFilter) {
      host.innerHTML = '<div class="job-grid board">' + jobs.map(jobCard).join('') + '</div>';
      return;
    }
    host.innerHTML = groupedSectionsHtml(jobs, 'board') || '<div class="empty">No jobs on board.</div>';
  }
  function renderPlanner() { $('#planner-list').innerHTML = activeList().map(jobCard).join('') || '<div class="empty"><strong>No jobs yet</strong><p>Create one, or import a maintenance schedule.</p></div>'; }
  async function renderAudit() {
    const { data } = await sb.from('audit_log').select('*').order('created_at', { ascending: false }).limit(200);
    $('#audit-list').innerHTML = (data || []).map((a) =>
      '<div class="audit-item"><div class="t">' + fmtTime(a.created_at) + ' · ' + esc(a.actor_name || '—') + ' (' + esc(a.actor_role || '') + ')</div>' +
      '<div><strong>' + esc(a.action) + '</strong> ' + esc(a.detail || '') + '</div></div>'
    ).join('') || '<div class="empty">No audit events.</div>';
  }
  function renderDataSource() {
    const ds = state.settings?.data_source || {};
    $('#datasource-bar').innerHTML =
      '<span class="pill">Data source: ' + esc(ds.label || 'Supabase') + '</span>' +
      '<span class="pill">Last updated: ' + esc(ds.lastUpdated ? fmtTime(ds.lastUpdated) : '—') + '</span>' +
      '<span class="pill">Auth: demo</span>' +
      '<span class="pill">Region: ' + esc(cfg.region) + '</span>';
  }
  function readAppDraft() {
    const rows = $$('#app-edit-rows .app-edit-row');
    if (!rows.length) return;
    rows.forEach((row, i) => {
      const tile = state.tiles[i];
      if (!tile) return;
      tile.name = (row.querySelector('[data-k=name]')?.value || '').trim() || 'App';
      tile.url = (row.querySelector('[data-k=url]')?.value || '').trim();
      if (!tile.icon || tile.icon === '·') tile.icon = tile.name.replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase() || 'APP';
    });
  }
  async function saveAppTiles() {
    readAppDraft();
    const kept = [];
    for (let i = 0; i < state.tiles.length; i++) {
      const tile = state.tiles[i];
      const id = String(tile.id || ('app-' + Date.now() + '-' + i));
      tile.id = id;
      kept.push(id);
      const { error } = await sb.from('app_tiles').upsert({
        id, icon: tile.icon || 'APP', name: tile.name, url: tile.url || '', description: tile.description || '', sort_order: i + 1,
      });
      if (error) return toast(error.message);
    }
    const { data: existing, error: listError } = await sb.from('app_tiles').select('id');
    if (listError) return toast(listError.message);
    const drop = (existing || []).map((row) => row.id).filter((id) => !kept.includes(id));
    if (drop.length) {
      const { error } = await sb.from('app_tiles').delete().in('id', drop);
      if (error) return toast(error.message);
    }
    await loadMeta();
    renderApps();
    if (state.view === 'admin') renderAdmin();
    toast('Apps saved');
  }
  function renderApps() {
    const host = $('#app-tiles');
    if (!host) return;
    host.innerHTML = (state.tiles || []).map((t) => {
      const url = externalUrl(t.url);
      const body = '<div class="ico">' + esc(t.icon || '·') + '</div><div class="name">' + esc(t.name) + '</div><div class="desc">' + esc(t.description || '') + '</div>';
      if (url) return '<a class="app-tile" href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' + body + '</a>';
      return '<div class="app-tile disabled" aria-disabled="true">' + body + '<div class="not-configured">Link not set, admin can add</div></div>';
    }).join('') || '<div class="empty">No apps yet.</div>';
    const editor = $('#app-editor');
    if (!editor) return;
    if (!isRealAdmin()) { editor.classList.add('hidden'); editor.innerHTML = ''; return; }
    editor.classList.remove('hidden');
    editor.innerHTML = '<div class="app-edit"><h3 style="margin:0">Edit app links</h3>' +
      '<div id="app-edit-rows">' + (state.tiles || []).map((t, i) =>
        '<div class="app-edit-row" data-i="' + i + '"><input class="input" data-k="name" aria-label="Label" value="' + esc(t.name || '') + '" /><input class="input" data-k="url" aria-label="URL" placeholder="https://…" value="' + esc(t.url || '') + '" /><button type="button" class="btn btn-sm" data-app-remove="' + i + '">Remove</button></div>'
      ).join('') + '</div><div style="display:flex;gap:8px;flex-wrap:wrap"><button type="button" class="btn" id="app-add">Add app</button><button type="button" class="btn btn-primary" id="app-save">Save apps</button></div></div>';
    $('#app-add').onclick = () => {
      readAppDraft();
      state.tiles.push({ id: 'app-' + Date.now(), icon: '·', name: 'New app', url: '', description: '', sort_order: state.tiles.length + 1 });
      renderApps();
    };
    $('#app-save').onclick = () => saveAppTiles();
    editor.querySelectorAll('[data-app-remove]').forEach((btn) => {
      btn.onclick = () => {
        readAppDraft();
        state.tiles.splice(+btn.dataset.appRemove, 1);
        renderApps();
      };
    });
  }
  function renderDashboards() {
    const pbi = state.settings?.power_bi_embed || {};
    $('#pbi-title').textContent = pbi.title || 'Power BI';
    const open = $('#pbi-open');
    const embed = externalUrl(pbi.embedUrl);
    if (embed) {
      open.href = embed;
      open.hidden = false;
      open.style.display = '';
      $('#pbi-frame-wrap').innerHTML = '<iframe title="' + esc(pbi.title || 'Power BI') + '" src="' + esc(embed) + '" allowfullscreen></iframe>';
    } else {
      open.removeAttribute('href');
      open.hidden = true;
      open.style.display = 'none';
      $('#pbi-frame-wrap').innerHTML = '<div class="empty">No Power BI embed configured yet.</div>';
    }
  }
  function slugTrade(label, used) {
    const base = String(label || 'Trade').replace(/[^A-Za-z0-9]+/g, '') || 'Trade';
    if (!used.has(base)) return base;
    let n = 2;
    while (used.has(base + n)) n += 1;
    return base + n;
  }
  function readTradeDraftFromDom() {
    const rows = $$('#adm-trades .trade-edit');
    if (!rows.length) return;
    state.tradeDraft = rows.map((row, i) => ({
      id: state.tradeDraft?.[i]?.id || '',
      label: ($('[data-k=label]', row).value || '').trim() || 'Trade',
      short: ($('[data-k=short]', row).value || '').trim().toUpperCase().slice(0, 6) || 'T',
      color: $('[data-k=color]', row).value || '#334155',
      active: !!$('[data-k=active]', row).checked,
    }));
  }
  function renderTradeAdmin() {
    const host = $('#adm-trades');
    if (!host) return;
    if (!state.tradeDraft) state.tradeDraft = getTrades().map((t) => ({ ...t }));
    if (host.contains(document.activeElement)) return;
    host.innerHTML = state.tradeDraft.map((t, i) =>
      '<div class="trade-edit" data-i="' + i + '"><span class="trade-swatch" style="background:' + esc(t.color) + '"></span>' +
      '<input class="input" data-k="label" aria-label="Trade name" value="' + esc(t.label) + '" />' +
      '<input class="input" data-k="short" aria-label="Short code" maxlength="6" value="' + esc(t.short) + '" />' +
      '<input data-k="color" type="color" aria-label="Colour" value="' + ((/^#[0-9a-fA-F]{6}$/.test(t.color || '')) ? t.color : '#334155') + '" />' +
      '<label><input data-k="active" type="checkbox" ' + (t.active ? 'checked' : '') + ' /> Active</label>' +
      '<button type="button" class="btn btn-sm" data-move="up"' + (i === 0 ? ' disabled' : '') + '>Up</button>' +
      '<button type="button" class="btn btn-sm" data-move="down"' + (i === state.tradeDraft.length - 1 ? ' disabled' : '') + '>Down</button></div>'
    ).join('');
  }
  function tradesForSave() {
    if ($('#adm-trades')?.children.length) readTradeDraftFromDom();
    const draft = state.tradeDraft && state.tradeDraft.length ? state.tradeDraft : getTrades();
    const used = new Set();
    return draft.map((t) => {
      let id = String(t.id || '').trim();
      if (!id || used.has(id)) id = slugTrade(t.label, used);
      used.add(id);
      const color = /^#[0-9a-fA-F]{6}$/.test(t.color || '') ? t.color : '#334155';
      return { id, label: t.label || id, short: String(t.short || id).slice(0, 6).toUpperCase(), color, active: t.active !== false };
    });
  }
  function renderAdmin() {
    const tpl = state.settings?.url_templates || {};
    $('#adm-sap').value = tpl.sap || '';
    $('#adm-pv').value = tpl.permitVision || '';
    $('#adm-pbi-tpl').value = tpl.powerBi || '';
    if ($('#adm-twin')) $('#adm-twin').value = tpl.digitalTwin || '';
    if ($('#adm-pid')) $('#adm-pid').value = tpl.pid || '';
    if ($('#adm-pi')) $('#adm-pi').value = tpl.piVision || '';
    if ($('#adm-utl')) $('#adm-utl').value = tpl.utl || '';
    $('#adm-pbi-embed').value = state.settings?.power_bi_embed?.embedUrl || '';
    $('#adm-pbi-title').value = state.settings?.power_bi_embed?.title || 'Maintenance dashboard';
    const wind = state.settings?.data_source?.wind || {};
    if ($('#adm-wind-amber')) $('#adm-wind-amber').value = wind.amber || 30;
    if ($('#adm-wind-red')) $('#adm-wind-red').value = wind.red || 40;
    const unitsEl = $('#adm-units');
    if (unitsEl) unitsEl.value = getUnits().join('\n');
    const sitesEl = $('#adm-sites');
    if (sitesEl) sitesEl.value = formatSites(getSites());
    const mapEl = $('#adm-unit-map');
    if (mapEl) mapEl.value = formatUnitPatterns(getUnitPatterns());
    renderTradeAdmin();
    renderUsers();
    $('#adm-tiles').innerHTML = state.tiles.map((t, i) =>
      '<div class="tile-edit" data-i="' + i + '"><input class="input" data-k="icon" value="' + esc(t.icon || '') + '" /><input class="input" data-k="name" value="' + esc(t.name || '') + '" /><input class="input" data-k="url" value="' + esc(t.url || '') + '" placeholder="https://…" /><input class="input" data-k="description" value="' + esc(t.description || '') + '" style="grid-column:1/-1" /></div>'
    ).join('');
  }
  async function renderUsers() {
    const host = $('#adm-users');
    if (!host || !canManageUsers()) return;
    const { data, error } = await sb.from('profiles').select('*').order('created_at', { ascending: true });
    if (error) { host.innerHTML = '<p class="hold-banner">' + esc(error.message) + '</p>'; return; }
    const roles = (isRealAdmin() ? [{ id: 'Admin', label: 'Admin' }] : []).concat([
      { id: 'Planner', label: 'Planner' }, { id: 'Supervisor', label: 'Supervisor' }, { id: 'Operator', label: 'Operator' },
    ]).concat(activeTrades().map((t) => ({ id: t.id, label: t.label })));
    host.innerHTML = (data || []).map((p) => {
      const locked = p.role === 'Admin' && !isRealAdmin();
      const options = roles.map((r) => '<option value="' + esc(r.id) + '"' + (p.role === r.id ? ' selected' : '') + '>' + esc(r.label) + '</option>').join('');
      const actions = locked ? '' : '<button type="button" class="btn btn-sm btn-primary" data-user-act="approve">Approve</button><button type="button" class="btn btn-sm" data-user-act="set_role">Save role</button><button type="button" class="btn btn-sm" data-user-act="reject">Reject</button><button type="button" class="btn btn-sm" data-user-act="reset">Reset code</button>' + (p.status === 'deactivated' ? '<button type="button" class="btn btn-sm" data-user-act="reactivate">Reactivate</button>' : '<button type="button" class="btn btn-sm" data-user-act="deactivate">Deactivate</button>');
      return '<div class="user-row" data-user="' + esc(p.id) + '"><div><strong>' + esc(p.display_name) + '</strong><div style="color:var(--muted);font-size:13px">' + esc(p.status) + (p.requested_role && p.requested_role !== p.role ? ' · requested ' + esc(p.requested_role) : '') + '</div></div><select class="select" data-role' + (locked ? ' disabled' : '') + '>' + options + '</select><div>' + esc(tradeLabel(p.role)) + '</div><div>' + (p.last_sign_in_at ? 'Last sign-in ' + fmtTime(p.last_sign_in_at) : 'Never signed in') + '</div><div class="user-actions">' + actions + '</div></div>';
    }).join('') || '<div class="empty"><strong>No accounts yet</strong><p>New requests show up here.</p></div>';
    host.querySelectorAll('[data-user-act]').forEach((btn) => {
      btn.onclick = async () => {
        const row = btn.closest('[data-user]');
        const id = row.dataset.user;
        const role = row.querySelector('[data-role]')?.value || '';
        const act = btn.dataset.userAct;
        if (act === 'reset') {
          const code = prompt('New code (6 or more digits)');
          if (!code) return;
          if (!/^\d{6,}$/.test(code.trim())) return toast('Code must be 6 or more digits');
          const { error: resetError } = await sb.rpc('reset_user_code', { target: id, new_code: code.trim() });
          if (resetError) return toast(resetError.message);
          toast('Code reset');
          return;
        }
        const { error: manageError } = await sb.rpc('manage_account', { target: id, action: act, new_role: role });
        if (manageError) return toast(manageError.message);
        toast('Account updated');
        await renderUsers();
      };
    });
  }
  function renderAll() {
    renderMiniStats(); renderJobList(); renderMine(); renderBoard();
    if (state.view === 'history') renderHistory();
    if (state.view === 'planner') renderPlanner();
    if (state.view === 'audit') renderAudit();
    if (state.view === 'apps') renderApps();
    if (state.view === 'dash') renderDash();
    if (state.view === 'turn') renderTurnaround();
    if (state.view === 'safety') renderSafety();
    if (state.view === 'dashboards') renderDashboards();
    if (state.view === 'admin') renderAdmin();
    if (state.view === 'settings') renderSettings();
  }
  function setView(name) {
    state.view = name;
    $$('#main-tabs .tab').forEach((t) => t.classList.toggle('active', t.dataset.view === name));
    ['jobs', 'mine', 'history', 'board', 'dash', 'turn', 'safety', 'planner', 'apps', 'dashboards', 'admin', 'audit', 'security', 'settings'].forEach((v) => {
      $('#view-' + v).classList.toggle('hidden', v !== name);
    });
    renderAll();
  }

  function externalUrl(raw) {
    const s = String(raw || '').trim();
    return /^https?:\/\//i.test(s) ? s : '';
  }
  function fillTemplate(tpl, refs) {
    if (!tpl) return '';
    return String(tpl).replaceAll('{workOrder}', encodeURIComponent(refs.workOrder || ''))
      .replaceAll('{sapNotification}', encodeURIComponent(refs.sapNotification || ''))
      .replaceAll('{permitVision}', encodeURIComponent(refs.permitVision || ''))
      .replaceAll('{equipmentTag}', encodeURIComponent(refs.equipmentTag || ''))
      .replaceAll('{functionalLocation}', encodeURIComponent(refs.functionalLocation || ''))
      .replaceAll('{unit}', encodeURIComponent(refs.unit || ''))
      .replaceAll('{pidNumber}', encodeURIComponent(refs.pidNumber || ''))
      .replaceAll('{wo}', encodeURIComponent(refs.workOrder || ''));
  }
  function jobRefs(job) {
    return {
      workOrder: job.sap_work_order || job.wo_number || '',
      sapNotification: job.sap_notification || '',
      permitVision: job.permit_vision_id || '',
      equipmentTag: job.equipment_tag || '',
      functionalLocation: job.functional_location || '',
      unit: job.unit || '',
      pidNumber: job.pid_number || '',
    };
  }
  function templateReady(tpl, refs) {
    const raw = String(tpl || '').trim();
    if (!raw) return '';
    const tokenKey = {
      workOrder: 'workOrder', wo: 'workOrder', sapNotification: 'sapNotification', permitVision: 'permitVision',
      equipmentTag: 'equipmentTag', functionalLocation: 'functionalLocation', unit: 'unit', pidNumber: 'pidNumber',
    };
    const re = /\{(\w+)\}/g;
    let m;
    while ((m = re.exec(raw))) {
      const key = tokenKey[m[1]];
      if (key && !String(refs[key] || '').trim()) return '';
    }
    return externalUrl(fillTemplate(raw, refs));
  }
  function digitalTwinUrl(tpl, refs) {
    const raw = String(tpl || '');
    if (!raw.trim()) return '';
    const mentionsAsset = /\{(equipmentTag|functionalLocation)\}/.test(raw);
    if (!mentionsAsset && !String(refs.equipmentTag || '').trim() && !String(refs.functionalLocation || '').trim()) return '';
    return templateReady(raw, refs);
  }
  function pidLinkUrl(tpl, refs) {
    if (!String(tpl || '').trim() || !String(refs.pidNumber || '').trim()) return '';
    return templateReady(tpl, refs);
  }
  function piVisionUrl(tpl, refs) {
    if (!String(tpl || '').trim() || !String(refs.equipmentTag || '').trim()) return '';
    return templateReady(tpl, refs);
  }
  function disabledBtn(label) {
    return '<button type="button" class="btn btn-sm" disabled>' + esc(label) + ' — not configured yet</button>';
  }
  function launchAnchor(label, url) {
    if (!url) return disabledBtn(label);
    return '<a class="btn btn-sm" href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' + esc(label) + '</a>';
  }
  function edmontonParts(input) {
    const d = input ? new Date(input) : new Date();
    if (Number.isNaN(d.getTime())) return null;
    const zone = zoneName();
    return {
      stamp: fmtTime(d.toISOString()),
      dayKey: new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d),
    };
  }
  function fmtEdmonton(iso) { return fmtTime(iso); }
  function zoneHour(input) {
    const d = input ? new Date(input) : new Date();
    if (Number.isNaN(d.getTime())) return 0;
    const hour = new Intl.DateTimeFormat('en-US', { timeZone: zoneName(), hour: 'numeric', hourCycle: 'h23' }).formatToParts(d).find((p) => p.type === 'hour')?.value;
    const n = Number(hour);
    if (!Number.isFinite(n)) return 0;
    return n % 24;
  }
  function statusLabel(job) {
    if (job.on_hold || job.status === 'on_hold') return 'On hold';
    return ({ not_started: 'Not started', in_progress: 'In progress', done: 'Done' })[job.status] || String(job.status || '—').replaceAll('_', ' ');
  }
  function buildUtlLog(job, opts) {
    const notesMode = opts?.notes || 'all';
    const only = opts?.onlyComment || null;
    const now = edmontonParts();
    const wait = waitingTrade(job);
    const place = puForUnit(job.unit);
    const lines = [now.stamp];
    if (place.site || place.pu) lines.push('Process unit: ' + [place.site, place.pu].filter(Boolean).join(' · '));
    lines.push('Unit: ' + (job.unit || '—'));
    lines.push('WO #: ' + (job.wo_number || '—'));
    lines.push('SAP notification #: ' + (job.sap_notification || '—'));
    lines.push('Equipment tag: ' + (job.equipment_tag || '—'));
    if (job.equipment_location) lines.push('Equipment location: ' + job.equipment_location);
    if (job.pid_number) lines.push('P&ID / drawing #: ' + job.pid_number);
    lines.push('Job title: ' + (job.title || '—'));
    lines.push('Status: ' + statusLabel(job));
    lines.push('Waiting on: ' + (wait ? (wait.label + ' (' + wait.trade + ')') : (job.status === 'done' && !job.on_hold ? 'Complete — nothing waiting' : '—')));
    if (wait) {
      const crew = readCrew(wait);
      lines.push('Permit holder: ' + (crew.showValues && crew.holder ? crew.holder : '—'));
      lines.push('Radio channel: ' + (crew.showValues && crew.channel ? crew.channel : '—'));
      lines.push('Crew: ' + crew.sourceText);
    }
    lines.push('', 'Crew by step:');
    (job.steps || []).forEach((s) => {
      const crew = readCrew(s);
      const holder = crew.showValues && crew.holder ? crew.holder : '—';
      const channel = crew.showValues && crew.channel ? crew.channel : '—';
      lines.push('- ' + s.label + ' (' + s.trade + '): ' + holder + ' · ' + channel + ' — ' + crew.sourceText);
    });
    lines.push('', 'Sign-offs:');
    const signoffs = [];
    (job.steps || []).forEach((s) => {
      (s.assignees || []).filter((a) => a.signed_off).forEach((a) => {
        signoffs.push('- ' + s.trade + ' — ' + (a.person_name || '—') + ' — ' + (a.signed_at ? fmtEdmonton(a.signed_at) : '—'));
      });
    });
    lines.push(signoffs.length ? signoffs.join('\n') : '- none yet');
    lines.push('', 'Skipped:');
    const skipped = (job.steps || []).filter((s) => s.status === 'skipped');
    if (!skipped.length) lines.push('- none');
    else skipped.forEach((s) => lines.push('- ' + s.trade + ' — ' + s.label + ' — ' + (s.skipped_by || '—') + ' — ' + (s.skipped_at ? fmtEdmonton(s.skipped_at) : '—') + (s.skip_reason ? ' — ' + s.skip_reason : '')));
    if (job.completed_at) lines.push('', 'Completed: ' + (job.completed_by || '—') + ' — ' + fmtEdmonton(job.completed_at));
    lines.push('', 'Holds:');
    if (job.on_hold || job.hold_reason) {
      lines.push('- ' + (job.hold_reason || 'On hold') + (job.hold_by ? ' — ' + job.hold_by : '') + (job.hold_at ? ' — ' + fmtEdmonton(job.hold_at) : ''));
    } else lines.push('- none');
    let comments = (job.comments || []).slice();
    if (only) comments = [only];
    else if (notesMode === 'today') comments = comments.filter((c) => edmontonParts(c.created_at)?.dayKey === now.dayKey);
    comments.sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')));
    const noteLine = (c) => '- ' + fmtEdmonton(c.created_at) + ' — ' + (c.author_name || '—') + ' — ' + (c.author_role || '—') + ' — ' + (c.body || '') + (c.audio_path ? ' — voice note attached' : '');
    lines.push('', only ? 'Note:' : (notesMode === 'today' ? "Today's notes:" : 'Notes:'));
    if (!comments.length) lines.push('- ' + (notesMode === 'today' && !only ? 'none today' : 'none'));
    else if (only) lines.push(noteLine(comments[0]));
    else {
      const groups = [];
      const pushGroup = (title, items) => { if (items.length) groups.push({ title, items }); };
      pushGroup('Overview / permit', comments.filter((c) => commentSection(c) === 'overview'));
      (job.steps || []).forEach((s) => pushGroup(s.label + ' (' + s.trade + ')', comments.filter((c) => c.step_id === s.id)));
      pushGroup('Operators', comments.filter((c) => commentSection(c) === 'operators'));
      pushGroup('General', comments.filter((c) => commentSection(c) === 'general'));
      const claimed = new Set(groups.flatMap((g) => g.items.map((c) => c.id)));
      pushGroup('Other', comments.filter((c) => !claimed.has(c.id)));
      if (!groups.length) lines.push('- none');
      groups.forEach((g) => {
        lines.push(g.title + ':');
        g.items.forEach((c) => lines.push(noteLine(c)));
      });
    }
    return lines.join('\n');
  }
  function commentSection(c) {
    if (c.step_id) return 'step';
    if (c.section === 'overview' || c.channel === 'overview') return 'overview';
    if (c.section === 'operators' || c.channel === 'operators') return 'operators';
    return 'general';
  }
  function commentPhotos(c) {
    const list = [];
    const extra = Array.isArray(c.photo_paths) ? c.photo_paths : [];
    extra.forEach((url) => { if (url && !list.includes(url)) list.push(url); });
    if (c.photo_path && !list.includes(c.photo_path)) list.unshift(c.photo_path);
    return list;
  }
  async function copyText(text) {
    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(text);
        toast('Copied');
        return;
      }
    } catch { /* selectable fallback for iOS and older browsers */ }
    showCopyFallback(text);
  }
  function showCopyFallback(text) {
    document.getElementById('copy-fallback')?.remove();
    const wrap = document.createElement('div');
    wrap.id = 'copy-fallback';
    wrap.className = 'overlay copy-fallback';
    wrap.innerHTML = '<div class="modal" role="dialog" aria-label="Copy to UTL log"><div class="modal-head"><strong>Copy to UTL log</strong><button class="btn btn-sm" type="button" id="copy-fallback-close">Close</button></div><div class="modal-body"><p style="color:var(--muted);margin-top:0">Clipboard is not available in this browser. Select the text below and copy it.</p><textarea class="textarea" id="copy-fallback-text" readonly></textarea></div></div>';
    document.body.appendChild(wrap);
    const ta = wrap.querySelector('#copy-fallback-text');
    ta.value = text;
    const close = () => wrap.remove();
    wrap.querySelector('#copy-fallback-close').onclick = close;
    wrap.addEventListener('click', (e) => { if (e.target === wrap) close(); });
    setTimeout(() => { ta.focus(); ta.select(); }, 0);
  }
  function extractIframeSrc(input) {
    if (!input) return '';
    const s = String(input).trim();
    if (/^https?:\/\//i.test(s)) return s;
    const m = s.match(/src\s*=\s*["']([^"']+)["']/i);
    return m ? m[1] : '';
  }

  function openJob(id) {
    const job = state.jobs.find((j) => j.id === id);
    if (job) showJobModal(job);
  }

  function showJobModal(job) {
    const root = $('#modal-root');
    const plan = canPlan();
    const manage = canSupervise();
    const wait = waitingTrade(job);
    const place = puForUnit(job.unit);
    const tpl = state.settings?.url_templates || {};
    const refs = jobRefs(job);
    const utlHref = externalUrl(tpl.utl);
    const launchParts = [
      launchAnchor('Open in SAP', (tpl.sap && (job.sap_work_order || job.wo_number)) ? templateReady(tpl.sap, refs) : ''),
      launchAnchor('Open in Permit Vision', (tpl.permitVision && job.permit_vision_id) ? templateReady(tpl.permitVision, refs) : ''),
      launchAnchor('Open in Power BI', tpl.powerBi ? templateReady(tpl.powerBi, refs) : ''),
      launchAnchor('Digital twin', digitalTwinUrl(tpl.digitalTwin, refs)),
      launchAnchor('P&ID', pidLinkUrl(tpl.pid, refs)),
    ];
    const piUrl = piVisionUrl(tpl.piVision, refs);
    if (piUrl) launchParts.push('<a class="btn btn-sm" href="' + esc(piUrl) + '" target="_blank" rel="noopener noreferrer">Open in PI Vision</a>');
    const launchHtml = launchParts.join('');
    const utlOpen = utlHref
      ? '<a class="btn btn-sm" href="' + esc(utlHref) + '" target="_blank" rel="noopener noreferrer">Open UTL log</a>'
      : disabledBtn('Open UTL log');

    root.innerHTML = '<div class="overlay" id="job-overlay" data-job-id="' + esc(job.id) + '"><div class="modal" role="dialog">' +
      '<div class="modal-head"><div><div class="wo">' + esc(job.wo_number) + '</div><div class="title" style="margin:0">' + esc(job.title) + '</div>' +
      '<div class="meta" style="margin-top:8px"><span class="chip">' + esc(job.unit) + ' · ' + esc(job.area || '') + '</span>' +
      (place.pu ? '<span class="chip pu">' + esc((place.site ? place.site + ' · ' : '') + place.pu) + '</span>' : '') +
      '<span class="chip">' + esc(job.equipment_tag) + '</span><span class="chip">' + esc(job.priority) + '</span></div></div>' +
      '<div class="modal-head-actions"><button type="button" class="safety-link" data-open-safety="' + esc(job.unit || '') + '" aria-label="Safety for ' + esc(job.unit || 'this unit') + '"><svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true"><path fill="currentColor" d="M12 2.2 20 5.2v6.2c0 4.7-3.2 8-8 9.6-4.8-1.6-8-4.9-8-9.6V5.2L12 2.2z"/></svg> Safety</button><button class="btn btn-sm" id="close-modal">Close</button></div></div><div class="modal-body">' +
      (job.equipment_location ? '<div class="equip-loc"><span class="k">Equipment location</span><span class="v">' + esc(job.equipment_location) + '</span></div>' : '') +
      (job.on_hold ? '<div class="hold-banner">ON HOLD — ' + esc(job.hold_reason || '') + ' (' + esc(job.hold_by || '') + ')</div>' : '') +
      '<p style="color:var(--muted);margin-top:0">' + esc(job.description || '') + '</p>' +
      beamInfoHtml(job) +
      unitTapHtml(job) +
      '<div class="meta"><span class="chip">Permit: ' + esc(job.permit_number || '—') + '</span><span class="chip">LOTO: ' + esc(job.loto_isolation || '—') + '</span>' +
      '<span class="chip">SAP WO: ' + esc(job.sap_work_order || job.wo_number || '—') + '</span><span class="chip">SAP notif: ' + esc(job.sap_notification || '—') + '</span>' +
      '<span class="chip">PV: ' + esc(job.permit_vision_id || '—') + '</span><span class="chip">FLoc: ' + esc(job.functional_location || '—') + '</span>' +
      '<span class="chip">P&ID: ' + esc(job.pid_number || '—') + '</span>' +
      (wait ? '<span class="chip hot">Next: ' + esc(wait.label) + '</span>' : '') + '</div>' +
      '<div class="launch-row">' + launchHtml + '</div>' +
      '<div class="utl-row"><span class="utl-label">Copy to UTL log</span>' +
      '<button type="button" class="btn btn-sm btn-primary" data-utl="today">Today\'s notes only</button>' +
      '<button type="button" class="btn btn-sm" data-utl="all">All notes</button>' + utlOpen + '</div>' +
      '<div class="permit-status unavailable"><strong>UNAVAILABLE</strong> · source: Permit Vision (stub — not connected) · as of ' + fmtTime(new Date().toISOString()) +
      '<div>Live permit status unavailable. Do not treat as approved. Configure Permit Vision via Shell IT (see INTEGRATIONS.md).</div></div>' +
      '<p class="permit-status-note">External permit status is informational only. Grey/warning means not validated — never treat as approved.</p>' +
      '<section class="section-block"><h3>Overview / permit</h3>' + commentBox((job.comments || []).filter((c) => commentSection(c) === 'overview'), 'data-section="overview"', manage) + '</section>' +
      '<h3 style="margin-bottom:8px">Trade steps</h3><div class="step-list">' +
      job.steps.map((s) => stepHtml(s, job)).join('') +
      '</div><section class="section-block"><h3>Operators</h3>' + commentBox((job.comments || []).filter((c) => commentSection(c) === 'operators'), 'data-section="operators"', manage) + '</section>' +
      '<section class="section-block"><h3>General</h3>' + commentBox((job.comments || []).filter((c) => commentSection(c) === 'general'), 'data-section="general"', manage) + '</section>' +
      ((job.status === 'done' || job.completed_at)
        ? '<div class="complete-banner">Job complete' + (job.completed_by ? ' · ' + esc(job.completed_by) : '') + (job.completed_at ? ' · ' + fmtTime(job.completed_at) : '') + '<div>' + gotItHtml('job', job.id, job.id) + '</div></div>'
        : '') +
      '<h3 style="margin-top:20px">Audit trail</h3><div class="audit-list">' +
      (job.audit || []).slice(0, 40).map((a) => '<div class="audit-item"><div class="t">' + fmtTime(a.created_at) + ' · ' + esc(a.actor_name || '') + '</div><div><strong>' + esc(a.action) + '</strong> ' + esc(a.detail || '') + '</div></div>').join('') +
      '</div></div>' + (manage || plan ? '<div class="modal-dock">' +
      (manage ? (job.on_hold ? '<button class="btn btn-success btn-sm" data-act="clear-hold">Clear hold</button>' : '<button class="btn btn-danger btn-sm" data-act="hold">Flag on hold</button>') : '') +
      (plan ? '<button class="btn btn-sm" data-act="edit">Edit job</button><button class="btn btn-sm" data-act="archive">Archive</button>' : '') +
      (manage ? ((job.status === 'done' || job.completed_at)
        ? '<button type="button" class="btn btn-block" id="job-reopen">Reopen job</button>'
        : '<button type="button" class="btn btn-primary btn-block job-complete" id="job-complete">Job complete</button>') : '') +
      '</div>' : '') + '</div></div>';

    $$('[data-utl]', root).forEach((btn) => { btn.onclick = () => copyText(buildUtlLog(job, { notes: btn.dataset.utl })); });
    $$('[data-copy-comment]', root).forEach((btn) => {
      btn.onclick = () => {
        const comment = (job.comments || []).find((c) => c.id === btn.dataset.copyComment);
        if (comment) copyText(buildUtlLog(job, { onlyComment: comment }));
      };
    });
    $$('.thumb', root).forEach((img) => {
      img.onclick = () => {
        const box = document.createElement('div');
        box.className = 'overlay lightbox';
        box.innerHTML = '<img alt="Photo" src="' + esc(img.dataset.full || img.src) + '" /><button type="button" class="btn">Close</button>';
        const close = () => box.remove();
        box.querySelector('button').onclick = close;
        box.addEventListener('click', (e) => { if (e.target === box) close(); });
        document.body.appendChild(box);
      };
    });
    resolveThumbs(root);
    $('#close-modal').onclick = () => { root.innerHTML = ''; };
    $('#job-overlay').onclick = (e) => { if (e.target.id === 'job-overlay') root.innerHTML = ''; };

    root.querySelector('[data-open-safety]')?.addEventListener('click', () => {
      state.safetyUnit = root.querySelector('[data-open-safety]').dataset.openSafety || '';
      setView('safety');
      root.innerHTML = '';
    });
    root.querySelector('[data-act="hold"]')?.addEventListener('click', async () => {
      const reason = prompt('Hold reason (permit, scaffold, parts, isolation…)'); if (!reason) return;
      await sb.from('jobs').update({ on_hold: true, hold_reason: reason, hold_by: state.user.name, hold_at: new Date().toISOString(), status: 'on_hold', updated_at: new Date().toISOString() }).eq('id', job.id);
      await audit(job.id, 'hold', reason); await refreshAll(false); showJobModal(state.jobs.find((j) => j.id === job.id)); toast('Job on hold');
    });
    root.querySelector('[data-act="clear-hold"]')?.addEventListener('click', async () => {
      await sb.from('jobs').update({ on_hold: false, hold_reason: null, hold_by: null, hold_at: null, updated_at: new Date().toISOString() }).eq('id', job.id);
      await refreshStepReadiness(job.id); await audit(job.id, 'hold_cleared', 'Hold cleared'); await refreshAll(false); showJobModal(state.jobs.find((j) => j.id === job.id));
    });
    root.querySelector('[data-act="archive"]')?.addEventListener('click', async () => {
      if (!confirm('Archive this job?')) return;
      await sb.from('jobs').update({ archived: true, updated_at: new Date().toISOString() }).eq('id', job.id);
      await audit(job.id, 'archived', null); root.innerHTML = ''; await refreshAll(false); toast('Archived');
    });
    root.querySelector('[data-act="edit"]')?.addEventListener('click', () => openJobEditor(job));

    $$('.circle', root).forEach((c) => {
      c.onclick = async () => {
        const id = c.dataset.assignee; const signed = c.classList.contains('signed');
        if (state.demoOn) { demoToggleSign(job.id, id, signed); return; }
        if (!navigator.onLine) {
          await queueOffline({ id: 'q-' + Date.now(), kind: 'signoff', at: Date.now(), assigneeId: id, signed: !signed, name: state.user.name, jobId: job.id });
          toast('Saved on this device. It will send when you are back online.');
          return;
        }
        const step = job.steps.find((s) => (s.assignees || []).some((a) => a.id === id));
        if (!step || !canActOnStep(step)) return toast('That step belongs to another trade');
        try {
          if (signed) {
            const reason = prompt('Reason for un-signing (required for audit):'); if (!reason) return;
            await sb.from('step_assignees').update({ signed_off: false, signed_at: null }).eq('id', id);
            await audit(job.id, 'unsign', 'Un-signed: ' + reason);
          } else {
            if (job.on_hold) return toast('Job is on hold');
            await sb.from('step_assignees').update({ signed_off: true, signed_at: new Date().toISOString(), person_name: state.user.name }).eq('id', id);
            await audit(job.id, 'sign_off', state.user.name + ' signed off');
          }
          await refreshStepReadiness(job.id); await refreshAll(false); showJobModal(state.jobs.find((j) => j.id === job.id));
        } catch (e) { toast(e.message); }
      };
    });
    $$('[data-add-person]', root).forEach((btn) => {
      btn.onclick = async () => {
        const name = prompt('Person name to add:'); if (!name) return;
        await sb.from('step_assignees').insert({ step_id: btn.dataset.addPerson, person_name: name, signed_off: false });
        await audit(job.id, 'assignee_added', 'Added ' + name); await refreshStepReadiness(job.id); await refreshAll(false); showJobModal(state.jobs.find((j) => j.id === job.id));
      };
    });
    const reloadJob = async () => { await refreshAll(false); const next = state.jobs.find((j) => j.id === job.id); if (next) showJobModal(next); else root.innerHTML = ''; };
    $$('[data-set-unit]', root).forEach((btn) => {
      btn.onclick = async () => {
        const unit = btn.dataset.setUnit;
        const beam = { ...(job.beam || {}), unit_source: 'manual' };
        const { error } = await sb.from('jobs').update({ unit, beam, updated_at: new Date().toISOString() }).eq('id', job.id);
        if (error) return toast(error.message);
        await audit(job.id, 'unit_set', unit);
        await reloadJob();
        toast('Unit set to ' + unit);
      };
    });
    $$('[data-crew-field]', root).forEach((input) => {
      input.dataset.orig = input.value;
      const save = async () => {
        const value = input.value.trim();
        if (value === (input.dataset.orig || '').trim()) return;
        const step = job.steps.find((s) => s.id === input.dataset.step);
        if (!step) return;
        const field = input.dataset.crewField;
        const now = new Date().toISOString();
        const { error } = await sb.from('steps').update({ [field]: value, crew_source: 'manual', crew_updated_by: state.user.name, crew_updated_at: now }).eq('id', step.id);
        if (error) return toast(error.message);
        input.dataset.orig = value;
        await audit(job.id, field, (step.trade || step.label) + ': ' + (value || '(cleared)'));
        await reloadJob();
        toast(field === 'permit_holder' ? 'Permit holder saved' : 'Radio channel saved');
      };
      input.addEventListener('change', save);
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); input.blur(); } });
    });
    $$('[data-skip]', root).forEach((btn) => {
      btn.onclick = async () => {
        const step = job.steps.find((s) => s.id === btn.dataset.skip);
        if (!step) return;
        const reason = await chooseDialog({ title: 'Skip / Already complete', messageHtml: '<p>' + esc(step.label) + ' (' + esc(step.trade) + ')</p>', picks: ['Already done', 'Not required', 'Done by another crew'], allowEmpty: true, okLabel: 'Skip step' });
        if (reason === null) return;
        const now = new Date().toISOString();
        const { error } = await sb.from('steps').update({ status: 'skipped', skip_reason: reason || null, skipped_by: state.user.name, skipped_at: now }).eq('id', step.id);
        if (error) return toast(error.message);
        await audit(job.id, 'step_skipped', step.trade + ' — ' + step.label + (reason ? ' — ' + reason : ''));
        await refreshStepReadiness(job.id);
        await reloadJob();
        toast('Step skipped');
      };
    });
    $$('[data-unskip]', root).forEach((btn) => {
      btn.onclick = async () => {
        const step = job.steps.find((s) => s.id === btn.dataset.unskip);
        if (!step) return;
        const reason = await chooseDialog({ title: 'Undo skip', messageHtml: '<p>' + esc(step.label) + '</p>', picks: ['Needs to be done', 'Skipped by mistake'], allowEmpty: false, okLabel: 'Undo skip' });
        if (!reason) return;
        await sb.from('jobs').update({ completed_by: null, completed_at: null }).eq('id', job.id);
        const { error } = await sb.from('steps').update({ status: 'pending', skip_reason: null, skipped_by: null, skipped_at: null }).eq('id', step.id);
        if (error) return toast(error.message);
        await audit(job.id, 'step_unskipped', step.trade + ' — ' + step.label + ' — ' + reason);
        await refreshStepReadiness(job.id);
        await reloadJob();
        toast('Skip undone');
      };
    });
    $('#job-complete')?.addEventListener('click', async () => {
      const ok = await chooseDialog({ title: 'Mark this job complete?', messageHtml: '<p>This records who finished it and when, sets the job to Done, and updates the live board.</p>', okLabel: 'Job complete' });
      if (!ok) return;
      const fresh = state.jobs.find((j) => j.id === job.id) || job;
      const open = (fresh.steps || []).filter((s) => s.status !== 'done' && s.status !== 'skipped');
      if (open.length) {
        const reason = await chooseDialog({
          title: 'Steps still open',
          messageHtml: '<p>These steps are still open. Mark them skipped, or cancel.</p>' + open.map((s) => '<div>• ' + esc(s.label) + ' (' + esc(tradeLabel(s.trade)) + ')</div>').join(''),
          picks: ['Already done', 'Not required', 'Done by another crew'],
          allowEmpty: true,
          okLabel: 'Mark them skipped and complete',
        });
        if (reason === null) return;
        const note = reason || 'Skipped to complete the job';
        const now = new Date().toISOString();
        for (const s of open) {
          const { error } = await sb.from('steps').update({ status: 'skipped', skip_reason: note, skipped_by: state.user.name, skipped_at: now }).eq('id', s.id);
          if (error) return toast(error.message);
          await audit(job.id, 'step_skipped', s.trade + ' — ' + s.label + ' — ' + note);
        }
      }
      const now = new Date().toISOString();
      const { error } = await sb.from('jobs').update({ status: 'done', on_hold: false, completed_by: state.user.name, completed_at: now, updated_at: now }).eq('id', job.id);
      if (error) return toast(error.message);
      await audit(job.id, 'job_completed', state.user.name + ' marked the job complete');
      await reloadJob();
      toast('Job complete');
    });
    $('#job-reopen')?.addEventListener('click', async () => {
      const reason = await chooseDialog({ title: 'Reopen job', messageHtml: '<p>The job goes back to in progress.</p>', picks: ['More work found', 'Completed by mistake'], allowEmpty: false, okLabel: 'Reopen job' });
      if (!reason) return;
      const now = new Date().toISOString();
      const { error } = await sb.from('jobs').update({ status: 'in_progress', completed_by: null, completed_at: null, updated_at: now }).eq('id', job.id);
      if (error) return toast(error.message);
      await audit(job.id, 'job_reopened', reason);
      await reloadJob();
      toast('Job reopened');
    });
    $$('form.comment-form', root).forEach((form) => { wireVoice(form);
      form.onsubmit = async (e) => {
        e.preventDefault();
        const body = (form.body?.value || '').trim();
        const files = [...(form.querySelector('input[type=file]')?.files || [])];
        if (state.demoOn) {
          if (!body && !files.length) return toast('Comment required');
          job.comments = job.comments || [];
          job.comments.push({ id: 'demo-c-' + Date.now(), author_name: state.user.name, author_role: state.user.role, body: body || (form._voiceBlob ? '(voice note)' : '(photo)'), created_at: new Date().toISOString(), channel: form.dataset.step ? 'step' : 'general', section: form.dataset.section || null, step_id: form.dataset.step || null, audio_path: form._voiceBlob ? URL.createObjectURL(form._voiceBlob) : '' });
          showJobModal(job);
          toast('DEMO comment — not saved to the plant');
          return;
        }
        if (!navigator.onLine) {
          const buffers = [];
          for (const file of files) buffers.push(await file.arrayBuffer());
          const audioBuf = form._voiceBlob ? await form._voiceBlob.arrayBuffer() : null;
          await queueOffline({ id: 'q-' + Date.now(), kind: 'comment', at: Date.now(), jobId: job.id, stepId: form.dataset.step || null, section: form.dataset.section || null, body: body || (form._voiceBlob ? '(voice note)' : '(photo)'), name: state.user.name, role: state.user.realRole || state.user.role, photos: buffers, audio: audioBuf, audioType: form._voiceBlob?.type || '' });
          toast('Comment saved on this device. It will send when you are back online.');
          return;
        }
        let photos = [];
        if (files.length) {
          try { photos = await uploadPhotos(job.id, files); }
          catch (err) { return toast('Photo upload failed: ' + err.message); }
        }
        let audioPath = null;
        if (form._voiceBlob) {
          try { audioPath = await uploadAudio(job.id, form._voiceBlob); }
          catch (err) { return toast('Voice note upload failed: ' + err.message); }
        }
        if (!body && !photos.length && !audioPath) return toast('Comment required');
        const stepId = form.dataset.step || null;
        const section = stepId ? null : (form.dataset.section || 'general');
        const { error } = await sb.from('comments').insert({
          job_id: job.id, author_name: state.user.name, author_role: state.user.realRole || state.user.role,
          channel: stepId ? 'step' : section, section, step_id: stepId,
          body: body || (audioPath ? '(voice note)' : '(photo)'), photo_path: photos[0] || null, photo_paths: photos, audio_path: audioPath,
        });
        if (error) return toast(error.message);
        const where = stepId ? ((job.steps.find((s) => s.id === stepId)?.label) || 'step') : section;
        await audit(job.id, 'comment', where + ': ' + (body || '(photo)').slice(0, 80));
        await sb.from('jobs').update({ updated_at: new Date().toISOString() }).eq('id', job.id);
        await reloadJob();
        toast('Comment posted');
      };
    });
  }

  function voiceSpeech() {
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (ios) return null;
    return window.SpeechRecognition || window.webkitSpeechRecognition || null;
  }
  function commentCard(c) {
    const photos = commentPhotos(c).map((url) => '<img class="thumb" src="' + esc(url) + '" data-full="' + esc(url) + '" data-raw="' + esc(url) + '" alt="Photo" />').join('');
    const audio = c.audio_path ? '<audio class="voice-play" controls data-raw="' + esc(c.audio_path) + '"></audio>' : '';
    return '<div class="comment"><div class="who"><span>' + esc(c.author_name) + ' · ' + esc(c.author_role) + ' · ' + fmtTime(c.created_at) + '</span><button type="button" class="btn btn-sm" data-copy-comment="' + esc(c.id) + '">Copy to UTL log</button></div><div>' + esc(c.body) + '</div>' +
      (photos ? '<div class="comment-photos">' + photos + '</div>' : '') + audio + gotItHtml('comment', c.id, c.job_id) + '</div>';
  }
  function commentBox(items, attrs, allowForm) {
    const Speech = voiceSpeech();
    const voiceNote = !Speech ? '<p class="voice-hint">This browser can record audio only. It cannot write a transcript. You can still type the note.</p>' : '<p class="voice-hint">Hold the button, speak, then edit the text before you save.</p>';
    const form = allowForm === false ? '' : '<form class="comment-form" ' + attrs + '><label class="lbl">Add comment</label><textarea class="textarea" name="body" placeholder="Add a comment…"></textarea>' +
      '<div class="row"><button type="button" class="btn btn-sm voice-hold" data-voice>Hold to talk</button><input type="file" name="photos" accept="image/*" capture="environment" multiple /><button class="btn btn-primary btn-sm" type="submit">Add comment</button></div>' +
      voiceNote + '<audio class="voice-preview hidden" controls></audio></form>';
    return '<div class="comment-thread">' + (items.length ? items.map(commentCard).join('') : '<div class="empty">No comments yet.</div>') + form + '</div>';
  }
  const CREW_FRESH_MS = 15 * 60 * 1000;
  function readCrew(step) {
    if ((step.crew_source || 'manual') === 'permit_vision') return readPermitVisionCrew(step);
    const who = step.crew_updated_by ? ' · ' + step.crew_updated_by : '';
    const when = step.crew_updated_at ? ' · ' + fmtTime(step.crew_updated_at) : '';
    return { mode: 'manual', showValues: true, unavailable: false, holder: step.permit_holder || '', channel: step.radio_channel || '', sourceText: 'Entered manually' + who + when };
  }
  // Permit Vision adapter stub. Swap the body of this function when the feed exists.
  // Stale or unavailable data is never shown as a current permit holder or channel.
  function readPermitVisionCrew(step) {
    const connected = false;
    const at = step.crew_updated_at ? new Date(step.crew_updated_at).getTime() : NaN;
    const age = Number.isFinite(at) ? Date.now() - at : Infinity;
    const fresh = connected && age >= 0 && age <= CREW_FRESH_MS;
    if (!fresh) {
      return { mode: 'permit_vision', showValues: false, unavailable: true, holder: '', channel: '', sourceText: connected ? 'Permit Vision · stale — not validated' : 'Permit Vision unavailable — not validated' };
    }
    return { mode: 'permit_vision', showValues: true, unavailable: false, holder: step.permit_holder || '', channel: step.radio_channel || '', sourceText: 'From Permit Vision · updated ' + fmtTime(step.crew_updated_at) };
  }
  function crewPanel(step, prominent) {
    const crew = readCrew(step);
    const holder = crew.showValues ? crew.holder : '';
    const channel = crew.showValues ? crew.channel : '';
    return '<div class="crew-panel ' + (prominent ? 'prominent' : 'compact') + (crew.unavailable ? ' unavailable' : '') + '">' +
      '<label class="crew-field"><span class="k">Permit holder</span><input class="input" data-crew-field="permit_holder" data-step="' + step.id + '" value="' + esc(holder) + '" placeholder="Name"' + (step._locked ? ' readonly' : '') + ' /></label>' +
      '<label class="crew-field"><span class="k">Radio channel</span><input class="input" data-crew-field="radio_channel" data-step="' + step.id + '" value="' + esc(channel) + '" placeholder="Ch"' + (step._locked ? ' readonly' : '') + ' /></label>' +
      '<div class="crew-source">' + esc(crew.sourceText) + '</div></div>';
  }
  function stepHtml(s, job) {
    const act = canActOnStep(s);
    const canSign = act && !job.on_hold && (s.status === 'ready' || s.status === 'in_progress' || s.status === 'done');
    const skipped = s.status === 'skipped';
    const notes = (job.comments || []).filter((c) => c.step_id === s.id);
    const people = skipped ? '' : (s.assignees || []).map((a) => {
      const mine = state.user && a.person_name.toLowerCase() === state.user.name.toLowerCase();
      const readyMe = !a.signed_off && canSign && (mine || state.user?.trade === s.trade || canSupervise());
      return '<div class="person-sign"><button type="button" class="circle ' + (a.signed_off ? 'signed' : '') + (readyMe ? ' ready-me' : '') + '" data-assignee="' + a.id + '">' + (a.signed_off ? '✓' : '') + '</button>' +
        '<div class="person-name">' + esc(a.person_name) + '</div><div class="person-time">' + (a.signed_at ? fmtTime(a.signed_at) : (act ? 'tap to sign' : '')) + '</div></div>';
    }).join('') + (canPlan() ? '<button class="btn btn-sm" data-add-person="' + s.id + '">+ person</button>' : '');
    const skipControl = skipped
      ? '<div class="skip-banner">Skipped' + (s.skipped_by ? ' · ' + esc(s.skipped_by) : '') + (s.skipped_at ? ' · ' + fmtTime(s.skipped_at) : '') + (s.skip_reason ? ' — ' + esc(s.skip_reason) : '') + '</div>' + (act ? '<button type="button" class="btn btn-sm" data-unskip="' + s.id + '">Undo skip</button>' : '')
      : (act ? '<button type="button" class="btn btn-sm" data-skip="' + s.id + '">Skip / Already complete</button>' : '');
    const active = s.status === 'ready' || s.status === 'in_progress';
    const shown = { ...s, _locked: !act };
    return '<div class="step-row ' + s.status + '"><div class="step-head"><div class="step-label">' + esc(s.label) + ' <span class="chip" style="--tc:' + esc(tradeColor(s.trade)) + ';border-color:var(--tc)">' + esc(tradeLabel(s.trade)) + '</span></div><div class="chip' + (skipped ? ' skip' : '') + '">' + (skipped ? 'Skipped' : esc(String(s.status).replaceAll('_', ' '))) + '</div></div>' +
      ((s.status === 'done' || skipped) ? gotItHtml('step', s.id, job.id) : '') +
      crewPanel(shown, active) +
      beamStepHtml(s) +
      (people ? '<div class="assignees">' + people + '</div>' : '') + skipControl + commentBox(notes, 'data-step="' + s.id + '"', act) + '</div>';
  }
  function chooseDialog({ title, messageHtml, picks, allowEmpty, okLabel }) {
    return new Promise((resolve) => {
      const wrap = document.createElement('div');
      wrap.className = 'overlay reason-overlay';
      wrap.innerHTML = '<div class="modal" role="dialog" aria-label="' + esc(title) + '"><div class="modal-head"><strong>' + esc(title) + '</strong><button type="button" class="btn btn-sm" data-x="cancel">Cancel</button></div><div class="modal-body">' +
        (messageHtml || '') +
        (picks && picks.length ? '<div class="reason-picks">' + picks.map((p) => '<button type="button" class="btn btn-sm" data-pick="' + esc(p) + '">' + esc(p) + '</button>').join('') + '</div><textarea class="textarea" id="reason-text" placeholder="' + (allowEmpty ? 'Reason (optional)' : 'Reason') + '"></textarea>' : '') +
        '<div class="modal-actions" style="margin-top:12px"><button type="button" class="btn btn-primary" data-x="ok">' + esc(okLabel || 'OK') + '</button></div></div></div>';
      document.body.appendChild(wrap);
      wrap.querySelectorAll('[data-pick]').forEach((b) => b.onclick = () => {
        wrap.querySelectorAll('[data-pick]').forEach((x) => x.classList.toggle('on', x === b));
        const ta = wrap.querySelector('#reason-text');
        if (ta) ta.value = b.dataset.pick;
      });
      const finish = (val) => { wrap.remove(); resolve(val); };
      wrap.querySelector('[data-x="cancel"]').onclick = () => finish(null);
      wrap.addEventListener('click', (e) => { if (e.target === wrap) finish(null); });
      wrap.querySelector('[data-x="ok"]').onclick = () => {
        const text = (wrap.querySelector('#reason-text')?.value || '').trim();
        if (picks && !allowEmpty && !text) { toast('A reason is required'); return; }
        finish(picks ? text : true);
      };
    });
  }
  async function uploadPhotos(jobId, files) {
    const urls = [];
    for (const file of files) {
      const blob = await resizeImage(file, 1280);
      const path = jobId + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.jpg';
      const { error } = await sb.storage.from('comment-photos').upload(path, blob, { contentType: 'image/jpeg', upsert: false });
      if (error) throw error;
      const signed = await sb.storage.from('comment-photos').createSignedUrl(path, 60 * 60 * 24 * 7);
      urls.push(signed.data?.signedUrl || path);
    }
    return urls;
  }
  async function uploadAudio(jobId, blob) {
    const raw = blob.type || '';
    const mp4 = raw.includes('mp4');
    const ext = mp4 ? 'm4a' : 'webm';
    const contentType = mp4 ? 'audio/mp4' : 'audio/webm';
    const path = jobId + '/voice-' + Date.now() + '.' + ext;
    const { error } = await sb.storage.from('comment-photos').upload(path, blob, { contentType });
    if (error) throw error;
    return 'comment-photos/' + path;
  }
  function wireVoice(form) {
    const btn = form.querySelector('[data-voice]');
    if (!btn || btn.dataset.wired) return;
    btn.dataset.wired = '1';
    const hint = form.querySelector('.voice-hint');
    const ta = form.querySelector('textarea');
    const Speech = voiceSpeech();
    const canRec = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder);
    if (!canRec && !Speech) {
      btn.disabled = true;
      if (hint) hint.textContent = 'Voice notes are not available in this browser.';
      return;
    }
    let rec, stream, recognition, chunks;
    const stop = () => {
      btn.classList.remove('recording');
      if (recognition) { try { recognition.stop(); } catch (_) {} recognition = null; }
      if (rec && rec.state !== 'inactive') rec.stop();
    };
    btn.addEventListener('pointerdown', async (e) => {
      e.preventDefault();
      if (!canRec) { if (hint) hint.textContent = 'This browser cannot record audio.'; return; }
      btn.classList.add('recording');
      chunks = [];
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mime = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : (MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : '');
        rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
        rec.ondataavailable = (ev) => { if (ev.data && ev.data.size) chunks.push(ev.data); };
        rec.onstop = () => {
          stream.getTracks().forEach((t) => t.stop());
          form._voiceBlob = new Blob(chunks, { type: rec.mimeType || 'audio/webm' });
          const preview = form.querySelector('audio.voice-preview');
          if (preview) { preview.src = URL.createObjectURL(form._voiceBlob); preview.classList.remove('hidden'); }
        };
        rec.start();
      } catch (err) {
        btn.classList.remove('recording');
        if (hint) hint.textContent = 'Microphone was not allowed.';
        return;
      }
      if (!Speech) return;
      recognition = new Speech();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.onresult = (ev) => {
        let text = '';
        for (let i = 0; i < ev.results.length; i++) text += ev.results[i][0].transcript;
        if (ta) ta.value = text.trim();
      };
      try { recognition.start(); } catch (_) {}
    });
    btn.addEventListener('pointerup', stop);
    btn.addEventListener('pointercancel', stop);
    btn.addEventListener('pointerleave', (e) => { if (btn.classList.contains('recording') && e.buttons === 0) stop(); });
  }

  function resizeImage(file, max) {
    return new Promise((resolve, reject) => {
      const img = new Image(); const url = URL.createObjectURL(file);
      img.onload = () => {
        const scale = Math.min(1, max / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas'); canvas.width = Math.round(img.width * scale); canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height); URL.revokeObjectURL(url);
        canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('blob'))), 'image/jpeg', 0.8);
      };
      img.onerror = reject; img.src = url;
    });
  }

  function defaultAssignees(trade) {
    if (state.user?.name && state.user.trade === trade) return [{ person_name: state.user.name }];
    return [{ person_name: tradeLabel(trade) + ' crew' }];
  }

  function openJobEditor(existing) {
    const root = $('#modal-root');
    let steps = existing
      ? existing.steps.map((s) => ({ trade: s.trade, label: s.label, assignees: (s.assignees || []).map((a) => ({ person_name: a.person_name, person_id: a.person_id, signed_off: a.signed_off, signed_at: a.signed_at })) }))
      : TEMPLATES.full_valve.steps.map((s) => ({ ...s, assignees: defaultAssignees(s.trade) }));
    let addReverse = false;
    function renderEditor() {
      root.innerHTML = '<div class="overlay"><div class="modal"><div class="modal-head"><div><strong>' + (existing ? 'Edit job' : 'New job') + '</strong></div><button class="btn btn-sm" id="close-edit">Close</button></div><div class="modal-body">' +
        '<div class="filters" style="grid-template-columns:1fr 1fr">' +
        '<div><label class="lbl">Work order #</label><input class="input" id="f-wo" value="' + esc(existing?.wo_number || '') + '" /></div>' +
        '<div><label class="lbl">Priority</label><select class="select" id="f-pri">' + ['Critical', 'High', 'Normal', 'Low'].map((p) => '<option ' + ((existing?.priority || 'Normal') === p ? 'selected' : '') + '>' + p + '</option>').join('') + '</select></div>' +
        '<div style="grid-column:1/-1"><label class="lbl">Title</label><input class="input" id="f-title" value="' + esc(existing?.title || '') + '" /></div>' +
        '<div><label class="lbl">Unit</label><select class="select" id="f-unit">' + getUnits().map((u) => '<option value="' + esc(u) + '"' + ((existing?.unit ? normalizeUnit(existing.unit) : getUnits()[0]) === u ? ' selected' : '') + '>' + esc(u) + '</option>').join('') + '</select></div>' +
        '<div><label class="lbl">Area</label><input class="input" id="f-area" value="' + esc(existing?.area || '') + '" /></div>' +
        '<div><label class="lbl">Equipment tag</label><input class="input" id="f-tag" value="' + esc(existing?.equipment_tag || '') + '" /></div>' +
        '<div><label class="lbl">Date</label><input class="input" id="f-date" type="date" value="' + esc(existing?.job_date || new Date().toISOString().slice(0, 10)) + '" /></div>' +
        '<div><label class="lbl">Permit #</label><input class="input" id="f-permit" value="' + esc(existing?.permit_number || '') + '" /></div>' +
        '<div><label class="lbl">LOTO</label><input class="input" id="f-loto" value="' + esc(existing?.loto_isolation || '') + '" /></div>' +
        '<div><label class="lbl">SAP work order</label><input class="input" id="f-sap-wo" value="' + esc(existing?.sap_work_order || existing?.wo_number || '') + '" /></div>' +
        '<div><label class="lbl">SAP notification</label><input class="input" id="f-sap-not" value="' + esc(existing?.sap_notification || '') + '" /></div>' +
        '<div><label class="lbl">Permit Vision #</label><input class="input" id="f-pv" value="' + esc(existing?.permit_vision_id || '') + '" /></div>' +
        '<div><label class="lbl">Functional location</label><input class="input" id="f-floc" value="' + esc(existing?.functional_location || '') + '" /></div>' +
        '<div><label class="lbl">P&amp;ID / drawing #</label><input class="input" id="f-pid" value="' + esc(existing?.pid_number || '') + '" /></div>' +
        '<div><label class="lbl">Equipment location</label><input class="input" id="f-loc" placeholder="Area / elevation / grid" value="' + esc(existing?.equipment_location || '') + '" /></div>' +
        '<div style="grid-column:1/-1"><label class="lbl">Description</label><textarea class="textarea" id="f-desc">' + esc(existing?.description || '') + '</textarea></div></div>' +
        '<label class="lbl">Quick templates</label><div class="template-row">' + Object.entries(TEMPLATES).map(([k, v]) => '<button type="button" class="btn btn-sm" data-tpl="' + k + '">' + esc(v.name) + '</button>').join('') + '</div>' +
        '<label class="lbl">Tap trades to build sequence</label><div class="trade-chips">' + activeTrades().map((t) => '<button type="button" class="trade-chip" data-trade="' + t.id + '" style="--tc:' + esc(t.color) + '"><span class="trade-dot"></span>' + esc(t.short) + ' ' + esc(t.label) + '</button>').join('') +
        '<label style="display:flex;align-items:center;gap:8px;margin-left:8px"><input type="checkbox" id="f-reverse" ' + (addReverse ? 'checked' : '') + ' /> Add reverse steps</label></div>' +
        '<div id="step-editor"></div><button class="btn btn-primary btn-block" id="save-job" style="margin-top:16px">' + (existing ? 'Save changes' : 'Create job') + '</button></div></div></div>';
      $('#step-editor').innerHTML = steps.map((s, i) => '<div class="step-row" style="margin-top:8px"><div class="step-head"><strong>' + (i + 1) + '. ' + esc(s.label) + '</strong><div style="display:flex;gap:4px">' +
        '<button class="btn btn-sm" data-up="' + i + '" ' + (i === 0 ? 'disabled' : '') + '>↑</button><button class="btn btn-sm" data-down="' + i + '" ' + (i === steps.length - 1 ? 'disabled' : '') + '>↓</button><button class="btn btn-sm btn-danger" data-del="' + i + '">✕</button></div></div>' +
        '<input class="input" data-label="' + i + '" value="' + esc(s.label) + '" /></div>').join('') || '<div class="empty">Add trades or pick a template</div>';
      $$('[data-tpl]', root).forEach((b) => b.onclick = () => { steps = TEMPLATES[b.dataset.tpl].steps.map((s) => ({ ...s, assignees: defaultAssignees(s.trade) })); maybeReverse(); renderEditor(); });
      $$('.trade-chip', root).forEach((b) => b.onclick = () => { const trade = b.dataset.trade; steps.push({ trade, label: tradeLabel(trade) + ' — work', assignees: defaultAssignees(trade) }); maybeReverse(); renderEditor(); });
      $('#f-reverse').onchange = (e) => { addReverse = e.target.checked; maybeReverse(true); renderEditor(); };
      function maybeReverse() { steps = steps.filter((s) => !s._rev); if (addReverse) { const base = steps.slice(); steps = base.concat(base.slice().reverse().map((s) => ({ trade: s.trade, label: s.trade + ' — reinstate / close', assignees: defaultAssignees(s.trade), _rev: true }))); } }
      $$('[data-up]', root).forEach((b) => b.onclick = () => { const i = +b.dataset.up; [steps[i - 1], steps[i]] = [steps[i], steps[i - 1]]; renderEditor(); });
      $$('[data-down]', root).forEach((b) => b.onclick = () => { const i = +b.dataset.down; [steps[i + 1], steps[i]] = [steps[i], steps[i + 1]]; renderEditor(); });
      $$('[data-del]', root).forEach((b) => b.onclick = () => { steps.splice(+b.dataset.del, 1); renderEditor(); });
      $$('[data-label]', root).forEach((inp) => inp.onchange = () => { steps[+inp.dataset.label].label = inp.value; });
      $('#close-edit').onclick = () => { if (existing) showJobModal(existing); else root.innerHTML = ''; };
      $('#save-job').onclick = async () => {
        const payload = {
          wo_number: $('#f-wo').value.trim() || 'WO-TBD', title: $('#f-title').value.trim() || 'Untitled',
          unit: normalizeUnit($('#f-unit').value.trim()), area: $('#f-area').value.trim(), equipment_tag: $('#f-tag').value.trim(),
          priority: $('#f-pri').value, job_date: $('#f-date').value, permit_number: $('#f-permit').value.trim(),
          loto_isolation: $('#f-loto').value.trim(), sap_work_order: $('#f-sap-wo').value.trim(),
          sap_notification: $('#f-sap-not').value.trim(), permit_vision_id: $('#f-pv').value.trim(),
          functional_location: $('#f-floc').value.trim(), pid_number: $('#f-pid').value.trim(),
          equipment_location: $('#f-loc').value.trim(), description: $('#f-desc').value.trim(),
          updated_at: new Date().toISOString(),
        };
        if (!steps.length) return toast('Add at least one trade step');
        try {
          let jobId = existing?.id;
          if (existing) {
            await sb.from('jobs').update(payload).eq('id', existing.id);
            await sb.from('step_assignees').delete().in('step_id', existing.steps.map((s) => s.id));
            await sb.from('steps').delete().eq('job_id', existing.id);
            await audit(existing.id, 'job_updated', 'Job details updated');
          } else {
            const { data: job, error } = await sb.from('jobs').insert({ ...payload, created_by: state.user.name, status: 'not_started' }).select().single();
            if (error) throw error; jobId = job.id; await audit(jobId, 'job_created', 'Created ' + payload.wo_number);
          }
          for (let i = 0; i < steps.length; i++) {
            const { data: step, error } = await sb.from('steps').insert({ job_id: jobId, trade: steps[i].trade, label: steps[i].label, sort_order: i, status: 'pending' }).select().single();
            if (error) throw error;
            const assignees = steps[i].assignees?.length ? steps[i].assignees : defaultAssignees(steps[i].trade);
            await sb.from('step_assignees').insert(assignees.map((a) => ({ step_id: step.id, person_id: a.person_id || null, person_name: a.person_name, signed_off: !!a.signed_off, signed_at: a.signed_at || null })));
          }
          await refreshStepReadiness(jobId); await refreshAll(false); showJobModal(state.jobs.find((j) => j.id === jobId)); toast(existing ? 'Job updated' : 'Job created');
        } catch (e) { toast(e.message); }
      };
    }
    renderEditor();
  }

  function listUnits() {
    const u = getUnits();
    if (!u.some((x) => unitKey(x) === 'unassigned')) u.push('Unassigned');
    return u;
  }
  function getUnitPatterns() {
    const raw = state.settings?.data_source?.unit_patterns;
    if (Array.isArray(raw) && raw.length) return raw.map((p) => ({ pattern: String(p.pattern || '').trim(), unit: String(p.unit || '').trim() })).filter((p) => p.pattern && p.unit);
    return DEFAULT_UNIT_PATTERNS.map((p) => ({ ...p }));
  }
  function parseUnitPatterns(text) {
    return String(text || '').split(/\n/).map((line) => {
      const i = line.indexOf('=');
      if (i < 1) return null;
      return { pattern: line.slice(0, i).trim(), unit: line.slice(i + 1).trim() };
    }).filter((p) => p && p.pattern && p.unit);
  }
  function formatUnitPatterns(list) {
    return (list || []).map((p) => p.pattern + ' = ' + p.unit).join('\n');
  }
  function beamText(job) {
    const b = job.beam || {};
    return [b.planningWeek, b.plantSection, b.location, b.gsapUnit, b.orderType, b.userStatus, b.abc, b.leadDiscipline].filter(Boolean).join(' ');
  }
  function dueInfo(job) {
    const raw = job.beam?.dueDate;
    if (!raw) return null;
    const due = new Date(raw);
    if (Number.isNaN(due.getTime())) return null;
    const todayKey = edmontonParts(new Date()).dayKey;
    const dueKey = edmontonParts(due).dayKey;
    const parseKey = (key) => { const [y, m, d] = String(key || '').split('-').map(Number); return Date.UTC(y, (m || 1) - 1, d || 1); };
    const days = Math.round((parseKey(dueKey) - parseKey(todayKey)) / 86400000);
    const pretty = fmtDate(due);
    if (days < 0) return { kind: 'overdue', cls: 'hot', label: 'Overdue ' + pretty };
    if (days <= 7) return { kind: 'soon', cls: 'hot', label: 'Due soon ' + pretty };
    return { kind: 'ok', cls: 'ok', label: 'On time ' + pretty };
  }
  function beamInfoHtml(job) {
    const b = job.beam || {};
    const bits = [b.planningWeek && ('Week ' + b.planningWeek), b.plantSection && ('Section ' + b.plantSection), b.location && ('Loc ' + b.location), b.gsapUnit && ('GSAP ' + b.gsapUnit), b.orderType && ('Type ' + b.orderType), b.abc && ('ABC ' + b.abc), b.userStatus].filter(Boolean);
    const due = dueInfo(job);
    if (!bits.length && !due) return '';
    return '<div class="beam-info">' + bits.map((t) => '<span class="chip">' + esc(t) + '</span>').join('') + (due ? '<span class="chip ' + due.cls + '">' + esc(due.label) + '</span>' : '') + '</div>';
  }
  function unitTapHtml(job) {
    if (!canSupervise()) return '';
    return '<div class="unit-tap"><span class="lbl">Unit</span>' + listUnits().map((u) => '<button type="button" class="unit-chip' + (job.unit === u ? ' on' : '') + '" data-set-unit="' + esc(u) + '">' + esc(u) + '</button>').join('') + '</div>';
  }
  function beamStepHtml(s) {
    const b = s.beam || {};
    const chips = [b.workCenter, b.crew && ('Crew ' + b.crew), b.originalDuration && ('Orig ' + b.originalDuration), b.remDuration && ('Rem ' + b.remDuration), b.earlyStart && ('Start ' + b.earlyStart), b.cranes && ('Cranes ' + b.cranes)].filter(Boolean);
    if (!chips.length) return '';
    return '<div class="beam-step"><div class="meta">' + chips.map((t) => '<span class="chip">' + esc(t) + '</span>').join('') + '</div></div>';
  }
  function normBeamHeader(value) {
    return String(value ?? '').replace(/\([^)]*\)/g, ' ').replace(/[\r\n\t]+/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
  }
  function patternHits(hay, pattern) {
    const h = String(hay || '');
    const p = String(pattern || '');
    if (!p) return false;
    if (p.length <= 3 && /^[a-z0-9&]+$/i.test(p)) {
      const re = new RegExp('(^|[^A-Za-z0-9])' + p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '([^A-Za-z0-9]|$)', 'i');
      return re.test(h);
    }
    return h.toLowerCase().includes(p.toLowerCase());
  }
  function assignBeamUnit(parts) {
    const hay = [parts.plantSection, parts.location, parts.gsapUnit, parts.functionalLocation].filter(Boolean).join(' ');
    const patterns = getUnitPatterns().slice().sort((a, b) => b.pattern.length - a.pattern.length);
    for (const p of patterns) if (patternHits(hay, p.pattern)) return normalizeUnit(p.unit) || p.unit;
    return 'Unassigned';
  }
  function mapBeamPriority(raw) {
    const n = parseInt(String(raw ?? '').trim(), 10);
    if (n === 1) return 'Critical';
    if (n === 2) return 'High';
    if (n === 4 || n === 5) return 'Low';
    return 'Normal';
  }
  function parseBeamDate(value) {
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
    if (typeof value === 'number' && value > 20000 && value < 80000 && window.XLSX?.SSF?.parse_date_code) {
      const p = XLSX.SSF.parse_date_code(value);
      if (p) return new Date(p.y, p.m - 1, p.d, p.H || 0, p.M || 0, Math.round(p.S || 0));
    }
    const s = String(value ?? '').trim();
    if (!s) return null;
    const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
    if (m) return new Date(+m[3], +m[1] - 1, +m[2], +(m[4] || 0), +(m[5] || 0));
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  function fmtBeamDate(value) {
    const d = parseBeamDate(value);
    if (!d) return String(value ?? '').trim();
    return new Intl.DateTimeFormat('en-US', { month: 'numeric', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(d);
  }
  function equipmentTagFromFloc(floc) {
    const parts = String(floc || '').split(/[-./]/).map((s) => s.trim()).filter(Boolean);
    return parts.length ? parts[parts.length - 1] : '';
  }
  function beamToken(text, word) {
    return new RegExp('(^|[^A-Z0-9])' + word + '([^A-Z0-9]|$)').test(text);
  }
  function classifyBeamTrade(workCenter, lead) {
    const wc = String(workCenter || '').toUpperCase();
    const ld = String(lead || '').toUpperCase();
    const code = (wc.split(/[^A-Z0-9]+/).filter(Boolean).pop() || '');
    const text = (wc + ' ' + ld).replace(/\s+/g, ' ');
    const known = (trade) => ({ trade, known: true });
    if (code === 'INST' || code === 'INSTR' || /INSTR/.test(text)) return known('Instrumentation');
    if (code === 'INS' || /INSUL/.test(text)) return known('Insulator');
    if (code === 'HVAC' || beamToken(text, 'HVAC')) return known('HVAC');
    if (code === 'ELE' || /ELECTR/.test(text)) return known('Electrician');
    if (['PIP', 'FIT', 'MEC'].includes(code) || /PIPE\s*FIT|PIPEFIT/.test(text)) return known('Pipefitter');
    if (code === 'NDE' || code === 'INSP' || /INSPECT/.test(text)) return known('NDE');
    if (code === 'BM' || code === 'BLR' || beamToken(text, 'BOILER')) return known('Boilermaker');
    if (['SCAF', 'SCAFF', 'SCF', 'SCA'].includes(code) || /SCAFF/.test(text)) return known('Scaffold');
    if (code === 'CRN' || code === 'CRANE' || beamToken(text, 'CRANE')) return known('Crane');
    if (code === 'LBR' || beamToken(text, 'LABOUR') || beamToken(text, 'LABOR')) return known('Labourer');
    if (code === 'VAC' || beamToken(text, 'HYDROVAC') || /VAC\s*TRUCK/.test(text)) return known('VacTruck');
    if (code === 'TEAM' || code === 'STEAM' || code === 'STM' || beamToken(text, 'STEAM') || beamToken(text, 'TEAM')) return known('Team');
    const words = String(lead || '').replace(/\s+/g, ' ').trim().split(' ').filter((w) => !/^SCT-/i.test(w) && !/^[A-Z0-9]{2,5}-[A-Z0-9]{2,5}$/i.test(w));
    let name = words.join(' ').replace(/\s*-\s*FACILITIES.*/i, '').trim();
    if (name === name.toUpperCase() && name) name = name.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
    return { trade: name || workCenter || 'Other', known: false };
  }
  const BEAM_FIELDS = [
    ['planningWeek', ['planning week']],
    ['plantSection', ['a - plant section', 'plant section']],
    ['location', ['location']],
    ['gsapUnit', ['unit']],
    ['leadDiscipline', ['lead discipline']],
    ['orderType', ['order type']],
    ['abc', ['abc ind', 'abc']],
    ['activityId', ['activity id']],
    ['priority', ['p']],
    ['shortText', ['order short text']],
    ['functionalLocation', ['functional location']],
    ['workCenter', ['resource ids', 'work center']],
    ['activityName', ['activity name', 'operation short text']],
    ['crew', ['crew']],
    ['originalDuration', ['original duration']],
    ['remDuration', ['rem duration']],
    ['earlyStart', ['rem early start', 'basic start date']],
    ['lafd', ['order latest allowed finish', 'lafd']],
    ['basicFinish', ['order basic finish', 'gsap order finish', 'order finish date']],
    ['cranes', ['cranes am/pm', 'cranes']],
    ['userStatus', ['order user status', 'user status']],
  ];
  function detectBeamColumns(headerCells) {
    const norms = headerCells.map((h) => normBeamHeader(h));
    const used = new Set();
    const map = {};
    const aliases = BEAM_FIELDS.flatMap(([field, list]) => list.map((alias) => ({ field, alias }))).sort((a, b) => b.alias.length - a.alias.length);
    norms.forEach((norm, index) => {
      if (!norm || used.has(index)) return;
      const hit = aliases.find((a) => !map[a.field] && (norm === a.alias || (a.alias.length > 2 && norm.startsWith(a.alias))));
      if (!hit) return;
      map[hit.field] = index;
      used.add(index);
    });
    return map;
  }
  function beamHeaderScore(map) {
    return ['activityId', 'shortText', 'functionalLocation', 'workCenter', 'activityName'].filter((k) => map[k] != null).length;
  }
  function parseBeamMatrix(matrix) {
    let headerRow = -1;
    let map = null;
    for (let i = 0; i < Math.min(matrix.length, 30); i++) {
      const candidate = detectBeamColumns(matrix[i] || []);
      if (beamHeaderScore(candidate) >= 3) { headerRow = i; map = candidate; break; }
    }
    if (headerRow < 0) return { error: 'Could not find the maintenance schedule header row. Expected columns such as Activity ID and Order Short Text.' };
    let remembered = false;
    try {
      const saved = JSON.parse(localStorage.getItem('bl_beam_map') || 'null');
      const sig = (matrix[headerRow] || []).map(normBeamHeader).join('|');
      if (saved && saved.sig === sig && saved.map) { map = saved.map; remembered = true; }
    } catch { /* ignore */ }
    const orders = new Map();
    const skipped = [];
    for (let r = headerRow + 1; r < matrix.length; r++) {
      const row = matrix[r] || [];
      const cell = (key) => row[map[key]] ?? '';
      const blank = row.every((c) => String(c ?? '').trim() === '');
      if (blank) continue;
      const activityId = String(cell('activityId') ?? '').trim();
      if (!activityId) { skipped.push({ row: r + 1, reason: 'Missing Activity ID' }); continue; }
      const splitAt = activityId.indexOf('-');
      if (splitAt <= 0) { skipped.push({ row: r + 1, reason: 'Activity ID has no order-operation split: ' + activityId }); continue; }
      const orderNo = activityId.slice(0, splitAt).trim();
      const operation = activityId.slice(splitAt + 1).trim();
      if (!orderNo || !operation) { skipped.push({ row: r + 1, reason: 'Activity ID is incomplete: ' + activityId }); continue; }
      const floc = String(cell('functionalLocation') ?? '').trim();
      const classified = classifyBeamTrade(cell('workCenter'), cell('leadDiscipline'));
      const activityName = String(cell('activityName') ?? '').trim();
      const step = {
        operation, operationNum: parseInt(operation, 10) || 0, activityId,
        activityName, crew: String(cell('crew') ?? '').trim(),
        originalDuration: String(cell('originalDuration') ?? '').trim(),
        remDuration: String(cell('remDuration') ?? '').trim(),
        earlyStart: fmtBeamDate(cell('earlyStart')),
        earlyStartIso: parseBeamDate(cell('earlyStart'))?.toISOString() || '',
        cranes: String(cell('cranes') ?? '').trim(),
        workCenter: String(cell('workCenter') ?? '').trim(),
        leadDiscipline: String(cell('leadDiscipline') ?? '').trim(),
        trade: classified.trade, known: classified.known,
      };
      if (!orders.has(orderNo)) {
        orders.set(orderNo, {
          orderNo,
          shortText: String(cell('shortText') ?? '').trim(),
          planningWeek: String(cell('planningWeek') ?? '').trim(),
          plantSection: String(cell('plantSection') ?? '').trim(),
          location: String(cell('location') ?? '').trim(),
          gsapUnit: String(cell('gsapUnit') ?? '').trim(),
          leadDiscipline: step.leadDiscipline,
          orderType: String(cell('orderType') ?? '').trim(),
          abc: String(cell('abc') ?? '').trim(),
          priorityRaw: cell('priority'),
          functionalLocation: floc,
          userStatus: String(cell('userStatus') ?? '').trim(),
          lafd: parseBeamDate(cell('lafd')),
          basicFinish: parseBeamDate(cell('basicFinish')),
          steps: [],
        });
      }
      const order = orders.get(orderNo);
      if (!order.shortText && step) order.shortText = String(cell('shortText') ?? '').trim();
      if (order.steps.some((s) => s.operation === operation)) { skipped.push({ row: r + 1, reason: 'Duplicate operation ' + activityId }); continue; }
      order.steps.push(step);
    }
    const built = [...orders.values()].map((order) => {
      order.steps.sort((a, b) => a.operationNum - b.operationNum || a.operation.localeCompare(b.operation));
      const dates = [order.lafd, order.basicFinish].filter(Boolean).sort((a, b) => a - b);
      const due = dates[0] || null;
      const floc = order.functionalLocation;
      const unit = assignBeamUnit(order);
      return {
        ...order,
        due, unit,
        title: order.shortText || order.orderNo,
        equipmentTag: equipmentTagFromFloc(floc),
        priority: mapBeamPriority(order.priorityRaw),
        jobDate: due ? edmontonParts(due).dayKey : '',
      };
    });
    try {
      localStorage.setItem('bl_beam_map', JSON.stringify({ sig: (matrix[headerRow] || []).map(normBeamHeader).join('|'), map, at: new Date().toISOString() }));
    } catch { /* ignore */ }
    return { headerRow, map, remembered, orders: built, skipped, unassigned: built.filter((o) => o.unit === 'Unassigned').length };
  }
  function readBeamMatrix(file) {
    return file.arrayBuffer().then((buf) => {
      const wb = XLSX.read(buf, { type: 'array', cellDates: true });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      return XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true });
    });
  }
  async function commitBeamImport(parsed) {
    const wos = parsed.orders.map((o) => o.orderNo);
    const existing = [];
    for (let i = 0; i < wos.length; i += 40) {
      const { data, error } = await sb.from('jobs').select('*, steps(*)').in('wo_number', wos.slice(i, i + 40));
      if (error) throw error;
      existing.push(...(data || []));
    }
    const byWo = new Map(existing.map((j) => [j.wo_number, j]));
    let created = 0;
    let updated = 0;
    for (const order of parsed.orders) {
      const found = byWo.get(order.orderNo);
      const beam = {
        ...(found?.beam || {}),
        planningWeek: order.planningWeek, plantSection: order.plantSection, location: order.location,
        gsapUnit: order.gsapUnit, leadDiscipline: order.leadDiscipline, orderType: order.orderType,
        abc: order.abc, userStatus: order.userStatus, priorityRaw: String(order.priorityRaw ?? ''),
        dueDate: order.due ? order.due.toISOString() : '',
        source: 'beam',
        unit_source: found?.beam?.unit_source === 'manual' ? 'manual' : 'auto',
      };
      const jobPatch = {
        title: order.title,
        description: order.steps.map((s) => s.activityName).filter(Boolean).join(' · '),
        priority: order.priority,
        functional_location: order.functionalLocation,
        equipment_location: order.functionalLocation,
        equipment_tag: order.equipmentTag,
        sap_work_order: order.orderNo,
        job_date: order.jobDate || null,
        beam, updated_at: new Date().toISOString(),
      };
      if (beam.unit_source !== 'manual') jobPatch.unit = order.unit;
      let jobId = found?.id;
      if (!found) {
        const { data, error } = await sb.from('jobs').insert({ ...jobPatch, wo_number: order.orderNo, unit: order.unit, created_by: state.user.name, status: 'not_started' }).select().single();
        if (error) throw error;
        jobId = data.id;
        created++;
        await audit(jobId, 'job_created', 'Maintenance schedule ' + order.orderNo);
      } else {
        const { error } = await sb.from('jobs').update(jobPatch).eq('id', found.id);
        if (error) throw error;
        updated++;
        await audit(found.id, 'schedule_import', 'Updated from maintenance schedule');
      }
      const have = new Map((found?.steps || []).map((s) => [String((s.beam || {}).operation || ''), s]).filter(([k]) => k));
      for (const step of order.steps) {
        const prev = have.get(step.operation);
        const stepBeam = {
          operation: step.operation, activityId: step.activityId, activityName: step.activityName,
          crew: step.crew, originalDuration: step.originalDuration, remDuration: step.remDuration,
          earlyStart: step.earlyStart, earlyStartIso: step.earlyStartIso, cranes: step.cranes,
          workCenter: step.workCenter, leadDiscipline: step.leadDiscipline,
        };
        const label = step.activityName || (step.trade + ' — work');
        if (!prev) {
          const { data, error } = await sb.from('steps').insert({
            job_id: jobId, trade: step.trade, label, sort_order: step.operationNum, status: 'pending', beam: stepBeam,
          }).select().single();
          if (error) throw error;
          const people = step.known ? defaultAssignees(step.trade) : [{ person_name: step.crew || (step.trade + ' crew') }];
          await sb.from('step_assignees').insert(people.map((a) => ({ step_id: data.id, person_id: a.person_id || null, person_name: a.person_name, signed_off: false })));
        } else {
          const protectedStep = prev.status === 'skipped' || prev.status === 'done' || prev.status === 'in_progress';
          const patch = { label, sort_order: step.operationNum, beam: { ...(prev.beam || {}), ...stepBeam } };
          if (!protectedStep) patch.trade = step.trade;
          const { error } = await sb.from('steps').update(patch).eq('id', prev.id);
          if (error) throw error;
        }
      }
      const { data: steps } = await sb.from('steps').select('id,status').eq('job_id', jobId).order('sort_order');
      if (steps && !steps.some((s) => s.status === 'ready' || s.status === 'in_progress' || s.status === 'done')) {
        const next = steps.find((s) => s.status === 'pending');
        if (next) await sb.from('steps').update({ status: 'ready' }).eq('id', next.id);
      }
    }
    return { created, updated };
  }
  function openBeamImport() {
    if (state.demoOn) { toast('Exit demo before importing a real maintenance schedule.'); return; }
    const root = $('#modal-root');
    let parsed = null;
    root.innerHTML = '<div class="overlay"><div class="modal"><div class="modal-head"><strong>Import maintenance schedule</strong><button class="btn btn-sm" id="close-beam">Close</button></div><div class="modal-body">' +
      '<p style="color:var(--muted);margin-top:0">Drop the planning export here, or choose a file. .xlsx, .xls, and .csv. Columns are detected automatically. Re-import updates the same orders and does not touch sign-offs, comments, photos, skips, permit holders, or radio channels.</p>' +
      '<div class="dropzone" id="beam-drop">Drop the maintenance schedule here, or tap to choose</div>' +
      '<input id="beam-file" type="file" accept=".xlsx,.xls,.csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv" style="display:none" />' +
      '<div id="beam-summary"></div></div></div></div>';
    const drop = $('#beam-drop');
    const input = $('#beam-file');
    $('#close-beam').onclick = () => { root.innerHTML = ''; };
    drop.onclick = () => input.click();
    drop.ondragover = (e) => { e.preventDefault(); drop.classList.add('over'); };
    drop.ondragleave = () => drop.classList.remove('over');
    drop.ondrop = (e) => { e.preventDefault(); drop.classList.remove('over'); if (e.dataTransfer.files[0]) take(e.dataTransfer.files[0]); };
    input.onchange = () => { if (input.files[0]) take(input.files[0]); };
    async function take(file) {
      try {
        const matrix = await readBeamMatrix(file);
        parsed = parseBeamMatrix(matrix);
        if (parsed.error) { $('#beam-summary').innerHTML = '<p class="hold-banner">' + esc(parsed.error) + '</p>'; return; }
        const steps = parsed.orders.reduce((n, o) => n + o.steps.length, 0);
        $('#beam-summary').innerHTML = '<div class="stats" style="margin-top:14px"><div class="stat"><div class="n">' + parsed.orders.length + '</div><div class="l">Orders</div></div><div class="stat"><div class="n">' + steps + '</div><div class="l">Operations</div></div><div class="stat"><div class="n">' + parsed.unassigned + '</div><div class="l">Unassigned</div></div><div class="stat"><div class="n">' + parsed.skipped.length + '</div><div class="l">Skipped rows</div></div></div>' +
          '<p style="color:var(--muted)">Priority: 1 Critical, 2 High, 3 or blank Normal, 4–5 Low. Due date is the earlier of LAFD and basic finish. On time is green. Due within 7 days, and overdue, are amber.</p>' +
          (parsed.remembered ? '<p>Using the column mapping remembered from last time.</p>' : '<p>Column mapping detected from the header row (row ' + (parsed.headerRow + 1) + ').</p>') +
          (parsed.skipped.length ? '<div class="audit-list">' + parsed.skipped.slice(0, 12).map((s) => '<div class="audit-item">Row ' + s.row + ': ' + esc(s.reason) + '</div>').join('') + '</div>' : '') +
          '<button class="btn btn-primary btn-block" id="beam-go" style="margin-top:14px">Import</button>';
        $('#beam-go').onclick = async () => {
          $('#beam-go').disabled = true;
          try {
            const result = await commitBeamImport(parsed);
            const ds = { ...(state.settings?.data_source || {}), beam_header_map: { map: parsed.map, at: new Date().toISOString() }, adapter: 'excel', label: 'Maintenance schedule → Supabase', lastUpdated: new Date().toISOString() };
            await sb.from('app_settings').upsert({ id: 'default', data_source: ds, updated_at: new Date().toISOString() });
            await loadMeta();
            toast(result.created + ' new, ' + result.updated + ' updated');
            await refreshAll(true);
            root.innerHTML = '';
            setView('jobs');
          } catch (err) { $('#beam-go').disabled = false; toast(err.message); }
        };
      } catch (err) { toast(err.message); }
    }
  }

  function openImport() {
    const root = $('#modal-root');
    let preview = null; let mapping = {};
    root.innerHTML = '<div class="overlay"><div class="modal"><div class="modal-head"><strong>Import backlog</strong><button class="btn btn-sm" id="close-imp">Close</button></div><div class="modal-body"><p style="color:var(--muted)">Upload .xlsx / .csv. Map columns, pick a default template, then import (client-side SheetJS → Supabase). Process unit is derived from the unit (Upgrader South → PU1 / PU2). Permit holder and radio channel from the sheet are written on the first trade step; each later trade fills in its own.</p><input type="file" id="imp-file" accept=".xlsx,.xls,.csv" /><div id="imp-body"></div></div></div></div>';
    $('#close-imp').onclick = () => { root.innerHTML = ''; };
    $('#imp-file').onchange = async (e) => {
      const file = e.target.files[0]; if (!file) return;
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf); const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      preview = { headers: rows.length ? Object.keys(rows[0]) : [], rows, allRows: rows, total: rows.length };
      autoMap(); drawImport();
    };
    const fields = [['wo_number','Work Order'],['sap_work_order','SAP Work Order'],['sap_notification','SAP Notification'],['permit_vision_id','Permit Vision #'],['functional_location','Functional Location'],['pid_number','P&ID / drawing #'],['equipment_location','Equipment location'],['permit_holder','Permit holder'],['radio_channel','Radio channel'],['title','Title'],['description','Description'],['unit','Unit'],['area','Area'],['equipment_tag','Tag'],['priority','Priority'],['job_date','Date'],['permit_number','Permit'],['loto_isolation','LOTO'],['trades','Trades']];
    function autoMap() {
      mapping = {};
      const guess = { wo_number:[/work\s*order/i,/^wo$/i], sap_work_order:[/sap\s*work/i], sap_notification:[/notif/i], permit_vision_id:[/permit\s*vision/i], functional_location:[/functional/i,/floc/i], pid_number:[/p\s*&?\s*id/i,/\bpid\b/i,/drawing/i], equipment_location:[/equip.*loc/i,/^location$/i,/elevation/i,/^grid$/i], permit_holder:[/permit\s*holder/i,/^holder$/i], radio_channel:[/radio/i], title:[/^title$/i], description:[/desc/i,/title/i], unit:[/unit/i], area:[/area/i], equipment_tag:[/^tag$/i,/equip.*tag/i,/equipment(?!\s*loc)/i], priority:[/prior/i], job_date:[/date/i], permit_number:[/^permit$/i,/ptw/i], loto_isolation:[/loto/i], trades:[/trade/i] };
      for (const [field, rxList] of Object.entries(guess)) { const hit = preview.headers.find((h) => rxList.some((rx) => rx.test(h))); if (hit) mapping[field] = hit; }
      if (!mapping.title && mapping.description) mapping.title = mapping.description;
    }
    function drawImport() {
      $('#imp-body').innerHTML = '<p><strong>' + preview.total + '</strong> rows</p><div class="table-wrap"><table><thead><tr>' + preview.headers.map((h) => '<th>' + esc(h) + '</th>').join('') + '</tr></thead><tbody>' +
        preview.rows.slice(0, 8).map((r) => '<tr>' + preview.headers.map((h) => '<td>' + esc(String(r[h] ?? '')) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div><h3>Column mapping</h3><div class="import-map">' +
        fields.map(([k, label]) => '<div class="row"><label class="lbl">' + label + '</label><select class="select" data-map="' + k + '"><option value="">—</option>' + preview.headers.map((h) => '<option value="' + esc(h) + '" ' + (mapping[k] === h ? 'selected' : '') + '>' + esc(h) + '</option>').join('') + '</select></div>').join('') +
        '</div><label class="lbl" style="margin-top:12px">Default trade template</label><select class="select" id="imp-tpl">' + Object.entries(TEMPLATES).map(([k, v]) => '<option value="' + k + '">' + esc(v.name) + '</option>').join('') + '</select>' +
        '<button class="btn btn-primary btn-block" id="imp-go" style="margin-top:14px">Import ' + preview.total + ' jobs</button>';
      $$('[data-map]').forEach((s) => s.onchange = () => { mapping[s.dataset.map] = s.value; });
      $('#imp-go').onclick = async () => {
        try {
          let n = 0;
          for (const row of preview.allRows) {
            const get = (f) => mapping[f] ? String(row[mapping[f]] ?? '').trim() : '';
            let tplKey = $('#imp-tpl').value;
            const hint = get('trades').toLowerCase();
            if (hint) { const match = Object.entries(TEMPLATES).find(([, v]) => v.name.toLowerCase() === hint || hint.includes(v.name.toLowerCase().split(' ')[0])); if (match) tplKey = match[0]; }
            const tpl = TEMPLATES[tplKey];
            const { data: job, error } = await sb.from('jobs').insert({
              wo_number: get('wo_number') || 'WO-' + Date.now().toString().slice(-6),
              title: get('title') || get('description') || 'Imported job', description: get('description') || get('title') || '',
              unit: normalizeUnit(get('unit')), area: get('area'), equipment_tag: get('equipment_tag'), priority: get('priority') || 'Normal',
              job_date: get('job_date') || new Date().toISOString().slice(0, 10), permit_number: get('permit_number'), loto_isolation: get('loto_isolation'),
              sap_work_order: get('sap_work_order') || get('wo_number'), sap_notification: get('sap_notification'), permit_vision_id: get('permit_vision_id'),
              functional_location: get('functional_location'), pid_number: get('pid_number'), equipment_location: get('equipment_location'),
              created_by: state.user.name, status: 'not_started',
            }).select().single();
            if (error) throw error;
            for (let i = 0; i < tpl.steps.length; i++) {
              const { data: step } = await sb.from('steps').insert({ job_id: job.id, trade: tpl.steps[i].trade, label: tpl.steps[i].label, sort_order: i, status: i === 0 ? 'ready' : 'pending' }).select().single();
              if (i === 0 && (get('permit_holder') || get('radio_channel'))) {
                await sb.from('steps').update({ permit_holder: get('permit_holder'), radio_channel: get('radio_channel'), crew_source: 'manual', crew_updated_by: state.user.name, crew_updated_at: new Date().toISOString() }).eq('id', step.id);
              }
              await sb.from('step_assignees').insert(defaultAssignees(tpl.steps[i].trade).map((a) => ({ step_id: step.id, person_id: a.person_id || null, person_name: a.person_name, signed_off: false })));
            }
            await audit(job.id, 'job_created', 'Imported ' + job.wo_number); n++;
          }
          await sb.from('app_settings').upsert({ id: 'default', data_source: { ...(state.settings?.data_source || {}), adapter: 'excel', label: 'Excel / CSV import → Supabase', lastUpdated: new Date().toISOString(), units: getUnits(), sites: getSites() }, updated_at: new Date().toISOString() });
          await loadMeta(); toast('Imported ' + n + ' jobs'); await refreshAll(true); root.innerHTML = ''; setView('jobs');
        } catch (err) { toast(err.message); }
      };
    }
  }

  function exportExcel() {
    const rows = state.jobs.map((j) => {
      const waiting = waitingTrade(j);
      const place = puForUnit(j.unit);
      return { 'Work Order': j.wo_number, 'SAP Work Order': j.sap_work_order, 'SAP Notification': j.sap_notification, 'Permit Vision': j.permit_vision_id, 'Functional Location': j.functional_location, 'P&ID': j.pid_number || '', 'Equipment location': j.equipment_location || '', 'Permit holder': waiting?.permit_holder || '', 'Radio channel': waiting?.radio_channel || '', Title: j.title, Unit: j.unit, PU: place.pu, Site: place.site, Area: j.area, Tag: j.equipment_tag, Priority: j.priority, Status: j.status, 'On Hold': j.on_hold ? 'Yes' : 'No', 'Hold Reason': j.hold_reason || '', 'Waiting On': waiting ? waiting.trade : '', Permit: j.permit_number, LOTO: j.loto_isolation, Date: j.job_date, 'Step crews': (j.steps || []).map((s) => s.trade + ': ' + (s.permit_holder || '—') + ' / ' + (s.radio_channel || '—')).join(' > '), Steps: j.steps.map((s) => s.label + ' [' + s.status + ']').join(' > ') };
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Jobs');
    XLSX.writeFile(wb, 'beamlock-export.xlsx');
  }

  function canSeeDash() { return isApproved() && ['Supervisor', 'Planner', 'Admin'].includes(state.user?.role); }
  function dayKeyOffset(n) {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return edmontonParts(d).dayKey;
  }
  function dueBucket(job) {
    const raw = job.beam?.dueDate || (job.job_date ? job.job_date + 'T16:00:00' : '');
    if (!raw) return '';
    const key = edmontonParts(new Date(raw)).dayKey;
    const today = dayKeyOffset(0);
    if (key < today) return 'overdue';
    if (key === today) return 'today';
    if (key <= dayKeyOffset(7)) return 'week';
    return 'later';
  }
  function renderDash() {
    const host = $('#dash-body');
    if (!host) return;
    const jobs = activeList().filter((j) => !j.archived);
    const units = [];
    for (const site of getSites()) for (const pu of site.processUnits) for (const unit of pu.units) if (!units.includes(unit)) units.push(unit);
    const unitRows = units.map((unit) => {
      const list = jobs.filter((j) => normalizeUnit(j.unit) === unit);
      const done = list.filter((j) => j.status === 'done').length;
      const pct = list.length ? Math.round(done / list.length * 100) : 0;
      const place = puForUnit(unit);
      return { unit, pu: place.pu, total: list.length, done, pct };
    }).filter((r) => r.total);
    const puMap = {};
    for (const row of unitRows) {
      const key = row.pu || 'Other';
      puMap[key] = puMap[key] || { total: 0, done: 0 };
      puMap[key].total += row.total;
      puMap[key].done += row.done;
    }
    const counts = { overdue: 0, today: 0, week: 0 };
    for (const job of jobs) {
      if (job.status === 'done') continue;
      const bucket = dueBucket(job);
      if (counts[bucket] != null) counts[bucket]++;
    }
    const openSteps = [];
    for (const job of jobs) {
      if (job.status === 'done') continue;
      for (const step of job.steps || []) {
        if (step.status !== 'ready' && step.status !== 'in_progress') continue;
        const started = step.beam?.earlyStartIso || job.beam?.dueDate || job.created_at || 0;
        openSteps.push({ trade: step.trade, label: step.label, wo: job.wo_number, when: new Date(started).getTime() || 0, hold: job.on_hold });
      }
    }
    openSteps.sort((a, b) => a.when - b.when);
    host.innerHTML = '<div class="stats">' +
      '<div class="stat hold"><div class="n">' + counts.overdue + '</div><div class="l">Overdue</div></div>' +
      '<div class="stat wait"><div class="n">' + counts.today + '</div><div class="l">Due today</div></div>' +
      '<div class="stat ip"><div class="n">' + counts.week + '</div><div class="l">Due this week</div></div>' +
      '<div class="stat"><div class="n">' + jobs.length + '</div><div class="l">Jobs in view</div></div></div>' +
      '<div class="dash-grid"><div class="tile-edit"><h3>Complete by unit</h3>' +
      (unitRows.map((r) => '<div class="bar-row"><span>' + esc(r.unit) + (r.pu ? ' · ' + esc(r.pu) : '') + '</span><div class="bar"><span style="width:' + r.pct + '%"></span></div><strong>' + r.pct + '%</strong></div>').join('') || '<p>No jobs.</p>') +
      '</div><div class="tile-edit"><h3>Complete by process unit</h3>' +
      Object.entries(puMap).map(([pu, v]) => '<div class="bar-row"><span>' + esc(pu) + '</span><div class="bar"><span style="width:' + (v.total ? Math.round(v.done / v.total * 100) : 0) + '%"></span></div><strong>' + (v.total ? Math.round(v.done / v.total * 100) : 0) + '%</strong></div>').join('') +
      '<h3>Trades holding work</h3><div class="hold-list">' +
      (openSteps.slice(0, 8).map((s) => '<div>' + esc(tradeLabel(s.trade)) + ' · ' + esc(s.wo) + ' · ' + esc(s.label) + (s.hold ? ' · blocked' : '') + '</div>').join('') || '<p>Nothing waiting.</p>') +
      '</div></div></div>';
  }
  function handoverJobs() {
    const unit = $('#hand-unit')?.value || '';
    const shift = $('#hand-shift')?.value || 'all';
    const date = $('#hand-date')?.value || dayKeyOffset(0);
    return activeList().filter((job) => {
      if (unit && normalizeUnit(job.unit) !== unit) return false;
      const keys = jobDateKeys(job);
      if (date && keys.length && !keys.includes(date) && (job.job_date || '').slice(0, 10) !== date && dueBucket(job) === 'later' && job.status === 'done') return false;
      if (shift === 'all') return true;
      const hour = zoneHour(job.updated_at || job.created_at || Date.now());
      return shift === 'day' ? hour >= 6 && hour < 18 : hour < 6 || hour >= 18;
    });
  }
  function handoverHtml(list) {
    const done = list.filter((j) => j.status === 'done');
    const blocked = list.filter((j) => j.on_hold);
    const open = list.filter((j) => j.status !== 'done' && !j.on_hold);
    const block = (title, rows) => '<h3>' + title + ' (' + rows.length + ')</h3>' + (rows.map((j) => {
      const signs = (j.steps || []).flatMap((s) => (s.assignees || []).filter((a) => a.signed_off).map((a) => s.trade + ': ' + a.person_name));
      const notes = (j.comments || []).slice(-3).map((c) => c.author_name + ': ' + c.body).join(' | ');
      const pieces = [{ type: 'job', id: j.id, label: '' }].concat((j.steps || []).map((step) => ({ type: 'step', id: step.id, label: step.label }))).concat((j.comments || []).map((comment) => ({ type: 'comment', id: comment.id, label: 'Note' })));
      const ack = pieces.flatMap((piece) => {
        const names = reactionNames(piece.type, piece.id, ['gotit', 'done']);
        return names.length ? [(piece.label ? piece.label + ' acknowledged by ' : 'Acknowledged by ') + names.join(', ')] : [];
      });
      const concerns = pieces.flatMap((piece) => {
        const names = reactionNames(piece.type, piece.id, ['concern']);
        return names.length ? ['Concern' + (piece.label ? ' on ' + piece.label : '') + ': ' + names.join(', ')] : [];
      });
      const ackLine = ack.concat(concerns).join('<br>');
      return '<p><strong>' + esc(j.wo_number) + '</strong> ' + esc(j.title) + ' · ' + esc(j.unit || '') + (j.on_hold ? ' · BLOCKED ' + esc(j.hold_reason || '') : '') + '<br>Signed: ' + esc(signs.join(', ') || '—') + (notes ? '<br>Notes: ' + esc(notes) : '') + (ackLine ? '<br>' + esc(ackLine).replaceAll('&lt;br&gt;', '<br>') : '') + '</p>';
    }).join('') || '<p>None.</p>');
    return '<h2>Beamlock shift handover</h2><p>' + esc(fmtTime(new Date().toISOString())) + ' · times in ' + esc(zoneName()) + ' · ' + esc(state.user?.name || '') + '</p><p>Day and night use 06:00–18:00 in ' + esc(zoneName()) + '. Stored times are not changed.</p>' + block('Completed', done) + block('Open', open) + block('Blocked', blocked);
  }
  function openHandover() {
    if (!canSeeDash()) return toast('The handover is for supervisors, planners, and admins');
    const root = $('#modal-root');
    const units = listUnits();
    root.innerHTML = '<div class="overlay"><div class="modal" role="dialog"><div class="modal-head"><strong>Shift handover</strong><button class="btn btn-sm" id="hand-close" type="button">Close</button></div><div class="modal-body">' +
      '<div class="filters"><select id="hand-shift" class="select"><option value="all">All shifts</option><option value="day">Day 06:00–18:00</option><option value="night">Night</option></select>' +
      '<select id="hand-unit" class="select"><option value="">All units</option>' + units.map((u) => '<option>' + esc(u) + '</option>').join('') + '</select>' +
      '<input id="hand-date" class="input" type="date" value="' + dayKeyOffset(0) + '" /></div>' +
      '<div class="modal-actions"><button class="btn btn-primary" id="hand-print" type="button">Print / PDF</button><button class="btn" id="hand-share" type="button">Share / Email</button></div>' +
      '<div id="hand-body" class="handover-sheet"></div></div></div></div>';
    const draw = () => { $('#hand-body').innerHTML = handoverHtml(handoverJobs()); };
    draw();
    $('#hand-shift').onchange = draw;
    $('#hand-unit').onchange = draw;
    $('#hand-date').onchange = draw;
    $('#hand-close').onclick = () => { root.innerHTML = ''; };
    $('#hand-print').onclick = () => {
      const frame = document.createElement('iframe');
      frame.className = 'print-root';
      frame.style.position = 'fixed'; frame.style.right = '0'; frame.style.bottom = '0'; frame.style.width = '0'; frame.style.height = '0'; frame.style.border = '0';
      document.body.appendChild(frame);
      const doc = frame.contentDocument;
      doc.open();
      doc.write('<html><head><title>Beamlock handover</title></head><body style="font-family:Segoe UI,sans-serif">' + $('#hand-body').innerHTML + '</body></html>');
      doc.close();
      frame.contentWindow.focus();
      frame.contentWindow.print();
      setTimeout(() => frame.remove(), 1000);
    };
    $('#hand-share').onclick = async () => {
      const text = $('#hand-body').innerText;
      if (navigator.share) {
        try { await navigator.share({ title: 'Beamlock shift handover', text }); return; } catch (_) {}
      }
      location.href = 'mailto:?subject=' + encodeURIComponent('Beamlock shift handover') + '&body=' + encodeURIComponent(text);
    };
  }
  function armDemo() {
    state.demoJobs = window.BLPresent.buildDemoJobs();
    state.jobs = state.demoJobs;
    state.demoTurnaround = {
      id: 'demo-ta',
      name: 'Spring outage (DEMO)',
      starts_on: dayKeyOffset(-2),
      ends_on: dayKeyOffset(12),
      units: ['HMU', 'RHC', 'A&V', 'SRU', 'COGEN', 'Waterblock'],
      jobs: state.demoJobs.map((j) => j.id),
      turnaround_jobs: state.demoJobs.map((j) => ({ job_id: j.id })),
    };
    state.turnaroundId = 'demo-ta';
    const now = new Date().toISOString();
    state.reactions = [
      { id: 'demo-r1', kind: 'gotit', target_type: 'step', target_id: 'demo-hmu-1', job_id: 'demo-hmu', user_id: 'demo-sup', actor_name: 'Demo Supervisor', created_at: now },
      { id: 'demo-r2', kind: 'done', target_type: 'step', target_id: 'demo-hmu-1', job_id: 'demo-hmu', user_id: 'demo-ins', actor_name: 'Demo Insulator', created_at: now },
      { id: 'demo-r3', kind: 'concern', target_type: 'step', target_id: 'demo-hmu-1', job_id: 'demo-hmu', user_id: 'demo-op', actor_name: 'Demo Operator', created_at: now },
      { id: 'demo-r4', kind: 'question', target_type: 'comment', target_id: 'demo-c1', job_id: 'demo-sru', user_id: 'demo-op', actor_name: 'Demo Operator', created_at: now },
      { id: 'demo-r5', kind: 'clap', target_type: 'comment', target_id: 'demo-c1', job_id: 'demo-sru', user_id: 'demo-sup', actor_name: 'Demo Supervisor', created_at: now },
    ];
  }
  function startDemo() {
    if (!isRealAdmin()) return toast('Demo mode is for admins');
    state.demoOn = true;
    armDemo();
    $('#demo-banner')?.classList.remove('hidden');
    renderAll();
    toast('Demo orders loaded. Real jobs were not changed.');
  }
  function stopDemo() {
    state.demoOn = false;
    if (state.demoTimer) { clearInterval(state.demoTimer); state.demoTimer = null; }
    $('#demo-play') && ($('#demo-play').textContent = 'Auto-play');
    $('#demo-banner')?.classList.add('hidden');
    refreshAll(true);
  }
  function resetDemo() {
    if (!state.demoOn) return;
    if (state.demoTimer) { clearInterval(state.demoTimer); state.demoTimer = null; }
    armDemo();
    renderAll();
    toast('Demo orders reset.');
  }
  function demoToggleSign(jobId, assigneeId, wasSigned) {
    const job = (state.demoJobs || []).find((j) => j.id === jobId);
    if (!job) return;
    for (const step of job.steps) {
      const person = (step.assignees || []).find((a) => a.id === assigneeId);
      if (!person) continue;
      person.signed_off = !wasSigned;
      person.signed_at = person.signed_off ? new Date().toISOString() : null;
      if (person.signed_off) person.person_name = state.user?.name || person.person_name;
    }
    window.BLPresent.advance(job);
    state.jobs = state.demoJobs;
    renderAll();
    showJobModal(job);
    toast('DEMO sign-off — not written to the plant');
  }
  function toggleDemoPlay() {
    if (!state.demoOn) return;
    if (state.demoTimer) {
      clearInterval(state.demoTimer);
      state.demoTimer = null;
      $('#demo-play').textContent = 'Auto-play';
      return;
    }
    $('#demo-play').textContent = 'Stop auto-play';
    state.demoTimer = setInterval(() => {
      const job = (state.demoJobs || []).find((j) => !j.on_hold && (j.steps || []).some((s) => (s.status === 'ready' || s.status === 'in_progress') && (s.assignees || []).some((a) => !a.signed_off)));
      if (!job) return;
      const step = job.steps.find((s) => (s.status === 'ready' || s.status === 'in_progress') && (s.assignees || []).some((a) => !a.signed_off));
      const person = step.assignees.find((a) => !a.signed_off);
      person.signed_off = true;
      person.signed_at = new Date().toISOString();
      window.BLPresent.advance(job);
      state.jobs = state.demoJobs;
      renderAll();
      toast('DEMO ' + tradeLabel(step.trade) + ' signed ' + job.wo_number);
    }, 3500);
  }
  function scanAlerts(prev, next) {
    if (!wantsNotify()) return;
    for (const job of next || []) {
      const old = (prev || []).find((j) => j.id === job.id);
      const wait = waitingTrade(job);
      const oldWait = old ? waitingTrade(old) : null;
      if (wait && state.user?.trade === wait.trade && (!oldWait || oldWait.id !== wait.id)) notify('Your step is next', job.wo_number + ' — ' + wait.label);
      if (canSeeDash() && job.on_hold && !old?.on_hold) notify('Job blocked', job.wo_number + ' — ' + (job.hold_reason || 'on hold'));
      if (canSeeDash() && dueBucket(job) === 'overdue' && (!old || dueBucket(old) !== 'overdue')) notify('Job overdue', job.wo_number + ' — ' + job.title);
    }
  }
  async function changeOwnCode(current, next, again) {
    if (state.demoOn) return 'Demo mode does not change sign-in codes.';
    if (!navigator.onLine) return 'You need a connection to change your sign-in code.';
    const currentCode = String(current || '');
    const newCode = String(next || '');
    const confirmCode = String(again || '');
    if (!currentCode) return 'Enter your current sign-in code.';
    if (!/^\d{6,}$/.test(newCode)) return 'The new code must be 6 or more digits.';
    if (newCode !== confirmCode) return 'The new codes do not match.';
    if (newCode === currentCode) return 'Choose a different sign-in code.';
    const { data: sessionData } = await sb.auth.getSession();
    const session = sessionData?.session;
    const email = session?.user?.email || '';
    if (!session || !email || session.user.id !== state.profile?.id) return 'Sign in again before changing your code.';
    const offline = () => 'Could not reach the account service. Your sign-in code was not changed.';
    state.changingCode = true;
    try {
      let guard;
      try {
        guard = await sb.rpc('login_guard', { person: state.profile.display_name || state.user.name, code: currentCode });
      } catch (_) {
        return offline();
      }
      if (guard.error) return /fetch|network|failed/i.test(String(guard.error.message || '')) ? offline() : 'Could not check the current sign-in code. It was not changed.';
      if (guard.data === 'locked') return 'Too many wrong codes. Try again in 15 minutes.';
      if (guard.data === 'deactivated') return 'This account is deactivated.';
      if (guard.data === 'rejected') return 'This account was not approved.';
      if (guard.data !== 'ok') return 'Current sign-in code is wrong.';
      const checked = await sb.auth.signInWithPassword({ email, password: currentCode });
      if (checked.error) {
        if (/fetch|network|failed/i.test(String(checked.error.message || ''))) return offline();
        return 'Current sign-in code is wrong.';
      }
      const updated = await sb.auth.updateUser({ password: newCode });
      if (updated.error) {
        if (/fetch|network|failed/i.test(String(updated.error.message || ''))) return offline();
        return 'The sign-in code was not changed.';
      }
      const signed = await sb.auth.signInWithPassword({ email, password: newCode });
      if (signed.error) {
        const { data: still } = await sb.auth.getSession();
        if (!still?.session) return 'SIGN_IN';
      }
      try { await audit(null, 'code_changed', 'Sign-in code changed'); } catch (_) {}
      return '';
    } finally {
      setTimeout(() => { state.changingCode = false; }, 1500);
    }
  }
  const ZONE_CHOICES = [
    ['America/Edmonton', 'America/Edmonton (Scotford)'],
    ['America/Vancouver', 'America/Vancouver'],
    ['America/Winnipeg', 'America/Winnipeg'],
    ['America/Toronto', 'America/Toronto'],
    ['America/Halifax', 'America/Halifax'],
    ['America/St_Johns', "America/St. John's"],
    ['America/Denver', 'America/Denver'],
    ['UTC', 'UTC'],
  ];
  function zoneOk(zone) {
    try { new Intl.DateTimeFormat('en-CA', { timeZone: zone }).format(new Date()); return true; } catch { return false; }
  }
  function zoneName() {
    const zone = state.prefs?.zone || 'America/Edmonton';
    return zoneOk(zone) ? zone : 'America/Edmonton';
  }
  function canPlaySound() { return !!(window.AudioContext || window.webkitAudioContext); }
  function playAlertSound() {
    if (!state.prefs?.sound || !canPlaySound()) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      const ctx = new Ctx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.frequency.value = 880;
      gain.gain.value = 0.05;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
      setTimeout(() => ctx.close(), 400);
    } catch (_) {}
  }
  function defaultPrefs() {
    return { theme: 'system', font: 'system', text: 'default', density: 'comfortable', contrast: false, motion: 'system', zone: 'America/Edmonton', clock: '24', landing: 'jobs', notify: false, sound: false };
  }
  function landingChoices() {
    const items = [['jobs', 'Jobs'], ['apps', 'Apps'], ['mine', 'My trade'], ['history', 'My jobs'], ['board', 'Live board'], ['safety', 'Safety']];
    const real = state.user?.realRole;
    const approved = isApproved();
    if (approved && ['Supervisor', 'Planner', 'Admin'].includes(real)) items.push(['dash', 'Dashboard'], ['turn', 'Turnaround']);
    items.push(['dashboards', 'Dashboards'], ['audit', 'Audit'], ['security', 'Security'], ['settings', 'Settings']);
    if (approved && ['Admin', 'Planner'].includes(real)) items.push(['planner', 'Planner'], ['admin', 'Admin']);
    return items;
  }
  function resolvedLanding() {
    const want = state.prefs?.landing || 'jobs';
    return landingChoices().some((item) => item[0] === want) ? want : 'jobs';
  }
  function sanitizePrefs(raw) {
    const base = defaultPrefs();
    const src = raw && typeof raw === 'object' ? raw : {};
    const pick = (key, allowed, fallback) => allowed.includes(src[key]) ? src[key] : fallback;
    const zone = ZONE_CHOICES.some((item) => item[0] === src.zone) && zoneOk(src.zone) ? src.zone : base.zone;
    const landing = landingChoices().some((item) => item[0] === src.landing) ? src.landing : base.landing;
    return {
      theme: pick('theme', ['system', 'light', 'dark'], base.theme),
      font: pick('font', ['system', 'verdana', 'georgia', 'arial'], base.font),
      text: pick('text', ['default', 'large', 'xlarge'], base.text),
      density: pick('density', ['comfortable', 'compact'], base.density),
      contrast: !!src.contrast,
      motion: pick('motion', ['system', 'reduce'], base.motion),
      zone,
      clock: pick('clock', ['24', '12'], base.clock),
      landing,
      notify: !!src.notify,
      sound: !!src.sound,
    };
  }
  function prefsKey() { return 'bl_prefs_' + (state.profile?.id || ''); }
  function rememberLocalPrefs(prefs, at) {
    if (!state.profile?.id) return;
    localStorage.setItem(prefsKey(), JSON.stringify(prefs));
    localStorage.setItem(prefsKey() + '_at', String(at || Date.now()));
  }
  function readLocalPrefs() {
    if (!state.profile?.id) return defaultPrefs();
    let stored = null;
    try { stored = JSON.parse(localStorage.getItem(prefsKey()) || 'null'); } catch { stored = null; }
    if (!stored && localStorage.getItem('bl_hc') === '1') {
      stored = { contrast: true };
      localStorage.removeItem('bl_hc');
    }
    if (localStorage.getItem('bl_notify_' + state.profile.id) === '1') stored = { ...(stored || {}), notify: true };
    return sanitizePrefs(stored || {});
  }
  function systemDark() { return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches); }
  function systemReduce() { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }
  function applyAppearance(prefs) {
    const p = sanitizePrefs(prefs || defaultPrefs());
    const root = document.documentElement;
    const dark = p.theme === 'dark' || (p.theme === 'system' && systemDark());
    root.classList.toggle('dark', dark && !p.contrast);
    root.classList.toggle('hc', !!p.contrast);
    root.dataset.font = p.font;
    root.dataset.text = p.text;
    root.dataset.density = p.density;
    root.dataset.motion = p.motion;
    root.classList.toggle('reduce-motion', p.motion === 'reduce' || (p.motion === 'system' && systemReduce()));
    const btn = $('#btn-hc');
    if (btn) btn.setAttribute('aria-pressed', p.contrast ? 'true' : 'false');
    const notifyBtn = $('#btn-notify');
    if (notifyBtn) notifyBtn.setAttribute('aria-pressed', p.notify ? 'true' : 'false');
  }
  function paintPrefPreview() {
    const el = $('#settings-now');
    if (el) el.textContent = fmtTime(new Date().toISOString()) + ' · ' + zoneName();
    renderDataSource();
    if (state.weather) paintWeather(state.weather);
  }
  async function persistPrefs() {
    state.prefs = sanitizePrefs(state.prefs);
    rememberLocalPrefs(state.prefs, Date.now());
    applyAppearance(state.prefs);
    paintPrefPreview();
    if (!state.profile?.id) return;
    if (!navigator.onLine) { state.prefsDirty = true; return; }
    const { error } = await sb.from('user_preferences').upsert({ user_id: state.profile.id, prefs: state.prefs });
    state.prefsDirty = !!error;
    if (error) toast('Saved on this device. It will sync when the connection returns.');
  }
  async function loadPrefs() {
    const local = readLocalPrefs();
    state.prefs = local;
    applyAppearance(local);
    if (!state.profile?.id || !navigator.onLine) return;
    const { data, error } = await sb.from('user_preferences').select('prefs, updated_at').eq('user_id', state.profile.id).maybeSingle();
    if (error) return;
    const localAt = Number(localStorage.getItem(prefsKey() + '_at') || 0);
    const remoteAt = data?.updated_at ? new Date(data.updated_at).getTime() : 0;
    if (data && remoteAt >= localAt) {
      state.prefs = sanitizePrefs(data.prefs);
      rememberLocalPrefs(state.prefs, remoteAt);
      applyAppearance(state.prefs);
      return;
    }
    if (!data || localAt > remoteAt) await persistPrefs();
  }
  async function updatePref(key, value) {
    const y = window.scrollY;
    state.prefs = sanitizePrefs({ ...(state.prefs || defaultPrefs()), [key]: value });
    await persistPrefs();
    if (Math.abs(window.scrollY - y) > 1) window.scrollTo(0, y);
  }
  function renderSettings() {
    const host = $('#settings-body');
    if (!host || !state.user) return;
    if (host.contains(document.activeElement)) return;
    if (['code-current', 'code-new', 'code-confirm'].some((id) => document.getElementById(id)?.value)) return;
    const p = sanitizePrefs(state.prefs);
    const opt = (value, label, current) => '<option value="' + esc(value) + '"' + (value === current ? ' selected' : '') + '>' + esc(label) + '</option>';
    const zones = ZONE_CHOICES.filter((item) => zoneOk(item[0]));
    const notifyApi = typeof Notification !== 'undefined';
    const soundApi = canPlaySound();
    host.innerHTML = '<section class="pref-group"><h3>Appearance</h3>' +
      '<label class="pref-row">Theme<select class="select" data-pref="theme">' + opt('system', 'System', p.theme) + opt('light', 'Light', p.theme) + opt('dark', 'Dark', p.theme) + '</select></label>' +
      '<label class="pref-row">Font<select class="select" data-pref="font">' + opt('system', 'System', p.font) + opt('verdana', 'Verdana', p.font) + opt('georgia', 'Georgia', p.font) + opt('arial', 'Arial', p.font) + '</select></label>' +
      '<p class="pref-sample">The quick brown fox jumps over the lazy dog.</p>' +
      '<label class="pref-row">Text size<select class="select" data-pref="text">' + opt('default', 'Default', p.text) + opt('large', 'Large', p.text) + opt('xlarge', 'Extra large', p.text) + '</select></label>' +
      '<label class="pref-row">Density<select class="select" data-pref="density">' + opt('comfortable', 'Comfortable', p.density) + opt('compact', 'Compact', p.density) + '</select></label>' +
      '<p class="pref-note">Compact tightens spacing around cards. Buttons, tabs, and fields stay at least 44 pixels tall.</p></section>' +
      '<section class="pref-group"><h3>Accessibility</h3>' +
      '<label class="pref-row"><span><input type="checkbox" data-pref="contrast"' + (p.contrast ? ' checked' : '') + ' /> High contrast</span></label>' +
      '<p class="pref-note">This is the same switch as High contrast in the header. It overrides light and dark.</p>' +
      '<label class="pref-row">Motion<select class="select" data-pref="motion">' + opt('system', 'System default', p.motion) + opt('reduce', 'Reduce motion', p.motion) + '</select></label></section>' +
      '<section class="pref-group"><h3>Regional</h3>' +
      '<label class="pref-row">Time zone<select class="select" data-pref="zone">' + zones.map((item) => opt(item[0], item[1], p.zone)).join('') + '</select></label>' +
      '<label class="pref-row">Clock<select class="select" data-pref="clock">' + opt('24', '24-hour', p.clock) + opt('12', '12-hour', p.clock) + '</select></label>' +
      '<p class="pref-note">Dates stay in the form 6 Nov 2026. Daylight saving time follows the selected zone. Job timestamps stored on the server are not rewritten.</p>' +
      '<p id="settings-now" class="pref-sample"></p></section>' +
      '<section class="pref-group"><h3>Notifications</h3>' +
      (notifyApi
        ? '<label class="pref-row"><span><input type="checkbox" data-pref="notify"' + (p.notify ? ' checked' : '') + ' /> Browser notifications on this device</span></label><p class="pref-note">Alerts show while Beamlock is open, after the browser allows them. The Notifications button in the header uses this same switch.</p>'
        : '<p class="pref-note">This browser cannot show notifications.</p>') +
      (soundApi
        ? '<label class="pref-row"><span><input type="checkbox" data-pref="sound"' + (p.sound ? ' checked' : '') + ' /> Play a short sound with alerts</span></label><button type="button" class="btn btn-sm" id="settings-sound">Test sound</button>'
        : '<p class="pref-note">This browser cannot play a sound.</p>') +
      '</section>' +
      '<section class="pref-group"><h3>General</h3>' +
      '<label class="pref-row">Page after sign-in<select class="select" data-pref="landing">' + landingChoices().map((item) => opt(item[0], item[1], p.landing)).join('') + '</select></label>' +
      '<p class="pref-note">Used the next time you sign in. Only pages your role can open are listed.</p>' +
      '<button type="button" class="btn" id="settings-reset">Reset my preferences</button></section>' +
      '<section class="pref-group"><h3>Account</h3>' +
      '<p><strong>' + esc(state.user.name || '') + '</strong><br>' + esc(state.user.realRole || '') + (state.profile?.status === 'pending' ? ' · waiting for approval' : '') + '</p>' +
      '<button type="button" class="btn" id="btn-install-profile" data-install>Add to Home Screen</button>' +
      '<h3>Change sign-in code</h3>' +
      '<p class="pref-note">This changes the code for your own account. Your role stays the same. A connection is required. The code is not saved on this device.</p>' +
      '<form id="code-form" method="post" action="#" autocomplete="off">' +
      '<label class="lbl" for="code-current">Current sign-in code</label><input id="code-current" class="input" type="password" inputmode="numeric" autocomplete="current-password" autocapitalize="off" spellcheck="false" />' +
      '<label class="lbl" for="code-new">New sign-in code</label><input id="code-new" class="input" type="password" inputmode="numeric" autocomplete="new-password" autocapitalize="off" spellcheck="false" />' +
      '<label class="lbl" for="code-confirm">Confirm new sign-in code</label><input id="code-confirm" class="input" type="password" inputmode="numeric" autocomplete="new-password" autocapitalize="off" spellcheck="false" />' +
      '<p id="code-error" class="hold-banner hidden"></p><button type="submit" class="btn btn-primary" id="code-save">Change sign-in code</button></form></section>';
    paintPrefPreview();
    paintInstall();
    host.querySelectorAll('[data-pref]').forEach((el) => {
      const apply = async () => {
        const key = el.dataset.pref;
        let value = el.type === 'checkbox' ? el.checked : el.value;
        if (key === 'notify' && value) {
          if (!notifyApi) { el.checked = false; return; }
          const perm = await Notification.requestPermission();
          if (perm !== 'granted') { el.checked = false; toast('Notifications were not allowed'); return; }
        }
        if (key === 'sound' && value) playAlertSound();
        await updatePref(key, value);
      };
      el.addEventListener('change', () => { apply().catch(() => toast('Could not save that preference')); });
    });
    $('#settings-sound') && ($('#settings-sound').onclick = () => {
      const previous = state.prefs?.sound;
      state.prefs = { ...(state.prefs || defaultPrefs()), sound: true };
      playAlertSound();
      state.prefs.sound = previous;
    });
    $('#settings-reset') && ($('#settings-reset').onclick = async () => {
      if (!confirm('Reset your preferences to the defaults? Jobs and other people are not changed.')) return;
      const y = window.scrollY;
      state.prefs = defaultPrefs();
      await persistPrefs();
      if (host) host.innerHTML = '';
      renderSettings();
      window.scrollTo(0, y);
      toast('Your preferences were reset');
    });
    $('#btn-install-profile') && ($('#btn-install-profile').onclick = () => startInstall());
    const form = $('#code-form');
    if (form) form.onsubmit = async (e) => {
      e.preventDefault();
      const btn = $('#code-save');
      const showErr = (message) => {
        const el = $('#code-error');
        if (!el) return;
        el.textContent = message;
        el.classList.toggle('hidden', !message);
        if (message) toast(message);
      };
      showErr('');
      if (btn) btn.disabled = true;
      const message = await changeOwnCode($('#code-current').value, $('#code-new').value, $('#code-confirm').value);
      if (btn) btn.disabled = false;
      if (message === 'SIGN_IN') { showLogin('Sign in with your new code.'); return; }
      if (message) { showErr(message); return; }
      ['code-current', 'code-new', 'code-confirm'].forEach((id) => { const input = document.getElementById(id); if (input) input.value = ''; });
      toast('Sign-in code changed. This device stays signed in.');
    };
  }
  function openProfile() { setView('settings'); }
  function offlineDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open('beamlock-offline', 1);
      req.onupgradeneeded = () => { if (!req.result.objectStoreNames.contains('outbox')) req.result.createObjectStore('outbox', { keyPath: 'id' }); };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  async function queueOffline(op) {
    const db = await offlineDB();
    await new Promise((resolve, reject) => {
      const tx = db.transaction('outbox', 'readwrite');
      tx.objectStore('outbox').put(op);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    await refreshSyncCount();
  }
  async function refreshSyncCount() {
    try {
      const db = await offlineDB();
      const n = await new Promise((resolve) => {
        const req = db.transaction('outbox', 'readonly').objectStore('outbox').count();
        req.onsuccess = () => resolve(req.result || 0);
      });
      const el = $('#sync-count');
      if (!el) return;
      el.textContent = String(n);
      el.classList.toggle('hidden', !n);
    } catch (_) {}
  }
  async function flushOutbox() {
    if (!navigator.onLine || state.flushing || state.demoOn) return;
    state.flushing = true;
    try {
      const db = await offlineDB();
      const items = await new Promise((resolve) => {
        const req = db.transaction('outbox', 'readonly').objectStore('outbox').getAll();
        req.onsuccess = () => resolve(req.result || []);
      });
      items.sort((a, b) => a.at - b.at);
      for (const item of items) {
        let drop = false;
        if (item.kind === 'signoff') {
          const { data, error } = await sb.from('step_assignees').select('signed_off').eq('id', item.assigneeId).maybeSingle();
          if (error) break;
          if (!data) { drop = true; toast('A queued sign-off was dropped. That step is gone.'); }
          else if (item.signed && data.signed_off) { drop = true; toast('Server already has a sign-off on that step. Kept the server copy.'); }
          else {
            const upd = await sb.from('step_assignees').update({ signed_off: !!item.signed, signed_at: item.signed ? new Date().toISOString() : null, person_name: item.name }).eq('id', item.assigneeId);
            if (upd.error) break;
            if (item.jobId) await sb.rpc('advance_job', { target_job: item.jobId });
          }
        } else if (item.kind === 'comment') {
          let photoUrl = null;
          if (item.photos && item.photos[0]) {
            const path = item.jobId + '/' + item.id + '.jpg';
            const up = await sb.storage.from('comment-photos').upload(path, new Blob([item.photos[0]], { type: 'image/jpeg' }), { contentType: 'image/jpeg' });
            if (up.error) break;
            const signed = await sb.storage.from('comment-photos').createSignedUrl(path, 60 * 60 * 24 * 7);
            photoUrl = signed.data?.signedUrl || null;
          }
          let audioPath = null;
          if (item.audio) {
            try { audioPath = await uploadAudio(item.jobId, new Blob([item.audio], { type: item.audioType || 'audio/webm' })); }
            catch (_) { break; }
          }
          const ins = await sb.from('comments').insert({
            job_id: item.jobId, step_id: item.stepId, section: item.section, channel: item.stepId ? 'step' : (item.section || 'general'),
            body: item.body || (audioPath ? '(voice note)' : '(photo)'), author_name: item.name, author_role: item.role, photo_path: photoUrl, photo_paths: photoUrl ? [photoUrl] : [], audio_path: audioPath,
          });
          if (ins.error) break;
        } else if (item.kind === 'reaction') {
          const result = item.on
            ? await sb.from('reactions').insert({ target_type: item.targetType, target_id: item.targetId, job_id: item.jobId, kind: item.reactKind || 'gotit' })
            : await sb.from('reactions').delete().eq('target_type', item.targetType).eq('target_id', item.targetId).eq('kind', item.reactKind || 'gotit');
          if (result.error && !/duplicate|unique/i.test(result.error.message || '')) break;
        }
        await new Promise((resolve) => {
          const tx = db.transaction('outbox', 'readwrite');
          tx.objectStore('outbox').delete(item.id);
          tx.oncomplete = resolve;
        });
        if (drop) { /* already told the user */ }
      }
    } finally {
      state.flushing = false;
      await refreshSyncCount();
    }
  }
  async function signedPhotoUrl(url) {
    const match = String(url || '').match(/comment-photos\/([^?]+)/);
    if (!match) return url;
    const path = decodeURIComponent(match[1]);
    const { data, error } = await sb.storage.from('comment-photos').createSignedUrl(path, 3600);
    return !error && data?.signedUrl ? data.signedUrl : url;
  }
  function resolveThumbs(root) {
    root.querySelectorAll('[data-raw]').forEach(async (el) => {
      const next = await signedPhotoUrl(el.dataset.raw);
      if (!next) return;
      if (el.tagName === 'AUDIO') el.src = next;
      else { el.src = next; el.dataset.full = next; }
    });
  }
  const SAFETY_UNITS = ['RHC', 'HMU', 'A&V', 'SRU', 'COGEN', 'Waterblock'];
  function normalizeSafety(rows) {
    return (rows || []).map((row) => {
      const next = { ...row };
      if (!String(next.firehall_number || '').trim() && String(next.fireball_number || '').trim()) next.firehall_number = next.fireball_number;
      delete next.fireball_number;
      return next;
    });
  }
  async function loadSafety() {
    if (!navigator.onLine) {
      try { state.safety = normalizeSafety(JSON.parse(localStorage.getItem('bl_safety') || '[]')); } catch { state.safety = []; }
      localStorage.setItem('bl_safety', JSON.stringify(state.safety));
      return;
    }
    const { data, error } = await sb.from('unit_safety').select('*');
    if (error) return;
    state.safety = normalizeSafety(data || []);
    localStorage.setItem('bl_safety', JSON.stringify(state.safety));
  }
  function safetyFor(unit) {
    return (state.safety || []).find((s) => s.unit === unit) || null;
  }
  function renderSafety() {
    const sel = $('#safety-unit');
    const host = $('#safety-body');
    if (!sel || !host) return;
    const current = state.safetyUnit || sel.value || 'A&V';
    sel.innerHTML = SAFETY_UNITS.map((u) => '<option' + (u === current ? ' selected' : '') + '>' + esc(u) + '</option>').join('');
    sel.value = SAFETY_UNITS.includes(current) ? current : 'A&V';
    sel.onchange = () => { state.safetyUnit = sel.value; renderSafety(); };
    const unit = sel.value;
    const row = safetyFor(unit);
    const phones = Array.isArray(row?.phones) ? row.phones : [];
    const showers = Array.isArray(row?.showers) ? row.showers : [];
    const blank = '<span class="placeholder">Not set yet, admin can add</span>';
    const emerg = (label, value, cls) => {
      const set = String(value || '').trim();
      const body = '<span class="k">' + esc(label) + '</span><span class="v' + (set ? '' : ' placeholder') + '">' + (set ? esc(set) : 'Not set yet, admin can add') + '</span>';
      return set
        ? '<a class="emerg ' + cls + '" href="tel:' + esc(set.replace(/[^\d+]/g, '')) + '">' + body + '</a>'
        : '<div class="emerg ' + cls + '">' + body + '</div>';
    };
    host.innerHTML = '<article class="safety-card"><h3>' + esc(unit) + '</h3>' +
      '<div class="emerg-row">' +
      emerg('Firehall number', row?.firehall_number, 'firehall') +
      emerg('Security number', row?.security_number, '') +
      emerg('Panel number', row?.panel_number, '') +
      '</div>' +
      '<div><strong>Unit muster point</strong><div>' + (row?.muster_unit ? esc(row.muster_unit) : blank) + '</div></div>' +
      '<div><strong>Site muster point</strong><div>' + (row?.muster_site ? esc(row.muster_site) : blank) + '</div></div>' +
      '<div><strong>Unit phones</strong>' + (phones.length ? phones.map((p) => '<div><a href="tel:' + esc(String(p.number || '').replace(/[^\d+]/g, '')) + '">' + esc(p.name || 'Phone') + ' · ' + esc(p.number || '') + '</a></div>').join('') : '<div>' + blank + '</div>') + '</div>' +
      '<div><strong>Safety showers and eyewash</strong>' + (showers.length ? showers.map((s) => '<div>' + esc(s.id || 'Shower') + ' — ' + esc(s.location || '') + '</div>').join('') : '<div>' + blank + '</div>') + '</div>' +
      '<div><strong>Notes</strong><div>' + (row?.notes ? esc(row.notes) : blank) + '</div></div>' +
      (row?.map_path ? '<img class="thumb" alt="Map" data-raw="' + esc(row.map_path) + '" src="" />' : '<div><strong>Map photo</strong><div>' + blank + '</div></div>') +
      '</article>' +
      (isRealAdmin() ? '<form id="safety-form" class="tile-edit" style="margin-top:12px"><h3>Edit ' + esc(unit) + '</h3>' +
        '<label class="lbl">Unit muster point</label><input class="input" name="muster_unit" value="' + esc(row?.muster_unit || '') + '" />' +
        '<label class="lbl">Site muster point</label><input class="input" name="muster_site" value="' + esc(row?.muster_site || '') + '" />' +
        '<label class="lbl">Phones, one per line: name | number</label><textarea class="textarea" name="phones">' + esc(phones.map((p) => (p.name || '') + ' | ' + (p.number || '')).join('\n')) + '</textarea>' +
        '<label class="lbl">Firehall number</label><input class="input" name="firehall_number" value="' + esc(row?.firehall_number || '') + '" />' +
        '<label class="lbl">Security number</label><input class="input" name="security_number" value="' + esc(row?.security_number || '') + '" />' +
        '<label class="lbl">Panel number</label><input class="input" name="panel_number" value="' + esc(row?.panel_number || '') + '" />' +
        '<label class="lbl">Showers, one per line: ID | location</label><textarea class="textarea" name="showers">' + esc(showers.map((s) => (s.id || '') + ' | ' + (s.location || '')).join('\n')) + '</textarea>' +
        '<label class="lbl">Notes</label><textarea class="textarea" name="notes">' + esc(row?.notes || '') + '</textarea>' +
        '<label class="lbl">Map photo</label><input type="file" name="map" accept="image/*" />' +
        '<button class="btn btn-primary" type="submit">Save safety info</button></form>' : '');
    resolveThumbs(host);
    const form = $('#safety-form');
    if (form) form.onsubmit = async (e) => {
      e.preventDefault();
      const lines = (name) => String(form[name].value || '').split('\n').map((line) => line.trim()).filter(Boolean);
      const phonesNext = lines('phones').map((line) => { const [name, number] = line.split('|'); return { name: (name || '').trim(), number: (number || '').trim() }; });
      const showersNext = lines('showers').map((line) => { const [id, location] = line.split('|'); return { id: (id || '').trim(), location: (location || '').trim() }; });
      let mapPath = row?.map_path || '';
      const file = form.map.files?.[0];
      if (file) {
        const blob = await resizeImage(file, 1280);
        const path = 'safety/' + unit + '-' + Date.now() + '.jpg';
        const up = await sb.storage.from('comment-photos').upload(path, blob, { contentType: 'image/jpeg' });
        if (up.error) return toast(up.error.message);
        mapPath = 'comment-photos/' + path;
      }
      const payload = { unit, muster_unit: form.muster_unit.value.trim(), muster_site: form.muster_site.value.trim(), phones: phonesNext, showers: showersNext, firehall_number: form.firehall_number.value.trim(), security_number: form.security_number.value.trim(), panel_number: form.panel_number.value.trim(), notes: form.notes.value.trim(), map_path: mapPath, updated_at: new Date().toISOString(), updated_by: state.user.name };
      const { error } = await sb.from('unit_safety').upsert(payload);
      if (error) return toast(error.message);
      await loadSafety();
      renderSafety();
      toast('Safety info saved');
    };
  }
  function plannedHours(job) {
    const nums = (job.steps || []).map((s) => parseFloat(s.beam?.originalDuration || s.beam?.remDuration)).filter((n) => !Number.isNaN(n) && n > 0);
    return nums.reduce((a, b) => a + b, 0);
  }
  function turnaroundJobs(event) {
    const ids = new Set((event.turnaround_jobs || []).map((r) => r.job_id).concat(event.jobs || []));
    return activeList().filter((j) => ids.has(j.id));
  }
  function burnSvg(event, jobs) {
    const start = event.starts_on ? new Date(event.starts_on + 'T00:00:00') : new Date();
    const end = event.ends_on ? new Date(event.ends_on + 'T00:00:00') : new Date(start.getTime() + 14 * 86400000);
    const days = Math.max(1, Math.round((end - start) / 86400000));
    const total = Math.max(jobs.length, 1);
    const ptsP = [];
    const ptsA = [];
    for (let i = 0; i <= days; i++) {
      const day = new Date(start.getTime() + i * 86400000);
      const plannedLeft = total * (1 - i / days);
      const done = jobs.filter((j) => j.completed_at && new Date(j.completed_at) <= day).length;
      const x = 20 + (i / days) * 280;
      ptsP.push(x + ',' + (140 - (plannedLeft / total) * 110));
      ptsA.push(x + ',' + (140 - ((total - done) / total) * 110));
    }
    return '<svg class="burn" viewBox="0 0 320 160" role="img" aria-label="Daily burn-down"><text x="8" y="16" font-size="12">Remaining jobs</text><polyline fill="none" stroke="#8a4f15" stroke-width="2" points="' + ptsP.join(' ') + '" /><polyline fill="none" stroke="#1f7a4c" stroke-width="2" points="' + ptsA.join(' ') + '" /><text x="8" y="156" font-size="11">Brown plan · green actual</text></svg>';
  }
  async function loadTurnarounds() {
    if (state.demoOn) {
      state.turnarounds = state.demoTurnaround ? [state.demoTurnaround] : [];
      return;
    }
    const { data } = await sb.from('turnarounds').select('*, turnaround_jobs(job_id)');
    state.turnarounds = data || [];
  }
  async function renderTurnaround() {
    const host = $('#turn-body');
    if (!host || !canSeeDash()) { if (host) host.innerHTML = '<div class="empty">Turnaround is for supervisors, planners, and admins.</div>'; return; }
    await loadTurnarounds();
    const current = (state.turnarounds || []).find((t) => t.id === state.turnaroundId) || state.turnarounds[0];
    state.turnaroundId = current?.id || '';
    const jobs = current ? turnaroundJobs(current) : [];
    const pct = jobs.length ? Math.round(jobs.filter((j) => j.status === 'done').length / jobs.length * 100) : 0;
    const by = (keyFn) => {
      const map = {};
      for (const job of jobs) {
        const key = keyFn(job) || '—';
        map[key] = map[key] || { n: 0, done: 0 };
        map[key].n++;
        if (job.status === 'done') map[key].done++;
      }
      return Object.entries(map).map(([k, v]) => '<div class="bar-row"><span>' + esc(k) + '</span><div class="bar"><span style="width:' + (v.n ? Math.round(v.done / v.n * 100) : 0) + '%"></span></div><strong>' + (v.n ? Math.round(v.done / v.n * 100) : 0) + '%</strong></div>').join('');
    };
    const critical = jobs.filter((j) => j.status !== 'done' && (j.priority === 'Critical' || dueBucket(j) === 'overdue'));
    const planVs = jobs.map((j) => {
      const planned = plannedHours(j);
      const actual = j.completed_at && j.created_at ? Math.max(0, Math.round((new Date(j.completed_at) - new Date(j.created_at)) / 36e5)) : null;
      return '<tr><td>' + esc(j.wo_number) + '</td><td>' + esc(j.unit || '') + '</td><td>' + (planned || '—') + '</td><td>' + (actual == null ? 'Not finished' : actual + ' h') + '</td><td>' + esc(j.status) + '</td></tr>';
    }).join('');
    const editor = canPlan() && !state.demoOn ? '<form id="turn-new" class="tile-edit"><h3>New turnaround</h3><input class="input" name="name" placeholder="Name" /><div class="filters"><input class="input" type="date" name="starts_on" /><input class="input" type="date" name="ends_on" /></div><label class="lbl">Units</label><div>' + SAFETY_UNITS.map((u) => '<label style="margin-right:10px"><input type="checkbox" name="unit" value="' + esc(u) + '" /> ' + esc(u) + '</label>').join('') + '</div><button class="btn btn-primary" type="submit">Create</button></form>' +
      (current ? '<div class="tile-edit"><h3>Assign jobs</h3><p>Add every job in this turnaround’s units, the jobs matching the Jobs tab filters, or a list of order numbers.</p><button type="button" class="btn" id="turn-bulk">Add jobs in the turnaround units</button> <button type="button" class="btn" id="turn-filter">Add jobs matching Jobs filters</button><label class="lbl">Order numbers, one per line</label><textarea class="textarea" id="turn-orders" placeholder="4500123456"></textarea><button type="button" class="btn" id="turn-import">Add these orders</button></div>' : '') : (state.demoOn ? '<p class="placeholder">Demo turnaround. Reset demo to restore it. Nothing is saved to the plant.</p>' : '');
    host.innerHTML = '<div class="stats"><div class="stat"><div class="n">' + pct + '%</div><div class="l">Complete</div></div><div class="stat hold"><div class="n">' + critical.length + '</div><div class="l">Critical or overdue</div></div><div class="stat"><div class="n">' + jobs.length + '</div><div class="l">Jobs</div></div></div>' +
      (state.turnarounds.length ? '<label class="lbl">Event</label><select id="turn-pick" class="select">' + state.turnarounds.map((t) => '<option value="' + esc(t.id) + '"' + (t.id === state.turnaroundId ? ' selected' : '') + '>' + esc(t.name) + '</option>').join('') + '</select>' : '<p>No turnaround yet.</p>') +
      (current ? '<p>' + esc(current.starts_on || '—') + ' → ' + esc(current.ends_on || '—') + ' · ' + esc((current.units || []).join(', ')) + '</p>' + burnSvg(current, jobs) + '<h3>By unit</h3>' + by((j) => j.unit) + '<h3>By process unit</h3>' + by((j) => puForUnit(j.unit).pu) + '<h3>By trade waiting</h3>' + by((j) => { const w = waitingTrade(j); return w ? tradeLabel(w.trade) : (j.status === 'done' ? 'Done' : '—'); }) + '<h3>Plan vs actual</h3><div class="table-wrap"><table><thead><tr><th>Order</th><th>Unit</th><th>Planned h</th><th>Actual</th><th>Status</th></tr></thead><tbody>' + planVs + '</tbody></table></div><h3>Critical / overdue</h3>' + (critical.map((j) => '<div>' + esc(j.wo_number) + ' · ' + esc(j.title) + ' · ' + esc(j.priority) + '</div>').join('') || '<p>None.</p>') : '') + editor;
    $('#turn-pick') && ($('#turn-pick').onchange = (e) => { state.turnaroundId = e.target.value; renderTurnaround(); });
    const form = $('#turn-new');
    if (form) form.onsubmit = async (e) => {
      e.preventDefault();
      const units = [...form.querySelectorAll('input[name=unit]:checked')].map((el) => el.value);
      const { data, error } = await sb.from('turnarounds').insert({ name: form.name.value.trim() || 'Turnaround', starts_on: form.starts_on.value || null, ends_on: form.ends_on.value || null, units, created_by: state.user.name }).select().single();
      if (error) return toast(error.message);
      const ids = activeList().filter((j) => !units.length || units.includes(normalizeUnit(j.unit))).map((j) => j.id);
      if (ids.length) await sb.from('turnaround_jobs').insert(ids.map((id) => ({ turnaround_id: data.id, job_id: id })));
      state.turnaroundId = data.id;
      toast('Turnaround created');
      renderTurnaround();
    };
    const addJobs = async (ids) => {
      if (!current || state.demoOn) return;
      const have = new Set((current.turnaround_jobs || []).map((r) => r.job_id));
      const add = [...new Set(ids)].filter((id) => id && !have.has(id)).map((id) => ({ turnaround_id: current.id, job_id: id }));
      if (!add.length) return toast('Those jobs are already in the turnaround');
      const { error } = await sb.from('turnaround_jobs').insert(add);
      if (error) return toast(error.message);
      toast('Jobs added');
      renderTurnaround();
    };
    $('#turn-bulk') && ($('#turn-bulk').onclick = () => {
      const units = current?.units || [];
      addJobs(activeList().filter((j) => !units.length || units.includes(normalizeUnit(j.unit))).map((j) => j.id));
    });
    $('#turn-filter') && ($('#turn-filter').onclick = () => addJobs(filteredJobs().map((j) => j.id)));
    $('#turn-import') && ($('#turn-import').onclick = () => {
      const wanted = new Set(String($('#turn-orders')?.value || '').split(/\s+/).map((s) => s.trim().toLowerCase()).filter(Boolean));
      addJobs(activeList().filter((j) => wanted.has(String(j.wo_number || '').trim().toLowerCase())).map((j) => j.id));
    });
  }
  function exportTurnaround(kind) {
    const current = (state.turnarounds || []).find((t) => t.id === state.turnaroundId) || (state.turnarounds || [])[0];
    if (!current) return toast('No turnaround to export');
    const rows = turnaroundJobs(current).map((j) => ({
      Event: current.name, Order: j.wo_number, Title: j.title, Unit: j.unit, PU: puForUnit(j.unit).pu, Priority: j.priority, Status: j.status,
      'Planned hours': plannedHours(j) || '', 'Completed at': j.completed_at || '', 'Displayed completed at': j.completed_at ? fmtTime(j.completed_at) : '', 'Time zone': zoneName(), Overdue: dueBucket(j) === 'overdue' ? 'Yes' : 'No',
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Turnaround');
    if (kind === 'csv') XLSX.writeFile(wb, 'turnaround.csv', { bookType: 'csv' });
    else XLSX.writeFile(wb, 'turnaround.xlsx');
  }

  let deferredInstall = null;
  function appIsInstalled() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }
  function paintInstall() {
    const hide = appIsInstalled();
    document.querySelectorAll('#btn-install, [data-install]').forEach((el) => el.classList.toggle('hidden', hide));
    const banner = $('#install-banner');
    if (banner) banner.classList.toggle('hidden', hide || localStorage.getItem('bl_install_dismiss') === '1');
  }
  function openInstallGuide() {
    const root = $('#modal-root');
    if (!root) return;
    const share = '<svg width="36" height="36" viewBox="0 0 36 36" aria-hidden="true"><rect x="8" y="12" width="20" height="16" rx="3" fill="none" stroke="#1a2332" stroke-width="2"/><path d="M18 6v14M13 11l5-5 5 5" fill="none" stroke="#1a2332" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
    const plus = '<svg width="36" height="36" viewBox="0 0 36 36" aria-hidden="true"><rect x="6" y="6" width="24" height="24" rx="6" fill="none" stroke="#1a2332" stroke-width="2"/><path d="M18 12v12M12 18h12" stroke="#1a2332" stroke-width="2" stroke-linecap="round"/></svg>';
    const add = '<svg width="36" height="36" viewBox="0 0 36 36" aria-hidden="true"><rect x="6" y="10" width="24" height="18" rx="4" fill="#324259"/><text x="18" y="23" text-anchor="middle" fill="#fff" font-size="11" font-family="sans-serif" font-weight="700">Add</text></svg>';
    root.innerHTML = '<div class="overlay" id="ios-guide"><div class="modal" role="dialog" aria-label="Add Beamlock to the Home Screen"><div class="modal-head"><strong>Add to Home Screen</strong><button class="btn btn-sm" id="ios-close" type="button">Close</button></div><div class="modal-body"><p>On iPhone or iPad, Safari does not show an install prompt. Use these three steps.</p><ol class="ios-steps"><li><span class="ios-ico">' + share + '</span><div><strong>1. Share</strong><p>Tap the Share button at the bottom of Safari.</p></div></li><li><span class="ios-ico">' + plus + '</span><div><strong>2. Add to Home Screen</strong><p>Scroll the share sheet and tap Add to Home Screen.</p></div></li><li><span class="ios-ico">' + add + '</span><div><strong>3. Add</strong><p>Tap Add. Beamlock then opens full screen from the icon.</p></div></li></ol></div></div></div>';
    $('#ios-close').onclick = () => { root.innerHTML = ''; };
    $('#ios-guide').onclick = (e) => { if (e.target.id === 'ios-guide') root.innerHTML = ''; };
  }
  async function startInstall() {
    if (appIsInstalled()) return;
    const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    if (deferredInstall && !ios) {
      deferredInstall.prompt();
      try { await deferredInstall.userChoice; } catch (_) {}
      deferredInstall = null;
      paintInstall();
      return;
    }
    openInstallGuide();
  }
  function bind() {
    $('#main-tabs').onclick = (e) => { const t = e.target.closest('.tab'); if (t) setView(t.dataset.view); };
    const setFilter = (key, value) => { state.filters[key] = value; rememberFilters(); renderJobList(); };
    $('#search').oninput = (e) => setFilter('q', e.target.value);
    $('#filter-status').onchange = (e) => setFilter('status', e.target.value);
    $('#filter-priority').onchange = (e) => setFilter('priority', e.target.value);
    if ($('#filter-when')) $('#filter-when').onchange = (e) => setFilter('when', e.target.value);
    $('#filter-unit').onchange = (e) => {
      state.filters.unit = e.target.value;
      if (state.filters.unit) {
        const info = puForUnit(state.filters.unit);
        if (info.pu) state.filters.pu = info.pu;
      }
      rememberFilters();
      renderJobList();
    };
    $('#filter-trade').onchange = (e) => setFilter('trade', e.target.value);
    document.addEventListener('click', (e) => {
      const puChip = e.target.closest('[data-pu-tab]');
      if (puChip) {
        const which = puChip.dataset.puTab;
        const pu = puChip.dataset.pu || '';
        if (which === 'jobs') { state.filters.pu = pu; state.filters.unit = ''; const sel = $('#filter-unit'); if (sel) sel.value = ''; rememberFilters(); renderJobList(); }
        else if (which === 'board') { state.boardPu = pu; state.boardUnit = ''; renderBoard(); }
        return;
      }
      const chip = e.target.closest('[data-unit-tab]');
      if (!chip) return;
      const which = chip.dataset.unitTab;
      const unit = chip.dataset.unit || '';
      if (which === 'jobs') {
        state.filters.unit = unit;
        if (unit) { const info = puForUnit(unit); if (info.pu) state.filters.pu = info.pu; }
        const sel = $('#filter-unit'); if (sel) sel.value = unit;
        rememberFilters();
        renderJobList();
      } else if (which === 'board') {
        state.boardUnit = unit;
        if (unit) { const info = puForUnit(unit); if (info.pu) state.boardPu = info.pu; }
        renderBoard();
      }
    });
    $('#btn-refresh').onclick = () => refreshAll(true);
    $('#btn-new-job').onclick = () => openJobEditor(null);
    $('#btn-beam-import').onclick = openBeamImport;
    $('#btn-import').onclick = openImport;
    $('#btn-export').onclick = exportExcel;
    $('#btn-audit-refresh').onclick = renderAudit;
    $('#btn-logout').onclick = () => signOut('');
    $('#btn-demo') && ($('#btn-demo').onclick = () => state.demoOn ? stopDemo() : startDemo());
    $('#demo-exit') && ($('#demo-exit').onclick = stopDemo);
    $('#demo-reset') && ($('#demo-reset').onclick = resetDemo);
    $('#demo-play') && ($('#demo-play').onclick = toggleDemoPlay);
    $('#btn-profile') && ($('#btn-profile').onclick = openProfile);
    window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferredInstall = e; paintInstall(); });
    window.addEventListener('appinstalled', () => { deferredInstall = null; localStorage.setItem('bl_install_dismiss', '1'); paintInstall(); });
    $('#btn-install') && ($('#btn-install').onclick = () => startInstall());
    $('#install-banner-go') && ($('#install-banner-go').onclick = () => startInstall());
    $('#install-banner-dismiss') && ($('#install-banner-dismiss').onclick = () => { localStorage.setItem('bl_install_dismiss', '1'); paintInstall(); });
    paintInstall();
    $('#btn-handover') && ($('#btn-handover').onclick = openHandover);
    $('#wx-chip') && ($('#wx-chip').onclick = () => openWeatherSheet());
    $('#btn-turn-export') && ($('#btn-turn-export').onclick = () => exportTurnaround('xlsx'));
    $('#btn-turn-csv') && ($('#btn-turn-csv').onclick = () => exportTurnaround('csv'));
    $('#btn-print-security') && ($('#btn-print-security').onclick = () => window.print());
    refreshSyncCount();
    $('#btn-hc').onclick = () => { updatePref('contrast', !state.prefs?.contrast).catch(() => toast('Could not save that preference')); };
    $('#btn-notify').onclick = async () => {
      if (!('Notification' in window)) return toast('This browser has no notifications');
      const next = !state.prefs?.notify;
      if (next) {
        const perm = await Notification.requestPermission();
        if (perm !== 'granted') return toast('Notifications were not allowed');
      }
      await updatePref('notify', next);
      toast(next ? 'Alerts on for this device' : 'Alerts off for this device');
      if (state.view === 'settings') renderSettings();
    };
    if (window.matchMedia) {
      const themeQ = window.matchMedia('(prefers-color-scheme: dark)');
      const motionQ = window.matchMedia('(prefers-reduced-motion: reduce)');
      const onSystem = () => { if (state.prefs) applyAppearance(state.prefs); };
      if (themeQ.addEventListener) { themeQ.addEventListener('change', onSystem); motionQ.addEventListener('change', onSystem); }
    }
    window.addEventListener('offline', () => setLiveStatus('offline'));
    window.addEventListener('online', () => { setLiveStatus('reconnecting'); flushOutbox().then(() => { if (state.prefsDirty) persistPrefs(); refreshAll(false); }); });
    let pullY = null;
    document.addEventListener('touchstart', (e) => {
      if (window.scrollY > 8 || document.querySelector('.overlay')) { pullY = null; return; }
      pullY = e.touches[0].clientY;
    }, { passive: true });
    document.addEventListener('touchmove', (e) => {
      if (pullY == null) return;
      const hint = $('#pull-hint');
      if (hint) hint.classList.toggle('hidden', e.touches[0].clientY - pullY < 48);
    }, { passive: true });
    document.addEventListener('touchend', (e) => {
      if (pullY == null) return;
      const dy = e.changedTouches[0].clientY - pullY;
      pullY = null;
      $('#pull-hint')?.classList.add('hidden');
      if (dy > 72 && window.scrollY <= 8 && !document.querySelector('.overlay')) refreshAll(true);
    }, { passive: true });
    const tradeHost = $('#adm-trades');
    if (tradeHost) {
      tradeHost.addEventListener('input', () => readTradeDraftFromDom());
      tradeHost.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-move]');
        if (!btn || btn.disabled) return;
        readTradeDraftFromDom();
        const i = +btn.closest('.trade-edit').dataset.i;
        const j = btn.dataset.move === 'up' ? i - 1 : i + 1;
        if (!state.tradeDraft || j < 0 || j >= state.tradeDraft.length) return;
        const tmp = state.tradeDraft[i];
        state.tradeDraft[i] = state.tradeDraft[j];
        state.tradeDraft[j] = tmp;
        if (document.activeElement) document.activeElement.blur();
        renderTradeAdmin();
      });
    }
    if ($('#adm-trade-add')) $('#adm-trade-add').onclick = () => {
      if (!state.tradeDraft) state.tradeDraft = getTrades().map((t) => ({ ...t }));
      readTradeDraftFromDom();
      state.tradeDraft.push({ id: '', label: 'New trade', short: 'NEW', color: '#334155', active: true });
      if (document.activeElement) document.activeElement.blur();
      renderTradeAdmin();
    };
    $('#btn-notify').onclick = async () => {
      if (!('Notification' in window)) return toast('Notifications not available in this browser');
      try {
        const p = await Notification.requestPermission();
        toast(p === 'granted' ? 'Notifications enabled' : 'Notifications blocked');
      } catch { toast('Notifications blocked'); }
    };
    $('#adm-save').onclick = async () => {
      try {
        const tiles = $$('#adm-tiles .tile-edit').map((row, i) => ({
          id: (state.tiles[i] || {}).id || ('tile-' + i),
          icon: $('[data-k=icon]', row).value.trim(), name: $('[data-k=name]', row).value.trim(),
          url: $('[data-k=url]', row).value.trim(), description: $('[data-k=description]', row).value.trim(), sort_order: i + 1,
        }));
        const embedUrl = extractIframeSrc($('#adm-pbi-embed').value.trim());
        const unitsRaw = ($('#adm-units')?.value || '').split(/\n|,/).map((s) => s.trim()).filter(Boolean);
        const units = unitsRaw.length ? unitsRaw : DEFAULT_UNITS.slice();
        const parsedSites = parseSites($('#adm-sites')?.value || '');
        const sites = parsedSites.length ? parsedSites : cloneSites(DEFAULT_SITES);
        const unitPatterns = parseUnitPatterns($('#adm-unit-map')?.value || '');
        const amber = Number($('#adm-wind-amber')?.value);
        const red = Number($('#adm-wind-red')?.value);
        const ds = { ...(state.settings?.data_source || {}), units, sites, trades: tradesForSave(), unit_patterns: unitPatterns.length ? unitPatterns : DEFAULT_UNIT_PATTERNS.map((p) => ({ ...p })), wind: { amber: amber > 0 ? amber : 30, red: red > 0 ? red : 40 }, adapter: state.settings?.data_source?.adapter || 'supabase', label: state.settings?.data_source?.label || 'Supabase (Beamlock)' };
        await sb.from('app_settings').upsert({
          id: 'default',
          url_templates: {
            ...(state.settings?.url_templates || {}),
            sap: $('#adm-sap').value.trim(),
            permitVision: $('#adm-pv').value.trim(),
            powerBi: $('#adm-pbi-tpl').value.trim(),
            digitalTwin: ($('#adm-twin')?.value || '').trim(),
            pid: ($('#adm-pid')?.value || '').trim(),
            piVision: ($('#adm-pi')?.value || '').trim(),
            utl: ($('#adm-utl')?.value || '').trim(),
          },
          power_bi_embed: { embedUrl, title: $('#adm-pbi-title').value.trim(), lastConfiguredAt: new Date().toISOString() },
          data_source: ds,
          updated_at: new Date().toISOString(),
        });
        for (const t of tiles) await sb.from('app_tiles').upsert(t);
        state.tradeDraft = null;
        await loadMeta(); renderAdmin(); renderApps(); renderDashboards(); renderTradeFilter(); if (state.weather) paintWeather(state.weather); toast('Integration settings saved');
      } catch (e) { toast(e.message); }
    };
    document.addEventListener('click', (e) => {
      const add = e.target.closest('.react-add');
      if (add) {
        const wrap = add.parentElement;
        const open = wrap.classList.contains('open');
        document.querySelectorAll('.react-add-wrap.open, .react-pill.open').forEach((el) => el.classList.remove('open'));
        if (!open) wrap.classList.add('open');
        return;
      }
      const pill = e.target.closest('.react-pill');
      if (pill) {
        const open = pill.classList.contains('open');
        document.querySelectorAll('.react-add-wrap.open, .react-pill.open').forEach((el) => el.classList.remove('open'));
        if (!open) pill.classList.add('open');
        return;
      }
      document.querySelectorAll('.react-add-wrap.open, .react-pill.open').forEach((el) => el.classList.remove('open'));
      const react = e.target.closest('.react-choice');
      if (react) { toggleReaction(react.dataset.react, react.dataset.id, react.dataset.job, react.dataset.kind); return; }
      const safety = e.target.closest('[data-card-safety]');
      if (safety) { state.safetyUnit = safety.dataset.cardSafety || ''; setView('safety'); return; }
      const card = e.target.closest('.job-card');
      if (card && !e.target.closest('button')) openJob(card.dataset.id);
    });
  }

  bind();
  bindAuth();
  paintRememberedLogin();
  sb.auth.onAuthStateChange(async (event) => {
    if (event !== 'SIGNED_OUT' || state.explicitSignOut || state.changingCode) return;
    const { data } = await sb.auth.getSession();
    if (!data?.session && state.user) showLogin('');
  });
  sb.auth.getSession().then(({ data }) => {
    if (data?.session) return openSession();
    showLogin('');
    return loadSignupRoles();
  }).catch((e) => { console.error(e); showLogin('Could not reach the account service.'); });
})();
