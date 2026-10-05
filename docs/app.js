"use strict";
// Daily Drill — static PWA. Content arrives as AES-GCM bundles; the password derives the key (PBKDF2-SHA256).
// a.json = full set (owner), b.json = published set (group). Progress lives only in this browser.

const $ = id => document.getElementById(id);
const stage = $("stage");
const L = "ABCDE";
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  del(k) { try { localStorage.removeItem(k); } catch {} },
};
let DATA = null, MODE = "", group = "", view = "home", topicId = null, run = null, picked = -1;
let progress = store.get("dd.progress", {});

const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const rich = s => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>");
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

async function decrypt(file, pw) {
  const r = await fetch(file, { cache: "no-cache" });
  if (!r.ok) throw new Error("fetch");
  const e = await r.json();
  const base = await crypto.subtle.importKey("raw", new TextEncoder().encode(pw), "PBKDF2", false, ["deriveKey"]);
  const key = await crypto.subtle.deriveKey({ name: "PBKDF2", salt: unb64(e.salt), iterations: e.iter, hash: "SHA-256" },
    base, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unb64(e.iv) }, key, unb64(e.ct));
  return JSON.parse(new TextDecoder().decode(pt));
}

async function unlock(pw) {
  for (const [file, mode] of [["data/a.json", "ทุกเรื่อง"], ["data/b.json", "ชุดกลุ่ม"]]) {
    try { DATA = await decrypt(file, pw); MODE = mode; return true; } catch (e) { if (e.message === "fetch") throw e; }
  }
  return false;
}

$("lock-form").addEventListener("submit", async e => {
  e.preventDefault();
  const pw = $("pw").value; $("lock-err").textContent = ""; $("unlock").disabled = true; $("unlock").textContent = "กำลังเปิด…";
  try {
    if (await unlock(pw)) { if ($("remember").checked) store.set("dd.pw", pw); start(); }
    else $("lock-err").textContent = "รหัสผ่านไม่ถูกต้อง ลองอีกครั้ง";
  } catch { $("lock-err").textContent = "โหลดข้อมูลไม่ได้ ตรวจสอบอินเทอร์เน็ตแล้วลองใหม่"; }
  $("unlock").disabled = false; $("unlock").textContent = "เปิด";
});
$("logout").onclick = () => { store.del("dd.pw"); DATA = null; $("main").hidden = true; $("lock").hidden = false; $("pw").value = ""; };

function start() {
  $("lock").hidden = true; $("main").hidden = false;
  $("mode").textContent = MODE; $("built").textContent = ` · ข้อมูล ${DATA.built}`;
  group = store.get("dd.group", DATA.groups[0]); if (!DATA.groups.includes(group)) group = DATA.groups[0];
  view = "home"; render();
}

// ---------- helpers over data ----------
const topicsIn = g => DATA.topics.filter(t => t.group === g);
const readySubs = t => t.subs.filter(s => s.id && !s.pending);
const prog = (t, s) => (progress[t.id] || {})[s.id];
const learned = t => readySubs(t).filter(s => prog(t, s)).length;
const topicDone = t => readySubs(t).length > 0 && learned(t) === t.subs.length; // every subtopic must have cards and be done
const curTopic = () => DATA.topics.find(t => t.id === topicId);

function nav(title, p) {
  const show = view !== "home"; $("nav").hidden = !show; $("chips").hidden = show;
  $("nav-t").textContent = title || ""; $("nav-p").textContent = p || "";
}
function render() { if (view === "home") home(); else if (view === "topic") topic(); else step(); }
function toast(t) { $("toast").textContent = t; clearTimeout(toast.t); toast.t = setTimeout(() => $("toast").textContent = "", 3000); }

function home() {
  nav();
  $("chips").innerHTML = DATA.groups.map(g => `<button class="chip" aria-pressed="${g === group}" data-g="${esc(g)}">${esc(g)}</button>`).join("");
  $("chips").querySelectorAll(".chip").forEach(c => c.onclick = () => { group = c.dataset.g; store.set("dd.group", group); render(); });
  const list = topicsIn(group), done = list.filter(topicDone).length;
  stage.innerHTML = `<div class="prog">
      <div class="prog-row"><span class="prog-n">${esc(group)}</span><span class="prog-c">เรียนแล้ว <b>${done}</b> · ทั้งหมด <b>${list.length}</b> เรื่อง</span></div>
      <div class="bar"><i style="width:${list.length ? done / list.length * 100 : 0}%"></i></div></div>
    <div class="list">${list.map(t => {
      const tot = t.subs.length, n = learned(t), has = readySubs(t).length > 0, fin = topicDone(t);
      return `<button class="row ${has ? "" : "off"}" data-id="${esc(t.id)}">
        <span class="rt">${esc(t.title)}<small>${has ? `เรียนแล้ว ${n} / ${tot} หัวข้อ` : "ยังไม่มีการ์ด"}</small></span>
        ${has ? `<span class="pill ${fin ? "done" : "ready"}">${fin ? "✓ ครบ" : `${n}/${tot}`}</span><span class="chev">›</span>` : ""}</button>`;
    }).join("")}</div>`;
  stage.querySelectorAll(".row").forEach(r => r.onclick = () => {
    const t = DATA.topics.find(x => x.id === r.dataset.id);
    if (!readySubs(t).length) return toast("เรื่องนี้ยังไม่มีการ์ด");
    topicId = t.id; view = "topic"; render(); window.scrollTo(0, 0);
  });
}

