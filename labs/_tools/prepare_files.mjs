// Writes the file pack of the course from data.mjs, the same bytes on every run:
//   labs/files/…             what participants open
//   labs/tools/id_check.html the identifier check that runs in the browser
//   labs/solutions/key.json  the key of every lab, read by labs/solutions/check.mjs
// and fills the blocks marked <!-- pack:name --> … <!-- /pack:name --> in the lab pages.
//
//   node labs/_tools/prepare_files.mjs
//
// Node 22, no dependency. Nothing here is random and nothing reads the clock.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LEVELS, TIERS, ITEMS, TERMS, REQUEST, RULES, INJECTION, FRAUD, INCIDENT } from './data.mjs';
import { detect, htmlAsRead, htmlAsSeen, zipStore } from './lib.mjs';

const LABS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FILES = path.join(LABS, 'files');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const written = [];
function write(rel, content) {
  const file = path.join(LABS, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, typeof content === 'string' ? content.replace(/\r\n/g, '\n') : content);
  written.push(rel);
}
const lines = (arr) => arr.join('\n') + '\n';
const doc = (arr, title) => '<div class="box doc">' + (title ? '<h4>' + esc(title) + '</h4>' : '') + arr.map((x) => '<p>' + esc(x) + '</p>').join('') + '</div>';
const table = (rows, cls) => '<table' + (cls ? ' class="' + cls + '"' : '') + '>\n' + rows.map((r, i) => '<tr>' + r.map((c) => (i === 0 ? '<th>' : '<td>') + c + (i === 0 ? '</th>' : '</td>')).join('') + '</tr>').join('\n') + '\n</table>';
const ltr = (s) => '<span class="ltr" dir="ltr">' + esc(s) + '</span>';

const blocks = {};

// ---- Lab 1.1 ---------------------------------------------------------------------------
for (const it of ITEMS) {
  write('files/items/' + it.file, it.table ? lines(it.table.map((r) => r.join(','))) : lines(it.body));
}
const itemBoxes = ITEMS.map((it, i) => {
  const head = (i + 1) + ' · ' + it.title;
  if (it.table) return '<div class="box doc"><h4>' + esc(head) + '</h4>' + table(it.table.map((r) => r.map(esc))) + '</div>';
  return doc(it.body, head);
});
blocks['items-a'] = itemBoxes.slice(0, 5).join('\n');
blocks['items-b'] = itemBoxes.slice(5).join('\n');
const tierText = (it) => TIERS[it.tier] + (it.cond ? '، ' + it.cond : '');
blocks['items-sheet'] = table([['العنصر', 'المستوى', 'فئة الأداة']].concat(ITEMS.map((it, i) => [(i + 1) + ' · ' + esc(it.title), '', ''])))
  .replace(/<td><\/td>/g, '<td class="fill">…</td>');
blocks['items-key'] = table([['العنصر', 'المستوى', 'فئة الأداة', 'السبب']].concat(ITEMS.map((it, i) => [(i + 1) + ' · ' + esc(it.title), '<b>' + LEVELS[it.level] + '</b>', '<b>' + esc(tierText(it)) + '</b>', esc(it.why)])));

// ---- Lab 2.1 ---------------------------------------------------------------------------
for (const k of ['a', 'b']) {
  const t = TERMS[k];
  write('files/' + t.file, lines(['شروط «' + t.name + '» بلغة مبسطة. ' + t.kind + '.', 'مقدم خدمة افتراضي لأغراض التدريب.', ''].concat(t.clauses.map((c, i) => (i + 1) + '. ' + c))));
  blocks['terms-' + k] = '<div class="box doc"><h4>شروط «' + esc(t.name) + '»</h4><p>' + esc(t.kind) + '.</p><ol>' + t.clauses.map((c) => '<li>' + esc(c) + '</li>').join('') + '</ol></div>';
}
const clause = (n) => (n.length ? ' <span class="small">(البند ' + n.join(' و') + ')</span>' : ' <span class="small">(لا بند: الشروط بينك وبين مقدم الخدمة)</span>');
blocks['terms-sheet'] = table([['السؤال', '«نسيم»', '«مِداد للأعمال»']].concat(TERMS.questions.map((q, i) => [(i + 1) + ' · ' + esc(q.q), '', ''])))
  .replace(/<td><\/td>/g, '<td class="fill">… البند …</td>');
