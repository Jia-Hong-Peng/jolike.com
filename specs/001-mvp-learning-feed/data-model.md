# Data Model: JoLike English MVP

**Branch**: `001-mvp-learning-feed` | **Phase**: 1 | **Date**: 2026-03-31

---

## Entities

### Video
YouTube 影片的基本資訊與字幕快取。

| 欄位 | 型別 | 說明 |
|------|------|------|
| `id` | TEXT PK | YouTube video ID（如 `dQw4w9WgXcQ`）|
| `title` | TEXT | 影片標題 |
| `duration_seconds` | INTEGER | 影片長度（秒）|
| `analyzed_at` | INTEGER | 分析完成的 Unix timestamp |
| `raw_transcript` | TEXT | JSON array：`[{text, start, dur}]` |

**State transitions**:
```
URL 輸入 → 取字幕 → Claude 分析 → analyzed_at 寫入 → 快取完成
```

---

### LearningCard（前端記憶體，非 D1）

由前端 `compromise.js` 從 `raw_transcript` 分析產生，存在瀏覽器記憶體中，不持久化到 D1。

| 欄位 | 型別 | 說明 |
|------|------|------|
| `id` | string | 前端生成的唯一 ID（`${videoId}_${index}`）|
| `video_id` | string | 對應的 YouTube video ID |
| `type` | string | `'word'` / `'phrase'` / `'pattern'` |
| `keyword` | string | 高亮關鍵字（如 `"figure out"`）|
| `meaning_zh` | string | 中文解釋，≤ 10 字（如 `"搞懂 / 想清楚"`）|
| `clip_start` | number | 影片片段開始時間（秒）|
| `clip_end` | number | 影片片段結束時間（秒）|
| `sort_order` | number | 在 Feed 中的顯示順序 |

**Generation rules**:
- 由 `src/lib/nlp.js` 從 `raw_transcript` 生成
- `clip_end - clip_start` 應在 3～6 秒之間（對齊 FR-004）
- `meaning_zh` 長度 ≤ 10 字元
- `sort_order`：word 卡優先，phrase 次之，pattern 最後
- 最多 10 word + 5 phrase + 3 pattern

---

### SessionState（localStorage，非 D1）
當次 session 的使用者互動狀態，不持久化到後端。

```js
// localStorage key: 'jolike_session_{videoId}'
{
  videoId: string,
  startedAt: number,          // Unix timestamp
  cards: {
    [cardId]: 'known' | 'saved' | 'unsure' | null
  },
  completedAt: number | null
}
```

---

## Entity Relationships

```
[Cloudflare D1]
videos (1) ─── raw_transcript JSON ──→ [前端 nlp.js 生成] ──→ LearningCard[] (記憶體)
                                                                      │
                                                                      └── SessionState (localStorage)
```

---

## Constraints

- `videos.id` 一旦建立不更新（只 INSERT，無 UPDATE）
- `learning_cards` 不存在 D1，由前端從 `videos.raw_transcript` 動態生成
- SessionState 在頁面關閉後保留（localStorage），但不做跨裝置同步
