/* Growth Academy — Ace · a rep's own screens */
'use strict';

/* ---------------- Today ---------------- */
ROUTES.today = async () => {
  if (S.me.status === 'pending') return pendingScreen();
  if (isMgmt()) return mgmtHome();
  const p = await loadMine(); const x = personCtx(p);
  if (!x.inProgram) return afterProgramToday(p, x);
  const n = x.kind === 'training' ? x.dayNo : Math.min(10, x.train.length + 1);
  const day = S.C.days[(n || 1) - 1];
  const rec = x.todayRow;
  const segs = Array.from({ length: 10 }, (_, i) => `<i class="${x.trainRow(i + 1) && !(x.kind === 'training' && x.dayNo === i + 1) ? 'done' : (x.kind === 'training' && x.dayNo === i + 1) ? 'now' : ''}"></i>`).join('');
  const misDone = rec && rec.missions ? rec.missions.filter(Boolean).length : 0;
  const yest = x.rows.filter(r => r.date < x.today).sort((a, b) => a.date < b.date ? 1 : -1)[0];
  let ace;
  if (x.kind === 'production') ace = `Weekend shift. Your day counter waits for Monday — but every number you put up today counts toward your week.`;
  else {
    ace = n === 1 && !x.rows.length ? `Welcome to Day 1. Today is about your mechanics — how you stop people, how you open, how you set the tone.` : esc(day.strap);
    if (yest) { const lf = limiting(ratios(sumKpis([yest])), monthOneOn(p, yest.date)); if (lf) ace += ` ${yest.date === addDays(x.today, -1) ? 'Yesterday' : 'Last time out'} your first number below the mark was <strong>${esc(cheatRow(lf).label.toLowerCase())}</strong>.`; }
  }
  if (x.focus) ace += ` Your trainer set your focus: <strong>${esc(x.focus.skill)}</strong>.${x.focus.note ? ' ' + esc(x.focus.note) : ''}`;
  const d5 = x.rev('day5'), d10 = x.rev('day10');
  const reviewCard = (w, label, need) => {
    const r = x.rev(w); if (r && r.signed_by) return '';
    if (x.train.filter(t => t.dayNo <= need).length < (w === 'day5' ? 5 : 10)) return '';
    return `<a class="card navcard tap accent" href="#/review/${w}"><div class="ic" style="background:var(--sky-bg);color:var(--sky-d)">R</div><div class="col grow"><span class="h2">${label}</span><span class="small muted">Sit down with your trainer — numbers, reflections, sign-off</span></div>${ICON.chev}</a>`;
  };
  const w = wins(p)[0];
  page(header({ round: true, eyebrow: 'Growth Academy', title: greeting() + ', ' + esc(firstName(S.me.name)),
    right: `<div class="col" style="align-items:flex-end;gap:2px;margin-right:4px"><span class="h1" style="color:var(--lime)">${x.kind === 'production' ? 'Wknd' : 'Day ' + n}</span><span class="tiny" style="color:var(--soft)">of 10</span></div>`,
    extra: `<div class="segs" aria-label="Day ${n} of 10">${segs}</div>${aceBubble(ace)}` }) + `
    <div class="body">
      <span class="label">${x.kind === 'production' ? 'Your weekend shift' : 'Your day in three steps'}</span>
      ${x.kind === 'training' ? `<div class="card navcard"><div class="ic" style="background:var(--green-bg)">${ICON.tickG}</div><div class="col grow"><span class="h2" style="text-transform:uppercase;font-size:17px">Primetime</span><span class="small muted">${esc(day.title)}</span></div></div>` : ''}
      <a class="card navcard tap ${rec && rec.sent_at ? '' : 'accent'}" href="#/checkin"><div class="ic" style="background:var(--orange-bg);color:var(--orange-d)">${x.kind === 'training' && day.missions.length ? misDone + '/' + day.missions.length : (rec ? sumKpis([rec]).sales : '+')}</div><div class="col grow"><span class="h2" style="text-transform:uppercase;font-size:17px">${x.kind === 'training' ? 'Field missions' : 'Log my numbers'}</span><span class="small muted">Tap to count as you go</span></div>${ICON.chev}</a>
      <a class="card navcard tap" href="#/eod"><div class="ic" style="background:var(--sky-bg);color:var(--sky-d)">${rec && rec.sent_at ? ICON.tickG : 'EOD'}</div><div class="col grow"><span class="h2" style="text-transform:uppercase;font-size:17px">End of day with Ace</span><span class="small muted">${rec && rec.sent_at ? 'Sent to your trainer' : x.kind === 'training' ? 'Your numbers, three questions, then your trainer debriefs' : 'Your numbers, read back to you'}</span></div>${ICON.chev}</a>
      ${reviewCard('day5', 'Day 5 Review', 5)}${reviewCard('day10', 'Day 10 Review', 10)}
      ${isWeekend(x.today) && x.inProgram && !rec ? `<button class="linkbtn" id="trainToday">Training today instead of a weekend shift?</button>` : ''}
      ${w ? `<div class="card dark"><span class="eyebrow" style="color:var(--lime)">Latest win</span><span style="font-size:15px"><strong class="h2">${esc(w.t)}</strong> <span class="muted" style="color:var(--soft)">· ${esc(w.when)}</span></span></div>` : ''}
    </div>` + nav('#/today'));
  const tt = document.getElementById('trainToday');
  if (tt) tt.onclick = () => { S.forceTraining = x.today; go('#/checkin'); };
};

