# Environment Setup (環境設定)

## Language and Communication（語言與溝通規範）

### Rule（規則）
所有 commit、PR 標題與註解必須使用英文；詳細的架構討論與回覆可使用繁體中文。專有名詞（如 API、Component）不翻譯。

### Rationale（理由）
英文有助於搜尋與跨語言整合，中文則能加速深度溝通。

### Do/Don't（應做/避免）
- Do: Commit 標題使用英文（如 `feat: add user login`）。
- Do: Issue 或 PR 的主要說明以英文列出重點。
- Do: 在複雜邏輯討論或澄清時使用繁體中文。
- Do: 保留專有名詞（如 `Deployment`、`State`）的英文原貌。
- Don't: 寫出全中文的 commit message。
- Don't: 將專有名詞強制翻譯（如把 Component 翻譯成組件）。

---

## Tech Stack Constraints（技術棧與架構約束）

### Rule（規則）
本專案開發必須嚴格遵守指定的技術棧與架構設計，不得擅自引入未經核准的框架、依賴或替代方案。

### Rationale（理由）
統一的技術棧能確保專案架構的一致性、降低維護成本、並最大化發揮所選技術的優勢（如 Cloudflare 生態系的效能與邊緣運算能力）。

### Do/Don't（應做/避免）
- Do: 前端使用 Vue 3 + Vite 進行開發，並採用 MPA（多頁面應用）架構，不使用 SPA Router。
- Do: 樣式唯一標準為 Tailwind CSS v3，並遵守 `@tailwind base/components/utilities` 的使用規範。
- Do: 需要地圖服務時，務必使用 Google Maps Places API (New)。
- Do: 後端 API 實作於 Cloudflare Pages Functions (`functions/api/`)，使用原生 fetch handler，不引入額外的後端框架。
- Do: 資料庫使用 Cloudflare D1 (SQLite)，並落實 parameterized SQL 與 binding `DB` 進行操作。
- Don't: 引入任何非本專案指定的 UI 框架或其他 CSS 解決方案。
- Don't: 在前端實作複雜的 SPA 路由邏輯（如引入 Vue Router）。
- Don't: 引入非必要的後端框架（如 Express、Hono 等）到 Cloudflare Pages Functions 中。
- Don't: 直接拼接 SQL 字串以避免 SQL Injection 風險。
