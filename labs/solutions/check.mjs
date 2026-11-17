// The reference solution of every lab, run against the files participants get.
//
//   node labs/solutions/check.mjs            all labs
//   node labs/solutions/check.mjs 2.2 3.1    some labs
//
// Node 22, no dependency. It prints what it recomputed for each lab, then PASS. It writes
// nothing and calls no model.
//
// What runs for real: every check on the files (the key against the guide and the lab page,
// each clause the terms key cites, the identifier rules taken from the published tool page and
// run on three versions of the request, the hidden instruction located inside each of the
// three files, the call-back number against the directory, the incident report against the
// contacts table).
// What runs against a stand-in: the assistant's reply in lab 2.2 and the two assistants of
// lab 3.1 are written replies kept in key.json. No model produced them.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LABS = path.resolve(HERE, '..');
const read = (rel) => fs.readFileSync(path.join(LABS, rel), 'utf8');
const KEY = JSON.parse(read('solutions/key.json'));
const unescape = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
const squash = (s) => s.replace(/\s+/g, ' ').trim();
const pageText = (name) => squash(unescape(read(name).replace(/<[^>]+>/g, ' ')));
const say = (...a) => console.log('  ' + a.join(' '));
const LAB = {};

LAB['1.1'] = () => {
  const k = KEY['1.1'];
  const page = pageText('M1_1_classify.html');
  assert.equal(k.items.length, 10);
  const allowed = { A: ['عام'], B: ['عام', 'مقيّد'], C: ['عام', 'مقيّد', 'سري'] };
  const count = {};
  for (const [i, it] of k.items.entries()) {
    const body = read('files/items/' + it.file);
    // The page shows the item as the file holds it.
    for (const line of body.split('\n').filter(Boolean)) {
      for (const cell of line.split(it.file.endsWith('.csv') ? ',' : '\u0000')) assert.ok(page.includes(squash(cell)), 'item ' + (i + 1) + ' differs from the page: ' + cell);
    }
    // The key follows the guide and the three rules of the page.
    assert.ok(k.levels.includes(it.level));
    if (it.tier === 'N') {
      assert.ok(it.level === 'سري للغاية' || /الغضروف|طبي/.test(body), 'item ' + (i + 1) + ': "no tool" needs top secret or health data');
    } else {
      assert.ok(allowed[it.tier].includes(it.level), 'item ' + (i + 1) + ': the tier may not receive this level');
      // The lowest tier that is enough.
      const lowest = ['A', 'B', 'C'].find((t) => allowed[t].includes(it.level));
      assert.equal(it.tier, lowest, 'item ' + (i + 1) + ': not the lowest tier that is enough');
    }
    const personal = /(?<![0-9])[12][0-9]{9}(?![0-9])|(?<![0-9])05[0-9]{8}(?![0-9])/.test(body);
    if (it.tier === 'B') assert.equal(it.condition === 'بعد التقليل', personal, 'item ' + (i + 1) + ': the minimisation condition follows the personal data in it');
    if (it.tier === 'C') assert.equal(it.condition, 'بموافقة مالك البيانات');
    // A label written on the item is followed.
    const label = body.match(/التصنيف: (سري للغاية|سري|مقيّد|عام)/);
    if (label) assert.equal(it.level, label[1], 'item ' + (i + 1) + ': the owner\'s label is followed');
    count[it.level + ' / ' + it.tier] = (count[it.level + ' / ' + it.tier] || 0) + 1;
  }
  say('10 items, each shown on the page as in its file');
  say('level / tier:', Object.entries(count).map(([a, n]) => a + ' ×' + n).join(', '));
  say('pass mark:', k.pass, 'of 10');
};

