/* ===================================================================
   Growth Academy — Ace
   Node + Express with a JSON datastore on the persistent disk.
   Everyone sees their own family tree; the Owner sees the whole office.
   =================================================================== */
const express = require('express');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const KPI = require('./lib/kpi');
const { migrate } = require('./lib/migrate');

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'CHANGE-ME-dev-only-secret';
const PROD = process.env.NODE_ENV === 'production';
const ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '10', 10);
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'data.json');
const TZ = process.env.OFFICE_TZ || 'Australia/Brisbane';
const CONTENT = require('./content/academy.json');

if (PROD && JWT_SECRET === 'CHANGE-ME-dev-only-secret') console.warn('[WARN] Set a strong JWT_SECRET env var in production.');

/* ----------------------- datastore ----------------------- */
let DATA = { schema: 4, companies: [], users: [], results: [], approvals: [], companion: [], teams: [], skills: [], fieldlog: [], reviews: [], focus: [], handover: [], checks: [], seq: 0 };
function loadDB() {
  if (!fs.existsSync(DB_PATH)) return;
  DATA = JSON.parse(fs.readFileSync(DB_PATH, 'utf8')); // a corrupt file stops the boot rather than starting empty
}
function saveDB() {
  const tmp = DB_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(DATA));
  fs.renameSync(tmp, DB_PATH);
}
loadDB();
const mig = migrate(DATA, { dbPath: DB_PATH, tz: TZ });
if (mig.migrated) { saveDB(); console.log('[Ace] Upgraded existing data:', JSON.stringify(mig.report)); }
const nextId = () => (++DATA.seq);

/* ----------------------- helpers ----------------------- */
const RANK_IDS = CONTENT.ranks.map(r => r.id);
const rankIndex = r => RANK_IDS.indexOf(r);
const clean = s => (typeof s === 'string' ? s.trim() : '');
const okEmail = e => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e);
const isoDate = s => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s));
const todayLocal = () => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const newToken = () => crypto.randomBytes(16).toString('base64url');
const tempPassword = () => { const a = 'abcdefghjkmnpqrstuvwxyz23456789'; let s = ''; for (let i = 0; i < 8; i++) s += a[crypto.randomInt(a.length)]; return s; };

const companyById = id => DATA.companies.find(c => c.id === id);
const userById = id => DATA.users.find(u => u.id === id);
const userByEmail = em => DATA.users.find(u => u.email === em);
const officeUsers = cid => DATA.users.filter(u => u.company_id === cid && !u.archived);

function childrenOf(uid, cid) { return DATA.users.filter(u => u.company_id === cid && u.parent_id === uid && !u.archived && u.status === 'active'); }
function descendants(user) {
  const out = []; const seen = new Set([user.id]); const stack = [user.id];
  while (stack.length) {
    const id = stack.pop();
    for (const c of childrenOf(id, user.company_id)) if (!seen.has(c.id)) { seen.add(c.id); out.push(c); stack.push(c.id); }
  }
  return out;
}
function isAncestor(actor, target) {
  let cur = target, guard = 0;
  while (cur && cur.parent_id && guard++ < 500) {
    if (cur.parent_id === actor.id) return true;
    cur = userById(cur.parent_id);
  }
  return false;
}
/* Can actor see / coach target? Owner sees the office; everyone else sees their own tree. */
function canSee(actor, target) {
  if (!target || target.archived || target.company_id !== actor.company_id) return false;
  if (actor.rank === 'owner') return true;
  if (target.id === actor.id) return true;
  return isAncestor(actor, target);
}
function canCoach(actor, target) { return canSee(actor, target) && (target.id !== actor.id || actor.rank === 'owner'); }

