/* One-off upgrade of the old app's data (schema 1–3) to the Ace app (schema 4).
   Nothing is deleted: old fields stay on the records, a full backup is written first. */
const fs = require('fs');
const crypto = require('crypto');

const QUIZ_MAP = { p1: 'levelup', p2welcome: 'newleader', p2performing: 'performing', p3: 'coaching', p4: 'mentor' };
const token = () => crypto.randomBytes(16).toString('base64url');

function localDate(ms, tz) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
}

function migrate(DATA, { dbPath, tz }) {
  if (DATA.schema === 4) return { migrated: false };
  const report = { backup: null, offices: 0, people: 0, leadersToConfirm: 0, logRows: (DATA.fieldlog || []).length, reviews: (DATA.reviews || []).length };

  if (dbPath && fs.existsSync(dbPath)) {
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backup = dbPath.replace(/\.json$/, '') + '.backup-before-ace-' + stamp + '.json';
    fs.copyFileSync(dbPath, backup);
    report.backup = backup;
  }

  for (const k of ['companies', 'users', 'results', 'approvals', 'companion', 'teams', 'skills', 'fieldlog', 'reviews', 'focus', 'handover'])
    if (!Array.isArray(DATA[k])) DATA[k] = [];
  if (!Array.isArray(DATA.checks)) DATA.checks = [];
  if (typeof DATA.seq !== 'number') DATA.seq = 0;

  for (const c of DATA.companies) {
    if (!c.invite_token) c.invite_token = token();
    if (!c.bonus_tiers) c.bonus_tiers = {};
    report.offices++;
  }

  const owners = {};
  for (const u of DATA.users) {
    if (u.rank) continue;
    if (u.role === 'trainer') u.role = 'director';
    if (u.role === 'director') { u.rank = 'owner'; owners[u.company_id] = owners[u.company_id] || u; }
  }
  for (const u of DATA.users) {
    if (u.rank) continue;
    if (u.role === 'leader') { u.rank = 'leader'; u.needs_rank = true; report.leadersToConfirm++; }
    else u.rank = 'rep';
  }
  /* Family tree from the old teams: reps go under the earliest leader of their team; leaders go under the owner. */
  for (const u of DATA.users) {
    if (u.parent_id !== undefined) continue;
    const owner = owners[u.company_id];
    if (u.rank === 'owner') { u.parent_id = null; continue; }
    let parent = owner || null;
    if (u.rank === 'rep' && u.team_id) {
      const lead = DATA.users.filter(x => x.company_id === u.company_id && x.team_id === u.team_id && x.role === 'leader' && x.id !== u.id && !x.archived)
        .sort((a, b) => a.created_at - b.created_at)[0];
      if (lead) parent = lead;
    }
    u.parent_id = parent && parent.id !== u.id ? parent.id : null;
  }
  for (const u of DATA.users) {
    if (!u.status) u.status = 'active';
    if (!u.start_date) {
      const firstLog = DATA.fieldlog.filter(r => r.user_id === u.id).map(r => r.date).sort()[0];
      u.start_date = firstLog || localDate(u.created_at || Date.now(), tz);
    }
    report.people++;
  }
  /* Reps who were already working before the Field Log existed don't restart the 10-Day Program:
     no training days logged and (passed the old Phase 1 exam, or logged other days, or joined 14+ days ago). */
  const now = Date.now();
  for (const u of DATA.users) {
    if (u.rank !== 'rep' || u.program_done !== undefined) continue;
    const logs = DATA.fieldlog.filter(r => r.user_id === u.id);
    const trained = logs.some(r => r.kind === 'training');
    const passedP1 = DATA.results.some(r => r.user_id === u.id && r.quiz_id === 'p1' && r.total > 0 && r.score / r.total >= 0.75);
    u.program_done = !trained && (passedP1 || logs.length > 0 || (now - (u.created_at || now)) > 14 * 86400000);
    if (u.program_done) report.skippedProgram = (report.skippedProgram || 0) + 1;
  }
  for (const r of DATA.results) if (QUIZ_MAP[r.quiz_id]) { r.legacy_quiz = r.quiz_id; r.quiz_id = QUIZ_MAP[r.quiz_id]; }

  DATA.schema = 4;
  DATA.migrated_at = Date.now();
  return { migrated: true, report };
}
module.exports = { migrate, QUIZ_MAP };
