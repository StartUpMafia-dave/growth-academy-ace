/* Growth Academy — Ace · management: home, team, tree, person companion, owner tools */
'use strict';

const FLAG_ORDER = { debrief: 0, review: 1, red: 2, new: 3, amber: 4, win: 5 };
const FLAG_PILL = { debrief: 's', review: 'v', red: 'r', amber: 'a', win: 'g', new: 's' };
function stageText(t) {
  if (t.rank !== 'rep') return '';
  if (t.trainingDays < 10 && !t.programDone) return 'Day ' + Math.min(10, t.trainingDays + (t.loggedToday ? 0 : 1)) + ' of 10';
  const wk = t.startDate ? Math.max(1, Math.floor((Date.parse(todayStr()) - Date.parse(t.startDate)) / 604800000) + 1) : null;
  return wk ? 'Week ' + wk : '';
}
const withStage = t => { const s = stageText(t); return esc(rankOf(t.rank).label) + (s ? ' · ' + esc(s) : ''); };
function personRow(t, opts) {
  opts = opts || {};
  const r = t.week.ratios;
  const chips = t.week.days ? ['stopsPerHour', 'presPct', 'closePct', 'retailAvg'].map(k => `<span class="pill ${light(k, r[k], t.monthOne)}">${RATIOS.find(z => z[0] === k)[1].replace('Stops → ', '').replace('Pres → ', '')} ${fmt(k, r[k])}</span>`).join('') : '<span class="pill n">No numbers this week</span>';
  const f = t.flags.slice().sort((a, b) => FLAG_ORDER[a.type] - FLAG_ORDER[b.type]);
  const top = f[0];
  const border = top ? { debrief: 'top-sky', review: 'top-violet', red: 'top-coral', amber: 'top-orange', win: 'top-green', new: 'top-sky' }[top.type] : '';
  return `<a class="card tap ${border}" href="#/person/${t.id}" style="text-decoration:none;color:inherit">
    <div class="row"><span class="avatar av-${t.rank}">${esc(initials(t.name))}</span><div class="col grow"><span class="h2" style="font-size:18px">${esc(t.name)}</span><span class="small muted">${withStage(t)}${t.focus ? ' · focus: ' + esc(t.focus) : ''}</span></div>${ICON.chev}</div>
    <div class="chips">${chips}</div>
    ${f.length ? `<div class="chips">${f.map(x => `<span class="pill ${FLAG_PILL[x.type]}">${esc(x.label)}</span>`).join('')}</div>` : ''}</a>`;
}
function teamOf(tree) { return tree.people.filter(p => p.id !== tree.me); }
function needsMe(team) { return team.filter(t => t.flags.some(f => ['debrief', 'review', 'red', 'amber', 'new'].includes(f.type))); }

/* ---------------- Manager home ---------------- */
async function mgmtHome() {
  const [p, tree] = await Promise.all([loadMine(), loadTree()]);
  const x = personCtx(p); const me = rankOf(S.me.rank);
  const week = isoWeek(x.today); const wr = x.rows.filter(r => isoWeek(r.date) === week);
  const r = ratios(sumKpis(wr)); const t = sumKpis(wr);
  const team = teamOf(tree); const need = needsMe(team);
  const counts = { g: 0, a: 0, r: 0, s: 0 };
  for (const m of team) { const ts = m.flags.map(f => f.type); if (ts.includes('debrief') || ts.includes('review')) counts.s++; else if (ts.includes('red')) counts.r++; else if (ts.includes('amber')) counts.a++; else counts.g++; }
  const pend = isOwner() ? await api('people').then(x => x.pending.length).catch(() => 0) : 0;
  const stage = S.C.stages.find(s => s.rank === S.me.rank);
  const nextReview = stage && [stage.review, stage.review2].filter(Boolean).find(id => !p.passed[id]);
  const ck = stage && stage.checklist ? S.C.checklists[stage.checklist] : null;
  const ckDone = ck ? Object.keys(p.checks || {}).filter(k => k.startsWith(stage.checklist + '-') && (p.checks[k].done || p.checks[k].self)).length : 0;
  let ace = wr.length ? aceRead(r, false) : 'Log your own field days too — your numbers set the pace for your team.';
  ace = (need.length ? `<strong>${need.length} ${need.length === 1 ? 'person needs' : 'people need'} you today.</strong> ` : team.length ? 'Nobody\'s waiting on you right now. ' : '') + ace;
  if (pend) ace = `<strong>${pend} new ${pend === 1 ? 'start is' : 'starts are'} waiting to be placed.</strong> ` + ace;
  page(header({ round: true, eyebrow: esc(me.label) + ' · ' + esc(me.book), title: greeting() + ', ' + esc(firstName(S.me.name)),
    right: `<span class="pill v" style="margin-right:4px">${team.length} in ${isOwner() ? 'office' : 'tree'}</span>`, extra: aceBubble(ace) }) + `
    <div class="body">
      ${pend ? `<a class="card navcard tap accent" href="#/people"><div class="ic" style="background:var(--orange-bg);color:var(--orange-d)">${pend}</div><div class="col grow"><span class="h2">Place new starts</span><span class="small muted">Give them a role and a team</span></div>${ICON.chev}</a>` : ''}
      <div class="card"><div class="row between"><span class="label">My field this week</span><a class="btn sm" href="#/checkin">Tap counter</a></div>
        <div class="tiles">${[['sales', t.sales, 'Sales', null], ['stopsPerHour', fmt('stopsPerHour', r.stopsPerHour), 'Stops p/h', 'stopsPerHour'], ['retailAvg', fmt('retailAvg', r.retailAvg), '$ Average', 'retailAvg'], ['rph', fmt('rph', r.rph), 'RPH', 'rph']].map(([k, v, l, lk]) => { const lv = lk ? light(lk, r[lk], false) : 'n'; return `<div class="tile light" style="${lv === 'g' ? 'background:var(--green-bg)' : lv === 'a' ? 'background:var(--orange-bg)' : lv === 'r' ? 'background:var(--coral-bg)' : ''}"><b>${v}</b><span>${l}</span></div>`; }).join('')}</div></div>
      <div class="card"><span class="label">My development</span>
        ${nextReview ? `<a class="navcard tap" href="#/quiz/${nextReview}"><div class="ic" style="background:var(--violet-bg);color:#5B2FC9">R</div><div class="col grow"><span style="font-weight:700">${esc(S.C.reviews[nextReview].title)}</span><span class="small muted">After the meeting — locks it into your journey</span></div>${ICON.chev}</a>` : ''}
        ${ck ? `<a class="col tap" href="#/checklist/${stage.checklist}" style="text-decoration:none;color:inherit;gap:5px"><div class="row between small"><span style="font-weight:600">${esc(ck.name)}</span><strong>${ckDone} of ${ck.count}</strong></div><div class="bar"><i style="width:${Math.round(ckDone / ck.count * 100)}%;background:var(--violet)"></i></div></a>` : ''}</div>
      <div class="card"><span class="label">My ${isOwner() ? 'office' : 'team'} today</span>
        ${team.length ? `<div class="row" style="height:14px;border-radius:7px;overflow:hidden;gap:0" role="img" aria-label="${counts.g} green, ${counts.a} amber, ${counts.r} red, ${counts.s} waiting on you">${counts.g ? `<div style="flex:${counts.g};height:100%;background:var(--green)"></div>` : ''}${counts.a ? `<div style="flex:${counts.a};height:100%;background:var(--orange)"></div>` : ''}${counts.r ? `<div style="flex:${counts.r};height:100%;background:var(--coral)"></div>` : ''}${counts.s ? `<div style="flex:${counts.s};height:100%;background:var(--sky)"></div>` : ''}</div>
          <div class="chips small"><span><strong>${counts.g}</strong> on track</span><span><strong>${counts.a}</strong> amber</span><span><strong>${counts.r}</strong> red</span><span><strong>${counts.s}</strong> waiting on you</span></div>` : `<span class="small muted">${isOwner() ? 'Place your first people from the People screen.' : 'Nobody on your team yet — your owner places people under you.'}</span>`}
        <div class="row"><a class="btn sm orange grow" href="#/team">Who needs me</a><a class="btn sm grow" href="#/tree">${isOwner() ? 'Org view' : 'Family tree'}</a></div></div>
    </div>` + nav('#/today'));
}