function inMonthOne(user, onDate) {
  const signed = DATA.reviews.find(r => r.user_id === user.id && r.which === 'month1' && r.signed_by);
  if (signed) return false;
  const start = Date.parse((user.start_date || todayLocal()) + 'T00:00:00Z');
  const d = Date.parse((onDate || todayLocal()) + 'T00:00:00Z');
  return (d - start) / 86400000 < 31;
}
function passedMap(uid) {
  const m = {};
  for (const r of DATA.results) if (r.user_id === uid && r.total > 0 && r.score / r.total >= 0.75) m[r.quiz_id] = { score: r.score, total: r.total };
  return m;
}

/* ----------------------- session ----------------------- */
function setSession(res, user) {
  const t = jwt.sign({ uid: user.id }, JWT_SECRET, { expiresIn: '60d' });
  res.cookie('gr_token', t, { httpOnly: true, sameSite: 'lax', secure: PROD, maxAge: 60 * 24 * 3600 * 1000 });
}
function authReq(req, res, next) {
  const t = req.cookies && req.cookies.gr_token;
  if (!t) return res.status(401).json({ error: 'auth' });
  try {
    const d = jwt.verify(t, JWT_SECRET);
    const u = userById(d.uid);
    if (!u || u.archived) return res.status(401).json({ error: 'auth' });
    req.user = u; next();
  } catch (e) { return res.status(401).json({ error: 'auth' }); }
}
const activeOnly = (req, res, next) => req.user.status === 'active' ? next() : res.status(403).json({ error: 'Your owner needs to place you on a team first.' });
const ownerOnly = (req, res, next) => req.user.rank === 'owner' ? next() : res.status(403).json({ error: 'Owner only.' });
function targetFromParam(req, res) {
  const t = userById(parseInt(req.params.id, 10));
  if (!t || !canSee(req.user, t)) { res.status(404).json({ error: 'Not in your tree.' }); return null; }
  return t;
}

const attempts = new Map();
function throttle(req, res, next) {
  const k = req.ip; const now = Date.now();
  const a = (attempts.get(k) || []).filter(t => now - t < 60000);
  if (a.length >= 12) return res.status(429).json({ error: 'Too many attempts — wait a minute and try again.' });
  a.push(now); attempts.set(k, a); next();
}

function publicUser(u) {
  return { id: u.id, name: u.name, email: u.email, rank: u.rank, parentId: u.parent_id, status: u.status, needsRank: !!u.needs_rank, startDate: u.start_date, programDone: !!u.program_done };
}
function mePayload(u) {
  const c = companyById(u.company_id) || {};
  return { user: publicUser(u), office: { id: c.id, name: c.name }, contentVersion: CONTENT.version };
}

/* ----------------------- app ----------------------- */
const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '200kb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public'), { index: 'index.html' }));

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.get('/api/content', (req, res) => res.json(CONTENT));

/* ---- auth ---- */
app.post('/api/login', throttle, (req, res) => {
  const email = clean(req.body.email).toLowerCase(), password = req.body.password || '';
  const u = userByEmail(email);
  if (!u || u.archived || !bcrypt.compareSync(password, u.pass_hash)) return res.status(401).json({ error: 'Wrong email or password.' });
  setSession(res, u); res.json(mePayload(u));
});
app.post('/api/logout', (req, res) => { res.clearCookie('gr_token'); res.json({ ok: true }); });
app.get('/api/me', authReq, (req, res) => res.json(mePayload(req.user)));