blocks['terms-key'] = table([['السؤال', '«نسيم»', '«مِداد للأعمال»', 'ما تحمله معك']].concat(TERMS.questions.map((q, i) => [(i + 1) + ' · ' + esc(q.q), esc(q.a) + clause(q.ac), esc(q.b) + clause(q.bc), esc(q.note)])));

// ---- Lab 2.2 ---------------------------------------------------------------------------
write('files/request_original.txt', lines(REQUEST.original));
write('files/request_weak.txt', lines(REQUEST.weak));
write('solutions/request_minimised.txt', lines(REQUEST.minimised));
blocks.request = doc(REQUEST.original);
blocks['request-weak'] = doc(REQUEST.weak, 'نسخة كتبها زميل');
blocks['request-key'] = table([['المعرِّف', 'نوعه', 'الحركة']].concat(REQUEST.key.map((k) => [/^[\x20-\x7e]+$/.test(k.text) ? ltr(k.text) : esc(k.text), esc(k.kind), esc(k.move)])));
blocks['request-ref'] = doc(REQUEST.minimised, 'نسخة مقلّصة مرجعية') +
  table([['الرمز', 'ما يقابله (يبقى عندك، خارج الأداة)']].concat(REQUEST.pseudonyms.map(([a, b]) => [esc(a), /^[\x20-\x7e]+$/.test(b) ? ltr(b) : esc(b)])));
blocks['request-quasi'] = table([['ما بقي في نسخة الزميل', 'لماذا يدل على صاحبه']].concat(REQUEST.quasi.map((q) => [esc(q.text), esc(q.why)])));
blocks['request-answer'] = doc(REQUEST.standin, 'إجابة مكتوبة تمثّل ما يعود من المساعد');
blocks['rules'] = table([['القاعدة', 'ما تلتقطه']].concat(
  RULES.patterns.map((r) => [esc(r.label), ({ national_id: 'عشرة أرقام تبدأ بـ 1 أو 2', mobile: 'عشرة أرقام تبدأ بـ 05، أو الصيغة الدولية', email: 'عنوان فيه @', iban: 'SA ثم 22 رقمًا', permit: 'صيغة تصاريح حِمى', complaint: 'صيغة أرقام الشكاوى', staff_no: 'عبارة «الرقم الوظيفي» ثم رقم', date: 'سنة-شهر-يوم' })[r.id]]),
  RULES.lists.map((l) => [esc(l.label), esc(l.words.join('، '))])));

// ---- The identifier check page -----------------------------------------------------------
const toolSrc = fs.readFileSync(path.join(LABS, '_tools', 'id_check.tpl.html'), 'utf8');
const libSrc = fs.readFileSync(path.join(LABS, '_tools', 'lib.mjs'), 'utf8');
const detectSrc = libSrc.slice(libSrc.indexOf('// detect:begin'), libSrc.indexOf('// detect:end')).replace(/^export /gm, '');
write('tools/id_check.html', toolSrc.replace('/*RULES*/', JSON.stringify(RULES)).replace('/*DETECT*/', detectSrc));

