import { createClient } from '@supabase/supabase-js';
import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sb = createClient(
  'https://ukvxubtuyeqszddlnjoc.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVrdnh1YnR1eWVxc3pkZGxuam9jIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM4MzAxODEsImV4cCI6MjEwOTQwNjE4MX0.cq0IMqmsUBGS5EK1rtfz9aA8fMtJMHh0HRI_dhQAQpc'
);
const TEMPLATES = {
  full_valve: [
    { trade: 'Insulator', label: 'Insulators — remove insulation' },
    { trade: 'Electrician', label: 'Electrical — remove EHT / heat trace' },
    { trade: 'Pipefitter', label: 'Pipefitters — cut / weld / install' },
    { trade: 'NDE', label: 'NDE — inspection / testing' },
    { trade: 'Pipefitter', label: 'Pipefitters — reinstate / close out' },
    { trade: 'Electrician', label: 'Electrical — reinstall EHT' },
    { trade: 'Insulator', label: 'Insulators — reinstall insulation' },
  ],
  fitters_nde: [
    { trade: 'Pipefitter', label: 'Pipefitters — work' },
    { trade: 'NDE', label: 'NDE — inspection / testing' },
  ],
  insulation_elec: [
    { trade: 'Insulator', label: 'Insulators — remove / work' },
    { trade: 'Electrician', label: 'Electrical — EHT work' },
    { trade: 'Electrician', label: 'Electrical — reinstall EHT' },
    { trade: 'Insulator', label: 'Insulators — reinstall' },
  ],
  elec_only: [{ trade: 'Electrician', label: 'Electrical — work' }],
  fitters_only: [{ trade: 'Pipefitter', label: 'Pipefitters — work' }],
};
async function wipe() {
  await sb.from('audit_log').delete().gte('created_at', '1970-01-01');
  await sb.from('comments').delete().gte('created_at', '1970-01-01');
  await sb.from('step_assignees').delete().gte('created_at', '1970-01-01');
  await sb.from('steps').delete().gte('created_at', '1970-01-01');
  await sb.from('jobs').delete().gte('created_at', '1970-01-01');
  await sb.from('people').delete().gte('created_at', '1970-01-01');
  await sb.from('app_tiles').delete().neq('id', '__none__');
}
async function main() {
  console.log('wiping…');
  await wipe();
  const peopleSpec = [
    { name: 'Alex Rivera', role: 'Planner', trade: null },
    { name: 'Jordan Lee', role: 'Supervisor', trade: null },
    { name: 'Sam Okonkwo', role: 'Operator', trade: null },
    { name: 'Casey Nguyen', role: 'Operator', trade: null },
    { name: 'Morgan Blake', role: 'Insulator', trade: 'Insulator' },
    { name: 'Riley Chen', role: 'Insulator', trade: 'Insulator' },
    { name: 'Taylor Brooks', role: 'Electrician', trade: 'Electrician' },
    { name: 'Jamie Patel', role: 'Electrician', trade: 'Electrician' },
    { name: 'Chris Alvarez', role: 'Pipefitter', trade: 'Pipefitter' },
    { name: 'Dana Singh', role: 'Pipefitter', trade: 'Pipefitter' },
    { name: 'Avery Kim', role: 'NDE', trade: 'NDE' },
    { name: 'Quinn Torres', role: 'NDE', trade: 'NDE' },
  ];
  const { data: people, error: pe } = await sb.from('people').insert(peopleSpec).select();
  if (pe) throw pe;
  const byTrade = (t) => people.filter((p) => p.trade === t);
  const jobsSpec = [
    { wo_number: 'WO-45210', title: 'Replace 6\" control valve CV-2104', unit: 'RHC', area: 'Reactor deck', equipment_tag: 'CV-2104', equipment_location: 'Reactor deck / EL 42 / Grid C-3', pid_number: 'PID-RHC-210-04', priority: 'High', description: 'Replace leaking control valve. Full insulation + EHT strip and reinstate.', job_date: '2026-11-05', permit_number: 'PTW-8891', loto_isolation: 'LOTO-RHC-447', sap_work_order: 'WO-45210', sap_notification: 'NOT-77821', permit_vision_id: 'PV-2026-4412', functional_location: 'RHC-210-CV', template: 'full_valve', progress: 3, comments: [ { channel: 'operators', author_name: 'Sam Okonkwo', author_role: 'Operator', body: 'Isolation verified. Blind list attached at board.' }, { channel: 'trades', author_name: 'Morgan Blake', author_role: 'Insulator', body: 'Insulation removed on east side. West still hot — waiting cool-down.' } ] },
    { wo_number: 'WO-45218', title: 'Weld repair spool SP-118', unit: 'A&V', area: 'Pipe rack B', equipment_tag: 'SP-118', equipment_location: 'Pipe rack B / EL 28 / Grid B-7', pid_number: 'PID-AV-PRB-118', priority: 'Critical', description: 'Crack repair on process spool. Fitters + NDE only.', job_date: '2026-11-05', permit_number: 'PTW-8902', loto_isolation: 'LOTO-AV-201', sap_work_order: 'WO-45218', sap_notification: 'NOT-77840', permit_vision_id: 'PV-2026-4420', functional_location: 'AV-PRB-SP118', template: 'fitters_nde', progress: 1, comments: [{ channel: 'trades', author_name: 'Chris Alvarez', author_role: 'Pipefitter', body: 'Fit-up complete. Ready for root pass NDE.' }] },
    { wo_number: 'WO-45190', title: 'Reinsulate steam header SH-40', unit: 'SRU', area: 'Claus train', equipment_tag: 'SH-40', priority: 'Normal', description: 'Damaged cladding after storm.', job_date: '2026-11-04', permit_number: 'PTW-8810', sap_work_order: 'WO-45190', sap_notification: 'NOT-77600', functional_location: 'SRU-CL-SH40', template: 'insulation_elec', progress: 0 },
    { wo_number: 'WO-45201', title: 'Install new drain valve DV-55', unit: 'COGEN', area: 'HRSG deck', equipment_tag: 'DV-55', priority: 'Normal', description: 'New low-point drain. Full sequence.', job_date: '2026-11-05', permit_number: 'PTW-8880', loto_isolation: 'LOTO-CGN-455', sap_work_order: 'WO-45201', sap_notification: 'NOT-77755', permit_vision_id: 'PV-2026-4390', functional_location: 'CGN-HRSG-DV55', template: 'full_valve', progress: 0, hold: 'Waiting on scaffold completion — scaffold ticket SCF-332' },
    { wo_number: 'WO-45175', title: 'EHT repair on line 8\"-P-220', unit: 'Waterblock', area: 'Cooling water', equipment_tag: '8\"-P-220', priority: 'High', description: 'Heat trace circuit open. Electrical only.', job_date: '2026-11-05', permit_number: 'PTW-8875', sap_work_order: 'WO-45175', template: 'elec_only', progress: 0 },
    { wo_number: 'WO-45160', title: 'Flange leak repair FL-901', unit: 'HMU', area: 'Reformer', equipment_tag: 'FL-901', priority: 'High', description: 'Repack / remachine flange face. Fitters + NDE.', job_date: '2026-11-04', permit_number: 'PTW-8799', loto_isolation: 'LOTO-HMU-88', sap_work_order: 'WO-45160', template: 'fitters_nde', progress: 2 },
    { wo_number: 'WO-45222', title: 'Replace PSV-3303', unit: 'RHC', area: 'Compressor bay', equipment_tag: 'PSV-3303', priority: 'Critical', description: 'PSV swap during planned window.', job_date: '2026-11-05', permit_number: 'PTW-8910', loto_isolation: 'LOTO-RHC-460', sap_work_order: 'WO-45222', sap_notification: 'NOT-77901', permit_vision_id: 'PV-2026-4455', functional_location: 'RHC-COMP-PSV3303', template: 'full_valve', progress: 1, comments: [{ channel: 'operators', author_name: 'Casey Nguyen', author_role: 'Operator', body: 'Permit issued. Spading complete. Cleared for trades.' }] },
    { wo_number: 'WO-45140', title: 'Cut and cap abandoned line', unit: 'A&V', area: 'Tank farm edge', equipment_tag: '6\"-P-ABAN-12', priority: 'Low', description: 'Abandon-in-place cut and cap. Fitters only.', job_date: '2026-11-06', loto_isolation: 'LOTO-AV-190', sap_work_order: 'WO-45140', template: 'fitters_only', progress: 0 },
    { wo_number: 'WO-45230', title: 'NDE thickness survey — exchanger E-210', unit: 'SRU', area: 'Exchanger row', equipment_tag: 'E-210', priority: 'Normal', description: 'UT thickness grid.', job_date: '2026-11-05', permit_number: 'PTW-8915', sap_work_order: 'WO-45230', template: 'insulation_elec', progress: 2 },
    { wo_number: 'WO-45235', title: 'Install new sample point SP-77', unit: 'COGEN', area: 'Demin skid', equipment_tag: 'SP-77', priority: 'Normal', description: 'Cold install during outage. Fitters + NDE.', job_date: '2026-11-05', permit_number: 'PTW-8920', loto_isolation: 'LOTO-CGN-92', sap_work_order: 'WO-45235', template: 'fitters_nde', progress: 0, comments: [{ channel: 'trades', author_name: 'Dana Singh', author_role: 'Pipefitter', body: 'Parts on site. Starting after morning toolbox.' }] },
    { wo_number: 'WO-45240', title: 'Replace block valve BV-88', unit: 'Waterblock', area: 'Filter gallery', equipment_tag: 'BV-88', priority: 'High', description: 'Full valve weld-in on cooling water block.', job_date: '2026-11-05', permit_number: 'PTW-8925', loto_isolation: 'LOTO-WB-101', sap_work_order: 'WO-45240', sap_notification: 'NOT-77940', functional_location: 'WB-FG-BV88', template: 'full_valve', progress: 0 },
    { wo_number: 'WO-45245', title: 'EHT circuit repair HT-12', unit: 'HMU', area: 'Feed prep', equipment_tag: 'HT-12', priority: 'Normal', description: 'Open circuit on heat trace. Electrical only.', job_date: '2026-11-05', permit_number: 'PTW-8930', sap_work_order: 'WO-45245', functional_location: 'HMU-FP-HT12', template: 'elec_only', progress: 0 },
  ];
  for (const spec of jobsSpec) {
    const { data: job, error } = await sb.from('jobs').insert({
      wo_number: spec.wo_number, title: spec.title, unit: spec.unit, area: spec.area,
      equipment_tag: spec.equipment_tag, priority: spec.priority, description: spec.description,
      job_date: spec.job_date, permit_number: spec.permit_number || '', loto_isolation: spec.loto_isolation || '',
      sap_work_order: spec.sap_work_order || spec.wo_number, sap_notification: spec.sap_notification || '',
      permit_vision_id: spec.permit_vision_id || '', functional_location: spec.functional_location || '',
      pid_number: spec.pid_number || '', equipment_location: spec.equipment_location || '',
      created_by: 'Alex Rivera', status: 'not_started',
    }).select().single();
    if (error) throw error;
    const tpl = TEMPLATES[spec.template];
    const stepRows = [];
    for (let i = 0; i < tpl.length; i++) {
      const { data: step, error: se } = await sb.from('steps').insert({
        job_id: job.id, trade: tpl[i].trade, label: tpl[i].label, sort_order: i, status: i === 0 ? 'ready' : 'pending',
      }).select().single();
      if (se) throw se;
      const assignees = byTrade(tpl[i].trade);
      const aRows = (assignees.length ? assignees : [{ name: tpl[i].trade + ' crew', id: null }]).map((p) => ({
        step_id: step.id, person_id: p.id || null, person_name: p.name, signed_off: false,
      }));
      const { data: inserted, error: ae } = await sb.from('step_assignees').insert(aRows).select();
      if (ae) throw ae;
      stepRows.push({ step, assignees: inserted });
    }
    for (let i = 0; i < (spec.progress || 0) && i < stepRows.length; i++) {
      for (const a of stepRows[i].assignees) {
        await sb.from('step_assignees').update({ signed_off: true, signed_at: new Date().toISOString() }).eq('id', a.id);
      }
      await sb.from('steps').update({ status: 'done' }).eq('id', stepRows[i].step.id);
      if (i + 1 < stepRows.length) await sb.from('steps').update({ status: 'ready' }).eq('id', stepRows[i + 1].step.id);
    }
    const allDone = (spec.progress || 0) >= stepRows.length;
    let status = allDone ? 'done' : (spec.progress ? 'in_progress' : 'not_started');
    if (spec.hold) {
      await sb.from('jobs').update({ status: 'on_hold', on_hold: true, hold_reason: spec.hold, hold_by: 'Alex Rivera', hold_at: new Date().toISOString() }).eq('id', job.id);
    } else {
      await sb.from('jobs').update({ status }).eq('id', job.id);
    }
    if (spec.comments) await sb.from('comments').insert(spec.comments.map((c) => ({ ...c, job_id: job.id })));
    await sb.from('audit_log').insert({ job_id: job.id, action: 'job_created', actor_name: 'Alex Rivera', actor_role: 'Planner', detail: 'Seeded ' + spec.wo_number });
  }
  const UNITS = ['RHC', 'A&V', 'SRU', 'COGEN', 'Waterblock', 'HMU'];
  await sb.from('app_settings').upsert({
    id: 'default',
    url_templates: { sap: '', permitVision: '', powerBi: '', digitalTwin: '', pid: '', utl: '' },
    power_bi_embed: { title: 'Maintenance dashboard', embedUrl: '', lastConfiguredAt: null },
    data_source: {
      adapter: 'supabase', label: 'Supabase (Beamlock)', lastUpdated: new Date().toISOString(), units: UNITS,
      sites: [{ name: 'Upgrader South', processUnits: [
        { name: 'PU1', units: ['HMU', 'RHC'] },
        { name: 'PU2', units: ['A&V', 'SRU', 'COGEN', 'Waterblock'] },
      ] }],
    },
    updated_at: new Date().toISOString(),
  });
  await sb.from('app_tiles').upsert([
    { id: 'sap', name: 'SAP', url: '', icon: 'SAP', description: 'Work orders & notifications (placeholder)', sort_order: 1 },
    { id: 'permitVision', name: 'Permit Vision', url: '', icon: 'PV', description: 'Permits & isolations (placeholder)', sort_order: 2 },
    { id: 'powerBi', name: 'Power BI', url: '', icon: 'PBI', description: 'Maintenance dashboards (placeholder)', sort_order: 3 },
    { id: 'teams', name: 'Microsoft Teams', url: '', icon: 'TM', description: 'Crew channels (placeholder)', sort_order: 4 },
    { id: 'sharepoint', name: 'SharePoint docs', url: '', icon: 'SP', description: 'Procedures & drawings (placeholder)', sort_order: 5 },
    { id: 'serviceDesk', name: 'Service desk', url: '', icon: 'SD', description: 'IT / support ticket (placeholder)', sort_order: 6 },
    { id: 'drawings', name: 'Drawings / DMS', url: '', icon: 'DW', description: 'P&IDs and documents (placeholder)', sort_order: 7 },
  ]);
  const rows = [
    { 'Work Order': 'WO-46001', Description: 'Replace ball valve BV-440', Unit: 'RHC', Area: 'Pump alley', Tag: 'BV-440', 'Equipment location': 'Pump alley / EL 12 / Grid A-2', 'P&ID': 'PID-RHC-PA-440', Priority: 'High', Date: '2026-11-06', Trades: 'Full valve weld-in', Permit: 'PTW-9001', LOTO: 'LOTO-RHC-501', 'SAP Work Order': 'WO-46001', 'SAP Notification': 'NOT-80001', 'Permit Vision': 'PV-2026-5001', 'Functional Location': 'RHC-PA-BV440' },
    { 'Work Order': 'WO-46002', Description: 'Weld repair on elbow EL-12', Unit: 'A and V', Area: 'Pipe rack A', Tag: 'EL-12', 'Equipment location': 'Pipe rack A / EL 30 / Grid D-1', 'P&ID': 'PID-AV-PRA-12', Priority: 'Critical', Date: '2026-11-06', Trades: 'Fitters + NDE', Permit: 'PTW-9002', LOTO: 'LOTO-AV-220', 'SAP Work Order': 'WO-46002', 'SAP Notification': 'NOT-80002', 'Permit Vision': 'PV-2026-5002', 'Functional Location': 'AV-PRA-EL12' },
    { 'Work Order': 'WO-46003', Description: 'Reinsulate exchanger shell', Unit: 'SRU', Area: 'Claus train', Tag: 'E-SR-3', Priority: 'Normal', Date: '2026-11-07', Trades: 'Insulation + Electrical', 'SAP Work Order': 'WO-46003', 'Functional Location': 'SRU-CL-ESR3' },
    { 'Work Order': 'WO-46004', Description: 'Heat trace repair circuit 14', Unit: 'Cogen', Area: 'HRSG', Tag: 'HT-14', Priority: 'High', Date: '2026-11-06', Trades: 'Electrical only', Permit: 'PTW-9004', 'SAP Work Order': 'WO-46004' },
    { 'Work Order': 'WO-46005', Description: 'Install new gauge GG-88', Unit: 'Waterblock', Area: 'Filter gallery', Tag: 'GG-88', Priority: 'Low', Date: '2026-11-08', Trades: 'Fitters only', LOTO: 'LOTO-WB-510', 'SAP Work Order': 'WO-46005' },
    { 'Work Order': 'WO-46006', Description: 'Flange remachine FL-44', Unit: 'HMU', Area: 'Reformer', Tag: 'FL-44', Priority: 'Normal', Date: '2026-11-08', Trades: 'Fitters + NDE', LOTO: 'LOTO-HMU-520', 'SAP Work Order': 'WO-46006' },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows), 'Backlog');
  const out = path.join(__dirname, '..', 'sample', 'sample-backlog.xlsx');
  XLSX.writeFile(wb, out);
  const { count } = await sb.from('jobs').select('*', { count: 'exact', head: true });
  console.log('seeded jobs=', count, 'people=', people.length);
}
main().catch((e) => { console.error(e); process.exit(1); });
