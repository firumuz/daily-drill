# Daily Drill

PWA สำหรับทบทวน MIS topic review: เลือกเรื่อง → หัวข้อ → การ์ดความรู้ → โจทย์ case 5 ตัวเลือก

- `docs/` = ตัวแอปที่ขึ้น GitHub Pages · เนื้อหาอยู่ใน `docs/data/*.json` แบบเข้ารหัส (AES-GCM, key จาก PBKDF2-SHA256 600k)
- เนื้อหา plaintext (`content/`) ไม่อยู่ใน repo นี้
- build: `DD_PW_FILM=… DD_PW_GROUP=… node tools/build.mjs`

สรุปโดยใช้ AI ช่วยจาก literature ที่อ้างอิง ใช้เพื่อทบทวน ไม่ใช่ guideline