function topic() {
  const t = curTopic(); nav(t.group);
  const ready = readySubs(t), n = learned(t), tot = t.subs.length;
  stage.innerHTML = `<h2 class="topic-h">${esc(t.title)}</h2>
    <div class="prog"><div class="prog-row"><span class="prog-c">เรียนแล้ว <b>${n}</b> · ทั้งหมด <b>${tot}</b> หัวข้อ</span></div>
      <div class="bar"><i style="width:${n / tot * 100}%"></i></div></div>
    <button class="btn-all" id="all">ทำทุกหัวข้อที่มีการ์ดต่อกัน · ${ready.length} หัวข้อ</button>
    <div class="sec-h">หัวข้อในเรื่องนี้ (ตามลำดับในหน้า)</div>
    <div class="list">${t.subs.map((s, k) => {
      const ok = s.id && !s.pending, sc = ok && prog(t, s);
      return `<button class="row ${ok ? "" : "off"}" data-k="${k}">
        <span class="rt">${esc(s.title)}<small>${ok ? `ความรู้ 1 ใบ · คำถาม ${s.qs.length} ข้อ` : "ยังไม่มีการ์ด"}</small></span>
        ${sc ? `<span class="pill done">✓ ถูก ${sc.r}/${sc.n}</span>` : ok ? `<span class="pill ready">ยังไม่เรียน</span>` : ""}
        ${ok ? `<span class="chev">›</span>` : ""}</button>`;
    }).join("")}</div>`;
  $("all").onclick = () => begin(ready.map(s => s.id));
  stage.querySelectorAll(".row").forEach(r => r.onclick = () => {
    const s = t.subs[+r.dataset.k]; if (!s.id || s.pending) return toast("หัวข้อนี้ยังไม่มีการ์ด");
    begin([s.id]);
  });
}

function begin(ids) {
  const t = curTopic(), steps = [];
  ids.forEach(id => { const s = t.subs.find(x => x.id === id); steps.push(["k", id]); s.qs.forEach((_, qi) => steps.push(["q", id, qi])); steps.push(["r", id]); });
  run = { steps, i: 0, tmp: {} }; picked = -1; view = "run"; render(); window.scrollTo(0, 0);
}
function next() {
  run.i++; picked = -1;
  if (run.i >= run.steps.length) { view = "topic"; run = null; }
  render(); window.scrollTo({ top: 0, behavior: "smooth" });
}

function step() {
  const t = curTopic(), st = run.steps[run.i], s = t.subs.find(x => x.id === st[1]);
  const total = run.steps.filter(x => x[0] !== "r").length, done = run.steps.slice(0, run.i).filter(x => x[0] !== "r").length;
  nav(s.title, st[0] === "r" ? "" : `${done + 1} / ${total}`);
  if (st[0] === "k") return knowCard(t, s);
  if (st[0] === "r") return result(t, s);
  return question(t, s, s.qs[st[2]]);
}

function flagText(t, s, q) {
  return `🚩 Daily Drill · ${t.title} › ${s.title}${q ? `\nคำถาม: ${q.q}` : " (การ์ดความรู้)"}\nปัญหาที่เจอ: `;
}
async function flag(t, s, q) {
  const txt = flagText(t, s, q);
  try { await navigator.clipboard.writeText(txt); toast("คัดลอกข้อความ 🚩 แล้ว วางส่งให้ผู้ดูแลพร้อมบอกว่าผิดตรงไหน"); }
  catch { openSheet("🚩 คัดลอกข้อความนี้ส่งให้ผู้ดูแล", "แจ้งข้อที่น่าจะผิด", [txt]); }
}

function knowCard(t, s) {
  const k = s.know;
  stage.innerHTML = `<article class="card know">
    <div class="crumb">${esc(t.title)} › ${esc(s.title)}</div>
    <span class="kind kn">ความรู้ · หัวข้อ</span>
    <h2 class="q">${esc(s.title)}</h2>
    ${k.blocks.map(b => `<section class="blk"><h4>${esc(b.h)}</h4>
      ${b.table ? `<div class="tbl"><table>${b.table.map((r, ri) => `<tr>${r.map(x => ri ? `<td>${esc(x)}</td>` : `<th>${esc(x)}</th>`).join("")}</tr>`).join("")}</table></div>` : ""}
      <ul class="kpts">${b.pts.map(p => `<li>${rich(p)}</li>`).join("")}</ul></section>`).join("")}
    <div class="tag">${k.tags.map(x => `<span>${esc(x)}</span>`).join("")}</div>
    <div class="links">${k.summary && k.summary.length ? `<button class="ghost" id="read">💡 สรุปของหน้า</button>` : ""}<button class="ghost flag" id="flag">🚩 น่าจะผิด</button></div>
    <button class="reveal" id="gotit">เข้าใจแล้ว ไปที่คำถาม</button>
  </article>`;
  if ($("read")) $("read").onclick = () => openSheet("สรุปท้ายหัวข้อ (ข้อความจากหน้า)", s.title, k.summary);
  $("flag").onclick = () => flag(t, s);
  $("gotit").onclick = next;
}