function afterProgramToday(p, x) {
  const week = isoWeek(x.today);
  const wrows = x.rows.filter(r => isoWeek(r.date) === week);
  const r = ratios(sumKpis(wrows));
  const t = sumKpis(wrows);
  const rec = x.todayRow;
  const m1 = x.rev('month1');
  let ace = wrows.length ? aceRead(r, p.monthOne) : 'New week. Log today as you go and I\'ll build your week for you.';
  if (x.focus) ace += ` Focus from your leader: <strong>${esc(x.focus.skill)}</strong>.`;
  page(header({ round: true, eyebrow: 'Week of ' + shortDate(weekMonday(x.today)), title: greeting() + ', ' + esc(firstName(S.me.name)),
    extra: `<div class="tiles">${[['stopsPerHour'], ['presPct'], ['closePct'], ['rph']].map(([k]) => `<div class="tile"><b>${fmt(k, r[k])}</b><span>${RATIOS.find(z => z[0] === k)[1]}</span><span class="lightlbl ${light(k, r[k], p.monthOne)}">${LIGHTWORD[light(k, r[k], p.monthOne)]}</span></div>`).join('')}</div>${aceBubble(ace)}` }) + `
    <div class="body">
      <a class="card navcard tap accent" href="#/checkin"><div class="ic" style="background:var(--orange-bg);color:var(--orange-d)">${rec ? sumKpis([rec]).sales : '+'}</div><div class="col grow"><span class="h2" style="text-transform:uppercase;font-size:17px">Log today</span><span class="small muted">${rec ? sumKpis([rec]).sales + ' sales so far today' : 'Tap counter — stops, presentations, closes, sales'}</span></div>${ICON.chev}</a>
      <a class="card navcard tap" href="#/eod"><div class="ic" style="background:var(--sky-bg);color:var(--sky-d)">EOD</div><div class="col grow"><span class="h2" style="text-transform:uppercase;font-size:17px">End of day</span><span class="small muted">Your numbers read back, plus objections</span></div>${ICON.chev}</a>
      <div class="card"><div class="row between"><span class="label">This week</span><span class="small muted">${wrows.length} day${wrows.length === 1 ? '' : 's'} logged</span></div>
        <div class="tiles t3"><div class="tile light"><b>${t.sales}</b><span>Sales</span></div><div class="tile light"><b>$${money(t.retail)}</b><span>Retail</span></div><div class="tile light"><b>${t.hours}</b><span>Hours</span></div></div>
        <a class="btn sm ghost" href="#/numbers">See my funnel</a></div>
      ${!(m1 && m1.signed_by) ? `<a class="card navcard tap" href="#/review/month1"><div class="ic" style="background:var(--violet-bg);color:#5B2FC9">M1</div><div class="col grow"><span class="h2">Month 1 Review</span><span class="small muted">${m1 && (m1.answers || []).some(a => a) ? 'Saved — waiting on your leader\'s sign-off' : 'Learnings, PBs, why leadership — and the Four Pillars'}</span></div>${ICON.chev}</a>` : ''}
    </div>` + nav('#/today'));
}

