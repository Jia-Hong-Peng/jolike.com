# Tasks: JoLike English MVP — YouTube to Learning Feed

**Input**: Design documents from `/specs/001-mvp-learning-feed/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅

**Total Tasks**: 38 | **Parallelizable**: 16 | **User Stories**: 3 (US4 cut)

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可平行執行（不同檔案、無未完成依賴）
- **[USn]**: 對應 spec.md 的 User Story 編號

> **SCOPE REDUCTION 架構決策（2026-03-31）**：
> - NLP（`compromise.js` + COCA + CC-CEDICT）移到**前端瀏覽器**執行（Workers 10ms CPU 上限不足）
> - 後端僅做 YouTube timedtext proxy + D1 原始字幕快取
> - D1 只有 `videos` 表（含 `raw_transcript`），無 `learning_cards` 表
> - US4（Session 摘要）完整移除 → v1.1 Backlog
> - 移除：慢速播放、收藏按鈕、不熟 re-queue 邏輯

---

## Phase 1: Setup（專案初始化）

**Purpose**: Vite MPA 骨架、Tailwind、Cloudflare 配置

- [x] T001 初始化 Vite 專案，安裝 `vue` / `tailwindcss` / `@vitejs/plugin-vue` / `compromise`，建立 `package.json`
- [x] T002 配置 `vite.config.js`：MPA 多入口（`pages/index.html`、`pages/feed/index.html`）
- [x] T003 [P] 建立 `tailwind.config.js` + `postcss.config.js`，設定 content paths（`src/**/*.{vue,js}`、`pages/**/*.html`）
- [x] T004 [P] 建立 `wrangler.toml`：Cloudflare Pages 設定 + D1 binding `DB`，`database_id` 填 placeholder
- [x] T005 建立 `migrations/0001_schema.sql`：僅 `videos` 表（欄位：`id TEXT PK`、`title TEXT`、`duration_seconds INTEGER`、`analyzed_at INTEGER`、`raw_transcript TEXT`）
- [x] T006 建立 `pages/index.html`（首頁 HTML shell）與 `pages/feed/index.html`（Feed 頁 HTML shell）
- [x] T007 建立 `src/entries/index.js` 與 `src/entries/feed.js`（Vue 3 `createApp().mount()` 入口）

---

## Phase 2: Foundational（阻塞性基礎）

**Purpose**: YouTube 字幕解析、前端 NLP lib、D1 helpers — 所有 User Story 共用

⚠️ **CRITICAL**: 此 Phase 完成前，任何 User Story 均不可開始

### Backend Lib

- [x] T008 建立 `functions/api/_lib/youtube.js`：解析 YouTube video ID（支援 `youtube.com/watch?v=` 和 `youtu.be/`）、呼叫 `https://www.youtube.com/api/timedtext?v={id}&lang=en` 取 XML、解析為 `[{text, start, dur}]` 陣列；無字幕時回傳 `{ error: 'NO_CAPTIONS' }`；若字幕總時長 > 900 秒（15 分鐘），只保留 `start < 900` 的項目（對齊 spec.md Edge Cases）
- [x] T009 建立 `functions/api/_lib/db.js`：D1 parameterized query helpers — `getVideo(DB, id)` 查詢、`saveVideo(DB, video)` 含 `raw_transcript` JSON.stringify 序列化

### Frontend NLP Data（可與 T008 T009 平行）

- [x] T010 [P] 下載 COCA 5000 詞頻表子集，存為 `src/data/coca5000.json`（格式：`["word1","word2",...]`，前 5000 常用詞，約 50KB）
- [x] T011 [P] 下載 CC-CEDICT 英中字典子集（前 10,000 常用詞），存為 `src/data/cedict.json`（格式：`{"word": "中文解釋"}`，約 300KB）

### Frontend NLP Library

- [x] T012 建立 `src/lib/nlp.js`：import `compromise` + `src/data/coca5000.json` + `src/data/cedict.json`；實作 `extractLearningItems(transcript)` — POS 標記、名詞片語/動詞片語提取、COCA 詞頻篩選（保留 rank 501–3000）、CC-CEDICT 中文解釋查詢、依時間戳計算 `clip_start`/`clip_end`；盡量輸出最多 10 word + 5 phrase + 3 pattern（字幕夠長時填滿上限；字幕過短時至少各 1 項）

