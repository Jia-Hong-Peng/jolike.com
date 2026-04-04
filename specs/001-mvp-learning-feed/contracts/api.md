# API Contracts: JoLike English MVP

**Branch**: `001-mvp-learning-feed` | **Phase**: 1 | **Date**: 2026-03-31  
**Base URL**: `https://jolike.com` (production) / `http://localhost:8788` (local)

---

## POST /api/analyze

YouTube URL 分析：取字幕（YouTube timedtext）→ 解析為時間戳陣列 → 寫入 D1 raw_transcript → 回傳原始字幕。NLP 分析（compromise.js）在前端執行。

**若 video 已在 D1 快取，直接回傳快取的 raw_transcript（不重複呼叫 YouTube）。**

### Request

```http
POST /api/analyze
Content-Type: application/json

{
  "url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
}
```

### Response 200 — 成功

```json
{
  "video": {
    "id": "dQw4w9WgXcQ",
    "title": "Rick Astley - Never Gonna Give You Up",
    "duration_seconds": 213
  },
  "transcript": [
    { "text": "never gonna give you up", "start": 38.0, "dur": 4.8 },
    { "text": "never gonna let you down", "start": 43.2, "dur": 4.5 }
  ],
  "cached": false
}
```

> **Architecture Note**: `cards` 欄位已移除。學習卡片由前端使用 `compromise.js` + COCA + CC-CEDICT 從 `transcript` 生成，不在後端計算。
```

### Response 400 — 無效 URL

```json
{
  "error": "INVALID_URL",
  "message": "請輸入有效的 YouTube 連結"
}
```

### Response 422 — 無字幕

```json
{
  "error": "NO_CAPTIONS",
  "message": "此影片不含英文字幕，請換一支影片"
}
```

### Response 500 — 分析失敗

```json
{
  "error": "ANALYSIS_FAILED",
  "message": "分析失敗，請稍後再試"
}
```

---

## GET /api/video/:id

從 D1 取已快取的 video 資料與原始字幕（避免前端重複 POST）。

### Request

```http
GET /api/video/dQw4w9WgXcQ
```

### Response 200

與 POST /api/analyze 的 `video` + `transcript` 格式相同，`cached: true`。

### Response 404

```json
{
  "error": "NOT_FOUND",
  "message": "Video not found"
}
```

---

## 前端呼叫流程

```
1. 使用者輸入 URL → POST /api/analyze
2. 成功 → 取得 transcript → 導向 /feed/?v={videoId}
3. Feed 頁載入 → GET /api/video/{videoId}（從 D1 快取取 raw transcript）
4. 前端用 compromise.js 分析 transcript → 生成 cards（在瀏覽器執行）
5. 卡片互動狀態（會了/不熟）存 localStorage，不呼叫後端
```