/* ---------------- check-in (tap counter) ---------------- */
function draftFor(p) {
  const x = personCtx(p);
  let kind = x.kind, dayNo = x.dayNo;
  if (S.forceTraining === x.today && !x.todayRow && x.inProgram) { kind = 'training'; dayNo = x.train.length + 1; }
  const rec = x.todayRow;
  const blank = { hours: null, stops: 0, presentations: 0, closes: 0, sales: 0, retail: null, cardSales: 0 };
  return { kind, dayNo, date: x.today, kpis: Object.assign(blank, rec ? rec.kpis : {}), missions: rec ? (rec.missions || []).slice() : [], answers: rec ? (rec.answers || []).slice() : [],
    objections: rec ? rec.objections || '' : '', objTags: rec ? (rec.objTags || []).slice() : [], sent: !!(rec && rec.sent_at) };
}
function queueSave(delay) {
  clearTimeout(S.saveTimer); setSaving('Saving…');
  S.saveTimer = setTimeout(saveDraft, delay === undefined ? 700 : delay);
}
function setSaving(t) { const el = document.getElementById('saving'); if (el) el.textContent = t; }
async function saveDraft(extra) {
  const d = S.draft; if (!d) return;
  try {
    S.mine = await api('mylog', Object.assign({}, d, extra || {}));
    setSaving('Saved');
  } catch (e) { setSaving('Not saved'); fail(e); throw e; }
}
ROUTES.checkin = async () => {
  const p = await loadMine();
  S.draft = draftFor(p); const d = S.draft;
  const day = d.kind === 'training' ? S.C.days[d.dayNo - 1] : null;
  const title = d.kind === 'training' ? esc(day.title) : d.kind === 'production' ? 'Weekend shift' : 'Today in the field';
  const eyebrow = d.kind === 'training' ? 'Day ' + d.dayNo + ' · In the field' : shortDate(d.date);
  page(header({ title, eyebrow, back: '#/today' }) + `<div class="body">
    ${day && day.missions.length ? `<div class="card"><span class="label">Field missions · tick off before heading home</span>
      ${day.missions.map((m, i) => `<label class="check"><input type="checkbox" data-mis="${i}" ${d.missions[i] ? 'checked' : ''}>${esc(m)}</label>`).join('')}</div>` : ''}
    ${day && day.goal_draft ? `<div class="card"><span class="label">My first quadrant goal draft</span><span class="small" style="line-height:1.45">${day.goal_draft.map(esc).join(' · ')}</span><span class="tiny muted">Work through this with your trainer today.</span></div>` : ''}
    <div class="card"><div class="row between"><span class="label">Tap counter</span><span class="saving" id="saving">${d.sent ? 'Sent' : ''}</span></div>
      <div class="counter">${[['stops', 'Stops'], ['presentations', 'Pres'], ['closes', 'Closes'], ['sales', 'Sales']].map(([k, l]) => `<button type="button" class="cbtn ${k === 'sales' ? 'sale' : ''}" data-inc="${k}" aria-label="Add one ${l}"><b id="v-${k}">${d.kpis[k] || 0}</b><span>${l}</span></button>`).join('')}</div>
      <div class="minus">${['stops', 'presentations', 'closes', 'sales'].map(k => `<button type="button" data-dec="${k}" aria-label="Take one off">−1</button>`).join('')}</div>
      <div class="stepper"><span class="lbl">Hours worked</span><button type="button" data-hours="-0.5" aria-label="Less time">−</button><span class="val" id="v-hours">${d.kpis.hours == null ? '—' : d.kpis.hours}</span><button type="button" class="plus" data-hours="0.5" aria-label="More time">+</button></div>
      <div class="stepper"><span class="lbl">Card sales</span><button type="button" data-dec="cardSales" aria-label="Take one off">−</button><span class="val" id="v-cardSales">${d.kpis.cardSales || 0}</span><button type="button" class="plus" data-inc="cardSales" aria-label="Add one">+</button></div>
      <div class="stepper"><label class="lbl" for="retail">Total retail $</label><input id="retail" class="val input" inputmode="decimal" type="number" min="0" step="1" value="${d.kpis.retail == null ? '' : d.kpis.retail}" placeholder="0"></div>
    </div>
    <div class="card"><span class="label">Objection that stopped a sale</span>
      <div class="chips">${S.C.objections.map(o => `<button type="button" class="chip ${d.objTags.includes(o) ? 'on' : ''}" data-obj="${esc(o)}" aria-pressed="${d.objTags.includes(o)}">${esc(o)}</button>`).join('')}</div>
      <textarea class="input" id="objNote" placeholder="Anything else that stopped a sale after you closed">${esc(d.objections)}</textarea></div>
    <div id="liveAce">${liveAce(p)}</div>
    <a class="btn block" href="#/eod">Done for today — end of day</a>
  </div>`);
  const upd = () => { ['stops', 'presentations', 'closes', 'sales', 'cardSales'].forEach(k => { const el = document.getElementById('v-' + k); if (el) el.textContent = d.kpis[k] || 0; }); const h = document.getElementById('v-hours'); h.textContent = d.kpis.hours == null ? '—' : d.kpis.hours; document.getElementById('liveAce').innerHTML = liveAce(p); };
  document.querySelectorAll('[data-inc]').forEach(b => b.onclick = () => {
    const k = b.dataset.inc; d.kpis[k] = (d.kpis[k] || 0) + 1;
    if (k === 'cardSales' && d.kpis.cardSales > d.kpis.sales) d.kpis.cardSales = d.kpis.sales;
    if (navigator.vibrate) navigator.vibrate(12);
    upd(); queueSave();
  });
  document.querySelectorAll('[data-dec]').forEach(b => b.onclick = () => {
    const k = b.dataset.dec; d.kpis[k] = Math.max(0, (d.kpis[k] || 0) - 1);
    if (d.kpis.cardSales > d.kpis.sales) d.kpis.cardSales = d.kpis.sales;
    upd(); queueSave();
  });
  document.querySelectorAll('[data-hours]').forEach(b => b.onclick = () => { d.kpis.hours = Math.max(0, Math.min(24, (d.kpis.hours || 0) + +b.dataset.hours)); upd(); queueSave(); });
  document.getElementById('retail').oninput = e => { const v = e.target.value; d.kpis.retail = v === '' ? null : Math.max(0, +v); upd(); queueSave(1000); };
  document.querySelectorAll('[data-mis]').forEach(c => c.onchange = () => { d.missions[+c.dataset.mis] = c.checked; queueSave(300); });
  document.querySelectorAll('[data-obj]').forEach(b => b.onclick = () => {
    const o = b.dataset.obj; const i = d.objTags.indexOf(o); if (i === -1) d.objTags.push(o); else d.objTags.splice(i, 1);
    b.classList.toggle('on', i === -1); b.setAttribute('aria-pressed', i === -1); queueSave(400);
  });
  document.getElementById('objNote').oninput = e => { d.objections = e.target.value; queueSave(1200); };
};
function liveAce(p) {
  const d = S.draft; const r = ratios(d.kpis);
  if (!d.kpis.hours) return aceBubble('Add your hours as you go and I\'ll track your stops an hour live.', { cls: 'flat', sm: true, name: false });
  const l = light('stopsPerHour', r.stopsPerHour, p.monthOne);
  const txt = `You're at <strong>${fmt('stopsPerHour', r.stopsPerHour)} stops an hour</strong> — ${l === 'g' ? 'on the mark.' : l === 'a' ? 'just under the ' + benchText('stopsPerHour', p.monthOne) + ' mark. Get into the power zone.' : 'well under the mark. SEEC and distance theory first.'}`;
  return aceBubble(txt, { cls: 'flat', sm: true, name: false });
}

