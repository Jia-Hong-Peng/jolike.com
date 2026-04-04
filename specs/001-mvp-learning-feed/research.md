# Research: JoLike English MVP

**Branch**: `001-mvp-learning-feed` | **Phase**: 0 | **Date**: 2026-03-31

---

## 1. YouTube 字幕取得方案

**Decision**: 後端呼叫 YouTube Data API v3 captions endpoint，搭配公開字幕 timedtext URL 作為 fallback。

**Rationale**:
- YouTube Data API v3 可取得 caption track 清單（需 API Key）
- 公開字幕可透過 `https://www.youtube.com/api/timedtext?v={id}&lang=en` 免 OAuth 取得
- Cloudflare Workers 可直接呼叫外部 HTTP，不需要 server

**Alternatives considered**:
- `youtube-transcript-api`（Python）：需要額外 Python runtime，與 Cloudflare Workers 不相容
- `ytdl-core`（Node.js）：套件重，且 Cloudflare Workers 環境不支援 Node.js 核心模組

**Implementation**:
```js
// functions/api/_lib/youtube.js
// 1. 解析 video ID from URL（支援 youtube.com/watch?v= 和 youtu.be/）
// 2. 呼叫 timedtext API 取 XML
// 3. 解析 XML → 純文字陣列（含時間戳）
// 4. 若失敗，回傳 { error: 'NO_CAPTIONS' }
```

---

## 2. 字幕分析（零 AI、零 API 成本，前端執行）

**Decision**: `compromise.js`（JS NLP）+ 內嵌 COCA 5000 詞頻表 + CC-CEDICT 子集字典，**在瀏覽器端（Vue 前端）執行**，無需外部 API。

**Rationale**:
- 零 API 成本、無速率限制、分析結果穩定可預測
- `compromise.js` 約 250KB，在現代手機瀏覽器執行無壓力
- COCA 5000 詞頻表（JSON，約 50KB）可識別「中級學習者值得學」的詞
- CC-CEDICT 取前 10,000 常用詞子集（JSON，約 300KB），覆蓋日常英文 95%+
- **Cloudflare Workers 免費方案只有 10ms CPU 時間**，`compromise.js` 分析 15 分鐘字幕約需 200~500ms，前端執行是唯一免費可行方案

**Architecture**:
```
[後端 Cloudflare Function]
  → 取 YouTube timedtext XML → 解析為 [{text, start, dur}]
  → 寫入 D1 (videos.raw_transcript)
  → 回傳 raw transcript JSON

[前端瀏覽器]
  → 接收 raw transcript
  → compromise.js：詞性標記（POS tagging）、名詞片語 / 動詞片語提取
  → COCA 詞頻篩選：過濾前 500 最常見詞（太簡單）、保留 501～3000 範圍
  → CC-CEDICT 查詢中文解釋
  → 按時間戳對應 clip_start / clip_end
  → 輸出最多 10 word + 5 phrase + 3 pattern
```

**中文解釋截斷規則**: 取 CC-CEDICT 第一個 definition，截斷至 10 字元以內。

**Alternatives considered**:
- 後端執行 NLP：Cloudflare Workers 免費方案 10ms CPU 不足，Paid plan 50ms 仍有風險
- Claude API：有效但有費用，MVP 不必要
- MyMemory / DeepL 翻譯 API：有速率限制，且字典查詢更快、更穩定
- spaCy（Python）：需要 Python runtime，與 Cloudflare Workers 不相容

---

## 3. 影片片段播放方案

**Decision**: 使用 HTML5 `<video>` 標籤搭配 YouTube iframe API，透過 `seekTo()` 實現時間區間播放。

**Rationale**:
- YouTube iframe API 支援 `seekTo(start)`、`pauseVideo()` 達成 clip 循環播放
- 不需要下載影片，直接串流
- `playbackRate` 設為 0.7 實現慢速播放

**Implementation**:
```js
// components/VideoClip.vue
// 1. 嵌入 YouTube iframe（隱藏 controls）
// 2. iframe API: player.seekTo(clip.start); player.playVideo()
// 3. 用 setInterval 監聽 player.getCurrentTime() >= clip.end → pauseVideo()
// 4. 慢速: player.setPlaybackRate(0.7)
```

**Alternatives considered**:
- 下載影片切片後儲存：版權問題 + 儲存成本，不適合 MVP
- Video.js：額外套件重量，HTML5 原生已足夠

---

## 4. 跟讀（Shadowing）錄音方案

**Decision**: Web Audio API + `MediaRecorder` API，錄音格式 `audio/webm`，播放用 `URL.createObjectURL()`。

**Rationale**:
- 原生瀏覽器 API，無需第三方套件
- iOS Safari 16+ 支援 `MediaRecorder`
- `createObjectURL(blob)` 可即時播放，不需上傳

**Flow**:
```
1. navigator.mediaDevices.getUserMedia({ audio: true })
2. new MediaRecorder(stream)
3. recorder.start() → 播放句子
4. setTimeout(recorder.stop, 10000) 或用戶手動停止
5. recorder.ondataavailable → blob → URL.createObjectURL
6. new Audio(url).play()
```

**Constraints**:
- iOS Safari 需要使用者手勢才能啟動錄音（按鈕點擊觸發）
- 錄音資料不上傳，僅存於記憶體，離頁即清除

---

## 5. D1 Schema 設計

**Decision**: 三張資料表：`videos`、`clips`、`learning_cards`，用 video_id 做快取 key。

**Rationale**:
- 同一 YouTube URL 第二次輸入可直接從 D1 取結果，不再呼叫 Claude API
- 單純的 Key-Value 快取即可，不需要複雜關聯

```sql
-- migrations/0001_schema.sql
CREATE TABLE IF NOT EXISTS videos (
  id TEXT PRIMARY KEY,          -- YouTube video ID
  title TEXT,
  duration_seconds INTEGER,
  analyzed_at INTEGER,          -- Unix timestamp
  raw_transcript TEXT           -- JSON array of {text, start, dur}
);

-- learning_cards 表已移除（2026-03-31 架構決策）
-- LearningCard 由前端 nlp.js 從 raw_transcript 動態生成，不持久化至 D1
-- 參見 data-model.md 的 LearningCard（前端記憶體）章節
```

---

## 6. MPA 頁面路由

**Decision**: 兩個頁面（`/` 輸入頁、`/feed/` 學習 Feed），用 URL query string 傳遞 video ID。

```
/               → InputPage.vue（YouTube URL 輸入）
/feed/?v={id}   → FeedPage.vue（學習 Feed，從 D1 載入卡片）
```

**Rationale**:
- MPA 不使用 Vue Router
- `?v={id}` 讓 Feed 頁可獨立書籤/分享
- 頁面切換用 `window.location.href = '/feed/?v=' + videoId`
