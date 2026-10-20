/* Growth Academy (Ace) — end-to-end tests.
   Builds a data file in the OLD app's exact format, boots the new server on it,
   and checks the upgrade, sign-in, tree scoping, logging and owner tools.
   Run: node test.js   (uses temporary files, never touches real data) */
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const os = require('os');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const PORT = 4188, BASE = `http://localhost:${PORT}`, SECRET = 'test-secret';
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'ace-test-'));
const DB = path.join(DIR, 'data.json');
let passed = 0, failed = 0;
const ok = (c, name) => { if (c) { passed++; console.log('  ✓ ' + name); } else { failed++; console.log('  ✗ ' + name); } };

/* ---------- old-format fixture (shape of the pack-10 data.json) ---------- */
const h = pw => bcrypt.hashSync(pw, 4);
const T0 = Date.parse('2026-09-01T00:00:00Z');
const day = n => new Date(Date.parse('2026-09-07T12:00:00Z') + n * 86400000).toISOString().slice(0, 10);
const kp = s => ({ hours: 8, stops: 26, presentations: 21, closes: 16, sales: s, retail: s * 42, cardSales: Math.floor(s / 2) });
const OLD = {
  companies: [{ id: 1, name: 'Test Office', join_code: 'ABC234', created_at: T0 }],
  users: [
    { id: 2, company_id: 1, name: 'Dana Owner', email: 'dana@t.com', pass_hash: h('owner1'), role: 'director', team_id: null, created_at: T0 },
    { id: 3, company_id: 1, name: 'Lee Leader', email: 'lee@t.com', pass_hash: h('leader1'), role: 'leader', team_id: 10, created_at: T0 + 1 },
    { id: 4, company_id: 1, name: 'Lou Leader', email: 'lou@t.com', pass_hash: h('leader2'), role: 'leader', team_id: 11, created_at: T0 + 2 },
    { id: 5, company_id: 1, name: 'Casey Rep', email: 'casey@t.com', pass_hash: h('casey1'), role: 'trainee', team_id: 10, created_at: T0 + 3 },
    { id: 6, company_id: 1, name: 'Sam Rep', email: 'sam@t.com', pass_hash: h('sam111'), role: 'trainee', team_id: 11, created_at: T0 + 4 },
    { id: 7, company_id: 1, name: 'Kai Rep', email: 'kai@t.com', pass_hash: h('kai111'), role: 'trainee', team_id: null, created_at: T0 + 5 },
    { id: 8, company_id: 1, name: 'Drew Gone', email: 'drew@t.com', pass_hash: h('drew11'), role: 'trainee', team_id: 10, archived: true, created_at: T0 + 6 }
  ],
  teams: [{ id: 10, company_id: 1, name: 'Alpha' }, { id: 11, company_id: 1, name: 'Beta' }],
  results: [{ user_id: 5, quiz_id: 'p1', score: 12, total: 14, updated_at: T0 }, { user_id: 3, quiz_id: 'p2welcome', score: 10, total: 12, updated_at: T0 }],
  approvals: [{ user_id: 5, phase: 'p2', approved_by: 2, approved_at: T0 }],
  companion: [{ user_id: 5, key: 'v3:d1:setup', done_by: 3, done_at: T0 }],
  skills: [{ user_id: 5, key: 'sk-seec', intro: 1, rating: 3, hist: [[2, T0], [3, T0 + 9]] }],
  fieldlog: [
    ...[1, 2, 3, 4, 5].map(n => ({ id: 20 + n, user_id: 5, company_id: 1, kind: 'training', dayNo: n, date: day(n - 1), kpis: kp(3 + n), missions: [true, true], answers: ['a', 'b', 'c'], objections: 'partner', saved_at: T0 })),
    { id: 30, user_id: 5, company_id: 1, kind: 'production', dayNo: null, date: day(5), kpis: kp(4), missions: [], answers: [], objections: '', saved_at: T0 },
    { id: 31, user_id: 6, company_id: 1, kind: 'daily', dayNo: null, date: day(2), kpis: kp(6), missions: [], answers: [], objections: '', saved_at: T0 }
  ],
  reviews: [{ id: 40, user_id: 5, which: 'day5', answers: ['x', 'y', 'z'], comments: 'Good week', signed_by: 3, signed_at: T0 }],
  focus: [{ id: 41, user_id: 5, skill: 'Objection Handling', note: 'partner', set_by: 3, set_by_name: 'Lee Leader', set_at: T0 }],
  handover: [{ id: 42, user_id: 5, ref: 'd5', comment: 'Work the close', by: 3, by_name: 'Lee Leader', at: T0 }],
  seq: 100
};
fs.writeFileSync(DB, JSON.stringify(OLD));

