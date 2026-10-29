# แผนการพัฒนาและการตรวจสอบ PromptStudio

เอกสารนี้ต่อจาก `ai-studio-design.md` (แบบออกแบบ) และ `promptstudio/README.md` (สิ่งที่ทำแล้ว)
ครอบคลุม 2 เรื่อง: **(A) ตรวจสอบของที่มีอยู่ให้ผ่านบนเครื่องจริง** และ **(B) แผนพัฒนาเฟสถัดไปพร้อมวิธีทดสอบของแต่ละเฟส**

---

## สถานะปัจจุบัน

| ส่วน | สถานะ | ตรวจสอบแล้วอย่างไร |
|---|---|---|
| Create: Text / Image / Voice / Music / Video | โค้ดเสร็จ | typecheck + build ผ่าน, UI smoke test ด้วย Chromium แบบ mock API |
| Video Editor + FFmpeg export | โค้ดเสร็จ | export จริงด้วย FFmpeg บน Linux ได้ MP4 ถูกต้อง, UI smoke test |
| Library / Models / Settings | โค้ดเสร็จ | UI smoke test |
| **ยังไม่เคยรันบน Windows จริงกับคีย์ OpenRouter จริง** | ❗ | ต้องทำใน Phase 0 |

สิ่งที่ยังไม่ได้ยืนยันกับ API จริง (ต้องเช็กใน Phase 0):
1. ชื่อฟิลด์ของ endpoint วิดีโอ `/api/v1/videos` (id, status, url) อ่านแบบเผื่อหลายชื่อไว้แล้วใน `readVideoState()`
2. รูปแบบคำขอของ Lyria 3 (`modalities: ["text","audio"]` + `audio.format` + stream)
3. ชื่อ voice ของแต่ละโมเดล TTS และฟิลด์ `instructions`, `speed`
4. ฟิลด์ราคาในแคตตาล็อกสำหรับโมเดลเพลง/วิดีโอ (`pricing.request`, `pricing.video`)

---

## Phase 0 — ตรวจสอบของเดิมบนเครื่องจริง (ประมาณ 1 สัปดาห์)

### 0.1 เตรียมเครื่อง Windows
```powershell
git clone https://github.com/wanjantp/images
cd images; git checkout docs/ai-studio-design; cd promptstudio
npm install          # ดาวน์โหลด Electron และ ffmpeg-static
npm run typecheck
npm run dev
```
ผ่านเมื่อ: หน้าต่างเปิด, ไม่มี error ใน DevTools (Ctrl+Shift+I), Settings แสดง "encrypted with Windows DPAPI"

### 0.2 Checklist ทดสอบด้วยมือ (ใช้โมเดลถูก ๆ งบรวมไม่เกิน $2)

| # | ขั้นตอน | ผลที่คาดหวัง |
|---|---|---|
| 1 | Settings → ใส่คีย์ → Save & test | แสดงเครดิตคงเหลือ, sidebar แสดงยอด |
| 2 | Models → กรอง Image / Speech / Music / Video | แต่ละหมวดมีโมเดลอย่างน้อย 1 ตัว ราคาไม่เป็น "–" ทั้งหมด |
| 3 | Create → Text → GPT-4o mini → prompt สั้น | ได้ข้อความ, Library มีไฟล์ .md, cost ไม่เป็น "–" |
| 4 | Image → Gemini Flash Image → 2 ภาพ 16:9 | ได้ 2 ไฟล์ PNG/JPG ใน Library, cost แสดง |
| 5 | Image + ภาพอ้างอิง 1 ภาพ | โมเดลรับภาพอ้างอิงได้ไม่ error |
| 6 | Enhance prompt ทุกโหมด | ข้อความถูกเขียนใหม่ ไม่ error |
| 7 | Voice → gpt-4o-mini-tts → สคริปต์ไทย 2 ย่อหน้า | ได้ mp3 ฟังได้ ออกเสียงไทยถูก |
| 8 | Voice → สคริปต์ยาว 6,000 ตัวอักษร | ได้หลายไฟล์ (chunk) ต่อเนื่องกัน |
| 9 | Music → Lyria 3 Clip → บรรเลง | ได้ mp3 30 วินาที **ถ้า error "no audio" บันทึก response ไว้** |
| 10 | Video → โมเดลถูกสุด 5 วินาที | Jobs bar แสดง polling → done, ไฟล์ mp4 โผล่ใน Library |
| 11 | ระหว่าง job วิดีโอ ปิดโปรแกรมแล้วเปิดใหม่ | job กลับมา polling ต่อและเสร็จ |
| 12 | Editor → ใส่ภาพ 2 + วิดีโอ 1 + เสียงพากย์ 1 | คำบรรยายถูกสร้างอัตโนมัติจากเสียงพากย์ |
| 13 | Editor → split, ลากย้าย, fade, Ken Burns, undo/redo | พรีวิวตรงกับที่ตั้งค่า |
| 14 | Export 1080p และ 9:16 | MP4 เปิดได้ใน Windows Media Player, คำบรรยาย/เสียงตรงกับพรีวิว |
| 15 | Export แล้วกด Cancel กลางทาง | FFmpeg หยุด ไม่มีไฟล์ค้าง |
| 16 | Import mp4/mp3/png จากเครื่อง | เข้า Library และใช้ใน Editor ได้ |
| 17 | ปิดโปรแกรม → เปิดใหม่ | โปรเจกต์ Editor ล่าสุดกลับมาครบ |
| 18 | `npm run dist:win` → ติดตั้ง → รัน | export ได้ (ffmpeg ถูก unpack จาก asar) |