app.get('/api/invite/:token', (req, res) => {
  const c = DATA.companies.find(x => x.invite_token === req.params.token);
  if (!c) return res.status(404).json({ error: 'That invite link is no longer valid. Ask your owner for the current one.' });
  res.json({ office: c.name });
});
app.post('/api/join', throttle, (req, res) => {
  const c = DATA.companies.find(x => x.invite_token === clean(req.body.token));
  if (!c) return res.status(404).json({ error: 'That invite link is no longer valid. Ask your owner for the current one.' });
  const name = clean(req.body.name), email = clean(req.body.email).toLowerCase(), password = req.body.password || '';
  if (!name || name.length > 60 || !okEmail(email) || password.length < 6) return res.status(400).json({ error: 'Add your name, email and a password of 6+ characters.' });
  if (userByEmail(email)) return res.status(409).json({ error: 'That email already has an account — sign in instead.' });
  const u = { id: nextId(), company_id: c.id, name, email, pass_hash: bcrypt.hashSync(password, ROUNDS), rank: 'rep', parent_id: null, status: 'pending', start_date: null, created_at: Date.now() };
  DATA.users.push(u); saveDB();
  setSession(res, u); res.json(mePayload(u));
});
app.post('/api/register-office', throttle, (req, res) => {
  const office = clean(req.body.office), name = clean(req.body.name), email = clean(req.body.email).toLowerCase(), password = req.body.password || '';
  if (!office || !name || !okEmail(email) || password.length < 6) return res.status(400).json({ error: 'Complete every field (password 6+ characters).' });
  if (userByEmail(email)) return res.status(409).json({ error: 'That email already has an account.' });
  const c = { id: nextId(), name: office, invite_token: newToken(), bonus_tiers: {}, created_at: Date.now() };
  DATA.companies.push(c);
  const u = { id: nextId(), company_id: c.id, name, email, pass_hash: bcrypt.hashSync(password, ROUNDS), rank: 'owner', parent_id: null, status: 'active', start_date: todayLocal(), created_at: Date.now() };
  DATA.users.push(u); saveDB();
  setSession(res, u); res.json(mePayload(u));
});
app.post('/api/password', authReq, (req, res) => {
  const cur = req.body.current || '', next = req.body.next || '';
  if (!bcrypt.compareSync(cur, req.user.pass_hash)) return res.status(400).json({ error: 'Your current password is not right.' });
  if (next.length < 6) return res.status(400).json({ error: 'New password needs 6+ characters.' });
  req.user.pass_hash = bcrypt.hashSync(next, ROUNDS); req.user.temp_password = false; saveDB();
  res.json({ ok: true });
});

/* ---- my own record ---- */
function cleanKpis(k) {
  if (!k || typeof k !== 'object') return null;
  const out = {};
  for (const key of KPI.KPI_KEYS) {
    let v = k[key];
    if (v === '' || v === undefined || v === null) { out[key] = null; continue; }
    v = Number(v);
    if (isNaN(v) || v < 0) return null;
    if (key === 'hours' && v > 24) return null;
    if (key === 'retail' && v > 100000) return null;
    if (key !== 'hours' && key !== 'retail' && (v > 2000 || !Number.isInteger(v))) return null;
    out[key] = v;
  }
  if (out.cardSales !== null && out.sales !== null && out.cardSales > out.sales) return null;
  return out;
}
function personPayload(u, viewer) {
  const self = viewer.id === u.id;
  const comp = {}; for (const r of DATA.companion) if (r.user_id === u.id) comp[r.key] = true;
  const skills = {}; for (const r of DATA.skills) if (r.user_id === u.id) skills[r.key] = { rating: r.rating || null, hist: r.hist || [] };
  const checks = {}; for (const r of DATA.checks) if (r.user_id === u.id) checks[r.item] = { done: !!r.done_by, score: r.score || null, by: r.done_by_name || null, at: r.done_at || null, self: !!r.self_done, selfAt: r.self_at || null };
  return {
    user: publicUser(u),
    parentName: u.parent_id ? (userById(u.parent_id) || {}).name || null : null,
    rows: DATA.fieldlog.filter(r => r.user_id === u.id),
    reviews: DATA.reviews.filter(r => r.user_id === u.id),
    focus: DATA.focus.filter(r => r.user_id === u.id).sort((a, b) => a.set_at - b.set_at),
    handover: DATA.handover.filter(r => r.user_id === u.id).sort((a, b) => a.at - b.at),
    passed: passedMap(u.id), companion: comp, skills, checks,
    pay: u.pay || null, plan: u.plan || null,
    bonusTiers: ((companyById(u.company_id) || {}).bonus_tiers || {})[u.rank] || [],
    monthOne: inMonthOne(u), canCoach: canCoach(viewer, u), self
  };
}
app.get('/api/mine', authReq, activeOnly, (req, res) => res.json(personPayload(req.user, req.user)));