/* ---------- http with per-user cookie jars ---------- */
const jars = {};
async function call(who, method, p, body, rawCookie) {
  const headers = { 'Content-Type': 'application/json' };
  if (rawCookie) headers.Cookie = rawCookie; else if (jars[who]) headers.Cookie = jars[who];
  const r = await fetch(BASE + p, { method, headers, body: body ? JSON.stringify(body) : undefined });
  const sc = r.headers.get('set-cookie'); if (sc && who) jars[who] = sc.split(';')[0];
  let data = null; const txt = await r.text(); try { data = JSON.parse(txt); } catch (e) { data = txt; }
  return { status: r.status, data };
}
const get = (w, p) => call(w, 'GET', p), post = (w, p, b) => call(w, 'POST', p, b || {});
const login = (w, email, pw) => post(w, '/api/login', { email, password: pw });

function boot() {
  const s = spawn('node', ['server.js'], { cwd: __dirname, env: { ...process.env, PORT: String(PORT), DB_PATH: DB, JWT_SECRET: SECRET, NODE_ENV: 'test' }, stdio: ['ignore', 'pipe', 'pipe'] });
  let out = ''; s.stdout.on('data', d => out += d); s.stderr.on('data', d => out += d);
  s.log = () => out;
  return new Promise(res => { const t = setInterval(async () => { try { await fetch(BASE + '/api/health'); clearInterval(t); res(s); } catch (e) {} }, 100); });
}