ผลการทดสอบบันทึกใน `docs/qa-log.md` (วันที่, เวอร์ชัน, ข้อ, ผ่าน/ไม่ผ่าน, หมายเหตุ)

### 0.3 ย้ายเทสต์เข้า repo และตั้ง CI
- เพิ่ม **vitest** และย้ายเทสต์ที่เคยรันใน scratchpad มาเป็นไฟล์ถาวร:
  - `tests/pricing.test.ts` — `supportsMode`, `isMusicModel`, `estimateCost` ทุกโหมด
  - `tests/timeline.test.ts` — `layoutVisual`, `projectDuration`
  - `tests/audiostream.test.ts` — SSE หลาย chunk, JSON เดี่ยว, ไม่มี audio
  - `tests/ffgraph.test.ts` — สร้าง args แล้วรัน FFmpeg จริงถ้ามีในเครื่อง, ตรวจ duration/codec ด้วย ffprobe
  - `tests/chunkText.test.ts` — ตัดสคริปต์ยาวไม่เกินขีดจำกัด ไม่ตัดกลางประโยค
- เพิ่ม **Playwright renderer smoke** (`tests/ui/*.spec.ts`) ใช้ mock `window.api` ตามที่ทำไว้: Create ทุกโหมด, Editor add/split/caption/export, Library, Models, Settings
- `package.json`: `"test": "vitest run"`, `"test:ui": "playwright test"`
- GitHub Actions `.github/workflows/ci.yml` บน `windows-latest`: `npm ci` → typecheck → test → build → `electron-builder --win` → อัปโหลด installer เป็น artifact
- ผ่านเมื่อ: CI เขียวบน Windows runner

### 0.4 แก้ตามผลจริง
- ปรับฟิลด์วิดีโอ/Lyria/TTS ตามที่เจอ และบันทึก response ตัวอย่างไว้ใน `docs/openrouter-contracts.md`
- ถ้าคีย์ราคาของเพลง/วิดีโอไม่ตรง ให้แก้ `estimateCost()` ให้ใช้คีย์ที่ถูก

---

## Phase 1 — ทรานซิชันและคุณภาพ Editor (1–2 สัปดาห์)

**ขอบเขต**
- ทรานซิชันระหว่างคลิปบนแทร็กหลัก: crossfade, fade-through-black, slide, wipe (FFmpeg `xfade` + `acrossfade`)
- ลากขอบคลิปเพื่อ trim บนไทม์ไลน์, ลากสลับลำดับคลิปหลัก
- Snap หัวอ่านเข้ากับขอบคลิป, ripple delete
- Waveform ของเสียง (คำนวณฝั่ง main ด้วย FFmpeg เป็น PNG แคช)
- Proxy preview: ย่อวิดีโอใหญ่เป็น 540p ตอนนำเข้าเพื่อให้พรีวิวลื่น

**ไฟล์หลัก** `src/shared/timeline.ts` (เพิ่ม `transition` ต่อคลิป), `src/main/ffgraph.ts`, `components/editor/Timeline.tsx`, `Preview.tsx`

**การตรวจสอบ**
- unit: `ffgraph` กับทรานซิชัน 2–4 คลิป → duration รวม = Σduration − Σtransition (คลาดเคลื่อน ≤ 1 เฟรม)
- unit: ข้อจำกัด transition ≤ min(duration ข้างเคียง)/2
- UI: ลาก trim แล้วค่าใน Inspector เปลี่ยนตาม, undo ย้อนได้
- manual: export 9:16 ที่มีทรานซิชัน 3 แบบ เทียบกับพรีวิว