/* ---------------- end of day ---------------- */
ROUTES.eod = async () => {
  const p = await loadMine();
  S.draft = draftFor(p); const d = S.draft;
  const day = d.kind === 'training' ? S.C.days[d.dayNo - 1] : null;
  const r = ratios(d.kpis);
  const tile = k => `<div class="tile"><b>${fmt(k, r[k])}</b><span>${RATIOS.find(z => z[0] === k)[1]}</span><span class="lightlbl ${light(k, r[k], p.monthOne)}">${LIGHTWORD[light(k, r[k], p.monthOne)]}</span></div>`;
  const qs = day ? day.reflections : [];
  page(header({ title: 'How did today go?', eyebrow: (d.kind === 'training' ? 'Day ' + d.dayNo : shortDate(d.date)) + ' · End of day', back: '#/today',
    extra: `<div class="tiles">${['stopsPerHour', 'presPct', 'closePct', 'retailAvg'].map(tile).join('')}</div><div class="tiles t3">${['convPct', 'ccPct', 'rph'].map(tile).join('')}</div>` }) + `
    <div class="body">
      ${aceBubble(aceRead(r, p.monthOne), { cls: 'light' })}
      ${d.objTags.length || d.objections ? `<div class="card"><span class="label">Objections today</span><div class="chips">${d.objTags.map(o => `<span class="chip dark">${esc(o)}</span>`).join('')}</div>${d.objections ? `<span class="small">${esc(d.objections)}</span>` : ''}</div>` : ''}
      ${qs.length ? `<div class="card"><span class="label" style="color:var(--orange-d)">End of day reflection</span>
        ${qs.map((q, i) => `<label class="q">${esc(q)}<textarea class="input" data-ans="${i}">${esc(d.answers[i] || '')}</textarea></label>`).join('')}</div>` : ''}
      <button class="btn block" id="send">${d.kind === 'training' ? (d.sent ? 'Update what I sent' : 'Send to my trainer') : 'Save my day'}</button>
      <span class="small muted" style="text-align:center">${d.kind === 'training' ? 'Your trainer sees your numbers, objections and answers for tonight\'s debrief.' : 'Your numbers add straight into your week.'}</span>
      <a class="linkbtn" href="#/checkin" style="text-align:center">Fix a number</a>
    </div>`);
  document.querySelectorAll('[data-ans]').forEach(t => t.oninput = () => { d.answers[+t.dataset.ans] = t.value; });
  document.getElementById('send').onclick = async () => {
    try { await saveDraft({ sent: true }); toast(d.kind === 'training' ? 'Sent to your trainer' : 'Saved'); go('#/today'); } catch (e) {}
  };
};