LAB['2.1'] = () => {
  const k = KEY['2.1'];
  const clauses = k.files.map((f) => read('files/' + f).split('\n').filter((l) => /^[0-9]+\. /.test(l)).map((l) => l.replace(/^[0-9]+\. /, '')));
  assert.deepEqual(clauses.map((c) => c.length), [7, 7]);
  const page = pageText('M2_1_terms.html');
  for (const c of clauses.flat()) assert.ok(page.includes(squash(c)), 'a clause differs from the page');
  // Each answer rests on a clause that holds its decisive words.
  const proof = [
    [['30 يومًا'], ['90 يومًا', 'مسؤول النظام']],
    [['تدريب', 'لا يشمل'], ['لا نستخدم', 'تدريب']],
    [['يراجع', 'عينات'], ['طلب دعم مكتوب', 'يُسجَّل']],
    [[], ['مسؤول النظام', 'محتوى المحادثات']],
    [['الرابط', 'محركات البحث'], ['داخل مساحة عمل الجهة']],
    [['عدة دول'], ['داخل المملكة']]
  ];
  assert.equal(k.questions.length, 6);
  k.questions.forEach((q, i) => {
    [[q.ac, 0], [q.bc, 1]].forEach(([nums, side]) => {
      const text = nums.map((n) => { assert.ok(clauses[side][n - 1], 'no clause ' + n); return clauses[side][n - 1]; }).join(' ');
      for (const w of proof[i][side]) assert.ok(text.includes(w), 'question ' + (i + 1) + ', side ' + side + ': the cited clause does not say "' + w + '"');
    });
  });
  // The trap: nothing in the consumer terms speaks of an employer.
  assert.ok(!clauses[0].join(' ').includes('الجهة'));
  say('2 sets of 7 clauses, each shown on the page as in its file');
  say('6 questions: every cited clause exists and holds the words its answer needs');
  say('question 4: the consumer terms never mention the employer (cited clauses: none)');
};

function loadTool() {
  const html = read('tools/id_check.html');
  const script = html.slice(html.indexOf('<script>') + 8, html.indexOf('</script>'));
  const core = script.slice(0, script.indexOf('document.getElementById'));
  return new Function(core + '; return { RULES, detect };')();
}

LAB['2.2'] = () => {
  const k = KEY['2.2'];
  const { RULES, detect } = loadTool();
  assert.deepEqual(RULES, k.rules, 'the tool page and the key hold different rules');
  const original = read('files/request_original.txt'), weak = read('files/request_weak.txt'), ref = read('solutions/request_minimised.txt');
  const inOriginal = detect(original, RULES), inWeak = detect(weak, RULES), inRef = detect(ref, RULES);
  say('tool on the original request:', inOriginal.length, 'findings:', inOriginal.map((f) => f.rule).join(' '));
  assert.equal(inOriginal.length, k.found_in_original);
  assert.equal(inRef.length, 0, 'the reference still holds: ' + JSON.stringify(inRef));
  assert.equal(inWeak.length, 0, 'the weak version must pass the tool: ' + JSON.stringify(inWeak));
  say('tool on the reference version: 0 findings; on the colleague\'s version: 0 findings');
  // Arabic-Indic digits are caught too.
  assert.equal(detect('هوية ١٠٤٧٣٨٢٩١٥', RULES).length, 1);
  // Every identifier of the key is in the original and gone from the reference.
  for (const id of k.key) { assert.ok(original.includes(id.text), 'not in the original: ' + id.text); assert.ok(!ref.includes(id.text), 'still in the reference: ' + id.text); }
  say(k.key.length, 'identifiers of the key: all in the original, none in the reference');
  // What the eye must catch is in the weak version and not in the reference.
  for (const q of k.quasi) { assert.ok(weak.includes(q.text), 'not in the weak version: ' + q.text); assert.ok(!ref.includes(q.text)); }
  say(k.quasi.length, 'indirect identifiers: all in the colleague\'s version, none in the reference');
  // The task survives.
  for (const w of k.keep) assert.ok(ref.includes(w), 'the task lost: ' + w);
  for (const [code] of k.pseudonyms) assert.ok(ref.includes(code));
  // Stand-in reply: usable, clean, and complete once the identifiers are put back by hand.
  const reply = k.standin.join('\n');
  assert.equal(detect(reply, RULES).length, 0);
  assert.equal(k.standin.filter((l) => l.startsWith('- ')).length, 3);
  assert.ok(reply.includes('نعتذر') && reply.includes('10 أيام عمل') && reply.includes('450'));
  let final = reply;
  for (const [code, value] of k.pseudonyms) { assert.ok(final.includes(code), 'the reply lost ' + code); final = final.split(code).join(value); }
  assert.ok(!/\[[^\]]+\]/.test(final));
  assert.equal(detect(final, RULES).filter((f) => f.rule === 'name').length, 2);
  say('stand-in reply (written, not a model): apology, refund steps, 3 points, 3 codes kept; identifiers restored by hand');
};