app.post('/api/mylog', authReq, activeOnly, (req, res) => {
  const u = req.user;
  const kind = clean(req.body.kind);
  if (!['training', 'production', 'daily'].includes(kind)) return res.status(400).json({ error: 'bad kind' });
  const date = clean(req.body.date);
  if (!isoDate(date)) return res.status(400).json({ error: 'bad date' });
  const kpis = cleanKpis(req.body.kpis);
  if (!kpis) return res.status(400).json({ error: 'Check your numbers — card sales can\'t be more than sales, and counts are whole numbers.' });
  let dayNo = null;
  if (kind === 'training') {
    dayNo = parseInt(req.body.dayNo, 10);
    if (!Number.isInteger(dayNo) || dayNo < 1 || dayNo > 10) return res.status(400).json({ error: 'bad day' });
    const signed = DATA.reviews.find(r => r.user_id === u.id && r.which === (dayNo <= 5 ? 'day5' : 'day10') && r.signed_by);
    if (signed) return res.status(403).json({ error: 'That day has been reviewed and signed off — ask your trainer to unlock it.' });
    const clash = DATA.fieldlog.find(r => r.user_id === u.id && r.date === date && !(r.kind === 'training' && r.dayNo === dayNo));
    if (clash) return res.status(409).json({ error: 'You already have a log for that date.' });
  }
  const missions = Array.isArray(req.body.missions) ? req.body.missions.slice(0, 8).map(x => !!x) : [];
  const answers = Array.isArray(req.body.answers) ? req.body.answers.slice(0, 6).map(a => clean(a).slice(0, 2000)) : [];
  const objections = clean(req.body.objections).slice(0, 2000);
  const objTags = Array.isArray(req.body.objTags) ? req.body.objTags.filter(t => CONTENT.objections.includes(t)).slice(0, 6) : [];
  const sent = !!req.body.sent;
  let rec = kind === 'training'
    ? DATA.fieldlog.find(r => r.user_id === u.id && r.kind === 'training' && r.dayNo === dayNo)
    : DATA.fieldlog.find(r => r.user_id === u.id && r.kind !== 'training' && r.date === date);
  if (!rec) {
    rec = { id: nextId(), user_id: u.id, company_id: u.company_id, kind, dayNo, date };
    DATA.fieldlog.push(rec);
  }
  Object.assign(rec, { kind, date, kpis, missions, answers, objections, objTags, saved_at: Date.now() });
  if (sent && !rec.sent_at) rec.sent_at = Date.now();
  saveDB();
  res.json(personPayload(u, u));
});
app.post('/api/myreview', authReq, activeOnly, (req, res) => {
  const which = clean(req.body.which);
  if (!['day5', 'day10', 'month1'].includes(which)) return res.status(400).json({ error: 'bad review' });
  const answers = Array.isArray(req.body.answers) ? req.body.answers.slice(0, 12).map(a => clean(a).slice(0, 2000)) : [];
  let rec = DATA.reviews.find(r => r.user_id === req.user.id && r.which === which);
  if (rec && rec.signed_by) return res.status(403).json({ error: 'This review is signed off.' });
  if (!rec) { rec = { id: nextId(), user_id: req.user.id, which }; DATA.reviews.push(rec); }
  rec.answers = answers; rec.updated_at = Date.now(); saveDB();
  res.json(personPayload(req.user, req.user));
});
app.post('/api/result', authReq, activeOnly, (req, res) => {
  const id = clean(req.body.review);
  const score = parseInt(req.body.score, 10), total = parseInt(req.body.total, 10);
  if (!CONTENT.reviews[id] || isNaN(score) || isNaN(total) || total <= 0 || score < 0 || score > total) return res.status(400).json({ error: 'bad result' });
  const prev = DATA.results.find(r => r.user_id === req.user.id && r.quiz_id === id);
  if (!prev) DATA.results.push({ user_id: req.user.id, quiz_id: id, score, total, updated_at: Date.now() });
  else if (score / total > prev.score / prev.total) Object.assign(prev, { score, total, updated_at: Date.now() });
  saveDB();
  res.json({ passed: passedMap(req.user.id) });
});
app.post('/api/myplan', authReq, activeOnly, (req, res) => {
  const p = req.body.pay || {}, pl = req.body.plan || {};
  const num = (v, max) => { v = Number(v); return isNaN(v) || v < 0 ? 0 : Math.min(v, max); };
  req.user.pay = { rate: num(p.rate, 500), hours: num(p.hours, 80) };
  const exp = Array.isArray(pl.expenses) ? pl.expenses.slice(0, 12).map(e => ({ label: clean(e.label).slice(0, 40) || 'Other', value: num(e.value, 100000) })) : [];
  req.user.plan = { expenses: exp, goal: num(pl.goal, 10000000), weeks: Math.max(1, Math.round(num(pl.weeks, 520))), goalName: clean(pl.goalName).slice(0, 60) };
  saveDB(); res.json({ ok: true, pay: req.user.pay, plan: req.user.plan });
});
/* A person ticks their own checklist items as they go; their leader signs to confirm. */
app.post('/api/selfcheck', authReq, activeOnly, (req, res) => {
  const item = clean(req.body.item); const [bk, n] = item.split('-');
  if (!CONTENT.checklists[bk] || !(parseInt(n, 10) >= 1 && parseInt(n, 10) <= CONTENT.checklists[bk].count)) return res.status(400).json({ error: 'bad item' });
  let rec = DATA.checks.find(r => r.user_id === req.user.id && r.item === item);
  if (!rec) { rec = { user_id: req.user.id, item }; DATA.checks.push(rec); }
  rec.self_done = !!req.body.done; rec.self_at = rec.self_done ? Date.now() : null;
  saveDB(); res.json(personPayload(req.user, req.user));
});
app.post('/api/selfscore', authReq, activeOnly, (req, res) => {
  const item = clean(req.body.item); const score = req.body.score === null ? null : parseInt(req.body.score, 10);
  if (!/^[a-z]+-\d+$/.test(item) || (score !== null && (isNaN(score) || score < 1 || score > 10))) return res.status(400).json({ error: 'bad score' });
  let rec = DATA.checks.find(r => r.user_id === req.user.id && r.item === item);
  if (!rec) { rec = { user_id: req.user.id, item }; DATA.checks.push(rec); }
  rec.score = score; saveDB();
  res.json(personPayload(req.user, req.user));
});