// ---- Lab 3.1 ---------------------------------------------------------------------------
const page = (title, body) => '<!doctype html>\n<html lang="ar" dir="rtl">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>' + esc(title) + '</title>\n<style>body{font-family:system-ui,sans-serif;max-width:640px;margin:24px auto;padding:0 16px;line-height:1.8;background:#ffffff;color:#1b2540}</style>\n</head>\n<body>\n' + body + '\n</body>\n</html>\n';
const E = INJECTION.email, P = INJECTION.page, D = INJECTION.doc;
const emailHtml = page(E.visible[2], E.visible.map((x) => '<p>' + esc(x) + '</p>').join('\n') + '\n<p style="color:#ffffff;font-size:1px">' + esc(E.hidden) + '</p>');
const pageHtml = page(P.visible[0], '<h1>' + esc(P.visible[0]) + '</h1>\n' + P.visible.slice(1).map((x) => '<p>' + esc(x) + '</p>').join('\n') + '\n<div style="display:none">' + esc(P.hidden) + '</div>');
write('files/' + E.file, emailHtml);
write('files/' + P.file, pageHtml);
const wp = (text, hidden) => '<w:p><w:pPr><w:bidi/></w:pPr><w:r><w:rPr><w:rtl/>' + (hidden ? '<w:vanish/><w:color w:val="FFFFFF"/><w:sz w:val="2"/>' : '') + '</w:rPr><w:t xml:space="preserve">' + esc(text) + '</w:t></w:r></w:p>';
const documentXml = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>' + D.visible.map((x) => wp(x, false)).join('') + wp(D.hidden, true) + '<w:sectPr><w:bidi/></w:sectPr></w:body></w:document>';
write('files/' + D.file, zipStore([
  ['[Content_Types].xml', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>'],
  ['_rels/.rels', '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'],
  ['word/document.xml', documentXml]
]));
const asRead = { email: htmlAsRead(emailHtml), page: htmlAsRead(pageHtml), doc: D.visible.concat([D.hidden]) };
const asSeen = { email: htmlAsSeen(emailHtml), page: htmlAsSeen(pageHtml), doc: D.visible };
for (const k of ['email', 'page', 'doc']) {
  write('files/' + INJECTION[k].file.replace(/\.[a-z]+$/, '') + '_as_read.txt', lines(asRead[k]));
  blocks[k + '-seen'] = doc(asSeen[k], 'كما تراه أنت');
  blocks[k + '-read'] = doc(asRead[k], 'كما يقرؤه المساعد');
  blocks[k + '-key'] = '<p><b>التعليمة المحقونة:</b> ' + esc(INJECTION[k].hidden) + '</p><p><b>كيف أُخفيت:</b> ' + esc(INJECTION[k].how) + '.</p><p><b>علاماتها:</b> ' + esc(INJECTION[k].signs.join('، ')) + '.</p><p><b>الضرر لو اتُّبعت:</b> ' + esc(INJECTION[k].harm) + '.</p>';
}
blocks['sandbox'] = ['email', 'page', 'doc'].map((k) => '<h4>' + esc(INJECTION[k].label) + '</h4><p class="small">' + esc(INJECTION[k].task) + '</p><table><tr><th>مساعد بلا ضوابط</th><th>مساعد ضُبط ليعامل ما يقرؤه بيانات</th></tr><tr><td>' + esc(INJECTION[k].naive) + '</td><td>' + esc(INJECTION[k].careful) + '</td></tr></table>').join('\n');
blocks['inj-report'] = '<div class="box doc"><h4>سطر بلاغ مرجعي</h4><p>' + esc(INJECTION.report) + '</p></div>';

// ---- Lab 4.1 ---------------------------------------------------------------------------
write('files/call_script.txt', lines(['محاكاة. مكالمة واردة إلى الجوهرة السنيد، المدفوعات، من الرقم ' + FRAUD.callerNumber + '.', ''].concat(FRAUD.call.map(([w, t]) => w + ': ' + t))));
write('files/video_script.txt', lines(['محاكاة. رسالة فيديو من الرقم نفسه، مدتها ' + FRAUD.video.length + '.', 'المشهد: ' + FRAUD.video.scene, 'يقول: ' + FRAUD.video.says, '', FRAUD.message]));
write('files/directory.txt', lines(['دليل هيئة حِمى (مقتطف). المصدر الوحيد لأرقام معاودة الاتصال.', ''].concat(FRAUD.directory.map((r) => r.filter(Boolean).join('، ')))));
write('files/payment_rule.txt', lines(['قاعدة حِمى للمدفوعات العاجلة (تدريبية).', ''].concat(FRAUD.rule.map((r, i) => (i + 1) + '. ' + r))));
blocks.call = '<div class="box doc"><h4>المكالمة، من الرقم ' + ltr(FRAUD.callerNumber) + '</h4>' + FRAUD.call.map(([w, t]) => '<p><b>' + esc(w) + ':</b> ' + esc(t) + '</p>').join('') + '</div>';
blocks.video = '<div class="box doc"><h4>رسالة الفيديو، ' + esc(FRAUD.video.length) + '</h4><p><b>المشهد:</b> ' + esc(FRAUD.video.scene) + '</p><p><b>يقول:</b> ' + esc(FRAUD.video.says) + '</p><p>' + esc(FRAUD.message) + '</p></div>';
blocks.directory = table([['الاسم', 'الصفة', 'التحويلة', 'الجوال أو البريد']].concat(FRAUD.directory.map((r) => [esc(r[0]), esc(r[1]), esc(r[2]), r[3] ? ltr(r[3]) : ''])));
blocks.rule = '<ol>' + FRAUD.rule.map((r) => '<li>' + esc(r) + '</li>').join('') + '</ol>';
blocks['flags-key'] = '<ul>' + FRAUD.flags.map((f) => '<li>' + esc(f) + '</li>').join('') + '</ul><p><b>في الفيديو:</b> ' + esc(FRAUD.video.notes.join('؛ ')) + '.</p>';
blocks['callback-result'] = '<div class="box doc"><h4>نتيجة معاودة الاتصال</h4><p>' + esc(FRAUD.callbackResult) + '</p></div>';
blocks['record-sheet'] = table([['البند', 'ما تكتبه']].concat(FRAUD.record.map((r) => [esc(r[0]), '']))).replace(/<td><\/td>/g, '<td class="fill">…</td>');
blocks['record-key'] = table([['البند', 'السجل المرجعي']].concat(FRAUD.record.map((r) => [esc(r[0]), esc(r[1])]))) + '<div class="box doc"><h4>بلاغ مرجعي</h4><p>' + esc(FRAUD.report) + '</p></div>';

// ---- Lab 4.2 ---------------------------------------------------------------------------
write('files/incident_case.txt', lines(INCIDENT.story));
blocks.case = doc(INCIDENT.story);
blocks.contacts = table([['الجهة', 'الصفة', 'تُبلَّغ في', 'العنوان']].concat(INCIDENT.contacts.map((r) => r.map(esc))));
blocks['report-sheet'] = table([['البند', 'ما تكتبه']].concat(INCIDENT.report.map((r) => [esc(r[0]), '']))).replace(/<td><\/td>/g, '<td class="fill">…</td>');
blocks['report-key'] = table([['البند', 'التقرير المرجعي']].concat(INCIDENT.report.map((r) => [esc(r[0]), esc(r[1])])));

// ---- The key ----------------------------------------------------------------------------
write('solutions/key.json', JSON.stringify({
  note: 'Written by labs/_tools/prepare_files.mjs. Synthetic. The key of every lab.',
  '1.1': { levels: LEVELS, tiers: TIERS, pass: 8, items: ITEMS.map((it) => ({ file: it.file, title: it.title, level: LEVELS[it.level], tier: it.tier, condition: it.cond, why: it.why })) },
  '2.1': { files: [TERMS.a.file, TERMS.b.file], questions: TERMS.questions },
  '2.2': { rules: RULES, key: REQUEST.key, quasi: REQUEST.quasi, pseudonyms: REQUEST.pseudonyms, keep: REQUEST.keep, standin: REQUEST.standin, found_in_original: detect(REQUEST.original.join('\n'), RULES).length },
  '3.1': Object.fromEntries(['email', 'page', 'doc'].map((k) => [k, { file: INJECTION[k].file, hidden: INJECTION[k].hidden, how: INJECTION[k].how, signs: INJECTION[k].signs, harm: INJECTION[k].harm, naive: INJECTION[k].naive, careful: INJECTION[k].careful }])),
  '4.1': { caller_number: FRAUD.callerNumber, amount: FRAUD.amount, iban: FRAUD.iban, flags: FRAUD.flags, directory: FRAUD.directory, record: FRAUD.record, report: FRAUD.report, callback: FRAUD.callbackResult },
  '4.2': { primary: INCIDENT.primary, order: INCIDENT.order, contacts: INCIDENT.contacts, report: INCIDENT.report }
}, null, 1) + '\n');

// ---- Fill the lab pages -------------------------------------------------------------------
let filled = 0;
for (const name of fs.readdirSync(LABS).filter((f) => /^M\d_\d_.*\.html$/.test(f))) {
  const file = path.join(LABS, name);
  const before = fs.readFileSync(file, 'utf8');
  const after = before.replace(/<!-- pack:([a-z0-9-]+) -->[\s\S]*?<!-- \/pack:\1 -->/g, (m, id) => {
    if (!(id in blocks)) throw new Error(name + ': no block named ' + id);
    filled += 1;
    return '<!-- pack:' + id + ' -->\n' + blocks[id] + '\n<!-- /pack:' + id + ' -->';
  });
  if (after !== before) fs.writeFileSync(file, after);
}
console.log('wrote ' + written.length + ' files, filled ' + filled + ' blocks in the lab pages');