/* ---------------- reviews: Day 5, Day 10, Month 1 ---------------- */
function reviewTable(rows, prodRows, monthOne, labelFn) {
  let h = `<div class="tblwrap"><table class="t"><tr><th>Day</th>${KPI_IN.map(([, l]) => `<th>${l.replace(' sales', '')}</th>`).join('')}</tr>`;
  for (const r of rows) h += `<tr><td>${labelFn(r)}</td>${KPI_IN.map(([k]) => `<td>${r.kpis && r.kpis[k] != null ? (k === 'retail' ? '$' + money(r.kpis[k]) : r.kpis[k]) : '—'}</td>`).join('')}</tr>`;
  const t = sumKpis(rows);
  h += `<tr class="tot"><td>Total</td>${KPI_IN.map(([k]) => `<td>${k === 'retail' ? '$' + money(t[k]) : t[k]}</td>`).join('')}</tr>`;
  if (prodRows && prodRows.length) { const pt = sumKpis(prodRows); h += `<tr class="sub"><td>+ Weekend (${prodRows.length})</td>${KPI_IN.map(([k]) => `<td>${k === 'retail' ? '$' + money(pt[k]) : pt[k]}</td>`).join('')}</tr>`; }
  h += '</table></div>';
  const r = ratios(t);
  h += `<div class="chips">${RATIOS.map(([k, l]) => `<span class="pill ${light(k, r[k], monthOne)}">${l} ${fmt(k, r[k])}</span>`).join('')}</div>`;
  return h;
}
function reviewData(p, which) {
  const x = personCtx(p);
  if (which === 'month1') {
    const start = p.user.startDate || (x.rows.map(r => r.date).sort()[0]) || x.today;
    const rows = x.rows.filter(r => r.date >= start && r.date < addDays(start, 35)).sort((a, b) => a.date < b.date ? -1 : 1);
    return { x, rows, prod: [], title: 'Month 1 Review', qs: S.C.month1.learning.concat(S.C.month1.whyLeadership) };
  }
  const need = which === 'day5' ? [1, 2, 3, 4, 5] : [6, 7, 8, 9, 10];
  const rows = need.map(x.trainRow).filter(Boolean);
  const meta = S.C.dayReviews[which];
  let prod = [];
  if (rows.length) { const lo = rows[0].date, hi = rows[rows.length - 1].date; prod = x.rows.filter(r => r.kind === 'production' && r.date >= lo && r.date <= hi); }
  return { x, rows, prod, need, title: meta.title, qs: meta.reflections };
}
function pbs(rows) {
  let day = 0, rph = 0; for (const r of rows) { day = Math.max(day, (r.kpis || {}).sales || 0); const v = ratios(sumKpis([r])).rph; if (v && (r.kpis.hours || 0) >= 2) rph = Math.max(rph, v); }
  let week = 0; for (const w of weeksOf(rows)) week = Math.max(week, sumKpis(w.rows).sales);
  return { day, week, rph };
}
ROUTES.review = async (which) => {
  if (!['day5', 'day10', 'month1'].includes(which)) return go('#/today');
  const p = await loadMine(); const R = reviewData(p, which); const rec = R.x.rev(which);
  const signed = rec && rec.signed_by;
  const label = r => r.kind === 'training' ? 'Day ' + r.dayNo : shortDate(r.date);
  const pb = which === 'month1' ? pbs(R.rows) : null;
  const m1q = S.C.month1.learning.length;
  page(header({ title: esc(R.title), eyebrow: which === 'month1' ? 'End of month one' : 'Run it with your trainer', back: which === 'month1' ? '#/today' : '#/today' }) + `<div class="body">
    ${aceBubble(which === 'month1' ? 'This is the review that turns a month of field time into growth. Be honest — your leader signs it, then the Four Pillars Checklist opens the door to The Captain.' : 'This builds itself from your daily entries. Numbers first, then reflections, then your trainer signs it off.', { cls: 'light' })}
    <div class="card"><span class="label">Your numbers</span>${R.rows.length ? reviewTable(R.rows, R.prod, monthOneOn(p, R.rows[0].date), label) : '<span class="small muted">No days logged yet.</span>'}</div>
    ${pb ? `<div class="card"><span class="label">Personal bests this month</span><div class="tiles t3"><div class="tile light"><b>${pb.day}</b><span>Daily sales PB</span></div><div class="tile light"><b>${pb.week}</b><span>Weekly PB</span></div><div class="tile light"><b>${pb.rph ? '$' + pb.rph.toFixed(2) : '—'}</b><span>RPH PB</span></div></div></div>` : ''}
    <div class="card"><span class="label" style="color:var(--orange-d)">${which === 'month1' ? 'Monthly review' : 'Reflections'}</span>
      ${R.qs.map((q, i) => (which === 'month1' && i === m1q ? `<span class="label" style="color:var(--orange-d);margin-top:6px">Why leadership — where am I headed?</span>` : '') + `<label class="q">${esc(q)}<textarea class="input" data-rans="${i}" ${signed ? 'disabled' : ''}>${esc(rec && rec.answers ? rec.answers[i] || '' : '')}</textarea></label>`).join('')}</div>
    ${signed ? `<div class="card top-green"><span class="label" style="color:var(--green)">Signed off by ${esc(rec.signed_by_name || 'your trainer')}</span>${rec.comments ? `<span class="small">"${esc(rec.comments)}"</span>` : ''}</div>`
      : `<button class="btn block" id="saveRev">Save my answers</button><span class="small muted" style="text-align:center">Your trainer signs this off from their phone.</span>`}
    ${which === 'month1' ? `<a class="card navcard tap" href="#/checklist/cadet"><div class="ic" style="background:var(--green-bg);color:var(--green-d)">4P</div><div class="col grow"><span class="h2">The Four Pillars Checklist</span><span class="small muted">Score yourself first — your leader signs each one</span></div>${ICON.chev}</a>` : ''}
  </div>`);
  const b = document.getElementById('saveRev');
  if (b) b.onclick = async () => {
    const answers = [...document.querySelectorAll('[data-rans]')].map(t => t.value);
    try { S.mine = await api('myreview', { which, answers }); toast('Saved — your trainer can see it'); } catch (e) { fail(e); }
  };
};