(async () => {
  let server = await boot();
  try {
    console.log('\nUpgrade of old data');
    ok(/Upgraded existing data/.test(server.log()), 'server reports the upgrade on first boot');
    const backups = fs.readdirSync(DIR).filter(f => f.includes('backup-before-ace'));
    ok(backups.length === 1, 'a full backup of the old data is written before anything changes');
    const bk = JSON.parse(fs.readFileSync(path.join(DIR, backups[0])));
    ok(bk.users.length === 7 && bk.fieldlog.length === 7 && !bk.schema, 'backup is an exact copy of the old file');
    const NEW = JSON.parse(fs.readFileSync(DB));
    ok(NEW.schema === 4, 'data file is now schema 4');
    ok(NEW.users.length === OLD.users.length, 'same number of people after upgrade');
    ok(NEW.fieldlog.length === OLD.fieldlog.length, 'every field log row kept');
    ok(NEW.reviews.length === OLD.reviews.length && NEW.focus.length === 1 && NEW.handover.length === 1, 'reviews, focus picks and handover notes kept');
    ok(NEW.companion.length === 1 && NEW.skills.length === 1, 'companion ticks and skill ratings kept');
    const U = id => NEW.users.find(u => u.id === id);
    ok(U(2).rank === 'owner' && U(2).parent_id === null, 'director becomes Owner at the top of the tree');
    ok(U(3).rank === 'leader' && U(3).needs_rank === true && U(3).parent_id === 2, 'old leader becomes Leader under the Owner, flagged to confirm rank');
    ok(U(5).rank === 'rep' && U(5).parent_id === 3, 'rep goes under the leader of their old team');
    ok(U(6).parent_id === 4, 'rep on a second team goes under that team\'s leader');
    ok(U(7).parent_id === 2, 'rep with no team goes under the Owner');
    ok(U(8).archived === true, 'removed people stay removed');
    ok(U(5).start_date === day(0), 'start date taken from their first log');
    ok(U(5).program_done === false, 'rep part-way through the 10 days stays in the program');
    ok(U(6).program_done === true && U(7).program_done === true, 'reps already working before the Field Log skip straight past the 10 days');
    ok(NEW.results.find(r => r.user_id === 5).quiz_id === 'levelup', 'old Phase 1 exam pass becomes the Level Up review pass');

    console.log('\nSigning back in');
    let r = await login('casey', 'casey@t.com', 'casey1');
    ok(r.status === 200 && r.data.user.rank === 'rep', 'rep signs in with their existing password');
    r = await login('lee', 'lee@t.com', 'leader1'); ok(r.status === 200, 'leader signs in with their existing password');
    r = await login('dana', 'dana@t.com', 'owner1'); ok(r.status === 200 && r.data.user.rank === 'owner', 'owner signs in with their existing password');
    r = await login('x', 'drew@t.com', 'drew11'); ok(r.status === 401, 'removed person cannot sign in');
    r = await login('x', 'casey@t.com', 'wrong'); ok(r.status === 401, 'wrong password refused');
    const oldCookie = 'gr_token=' + jwt.sign({ uid: 5, cid: 1, role: 'trainee' }, SECRET);
    r = await call(null, 'GET', '/api/me', null, oldCookie);
    ok(r.status === 200 && r.data.user.id === 5, 'someone already signed in on the old app stays signed in');

    console.log('\nTheir history is all there');
    r = await get('casey', '/api/mine');
    ok(r.data.rows.length === 6, 'rep sees all 6 of their old log days');
    ok(r.data.reviews[0].signed_by === 3, 'Day 5 sign-off carried over');
    ok(r.data.passed.levelup && r.data.companion['v3:d1:setup'] && r.data.skills['sk-seec'].rating === 3, 'review pass, companion tick and skill rating carried over');
    ok(r.data.focus[0].skill === 'Objection Handling', 'current focus carried over');

    console.log('\nFamily tree scoping');
    r = await get('lee', '/api/tree');
    ok(r.data.people.map(p => p.id).sort().join() === '3,5', 'a leader sees only themselves and their own people');
    r = await get('lee', '/api/person/6'); ok(r.status === 404, 'a leader cannot open someone outside their tree');
    r = await get('lee', '/api/person/5'); ok(r.status === 200 && r.data.canCoach, 'a leader can open and coach their own rep');
    r = await get('dana', '/api/tree'); ok(r.data.people.length === 6, 'the Owner sees the whole office (removed people excluded)');
    r = await get('casey', '/api/person/6'); ok(r.status === 404, 'a rep cannot open anyone else');
    r = await post('casey', '/api/person/5/tick', { key: 'v3:d2:setup', done: true }); ok(r.status === 403, 'a rep cannot sign off their own companion');
    r = await get('casey', '/api/people'); ok(r.status === 403, 'only the Owner can see People & roles');
    r = await get('lee', '/api/office'); ok(r.status === 403, 'only the Owner can see office settings');
    const t5 = (await get('lee', '/api/tree')).data.people.find(p => p.id === 5);
    ok(t5.flags.some(f => f.label === 'Day 5 review to sign') === false, 'signed Day 5 review is not flagged again');

    console.log('\nDaily logging');
    r = await post('casey', '/api/mylog', { kind: 'training', dayNo: 6, date: day(7), kpis: kp(9), missions: [true], answers: [], objections: '', objTags: ['I need to talk to my partner', 'not a real objection'], sent: true });
    ok(r.status === 200 && r.data.rows.length === 7, 'Day 6 saved');
    const d6 = r.data.rows.find(x => x.dayNo === 6);
    ok(d6.objTags.length === 1 && d6.sent_at, 'objection chips kept (only real ones) and marked as sent');
    r = await post('casey', '/api/mylog', { kind: 'training', dayNo: 6, date: day(7), kpis: kp(10), sent: true });
    ok(r.status === 200 && r.data.rows.filter(x => x.dayNo === 6).length === 1 && r.data.rows.find(x => x.dayNo === 6).kpis.sales === 10, 'tapping again updates the same day, never duplicates');
    r = await post('casey', '/api/mylog', { kind: 'training', dayNo: 7, date: day(7), kpis: kp(1) });
    ok(r.status === 409, 'two training days cannot share a date');
    r = await post('casey', '/api/mylog', { kind: 'training', dayNo: 3, date: day(2), kpis: kp(9) });
    ok(r.status === 403, 'days locked by a signed review cannot be changed');
    r = await post('casey', '/api/mylog', { kind: 'daily', date: day(20), kpis: { hours: 8, stops: 10, presentations: 8, closes: 6, sales: 2, retail: 80, cardSales: 3 } });
    ok(r.status === 400, 'card sales can\'t exceed sales');
    r = await post('casey', '/api/mylog', { kind: 'daily', date: day(20), kpis: { hours: 30, stops: 1, presentations: 1, closes: 1, sales: 1, retail: 10, cardSales: 0 } });
    ok(r.status === 400, 'hours over 24 refused');
    const lt = (await get('lee', '/api/tree')).data.people.find(p => p.id === 5);
    ok(lt.flags.some(f => f.type === 'debrief' && f.label === 'Debrief Day 6'), 'sent day shows as a debrief waiting for the leader');
    r = await post('lee', '/api/person/5/tick', { key: 'v3:d6:eod', done: true });
    ok(r.status === 200 && r.data.companion['v3:d6:eod'], 'leader ticks the end-of-day breakdown');
    ok(!(await get('lee', '/api/tree')).data.people.find(p => p.id === 5).flags.some(f => f.type === 'debrief'), 'debrief flag clears once ticked');
    r = await post('lee', '/api/person/5/focus', { skill: 'Trial closing', note: 'tomorrow' }); ok(r.status === 200 && r.data.focus.length === 2, 'leader sets tomorrow\'s focus');
    r = await post('lee', '/api/person/5/handover', { ref: 'd6', comment: 'Calendar close next' }); ok(r.status === 200, 'leader leaves a handover note');
    r = await post('lee', '/api/person/5/skill', { key: 'sk-seec', rating: 4 }); ok(r.data.skills['sk-seec'].hist.length === 3, 'skill rating history grows');
    r = await post('lee', '/api/person/5/check', { item: 'cadet-1', done: true }); ok(r.data.checks['cadet-1'].done && r.data.checks['cadet-1'].by === 'Lee Leader', 'leader signs a Four Pillars item');
    r = await post('lee', '/api/person/5/check', { item: 'cadet-99', done: true }); ok(r.status === 400, 'unknown checklist items refused');
    r = await post('casey', '/api/selfscore', { item: 'cadet-1', score: 7 }); ok(r.data.checks['cadet-1'].score === 7, 'rep self-scores a Four Pillars item');
    r = await post('casey', '/api/selfcheck', { item: 'cadet-2', done: true }); ok(r.data.checks['cadet-2'].self && !r.data.checks['cadet-2'].done, 'rep ticks off a checklist item themselves');
    r = await get('lee', '/api/person/5'); ok(r.data.checks['cadet-2'].self, 'their leader sees it ticked, ready to sign');
    r = await post('casey', '/api/selfcheck', { item: 'owner-1', done: true }); ok(r.status === 400, 'the Owner book is not in the app');
    r = await post('casey', '/api/myreview', { which: 'month1', answers: ['learned', 'improved'] }); ok(r.status === 200, 'rep saves their Month 1 review');
    r = await post('casey', '/api/myreview', { which: 'day5', answers: ['change'] }); ok(r.status === 403, 'a signed review can\'t be rewritten by the rep');
    r = await post('lee', '/api/person/5/review', { which: 'month1', comments: 'Ready' }); ok(r.data.reviews.find(x => x.which === 'month1').signed_by === 3, 'leader signs Month 1');
    r = await post('casey', '/api/result', { review: 'levelup', score: 13, total: 14 }); ok(r.data.passed.levelup.score === 13, 'a better review score replaces the old one');
    r = await post('casey', '/api/result', { review: 'p1', score: 1, total: 1 }); ok(r.status === 400, 'unknown review id refused');

    console.log('\nOwner tools');
    r = await get('dana', '/api/office'); const token = r.data.inviteToken; ok(token && token.length > 10, 'office has an invite link');
    r = await get(null, '/api/invite/' + token); ok(r.data.office === 'Test Office', 'invite link shows the office name');
    r = await post('newbie', '/api/join', { token, name: 'Nina New', email: 'nina@t.com', password: 'nina11' });
    ok(r.status === 200 && r.data.user.status === 'pending', 'new start joins with the link and waits to be placed');
    const ninaId = r.data.user.id;
    r = await get('newbie', '/api/mine'); ok(r.status === 403, 'a waiting new start can\'t log anything yet');
    r = await post('newbie', '/api/join', { token: 'nope', name: 'X', email: 'x@t.com', password: 'xxxxxx' }); ok(r.status === 404, 'old or wrong invite links are refused');
    r = await get('dana', '/api/people'); ok(r.data.pending.length === 1, 'Owner sees the new start waiting');
    r = await post('dana', '/api/people/' + ninaId, { action: 'place', rank: 'rep', parentId: 5 }); ok(r.status === 400, 'nobody can be placed under a Sales Rep');
    r = await post('dana', '/api/people/' + ninaId, { action: 'place', rank: 'rep', parentId: 3 }); ok(r.status === 200, 'Owner places the new start on Lee\'s team');
    r = await get('newbie', '/api/mine'); ok(r.status === 200 && r.data.user.status === 'active' && r.data.user.startDate, 'new start is active with a start date');
    r = await get('lee', '/api/tree'); ok(r.data.people.some(p => p.id === ninaId), 'new start appears in Lee\'s tree');
    r = await post('dana', '/api/people/3', { action: 'update', rank: 'teamleader', parentId: 2 }); ok(r.status === 200, 'Owner confirms Lee as Team Leader');
    r = await get('dana', '/api/people'); ok(!r.data.active.find(u => u.id === 3).needsRank, 'confirm-rank flag clears');
    r = await post('dana', '/api/people/7', { action: 'program', inProgram: true }); r = await get('dana', '/api/people');
    ok(r.data.active.find(u => u.id === 7).programDone === false, 'Owner can put a rep back into the 10-Day Program');
    r = await post('dana', '/api/people/4', { action: 'update', rank: 'leader', parentId: 3 }); ok(r.status === 200, 'Lou moves onto Lee\'s team');
    r = await get('lee', '/api/tree'); ok(r.data.people.some(p => p.id === 6), 'Lee now sees Lou\'s rep two levels down');
    r = await post('dana', '/api/people/3', { action: 'update', rank: 'teamleader', parentId: 4 }); ok(r.status === 400, 'can\'t put someone under their own team member');
    r = await post('dana', '/api/office', { bonusTiers: { rep: [{ label: 'Tier 1', target: '25 sales', amount: 150 }, { label: '', target: '', amount: 0 }] } });
    ok(r.data.bonusTiers.rep.length === 1, 'bonus tiers saved (blank rows dropped)');
    r = await get('casey', '/api/mine'); ok(r.data.bonusTiers[0].amount === 150, 'reps see their rank\'s bonus tiers');
    r = await post('casey', '/api/myplan', { pay: { rate: 30, hours: 30 }, plan: { expenses: [{ label: 'Rent', value: 200 }], goal: 6000, weeks: 12, goalName: 'Car' } });
    ok(r.data.plan.goalName === 'Car', 'money plan saved');
    r = await get('lee', '/api/person/5'); ok(r.data.pay.rate === 30, 'their leader can see the plan to work it through');
    r = await post('dana', '/api/people/3', { action: 'remove' }); ok(r.status === 200, 'Owner removes someone');
    r = await get('dana', '/api/tree'); ok(r.data.people.find(p => p.id === 5).parentId === 2 && r.data.people.find(p => p.id === 4).parentId === 2, 'their people move up to the next person');
    r = await login('lee2', 'lee@t.com', 'leader1'); ok(r.status === 401, 'removed person can\'t sign in');
    r = await post('dana', '/api/people/3', { action: 'restore' }); ok(r.status === 200, 'Owner restores them');
    r = await post('dana', '/api/people/7', { action: 'reset' }); const temp = r.data.tempPassword;
    r = await login('kai', 'kai@t.com', temp); ok(r.status === 200, 'reset password works');
    r = await post('kai', '/api/password', { current: temp, next: 'kai222' }); ok(r.status === 200, 'they can change it to their own');
    r = await post('dana', '/api/people/2', { action: 'remove' }); ok(r.status === 400, 'Owner can\'t remove themselves');
    r = await post('dana', '/api/office', { rotateInvite: true }); ok(r.data.inviteToken !== token, 'Owner can make a fresh invite link');
    r = await get(null, '/api/invite/' + token); ok(r.status === 404, 'the old link stops working');

    console.log('\nPages load');
    r = await get(null, '/'); ok(typeof r.data === 'string' && r.data.includes('app-core.js'), 'app page served');
    r = await get(null, '/join/abc'); ok(typeof r.data === 'string' && r.data.includes('app-team.js'), 'invite links open the app');
    r = await get(null, '/api/content'); ok(Object.keys(r.data.reviews).length === 6 && r.data.checklists.captain.count === 20 && !r.data.checklists.owner, 'content served: 6 reviews, five book checklists, no Owner book');
    r = await get(null, '/booklets/Phase1_Systems_Workbook.pdf'); ok(r.status === 404, 'booklets are no longer in the app');

    console.log('\nRestart');
    server.kill(); await new Promise(res => setTimeout(res, 300));
    server = await boot();
    ok(!/Upgraded existing data/.test(server.log()), 'second boot does not upgrade again');
    ok(fs.readdirSync(DIR).filter(f => f.includes('backup-before-ace')).length === 1, 'no second backup');
    r = await login('casey2', 'casey@t.com', 'casey1'); ok(r.status === 200, 'still signs in after restart');
    r = await get('casey2', '/api/mine'); ok(r.data.rows.length === 7 && r.data.plan.goalName === 'Car', 'everything saved survives a restart');

    console.log(`\n${passed} passed, ${failed} failed`);
    process.exitCode = failed ? 1 : 0;
  } catch (e) { console.error('Test run crashed:', e); process.exitCode = 1; }
  finally { server.kill(); fs.rmSync(DIR, { recursive: true, force: true }); }
})();
