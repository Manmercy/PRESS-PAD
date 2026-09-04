# PRESS//PAD v0.1.2 — GitHub Lite

Standalone HTML/CSS/JavaScript music prototype, packaged below 25 MB total. Includes the mobile Home, Login, Settings and Logout flow.

## อัปโหลดขึ้น GitHub

1. แตกไฟล์ `press-pad-v0.1.2-github-lite.zip` ก่อน
2. เปิดโฟลเดอร์ `press-pad-v0.1.2-github-lite` แล้วเลือกไฟล์และโฟลเดอร์ **ข้างใน** ไปอัปโหลดที่ repository
3. ให้ `index.html`, `css`, `js`, `data` และ `assets` อยู่ที่ระดับแรกของ repository
4. อย่าอัปโหลดโฟลเดอร์ `PRESS::PAD` ทั้งหมด เพราะมีต้นฉบับ เวอร์ชันเก่า และ ZIP หลายชุด
5. หากใช้ GitHub Pages ให้เลือก branch ที่อัปโหลดและโฟลเดอร์ `/ (root)` ใน Settings → Pages

ZIP เป็นไฟล์สำหรับส่งต่อเท่านั้น GitHub จะไม่แตก ZIP เป็นเว็บไซต์ให้อัตโนมัติ ชุดนี้ยังไม่ได้ถูกอัปโหลดหรือเผยแพร่ไปยัง GitHub

## Media quality

All 12 tracks retain their full-length content. Lite audio is a lossy AAC-LC preview copy at an 80 kbps target and 32 kHz stereo; small duration differences under 0.15 seconds come from encoding. Background images are optimized WebP copies. Original assets and the higher-quality `press-pad-v0.1.2-github` distribution remain untouched outside this folder.

Some release cover images are not supplied; the existing CSS artwork fallback is intentional. Login audio autoplay depends on browser permission and may require a tap. Login is a local prototype session, not production authentication.

## Local preview and validation

Open `index.html`, or serve this folder with a local static web server. No build step or dependency installation is required. With Node.js installed, run `npm run check` to validate assets, audio hashes, package size and mobile session handlers. These checks do not replace browser or listening tests.

Audio inventory and integrity hashes: `docs/lite-manifest.json`.