/* ---------------- Numbers ---------------- */
function funnelHtml(r, monthOne) {
  return S.C.cheatSheet.funnel_order.map(k => {
    const l = light(k, r[k], monthOne), g = greenOf(k, monthOne);
    const pct = r[k] == null ? 0 : Math.min(100, Math.round(r[k] / g * 100));
    const col = l === 'g' ? 'var(--green)' : l === 'a' ? 'var(--orange)' : l === 'r' ? 'var(--coral)' : '#CFD5DF';
    return `<div class="fun"><div class="top"><span style="font-weight:${l === 'g' || l === 'n' ? 600 : 700}">${esc(cheatRow(k).label)}</span><span><strong style="font-family:var(--cond);font-size:16px">${fmt(k, r[k])}</strong> <span class="muted">/ ${benchText(k, monthOne)}</span> <span class="pill ${l}">${LIGHTWORD[l]}</span></span></div><div class="bar"><i style="width:${pct}%;background:${col}"></i></div></div>`;
  }).join('');
}
function focusCard(r, monthOne, who) {
  const lf = limiting(r, monthOne);
  if (!lf) return `<div class="card dark"><span class="eyebrow" style="color:var(--lime)">All green</span><span>Every number down the funnel is on the mark. Keep doing exactly that.</span></div>`;
  const row = cheatRow(lf);
  return `<div class="card dark"><div class="row"><div class="ace"><div class="av sm" aria-hidden="true">A</div></div><div class="col"><span class="eyebrow">${who ? 'Suggested focus' : 'Ace\'s focus for this week'}</span><span class="h2">${esc(row.label)}</span></div></div>
    <span class="small" style="color:#D9DFEA;line-height:1.45">${esc(S.C.cheatSheet.rule)}</span>
    <div class="chips">${row.skills.map(s => `<span class="chip dark">${esc(s)}</span>`).join('')}</div></div>`;
}
ROUTES.numbers = async (weekArg) => {
  const p = await loadMine(); const x = personCtx(p);
  const weeks = weeksOf(x.rows);
  const cur = isoWeek(x.today);
  const sel = weekArg || cur;
  const wrows = x.rows.filter(r => isoWeek(r.date) === sel);
  const r = ratios(sumKpis(wrows)); const t = sumKpis(wrows);
  const mo = wrows.length ? monthOneOn(p, wrows[0].date) : p.monthOne;
  const last6 = weeks.slice(-6);
  const maxS = Math.max(1, ...last6.map(w => sumKpis(w.rows).sales));
  const w1 = [1, 2, 3, 4, 5].map(x.trainRow).filter(Boolean), w2 = [6, 7, 8, 9, 10].map(x.trainRow).filter(Boolean);
  let traj = '';
  if (w1.length && w2.length) {
    const a = ratios(sumKpis(w1)), b = ratios(sumKpis(w2));
    traj = `<div class="card"><span class="label">Trajectory · Days 1–5 vs Days 6–10</span><div class="tblwrap"><table class="t"><tr><th>Metric</th><th>1–5</th><th>6–10</th><th>Change</th></tr>${RATIOS.map(([k, l]) => {
      const up = a[k] != null && b[k] != null ? b[k] >= a[k] : null;
      return `<tr><td>${l}</td><td>${fmt(k, a[k])}</td><td>${fmt(k, b[k])}</td><td style="color:${up === null ? 'var(--mid)' : up ? 'var(--green)' : 'var(--coral)'}">${up === null ? '—' : up ? '▲' : '▼'}</td></tr>`;
    }).join('')}</table></div></div>`;
  }
  page(header({ title: 'Your sales funnel', eyebrow: sel === cur ? 'This week' : 'Week of ' + shortDate(weekMonday(wrows[0] ? wrows[0].date : x.today)),
    right: `<div class="col" style="align-items:flex-end;margin-right:4px"><span class="h1" style="color:var(--lime)">${fmt('rph', r.rph)}</span><span class="tiny" style="color:var(--soft)">RPH · goal $${S.C.lights.rph.green}</span></div>`,
    extra: weeks.length > 1 ? `<div class="tabs">${weeks.slice(-8).reverse().map(w => `<a href="#/numbers/${w.week}" class="${w.week === sel ? 'on' : ''}">${w.week === cur ? 'This week' : shortDate(w.mon)}</a>`).join('')}</div>` : '' }) + `
    <div class="body">
      ${wrows.length ? `<div class="card">${funnelHtml(r, mo)}</div>${focusCard(r, mo)}
      <div class="card"><span class="label">Week totals</span><div class="tiles t3"><div class="tile light"><b>${t.sales}</b><span>Sales</span></div><div class="tile light"><b>$${money(t.retail)}</b><span>Retail</span></div><div class="tile light"><b>${t.hours}</b><span>Hours</span></div></div></div>`
      : `<div class="empty">No days logged this week yet.<br><a class="btn sm" href="#/checkin" style="margin-top:12px">Log today</a></div>`}
      ${last6.length > 1 ? `<div class="card"><span class="label">Sales by week</span><div class="row" style="align-items:flex-end;height:90px;gap:8px" role="img" aria-label="Sales per week: ${last6.map(w => sumKpis(w.rows).sales).join(', ')}">${last6.map(w => { const s = sumKpis(w.rows).sales; return `<div class="col grow" style="align-items:center;gap:3px;justify-content:flex-end;height:100%"><span class="tiny" style="font-weight:700">${s}</span><div style="width:100%;max-width:34px;height:${Math.max(4, Math.round(s / maxS * 64))}px;border-radius:5px;background:${w.week === cur ? 'var(--navy)' : 'var(--soft)'}"></div><span class="tiny muted">${shortDate(w.mon).split(' ').slice(1).join(' ')}</span></div>`; }).join('')}</div></div>` : ''}
      ${traj}
    </div>` + nav('#/numbers'));
};