// The text of a stored zip entry (the pack's .docx is written without compression).
function zipEntry(buf, name) {
  let at = 0;
  while (buf.readUInt32LE(at) === 0x04034b50) {
    const method = buf.readUInt16LE(at + 8), size = buf.readUInt32LE(at + 18), n = buf.readUInt16LE(at + 26), x = buf.readUInt16LE(at + 28);
    const entry = buf.toString('utf8', at + 30, at + 30 + n), start = at + 30 + n + x;
    if (entry === name) { assert.equal(method, 0); return buf.toString('utf8', start, start + size); }
    at = start + size;
  }
  throw new Error('no entry ' + name);
}

LAB['3.1'] = () => {
  const k = KEY['3.1'];
  const HIDDEN = /<(p|div|span)\b[^>]*style="[^"]*(?:display:\s*none|font-size:\s*1px|color:\s*#fff(?:fff)?)[^"]*"[^>]*>[\s\S]*?<\/\1>/gi;
  for (const id of ['email', 'page']) {
    const html = read('files/' + k[id].file);
    const all = squash(unescape(html.replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ')));
    const seen = squash(unescape(html.replace(HIDDEN, ' ').replace(/<style[\s\S]*?<\/style>/g, ' ').replace(/<[^>]+>/g, ' ')));
    assert.ok(all.includes(k[id].hidden), id + ': the instruction is not in the file');
    assert.ok(!seen.includes(k[id].hidden), id + ': the instruction is visible');
    assert.equal([...html.matchAll(HIDDEN)].length, 1);
    assert.ok(read('files/' + k[id].file.replace('.html', '_as_read.txt')).includes(k[id].hidden));
    say(id + ': instruction found in the file, inside one element styled to be invisible; absent from what is displayed');
  }
  const xml = zipEntry(fs.readFileSync(path.join(LABS, 'files', k.doc.file)), 'word/document.xml');
  const runs = [...xml.matchAll(/<w:r>([\s\S]*?)<\/w:r>/g)].map((m) => ({ hidden: m[1].includes('<w:vanish/>'), text: unescape((m[1].match(/<w:t[^>]*>([\s\S]*?)<\/w:t>/) || [])[1] || '') }));
  const hidden = runs.filter((r) => r.hidden);
  assert.equal(hidden.length, 1);
  assert.equal(hidden[0].text, k.doc.hidden);
  assert.ok(!runs.filter((r) => !r.hidden).some((r) => r.text.includes('ملاحظة للمساعد')));
  say('doc: ' + runs.length + ' runs of text, 1 with the hidden-text property; it holds the instruction');
  // Stand-in assistants: the uncontrolled one carries the payload, the careful one names it.
  const payload = { email: 'SA5512000000774100293318', page: 'hima-permits-renew.example', doc: 'partner-review@friends-nature.example' };
  const page = pageText('M3_1_injection.html');
  for (const id of ['email', 'page', 'doc']) {
    assert.ok(k[id].hidden.includes(payload[id]) && k[id].naive.includes(payload[id]), id + ': the naive reply does not carry the payload');
    assert.ok(!k[id].careful.includes(payload[id]) && k[id].careful.includes('نص مخفي'), id + ': the careful reply repeats the payload or does not flag it');
    assert.ok(page.includes(squash(k[id].hidden)));
    assert.equal(k[id].signs.length, 4);
  }
  say('stand-in replies (written, not a model): 3 uncontrolled replies carry the payload, 3 careful replies flag it and do not repeat it');
};

LAB['4.1'] = () => {
  const k = KEY['4.1'];
  const dir = read('files/directory.txt'), call = read('files/call_script.txt'), video = read('files/video_script.txt'), rule = read('files/payment_rule.txt');
  assert.ok(call.includes(k.caller_number) && !dir.includes(k.caller_number), 'the caller\'s number must not be in the directory');
  assert.ok(call.includes(k.amount) && video.includes(k.iban));
  assert.equal(rule.split('\n').filter((l) => /^[0-9]\. /.test(l)).length, 5);
  const rec = Object.fromEntries(k.record);
  const callback = rec['الرقم الذي عاودتِ الاتصال به، ومصدره'];
  const ext = callback.match(/[0-9]{4}/g);
  assert.deepEqual(ext, ['2141', '2140']);
  for (const e of ext) assert.ok(dir.includes('تحويلة ' + e), 'call-back number ' + e + ' is not in the directory');
  assert.ok(!callback.includes(k.caller_number));
  assert.ok(rec['القرار'].includes('لم يُحوَّل'));
  assert.ok(rec['البلاغ'].includes('سهل المريخي') && dir.includes('سهل المريخي'));
  for (const w of [k.caller_number, k.amount, '2141', 'لم أحوّل']) assert.ok(k.report.includes(w), 'the report lacks ' + w);
  assert.ok(!k.report.includes(k.iban), 'the report need not repeat the account number');
  assert.equal(k.flags.length, 6);
  const page = pageText('M4_1_callback.html');
  for (const r of k.record) assert.ok(page.includes(squash(r[1])));
  say('caller', k.caller_number, 'is not in the directory; call-back went to extensions', ext.join(' and '), 'from the directory');
  say('record: 10 fields, decision "no transfer", report to cybersecurity; 6 red flags in the request');
};

LAB['4.2'] = () => {
  const k = KEY['4.2'];
  const story = read('files/incident_case.txt');
  const owner = k.contacts.find((c) => c[2].includes('بيانات شخصية'));
  assert.equal(owner[0], k.primary);
  const rep = Object.fromEntries(k.report);
  assert.ok(rep['من أبلغت، ومتى؟'].startsWith(k.primary));
  assert.ok(story.includes('37') && rep['ما البيانات، وما تصنيفها؟'].includes('37'));
  assert.ok(rep['أين هي الآن؟'].includes('رابط'));
  const fields = k.report.map((r) => r[0]);
  const at = ['ما الذي أوقفته فورًا؟', 'ما الذي سجّلته؟', 'من أبلغت، ومتى؟', 'كيف أمنع التكرار؟'].map((f) => fields.indexOf(f));
  assert.ok(at.every((x, i) => x > -1 && (i === 0 || x > at[i - 1])), 'the report does not follow stop, record, report, prevent');
  assert.ok(rep['ما الذي سجّلته؟'].includes('قبل أي حذف'));
  assert.equal(k.report.length, 9);
  const page = pageText('M4_2_incident.html');
  for (const r of k.report) assert.ok(page.includes(squash(r[1])));
  say('first contact:', k.primary, '(the row of the contacts table that owns personal data)');
  say('report: 9 fields in the order stop, record, report, prevent; 37 employees; the share link named');
};

const want = process.argv.slice(2);
let failed = 0;
for (const id of Object.keys(LAB)) {
  if (want.length && !want.includes(id)) continue;
  console.log('Lab ' + id);
  try { LAB[id](); console.log('  PASS'); } catch (e) { failed += 1; console.log('  FAIL: ' + e.message); }
}
process.exit(failed ? 1 : 0);
