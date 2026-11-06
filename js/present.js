/* Presentation helpers. No network calls and no accounts. */
(function () {
  function daysFromNow(n, hour) {
    const d = new Date();
    d.setDate(d.getDate() + n);
    d.setHours(hour || 8, 0, 0, 0);
    return d.toISOString();
  }
  function step(id, trade, label, status, extra) {
    const base = {
      id: id, job_id: id.split('-').slice(0, 2).join('-'), trade: trade, label: label, status: status,
      sort_order: extra.sort || 1, permit_holder: extra.holder || '', radio_channel: extra.radio || '',
      skip_reason: null, skipped_by: null, assignees: extra.people || [{ id: id + '-a', person_name: extra.who || (trade + ' crew'), signed_off: status === 'done', signed_at: status === 'done' ? daysFromNow(-1, 9) : null }],
      beam: extra.beam || {}, comments: [],
    };
    return base;
  }
  function job(partial) {
    return Object.assign({
      demo: true, archived: false, on_hold: false, hold_reason: '', hold_by: '',
      area: 'Upgrader South', description: 'DEMO sample. Not a live order.',
      permit_number: '', loto_isolation: '', sap_notification: '', permit_vision_id: '', pid_number: '',
      comments: [], audit: [], created_by: 'Demo board',
    }, partial);
  }

  function buildDemoJobs() {
    const week = new Date().getFullYear() + '.' + String(isoWeek(new Date())).padStart(2, '0');
    return [
      job({
        id: 'demo-hm u'.replace(' ', ''), wo_number: 'DEMO-2401', title: 'HMU exchanger heat-trace repair',
        unit: 'HMU', priority: 'Critical', status: 'in_progress', equipment_tag: 'E-2401',
        functional_location: 'CA.SUG-HMU-E2401', equipment_location: 'CA.SUG-HMU-E2401',
        job_date: daysFromNow(-2, 16).slice(0, 10),
        beam: { dueDate: daysFromNow(-2, 16), planningWeek: week, orderType: '72FC', userStatus: 'EXEC', plantSection: 'PU1', location: 'HMU' },
        steps: [
          step('demo-hmu-1', 'Insulator', 'Remove insulation', 'done', { sort: 1, who: 'Demo Insulator', holder: 'A. Khan', radio: '3' }),
          step('demo-hmu-2', 'Electrician', 'Repair heat trace', 'ready', { sort: 2, who: 'Demo Electrician', holder: 'L. Berg', radio: '4', beam: { activityName: 'Repair heat trace', crew: 'EHT-1', remDuration: '6', earlyStart: 'Today 08:00', cranes: '' } }),
        ],
      }),
      job({
        id: 'demo-rhc', wo_number: 'DEMO-2402', title: 'RHC valve weld-in',
        unit: 'RHC', priority: 'High', status: 'in_progress', equipment_tag: 'V-118',
        functional_location: 'CA.SUG-RHC-V118', equipment_location: 'CA.SUG-RHC-V118',
        job_date: daysFromNow(0, 16).slice(0, 10),
        beam: { dueDate: daysFromNow(0, 16), planningWeek: week, orderType: '72FP', userStatus: 'EXEC WPOK', plantSection: 'PU1' },
        steps: [
          step('demo-rhc-1', 'Pipefitter', 'Cut and weld valve', 'ready', { sort: 1, who: 'Demo Pipefitter', holder: 'S. Okonkwo', radio: '2', beam: { activityName: 'Cut and weld valve', crew: 'FIT-2', remDuration: '8', earlyStart: 'Today 08:00' } }),
          step('demo-rhc-2', 'NDE', 'Inspect weld', 'pending', { sort: 2, who: 'Demo NDE' }),
        ],
      }),
      job({
        id: 'demo-av', wo_number: 'DEMO-2403', title: 'A&V scaffold for exchanger',
        unit: 'A&V', priority: 'Normal', status: 'in_progress', equipment_tag: 'E-88',
        functional_location: 'CA.SUG-AV-E88', equipment_location: 'CA.SUG-AV-E88',
        job_date: daysFromNow(3, 16).slice(0, 10),
        beam: { dueDate: daysFromNow(3, 16), planningWeek: week, orderType: 'MX04', userStatus: 'EXEC', plantSection: 'PU2' },
        steps: [
          step('demo-av-1', 'Scaffold', 'Set working scaffold', 'in_progress', { sort: 1, who: 'Demo Scaffold', holder: 'R. Singh', radio: '6', beam: { activityName: 'Set working scaffold', crew: 'SCF-1', cranes: 'AM', remDuration: '4' } }),
        ],
      }),
      job({
        id: 'demo-sru', wo_number: 'DEMO-2404', title: 'SRU line blinding',
        unit: 'SRU', priority: 'High', status: 'on_hold', on_hold: true, hold_reason: 'Waiting on isolation', hold_by: 'Demo Supervisor',
        equipment_tag: 'P-44', functional_location: 'CA.SUG-SRU-P44', equipment_location: 'CA.SUG-SRU-P44',
        job_date: daysFromNow(1, 16).slice(0, 10),
        beam: { dueDate: daysFromNow(1, 16), planningWeek: week, orderType: '72FC', userStatus: 'WAPP', plantSection: 'PU2' },
        steps: [
          step('demo-sru-1', 'Pipefitter', 'Install blind', 'ready', { sort: 1, who: 'Demo Pipefitter', beam: { earlyStart: daysFromNow(-3, 8) } }),
        ],
        comments: [{ id: 'demo-c1', author_name: 'Demo Supervisor', author_role: 'Supervisor', body: 'Hold until operations confirms the blind list.', created_at: daysFromNow(0, 7), channel: 'general', section: 'general' }],
      }),
      job({
        id: 'demo-cogen', wo_number: 'DEMO-2405', title: 'COGEN fan motor change',
        unit: 'COGEN', priority: 'Normal', status: 'in_progress', equipment_tag: 'M-12',
        functional_location: 'CA.SUG-COGEN-M12', equipment_location: 'CA.SUG-COGEN-M12',
        job_date: daysFromNow(6, 16).slice(0, 10),
        beam: { dueDate: daysFromNow(6, 16), planningWeek: week, orderType: '72FC', userStatus: 'EXEC', plantSection: 'PU2' },
        steps: [
          step('demo-cogen-1', 'Crane', 'Set crane for motor', 'ready', { sort: 1, who: 'Demo Crane', beam: { cranes: 'PM', activityName: 'Set crane for motor' } }),
          step('demo-cogen-2', 'Electrician', 'Land motor cables', 'pending', { sort: 2 }),
        ],
      }),
      job({
        id: 'demo-wb', wo_number: 'DEMO-2406', title: 'Waterblock HVAC filter bank',
        unit: 'Waterblock', priority: 'Low', status: 'not_started', equipment_tag: 'AHU-2',
        functional_location: 'CA.SUG-WB-AHU2', equipment_location: 'CA.SUG-WB-AHU2',
        job_date: daysFromNow(12, 16).slice(0, 10),
        beam: { dueDate: daysFromNow(12, 16), planningWeek: week, orderType: 'MX04', userStatus: 'EXEC SFIX', plantSection: 'PU2' },
        steps: [
          step('demo-wb-1', 'HVAC', 'Change filter bank', 'pending', { sort: 1, who: 'Demo HVAC' }),
        ],
      }),
    ];
  }

  function isoWeek(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const day = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - day);
    const start = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - start) / 86400000) + 1) / 7);
  }

  function advance(job) {
    let prevDone = true;
    for (const step of job.steps) {
      if (step.status === 'skipped') { prevDone = true; continue; }
      const people = step.assignees || [];
      const allSigned = people.length > 0 && people.every((a) => a.signed_off);
      if (allSigned) { step.status = 'done'; prevDone = true; continue; }
      if (!prevDone) step.status = 'pending';
      else if (people.some((a) => a.signed_off)) step.status = 'in_progress';
      else step.status = 'ready';
      prevDone = false;
    }
    if (job.on_hold) job.status = 'on_hold';
    else if (job.steps.length && job.steps.every((s) => s.status === 'done')) job.status = 'done';
    else if (job.steps.some((s) => s.status === 'done' || s.status === 'ready' || s.status === 'in_progress')) job.status = 'in_progress';
    else job.status = 'not_started';
  }

  window.BLPresent = { buildDemoJobs: buildDemoJobs, advance: advance, isoWeek: isoWeek };
})();
