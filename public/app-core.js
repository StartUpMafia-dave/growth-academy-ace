/* Growth Academy — Ace · core: state, data, helpers, routing, shared screens */
'use strict';
const S = { me: null, office: null, C: null, mine: null, tree: null, cache: {}, draft: null, saveTimer: null, saving: false, quiz: null };
const $app = () => document.getElementById('app');

/* ---------------- api ---------------- */
async function api(path, body) {
  const opt = body === undefined ? { credentials: 'same-origin' }
    : { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
  const r = await fetch('/api/' + path, opt);
  let data = null; try { data = await r.json(); } catch (e) {}
  if (!r.ok) { const err = new Error((data && data.error) || 'Something went wrong — try again.'); err.status = r.status; throw err; }
  return data;
}
function toast(msg) {
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t);
  setTimeout(() => t.remove(), 2600);
}
function fail(e) { if (e && e.status === 401) { S.me = null; go('#/login'); return; } toast(e.message || 'Something went wrong.'); }

/* ---------------- helpers ---------------- */
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const KPI_IN = [['hours', 'Hours'], ['stops', 'Stops'], ['presentations', 'Presentations'], ['closes', 'Closes'], ['sales', 'Sales'], ['retail', 'Retail $'], ['cardSales', 'Card sales']];
const RATIOS = [['stopsPerHour', 'Stops p/h'], ['presPct', 'Stops → Pres'], ['closePct', 'Pres → Close'], ['convPct', 'Close → Sale'], ['retailAvg', '$ Average'], ['ccPct', 'Credit card %'], ['rph', 'RPH']];
const LIGHTWORD = { g: 'Green', a: 'Amber', r: 'Red', n: '—' };
function sumKpis(rows) { const t = { hours: 0, stops: 0, presentations: 0, closes: 0, sales: 0, retail: 0, cardSales: 0 }; for (const r of rows) for (const k in t) t[k] += (r.kpis && typeof r.kpis[k] === 'number') ? r.kpis[k] : 0; return t; }
function ratios(t) { const d = (a, b) => b > 0 ? a / b : null; return { stopsPerHour: d(t.stops, t.hours), presPct: d(t.presentations, t.stops), closePct: d(t.closes, t.presentations), convPct: d(t.sales, t.closes), retailAvg: d(t.retail, t.sales), ccPct: d(t.cardSales, t.sales), rph: d(t.retail, t.hours) }; }
function fmt(key, v) {
  if (v === null || v === undefined || isNaN(v)) return '—';
  if (key === 'retailAvg' || key === 'rph') return '$' + (v >= 100 ? Math.round(v) : v.toFixed(2).replace(/\.00$/, ''));
  if (key === 'stopsPerHour') return v.toFixed(1);
  return Math.round(v * 100) + '%';
}
function greenOf(key, monthOne) { const tl = S.C.lights[key]; return (key === 'stopsPerHour' && monthOne && tl.greenMonthOne) ? tl.greenMonthOne : tl.green; }
function light(key, v, monthOne) {
  if (v === null || v === undefined || isNaN(v)) return 'n';
  const tl = S.C.lights[key]; if (!tl) return 'n';
  if (v >= greenOf(key, monthOne)) return 'g'; if (v >= tl.amberMin) return 'a'; return 'r';
}
function benchText(key, monthOne) {
  const g = greenOf(key, monthOne);
  if (key === 'stopsPerHour') return (g === 3 ? '3+' : g) + ' p/h';
  if (key === 'retailAvg' || key === 'rph') return '$' + g;
  return Math.round(g * 100) + '%';
}
function limiting(r, monthOne) { for (const k of S.C.cheatSheet.funnel_order) { const l = light(k, r[k], monthOne); if (l === 'r' || l === 'a') return k; } return null; }
const cheatRow = k => S.C.cheatSheet.rows.find(x => x.metric === k);
function pad(n) { return String(n).padStart(2, '0'); }
function todayStr(d) { d = d || new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function addDays(ds, n) { const d = new Date(ds + 'T12:00:00'); d.setDate(d.getDate() + n); return todayStr(d); }
function isWeekend(ds) { const d = new Date(ds + 'T12:00:00').getDay(); return d === 0 || d === 6; }
function isoWeek(ds) {
  const d = new Date(ds + 'T12:00:00Z'); const day = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - day + 3);
  const f = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  return d.getUTCFullYear() + '-W' + pad(1 + Math.round(((d - f) / 86400000 - 3 + ((f.getUTCDay() + 6) % 7)) / 7));
}
function weekMonday(ds) { const d = new Date(ds + 'T12:00:00'); const day = (d.getDay() + 6) % 7; d.setDate(d.getDate() - day); return todayStr(d); }
function shortDate(ds) { const d = new Date(ds + 'T12:00:00'); return d.toLocaleDateString('en-AU', { weekday: 'short', day: 'numeric', month: 'short' }); }
function fmtWhen(ms) { return new Date(ms).toLocaleDateString('en-AU', { day: 'numeric', month: 'short' }); }
const firstName = n => String(n || '').split(' ')[0];
const initials = n => String(n || '?').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('');
const rankOf = id => S.C.ranks.find(r => r.id === id) || S.C.ranks[0];
const rankIdx = id => S.C.ranks.findIndex(r => r.id === id);
const isMgmt = () => S.me && rankIdx(S.me.rank) >= rankIdx('leader');
const isOwner = () => S.me && S.me.rank === 'owner';
function greeting() { const h = new Date().getHours(); return h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : 'Evening'; }
function money(n) { return Math.round(n).toLocaleString('en-AU'); }