---

## Phase 2 — Scene Builder แบบ Google Flow (2–3 สัปดาห์)

**ขอบเขต**
- หน้า **Scenes**: ใส่หัวข้อหรือสคริปต์ → LLM สร้างสตอรี่บอร์ด JSON (ฉาก, ช็อต, prompt ภาพ/วิดีโอ, บทพากย์, ความยาว) ด้วย `response_format: json_schema`
- การ์ดช็อต: สร้างภาพ → สร้างวิดีโอจากภาพ (image-to-video) → เลือก take, regenerate, extend
- **Ingredients**: ภาพอ้างอิงตัวละคร/สินค้า/สไตล์ ใช้ซ้ำทุกช็อต
- ปุ่ม "สร้างทั้งหมด" ใช้ job queue เดิม (ขยายให้รองรับงานภาพและ TTS แบบคิวด้วย) พร้อมงบสูงสุดต่อครั้ง
- ปุ่ม "ส่งไป Editor": วางช็อตเรียงบนแทร็กหลัก, พากย์บนแทร็ก Voice, คำบรรยายอัตโนมัติ

**ไฟล์หลัก** `src/shared/storyboard.ts`, `src/main/storyboard.ts` (schema + prompt), `src/main/jobs.ts` (ขยาย), `components/scenes/*`

**การตรวจสอบ**
- unit: schema validation ของ JSON จาก LLM (ใช้ `zod`), กรณี LLM ส่ง field ขาด
- unit: แปลงสตอรี่บอร์ด → EditorProject แล้ว `projectDuration` = ผลรวมช็อต
- integration (ใช้คีย์จริง, โมเดลถูก): หัวข้อสั้น → สตอรี่บอร์ด 3 ฉาก ภายใน 30 วินาที
- manual: สร้างวิดีโอ 30 วินาที 4 ช็อตจบใน Editor และ export ได้

---

## Phase 3 — Design Canvas แบบ Canva (3 สัปดาห์)

**ขอบเขต**
- หน้า **Design**: แคนวาสหลายหน้า (Konva), เลเยอร์, ข้อความ, รูปทรง, รูปภาพ, จัดแนว, จัดกลุ่ม
- ขนาดสำเร็จรูป: thumbnail YouTube, โพสต์ IG, สตอรี่, โปสเตอร์ A4
- **AI Fill**: เลือกกรอบ → สร้างภาพให้พอดีกรอบ
- **Brand Kit**: โลโก้ สี ฟอนต์ (รองรับฟอนต์ไทยจากเครื่อง)
- **Magic Resize**: แปลงขนาดโดย LLM เสนอ layout ใหม่
- ส่งออก PNG/JPG/PDF และ "ส่งไป Editor" เป็นภาพคลิป

**การตรวจสอบ**
- unit: serialize/deserialize เอกสารแคนวาส round-trip เท่ากัน
- unit: magic resize รักษา aspect ของรูปและไม่ให้ข้อความล้นกรอบ
- UI: เพิ่ม/ลบ/ย้ายเลเยอร์, undo, export PNG ขนาดตรงกับที่ตั้ง
- visual regression: screenshot เทียบกับ baseline ด้วย Playwright

---

## Phase 4 — Pipeline กดครั้งเดียว + Copilot (2 สัปดาห์)

**ขอบเขต**
- **Pipeline**: หัวข้อ → สคริปต์ → สตอรี่บอร์ด → ภาพ/วิดีโอ → TTS → คำบรรยาย → เพลง → Editor → export อัตโนมัติ
- เทมเพลต: explainer, โฆษณาสินค้า, บทเรียน e-learning, สรุปข่าว, สไลด์โซเชียล
- Node graph ที่แก้ได้ (เปลี่ยนโมเดล ข้ามขั้น) บันทึกเป็น JSON
- หยุดเมื่อถึงงบ, ทำต่อจากขั้นที่ค้างหลังปิดโปรแกรม, batch จาก CSV
- **Copilot**: แชทที่สั่งงานผ่าน tool calling (`create_storyboard`, `generate_shot`, `add_caption`, …) และบอกค่าใช้จ่ายก่อนทำ

**การตรวจสอบ**
- unit: engine รัน node ตามลำดับ dependency, retry, resume จาก checkpoint
- unit: budget guard หยุดก่อนเกินงบ
- integration: pipeline explainer 20 วินาทีด้วยโมเดลถูกสุด จบภายใน 10 นาที งบ < $0.50
- manual: Copilot สั่ง "ทำวิดีโอ 30 วิ ภาษาไทย เสียงผู้หญิง" แล้วได้ผลครบ

