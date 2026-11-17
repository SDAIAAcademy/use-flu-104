// Shared by the generator and by labs/solutions/check.mjs (which carries its own copy of what
// it needs, because labs/_tools/ is not published). The part between the two "detect" marks is
// also copied, as it is, into labs/tools/id_check.html.

// detect:begin
export function normalise(text) {
  return String(text)
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/ـ/g, '');
}

export function detect(text, rules) {
  const t = normalise(text);
  const found = [];
  for (const r of rules.patterns) {
    for (const m of t.matchAll(new RegExp(r.re, 'g'))) found.push({ rule: r.id, label: r.label, text: m[0], at: m.index });
  }
  for (const l of rules.lists) {
    for (const w of l.words) {
      let at = t.indexOf(w);
      while (at !== -1) {
        found.push({ rule: l.id, label: l.label, text: w, at });
        at = t.indexOf(w, at + w.length);
      }
    }
  }
  return found.sort((a, b) => a.at - b.at);
}
// detect:end

const unescape = (s) => s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
const HIDDEN = /<(p|div|span)\b[^>]*style="[^"]*(?:display:\s*none|font-size:\s*1px|color:\s*#fff(?:fff)?)[^"]*"[^>]*>[\s\S]*?<\/\1>/gi;

function blocksOf(html) {
  const body = html.replace(/^[\s\S]*<body[^>]*>/i, '').replace(/<\/body>[\s\S]*$/i, '').replace(/<!--[\s\S]*?-->/g, '');
  return body.split(/<\/(?:p|div|h1|h2|li)>/i).map((x) => unescape(x.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim()).filter(Boolean);
}

// Every piece of text in the page, hidden or not: what a program that reads the file gets.
export function htmlAsRead(html) { return blocksOf(html); }

// What a person sees: the same, without the elements styled to be invisible.
export function htmlAsSeen(html) { return blocksOf(html.replace(HIDDEN, '')); }

export function hiddenParts(html) {
  return [...html.matchAll(HIDDEN)].map((m) => unescape(m[0].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim());
}

// A zip archive with stored (uncompressed) entries and a fixed date, so the bytes never change.
const CRC = (() => { const t = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
const crc32 = (buf) => { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };

export function zipStore(entries) {
  const parts = [], central = [];
  let offset = 0;
  for (const [name, content] of entries) {
    const n = Buffer.from(name, 'utf8'), data = Buffer.from(content, 'utf8'), crc = crc32(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(0x0800, 6); local.writeUInt16LE(0, 8);
    local.writeUInt16LE(0, 10); local.writeUInt16LE(0x5b21, 12); // 2025-09-01, a fixed date
    local.writeUInt32LE(crc, 14); local.writeUInt32LE(data.length, 18); local.writeUInt32LE(data.length, 22);
    local.writeUInt16LE(n.length, 26); local.writeUInt16LE(0, 28);
    const head = Buffer.alloc(46);
    head.writeUInt32LE(0x02014b50, 0); head.writeUInt16LE(20, 4); head.writeUInt16LE(20, 6); head.writeUInt16LE(0x0800, 8); head.writeUInt16LE(0, 10);
    head.writeUInt16LE(0, 12); head.writeUInt16LE(0x5b21, 14);
    head.writeUInt32LE(crc, 16); head.writeUInt32LE(data.length, 20); head.writeUInt32LE(data.length, 24);
    head.writeUInt16LE(n.length, 28); head.writeUInt32LE(offset, 42);
    parts.push(local, n, data); central.push(head, n);
    offset += 30 + n.length + data.length;
  }
  const cd = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...parts, cd, end]);
}
