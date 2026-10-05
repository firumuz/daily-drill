// Build encrypted content bundles for the Daily Drill PWA.
//   DD_PW_FILM=... DD_PW_GROUP=... node tools/build.mjs
// Passwords come only from env vars; nothing secret is written to disk in plaintext.
// Output: docs/data/a.json (Film: every topic) and docs/data/b.json (group: published topics only).
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { webcrypto as crypto } from "node:crypto";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const ITER = 600000;

const pwFilm = process.env.DD_PW_FILM, pwGroup = process.env.DD_PW_GROUP;
if (!pwFilm || !pwGroup) { console.error("Set DD_PW_FILM and DD_PW_GROUP"); process.exit(1); }
if (pwFilm === pwGroup) { console.error("The two passwords must differ"); process.exit(1); }

const catalog = JSON.parse(readFileSync(`${ROOT}content/catalog.json`, "utf8"));
const topics = {};
for (const f of readdirSync(`${ROOT}content/topics`)) {
  if (!f.endsWith(".json")) continue;
  const t = JSON.parse(readFileSync(`${ROOT}content/topics/${f}`, "utf8"));
  delete t.notion; // source page id stays in content/, not in the app bundle
  topics[t.id] = t;
}

// Guard: no patient identifiers (HN / ID-like runs of 7+ digits) may reach a bundle.
for (const [id, t] of Object.entries(topics)) {
  const hits = JSON.stringify(t).match(/(?<![\d.])\d{7,}(?![\d.])/g);
  if (hits) { console.error(`Possible patient identifier in ${id}: ${hits.join(", ")}`); process.exit(1); }
}

// Guard: every question has 5 options, exactly one correct, and a reason on each wrong option.
for (const [id, t] of Object.entries(topics)) for (const s of t.subs) for (const q of s.qs || []) {
  const ok = q.opts.filter(o => o.ok).length;
  if (q.opts.length !== 5 || ok !== 1 || q.opts.some(o => !o.ok && !o.why)) {
    console.error(`Bad question in ${id}/${s.id}: ${q.q.slice(0, 60)}`); process.exit(1);
  }
}

function bundle(filter) {
  const list = catalog.filter(filter);
  return {
    built: new Date().toISOString().slice(0, 10),
    groups: [...new Set(list.map(c => c.group))],
    topics: list.map(c => topics[c.id] ? { ...topics[c.id], group: c.group } : { id: c.id, title: c.title, group: c.group, subs: [] }),
  };
}

const b64 = u8 => Buffer.from(u8).toString("base64");
async function encrypt(obj, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey({ name: "PBKDF2", salt, iterations: ITER, hash: "SHA-256" }, base,
    { name: "AES-GCM", length: 256 }, false, ["encrypt"]);
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(JSON.stringify(obj)));
  return { v: 1, iter: ITER, salt: b64(salt), iv: b64(iv), ct: b64(new Uint8Array(ct)) };
}

const full = bundle(() => true);
const group = bundle(c => c.published);
writeFileSync(`${ROOT}docs/data/a.json`, JSON.stringify(await encrypt(full, pwFilm)));
writeFileSync(`${ROOT}docs/data/b.json`, JSON.stringify(await encrypt(group, pwGroup)));
const count = b => b.topics.reduce((n, t) => n + t.subs.reduce((m, s) => m + (s.qs || []).length, 0), 0);
console.log(`Film bundle: ${full.topics.length} topics, ${count(full)} questions`);
console.log(`Group bundle: ${group.topics.length} topics, ${count(group)} questions`);