### Frontend API Client

- [x] T013 建立 `src/services/api.js`：fetch wrapper — `analyzeVideo(url)` → `POST /api/analyze`、`getVideo(id)` → `GET /api/video/:id`；統一錯誤處理（INVALID_URL / NO_CAPTIONS / ANALYSIS_FAILED / network error）

**Checkpoint**: YouTube 字幕解析、前端 NLP lib、DB helpers 就緒，可開始 User Story 實作

---

## Phase 3: User Story 1 — YouTube 輸入 → 學習 Feed（P1）🎯 MVP

**Goal**: 使用者貼上 YouTube URL，< 10 秒顯示第一張學習卡片

**Independent Test**: 輸入 `https://youtu.be/dQw4w9WgXcQ` → 看到至少 1 張卡片（含 keyword + meaning_zh + 影片區塊）

### Backend（T014 T015 可平行）

- [x] T014 [US1] 建立 `functions/api/analyze.js`：`POST /api/analyze` handler — 驗證 URL（400）→ 查 D1 快取 → 快取未命中時呼叫 `youtube.js` 取字幕（422 on NO_CAPTIONS）→ 呼叫 `db.js` 寫入 D1 → 回傳 `{ video, transcript, cached }` JSON（參考 contracts/api.md）
- [x] T015 [P] [US1] 建立 `functions/api/video/[id].js`：`GET /api/video/:id` handler — 查 D1 → 回傳 `{ video, transcript, cached: true }` 或 404

### Frontend（T016 T017 T018 可平行）

- [x] T016 [P] [US1] 建立 `src/pages/InputPage.vue`：YouTube URL 輸入框（inline 驗證）、「開始學習」按鈕、loading 狀態（按下後 disable）、error 提示（INVALID_URL / NO_CAPTIONS / ANALYSIS_FAILED）；`api.analyzeVideo(url)` 成功後 `window.location.href = '/feed/?v={videoId}'`
- [x] T017 [P] [US1] 建立 `src/components/LearningCard.vue`：接收 `card` prop（`keyword`, `meaning_zh`, `type`, `clip_start`, `clip_end`, `videoId`）；顯示關鍵字高亮 `<mark>`、中文解釋、卡片型別標籤（word/phrase/pattern）
- [x] T018 [P] [US1] 建立 `src/components/VideoClip.vue`：嵌入 YouTube iframe（`enablejsapi=1`、隱藏 controls）；接收 `videoId`、`start`、`end` props；`onMounted` 載入 YouTube iframe API（`YT.Player`）；實作 `play()`（`seekTo(start) + playVideo()`）、`stop()`（`pauseVideo()`）；`setInterval` 監聽 `getCurrentTime() >= end` 自動停止
- [x] T019 [US1] 建立 `src/pages/FeedPage.vue`：從 URL query `?v={id}` 取 videoId → `api.getVideo(id)` 取 transcript → `nlp.extractLearningItems(transcript)` 生成 cards 陣列 → `v-if` 顯示當前卡片（`LearningCard` + `VideoClip`）；管理 `currentIndex` 狀態與 `next()` 切換邏輯
- [x] T020 [US1] 整合 HTML shells：`src/entries/index.js` mount `InputPage`、`src/entries/feed.js` mount `FeedPage`；確認 MPA 跨頁導航（`window.location.href`）正常

**Checkpoint**: 完整流程跑通 — URL 輸入 → 後端取字幕 → 前端 NLP → Feed 顯示卡片

---

## Phase 4: User Story 2 — 播放 / 跟讀（P2）

**Goal**: 重播影片片段、跟讀（錄音後聆聽自己的聲音）

**Independent Test**: 在單張卡片測試頁面，重播與跟讀兩個操作均可獨立執行且無 JS 錯誤

### Implementation