/* ---------------- a person's record, worked out ---------------- */
function personCtx(p) {
  const rows = p.rows || [];
  const train = rows.filter(r => r.kind === 'training').sort((a, b) => a.dayNo - b.dayNo);
  const trainRow = n => train.find(r => r.dayNo === n);
  const rev = w => (p.reviews || []).find(r => r.which === w);
  const today = todayStr();
  const todayRow = rows.find(r => r.date === today);
  const inProgram = train.length < 10 && p.user.rank === 'rep' && !p.user.programDone;
  let kind, dayNo = null;
  if (todayRow) { kind = todayRow.kind; dayNo = todayRow.dayNo; }
  else if (inProgram && !isWeekend(today)) { kind = 'training'; dayNo = train.length + 1; }
  else if (inProgram) kind = 'production';
  else kind = 'daily';
  const focus = (p.focus || []).length ? p.focus[p.focus.length - 1] : null;
  return { rows, train, trainRow, rev, today, todayRow, inProgram, kind, dayNo, focus, monthOne: p.monthOne };
}
/* Through the first month 3+ stops an hour is green; from the end of month one, 3.5. Judged on the date of the numbers. */
function monthOneOn(p, date) {
  const m1 = (p.reviews || []).find(r => r.which === 'month1' && r.signed_by);
  if (m1 && m1.signed_at && date >= todayStr(new Date(m1.signed_at))) return false;
  const s = p.user && p.user.startDate; if (!s || !date) return !!p.monthOne;
  return (Date.parse(date + 'T12:00:00') - Date.parse(s + 'T12:00:00')) / 86400000 < 31;
}
function weeksOf(rows) {
  const m = {}; for (const r of rows) { const w = isoWeek(r.date); (m[w] = m[w] || []).push(r); }
  return Object.keys(m).sort().map(w => ({ week: w, rows: m[w], mon: weekMonday(m[w][0].date) }));
}
function wins(p) {
  const rows = (p.rows || []).slice().sort((a, b) => a.date < b.date ? -1 : 1);
  const out = [];
  const firstSale = rows.find(r => (r.kpis || {}).sales > 0);
  if (firstSale) out.push({ t: 'First sale', when: firstSale.kind === 'training' ? 'Day ' + firstSale.dayNo : shortDate(firstSale.date), c: 'var(--lime)', d: firstSale.date });
  let best = 0, bestRow = null;
  for (const r of rows) { const s = (r.kpis || {}).sales || 0; if (s > best) { if (best > 0) bestRow = r; best = s; } }
  if (bestRow) out.push({ t: 'Daily sales PB · ' + best, when: shortDate(bestRow.date), c: 'var(--sky)', d: bestRow.date });
  const wk = weeksOf(rows); let wbest = 0, wrow = null;
  for (const w of wk) { const s = sumKpis(w.rows).sales; if (s > wbest) { if (wbest > 0) wrow = w; wbest = s; } }
  if (wrow) out.push({ t: 'Weekly sales PB · ' + wbest, when: 'Week of ' + shortDate(wrow.mon), c: 'var(--orange)', d: wrow.mon });
  const green = rows.filter(r => { const x = ratios(sumKpis([r])); return S.C.cheatSheet.funnel_order.every(k => light(k, x[k], monthOneOn(p, r.date)) === 'g'); }).pop();
  if (green) out.push({ t: 'All-green day', when: green.kind === 'training' ? 'Day ' + green.dayNo : shortDate(green.date), c: 'var(--green)', d: green.date });
  let rbest = 0, rrow = null;
  for (const r of rows) { const v = ratios(sumKpis([r])).rph; if (v && v > rbest && (r.kpis.hours || 0) >= 2) { if (rbest > 0) rrow = r; rbest = v; } }
  if (rrow) out.push({ t: 'RPH PB · $' + rbest.toFixed(2), when: shortDate(rrow.date), c: 'var(--violet)', d: rrow.date });
  for (const k of Object.keys(p.passed || {})) { const rv = S.C.reviews[k]; if (rv) out.push({ t: rv.title + ' passed', when: p.passed[k].score + '/' + p.passed[k].total, c: 'var(--sky)', d: '9999' }); }
  return out.sort((a, b) => a.d < b.d ? 1 : -1);
}