/* ---------------- Journey ---------------- */
function stageState(p, st, idx) {
  const x = personCtx(p); const ri = rankIdx(p.user.rank); const sri = rankIdx(st.rank);
  const d10 = x.rev('day10'), m1 = x.rev('month1');
  if (st.rank === 'rep') {
    if (ri > 0) return 'done';
    if (st.id === 'tenday') return (d10 && d10.signed_by) || p.user.programDone ? 'done' : 'now';
    if (st.id === 'levelup') return p.passed.levelup ? 'done' : (d10 && d10.signed_by) || x.train.length >= 10 || p.user.programDone ? 'now' : 'locked';
    if (st.id === 'month1') return m1 && m1.signed_by ? 'done' : p.passed.levelup ? 'now' : 'locked';
  }
  if (ri > sri) return 'done';
  if (ri === sri) return 'now';
  return 'locked';
}
function reviewButton(p, id, enabled) {
  const rv = S.C.reviews[id]; const ps = p.passed[id];
  if (ps) return `<a class="btn sm ghost" href="#/quiz/${id}">${esc(rv.title)} · ${ps.score}/${ps.total}</a>`;
  if (!enabled) return `<span class="pill n">${ICON.lock}&nbsp;${esc(rv.title)}</span>`;
  return `<a class="btn sm orange" href="#/quiz/${id}" data-quiz="${id}">Take the ${esc(rv.title)}</a>`;
}
ROUTES.journey = async () => {
  const p = await loadMine(); const me = rankOf(p.user.rank); const next = S.C.ranks[rankIdx(p.user.rank) + 1];
  const W = wins(p);
  let hereShown = false;
  const stages = S.C.stages.map((st, i) => {
    const s = stageState(p, st, i);
    const here = s === 'now' && !hereShown; if (here) hereShown = true;
    const ck = st.checklist ? S.C.checklists[st.checklist] : null;
    const ckDone = ck ? Object.keys(p.checks || {}).filter(k => k.startsWith(st.checklist + '-') && (p.checks[k].done || p.checks[k].self)).length : 0;
    const open = s !== 'locked';
    const r2ok = st.review2 && p.passed[st.review];
    return `<div class="stage"><div class="rail"><div class="node ${here ? 'now' : s === 'now' ? 'done' : s}" style="${s === 'now' && !here ? 'background:var(--sky)' : ''}">${s === 'done' ? ICON.tick : s === 'locked' ? ICON.lock : i + 1}</div>${i < S.C.stages.length - 1 ? `<div class="link ${s === 'done' ? 'done' : ''}"></div>` : ''}</div>
      <div class="content"><span class="h2" style="text-transform:uppercase;font-size:16px;${s === 'locked' ? 'color:var(--mid)' : ''}">${esc(st.title)}</span><span class="small muted">${esc(st.desc)}</span>
      ${here ? `<span class="pill a" style="align-self:flex-start">You are here</span>` : ''}
      ${open && (st.review || ck) ? `<div class="chips">${st.review ? reviewButton(p, st.review, open) : ''}${st.review2 ? reviewButton(p, st.review2, r2ok) : ''}${ck ? `<a class="btn sm ghost" href="#/checklist/${st.checklist}">${esc(ck.name.replace('The ', ''))} · ${ckDone}/${ck.count}</a>` : ''}</div>` : ''}
      </div></div>`;
  }).join('');
  page(header({ title: esc(me.label), eyebrow: 'Your journey',
    right: next ? `<span class="small" style="color:var(--soft);text-align:right;margin-right:4px">Next rank<br><strong class="h2" style="color:#fff">${esc(next.label)}</strong></span>` : '',
    extra: `<div class="tiles t3"><div class="tile"><b style="color:var(--lime)">${W.length}</b><span>Wins earned</span></div><div class="tile"><b style="color:var(--sky)">${Object.keys(p.passed).length}</b><span>Reviews passed</span></div><div class="tile"><b style="color:var(--orange)">${esc(me.book.replace('The ', ''))}</b><span>Your book</span></div></div>` }) + `
    <div class="body"><div style="padding-top:4px">${stages}</div>
      ${W.length ? `<span class="label">Wins along the way</span><div class="col" style="gap:8px">${W.slice(0, 8).map(w => `<div class="card" style="flex-direction:row;align-items:center;border-left:5px solid ${w.c};padding:10px 13px"><span class="h2 grow" style="font-size:16px">${esc(w.t)}</span><span class="small muted">${esc(w.when)}</span></div>`).join('')}</div>` : ''}
    </div>` + nav('#/journey'));
};

