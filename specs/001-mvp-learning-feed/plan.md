# Implementation Plan: JoLike English MVP — YouTube to Learning Feed

**Branch**: `001-mvp-learning-feed` | **Date**: 2026-03-31 | **Spec**: [spec.md](./spec.md)

## Summary

使用者貼上 YouTube URL，系統取得英文字幕後透過 `compromise.js` NLP + COCA 詞頻表 + CC-CEDICT 字典（零 API 成本）分析出關鍵單字、片語、句型，並生成可滑動的學習 Feed。每張卡片包含 3～6 秒影片片段、高亮關鍵字、中文解釋、重播/慢速/跟讀功能，以及會了/收藏/不熟互動標記。技術選型為 Vue 3 + Vite MPA + Cloudflare Pages Functions + Cloudflare D1。

---

## Technical Context

**Language/Version**: JavaScript (ES2022)  
**Primary Dependencies**:
- Frontend: **Vue 3 + Vite**，MPA 架構（多頁面，無 SPA Router）
- Styles: **Tailwind CSS v3**（`@tailwind base/components/utilities`）
- Backend API: **Cloudflare Pages Functions** (`functions/api/`)，原生 fetch handler，不引入 Express / Hono
- Database: **Cloudflare D1 (SQLite)**，parameterized SQL，binding `DB`
- NLP 分析: `compromise.js`（詞性標記 + 片語提取）+ 內嵌 COCA 5000 詞頻表 + CC-CEDICT 子集字典（零 API 成本，**在瀏覽器端執行**）
- YouTube 字幕: 後端呼叫公開 timedtext 端點（`/api/timedtext?v={id}&lang=en`），不需 API Key
- 音訊錄音: Web Audio API + MediaRecorder API（原生瀏覽器，無需第三方套件）

**Storage**:
- Cloudflare D1：Video + raw_transcript 持久化（支援快取同 URL，避免重複呼叫 YouTube）
- 瀏覽器記憶體：LearningCard 陣列（由前端 NLP 動態生成，不持久化）
- localStorage：當次 session 的卡片互動狀態（會了/不熟）

**Testing**: Vitest（單元）、Playwright（E2E smoke）  
**Target Platform**: Mobile Web（iOS Safari 16+、Android Chrome 100+），不做 Native App  
**Project Type**: Web Application — Cloudflare Pages（前端）+ Pages Functions（後端 API）  
**Performance Goals**: YouTube URL → 第一張卡片 < 10 秒；卡片切換 60fps；錄音延遲 < 300ms  
**Constraints**: 無帳號系統、單手操作、每次 session 獨立；不引入 Vue Router  
**Scale/Scope**: MVP 單一使用者體驗驗證，不考慮並發/擴展

---

## Constitution Check

| 原則 | 符合？ | 說明 |
|------|--------|------|
| 原則 | 符合？ | 說明 |
|------|--------|------|
| I. Learning-First | ✅ | 所有 UI 決策以卡片學習效果為優先 |
| II. Micro-Session Design | ✅ | 設計目標 3～8 分鐘完成，單手操作 |
| III. Real-World Content Only | ✅ | 全部內容來自 YouTube 真實字幕 |
| IV. Simplicity Over Features | ✅ | 無登入、無 AI 對話、無排行榜 |
| V. Observable Progress | ✅ | Session 完成摘要 + 互動標記即時回饋 |
| Tech: Vue 3 + Vite MPA | ✅ | 採用 MPA，無 Vue Router |
| Tech: Tailwind CSS v3 | ✅ | 唯一 CSS 方案 |
| Tech: Cloudflare Pages Functions | ✅ | 原生 fetch handler，無後端框架 |
| Tech: Cloudflare D1 | ✅ | parameterized SQL，binding `DB` |

**GATE**: 全部通過，可進入 Phase 0。

---

## Project Structure

### Documentation (this feature)

```text
specs/001-mvp-learning-feed/
├── plan.md          ← 本檔（/speckit.plan 輸出）
├── research.md      ← Phase 0 研究決策
├── data-model.md    ← Phase 1 資料模型
├── contracts/       ← Phase 1 API 契約
│   └── api.md
└── tasks.md         ← Phase 2（/speckit.tasks 輸出）
```

### Source Code (repository root)

```text
# MPA 架構（多頁面，每頁獨立 HTML shell）

pages/
├── index.html          ← 首頁（YouTube URL 輸入）
└── feed/
    └── index.html      ← 學習 Feed 頁

src/
├── entries/
│   ├── index.js        ← 首頁 Vue mount
│   └── feed.js         ← Feed 頁 Vue mount
├── pages/
│   ├── InputPage.vue   ← YouTube URL 輸入元件
│   └── FeedPage.vue    ← 學習 Feed 主元件
├── components/
│   ├── LearningCard.vue    ← 單張學習卡片
│   ├── VideoClip.vue       ← 影片片段播放器（含重播按鈕）
│   ├── ShadowingPanel.vue  ← 跟讀（錄音/播放）
│   └── ActionBar.vue       ← 會了/不熟 按鈕
├── composables/
│   ├── useLearningSession.js← Session 狀態（localStorage）
│   └── useShadowing.js     ← MediaRecorder 錄音邏輯
├── lib/
│   └── nlp.js          ← compromise.js + COCA 詞頻篩選 + CC-CEDICT 查詢（前端執行）
├── data/
│   ├── coca5000.json   ← COCA 詞頻表子集（~50KB）
│   └── cedict.json     ← CC-CEDICT 英中字典子集（~300KB）
└── services/
    └── api.js              ← fetch wrapper to Cloudflare Functions

functions/api/
├── analyze.js          ← POST /api/analyze（YouTube timedtext 取得 + D1 快取）
├── video/
│   └── [id].js         ← GET /api/video/:id（從 D1 取 raw_transcript）
└── _lib/
    ├── youtube.js       ← YouTube timedtext 解析
    └── db.js            ← D1 parameterized query helpers（videos 表）

migrations/
└── 0001_schema.sql     ← D1 schema（videos、clips、learning_cards）
```

**Structure Decision**: Vue 3 MPA（`pages/` HTML shells + `src/entries/` Vue mounts），Tailwind CSS v3，Cloudflare Pages Functions 原生 fetch handler，Cloudflare D1 僅儲存 Video + raw_transcript 快取（`learning_cards` 不入 D1）。NLP 在前端瀏覽器執行，避免 Cloudflare Workers 10ms CPU 限制。頁面切換使用原生 URL 導航，不引入 Vue Router。

---

## Complexity Tracking

無 Constitution 違規，不需要說明。