/* ---------------- Ace ---------------- */
function aceBubble(text, opts) {
  opts = opts || {};
  return `<div class="ace ${opts.cls || ''}"><div class="av ${opts.sm ? 'sm' : ''}" aria-hidden="true">A</div><div class="bub">${opts.name === false ? '' : '<b class="who">Ace</b>'}${text}</div></div>`;
}
function aceRead(r, monthOne, who) {
  const lf = limiting(r, monthOne);
  const goods = RATIOS.filter(([k]) => light(k, r[k], monthOne) === 'g').map(([, l]) => l);
  if (r.stopsPerHour === null) return 'Log your hours and stops and I\'ll read your numbers for you.';
  let s = '';
  if (goods.length) s += (who ? who + '\'s ' : 'Your ') + esc(goods.slice(0, 2).join(' and ').toLowerCase()) + (goods.length === 1 ? ' is' : ' are') + ' on the mark. ';
  if (!lf) return s + 'Every number down the funnel is green — keep doing exactly that.';
  const row = cheatRow(lf);
  return s + `The first number below benchmark is <strong>${esc(row.label)}</strong> (${fmt(lf, r[lf])} against ${benchText(lf, monthOne)}). Fix that one and everything below it lifts — start with <strong>${esc(row.skills[0])}</strong>.`;
}

/* ---------------- layout ---------------- */
const ICON = {
  back: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M15 6l-6 6 6 6" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  chev: '<svg class="chev" width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 6l6 6-6 6" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  tick: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7" stroke="#fff" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  tickG: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7" stroke="#3E7A12" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  lock: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2" stroke="#5B6577" stroke-width="2.4"/><path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="#5B6577" stroke-width="2.4"/></svg>',
  home: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 11l8-7 8 7v9h-5v-6H9v6H4z" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"/></svg>',
  team: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="9" cy="8" r="3.5" stroke="currentColor" stroke-width="2.2"/><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18.5 14.8c1.6.8 2.6 2.6 3 5.2" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  nums: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/></svg>',
  path: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 19c3-6 11-2 14-14" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="5" cy="19" r="2" fill="currentColor"/><circle cx="19" cy="5" r="2" fill="currentColor"/></svg>',
  goal: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2.2"/><circle cx="12" cy="12" r="4" stroke="currentColor" stroke-width="2.2"/></svg>'
};
function nav(active) {
  const items = [['#/today', 'Today', 'home']];
  if (isMgmt()) items.push(['#/team', 'Team', 'team']);
  items.push(['#/numbers', 'Numbers', 'nums'], ['#/journey', 'Journey', 'path'], ['#/goals', 'Goals', 'goal']);
  return `<nav class="nav" aria-label="Main">${items.map(([h, l, i]) => `<a href="${h}" class="${active === h ? 'on' : ''}" ${active === h ? 'aria-current="page"' : ''}>${ICON[i]}${l}</a>`).join('')}</nav>`;
}
function header(o) {
  return `<header class="hdr ${o.round ? 'round' : ''}">
    <div class="row">${o.back ? `<a class="back" href="${o.back}" aria-label="Back">${ICON.back}</a>` : ''}
      <div class="col grow" style="gap:2px"><span class="eyebrow">${o.eyebrow || 'Growth Academy'}</span><span class="h1">${o.title}</span></div>
      ${o.right || ''}${o.noMe ? '' : `<a class="iconbtn" href="#/settings" aria-label="My account">${esc(initials(S.me.name))}</a>`}</div>
    ${o.extra || ''}</header>`;
}
function page(html, opts) { opts = opts || {}; $app().className = opts.wide ? 'wide' : ''; $app().innerHTML = html; if (opts.focus !== false) window.scrollTo(0, opts.keepScroll ? window.scrollY : 0); }