/* ---------------- Goals & money planner ---------------- */
function annualTax(y) { let t = 0; if (y > 190000) t = 51370 + .45 * (y - 190000); else if (y > 135000) t = 31020 + .37 * (y - 135000); else if (y > 45000) t = 4020 + .30 * (y - 45000); else if (y > 18200) t = .15 * (y - 18200); return t + .02 * y; }
const weeklyNet = g => g - annualTax(g * 52) / 52;
function planDefaults(p) {
  return { pay: Object.assign({ rate: 0, hours: 0 }, p.pay || {}),
    plan: p.plan && p.plan.expenses ? JSON.parse(JSON.stringify(p.plan)) : { expenses: [{ label: 'Rent / board', value: 0 }, { label: 'Food', value: 0 }, { label: 'Transport and bills', value: 0 }, { label: 'Fun money', value: 0 }], goal: 0, weeks: 12, goalName: '' } };
}
function planMaths(pay, plan) {
  const gross = pay.rate * pay.hours, net = weeklyNet(gross), tax = gross - net;
  const exp = plan.expenses.reduce((n, e) => n + (+e.value || 0), 0);
  const need = exp + (plan.weeks > 0 ? plan.goal / plan.weeks : 0), gap = need - net;
  let cover = 0; if (pay.rate > 0) while (cover < 80 && weeklyNet(pay.rate * cover) < exp) cover += 0.5;
  let bonus = 0; if (gap > 0) while (bonus < 20000 && weeklyNet(gross + bonus) - net < gap) bonus += 5;
  return { gross, net, tax, exp, need, gap, cover, bonus };
}
ROUTES.goals = async () => {
  const p = await loadMine();
  if (!S.plan) S.plan = planDefaults(p);
  const P = S.plan;
  const draw = () => {
    const M = planMaths(P.pay, P.plan); const covered = P.pay.rate > 0 && M.gap <= 0;
    const tiers = (p.bonusTiers || []).slice().sort((a, b) => a.amount - b.amount);
    const hit = tiers.find(t => t.amount >= M.bonus);
    const stepper = (lbl, val, key, step, path) => `<div class="stepper"><span class="lbl">${lbl}</span><button type="button" data-step="${path}" data-by="${-step}" aria-label="Less">−</button><span class="val">${val}</span><button type="button" class="plus" data-step="${path}" data-by="${step}" aria-label="More">+</button></div>`;
    page(header({ title: P.plan.goalName ? esc(P.plan.goalName) : 'Money planner', eyebrow: 'Goals',
      extra: `<div class="tiles t3"><div class="tile"><b>$${money(M.need)}</b><span>Needed a week</span></div><div class="tile"><b style="color:var(--sky)">$${money(M.net)}</b><span>Wage after tax</span></div><div class="tile" style="background:${!P.pay.rate ? 'var(--navy2)' : covered ? 'var(--lime)' : 'var(--orange)'}"><b style="color:${P.pay.rate ? 'var(--navy)' : '#fff'}">${!P.pay.rate ? '—' : covered ? 'Covered' : '$' + money(M.gap)}</b><span style="color:${P.pay.rate ? 'var(--navy)' : 'var(--soft)'}">${!P.pay.rate ? 'Add your pay' : covered ? 'Bonuses are extra' : 'Gap after tax'}</span></div></div>` }) + `
      <div class="body">
        <div class="card"><span class="label">My pay</span>
          ${stepper('Hourly rate', '$' + P.pay.rate, '', 1, 'pay.rate')}${stepper('Hours a week', P.pay.hours, '', 1, 'pay.hours')}
          <span class="small muted">Gross $${money(M.gross)} a week · est. tax and Medicare $${money(M.tax)}</span></div>
        <div class="card"><span class="label">Weekly expenses</span>
          ${P.plan.expenses.map((e, i) => `<div class="stepper"><input class="lbl input" style="min-height:38px;padding:6px 9px;font-size:14px" value="${esc(e.label)}" data-elabel="${i}" aria-label="Expense name"><button type="button" data-step="exp.${i}" data-by="-10" aria-label="Less">−</button><span class="val">$${money(e.value)}</span><button type="button" class="plus" data-step="exp.${i}" data-by="10" aria-label="More">+</button></div>`).join('')}
          <button class="linkbtn" id="addExp" style="align-self:flex-start">+ Add an expense</button></div>
        <div class="card"><span class="label">Savings goal</span>
          <label class="field">What it's for<input class="input" id="goalName" value="${esc(P.plan.goalName || '')}" placeholder="e.g. Car, trip, house deposit" maxlength="60"></label>
          ${stepper('Save', '$' + money(P.plan.goal), '', 500, 'plan.goal')}${stepper('In weeks', P.plan.weeks, '', 1, 'plan.weeks')}</div>
        <div class="card dark">${aceBubble(!P.pay.rate ? 'Pop in your hourly rate and hours and I\'ll work out the rest.' : covered ? 'Your wage covers your expenses and your savings goal. Every bonus you earn speeds the goal up.' : `Your wage covers your expenses${M.cover ? ' at ' + M.cover + ' hours a week' : ''}. To save $${money(P.plan.goal)} in ${P.plan.weeks} weeks you need about <strong>$${money(M.gap)} more a week after tax</strong> — roughly <strong>$${money(M.bonus)} in bonuses before tax</strong>.`, { name: false })}
          <div class="tiles t2"><div class="tile"><b style="color:var(--lime)">${P.pay.rate ? M.cover + ' hrs' : '—'}</b><span>To cover expenses on wage alone</span></div><div class="tile"><b style="color:var(--orange)">$${money(M.bonus)}</b><span>Bonus a week before tax for the goal</span></div></div></div>
        <div class="card"><div class="row between"><span class="label">Bonuses at your level</span><span class="tiny muted">${esc(rankOf(S.me.rank).label)}</span></div>
          ${tiers.length ? tiers.map(t => `<div class="row between" style="padding:7px 0;border-bottom:1px solid #EEF0F4;${hit === t && !covered ? 'font-weight:700' : ''}"><span class="small">${esc(t.label)}${t.target ? ' · ' + esc(t.target) : ''}</span><span class="row" style="gap:6px">${hit === t && !covered ? '<span class="pill a">Covers your gap</span>' : ''}<strong>$${money(t.amount)}</strong></span></div>`).join('') + (!covered && !hit ? `<span class="small muted">Your gap is bigger than the top tier — talk it through with your leader.</span>` : '')
          : `<span class="small muted">Your office hasn't loaded its bonus tiers yet.</span>`}
          <span class="small" style="line-height:1.4">Work the plan through live with your leader.</span></div>
        <span class="tiny muted" style="text-align:center;line-height:1.4">Rough estimate using 2026–27 resident tax rates plus 2% Medicare, before offsets and super. Not financial advice.</span>
        <span class="saving" id="saving" style="text-align:center"></span>
      </div>` + nav('#/goals'), { keepScroll: true });
    document.querySelectorAll('[data-step]').forEach(b => b.onclick = () => {
      const [grp, key] = b.dataset.step.split('.'); const by = +b.dataset.by;
      if (grp === 'pay') P.pay[key] = Math.max(0, Math.min(key === 'hours' ? 80 : 500, (P.pay[key] || 0) + by));
      else if (grp === 'plan') P.plan[key] = Math.max(key === 'weeks' ? 1 : 0, (P.plan[key] || 0) + by);
      else P.plan.expenses[+key].value = Math.max(0, (+P.plan.expenses[+key].value || 0) + by);
      savePlan(); draw();
    });
    document.querySelectorAll('[data-elabel]').forEach(i => i.onchange = () => { P.plan.expenses[+i.dataset.elabel].label = i.value; savePlan(); });
    document.getElementById('goalName').onchange = e => { P.plan.goalName = e.target.value; savePlan(); draw(); };
    document.getElementById('addExp').onclick = () => { if (P.plan.expenses.length < 12) { P.plan.expenses.push({ label: 'Other', value: 0 }); savePlan(); draw(); } };
  };
  draw();
};
function savePlan() {
  clearTimeout(S.planTimer);
  S.planTimer = setTimeout(async () => { try { const r = await api('myplan', S.plan); if (S.mine) { S.mine.pay = r.pay; S.mine.plan = r.plan; } setSaving('Saved'); } catch (e) { fail(e); } }, 700);
}
