# Feature Specification: JoLike English MVP — YouTube to Learning Feed

**Feature Branch**: `001-mvp-learning-feed`  
**Created**: 2026-03-31  
**Status**: Draft  

---

## User Scenarios & Testing *(mandatory)*

### User Story 1 — YouTube 輸入到學習 Feed (Priority: P1)

使用者貼上一個 YouTube 影片連結，系統在 10 秒內分析字幕，並呈現一個可滑動的學習卡片 Feed，每張卡片對應一個關鍵單字或片語。

**Why this priority**: 這是整個產品的核心入口，沒有這個流程，後續所有功能都無法運作。

**Independent Test**: 可以獨立測試：輸入任意 YouTube URL（含字幕），驗證系統是否產生至少 1 張學習卡片並呈現在畫面上。

**Acceptance Scenarios**:

1. **Given** 使用者在輸入框貼上一個有字幕的 YouTube URL，**When** 點擊「開始學習」，**Then** 系統在 10 秒內顯示第一張學習卡片，包含影片片段、高亮單字、中文解釋。
2. **Given** 使用者在輸入框貼上一個無字幕的 YouTube URL，**When** 點擊「開始學習」，**Then** 系統顯示「此影片無字幕，請換一支影片」的錯誤提示。
3. **Given** 使用者在輸入框貼上非 YouTube URL，**When** 點擊「開始學習」，**Then** 系統即時顯示「請輸入 YouTube 連結」的 inline 錯誤。

---

### User Story 2 — 學習卡片互動：播放、慢速、跟讀 (Priority: P2)

使用者在學習 Feed 中看到一張卡片，可以重播影片片段、切換慢速播放，並進行跟讀（錄音後聆聽自己的聲音）。

**Why this priority**: 核心學習行為。看懂 + 說出來，是 JoLike English 與一般字典 app 的最大差異。

**Independent Test**: 可以獨立測試：在顯示單張卡片的測試頁面上，驗證三個操作（重播、慢速、跟讀）是否可正常執行。

**Acceptance Scenarios**:

1. **Given** 使用者看到一張卡片，**When** 點擊重播按鈕，**Then** 影片片段從頭播放一次。
2. **Given** 使用者看到一張卡片，**When** 點擊慢速播放，**Then** 影片以 0.7x 速度播放，按鈕高亮顯示慢速狀態。
3. **Given** 使用者點擊跟讀按鈕，**When** 系統播放句子後，**Then** 錄音自動開始（最多 10 秒），錄音結束後立即播放使用者的聲音。
4. **Given** 使用者跟讀後播放自己的聲音，**When** 播放結束，**Then** 跟讀按鈕恢復初始狀態，使用者可再次跟讀。

---

### User Story 3 — 卡片互動：會了 / 收藏 / 不熟 (Priority: P2)

使用者對每張卡片標記學習狀態，並可滑動到下一張卡片。

**Why this priority**: 讓使用者有主控感，且為後續個人化 Feed 提供資料基礎（即使 MVP 不做個人化）。

**Independent Test**: 可以獨立測試：點擊三個按鈕後，驗證對應狀態是否在當次 session 中正確記錄，且可滑動到下一張。

**Acceptance Scenarios**:

1. **Given** 使用者看到一張卡片，**When** 點擊「我會了」，**Then** 卡片淡出，自動滑到下一張；該卡片狀態記錄為「已掌握」。
2. **Given** 使用者看到一張卡片，**When** 點擊「收藏」，**Then** 星形圖示高亮，卡片狀態記錄為「已收藏」；繼續顯示當前卡片。
3. **Given** 使用者看到一張卡片，**When** 點擊「不熟」，**Then** 卡片放入待複習佇列，滑到下一張。
4. **Given** 使用者上滑卡片，**When** 滑動距離超過閾值，**Then** 切換到下一張卡片（等同「我會了」）。

---

### User Story 4 — 學習 Session 完成 (Priority: P3)