- [x] T021 [US2] 擴充 `src/components/VideoClip.vue`：加入「重播」按鈕（呼叫 `play()`），按鈕樣式使用 Tailwind，位於卡片下方
- [x] T022 [US2] 建立 `src/composables/useShadowing.js`：封裝 `navigator.mediaDevices.getUserMedia({ audio: true })`、`MediaRecorder` 錄音（`audio/webm`，最多 10 秒）、`blob → URL.createObjectURL → new Audio(url).play()`；麥克風拒絕時回傳 `{ error: 'MIC_DENIED' }`
- [x] T023 [US2] 建立 `src/components/ShadowingPanel.vue`：「跟讀」按鈕 → 觸發 `VideoClip.play()` → 自動開始錄音 → 錄音結束播放使用者聲音；顯示「錄音中」/「播放中」狀態；麥克風未授權時顯示引導文字
- [x] T024 [US2] 在 `src/components/LearningCard.vue` 整合 `ShadowingPanel`：跟讀開始前先呼叫 `VideoClip.stop()`，避免音訊衝突

**Checkpoint**: US1 + US2 均可獨立驗證

---

## Phase 5: User Story 3 — 互動標記 + 滑動切換（P2）

**Goal**: 會了 / 不熟 標記；上滑手勢切換下一張

**Independent Test**: 點擊兩個按鈕後，狀態正確存入 localStorage；上滑 > 60px 觸發換卡

### Implementation

- [x] T025 [US3] 建立 `src/composables/useLearningSession.js`：管理 `cards[]`、`currentIndex`、各卡片狀態（`known / unsure / null`）；`markCard(id, status)` 寫入 localStorage（key: `jolike_session_{videoId}`）；`next()` 移動到下一張；`isComplete` computed（所有卡片已瀏覽）
- [x] T026 [US3] 建立 `src/components/ActionBar.vue`：「👍 我會了」/ 「❓ 不熟」兩個按鈕；點擊後 emit `mark` event（payload: `{ id, status }`）；兩個按鈕點擊後均自動呼叫 `next()`；按鈕 ≥ 44×44px（Tailwind `min-h-[44px]`）
- [x] T027 [US3] 在 `src/pages/FeedPage.vue` 整合 `useLearningSession`、`ActionBar`；實作觸控上滑手勢（`touchstart`/`touchend`，delta > 60px 觸發 `next()`）；卡片切換動畫使用 CSS `transform: translateY` + `transition: transform 0.3s ease`，確保 60fps 流暢（使用 GPU 合成層：`will-change: transform`）
- [x] T028 [US3] `isComplete` 為 true 時顯示完成提示：一個簡單的「換影片」按鈕（`window.location.href = '/'`），不做統計摘要（US4 已移除）

**Checkpoint**: US1 + US2 + US3 均可獨立驗證

---

## Phase 6: Polish（跨功能完善）

**Purpose**: Mobile UX、Error states、部署配置

- [x] T029 [P] 為 `src/pages/InputPage.vue` 加入 loading spinner（`animate-spin`）；為 `src/pages/FeedPage.vue` 加入卡片載入佔位（Tailwind `animate-pulse`）
- [x] T030 [P] 完善 `src/pages/InputPage.vue` error states：INVALID_URL / NO_CAPTIONS / ANALYSIS_FAILED，含重試按鈕
- [x] T031 [P] Mobile CSS 審查：確認 375px 無水平 overflow（`src/pages/*.vue`、`src/components/*.vue`）；ActionBar 按鈕 ≥ 44×44px；ShadowingPanel 按鈕位於螢幕下方 1/3
- [x] T032 [P] 在 `src/pages/InputPage.vue` 新增快取偵測：同一 YouTube URL 重複輸入時，偵測 localStorage 快取，直接 `window.location.href` 導向 Feed（不重複 POST）
- [x] T033 在 `src/services/api.js` 補上網路中斷 fallback：catch 網路錯誤，顯示「請確認網路連線」提示
- [x] T034 [P] 建立 `.gitignore`：排除 `dist/`、`.wrangler/`、`node_modules/`、`*.env`
- [x] T035 完成 `wrangler.toml`：補上真實 `database_id`（本地開發用 `--local`），確認 `functions/api/` 路由正確
- [x] T036 本地執行 `wrangler d1 execute DB --local --file=migrations/0001_schema.sql`，驗證 `videos` schema 建立成功
- [x] T037 [P] 建立 `CLAUDE.md`：記錄 NLP 前端執行架構（`src/lib/nlp.js`）、D1 binding 規則、MPA 路由慣例
- [x] T038 執行 `npm run build`，確認 Vite MPA 產出 `dist/pages/index.html` 與 `dist/pages/feed/index.html`，無 build 錯誤

