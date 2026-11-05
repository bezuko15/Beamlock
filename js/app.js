/* Beamlock — static PWA client (Supabase) */
(function () {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const cfg = window.BEAMLOCK_CONFIG;
  const { createClient } = window.supabase;
  const sb = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);

  const ROLES = ['Planner', 'Supervisor', 'Operator', 'Insulator', 'Electrician', 'Pipefitter', 'NDE'];
  const TRADES = [
    { id: 'Insulator', label: 'Insulators', short: 'INS' },
    { id: 'Electrician', label: 'Electrical', short: 'EL' },
    { id: 'Pipefitter', label: 'Pipefitters', short: 'FIT' },
    { id: 'NDE', label: 'NDE', short: 'NDE' },
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
  const TRADE_SHORT = { Insulator: 'INS', Electrician: 'EL', Pipefitter: 'FIT', NDE: 'NDE' };
  const DEFAULT_UNITS = ['RHC', 'A&V', 'SRU', 'COGEN', 'Waterblock', 'HMU'];
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
    const units = unitsOverride || getUnits();
    const { counts, total } = unitCounts(jobs, units);
    const sel = selected || '';
    let html = '<button type="button" class="unit-chip' + (!sel ? ' on' : '') + '" data-unit="" data-unit-tab="' + idPrefix + '">All<span class="count">' + total + '</span></button>';
    for (const u of units) {
      html += '<button type="button" class="unit-chip' + (sel === u ? ' on' : '') + '" data-unit="' + esc(u) + '" data-unit-tab="' + idPrefix + '">' + esc(u) + '<span class="count">' + (counts[u] || 0) + '</span></button>';
    }
    return html;
  }

  const state = {
    user: null, people: [], jobs: [], settings: null, tiles: [], view: 'jobs',
    filters: { q: '', status: '', priority: '', trade: '', unit: '', pu: '' }, boardUnit: '', boardPu: '', channels: {},
  };

  function esc(s) {
    return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function toast(msg, ms = 4500) {
    const el = document.createElement('div'); el.className = 'toast'; el.textContent = msg;
    $('#toast-wrap').appendChild(el); setTimeout(() => el.remove(), ms);
  }
  function fmtTime(iso) {
    if (!iso) return '';
    try { return new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
    catch { return iso; }
  }
  function roleTrade(role) {
    return ({ Insulator: 'Insulator', Electrician: 'Electrician', Pipefitter: 'Pipefitter', NDE: 'NDE' })[role] || null;
  }
  function saveUser(u) { localStorage.setItem('bl_user', JSON.stringify(u)); state.user = u; }
  function loadUser() { try { return JSON.parse(localStorage.getItem('bl_user') || 'null'); } catch { return null; } }

  async function audit(jobId, action, detail) {
    await sb.from('audit_log').insert({
      job_id: jobId || null, action, actor_name: state.user?.name, actor_role: state.user?.role, detail: detail || null,
    });
  }

  async function refreshStepReadiness(jobId) {
    const { data: steps } = await sb.from('steps').select('*, step_assignees(*)').eq('job_id', jobId).order('sort_order');
    if (!steps) return;
    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const assignees = step.step_assignees || [];
      const allSigned = assignees.length > 0 && assignees.every((a) => a.signed_off);
      if (allSigned) { await sb.from('steps').update({ status: 'done' }).eq('id', step.id); step.status = 'done'; continue; }
      let previousDone = true;
      if (i > 0) previousDone = steps[i - 1].status === 'done';
      const anySigned = assignees.some((a) => a.signed_off);
      let status = 'pending';
      if (!previousDone) status = 'pending';
      else if (anySigned) status = 'in_progress';
      else status = 'ready';
      await sb.from('steps').update({ status }).eq('id', step.id);
      step.status = status;
    }
    const { data: job } = await sb.from('jobs').select('*').eq('id', jobId).single();
    if (!job) return;
    if (job.on_hold) { await sb.from('jobs').update({ status: 'on_hold', updated_at: new Date().toISOString() }).eq('id', jobId); return; }
    const { data: steps2 } = await sb.from('steps').select('status').eq('job_id', jobId);
    const allDone = steps2.length && steps2.every((s) => s.status === 'done');
    const anyActive = steps2.some((s) => s.status === 'done' || s.status === 'ready' || s.status === 'in_progress');
    let status = 'not_started';
    if (allDone) status = 'done';
    else if (anyActive) status = 'in_progress';
    await sb.from('jobs').update({ status, updated_at: new Date().toISOString() }).eq('id', jobId);
  }

  async function loadFullJobs() {
    const { data: jobs, error } = await sb.from('jobs').select('*').eq('archived', false).order('updated_at', { ascending: false });
    if (error) throw error;
    const ids = jobs.map((j) => j.id);
    if (!ids.length) { state.jobs = []; return; }
    const { data: steps } = await sb.from('steps').select('*, step_assignees(*)').in('job_id', ids).order('sort_order');
    const { data: comments } = await sb.from('comments').select('*').in('job_id', ids).order('created_at');
    const { data: audits } = await sb.from('audit_log').select('*').in('job_id', ids).order('created_at', { ascending: false }).limit(500);
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
    const jobs = state.jobs;
    const byTradeWaiting = { Insulator: 0, Electrician: 0, Pipefitter: 0, NDE: 0 };
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
    const dot = $('#live-dot');
    const channel = sb.channel('beamlock-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, () => refreshAll(false))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'steps' }, () => refreshAll(false))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'step_assignees' }, async (payload) => {
        await refreshAll(false);
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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, () => refreshAll(false))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_settings' }, () => loadMeta().then(renderDataSource))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'app_tiles' }, () => loadMeta().then(() => { if (state.view === 'apps') renderApps(); }))
      .subscribe((status) => {
        if (dot) dot.classList.toggle('off', status !== 'SUBSCRIBED');
      });
    state.channels.main = channel;
  }

  function notify(title, body) {
    if (Notification?.permission === 'granted') {
      try { new Notification(title, { body, icon: './icons/icon-192.png' }); } catch (_) {}
    }
  }

  async function refreshAll(showErr) {
    try {
      await loadFullJobs();
      renderAll();
    } catch (e) {
      console.error(e);
      if (showErr) toast('Refresh failed: ' + e.message);
    }
  }

  async function initLogin() {
    await loadMeta();
    $('#people-list').innerHTML = state.people.map((p) => '<option value="' + esc(p.name) + '">').join('');
    const grid = $('#role-grid');
    grid.innerHTML = ROLES.map((r) => '<button type="button" class="role-btn" data-role="' + esc(r) + '">' + esc(r) + '</button>').join('');
    let selected = null;
    grid.onclick = (e) => {
      const b = e.target.closest('.role-btn'); if (!b) return;
      $$('.role-btn', grid).forEach((x) => x.classList.remove('on'));
      b.classList.add('on'); selected = b.dataset.role;
      const match = state.people.find((p) => p.role === selected);
      if (match && !$('#login-name').value) $('#login-name').value = match.name;
    };
    $('#login-btn').onclick = () => {
      const name = $('#login-name').value.trim();
      if (!name) return toast('Enter your name');
      if (!selected) return toast('Pick a role');
      const pin = $('#login-pin').value.trim();
      if (pin && pin !== cfg.demoPin) return toast('Wrong demo PIN (hint: 1234)');
      const person = state.people.find((p) => p.name.toLowerCase() === name.toLowerCase());
      saveUser({ name: person?.name || name, role: selected, trade: roleTrade(selected) || person?.trade || null, personId: person?.id || null });
      enterApp();
    };
  }

  function enterApp() {
    $('#login').classList.add('hidden');
    $('#app').classList.remove('hidden');
    $('#user-label').textContent = state.user.name + ' · ' + state.user.role;
    const canPlan = ['Planner', 'Supervisor'].includes(state.user.role);
    $('#tab-planner').style.display = canPlan ? '' : 'none';
    $('#tab-admin').style.display = canPlan ? '' : 'none';
    renderDataSource();
    subscribeRealtime();
    refreshAll(true);
    if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js').catch(() => {});
  }

  function filteredJobs() {
    let list = state.jobs.slice();
    const { q, status, priority, trade, unit, pu } = state.filters;
    if (q) {
      const qq = q.toLowerCase();
      list = list.filter((j) => {
        const place = puForUnit(j.unit);
        return [j.wo_number, j.title, j.equipment_tag, j.unit, j.area, j.description, j.sap_work_order, j.sap_notification, j.permit_vision_id, j.functional_location, j.pid_number, j.equipment_location, place.pu, place.site].join(' ').toLowerCase().includes(qq);
      });
    }
    if (status === 'on_hold') list = list.filter((j) => j.on_hold);
    else if (status) list = list.filter((j) => j.status === status && !j.on_hold);
    if (priority) list = list.filter((j) => j.priority === priority);
    if (trade) list = list.filter((j) => j.steps.some((s) => s.trade === trade));
    if (pu) list = list.filter((j) => puForUnit(j.unit).pu === pu);
    if (unit) list = list.filter((j) => normalizeUnit(j.unit) === unit);
    return list;
  }

  function jobCard(job) {
    const wait = waitingTrade(job);
    const mine = isMyTurn(job);
    const place = puForUnit(job.unit);
    const steps = job.steps.map((s) => '<span class="step-pip ' + s.status + '" title="' + esc(s.label) + '">' + (TRADE_SHORT[s.trade] || s.trade.slice(0, 2)) + '</span>').join('');
    return '<article class="job-card priority-' + esc(job.priority) + (job.on_hold ? ' on-hold' : '') + (mine ? ' your-turn' : '') + '" data-id="' + job.id + '" data-pu="' + esc(place.pu) + '" data-site="' + esc(place.site) + '">' +
      '<div class="job-top"><div class="wo">' + esc(job.wo_number) + '</div><div class="chip ' + (job.on_hold ? 'bad' : job.status === 'done' ? 'ok' : 'hot') + '">' + (job.on_hold ? 'ON HOLD' : esc(String(job.status).replace('_', ' '))) + '</div></div>' +
      '<div class="title">' + esc(job.title) + '</div><div class="meta">' +
      '<span class="chip">' + esc(job.unit || '—') + '</span>' +
      (place.pu ? '<span class="chip pu">' + esc(place.pu) + '</span>' : '') +
      '<span class="chip">' + esc(job.equipment_tag || 'no tag') + '</span>' +
      (job.functional_location ? '<span class="chip">FL: ' + esc(job.functional_location) + '</span>' : '') +
      (job.sap_notification ? '<span class="chip">Notif: ' + esc(job.sap_notification) + '</span>' : '') +
      (job.permit_vision_id ? '<span class="chip">PV: ' + esc(job.permit_vision_id) + '</span>' : '') +
      (job.pid_number ? '<span class="chip">P&ID: ' + esc(job.pid_number) + '</span>' : '') +
      (job.equipment_location ? '<span class="chip">Loc: ' + esc(job.equipment_location) + '</span>' : '') +
      '<span class="chip">' + esc(job.priority) + '</span>' +
      (wait ? '<span class="chip hot">Waiting: ' + esc(wait.trade) + '</span>' : '') +
      (mine ? '<span class="chip hot">YOUR TURN</span>' : '') +
      '</div><div class="steps-mini">' + steps + '</div>' +
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
    const rest = getUnits().filter((u) => !seen.has(u));
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
    const list = filteredJobs();
    const host = $('#job-list');
    if (!list.length) { host.innerHTML = '<div class="empty">No jobs match.</div>'; return; }
    if (state.filters.unit) {
      host.innerHTML = list.map(jobCard).join('');
      return;
    }
    host.innerHTML = groupedSectionsHtml(list, '') || '<div class="empty">No jobs match.</div>';
  }
  function renderMine() {
    const list = state.jobs.filter(isMyTurn);
    $('#mine-count').textContent = String(list.length);
    $('#mine-list').innerHTML = list.length ? list.map(jobCard).join('') : '<div class="empty">' + (state.user?.trade ? 'Nothing waiting on ' + esc(state.user.trade) + '.' : 'Sign in as a trade role.') + '</div>';
  }
  function renderBoard() {
    const puFilter = state.boardPu || '';
    const unitFilter = state.boardUnit || '';
    let jobs = state.jobs.slice();
    const puTabs = $('#board-pu-tabs');
    if (puTabs) puTabs.innerHTML = puTabsHtml(puFilter, jobs, 'board');
    if (puFilter) jobs = jobs.filter((j) => puForUnit(j.unit).pu === puFilter);
    const tabs = $('#board-unit-tabs');
    if (tabs) tabs.innerHTML = unitTabsHtml(unitFilter, jobs, 'board', unitsForPu(puFilter));
    if (unitFilter) jobs = jobs.filter((j) => normalizeUnit(j.unit) === unitFilter);
    // stats for filtered set
    const byTradeWaiting = { Insulator: 0, Electrician: 0, Pipefitter: 0, NDE: 0 };
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
      Object.entries(byTradeWaiting).map(([t, n]) => '<div class="stat wait"><div class="n">' + n + '</div><div class="l">Waiting ' + esc(t) + '</div></div>').join('');
    const host = $('#board-list');
    if (!jobs.length) { host.innerHTML = '<div class="empty">No jobs on board.</div>'; return; }
    if (unitFilter) {
      host.innerHTML = '<div class="job-grid board">' + jobs.map(jobCard).join('') + '</div>';
      return;
    }
    host.innerHTML = groupedSectionsHtml(jobs, 'board') || '<div class="empty">No jobs on board.</div>';
  }
  function renderPlanner() { $('#planner-list').innerHTML = state.jobs.map(jobCard).join('') || '<div class="empty">No jobs yet.</div>'; }
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
  function renderApps() {
    $('#app-tiles').innerHTML = state.tiles.map((t) => {
      const url = externalUrl(t.url);
      const body = '<div class="ico">' + esc(t.icon || '·') + '</div><div class="name">' + esc(t.name) + '</div><div class="desc">' + esc(t.description || '') + '</div>';
      if (url) return '<a class="app-tile" href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' + body + '</a>';
      return '<div class="app-tile disabled" aria-disabled="true">' + body + '<div class="not-configured">Not configured yet</div></div>';
    }).join('') || '<div class="empty">No tiles.</div>';
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
  function renderAdmin() {
    const tpl = state.settings?.url_templates || {};
    $('#adm-sap').value = tpl.sap || '';
    $('#adm-pv').value = tpl.permitVision || '';
    $('#adm-pbi-tpl').value = tpl.powerBi || '';
    if ($('#adm-twin')) $('#adm-twin').value = tpl.digitalTwin || '';
    if ($('#adm-pid')) $('#adm-pid').value = tpl.pid || '';
    if ($('#adm-utl')) $('#adm-utl').value = tpl.utl || '';
    $('#adm-pbi-embed').value = state.settings?.power_bi_embed?.embedUrl || '';
    $('#adm-pbi-title').value = state.settings?.power_bi_embed?.title || 'Maintenance dashboard';
    const unitsEl = $('#adm-units');
    if (unitsEl) unitsEl.value = getUnits().join('\n');
    const sitesEl = $('#adm-sites');
    if (sitesEl) sitesEl.value = formatSites(getSites());
    $('#adm-tiles').innerHTML = state.tiles.map((t, i) =>
      '<div class="tile-edit" data-i="' + i + '"><input class="input" data-k="icon" value="' + esc(t.icon || '') + '" /><input class="input" data-k="name" value="' + esc(t.name || '') + '" /><input class="input" data-k="url" value="' + esc(t.url || '') + '" placeholder="https://…" /><input class="input" data-k="description" value="' + esc(t.description || '') + '" style="grid-column:1/-1" /></div>'
    ).join('');
  }
  function renderAll() {
    renderMiniStats(); renderJobList(); renderMine(); renderBoard();
    if (state.view === 'planner') renderPlanner();
    if (state.view === 'audit') renderAudit();
    if (state.view === 'apps') renderApps();
    if (state.view === 'dashboards') renderDashboards();
    if (state.view === 'admin') renderAdmin();
  }
  function setView(name) {
    state.view = name;
    $$('#main-tabs .tab').forEach((t) => t.classList.toggle('active', t.dataset.view === name));
    ['jobs', 'mine', 'board', 'planner', 'apps', 'dashboards', 'admin', 'audit'].forEach((v) => {
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
  function disabledBtn(label) {
    return '<button type="button" class="btn btn-sm" disabled>' + esc(label) + ' — not configured yet</button>';
  }
  function launchAnchor(label, url) {
    if (!url) return disabledBtn(label);
    return '<a class="btn btn-sm" href="' + esc(url) + '" target="_blank" rel="noopener noreferrer">' + esc(label) + '</a>';
  }
  const EDMONTON = 'America/Edmonton';
  function edmontonParts(input) {
    const d = input ? new Date(input) : new Date();
    if (Number.isNaN(d.getTime())) return null;
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: EDMONTON, year: 'numeric', month: 'short', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZoneName: 'short',
    }).formatToParts(d);
    const g = (t) => parts.find((p) => p.type === t)?.value || '';
    return {
      stamp: g('day') + ' ' + g('month') + ' ' + g('year') + ' ' + g('hour') + ':' + g('minute') + ' ' + g('timeZoneName'),
      dayKey: new Intl.DateTimeFormat('en-CA', { timeZone: EDMONTON, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d),
    };
  }
  function fmtEdmonton(iso) { return edmontonParts(iso)?.stamp || ''; }
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
    lines.push('', 'Sign-offs:');
    const signoffs = [];
    (job.steps || []).forEach((s) => {
      (s.assignees || []).filter((a) => a.signed_off).forEach((a) => {
        signoffs.push('- ' + s.trade + ' — ' + (a.person_name || '—') + ' — ' + (a.signed_at ? fmtEdmonton(a.signed_at) : '—'));
      });
    });
    lines.push(signoffs.length ? signoffs.join('\n') : '- none yet');
    lines.push('', 'Holds:');
    if (job.on_hold || job.hold_reason) {
      lines.push('- ' + (job.hold_reason || 'On hold') + (job.hold_by ? ' — ' + job.hold_by : '') + (job.hold_at ? ' — ' + fmtEdmonton(job.hold_at) : ''));
    } else lines.push('- none');
    let comments = (job.comments || []).slice();
    if (only) comments = [only];
    else if (notesMode === 'today') comments = comments.filter((c) => edmontonParts(c.created_at)?.dayKey === now.dayKey);
    comments.sort((a, b) => String(a.created_at || '').localeCompare(String(b.created_at || '')));
    lines.push('', only ? 'Note:' : (notesMode === 'today' ? "Today's notes:" : 'Notes:'));
    if (!comments.length) lines.push('- ' + (notesMode === 'today' && !only ? 'none today' : 'none'));
    else comments.forEach((c) => lines.push('- ' + fmtEdmonton(c.created_at) + ' — ' + (c.author_name || '—') + ' — ' + (c.author_role || '—') + ' — ' + (c.body || '')));
    return lines.join('\n');
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
    const canPlan = ['Planner', 'Supervisor'].includes(state.user.role);
    const wait = waitingTrade(job);
    const place = puForUnit(job.unit);
    const tpl = state.settings?.url_templates || {};
    const refs = jobRefs(job);
    const utlHref = externalUrl(tpl.utl);
    const launchHtml = [
      launchAnchor('Open in SAP', (tpl.sap && (job.sap_work_order || job.wo_number)) ? templateReady(tpl.sap, refs) : ''),
      launchAnchor('Open in Permit Vision', (tpl.permitVision && job.permit_vision_id) ? templateReady(tpl.permitVision, refs) : ''),
      launchAnchor('Open in Power BI', tpl.powerBi ? templateReady(tpl.powerBi, refs) : ''),
      launchAnchor('Digital twin', digitalTwinUrl(tpl.digitalTwin, refs)),
      launchAnchor('P&ID', pidLinkUrl(tpl.pid, refs)),
    ].join('');
    const utlOpen = utlHref
      ? '<a class="btn btn-sm" href="' + esc(utlHref) + '" target="_blank" rel="noopener noreferrer">Open UTL log</a>'
      : disabledBtn('Open UTL log');

    root.innerHTML = '<div class="overlay" id="job-overlay"><div class="modal" role="dialog">' +
      '<div class="modal-head"><div><div class="wo">' + esc(job.wo_number) + '</div><div class="title" style="margin:0">' + esc(job.title) + '</div>' +
      '<div class="meta" style="margin-top:8px"><span class="chip">' + esc(job.unit) + ' · ' + esc(job.area || '') + '</span>' +
      (place.pu ? '<span class="chip pu">' + esc((place.site ? place.site + ' · ' : '') + place.pu) + '</span>' : '') +
      '<span class="chip">' + esc(job.equipment_tag) + '</span><span class="chip">' + esc(job.priority) + '</span></div></div>' +
      '<button class="btn btn-sm" id="close-modal">Close</button></div><div class="modal-body">' +
      (job.equipment_location ? '<div class="equip-loc"><span class="k">Equipment location</span><span class="v">' + esc(job.equipment_location) + '</span></div>' : '') +
      (job.on_hold ? '<div class="hold-banner">ON HOLD — ' + esc(job.hold_reason || '') + ' (' + esc(job.hold_by || '') + ')</div>' : '') +
      '<p style="color:var(--muted);margin-top:0">' + esc(job.description || '') + '</p>' +
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
      '<div class="modal-actions" style="margin:12px 0">' +
      (job.on_hold ? '<button class="btn btn-success btn-sm" data-act="clear-hold">Clear hold</button>' : '<button class="btn btn-danger btn-sm" data-act="hold">Flag on hold</button>') +
      (canPlan ? '<button class="btn btn-sm" data-act="edit">Edit job</button><button class="btn btn-sm" data-act="archive">Archive</button>' : '') +
      '</div><h3 style="margin-bottom:8px">Trade steps</h3><div class="step-list">' +
      job.steps.map((s) => stepHtml(s, job)).join('') +
      '</div><h3>Notes</h3><div class="comment-tabs"><button class="tab active btn-sm" data-channel="trades">Trades</button><button class="tab btn-sm" data-channel="operators">Operators</button></div>' +
      '<div class="comments" id="comments"></div><form class="comment-form" id="comment-form"><textarea class="textarea" name="body" placeholder="Add a note…" required></textarea>' +
      '<div class="row"><input type="file" name="photo" accept="image/*" capture="environment" /><button class="btn btn-primary btn-sm" type="submit">Post note</button></div></form>' +
      '<h3 style="margin-top:20px">Audit trail</h3><div class="audit-list">' +
      (job.audit || []).slice(0, 40).map((a) => '<div class="audit-item"><div class="t">' + fmtTime(a.created_at) + ' · ' + esc(a.actor_name || '') + '</div><div><strong>' + esc(a.action) + '</strong> ' + esc(a.detail || '') + '</div></div>').join('') +
      '</div></div></div></div>';

    let channel = 'trades';
    const renderComments = () => {
      const items = (job.comments || []).filter((c) => c.channel === channel);
      $('#comments').innerHTML = items.map((c) => '<div class="comment"><div class="who"><span>' + esc(c.author_name) + ' · ' + esc(c.author_role) + ' · ' + fmtTime(c.created_at) + '</span><button type="button" class="btn btn-sm" data-copy-comment="' + esc(c.id) + '">Copy to UTL log</button></div><div>' + esc(c.body) + '</div>' +
        (c.photo_path ? '<img src="' + esc(c.photo_path) + '" alt="attachment" />' : '') + '</div>').join('') || '<div class="empty">No notes yet.</div>';
      $$('[data-copy-comment]', root).forEach((btn) => {
        btn.onclick = () => {
          const comment = (job.comments || []).find((c) => c.id === btn.dataset.copyComment);
          if (comment) copyText(buildUtlLog(job, { onlyComment: comment }));
        };
      });
    };
    renderComments();
    $$('[data-utl]', root).forEach((btn) => { btn.onclick = () => copyText(buildUtlLog(job, { notes: btn.dataset.utl })); });
    $$('.comment-tabs .tab', root).forEach((t) => { t.onclick = () => { $$('.comment-tabs .tab', root).forEach((x) => x.classList.remove('active')); t.classList.add('active'); channel = t.dataset.channel; renderComments(); }; });
    $('#close-modal').onclick = () => { root.innerHTML = ''; };
    $('#job-overlay').onclick = (e) => { if (e.target.id === 'job-overlay') root.innerHTML = ''; };

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
    $('#comment-form').onsubmit = async (e) => {
      e.preventDefault();
      const body = e.target.body.value.trim(); const file = e.target.photo.files[0];
      let photo_path = null;
      if (file) {
        try {
          const blob = await resizeImage(file, 1280);
          const path = job.id + '/' + Date.now() + '.jpg';
          const { error } = await sb.storage.from('comment-photos').upload(path, blob, { contentType: 'image/jpeg', upsert: true });
          if (error) throw error;
          photo_path = sb.storage.from('comment-photos').getPublicUrl(path).data.publicUrl;
        } catch (err) { toast('Photo upload failed: ' + err.message); }
      }
      if (!body && !photo_path) return toast('Comment required');
      await sb.from('comments').insert({ job_id: job.id, author_name: state.user.name, author_role: state.user.role, channel, body: body || '(photo)', photo_path });
      await audit(job.id, 'comment', channel + ': ' + (body || '(photo)').slice(0, 80));
      await sb.from('jobs').update({ updated_at: new Date().toISOString() }).eq('id', job.id);
      await refreshAll(false); showJobModal(state.jobs.find((j) => j.id === job.id)); toast('Note posted');
    };
  }

  function stepHtml(s, job) {
    const canSign = !job.on_hold && (s.status === 'ready' || s.status === 'in_progress' || s.status === 'done');
    return '<div class="step-row ' + s.status + '"><div class="step-head"><div class="step-label">' + esc(s.label) + ' <span class="chip">' + esc(s.trade) + '</span></div><div class="chip">' + esc(String(s.status).replace('_', ' ')) + '</div></div><div class="assignees">' +
      (s.assignees || []).map((a) => {
        const mine = state.user && a.person_name.toLowerCase() === state.user.name.toLowerCase();
        const readyMe = !a.signed_off && canSign && (mine || state.user?.trade === s.trade || ['Planner', 'Supervisor'].includes(state.user?.role));
        return '<div class="person-sign"><button type="button" class="circle ' + (a.signed_off ? 'signed' : '') + (readyMe ? ' ready-me' : '') + '" data-assignee="' + a.id + '">' + (a.signed_off ? '✓' : '') + '</button>' +
          '<div class="person-name">' + esc(a.person_name) + '</div><div class="person-time">' + (a.signed_at ? fmtTime(a.signed_at) : 'tap to sign') + '</div></div>';
      }).join('') +
      '<button class="btn btn-sm" data-add-person="' + s.id + '">+ person</button></div></div>';
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
    const peeps = state.people.filter((p) => p.trade === trade);
    return peeps.length ? peeps.map((p) => ({ person_id: p.id, person_name: p.name })) : [{ person_name: trade + ' crew' }];
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
        '<label class="lbl">Tap trades to build sequence</label><div class="trade-chips">' + TRADES.map((t) => '<button type="button" class="trade-chip" data-trade="' + t.id + '">+ ' + esc(t.label) + '</button>').join('') +
        '<label style="display:flex;align-items:center;gap:8px;margin-left:8px"><input type="checkbox" id="f-reverse" ' + (addReverse ? 'checked' : '') + ' /> Add reverse steps</label></div>' +
        '<div id="step-editor"></div><button class="btn btn-primary btn-block" id="save-job" style="margin-top:16px">' + (existing ? 'Save changes' : 'Create job') + '</button></div></div></div>';
      $('#step-editor').innerHTML = steps.map((s, i) => '<div class="step-row" style="margin-top:8px"><div class="step-head"><strong>' + (i + 1) + '. ' + esc(s.label) + '</strong><div style="display:flex;gap:4px">' +
        '<button class="btn btn-sm" data-up="' + i + '" ' + (i === 0 ? 'disabled' : '') + '>↑</button><button class="btn btn-sm" data-down="' + i + '" ' + (i === steps.length - 1 ? 'disabled' : '') + '>↓</button><button class="btn btn-sm btn-danger" data-del="' + i + '">✕</button></div></div>' +
        '<input class="input" data-label="' + i + '" value="' + esc(s.label) + '" /></div>').join('') || '<div class="empty">Add trades or pick a template</div>';
      $$('[data-tpl]', root).forEach((b) => b.onclick = () => { steps = TEMPLATES[b.dataset.tpl].steps.map((s) => ({ ...s, assignees: defaultAssignees(s.trade) })); maybeReverse(); renderEditor(); });
      $$('.trade-chip', root).forEach((b) => b.onclick = () => { const trade = b.dataset.trade; steps.push({ trade, label: trade + ' — work', assignees: defaultAssignees(trade) }); maybeReverse(); renderEditor(); });
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

  function openImport() {
    const root = $('#modal-root');
    let preview = null; let mapping = {};
    root.innerHTML = '<div class="overlay"><div class="modal"><div class="modal-head"><strong>Import backlog</strong><button class="btn btn-sm" id="close-imp">Close</button></div><div class="modal-body"><p style="color:var(--muted)">Upload .xlsx / .csv. Map columns, pick a default template, then import (client-side SheetJS → Supabase). Process unit is derived from the unit (Upgrader South → PU1 / PU2) and is not stored as its own column.</p><input type="file" id="imp-file" accept=".xlsx,.xls,.csv" /><div id="imp-body"></div></div></div></div>';
    $('#close-imp').onclick = () => { root.innerHTML = ''; };
    $('#imp-file').onchange = async (e) => {
      const file = e.target.files[0]; if (!file) return;
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf); const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      preview = { headers: rows.length ? Object.keys(rows[0]) : [], rows, allRows: rows, total: rows.length };
      autoMap(); drawImport();
    };
    const fields = [['wo_number','Work Order'],['sap_work_order','SAP Work Order'],['sap_notification','SAP Notification'],['permit_vision_id','Permit Vision #'],['functional_location','Functional Location'],['pid_number','P&ID / drawing #'],['equipment_location','Equipment location'],['title','Title'],['description','Description'],['unit','Unit'],['area','Area'],['equipment_tag','Tag'],['priority','Priority'],['job_date','Date'],['permit_number','Permit'],['loto_isolation','LOTO'],['trades','Trades']];
    function autoMap() {
      mapping = {};
      const guess = { wo_number:[/work\s*order/i,/^wo$/i], sap_work_order:[/sap\s*work/i], sap_notification:[/notif/i], permit_vision_id:[/permit\s*vision/i], functional_location:[/functional/i,/floc/i], pid_number:[/p\s*&?\s*id/i,/\bpid\b/i,/drawing/i], equipment_location:[/equip.*loc/i,/^location$/i,/elevation/i,/^grid$/i], title:[/^title$/i], description:[/desc/i,/title/i], unit:[/unit/i], area:[/area/i], equipment_tag:[/^tag$/i,/equip.*tag/i,/equipment(?!\s*loc)/i], priority:[/prior/i], job_date:[/date/i], permit_number:[/^permit$/i,/ptw/i], loto_isolation:[/loto/i], trades:[/trade/i] };
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
      return { 'Work Order': j.wo_number, 'SAP Work Order': j.sap_work_order, 'SAP Notification': j.sap_notification, 'Permit Vision': j.permit_vision_id, 'Functional Location': j.functional_location, 'P&ID': j.pid_number || '', 'Equipment location': j.equipment_location || '', Title: j.title, Unit: j.unit, PU: place.pu, Site: place.site, Area: j.area, Tag: j.equipment_tag, Priority: j.priority, Status: j.status, 'On Hold': j.on_hold ? 'Yes' : 'No', 'Hold Reason': j.hold_reason || '', 'Waiting On': waiting ? waiting.trade : '', Permit: j.permit_number, LOTO: j.loto_isolation, Date: j.job_date, Steps: j.steps.map((s) => s.label + ' [' + s.status + ']').join(' > ') };
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Jobs');
    XLSX.writeFile(wb, 'beamlock-export.xlsx');
  }

  function bind() {
    $('#main-tabs').onclick = (e) => { const t = e.target.closest('.tab'); if (t) setView(t.dataset.view); };
    $('#search').oninput = (e) => { state.filters.q = e.target.value; renderJobList(); };
    $('#filter-status').onchange = (e) => { state.filters.status = e.target.value; renderJobList(); };
    $('#filter-priority').onchange = (e) => { state.filters.priority = e.target.value; renderJobList(); };
    $('#filter-unit').onchange = (e) => {
      state.filters.unit = e.target.value;
      if (state.filters.unit) {
        const info = puForUnit(state.filters.unit);
        if (info.pu) state.filters.pu = info.pu;
      }
      renderJobList();
    };
    $('#filter-trade').onchange = (e) => { state.filters.trade = e.target.value; renderJobList(); };
    document.addEventListener('click', (e) => {
      const puChip = e.target.closest('[data-pu-tab]');
      if (puChip) {
        const which = puChip.dataset.puTab;
        const pu = puChip.dataset.pu || '';
        if (which === 'jobs') { state.filters.pu = pu; state.filters.unit = ''; const sel = $('#filter-unit'); if (sel) sel.value = ''; renderJobList(); }
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
        renderJobList();
      } else if (which === 'board') {
        state.boardUnit = unit;
        if (unit) { const info = puForUnit(unit); if (info.pu) state.boardPu = info.pu; }
        renderBoard();
      }
    });
    $('#btn-refresh').onclick = () => refreshAll(true);
    $('#btn-new-job').onclick = () => openJobEditor(null);
    $('#btn-import').onclick = openImport;
    $('#btn-export').onclick = exportExcel;
    $('#btn-audit-refresh').onclick = renderAudit;
    $('#btn-logout').onclick = () => { localStorage.removeItem('bl_user'); location.reload(); };
    $('#btn-hc').onclick = () => { document.documentElement.classList.toggle('hc'); localStorage.setItem('bl_hc', document.documentElement.classList.contains('hc') ? '1' : '0'); };
    if (localStorage.getItem('bl_hc') === '1') document.documentElement.classList.add('hc');
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
        const ds = { ...(state.settings?.data_source || {}), units, sites, adapter: state.settings?.data_source?.adapter || 'supabase', label: state.settings?.data_source?.label || 'Supabase (Beamlock)' };
        await sb.from('app_settings').upsert({
          id: 'default',
          url_templates: {
            ...(state.settings?.url_templates || {}),
            sap: $('#adm-sap').value.trim(),
            permitVision: $('#adm-pv').value.trim(),
            powerBi: $('#adm-pbi-tpl').value.trim(),
            digitalTwin: ($('#adm-twin')?.value || '').trim(),
            pid: ($('#adm-pid')?.value || '').trim(),
            utl: ($('#adm-utl')?.value || '').trim(),
          },
          power_bi_embed: { embedUrl, title: $('#adm-pbi-title').value.trim(), lastConfiguredAt: new Date().toISOString() },
          data_source: ds,
          updated_at: new Date().toISOString(),
        });
        for (const t of tiles) await sb.from('app_tiles').upsert(t);
        await loadMeta(); renderAdmin(); renderApps(); renderDashboards(); toast('Integration settings saved');
      } catch (e) { toast(e.message); }
    };
    document.addEventListener('click', (e) => { const card = e.target.closest('.job-card'); if (card && !e.target.closest('button')) openJob(card.dataset.id); });
  }

  bind();
  const existing = loadUser();
  initLogin().then(() => { if (existing?.name && existing?.role) { state.user = existing; enterApp(); } })
    .catch((e) => { console.error(e); toast('Failed to load: ' + e.message); });
})();
