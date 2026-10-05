# Daily Drill card spec (v1, 2026-10-05)

You turn ONE topic review (`review.md`) into study cards. Output is read by surgeons; a wrong card teaches a wrong fact. **Never add knowledge that is not in review.md.**

## Output files
Write one JSON file per clinical `## ` (H2) section of review.md, in page order:
`C:\Users\DELL\Documents\Claude\DailyDrill\content\parts\<slug>\NN.json` (NN = 01, 02, …).
- Skip `## References` / `## เอกสารอ้างอิง`, Take-home / summary-only sections, and pure meta sections (scope, how-to-read, changelog). Do not write files for them.
- Keep each file under ~10 KB. Use one Write call per file. Write valid UTF-8 JSON (no comments, no trailing commas).
- If a clinical H2 truly cannot support cards (e.g. only a figure), write `{"title":"<H2 text>","pending":true,"reason":"..."}`.

## Schema of one part file
```json
{
  "title": "<H2 heading text, cleaned of numbering/emoji>",
  "know": {
    "blocks": [ {"h": "<short block heading>", "pts": ["<terse point>", "..."], "table": [["col","col"],["v","v"]] } ],
    "tags": ["Author Year · design", "..."],
    "summary": ["<sentence of the section's own summary callout, verbatim>", "..."]
  },
  "qs": [
    {
      "kind": "Case · เลือกการรักษา",
      "q": "<case stem + question>",
      "opts": [ {"t":"<option>","why":"<why wrong, from page>"}, {"t":"<option>","ok":true}, ... 5 total ],
      "lead": "<one-line answer>",
      "pts": ["<1–3 supporting points>"],
      "tags": ["Author Year · design"],
      "ref": "<Topic title> › <H2 title>"
    }
  ]
}
```
`table` is optional (≤4 columns, short cells). `summary` = the H2's own 💡/สรุป callout split into sentences, copied verbatim; `[]` if none.

## Knowledge card (know)
- One block per `### ` sub-section (merge tiny ones), 2–5 points each, **terse note-style** (phrases + `→`, `·`), Thai+English mixed exactly like the source.
- Keep the decision content: indications, choices + reasons, key numbers, what is unknown ("ยังไม่มีคำตอบ").
- Bold key items with `**…**` (only this markup; no HTML, no links).
- Copy every number exactly as written in review.md (same decimals, units, CI). Never compute or round new numbers.
- Do not add drug doses. Do not reproduce long guideline text verbatim; paraphrase a recommendation in one line and name the guideline (e.g. "NCCN v3.2026", "JGCA 7th").
- No figures, no image references, no URLs, no PMIDs in card text.

## Questions (qs)
- Count: **1 question per block that carries a decision or a key number; 3–6 per H2.** Fewer is fine when the section is mostly descriptive. Skip a block rather than invent.
- Style: **case scenario** (the UI labels it "case สมมติ"). Patient details in the stem only where they match a criterion the page uses (age/ASA/stage/size/symptom…). Do not add details that the page does not say change the decision.
- `kind`: "Case · เลือกการรักษา" / "Case · ข้อบ่งชี้" / "Case · counseling" / "Case · วินิจฉัย" / "Case · เทคนิค" / "Case · Trap" (Trap = a tempting wrong move).
- **Single best answer, exactly 5 options, exactly one `"ok":true`.** No "all/none of the above", similar lengths, no negatives like "ข้อใดไม่ถูก".
- **Every wrong option needs `why`: a short reason drawn from the page** (a number, a finding, or "หน้าระบุว่า…"). If you cannot justify a distractor from the page, replace it.
- Vary the position of the correct option across questions (not always B/C).
- If the page says evidence is lacking, the correct answer says so.

## Self-check before finishing
1. Every number in your JSON appears in review.md exactly.
2. Every question: 5 options, 1 correct, 4 `why`.
3. No 7+ digit numbers (no HN/IDs/PMIDs).
Report back: number of part files, total questions, and any H2 skipped with reason. Do not paste the JSON in your reply.