---

## Dependencies & Execution Order

### Phase 依賴

```
Phase 1 (Setup)
  └── Phase 2 (Foundational)  ← BLOCKS all US
        ├── Phase 3 (US1 P1)  ← MVP 最小可交付 🎯
        │     └── Phase 4 (US2 P2)
        │     └── Phase 5 (US3 P2)
        └── Phase 6 (Polish)  ← 可與 US phases 並行
```

### User Story 內部依賴

- **US1**: T008 T009 T012 T013 → T014 → T015 T016 T017 T018 → T019 → T020
- **US2**: T021 T022 → T023 → T024（依賴 US1 的 LearningCard.vue、VideoClip.vue）
- **US3**: T025 → T026 → T027 → T028（依賴 US1 的 FeedPage.vue）

### 平行機會

```
Phase 1: T003 T004 可與 T001 T002 平行
Phase 2: T010 T011 可與 T008 T009 平行（獨立資料準備）
Phase 3 backend: T014 T015 可平行（不同檔案）
Phase 3 frontend: T016 T017 T018 可平行（不同元件）
Phase 6: T029 T030 T031 T032 T034 T037 全部可平行
```

---

## Parallel Example: User Story 1

```bash
# Phase 2 — 四個任務可同時進行：
Task T008: "建立 functions/api/_lib/youtube.js"
Task T009: "建立 functions/api/_lib/db.js"
Task T010: "下載 COCA 5000 → src/data/coca5000.json"
Task T011: "下載 CC-CEDICT → src/data/cedict.json"

# Phase 3 frontend — 三個元件可同時進行：
Task T016: "建立 src/pages/InputPage.vue"
Task T017: "建立 src/components/LearningCard.vue"
Task T018: "建立 src/components/VideoClip.vue"
```

---

## Implementation Strategy

### MVP First（US1 only，最快驗證核心假設）

1. Phase 1 Setup（T001–T007）
2. Phase 2 Foundational（T008–T013）
3. Phase 3 US1（T014–T020）
4. **STOP & VALIDATE**: 輸入真實 YouTube URL，確認卡片正確顯示
5. 若核心體驗成立，繼續 US2/US3

### Incremental Delivery

| 里程碑 | 完成條件 |
|--------|----------|
| M1 MVP ✅ | US1 跑通：URL 輸入 → 卡片顯示 |
| M2 互動 ✅ | US2 + US3：播放控制 + 互動標記 |
| M3 上線 | Phase 6 Polish + Cloudflare 部署 |

---

## Notes

- `[P]` 任務 = 不同檔案，無未完成依賴，可平行執行
- `[USn]` 標籤對應 spec.md User Story，確保需求可追溯
- **最高風險：T012** (`src/lib/nlp.js`) — 建議 Phase 2 完成後先在真實手機瀏覽器 spike 驗證 `compromise.js` + 兩份 JSON 資料（共約 600KB）的載入與執行效能，再繼續 Phase 3
- D1 所有 SQL 操作必須使用 parameterized query（`?` 佔位符），不得拼接字串
- 頁面切換一律用 `window.location.href`，不引入 Vue Router
- **T035 待手動完成**：`wrangler.toml` 需填入真實 `database_id`（執行 `wrangler d1 create jolike-english-db` 取得）
- **T036 待手動完成**：`wrangler d1 execute DB --local --file=migrations/0001_schema.sql`
- **YouTube timedtext 技術債**：此為非官方端點，成長後需遷移到 YouTube Data API v3