/* ---- my tree ---- */
function personSummary(u) {
  const rows = DATA.fieldlog.filter(r => r.user_id === u.id);
  const today = todayLocal();
  const week = KPI.isoWeek(today);
  const weekRows = rows.filter(r => KPI.isoWeek(r.date) === week);
  const lastWeekRows = rows.filter(r => KPI.isoWeek(r.date) === KPI.isoWeek(new Date(Date.parse(today) - 7 * 86400000).toISOString().slice(0, 10)));
  const monthOne = inMonthOne(u);
  const r = KPI.ratios(KPI.sumKpis(weekRows));
  const lf = KPI.limitingFactor(CONTENT.lights, CONTENT.cheatSheet.funnel_order, r, monthOne);
  const trainRows = rows.filter(x => x.kind === 'training');
  const reviews = DATA.reviews.filter(x => x.user_id === u.id);
  const ticked = k => DATA.companion.some(c => c.user_id === u.id && c.key === k);
  const flags = [];
  for (const t of trainRows) if (t.sent_at && !ticked('v3:d' + t.dayNo + ':eod')) { flags.push({ type: 'debrief', label: 'Debrief Day ' + t.dayNo }); break; }
  const days = n => trainRows.filter(t => t.dayNo <= n).length;
  const rv = w => reviews.find(x => x.which === w);
  if (days(5) >= 5 && !(rv('day5') || {}).signed_by) flags.push({ type: 'review', label: 'Day 5 review to sign' });
  if (trainRows.length >= 10 && !(rv('day10') || {}).signed_by) flags.push({ type: 'review', label: 'Day 10 review to sign' });
  if (rv('month1') && (rv('month1').answers || []).some(a => a) && !rv('month1').signed_by) flags.push({ type: 'review', label: 'Month 1 review to sign' });
  if (lf && weekRows.length) flags.push({ type: KPI.light(CONTENT.lights, lf, r[lf], monthOne) === 'r' ? 'red' : 'amber', label: 'Limiting factor: ' + (CONTENT.cheatSheet.rows.find(x => x.metric === lf) || {}).label, metric: lf });
  const weekSales = KPI.sumKpis(weekRows).sales;
  const bestPrev = Math.max(0, ...Object.values(rows.reduce((m, x) => { if (KPI.isoWeek(x.date) !== week) { const w = KPI.isoWeek(x.date); m[w] = (m[w] || 0) + ((x.kpis || {}).sales || 0); } return m; }, {})));
  if (weekSales > 0 && bestPrev > 0 && weekSales > bestPrev) flags.push({ type: 'win', label: 'New weekly sales PB — ' + weekSales });
  if (!rows.length && u.rank === 'rep' && !u.program_done) flags.push({ type: 'new', label: 'New start — no logs yet' });
  const foc = DATA.focus.filter(x => x.user_id === u.id).sort((a, b) => b.set_at - a.set_at)[0];
  return {
    id: u.id, name: u.name, rank: u.rank, parentId: u.parent_id, startDate: u.start_date, needsRank: !!u.needs_rank, programDone: !!u.program_done,
    trainingDays: trainRows.length, loggedToday: rows.some(x => x.date === today && x.kind === 'training'), lastLog: rows.map(x => x.date).sort().pop() || null,
    week: { sales: weekSales, ratios: r, days: weekRows.length }, lastWeekSales: KPI.sumKpis(lastWeekRows).sales,
    monthOne, limiting: lf, flags, focus: foc ? foc.skill : null,
    teamSize: descendants(u).length
  };
}
app.get('/api/tree', authReq, activeOnly, (req, res) => {
  const me = req.user;
  const people = me.rank === 'owner' ? officeUsers(me.company_id).filter(u => u.status === 'active') : [me, ...descendants(me)];
  res.json({ me: me.id, people: people.map(personSummary) });
});
app.get('/api/person/:id', authReq, activeOnly, (req, res) => {
  const t = targetFromParam(req, res); if (!t) return;
  res.json(personPayload(t, req.user));
});
function coachTarget(req, res) {
  const t = targetFromParam(req, res); if (!t) return null;
  if (!canCoach(req.user, t)) { res.status(403).json({ error: 'You can only sign off people in your tree.' }); return null; }
  return t;
}
app.post('/api/person/:id/tick', authReq, activeOnly, (req, res) => {
  const t = coachTarget(req, res); if (!t) return;
  const key = clean(req.body.key);
  if (!/^v3:d(10|[1-9]):(setup|eod)$/.test(key)) return res.status(400).json({ error: 'bad key' });
  const i = DATA.companion.findIndex(r => r.user_id === t.id && r.key === key);
  if (req.body.done && i === -1) DATA.companion.push({ user_id: t.id, key, done_by: req.user.id, done_at: Date.now() });
  if (!req.body.done && i !== -1) DATA.companion.splice(i, 1);
  saveDB(); res.json(personPayload(t, req.user));
});
app.post('/api/person/:id/skill', authReq, activeOnly, (req, res) => {
  const t = coachTarget(req, res); if (!t) return;
  const key = clean(req.body.key); const v = req.body.rating;
  if (!/^sk-[a-z]+$/.test(key) || (v !== null && (!Number.isInteger(v) || v < 1 || v > 5))) return res.status(400).json({ error: 'bad rating' });
  let rec = DATA.skills.find(r => r.user_id === t.id && r.key === key);
  if (!rec) { rec = { user_id: t.id, key, rating: null, hist: [] }; DATA.skills.push(rec); }
  if (v !== rec.rating) { rec.rating = v; if (v !== null) rec.hist.push([v, Date.now()]); }
  saveDB(); res.json(personPayload(t, req.user));
});
app.post('/api/person/:id/check', authReq, activeOnly, (req, res) => {
  const t = coachTarget(req, res); if (!t) return;
  const item = clean(req.body.item);
  const [bk, n] = item.split('-');
  if (!CONTENT.checklists[bk] || !(parseInt(n, 10) >= 1 && parseInt(n, 10) <= CONTENT.checklists[bk].count)) return res.status(400).json({ error: 'bad item' });
  let rec = DATA.checks.find(r => r.user_id === t.id && r.item === item);
  if (!rec) { rec = { user_id: t.id, item }; DATA.checks.push(rec); }
  if (req.body.done) Object.assign(rec, { done_by: req.user.id, done_by_name: req.user.name, done_at: Date.now() });
  else Object.assign(rec, { done_by: null, done_by_name: null, done_at: null });
  saveDB(); res.json(personPayload(t, req.user));
});
app.post('/api/person/:id/review', authReq, activeOnly, (req, res) => {
  const t = coachTarget(req, res); if (!t) return;
  const which = clean(req.body.which);
  if (!['day5', 'day10', 'month1'].includes(which)) return res.status(400).json({ error: 'bad review' });
  let rec = DATA.reviews.find(r => r.user_id === t.id && r.which === which);
  if (!rec) { rec = { id: nextId(), user_id: t.id, which, answers: [] }; DATA.reviews.push(rec); }
  if (req.body.unsign) { rec.signed_by = null; rec.signed_at = null; }
  else { rec.comments = clean(req.body.comments).slice(0, 2000); rec.signed_by = req.user.id; rec.signed_by_name = req.user.name; rec.signed_at = Date.now(); }
  rec.updated_at = Date.now(); saveDB(); res.json(personPayload(t, req.user));
});
app.post('/api/person/:id/focus', authReq, activeOnly, (req, res) => {
  const t = coachTarget(req, res); if (!t) return;
  const skill = clean(req.body.skill).slice(0, 120), note = clean(req.body.note).slice(0, 1000);
  if (!skill) return res.status(400).json({ error: 'Pick a skill.' });
  DATA.focus.push({ id: nextId(), user_id: t.id, skill, note, set_by: req.user.id, set_by_name: req.user.name, set_at: Date.now() });
  saveDB(); res.json(personPayload(t, req.user));
});
app.post('/api/person/:id/handover', authReq, activeOnly, (req, res) => {
  const t = coachTarget(req, res); if (!t) return;
  const ref = clean(req.body.ref).slice(0, 12), comment = clean(req.body.comment).slice(0, 2000);
  if (!ref || !comment) return res.status(400).json({ error: 'Add a comment.' });
  DATA.handover.push({ id: nextId(), user_id: t.id, ref, comment, by: req.user.id, by_name: req.user.name, at: Date.now() });
  saveDB(); res.json(personPayload(t, req.user));
});

