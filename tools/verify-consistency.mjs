// Reproducible consistency gate for the K.COM audit, documentation and remix engine.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const failures = [];
const ok = (condition, message) => { if (!condition) failures.push(message); };
const read = (relative) => fs.readFileSync(path.join(root, relative), 'utf8');

// 1. Lock the exact original binary.
const binary = fs.readFileSync(path.join(root, 'reference', 'original-game', 'K.com'));
const hash = crypto.createHash('sha256').update(binary).digest('hex').toUpperCase();
ok(binary.length === 52098, `K.com size ${binary.length}, expected 52098`);
ok(hash === '10756C77D923CBB8937FD9D8D91C61B15178D47BF6EB9321196AE51C31789625',
  `K.com SHA-256 changed: ${hash}`);

// 2. Prove byte-map continuity across all three audit ranges.
const maps = [
  ['docs/reverse-engineering/audit/01-low-ranges.csv', 'mem_start', 'mem_end'],
  ['docs/reverse-engineering/audit/02-mid-ranges.csv', 'mem_start', 'mem_end'],
  ['docs/reverse-engineering/audit/03-high-ranges.csv', 'start', 'end'],
];
let previous = null;
let classified = 0;
for (const [file, startName, endName] of maps) {
  const lines = read(file).trim().split(/\r?\n/);
  const headers = lines.shift().split(',');
  const si = headers.indexOf(startName), ei = headers.indexOf(endName);
  ok(si >= 0 && ei >= 0, `${file}: missing range headers`);
  for (const line of lines) {
    // Range fields are the first columns and never contain commas in quoted prose.
    const cols = line.split(',');
    const start = Number.parseInt(cols[si].replace(/^0x/i, ''), 16);
    const end = Number.parseInt(cols[ei].replace(/^0x/i, ''), 16);
    ok(Number.isInteger(start) && Number.isInteger(end) && end >= start,
      `${file}: invalid range ${cols[si]}..${cols[ei]}`);
    if (previous !== null) ok(start === previous + 1,
      `${file}: gap/overlap after 0x${previous.toString(16)} at 0x${start.toString(16)}`);
    classified += end - start + 1;
    previous = end;
  }
}
ok(classified === binary.length, `classified ${classified} bytes, binary has ${binary.length}`);
ok(previous === 0xCC81, `last classified address is 0x${previous?.toString(16)}, expected 0xCC81`);

// 3. Canonical facts that must remain present in the detailed documents.
const required = new Map([
  ['03 - אירועי תחילת יום ובורר האירוע היומי.md', [
    '15 זוגות', '500−150−Random(3)×50', '50−15−Random(3)×5',
    '10×Trunc((מזומן+שווי-מטען)/(Random(80)+150))',
  ]],
  ['05 - ספריית המספרים הממשיים (FP) של טורבו פסקל 3.md', [
    'cash > 20000', 'cash > 45000', 'R := 15',
    'tons = 5×Trunc((B/centerPrice)/5 + 1)',
  ]],
  ['06 - ההפלגה - כל תרחישי הדרך.md', [
    'המשחק נעצר בכמות החיובית הראשונה',
    '5×Trunc(רכוש/(200+Random(100)))',
  ]],
  ['07 - שודדי הים - קרב, בריחה וכופר.md', [
    '5×Trunc(רכוש/(200+Random(100)))', 'הצעה > דרישה',
  ]],
  ['09 - תוכנית הרימיקס.md', [
    '15 זוגות', 'אם האירוע אינו ישים', '↓150+Rnd(3)×50', '↓15+Rnd(3)×5',
    '10×Trunc((מזומן+שווי מטען)/(Rnd(80)+150))',
  ]],
  ['10 - מפרט מנוע מאומת סופית.md', [
    '15 הזוגות', '35 + Random(8)×5', '500−150−Random(3)×50',
    '50−15−Random(3)×5', 'המשחק נעצר בכמות',
  ]],
]);
for (const [file, needles] of required) {
  const text = read(path.join('docs', 'reverse-engineering', file));
  for (const needle of needles) ok(text.includes(needle), `${file}: missing canonical fact: ${needle}`);
}

// 4. Stale formulations that have already been disproved.
const reverseEngineeringDir = path.join(root, 'docs', 'reverse-engineering');
const docs = fs.readdirSync(reverseEngineeringDir)
  .filter((name) => /^(?:0\d|10|דוח).*\.md$/u.test(name))
  .map((name) => [name, fs.readFileSync(path.join(reverseEngineeringDir, name), 'utf8')]);
const forbidden = [
  ['הצעה ≥ דרישה', 'ransom equality must be rejected'],
  ['הצעה≥דרישה', 'ransom equality must be rejected'],
  ['זיתים ±200+Rnd(4)', 'olive-down shock has different parameters'],
  ['חיטה ±20+Rnd(5)', 'wheat-down shock has different parameters'],
  ['כמות=Rnd(Trunc(0.75×V)+1)', 'merchant quantity formula is incomplete'],
  ['נזק += Trunc(עושר/(Rnd(80)+150))', 'collision is missing ×10'],
  ['907,624,169', 'wrong decimal value for the LCG increment'],
  ['30 + Random(8)×5', 'daily wheat base must be 35'],
  ['פרטי-שוליים שנותרו', 'obsolete unresolved-work marker'],
  ['הצעד הבא', 'obsolete sequential-work marker'],
];
for (const [file, text] of docs) {
  for (const [needle, reason] of forbidden)
    ok(!text.includes(needle), `${file}: stale text “${needle}” (${reason})`);
}

// 5. Source-level invariants for the implementation.
const events = read('src/core/events.js');
const constants = read('src/core/constants.js');
const voyage = read('src/core/voyage.js');
const rng = read('src/core/rng.js');
ok(events.includes('return Math.floor((R - 1) / 2)'), 'event no-repeat is not pair-based');
ok(events.includes('10 * Math.trunc(wealth(state) / (150 + rng.random(80)))'),
  'collision formula differs from canonical ×10 formula');
ok(constants.includes('down: { base: 150,  k: 3, step: 50'), 'olive-down shock constants changed');
ok(constants.includes('down: { base: 15,   k: 3, step: 5'), 'wheat-down shock constants changed');
ok(voyage.includes('if (found[c] > 0)') && voyage.includes('break;'),
  'derelict first-positive stopping rule is missing');
ok(rng.includes('this.seed * 129 + 0x361962E9'), 'TP3 LCG formula changed');

// 6. Run the executable regression suite and UI syntax check.
const tests = fs.readdirSync(path.join(root, 'src', 'tests'))
  .filter((name) => name.endsWith('.test.js'))
  .map((name) => path.join(root, 'src', 'tests', name));
const testRun = spawnSync(process.execPath, ['--test', ...tests], { encoding: 'utf8' });
ok(testRun.status === 0, `engine tests failed:\n${testRun.stdout}\n${testRun.stderr}`);
const uiCheck = spawnSync(process.execPath, ['--check', path.join(root, 'src', 'ui', 'app.js')],
  { encoding: 'utf8' });
ok(uiCheck.status === 0, `UI syntax check failed:\n${uiCheck.stderr}`);

if (failures.length) {
  console.error(`CONSISTENCY CHECK FAILED (${failures.length})`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(`CONSISTENCY OK: ${classified}/${binary.length} bytes, SHA-256 locked, ${tests.length} test files passed.`);