function question(t, s, c) {
  const right = picked >= 0 && c.opts[picked].ok;
  stage.innerHTML = `<article class="card">
    <div class="crumb">${esc(c.ref || t.title + " › " + s.title)}</div>
    <span class="kind ${/Trap/.test(c.kind) ? "trap" : ""}">${esc(c.kind)}</span>
    <div class="case-lbl">case สมมติ</div>
    <h2 class="q">${esc(c.q)}</h2>
    <div class="opts">${c.opts.map((o, k) => {
      let cls = "opt"; if (picked >= 0) cls += o.ok ? " is-right" : k === picked ? " is-wrong" : " is-dim";
      return `<button class="${cls}" data-k="${k}" ${picked >= 0 ? "disabled" : ""}><b>${L[k]}</b><span>${esc(o.t)}${picked >= 0 && !o.ok ? `<small>${esc(o.why)}</small>` : ""}</span></button>`;
    }).join("")}</div>
    ${picked >= 0 ? `<div class="ans">
      <div class="verdict ${right ? "v-ok" : "v-no"}">${right ? "ถูกต้อง" : "ยังไม่ใช่ · คำตอบคือ " + L[c.opts.findIndex(o => o.ok)]}</div>
      <div class="lead">${esc(c.lead)}</div>
      <ul>${c.pts.map(p => `<li>${rich(p)}</li>`).join("")}</ul>
      <div class="tag">${c.tags.map(x => `<span>${esc(x)}</span>`).join("")}</div>
      <div class="links"><button class="ghost" id="read">📖 การ์ดความรู้หัวข้อนี้</button><button class="ghost flag" id="flag">🚩 น่าจะผิด</button></div>
    </div>
    <button class="reveal" id="nx">ข้อต่อไป</button>` : ""}
  </article>`;
  if (picked < 0) {
    stage.querySelectorAll(".opt").forEach(b => b.onclick = () => {
      picked = +b.dataset.k; const m = run.tmp[s.id] || (run.tmp[s.id] = { r: 0, n: 0 });
      m.n++; if (c.opts[picked].ok) m.r++; render();
    });
    return;
  }
  $("read").onclick = () => openSheet(`${t.title} › ${s.title}`, s.title, s.know.blocks.flatMap(b => b.pts.map(p => `${b.h}: ${p.replace(/\*\*/g, "")}`)));
  $("flag").onclick = () => flag(t, s, c);
  $("nx").onclick = next;
}

function result(t, s) {
  const m = run.tmp[s.id] || { r: 0, n: s.qs.length };
  progress[t.id] = progress[t.id] || {}; progress[t.id][s.id] = { r: m.r, n: m.n, at: new Date().toISOString().slice(0, 10) };
  store.set("dd.progress", progress);
  const last = run.i === run.steps.length - 1;
  stage.innerHTML = `<div class="card res"><div class="crumb">จบหัวข้อ</div><h2>${esc(s.title)}</h2>
    <div>ตอบถูก ${m.r} / ${m.n} ข้อ</div>
    <button class="reveal" id="nx">${last ? "กลับไปรายการหัวข้อ" : "หัวข้อถัดไป"}</button>
    ${last ? "" : `<button class="ghost" id="stop">พอแค่นี้ กลับไปรายการ</button>`}</div>`;
  $("nx").onclick = next;
  if (!last) $("stop").onclick = () => { view = "topic"; run = null; render(); };
}

function openSheet(crumb, title, body) {
  $("sh-crumb").textContent = crumb; $("sh-title").textContent = title;
  $("sh-body").innerHTML = body.map(b => `<li>${rich(b)}</li>`).join(""); $("sheet").hidden = false; $("sh-close").focus();
}
$("sh-close").onclick = () => $("sheet").hidden = true;
$("sheet").onclick = e => { if (e.target.id === "sheet") $("sheet").hidden = true; };
$("back").onclick = () => { if (view === "run") { view = "topic"; run = null; } else view = "home"; render(); window.scrollTo(0, 0); };

if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});

(async () => {
  const saved = store.get("dd.pw", null);
  if (!saved) return;
  try { if (await unlock(saved)) start(); else store.del("dd.pw"); } catch {}
})();