/* ---------------- data loading ---------------- */
async function loadMine(force) { if (!S.mine || force) S.mine = await api('mine'); return S.mine; }
async function loadTree(force) { if (!S.tree || force) S.tree = await api('tree'); return S.tree; }
async function loadPerson(id, force) { if (!S.cache[id] || force) S.cache[id] = await api('person/' + id); return S.cache[id]; }

/* ---------------- router ---------------- */
const ROUTES = {};
function go(h) { if (location.hash === h) route(); else location.hash = h; }
async function route() {
  const h = location.hash || '#/today';
  if (!S.me && !/^#\/(login|join|create)/.test(h)) return go('#/login');
  if (S.me && S.me.status === 'pending' && !/^#\/(login|join|create|settings)/.test(h)) return pendingScreen();
  const parts = h.replace(/^#\//, '').split('/');
  const fn = ROUTES[parts[0]] || ROUTES.today;
  try { await fn(...parts.slice(1)); } catch (e) { fail(e); }
}
window.addEventListener('hashchange', route);

/* ---------------- sign in / join / pending ---------------- */
function brandTop() { return `<div class="col" style="gap:6px"><span class="eyebrow" style="letter-spacing:.24em;font-size:13px">Welcome to the</span><div class="brand">GROWTH<br><span>ACADEMY</span></div></div>`; }
ROUTES.login = () => {
  page(`<div class="login">${brandTop()}
    ${aceBubble("G'day, I'm Ace. I'll be with you every day from your first morning to your first promotion and beyond.")}
    <form class="loginbox" id="loginForm">
      <span class="h2">Sign in</span>
      <label class="field">Email<input class="input" name="email" type="email" autocomplete="email" required></label>
      <label class="field">Password<input class="input" name="password" type="password" autocomplete="current-password" required></label>
      <div id="loginErr"></div>
      <button class="btn block" type="submit">Sign in</button>
      <span class="small muted" style="text-align:center">Same email and password as before. Forgotten it? Your owner can reset it for you.</span>
    </form>
    <div class="small" style="text-align:center;color:var(--soft)">New start? Open the invite link your owner sent you.<br><a href="#/create" style="color:#fff">Setting up a new office?</a></div>
  </div>`);
  document.getElementById('loginForm').onsubmit = async e => {
    e.preventDefault(); const f = new FormData(e.target);
    try { const r = await api('login', { email: f.get('email'), password: f.get('password') }); signedIn(r); }
    catch (err) { document.getElementById('loginErr').innerHTML = `<div class="err">${esc(err.message)}</div>`; }
  };
};
ROUTES.join = async (token) => {
  let office;
  try { office = (await api('invite/' + encodeURIComponent(token))).office; }
  catch (e) { page(`<div class="login">${brandTop()}<div class="loginbox"><span class="h2">Invite link</span><div class="err">${esc(e.message)}</div><a class="btn" href="#/login">Go to sign in</a></div></div>`); return; }
  page(`<div class="login">${brandTop()}
    ${aceBubble("G'day, I'm Ace. Set up your login and I'll see you on Day 1.")}
    <form class="loginbox" id="joinForm">
      <div class="col" style="gap:0"><span class="small muted">You're joining</span><span class="h2">${esc(office)}</span></div>
      <label class="field">Your name<input class="input" name="name" autocomplete="name" required maxlength="60"></label>
      <label class="field">Email<input class="input" name="email" type="email" autocomplete="email" required></label>
      <label class="field">Choose a password<input class="input" name="password" type="password" autocomplete="new-password" minlength="6" required></label>
      <div id="joinErr"></div>
      <button class="btn block orange" type="submit">Join ${esc(office)}</button>
      <span class="small muted" style="text-align:center">Your owner gives you your role and team once you're in.</span>
    </form>
    <div class="small" style="text-align:center"><a href="#/login" style="color:#fff">Already have a login? Sign in</a></div></div>`);
  document.getElementById('joinForm').onsubmit = async e => {
    e.preventDefault(); const f = new FormData(e.target);
    try { const r = await api('join', { token, name: f.get('name'), email: f.get('email'), password: f.get('password') }); history.replaceState(null, '', '/'); signedIn(r); }
    catch (err) { document.getElementById('joinErr').innerHTML = `<div class="err">${esc(err.message)}</div>`; }
  };
};
ROUTES.create = () => {
  page(`<div class="login">${brandTop()}
    <form class="loginbox" id="createForm">
      <span class="h2">Set up a new office</span>
      <span class="small muted">For office owners only. Your team joins through the invite link you'll get next.</span>
      <label class="field">Office name<input class="input" name="office" required maxlength="60"></label>
      <label class="field">Your name<input class="input" name="name" required maxlength="60"></label>
      <label class="field">Email<input class="input" name="email" type="email" required></label>
      <label class="field">Password<input class="input" name="password" type="password" minlength="6" required></label>
      <div id="createErr"></div>
      <button class="btn block" type="submit">Create office</button>
    </form>
    <div class="small" style="text-align:center"><a href="#/login" style="color:#fff">Back to sign in</a></div></div>`);
  document.getElementById('createForm').onsubmit = async e => {
    e.preventDefault(); const f = new FormData(e.target);
    try { signedIn(await api('register-office', Object.fromEntries(f))); go('#/office'); }
    catch (err) { document.getElementById('createErr').innerHTML = `<div class="err">${esc(err.message)}</div>`; }
  };
};
function signedIn(r) { S.me = r.user; S.office = r.office; S.mine = null; S.tree = null; S.cache = {}; go('#/today'); }
function pendingScreen() {
  page(`<div class="login">${brandTop()}
    ${aceBubble(`You're in, ${esc(firstName(S.me.name))}. Your owner just needs to place you on a team — then your Day 1 opens right here.`)}
    <div class="loginbox"><span class="h2">Waiting for your owner</span><span class="small muted">${esc(S.office.name)}</span>
      <button class="btn block" id="chk">Check again</button><button class="btn block ghost" id="out">Sign out</button></div></div>`);
  document.getElementById('chk').onclick = async () => { const r = await api('me'); S.me = r.user; route(); };
  document.getElementById('out').onclick = signOut;
}
async function signOut() { try { await api('logout', {}); } catch (e) {} S.me = null; S.mine = null; S.tree = null; S.cache = {}; go('#/login'); }

/* ---------------- account ---------------- */
ROUTES.settings = () => {
  page(header({ title: esc(S.me.name), eyebrow: esc(rankOf(S.me.rank).label) + ' · ' + esc(S.office.name), back: '#/today', noMe: true }) + `
    <div class="body">
      ${isOwner() ? `<a class="card navcard tap" href="#/office"><div class="ic" style="background:var(--orange-bg);color:var(--orange-d)">HQ</div><div class="col grow"><span class="h2">Office settings</span><span class="small muted">Invite link, office name, bonus tiers</span></div>${ICON.chev}</a>
      <a class="card navcard tap" href="#/people"><div class="ic" style="background:var(--sky-bg);color:var(--sky-d)">+</div><div class="col grow"><span class="h2">People &amp; roles</span><span class="small muted">Place new starts, promote, move, reset passwords</span></div>${ICON.chev}</a>` : ''}
      <form class="card" id="pwForm"><span class="label">Change password</span>
        <label class="field">Current password<input class="input" type="password" name="current" autocomplete="current-password" required></label>
        <label class="field">New password<input class="input" type="password" name="next" minlength="6" autocomplete="new-password" required></label>
        <button class="btn sm" type="submit">Update password</button></form>
      <button class="btn ghost block" id="out">Sign out</button>
    </div>`);
  document.getElementById('out').onclick = signOut;
  document.getElementById('pwForm').onsubmit = async e => {
    e.preventDefault(); const f = new FormData(e.target);
    try { await api('password', { current: f.get('current'), next: f.get('next') }); toast('Password updated'); e.target.reset(); } catch (err) { fail(err); }
  };
};

/* ---------------- meeting reviews (quiz) ---------------- */
function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
ROUTES.quiz = async (id) => {
  const rv = S.C.reviews[id]; if (!rv) return go('#/journey');
  if (!S.quiz || S.quiz.id !== id) {
    S.quiz = { id, i: 0, right: 0, picked: null, qs: rv.questions.map(q => ({ ...q, order: shuffle([0, 1, 2, 3]) })) };
  }
  const Q = S.quiz;
  if (Q.i >= Q.qs.length) {
    const pct = Q.right / Q.qs.length, passed = pct >= rv.pass;
    if (!Q.saved) { Q.saved = true; try { const r = await api('result', { review: id, score: Q.right, total: Q.qs.length }); if (S.mine) S.mine.passed = r.passed; } catch (e) { fail(e); } }
    page(header({ title: esc(rv.title), eyebrow: esc(rv.book) + ' · Review', back: '#/journey' }) + `<div class="body">
      <div class="card" style="align-items:center;text-align:center;padding:26px 16px">
        <span class="label">Your score</span><span style="font-family:var(--cond);font-weight:800;font-size:56px;line-height:1;color:${passed ? 'var(--green)' : 'var(--orange-d)'}">${Q.right}/${Q.qs.length}</span>
        <span class="h2">${passed ? 'Passed — nice work.' : 'Not quite — ' + Math.round(rv.pass * 100) + '% to pass.'}</span>
      </div>
      ${aceBubble(passed ? 'That one is locked in on your Journey. Talk the questions you missed through with your leader.' : 'Go back through the questions you missed with your leader, then have another go. Your best score is the one that counts.', { cls: 'light' })}
      <button class="btn block" id="again">Try again</button><a class="btn ghost block" href="#/journey">Back to Journey</a></div>`);
    document.getElementById('again').onclick = () => { S.quiz = null; route(); };
    return;
  }
  const q = Q.qs[Q.i];
  const opts = q.order.map(ix => {
    let cls = ''; if (Q.picked !== null) { if (ix === q.a) cls = 'right'; else if (ix === Q.picked) cls = 'wrong'; }
    return `<button class="qopt ${cls}" data-ix="${ix}" ${Q.picked !== null ? 'disabled' : ''}>${esc(q.o[ix])}</button>`;
  }).join('');
  page(header({ title: esc(rv.title), eyebrow: 'Question ' + (Q.i + 1) + ' of ' + Q.qs.length, back: '#/journey',
    extra: `<div class="segs">${Q.qs.map((_, i) => `<i class="${i < Q.i ? 'done' : i === Q.i ? 'now' : ''}"></i>`).join('')}</div>` }) + `
    <div class="body"><div class="h2" style="font-size:21px;line-height:1.25">${esc(q.q)}</div><div class="col" style="gap:9px">${opts}</div>
    ${Q.picked !== null ? `<div class="card"><span class="label" style="color:${Q.picked === q.a ? 'var(--green)' : 'var(--orange-d)'}">${Q.picked === q.a ? 'That\'s it' : 'Not quite'}</span><span class="small" style="line-height:1.5">${esc(q.w)}</span></div>
    <button class="btn block orange" id="next">${Q.i + 1 === Q.qs.length ? 'See my score' : 'Next question'}</button>` : ''}</div>`);
  document.querySelectorAll('.qopt').forEach(b => b.onclick = () => { Q.picked = +b.dataset.ix; if (Q.picked === q.a) Q.right++; route(); });
  const nx = document.getElementById('next'); if (nx) nx.onclick = () => { Q.i++; Q.picked = null; route(); };
};

/* ---------------- book checklist (shared view) ---------------- */
function checklistHtml(key, p, coachMode) {
  const c = S.C.checklists[key];
  const ids = Object.keys(p.checks || {}).filter(k => k.startsWith(key + '-'));
  const done = ids.filter(k => p.checks[k].done).length;
  const ticked = ids.filter(k => p.checks[k].self || p.checks[k].done).length;
  const selfScore = key === 'cadet';
  let h = `<div class="card dark"><span class="eyebrow">${esc(c.name)}</span><div class="row between"><span class="h2">${ticked} of ${c.count} ticked off</span><span class="small" style="color:var(--lime)">${done} signed</span></div>
    <div class="bar" style="background:var(--navy3)"><i style="width:${Math.round(ticked / c.count * 100)}%;background:var(--lime)"></i></div><span class="small" style="color:#D9DFEA;line-height:1.4">${coachMode ? 'They tick items off as they go — you sign each one once it\'s a habit.' : 'Tick each one off as you do it. Your leader signs it once it\'s a habit.'} ${esc(c.note)}</span></div>`;
  for (const s of c.sections) {
    h += `<div class="card"><span class="label">${esc(s.title)}</span>`;
    for (const it of s.items) {
      const st = (p.checks || {})[it.id] || {};
      const right = coachMode
        ? `${st.self && !st.done ? '<span class="pill s">Ticked</span>' : ''}<button class="tick ${st.done ? 'on' : ''}" data-check="${it.id}" data-done="${st.done ? 0 : 1}" aria-label="${st.done ? 'Remove sign-off' : 'Sign off'}">${st.done ? ICON.tick : ''}</button>`
        : (st.done ? `<span class="pill g">Signed</span>` : `<button class="tick ${st.self ? 'on' : ''}" data-selfcheck="${it.id}" data-done="${st.self ? 0 : 1}" aria-label="${st.self ? 'Untick' : 'Tick off'}">${st.self ? ICON.tick : ''}</button>`);
      const score = selfScore ? (coachMode ? (st.score ? `<span class="pill s">Self ${st.score}/10</span>` : '')
        : `<select class="input" style="width:auto;min-height:36px;padding:4px 8px;font-size:13px" data-score="${it.id}" aria-label="Self score out of ten"><option value="">Self /10</option>${[1,2,3,4,5,6,7,8,9,10].map(n => `<option ${st.score === n ? 'selected' : ''}>${n}</option>`).join('')}</select>`) : '';
      h += `<div class="row" style="padding:7px 0;border-bottom:1px solid #EEF0F4;align-items:flex-start"><div class="col grow"><span style="font-size:14px;line-height:1.35">${esc(it.text)}</span>${st.done ? `<span class="tiny muted">Signed by ${esc(st.by || '')} · ${st.at ? fmtWhen(st.at) : ''}</span>` : ''}</div>${score}${right}</div>`;
    }
    h += '</div>';
  }
  return h;
}
ROUTES.checklist = async (key) => {
  const p = await loadMine(); const c = S.C.checklists[key]; if (!c) return go('#/journey');
  page(header({ title: esc(c.name), eyebrow: esc((S.C.ranks.find(r => r.bookKey === key) || {}).book || ''), back: '#/journey' }) + `<div class="body">${checklistHtml(key, p, false)}</div>`, { keepScroll: true });
  document.querySelectorAll('[data-selfcheck]').forEach(b => b.onclick = async () => {
    try { S.mine = await api('selfcheck', { item: b.dataset.selfcheck, done: b.dataset.done === '1' }); route(); } catch (e) { fail(e); }
  });
  document.querySelectorAll('[data-score]').forEach(sel => sel.onchange = async () => {
    try { S.mine = await api('selfscore', { item: sel.dataset.score, score: sel.value ? +sel.value : null }); toast('Saved'); } catch (e) { fail(e); }
  });
  document.querySelectorAll('[data-check]').forEach(b => b.onclick = async () => {
    try { S.mine = await api('person/' + S.me.id + '/check', { item: b.dataset.check, done: b.dataset.done === '1' }); route(); } catch (e) { fail(e); }
  });
};

/* ---------------- boot ---------------- */
(async function boot() {
  try { S.C = await api('content'); } catch (e) { $app().innerHTML = '<div class="login"><div class="brand">GROWTH<br><span>ACADEMY</span></div><div>Can\'t reach the app right now — check your connection and refresh.</div></div>'; return; }
  const m = location.pathname.match(/^\/join\/([A-Za-z0-9_-]+)/);
  try { const r = await api('me'); S.me = r.user; S.office = r.office; } catch (e) {}
  if (m) { if (S.me) { history.replaceState(null, '', '/'); } else { location.hash = '#/join/' + m[1]; history.replaceState(null, '', '/' + location.hash); } }
  route();
})();