/* ---- owner: people, office ---- */
function validParent(owner, target, parentId) {
  if (parentId === null) return target.rank === 'owner' ? null : 'Everyone except the Owner needs to be on someone\'s team.';
  const p = userById(parentId);
  if (!p || p.company_id !== owner.company_id || p.archived || p.status !== 'active') return 'That person is not in your office.';
  if (p.id === target.id) return 'Someone can\'t be on their own team.';
  if (isAncestor(target, p)) return 'That would put someone under their own team member.';
  if (rankIndex(p.rank) < rankIndex('leader')) return 'Only a Leader or above can have people on their team.';
  return null;
}
app.get('/api/people', authReq, activeOnly, ownerOnly, (req, res) => {
  const all = DATA.users.filter(u => u.company_id === req.user.company_id);
  res.json({
    pending: all.filter(u => u.status === 'pending' && !u.archived).map(publicUser),
    active: all.filter(u => u.status === 'active' && !u.archived).map(u => ({ ...publicUser(u), parentName: u.parent_id ? (userById(u.parent_id) || {}).name : null })),
    removed: all.filter(u => u.archived).map(publicUser)
  });
});
app.post('/api/people/:id', authReq, activeOnly, ownerOnly, (req, res) => {
  const t = userById(parseInt(req.params.id, 10));
  if (!t || t.company_id !== req.user.company_id) return res.status(404).json({ error: 'Not in your office.' });
  const action = clean(req.body.action);
  if (action === 'place' || action === 'update') {
    const rank = clean(req.body.rank);
    if (!RANK_IDS.includes(rank)) return res.status(400).json({ error: 'Pick a role.' });
    if (t.id === req.user.id && rank !== 'owner') return res.status(400).json({ error: 'You can\'t change your own role.' });
    const parentId = req.body.parentId === null || req.body.parentId === undefined ? null : parseInt(req.body.parentId, 10);
    const prev = { rank: t.rank };
    t.rank = rank;
    const err = validParent(req.user, t, parentId);
    if (err) { t.rank = prev.rank; return res.status(400).json({ error: err }); }
    t.parent_id = parentId; t.needs_rank = false;
    if (t.status === 'pending') { t.status = 'active'; t.start_date = todayLocal(); }
    /* anyone left under a rep after a demotion moves up to that person's parent */
    if (rankIndex(rank) < rankIndex('leader')) for (const c of childrenOf(t.id, t.company_id)) c.parent_id = t.parent_id;
  } else if (action === 'program') {
    t.program_done = !req.body.inProgram;
  } else if (action === 'remove') {
    if (t.id === req.user.id) return res.status(400).json({ error: 'You can\'t remove yourself.' });
    for (const c of childrenOf(t.id, t.company_id)) c.parent_id = t.parent_id;
    t.archived = true;
  } else if (action === 'restore') {
    t.archived = false;
    if (t.parent_id && (!userById(t.parent_id) || userById(t.parent_id).archived)) t.parent_id = req.user.id;
  } else if (action === 'reset') {
    const pw = tempPassword();
    t.pass_hash = bcrypt.hashSync(pw, ROUNDS); t.temp_password = true; saveDB();
    return res.json({ ok: true, tempPassword: pw });
  } else return res.status(400).json({ error: 'bad action' });
  saveDB(); res.json({ ok: true });
});
app.get('/api/office', authReq, activeOnly, ownerOnly, (req, res) => {
  const c = companyById(req.user.company_id);
  res.json({ name: c.name, inviteToken: c.invite_token, bonusTiers: c.bonus_tiers || {} });
});
app.post('/api/office', authReq, activeOnly, ownerOnly, (req, res) => {
  const c = companyById(req.user.company_id);
  if (req.body.name !== undefined) { const n = clean(req.body.name); if (!n || n.length > 60) return res.status(400).json({ error: 'Office name needed.' }); c.name = n; }
  if (req.body.rotateInvite) c.invite_token = newToken();
  if (req.body.bonusTiers) {
    const out = {};
    for (const r of RANK_IDS) {
      const list = Array.isArray(req.body.bonusTiers[r]) ? req.body.bonusTiers[r].slice(0, 8) : [];
      out[r] = list.map(t => ({ label: clean(t.label).slice(0, 60), target: clean(t.target).slice(0, 80), amount: Math.max(0, Math.min(100000, Number(t.amount) || 0)) })).filter(t => t.label || t.target || t.amount);
    }
    c.bonus_tiers = out;
  }
  saveDB(); res.json({ name: c.name, inviteToken: c.invite_token, bonusTiers: c.bonus_tiers });
});

/* SPA routes */
app.get(['/join/:token', '/app', '/app/*'], (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

if (require.main === module) app.listen(PORT, () => console.log(`Growth Academy (Ace) running on http://localhost:${PORT}`));
module.exports = { app };
