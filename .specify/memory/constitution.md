# JoLike English Constitution

## Core Principles

### I. Learning-First（學習優先）
每個功能決策以「是否讓使用者真正學會英文」為唯一標準。
不追求功能完整性，只追求學習有效性。
每張學習卡片必須是完整、獨立的學習單位。

### II. Micro-Session Design（碎片時間優先）
所有互動設計必須能在 1～5 分鐘內完成。
單手操作，不需要帳號，任何情境下皆可使用。
流程可隨時中斷並恢復，不強制完成。

### III. Real-World Content Only（真實語境）
所有學習材料來自真實影片，不使用人工編造例句。
學習內容必須是使用者「在真實對話中會用到」的語言。
不教文法規則，只教實際使用方式。

### IV. Simplicity Over Features（簡單優先）
MVP 只做必要功能，不做登入、AI 對話、排行榜、社交功能。
每次迭代只解決一個核心問題。
複雜度必須有明確的學習價值理由才能加入。

### V. Observable Progress（可感知進步）
使用者每次使用後必須有「我真的懂了」的感受。
互動按鈕（會了 / 收藏 / 不熟）提供即時回饋，不做評分。
跟讀（Shadowing）讓使用者真正開口說，不只是被動接收。

## Tech Stack Constraints（技術棧約束）

### Rule（規則）
本專案開發必須嚴格遵守指定的技術棧與架構設計，不得擅自引入未經核准的框架、依賴或替代方案。

### Do（應做）
- 前端使用 **Vue 3 + Vite**，採用 **MPA（多頁面應用）** 架構，不使用 SPA Router。
- 樣式唯一標準為 **Tailwind CSS v3**，遵守 `@tailwind base/components/utilities` 使用規範。
- 後端 API 實作於 **Cloudflare Pages Functions** (`functions/api/`)，使用原生 fetch handler，不引入額外後端框架。
- 資料庫使用 **Cloudflare D1 (SQLite)**，落實 parameterized SQL 與 binding `DB` 操作。

### Don't（避免）
- 引入任何非本專案指定的 UI 框架或其他 CSS 解決方案。
- 在前端實作複雜的 SPA 路由邏輯（如引入 Vue Router）。
- 引入非必要後端框架（如 Express、Hono 等）到 Cloudflare Pages Functions 中。
- 直接拼接 SQL 字串（避免 SQL Injection 風險）。

---

## MVP 範圍約束

### 必做功能（MVP In）
- YouTube URL 輸入與字幕取得
- AI 分析：關鍵單字（10 個）、片語（5 個）、句型（3 個）
- 學習 Clip 生成（3～6 秒影片片段）
- 滑動式學習 Feed（仿 IG / TikTok 卡片）
- 單字高亮 + 極簡中文解釋
- 跟讀功能（播放 → 錄音 → 播放自己的聲音）
- 互動按鈕（會了 / 不熟）
- 重播

### 不做功能（MVP Out）
- 登入 / 會員系統
- AI 對話
- 文法教學
- 排行榜
- 社交功能
- 寫作練習
- 推播通知
- 付費機制
- 收藏按鈕（→ v1.1）
- 慢速播放 0.7x（→ v1.1）

## 品質標準

### 效能
- 輸入 YouTube URL 到顯示第一張學習卡片：< 10 秒
- 卡片切換流暢，無明顯延遲
- 支援離線瀏覽已載入的卡片

### 體驗
- 主要操作流程不超過 3 個步驟
- 每張卡片資訊密度適中，不過載
- 跟讀錄音延遲 < 300ms

## Governance

Constitution 是所有功能決策的最高依據。
新增功能前必須驗證是否符合 Learning-First 原則。
MVP Out 清單的功能只有在 MVP 成功驗證後才能考慮加入。

**Version**: 1.0.0 | **Ratified**: 2026-03-31 | **Last Amended**: 2026-03-31