使用者完成一支影片的所有學習卡片（或主動結束），系統顯示本次學習摘要。

**Why this priority**: 提供成就感，讓使用者知道「這次學了什麼」。

**Independent Test**: 可以獨立測試：完成所有卡片後，驗證摘要畫面是否正確顯示本次學習的單字數量與已掌握數量。

**Acceptance Scenarios**:

1. **Given** 使用者完成 Feed 中最後一張卡片，**When** 標記任何狀態，**Then** 系統顯示「學習完成」畫面，呈現：本次學習單字數、已掌握數、收藏數。
2. **Given** 「學習完成」畫面，**When** 使用者點擊「再學一次」，**Then** Feed 重新開始（含「不熟」的卡片優先顯示）。
3. **Given** 「學習完成」畫面，**When** 使用者點擊「換影片」，**Then** 返回 YouTube URL 輸入頁面。

---

### Edge Cases

- YouTube 影片長度 > 30 分鐘時，只取前 15 分鐘的字幕進行分析。
- 字幕語言非英文時，顯示「此影片不含英文字幕」提示。
- 網路中斷時，顯示友善的離線提示，已載入的卡片可繼續使用。
- 跟讀錄音時，使用者未授予麥克風權限，顯示「請允許麥克風使用權限」的引導畫面。
- 同一 YouTube URL 重複輸入，直接顯示上次的學習 Feed（快取）。

---

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 系統 MUST 接受標準 YouTube URL 格式（`youtube.com/watch?v=`、`youtu.be/`）
- **FR-002**: 系統 MUST 在 10 秒內取得字幕並生成第一批學習卡片
- **FR-003**: 系統 MUST 每支影片產出至少 10 個單字卡片、5 個片語卡片、3 個句型卡片
- **FR-004**: 每張卡片 MUST 包含：3～6 秒影片片段、高亮關鍵字、極簡中文解釋（10 字以內）
- **FR-005**: 系統 MUST 支援重播（1x）與慢速播放（0.7x）
- **FR-006**: 系統 MUST 支援跟讀：播放句子 → 錄音 → 播放使用者錄音，整個流程不需離開當前卡片
- **FR-007**: 系統 MUST 支援三種互動標記：會了 / 收藏 / 不熟，並在當次 session 中保留狀態
- **FR-008**: Feed 切換動畫 MUST 為垂直滑動（仿 TikTok），滑動閾值觸發自動換卡
- **FR-009**: 系統 MUST 支援單手操作，主要操作元素位於螢幕下方 1/3 區域

### Key Entities

- **Video**: YouTube URL、字幕文本、影片元數據（標題、長度）
- **Clip**: 影片時間區間（start/end）、對應文字、學習焦點（單字/片語/句型）
- **LearningCard**: Clip + 高亮關鍵字 + 中文解釋 + 使用者標記狀態
- **LearningSession**: Video + LearningCard 列表 + 開始時間 + 完成狀態

---

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 從輸入 YouTube URL 到看到第一張學習卡片，時間 < 10 秒（正常網速）
- **SC-002**: 跟讀錄音開始延遲 < 300ms
- **SC-003**: 卡片切換動畫流暢，幀率 ≥ 60fps
- **SC-004**: 使用者完成一個完整 session（1 支影片）的時間在 3～8 分鐘之間
- **SC-005**: 主要流程（輸入 → 學習 → 完成）不超過 3 個步驟

---

## Assumptions

- 目標裝置為手機（iOS / Android），優先 Mobile Web，不做 Native App（MVP）
- 使用者有穩定網路連線（可以播放 YouTube 影片）
- 字幕來源為 YouTube 自動字幕或手動字幕（英文）
- AI 分析使用第三方 LLM API（Claude / OpenAI），不自建模型
- 不需要使用者帳號，session 資料暫存於 localStorage
- 跟讀功能需要使用者主動授予麥克風權限（Web API）
- MVP 不做後端資料庫，學習狀態僅保留在當次 session 的記憶體中
