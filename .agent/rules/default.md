# 開發指南 (Development Guidelines)

## 開發哲學 (Philosophy)

### 核心信念 (Core Beliefs)

- **漸進式優於大爆炸式開發 (Incremental progress over big bangs)** - 提交能編譯且通過測試的小規模修改。
- **從現有程式碼中學習 (Learning from existing code)** - 實作前先研究並規劃。
- **務實優於教條 (Pragmatic over dogmatic)** - 根據專案的實際情況進行調整。
- **意圖清晰優於聰明取巧 (Clear intent over clever code)** - 保持簡單易懂，拒絕過度設計。

### 簡單意味著 (Simplicity Means)

- 每個函數/類別保持單一職責 (Single responsibility)。
- 避免過早抽象化 (Avoid premature abstractions)。
- 不使用聰明取巧的技巧 - 選擇最平常/無聊的解決方案。
- 如果你需要花很多時間解釋它，那表示它太複雜了。

## 開發流程 (Process)

### 1. 規劃與分階段 (Planning & Staging)

將複雜的工作拆分為 3-5 個階段。並在 `IMPLEMENTATION_PLAN.md` 中記錄：

```markdown
## 階段 N: [名稱]
**目標**: [具體的交付成果]
**成功標準**: [可測試的結果]
**測試**: [具體的測試案例]
**狀態**: [尚未開始 (Not Started) | 進行中 (In Progress) | 已完成 (Complete)]
```
- 隨著進度更新狀態。
- 當所有階段完成後，移除該檔案。

### 2. 實作工作流 (Implementation Flow)

1. **理解 (Understand)** - 研究程式碼庫中現有的模式。
2. **測試 (Test)** - 先寫測試 (紅燈)。
3. **實作 (Implement)** - 寫最少量的程式碼讓測試通過 (綠燈)。
4. **重構 (Refactor)** - 在測試通過的情況下清理程式碼。
5. **提交 (Commit)** - 提供清晰的提交訊息並連結到規劃。

### 3. 卡關時的處理方式 (When Stuck - 嘗試 3 次後)

**極度重要 (CRITICAL)**: 每個問題最多嘗試 3 次，然後就**停下來**。

1. **記錄失敗原因**:
   - 你嘗試了什麼。
   - 具體的錯誤訊息。
   - 你認為為什麼會失敗。

2. **研究替代方案**:
   - 找 2-3 個類似的實作。
   - 記錄使用到的不同方法。

3. **質問基本原理**:
   - 這是正確的抽象層級嗎？
   - 這個問題可以拆分成更小的問題嗎？
   - 有更簡單的完全不同的方法嗎？

4. **嘗試不同切入點**:
   - 使用不同的函式庫/框架功能？
   - 不同的架構模式？
   - 移除抽象而不是增加抽象？

## 技術標準 (Technical Standards)

### 架構原則 (Architecture Principles)

- **組合優於繼承 (Composition over inheritance)** - 使用依賴注入 (Dependency injection)。
- **介面優於單例 (Interfaces over singletons)** - 增加可測試性與彈性。
- **明確優於隱式 (Explicit over implicit)** - 保持數據流和依賴關係清晰。
- **盡可能測試驅動 (Test-driven when possible)** - 永遠不要關閉測試，去修復它們。

### 程式碼品質 (Code Quality)

- **每次提交 (Commit) 都必須**:
  - 編譯成功。
  - 通過所有現有測試。
  - 包含新功能的測試。
  - 遵循專案的格式化/Linting 規則。

- **在提交之前**:
  - 執行 Formatters/Linters。
  - 自我審查 (Self-review) 變更。
  - 確保提交訊息解釋了「為什麼 (why)」這樣做。

### 錯誤處理 (Error Handling)

- 盡早失敗 (Fail fast) 並提供具描述性的訊息。
- 包含用於除錯的上下文 (Context)。
- 在適當的層級處理錯誤。
- 永遠不要靜默吞沒 (Silently swallow) 異常。

## 決策框架 (Decision Framework)

當有多種有效方法存在時，基於以下標準選擇：

1. **可測試性 (Testability)** - 我能輕易測試這個嗎？
2. **可讀性 (Readability)** - 6 個月後還有人能看懂這個嗎？
3. **一致性 (Consistency)** - 這符合專案的現有模式嗎？
4. **簡單性 (Simplicity)** - 這是能運作的最簡單解決方案嗎？
5. **可逆性 (Reversibility)** - 以後要修改有多困難？

## 專案整合 (Project Integration)

### 學習程式碼庫 (Learning the Codebase)

- 尋找 3 個相似的功能/元件。
- 找出共同的模式和慣例。
- 盡可能使用相同的函式庫/工具程式。
- 遵循現有的測試模式。

### 工具生態 (Tooling)

- 使用專案現有的建置系統 (Build system)。
- 使用專案現有的測試框架。
- 使用專案的 Formatter/Linter 設定。
- 沒有強烈理由，不要引入新工具。

## 品質守門員 (Quality Gates)

### 完成定義 (Definition of Done)

- [ ] 測試已編寫且通過。
- [ ] 程式碼遵循專案慣例。
- [ ] 沒有 Linter/Formatter 的警告。
- [ ] 提交訊息清晰。
- [ ] 實作與規劃相符。
- [ ] 沒有缺少 Issue 通報編號的 TODO 標籤。

### 測試指南 (Test Guidelines)

- 測試行為 (Behavior)，而不是實作 (Implementation)。
- 盡可能每個測試只做一個斷言語句 (Assertion)。
- 清晰的測試名稱以描述情境。
- 使用現有的測試工具程式/輔助函數 (Helpers)。
- 測試應該要具有確定性 (Deterministic)。

## 重要提醒 (Important Reminders)

**絕對不要 (NEVER)**:
- 使用 `--no-verify` 繞過 Commit hooks。
- 關閉測試來取代修復它們。
- 提交無法編譯的程式碼。
- 憑空臆測 - 要透過現有程式碼進行驗證。

**總是要求 (ALWAYS)**:
- 漸進式地提交可運行的程式碼。
- 隨著進度更新規劃文件。
- 從現有的實作中學習。
- 在 3 次失敗嘗試後停下來並重新評估。
