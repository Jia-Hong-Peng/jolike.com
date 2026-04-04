# Quality Control and Release (品管上線)

## Reliability Root Cause and Prevention（可靠性、根因與預防）

### Rule（規則）
處理故障必須先重現、再定位根因，並補上預防措施避免同類問題重演。

### Rationale（理由）
根因導向可提升系統在壓力與失敗情境下的可預期性與穩定性。

### Do/Don't（應做/避免）
- Do: 先穩定重現，再修復；必要時加入輕量探針蒐證。
- Do: 區分程式、資料、環境、依賴與流程層面的根因。
- Do: 修復後補回歸測試與必要監控/文件。
- Don't: 只補表面症狀而不處理根因。
- Don't: 在缺乏證據時靠猜測決策。

---

## Quality Gate and Verified Completion（品質閘門與驗證完成）

### Rule（規則）
未通過品質閘門且未提供可追溯證據前，不得宣稱完成。

### Rationale（理由）
以驗證證據作為完成依據，可避免無效交付與品質誤判。

### Do/Don't（應做/避免）
- Do: 執行專案可用的 build、test、type check、lint。
- Do: 測試至少覆蓋單元與整合層級（依專案可用範圍）。
- Do: 覆蓋核心路徑、回歸案例與邊界條件。
- Do: 高風險變更（核心流程、對外契約、安全）需完成 Code Review 才能宣稱完成。
- Do: 在交付內容附上命令、結果摘要與限制說明。
- Don't: 在未驗證狀態下提交、合併或宣稱完成。
- Don't: 以「應該可以」替代實際驗證證據。

---

## Code Review Gate and Knowledge Sharing（Code Review 閘門與知識共享）

### Rule（規則）
Code Review 是品質閘門與知識分享機制；高風險變更必須完成 review 才可進入完成狀態。

### Rationale（理由）
Review 能提早發現風險、改善設計品質，並把關鍵知識沉澱為團隊共識。

### Do/Don't（應做/避免）
- Do: Review 聚焦正確性、風險、相容性與可維護性。
- Do: 明確回覆 review 意見與對應處置結果。
- Do: 以 review 記錄保留設計決策脈絡。
- Don't: 把 review 當成形式簽核而跳過實質檢查。
- Don't: 在關鍵意見未處理前宣稱變更已完成。

---

## Release Readiness Gate（上線就緒閘門）

### Rule（規則）
上線前必須具備風險清單、回滾策略、可觀測性計畫與影響說明；任一缺漏不得上線。

### Rationale（理由）
上線前具備可監控與可回復能力，才能在事故時快速止損。

### Do/Don't（應做/避免）
- Do: 定義主要風險、觸發條件與緩解措施。
- Do: 提供可執行的回滾或降級方案。
- Do: 配置監控/告警與變更影響範圍說明。
- Don't: 缺乏回滾或監控計畫仍進入上線。
- Don't: 在上線當天才揭露已知重大風險。