/* ---------------- Who needs me ---------------- */
ROUTES.team = async () => {
  if (!isMgmt()) return go('#/today');
  const tree = await loadTree(true); const team = teamOf(tree);
  const score = t => Math.min(...t.flags.map(f => FLAG_ORDER[f.type]), 9);
  const need = team.filter(t => score(t) <= 4).sort((a, b) => score(a) - score(b));
  const rest = team.filter(t => score(t) > 4).sort((a, b) => a.name.localeCompare(b.name));
  page(header({ title: 'Who needs you today', eyebrow: isOwner() ? 'Your office' : 'Your people',
    right: isOwner() ? `<a class="iconbtn" href="#/people" aria-label="People and roles" style="margin-right:4px">+</a>` : '' }) + `<div class="body">
    ${team.length ? '' : `<div class="empty">Nobody in your tree yet.${isOwner() ? '<br><a class="btn sm" href="#/office" style="margin-top:12px">Get your invite link</a>' : ''}</div>`}
    ${need.length ? `<span class="label">Needs you</span>${need.map(t => personRow(t)).join('')}` : team.length ? `<div class="card top-green"><span class="h2">Nobody's waiting on you.</span><span class="small muted">Debriefs, reviews and slipping numbers show up here first.</span></div>` : ''}
    ${rest.length ? `<span class="label" style="margin-top:6px">Everyone else</span>${rest.map(t => personRow(t)).join('')}` : ''}
    ${team.length ? `<a class="btn ghost block" href="#/tree">${isOwner() ? 'Org view' : 'My family tree'}</a>` : ''}
  </div>` + nav('#/team'));
};

/* ---------------- Family tree / org view ---------------- */
function nodeHtml(t, meId) {
  const f = t.flags.slice().sort((a, b) => FLAG_ORDER[a.type] - FLAG_ORDER[b.type])[0];
  const st = f ? `<span class="pill ${FLAG_PILL[f.type]}">${esc(f.type === 'win' ? 'Win' : f.type === 'debrief' ? 'Debrief' : f.type === 'review' ? 'Review' : f.type === 'new' ? 'New' : f.type === 'red' ? 'Red' : 'Amber')}</span>` : (t.week.days ? '<span class="pill g">Green</span>' : '');
  return `<a class="tnode ${t.id === meId ? 'me' : ''}" href="${t.id === meId ? '#/today' : '#/person/' + t.id}"><span class="avatar av-${t.rank}">${esc(initials(t.name))}</span><span class="col grow" style="gap:0;min-width:0"><span style="font-weight:700;font-size:14.5px">${esc(t.name)}${t.id === meId ? ' · You' : ''}</span><span class="tiny muted">${withStage(t)}${t.teamSize ? ' · ' + t.teamSize + ' under' : ''}</span></span>${st}</a>`;
}
function listTree(byParent, id, all, meId) {
  const kids = (byParent[id] || []).sort((a, b) => rankIdx(b.rank) - rankIdx(a.rank) || a.name.localeCompare(b.name));
  if (!kids.length) return '';
  return `<div class="branch"><div class="line"></div><div class="kids">${kids.map(k => `<div><div class="kidrow"><div class="stub"></div>${nodeHtml(k, meId)}</div>${listTree(byParent, k.id, all, meId)}</div>`).join('')}</div></div>`;
}
function orgTree(byParent, node, meId) {
  const kids = (byParent[node.id] || []).sort((a, b) => rankIdx(b.rank) - rankIdx(a.rank) || a.name.localeCompare(b.name));
  return `<li>${nodeHtml(node, meId)}${kids.length ? `<ul>${kids.map(k => orgTree(byParent, k, meId)).join('')}</ul>` : ''}</li>`;
}
ROUTES.tree = async (mode) => {
  if (!isMgmt()) return go('#/today');
  const tree = await loadTree(true);
  const byParent = {}; for (const t of tree.people) (byParent[t.parentId] = byParent[t.parentId] || []).push(t);
  const me = tree.people.find(t => t.id === tree.me);
  const ids = new Set(tree.people.map(t => t.id));
  const roots = isOwner() ? tree.people.filter(t => t.id === tree.me || !ids.has(t.parentId)).filter(t => t.id !== tree.me) : [];
  const wide = isOwner() && mode !== 'list' && window.innerWidth >= 760;
  const count = tree.people.length - 1;
  let body;
  if (wide) body = `<div class="card orgwrap"><ul class="org">${orgTree(byParent, me, tree.me)}</ul>${roots.length ? `<span class="label" style="margin-top:14px">Not on a team yet</span><div class="chips">${roots.map(r => nodeHtml(r, tree.me)).join('')}</div>` : ''}</div>`;
  else body = `<div class="tree">${nodeHtml(me, tree.me)}${listTree(byParent, me.id, tree.people, tree.me)}</div>${roots.length ? `<span class="label">Not on a team yet</span>${roots.map(r => nodeHtml(r, tree.me)).join('')}` : ''}`;
  page(header({ title: isOwner() ? 'Org view · ' + count + ' people' : 'Your team · ' + count + (count === 1 ? ' person' : ' people'), eyebrow: isOwner() ? 'Owner only' : 'Family tree', back: '#/team',
    extra: isOwner() && window.innerWidth >= 760 ? `<div class="tabs"><a href="#/tree" class="${wide ? 'on' : ''}">Chart</a><a href="#/tree/list" class="${!wide ? 'on' : ''}">List</a></div>` : `<span class="small" style="color:var(--soft)">${isOwner() ? 'Everyone in the office.' : 'Everyone under you and their numbers. Tap anyone to open their journey.'}</span>` }) +
    `<div class="body">${count ? body : '<div class="empty">Nobody here yet.</div>'}
    <div class="chips small" style="gap:12px">${S.C.ranks.map(r => `<span class="row" style="gap:5px"><span class="avatar av-${r.id}" style="width:13px;height:13px"></span>${esc(r.label)}</span>`).join('')}</div></div>` + nav('#/team'), { wide });
};

/* ---------------- Person companion ---------------- */
const PTABS = [['days', 'Day by day'], ['numbers', 'Numbers'], ['reviews', 'Reviews'], ['book', 'Book'], ['skills', 'Skills'], ['plan', 'Money plan']];
ROUTES.person = async (id, tab) => {
  id = +id; const p = await loadPerson(id, true); const x = personCtx(p);
  if (!tab) tab = x.inProgram ? 'days' : 'numbers';
  const tabs = PTABS.filter(([k]) => k !== 'days' || x.inProgram || x.train.length);
  const foc = x.focus;
  let body = '';
  if (tab === 'days') body = personDays(p, x);
  else if (tab === 'numbers') body = personNumbers(p, x);
  else if (tab === 'reviews') body = personReviews(p, x);
  else if (tab === 'book') body = personBook(p);
  else if (tab === 'skills') body = personSkills(p);
  else body = personPlan(p);
  page(header({ title: esc(p.user.name), eyebrow: esc(rankOf(p.user.rank).label) + (p.parentName ? ' · on ' + esc(firstName(p.parentName)) + "'s team" : ''), back: '#/team',
    extra: (foc ? `<div class="ace"><div class="av sm" aria-hidden="true">A</div><div class="bub"><b class="who">Current focus · set by ${esc(foc.set_by_name || '')}</b>${esc(foc.skill)}${foc.note ? ' — ' + esc(foc.note) : ''}</div></div>` : '') +
      `<div class="tabs">${tabs.map(([k, l]) => `<a href="#/person/${id}/${k}" class="${k === tab ? 'on' : ''}">${l}</a>`).join('')}</div>` }) + `<div class="body">${body}</div>` + nav('#/team'));
  bindPerson(id, p);
};
async function personAct(id, path, body) {
  try { S.cache[id] = await api('person/' + id + '/' + path, body); S.tree = null; route(); } catch (e) { fail(e); }
}
function bindPerson(id, p) {
  document.querySelectorAll('[data-tick]').forEach(b => b.onclick = e => { e.preventDefault(); personAct(id, 'tick', { key: b.dataset.tick, done: b.dataset.done === '1' }); });
  document.querySelectorAll('[data-check]').forEach(b => b.onclick = () => personAct(id, 'check', { item: b.dataset.check, done: b.dataset.done === '1' }));
  document.querySelectorAll('[data-rate]').forEach(b => b.onclick = () => personAct(id, 'skill', { key: b.dataset.rate, rating: +b.dataset.v }));
  document.querySelectorAll('[data-pick]').forEach(b => b.onclick = () => {
    const grp = b.closest('[data-pickgroup]'); grp.querySelectorAll('[data-pick]').forEach(c => { c.classList.toggle('on', c === b && !b.classList.contains('on')); c.setAttribute('aria-pressed', c.classList.contains('on')); });
  });
  document.querySelectorAll('[data-setfocus]').forEach(b => b.onclick = () => {
    const grp = document.querySelector(`[data-pickgroup="${b.dataset.setfocus}"]`); const on = grp.querySelector('[data-pick].on');
    if (!on) return toast('Pick a skill first');
    const note = (document.querySelector(`[data-fnote="${b.dataset.setfocus}"]`) || {}).value || '';
    personAct(id, 'focus', { skill: on.dataset.pick, note });
  });
  document.querySelectorAll('[data-hand]').forEach(b => b.onclick = () => {
    const t = document.querySelector(`[data-handtext="${b.dataset.hand}"]`); if (!t.value.trim()) return toast('Add a comment first');
    personAct(id, 'handover', { ref: b.dataset.hand, comment: t.value.trim() });
  });
  document.querySelectorAll('[data-sign]').forEach(b => b.onclick = () => personAct(id, 'review', { which: b.dataset.sign, comments: (document.querySelector(`[data-signnote="${b.dataset.sign}"]`) || {}).value || '' }));
  document.querySelectorAll('[data-unsign]').forEach(b => b.onclick = () => personAct(id, 'review', { which: b.dataset.unsign, unsign: true }));
}
function focusPicker(ref, prefer) {
  const rows = S.C.cheatSheet.rows.slice();
  if (prefer) rows.sort((a, b) => (b.metric === prefer) - (a.metric === prefer));
  return `<div class="col" data-pickgroup="${ref}" style="gap:6px">${rows.map(r => `<span class="tiny muted" style="font-weight:700;text-transform:uppercase;letter-spacing:.05em;margin-top:4px">${esc(r.label)}${r.metric === prefer ? ' · limiting factor' : ''}</span><div class="chips">${r.skills.map(s => `<button type="button" class="chip" data-pick="${esc(s)}" aria-pressed="false">${esc(s)}</button>`).join('')}</div>`).join('')}
    <textarea class="input" data-fnote="${ref}" placeholder="Optional note — what to do with this focus tomorrow" style="min-height:48px"></textarea>
    <button class="btn sm orange" data-setfocus="${ref}">Set as tomorrow's focus</button></div>`;
}
function handoverBlock(p, ref, ph) {
  const trail = (p.handover || []).filter(h => h.ref === ref).map(h => `<div class="hand">${esc(h.comment)}<i>${esc(h.by_name || '')} · ${fmtWhen(h.at)}</i></div>`).join('');
  return `${trail}<textarea class="input" data-handtext="${ref}" placeholder="${esc(ph)}" style="min-height:52px"></textarea><button class="btn sm ghost" data-hand="${ref}">Save handover note</button>`;
}
function tickBtn(p, key, label) { const on = !!p.companion[key]; return `<button class="tick ${on ? 'on' : ''}" data-tick="${key}" data-done="${on ? 0 : 1}" aria-label="${on ? 'Undo' : 'Mark done'}: ${esc(label)}">${on ? ICON.tick : ''}</button>`; }
function kpiChips(rec, monthOne) {
  if (!rec || !rec.kpis) return '<span class="small muted">No numbers yet — they appear here as soon as the day is logged.</span>';
  const r = ratios(sumKpis([rec]));
  return `<div class="chips">${KPI_IN.map(([k, l]) => `<span class="pill n">${l} ${rec.kpis[k] == null ? '—' : (k === 'retail' ? '$' + money(rec.kpis[k]) : rec.kpis[k])}</span>`).join('')}</div>
    <div class="chips">${RATIOS.map(([k, l]) => `<span class="pill ${light(k, r[k], monthOne)}">${l} ${fmt(k, r[k])}</span>`).join('')}</div>`;
}
function personDays(p, x) {
  const coach = p.canCoach; const nextDay = Math.min(10, x.train.length + (x.train.length < 10 ? 1 : 0));
  let h = '';
  for (let n = 1; n <= 10; n++) {
    const day = S.C.days[n - 1]; const rec = x.trainRow(n);
    const ticks = (p.companion['v3:d' + n + ':setup'] ? 1 : 0) + (p.companion['v3:d' + n + ':eod'] ? 1 : 0);
    const open = n === (rec && rec.sent_at && !p.companion['v3:d' + n + ':eod'] ? n : -1) || (!x.train.some(t => t.sent_at && !p.companion['v3:d' + t.dayNo + ':eod']) && n === nextDay);
    const lf = rec ? limiting(ratios(sumKpis([rec])), monthOneOn(p, rec.date)) : null;
    const md = rec && rec.missions ? rec.missions.filter(Boolean).length : 0;
    h += `<details class="day" ${open ? 'open' : ''}><summary><span class="dn" style="background:${rec ? 'var(--lime)' : 'var(--bg)'}">D${n}</span><span class="col grow" style="gap:1px"><span style="font-weight:700">${esc(day.title)}</span><span class="tiny muted">${rec ? shortDate(rec.date) + (rec.sent_at ? ' · sent' : rec.date < todayStr() ? ' · logged' : ' · in progress') : 'Not started'} · ${ticks}/2 meetings</span></span>${ICON.chev}</summary><div class="inner">
      <div class="beat"><div class="row"><span class="label grow">1 · Daily setup meeting</span>${coach ? tickBtn(p, 'v3:d' + n + ':setup', 'setup meeting') : ''}</div><span class="small muted">Run Primetime on <strong>${esc(day.title)}</strong>. ${esc(day.strap)}</span></div>
      <div class="beat"><div class="row"><span class="label grow">2 · In the field</span><span class="small muted">${day.missions.length ? md + '/' + day.missions.length + ' ticked' : ''}</span></div>
        ${day.missions.map((m, i) => `<div class="row small" style="align-items:flex-start"><span class="dot ${rec && rec.missions && rec.missions[i] ? 'g' : 'n'}" style="margin-top:3px"></span><span>${esc(m)}</span></div>`).join('') || '<span class="small muted">Review and goal-setting day.</span>'}</div>
      <div class="beat"><div class="row"><span class="label grow">3 · End-of-day breakdown</span>${coach ? tickBtn(p, 'v3:d' + n + ':eod', 'end-of-day breakdown') : ''}</div>
        ${kpiChips(rec, rec ? monthOneOn(p, rec.date) : p.monthOne)}
        ${rec && lf ? `<span class="small">${aceRead(ratios(sumKpis([rec])), monthOneOn(p, rec.date), firstName(p.user.name))}</span>` : ''}
        ${rec && ((rec.objTags || []).length || rec.objections) ? `<div class="ans"><i>Objections that stopped a sale</i>${(rec.objTags || []).map(esc).join(' · ')}${rec.objections ? (rec.objTags || []).length ? ' — ' + esc(rec.objections) : esc(rec.objections) : ''}</div>` : ''}
        ${rec && (rec.answers || []).some(a => a) ? `<div class="ans">${day.reflections.map((q, i) => rec.answers[i] ? `<i>${esc(q)}</i>${esc(rec.answers[i])}<br>` : '').join('')}</div>` : ''}
        ${coach ? `<span class="label" style="margin-top:4px">Tomorrow's focus — pick one skill</span>${focusPicker('d' + n, lf)}
        <span class="label" style="margin-top:4px">Handover</span>${handoverBlock(p, 'd' + n, "What we're working on tomorrow — anything the next trainer needs to know")}` : ''}
      </div></div></details>`;
    if (n === 5 || n === 10) h += reviewCardPerson(p, x, n === 5 ? 'day5' : 'day10');
  }
  return h;
}
function reviewCardPerson(p, x, which) {
  const R = reviewData(p, which); const rec = x.rev(which); const signed = rec && rec.signed_by;
  const label = r => r.kind === 'training' ? 'Day ' + r.dayNo : shortDate(r.date);
  const has = R.rows.length;
  return `<div class="card ${signed ? 'top-green' : 'top-violet'}"><div class="row between"><span class="h2">${esc(R.title)}</span>${signed ? '<span class="pill g">Signed off</span>' : ''}</div>
    ${has ? reviewTable(R.rows, R.prod, monthOneOn(p, R.rows[0].date), label) : '<span class="small muted">Builds itself as the days are logged.</span>'}
    ${which === 'month1' && has ? (() => { const b = pbs(R.rows); return `<div class="chips"><span class="pill s">Daily PB ${b.day}</span><span class="pill s">Weekly PB ${b.week}</span><span class="pill s">RPH PB ${b.rph ? '$' + b.rph.toFixed(2) : '—'}</span></div>`; })() : ''}
    ${rec && (rec.answers || []).some(a => a) ? `<div class="ans">${R.qs.map((q, i) => rec.answers[i] ? `<i>${esc(q)}</i>${esc(rec.answers[i])}<br>` : '').join('')}</div>` : `<span class="small muted">${which === 'month1' ? 'Their monthly review answers' : 'Their reflections'} show here once saved.</span>`}
    ${p.canCoach ? (signed ? `<span class="small">${rec.comments ? '"' + esc(rec.comments) + '" — ' : ''}${esc(rec.signed_by_name || '')}</span><button class="btn sm ghost" data-unsign="${which}">Unlock for corrections</button>`
      : `<textarea class="input" data-signnote="${which}" placeholder="Your comments for the review" style="min-height:48px"></textarea><button class="btn sm" data-sign="${which}" ${has ? '' : 'disabled'}>Sign off ${esc(R.title.split(' —')[0])}</button>${which !== 'month1' ? `<span class="tiny muted">Signing locks ${which === 'day5' ? 'Days 1–5' : 'Days 6–10'} in their log.</span>` : ''}`) : ''}</div>`;
}
function personNumbers(p, x) {
  const weeks = weeksOf(x.rows).slice(-8);
  if (!weeks.length) return '<div class="empty">No numbers logged yet.</div>';
  const rr = weeks.map(w => ratios(sumKpis(w.rows)));
  const mos = weeks.map(w => monthOneOn(p, w.rows[0].date));
  const cur = rr[rr.length - 1]; const curWeek = weeks[weeks.length - 1].week;
  const curMo = mos[mos.length - 1];
  const lf = limiting(cur, curMo);
  let h = `<div class="card"><span class="label">Weekly board — green, amber, red</span><div class="tblwrap"><table class="t"><tr><th>Metric</th>${weeks.map(w => `<th>${shortDate(w.mon).split(' ').slice(1).join(' ')}</th>`).join('')}</tr>
    <tr><td>Sales</td>${weeks.map(w => `<td>${sumKpis(w.rows).sales}</td>`).join('')}</tr>
    ${RATIOS.map(([k, l]) => `<tr><td>${l}</td>${rr.map((r, i) => `<td><span class="dot ${light(k, r[k], mos[i])}" title="${LIGHTWORD[light(k, r[k], mos[i])]}"></span> ${fmt(k, r[k])}</td>`).join('')}</tr>`).join('')}</table></div></div>`;
  h += `<div class="card">${funnelHtml(cur, curMo)}</div>`;
  h += focusCard(cur, curMo, true);
  if (p.canCoach) h += `<div class="card"><span class="label">This week's focus</span>${focusPicker('w' + curWeek, lf)}<span class="label" style="margin-top:6px">Weekly catch-up notes</span>${handoverBlock(p, curWeek, 'What this week showed and where next week goes')}</div>`;
  const obj = {}; for (const r of x.rows) for (const t of (r.objTags || [])) obj[t] = (obj[t] || 0) + 1;
  const ol = Object.entries(obj).sort((a, b) => b[1] - a[1]);
  if (ol.length) h += `<div class="card"><span class="label">Objections that keep stopping sales</span>${ol.map(([t, n]) => `<div class="row between small" style="padding:4px 0"><span>${esc(t)}</span><strong>${n}×</strong></div>`).join('')}</div>`;
  return h;
}
function personReviews(p, x) {
  let h = reviewCardPerson(p, x, 'day5') + reviewCardPerson(p, x, 'day10') + reviewCardPerson(p, x, 'month1');
  const passed = Object.entries(p.passed || {});
  h += `<div class="card"><span class="label">Meeting reviews passed</span>${passed.length ? passed.map(([k, v]) => `<div class="row between small"><span>${esc((S.C.reviews[k] || {}).title || k)}</span><strong>${v.score}/${v.total}</strong></div>`).join('') : '<span class="small muted">None yet.</span>'}</div>`;
  return h;
}
function personBook(p) {
  const keys = S.C.ranks.slice(0, rankIdx(p.user.rank) + 1).map(r => r.bookKey).filter(Boolean).reverse();
  return keys.map((k, i) => i === 0 ? checklistHtml(k, p, p.canCoach) : `<details class="day"><summary><span class="dn" style="background:var(--bg)">${esc(S.C.ranks.find(r => r.bookKey === k).book.replace('The ', '').slice(0, 3))}</span><span class="grow" style="font-weight:700">${esc(S.C.checklists[k].name)}</span>${ICON.chev}</summary><div class="inner">${checklistHtml(k, p, p.canCoach)}</div></details>`).join('');
}
function personSkills(p) {
  const rated = S.C.skills.reduce((n, c) => n + c.items.filter(i => (p.skills[i.k] || {}).rating).length, 0);
  const total = S.C.skills.reduce((n, c) => n + c.items.length, 0);
  return `<div class="card dark"><span class="eyebrow">10-Day Development Checklist</span><span class="h2">${rated} of ${total} skills rated</span><span class="small" style="color:#D9DFEA">Rate ability 1–5 as they grow. Every change is kept, so you see the journey, not just today's score.</span></div>` +
    S.C.skills.map(c => `<div class="card"><span class="label">${esc(c.h)}</span>${c.items.map(i => {
      const s = p.skills[i.k] || {}; const h = s.hist || [];
      const journey = h.length > 1 ? `${h[0][0]} on ${fmtWhen(h[0][1])} → ${h[h.length - 1][0]} on ${fmtWhen(h[h.length - 1][1])}${h[h.length - 1][0] === 5 ? ' — mastered' : ''}` : h.length ? 'Rated ' + h[0][0] + ' on ' + fmtWhen(h[0][1]) : 'Not yet rated';
      return `<div class="row" style="padding:6px 0;border-bottom:1px solid #EEF0F4"><div class="col grow"><span style="font-weight:600;font-size:14px">${esc(i.t)}</span><span class="tiny muted">${journey}</span></div>
        <div class="row" style="gap:4px" role="group" aria-label="Rate ${esc(i.t)}">${[1, 2, 3, 4, 5].map(v => p.canCoach ? `<button class="tick ${s.rating >= v ? 'on' : ''}" style="min-width:28px;height:28px;border-radius:50%" data-rate="${i.k}" data-v="${v}" aria-label="${v} of 5">${s.rating === v ? '<span style="color:#fff;font-weight:800;font-size:12px">' + v + '</span>' : ''}</button>` : `<span class="dot ${s.rating >= v ? 'g' : 'n'}"></span>`).join('')}</div></div>`;
    }).join('')}</div>`).join('');
}
function personPlan(p) {
  if (!p.pay || !p.pay.rate) return `<div class="empty">${esc(firstName(p.user.name))} hasn't set up their money planner yet. Sit down with them and do it together on their phone under Goals.</div>`;
  const plan = p.plan || { expenses: [], goal: 0, weeks: 12 };
  const M = planMaths(p.pay, plan);
  return `<div class="card"><span class="label">${plan.goalName ? esc(plan.goalName) : 'Savings goal'} · $${money(plan.goal)} in ${plan.weeks} weeks</span>
    <div class="tiles t3"><div class="tile light"><b>$${money(M.need)}</b><span>Needed a week</span></div><div class="tile light"><b>$${money(M.net)}</b><span>Wage after tax</span></div><div class="tile light" style="background:${M.gap <= 0 ? 'var(--green-bg)' : 'var(--orange-bg)'}"><b>${M.gap <= 0 ? 'Covered' : '$' + money(M.gap)}</b><span>${M.gap <= 0 ? 'Bonuses are extra' : 'Gap after tax'}</span></div></div>
    <span class="small">$${p.pay.rate}/hr × ${p.pay.hours} hrs · expenses $${money(M.exp)} a week${M.gap > 0 ? ` · needs about <strong>$${money(M.bonus)} in bonuses before tax</strong> each week` : ''}.</span>
    <span class="tiny muted">Rough estimate, before offsets and super. Work it through with them live.</span></div>`;
}

/* ---------------- Owner: people & roles ---------------- */
function roleOptions(sel) { return S.C.ranks.map(r => `<option value="${r.id}" ${r.id === sel ? 'selected' : ''}>${esc(r.label)}</option>`).join(''); }
function parentOptions(people, sel, excludeId) {
  return '<option value="">Choose whose team…</option>' + people.filter(u => u.id !== excludeId && rankIdx(u.rank) >= rankIdx('leader'))
    .sort((a, b) => rankIdx(b.rank) - rankIdx(a.rank) || a.name.localeCompare(b.name))
    .map(u => `<option value="${u.id}" ${u.id === sel ? 'selected' : ''}>${esc(u.name)} — ${esc(rankOf(u.rank).label)}</option>`).join('');
}
ROUTES.people = async () => {
  if (!isOwner()) return go('#/today');
  const d = await api('people');
  const act = d.active;
  const toConfirm = act.filter(u => u.needsRank);
  page(header({ title: d.pending.length ? d.pending.length + ' new ' + (d.pending.length === 1 ? 'start' : 'starts') + ' to place' : 'People & roles', eyebrow: 'Owner · People', back: '#/today',
    extra: `<div class="tiles t3"><div class="tile"><b>${act.length}</b><span>In the office</span></div><div class="tile"><b style="color:var(--lime)">${act.filter(u => u.rank === 'rep').length}</b><span>Sales Reps</span></div><a class="tile" href="#/tree" style="background:var(--orange);text-decoration:none"><b style="color:var(--navy);font-size:17px">Org view</b><span style="color:var(--navy)">Who's on whose team</span></a></div>` }) + `
    <div class="body">
      ${d.pending.map(u => `<div class="card top-orange" data-person="${u.id}"><div class="row"><span class="avatar" style="background:var(--sky-bg);color:var(--sky-d)">${esc(initials(u.name))}</span><div class="col grow"><span class="h2">${esc(u.name)}</span><span class="small muted">${esc(u.email)} · waiting for a role</span></div></div>
        <label class="field">Role<select class="input" data-role>${roleOptions('rep')}</select></label>
        <label class="field">On whose team<select class="input" data-parent>${parentOptions(act, S.me.id)}</select></label>
        <button class="btn orange" data-place="${u.id}">Place ${esc(firstName(u.name))} · starts Day 1</button></div>`).join('')}
      ${toConfirm.length ? `<div class="card top-violet"><span class="h2">Confirm ${toConfirm.length} leader${toConfirm.length === 1 ? '' : 's'}' rank</span><span class="small muted">The old app only knew "leader". Pick each person's actual rank below — look for the purple tag.</span></div>` : ''}
      <span class="label">Everyone</span>
      ${act.sort((a, b) => rankIdx(b.rank) - rankIdx(a.rank) || a.name.localeCompare(b.name)).map(u => `<details class="day" data-person="${u.id}"><summary><span class="avatar av-${u.rank}">${esc(initials(u.name))}</span><span class="col grow" style="gap:0"><span style="font-weight:700">${esc(u.name)}${u.id === S.me.id ? ' · You' : ''}</span><span class="tiny muted">${esc(rankOf(u.rank).label)}${u.parentName ? ' · ' + esc(u.parentName) + "'s team" : ''}</span></span>${u.needsRank ? '<span class="pill v">Confirm rank</span>' : ''}${ICON.chev}</summary>
        <div class="inner">${u.id === S.me.id ? '<span class="small muted">That\'s you — the Owner.</span>' : `
          <label class="field">Role<select class="input" data-role>${roleOptions(u.rank)}</select></label>
          <label class="field">On whose team<select class="input" data-parent>${parentOptions(act, u.parentId, u.id)}</select></label>
          <button class="btn sm" data-update="${u.id}">Save changes</button>
          ${u.rank === 'rep' ? `<label class="check" style="border:none"><input type="checkbox" data-program="${u.id}" ${u.programDone ? '' : 'checked'}>In the 10-Day Program — untick for reps already past their 10 days</label>` : ''}
          <div class="row"><button class="btn sm ghost grow" data-reset="${u.id}">Reset password</button><button class="btn sm danger grow" data-remove="${u.id}" data-name="${esc(u.name)}">Remove</button></div>
          <span class="tiny muted">${esc(u.email)}</span>`}</div></details>`).join('')}
      ${d.removed.length ? `<details class="day"><summary><span class="grow label">Removed (${d.removed.length})</span>${ICON.chev}</summary><div class="inner">${d.removed.map(u => `<div class="row between"><span class="small">${esc(u.name)}</span><button class="btn sm ghost" data-restore="${u.id}">Restore</button></div>`).join('')}</div></details>` : ''}
    </div>` + nav('#/team'));
  const send = async (id, body, msg) => { try { const r = await api('people/' + id, body); S.tree = null; if (r.tempPassword) { alert('Temporary password for this person: ' + r.tempPassword + '\n\nGive it to them in person. They can change it under their account once they sign in.'); } else toast(msg); route(); } catch (e) { fail(e); } };
  const vals = id => { const c = document.querySelector(`[data-person="${id}"]`); const pv = c.querySelector('[data-parent]').value; return { rank: c.querySelector('[data-role]').value, parentId: pv ? +pv : null }; };
  document.querySelectorAll('[data-place]').forEach(b => b.onclick = () => { const v = vals(b.dataset.place); if (!v.parentId && v.rank !== 'owner') return toast('Choose whose team they\'re on'); send(b.dataset.place, Object.assign({ action: 'place' }, v), 'Placed — their Day 1 is open'); });
  document.querySelectorAll('[data-update]').forEach(b => b.onclick = () => { const v = vals(b.dataset.update); if (!v.parentId && v.rank !== 'owner') return toast('Choose whose team they\'re on'); send(b.dataset.update, Object.assign({ action: 'update' }, v), 'Saved'); });
  document.querySelectorAll('[data-program]').forEach(c => c.onchange = () => send(c.dataset.program, { action: 'program', inProgram: c.checked }, c.checked ? 'Back in the 10-Day Program' : 'Out of the 10-Day Program'));
  document.querySelectorAll('[data-reset]').forEach(b => b.onclick = () => { if (confirm('Reset this person\'s password? Their old one stops working.')) send(b.dataset.reset, { action: 'reset' }); });
  document.querySelectorAll('[data-remove]').forEach(b => b.onclick = () => { if (confirm(`Remove ${b.dataset.name}? They disappear from every tree and can't sign in. Their history is kept and you can restore them.`)) send(b.dataset.remove, { action: 'remove' }, 'Removed'); });
  document.querySelectorAll('[data-restore]').forEach(b => b.onclick = () => send(b.dataset.restore, { action: 'restore' }, 'Restored'));
};

/* ---------------- Owner: office settings ---------------- */
ROUTES.office = async () => {
  if (!isOwner()) return go('#/today');
  const o = await api('office');
  const link = location.origin + '/join/' + o.inviteToken;
  const tiers = JSON.parse(JSON.stringify(o.bonusTiers || {}));
  const draw = () => {
    page(header({ title: esc(o.name), eyebrow: 'Owner · Office settings', back: '#/settings' }) + `<div class="body">
      <div class="card"><span class="label">Invite link</span><span class="small muted">New starts open this, set a password, and land in your People screen to be placed. No team codes.</span>
        <input class="input" readonly value="${esc(link)}" id="inv" aria-label="Invite link">
        <div class="row"><button class="btn sm grow" id="copy">Copy link</button><button class="btn sm ghost grow" id="qrBtn">Show QR code</button></div>
        <div id="qr" style="display:flex;justify-content:center"></div>
        <button class="linkbtn" id="rotate" style="align-self:flex-start">Make a new link (the old one stops working)</button></div>
      <form class="card" id="nameForm"><span class="label">Office name</span><input class="input" name="name" value="${esc(o.name)}" maxlength="60" required><button class="btn sm" type="submit">Save name</button></form>
      <div class="card"><span class="label">Bonus tiers by rank</span><span class="small muted">These show in each person's money planner, so Ace can tell them which bonus covers their gap. Amounts are before tax, per week.</span>
        ${S.C.ranks.filter(r => r.id !== 'owner').map(r => `<details class="day" style="box-shadow:none;border:1.5px solid var(--line)"><summary><span class="avatar av-${r.id}" style="width:28px;height:28px;font-size:11px">${esc(initials(r.label))}</span><span class="grow" style="font-weight:700">${esc(r.label)}</span><span class="small muted">${(tiers[r.id] || []).length} tier${(tiers[r.id] || []).length === 1 ? '' : 's'}</span>${ICON.chev}</summary><div class="inner">
          ${(tiers[r.id] || []).map((t, i) => `<div class="col" style="gap:6px;padding:8px 0;border-bottom:1px solid #EEF0F4"><input class="input" placeholder="Tier name, e.g. Tier 1" value="${esc(t.label)}" data-tier="${r.id}.${i}.label"><input class="input" placeholder="What it takes, e.g. 25 sales in a week" value="${esc(t.target)}" data-tier="${r.id}.${i}.target"><div class="row"><input class="input" type="number" min="0" placeholder="Bonus $" value="${t.amount || ''}" data-tier="${r.id}.${i}.amount"><button class="btn sm danger" data-deltier="${r.id}.${i}">Delete</button></div></div>`).join('')}
          <button class="btn sm ghost" data-addtier="${r.id}">+ Add a tier</button></div></details>`).join('')}
        <button class="btn" id="saveTiers">Save bonus tiers</button></div>
    </div>` + nav('#/team'));
    document.getElementById('copy').onclick = async () => { try { await navigator.clipboard.writeText(link); toast('Link copied'); } catch (e) { document.getElementById('inv').select(); toast('Select and copy the link'); } };
    document.getElementById('qrBtn').onclick = () => {
      const box = document.getElementById('qr'); box.innerHTML = '';
      const show = () => { new window.QRCode(box, { text: link, width: 200, height: 200 }); };
      if (window.QRCode) return show();
      const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js'; s.onload = show; s.onerror = () => toast('Couldn\'t load the QR maker — share the link instead'); document.head.appendChild(s);
    };
    document.getElementById('rotate').onclick = async () => { if (!confirm('Make a new invite link? Anyone holding the old link won\'t be able to join with it.')) return; try { Object.assign(o, await api('office', { rotateInvite: true })); ROUTES.office(); } catch (e) { fail(e); } };
    document.getElementById('nameForm').onsubmit = async e => { e.preventDefault(); try { Object.assign(o, await api('office', { name: new FormData(e.target).get('name') })); S.office.name = o.name; toast('Saved'); } catch (er) { fail(er); } };
    document.querySelectorAll('[data-tier]').forEach(i => i.oninput = () => { const [r, n, f] = i.dataset.tier.split('.'); tiers[r][+n][f] = f === 'amount' ? +i.value : i.value; });
    document.querySelectorAll('[data-addtier]').forEach(b => b.onclick = () => { (tiers[b.dataset.addtier] = tiers[b.dataset.addtier] || []).push({ label: '', target: '', amount: 0 }); draw(); document.querySelectorAll(`[data-addtier="${b.dataset.addtier}"]`)[0].closest('details').open = true; });
    document.querySelectorAll('[data-deltier]').forEach(b => b.onclick = () => { const [r, n] = b.dataset.deltier.split('.'); tiers[r].splice(+n, 1); draw(); });
    document.getElementById('saveTiers').onclick = async () => { try { const r = await api('office', { bonusTiers: tiers }); o.bonusTiers = r.bonusTiers; Object.assign(tiers, JSON.parse(JSON.stringify(r.bonusTiers))); S.mine = null; toast('Bonus tiers saved'); } catch (e) { fail(e); } };
  };
  draw();
};
