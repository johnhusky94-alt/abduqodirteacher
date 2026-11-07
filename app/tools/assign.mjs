// Turns special code into the SQL that sends it, exactly like the teacher panel's "Send" button.
//   node tools/assign.mjs <code-file> --groups "A2,B1" [--week 2026-11-09] [--by t1]
// Checks the code with the site's own parser first; prints a summary (stderr) and the SQL (stdout).
// Several works in one file are separated by a line "=====" (as in the Assign page).
import { readFileSync } from 'node:fs'; import { Code, T } from './v2.mjs';

const args = process.argv.slice(2), file = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')))[0];
const opt = k => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : null; };
if (!file) { console.error('usage: node tools/assign.mjs <code-file> --groups "A2,B1" [--week YYYY-MM-DD] [--by t1]'); process.exit(2); }
const groups = (opt('groups') || '').split(',').map(s => s.trim()).filter(Boolean);
if (!groups.length) { console.error('--groups is required'); process.exit(2); }
// the week = Monday 00:00 in Tashkent, the same number the site uses
const tashMonday = iso => { const d = iso ? new Date(iso + 'T00:00:00+05:00') : new Date(); const loc = new Date(d.getTime() + 5 * 3600e3);
  const dow = (loc.getUTCDay() + 6) % 7; const m = Date.UTC(loc.getUTCFullYear(), loc.getUTCMonth(), loc.getUTCDate() - dow) - 5 * 3600e3; return m; };
const week = tashMonday(opt('week')), by = opt('by') || 't1', now = Date.now();
// optional --ctx file: JSON {classes:[{name, sched}], students:[{cls, group}]} from the database, to check the lesson exists in each class
let CTX = null; if (opt('ctx')) CTX = JSON.parse(readFileSync(opt('ctx'), 'utf8'));
const lessonsIn = c => ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].reduce((n, d) => n + ((c.sched && c.sched[d]) || []).length, 0);

const parts = Code.splitWorks(readFileSync(file, 'utf8'));
const q = v => "'" + String(v).replace(/'/g, "''") + "'";
let sql = 'begin;\n', bad = 0;
parts.forEach((src, k) => {
  const P = Code.parse(src), t = P.type;
  const head = `#${k + 1} ${P.meta.title || '(no title)'} · ${t || '?'}${P.meta.lesson ? ' · lesson ' + P.meta.lesson : ''}`;
  if (!P.ok) { bad++; console.error(head + '\n  ERRORS:\n' + P.errors.map(e => `   line ${e.line}: ${e.msg}`).join('\n')); return; }
  P.warnings.forEach(e => console.error(`  warning line ${e.line}: ${e.msg}`));
  const w = { id: 'w' + now.toString(36) + k + Math.random().toString(36).slice(2, 5), type: t, code: src, groups, sentAt: now, by, title: P.meta.title || '' };
  if (t === 'homework' || t === 'classwork' || t === 'weekly') w.week = week; if (P.meta.lesson) w.lesson = +P.meta.lesson;
  const secs = P.sections.filter(s => s.kind !== 'words').map(s => `${s.kind}${s.min ? ' ' + s.min + 'min' : ''} (${s.ex.length} ex)`).join(', ');
  console.error(`${head}\n  groups: ${groups.join(', ')}${w.week ? ' · week of ' + new Date(week + 5 * 3600e3).toISOString().slice(0, 10) : ''}\n  parts: ${secs || '—'}\n  words: ${P.words.length}${P.words.length ? ' (' + P.words.slice(0, 12).map(c => c.w).join(', ') + (P.words.length > 12 ? ', …' : '') + ')' : ''}`);
  if (CTX && (t === 'homework' || t === 'classwork')) {
    const cls = CTX.classes.filter(c => CTX.students.some(x => x.cls === c.id && groups.includes(x.group)));
    if (!cls.length) { bad++; console.error('  ERROR: no class has students in ' + groups.join(', ')); }
    cls.forEach(c => { const n = lessonsIn(c); if (!n) { bad++; console.error(`  ERROR: class ${c.name} has no timetable yet (Settings → Classes & timetable)`); } else if ((w.lesson || 0) > n) { bad++; console.error(`  ERROR: class ${c.name} has only ${n} English lessons a week, there is no lesson ${w.lesson}`); } else console.error(`  ${c.name}: lesson ${w.lesson} of ${n}`); });
  }
  // replacing: an older work of the same type, week (and lesson) leaves these groups
  if (w.week) sql += `update public.v2_doc set data = jsonb_set(data, '{groups}', coalesce((select jsonb_agg(g) from jsonb_array_elements_text(data->'groups') g where g <> all (array[${groups.map(q).join(',')}])), '[]'::jsonb)), updated_at = now()
  where coll = 'works' and data->>'type' = ${q(t)} and (data->>'week')::bigint = ${week}${t !== 'weekly' ? ` and (data->>'lesson')::int = ${w.lesson || 0}` : ''};\n`;
  sql += `insert into public.v2_doc (coll, id, data) values ('works', ${q(w.id)}, ${q(JSON.stringify(w))}::jsonb);\n`;
});
sql += 'commit;\n';
if (bad) { console.error(`\n${bad} problem(s): nothing to send.`); process.exit(1); }
process.stdout.write(sql);
