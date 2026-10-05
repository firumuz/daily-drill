"""Stitch content/parts/<slug>/NN.json into content/topics/<slug>.json and check numbers against the source review.md.

Usage: python tools/stitch.py <slug> <path-to-review.md>
Prints structural problems and every number in the cards that does not appear in the source text.
"""
import json, re, sys, os, glob

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
slug, src = sys.argv[1], sys.argv[2]
cat = {c["id"]: c for c in json.load(open(os.path.join(ROOT, "content", "catalog.json"), encoding="utf-8"))}
source = open(src, encoding="utf-8").read()
src_norm = source.replace("−", "-").replace("–", "-").replace(",", "")

subs, problems = [], []
files = sorted(glob.glob(os.path.join(ROOT, "content", "parts", slug, "*.json")))
for k, f in enumerate(files, 1):
    try:
        part = json.load(open(f, encoding="utf-8"))
    except Exception as e:
        problems.append(f"{os.path.basename(f)}: invalid JSON ({e})"); continue
    if part.get("pending"):
        subs.append({"title": part["title"], "pending": True}); continue
    sid = f"s{k:02d}"
    for q in part.get("qs", []):
        oks = sum(1 for o in q["opts"] if o.get("ok"))
        if len(q["opts"]) != 5 or oks != 1 or any(not o.get("ok") and not o.get("why") for o in q["opts"]):
            problems.append(f"{sid} bad question: {q['q'][:50]}")
        q.setdefault("ref", f"{cat[slug]['title']} › {part['title']}")
    subs.append({"id": sid, "title": part["title"], "know": part["know"], "qs": part.get("qs", [])})

topic = {"id": slug, "title": cat[slug]["title"], "group": cat[slug]["group"], "subs": subs}

# number check: every numeric token in card text must occur in the source
missing = {}
def walk(x, where):
    if isinstance(x, dict):
        for kk, v in x.items():
            if kk not in ("id",): walk(v, where)
    elif isinstance(x, list):
        for v in x: walk(v, where)
    elif isinstance(x, str):
        t = x.replace("−", "-").replace("–", "-").replace(",", "")
        for n in re.findall(r"\d+(?:\.\d+)?", t):
            if n not in src_norm:
                missing.setdefault(n, set()).add(where)
for s in subs:
    if s.get("pending"): continue
    walk(s, s["id"] + " " + s["title"][:30])

json.dump(topic, open(os.path.join(ROOT, "content", "topics", f"{slug}.json"), "w", encoding="utf-8"), ensure_ascii=False, indent=1)
nq = sum(len(s.get("qs", [])) for s in subs)
print(f"{slug}: {len(subs)} sections ({sum(1 for s in subs if s.get('pending'))} pending), {nq} questions")
for p in problems: print("  PROBLEM", p)
for n, w in sorted(missing.items()): print(f"  NUMBER NOT IN SOURCE: {n}  ({'; '.join(sorted(w))})")
if not problems and not missing: print("  all checks passed")