---

## Phase 5 — ภาษาไทย, เผยแพร่, และความพร้อมแจกจ่าย (2 สัปดาห์)

**ขอบเขต**
- i18n (react-i18next) UI ไทย/อังกฤษ สลับใน Settings
- อัปโหลดตรง YouTube (OAuth) และ TikTok (ถ้า API เปิด)
- Auto-update (electron-updater + GitHub Releases), code signing
- Crash report แบบ opt-in, หน้า Usage dashboard รายวัน/รายโมเดล
- เอกสารผู้ใช้ภาษาไทย

**การตรวจสอบ**
- unit: ทุก key แปลครบทั้งสองภาษา (สคริปต์ตรวจ key หาย)
- manual: ติดตั้งเวอร์ชันเก่า → auto-update เป็นเวอร์ชันใหม่สำเร็จ
- manual: อัปโหลด YouTube เป็น private สำเร็จ

---

## กลยุทธ์การตรวจสอบโดยรวม

```
            ┌────────────────────────┐
            │  Manual QA (Windows)   │  ทุก release: checklist 0.2 + ของเฟสนั้น
            ├────────────────────────┤
            │  Integration (คีย์จริง) │  รายสัปดาห์ / ก่อน release, โมเดลถูกสุด, งบ ≤ $1
            ├────────────────────────┤
            │  UI smoke (Playwright) │  ทุก commit, mock window.api, ไม่ใช้เครดิต
            ├────────────────────────┤
            │  Unit (vitest)         │  ทุก commit: pricing, timeline, ffgraph, audiostream, storyboard
            └────────────────────────┘
```

**ก่อน commit ทุกครั้ง** `npm run typecheck && npm test && npm run build`
**ก่อน release** CI เขียวบน Windows + checklist ด้วยมือผ่านทุกข้อ + อัปเดต `docs/qa-log.md`

**การควบคุมค่าใช้จ่ายของการทดสอบ**
- เทสต์อัตโนมัติไม่เรียก OpenRouter จริง (mock ทั้งหมด)
- Integration test ใช้ env `OPENROUTER_API_KEY` ของคีย์ทดสอบที่ตั้ง credit limit ไว้ต่ำ
- ใช้โมเดลถูกสุดต่อหมวดและเก็บผลเป็น fixture ไว้รันซ้ำ

---

## ความเสี่ยงและแผนรับมือ

| ความเสี่ยง | ผลกระทบ | แผนรับมือ |
|---|---|---|
| OpenRouter เปลี่ยนฟิลด์ API วิดีโอ/เพลง (ยัง preview) | โหมดนั้นใช้ไม่ได้ | อ่านฟิลด์แบบเผื่อหลายชื่อ, integration test รายสัปดาห์, แจ้ง error พร้อม response ดิบ |
| ค่าใช้จ่ายบานปลายตอน pipeline | ผู้ใช้เสียเงินเกิน | ประมาณก่อนทำ, budget guard, ยืนยันเมื่อเกิน threshold |
| พรีวิวไม่ตรง export | ผู้ใช้สับสน | คำบรรยายใช้ PNG เดียวกันทั้งสองทาง, เทสต์เทียบ duration, proxy preview |
| ฟอนต์ไทยในคำบรรยาย | สระลอย/ตัดคำผิด | ใช้ฟอนต์จากเครื่อง (Tahoma, Sarabun), ทดสอบข้อความไทยใน checklist |
| Electron/ffmpeg ขนาดใหญ่ | installer > 300 MB | ตัด locale ที่ไม่ใช้, ใช้ ffmpeg build แบบ minimal |

---

## ลำดับเวลาโดยรวม

| เฟส | เนื้อหา | ระยะเวลา |
|---|---|---|
| 0 | ตรวจสอบของเดิมบน Windows จริง + เทสต์ + CI | 1 สัปดาห์ |
| 1 | ทรานซิชัน + คุณภาพ Editor | 1–2 สัปดาห์ |
| 2 | Scene Builder | 2–3 สัปดาห์ |
| 3 | Design Canvas | 3 สัปดาห์ |
| 4 | Pipeline + Copilot | 2 สัปดาห์ |
| 5 | ภาษาไทย เผยแพร่ แจกจ่าย | 2 สัปดาห์ |
| รวม | | ประมาณ 11–13 สัปดาห์ |
