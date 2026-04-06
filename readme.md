# JoLike English

從你正在看的 YouTube 影片學英文。字幕 → NLP 詞彙分析 → 滑卡片學習 / 跟讀模式。

---

## 技術架構

| 層 | 技術 |
|---|---|
| 前端 | Vue 3 + Vite（MPA，無 Router）+ Tailwind CSS v3 |
| 後端 | Cloudflare Pages Functions（`functions/api/`）|
| 資料庫 | Cloudflare D1（SQLite），binding 名稱固定為 `DB` |
| NLP | 瀏覽器端執行（`src/lib/nlp.js` + compromise.js），不跑在 Worker（10ms CPU 限制）|
| 部署 | git push main → Cloudflare Pages 自動部署 |

---

## 頁面路由

| 路徑 | 說明 |
|---|---|
| `/` | InputPage — 貼 YouTube 連結，選學習模式 |
| `/feed/?v={id}` | FeedPage — 詞彙學習（TikTok 滑卡片）|
| `/shadow/?v={id}` | ShadowingPage — 逐字幕跟讀模式 |
| `/review/` | ReviewPage — SRS 間隔複習 |
| `/progress/` | ProgressPage — 詞彙學習進度 |
| `/library/` | LibraryPage — 全站公開影片庫 |
| `/vocab-study/` | VocabStudyPage — 多益／雅思詞彙清單學習 |
| `/admin-channels/` | 頻道訂閱管理（Admin）|
| `/admin-backfill/` | 詞彙索引補建（Admin）|

---

## 本地開發

```bash
npm install
npm run dev          # Vite dev server（port 5173，/api 自動 proxy 到 8788）

# 初始化本地 D1（只需做一次）
npx wrangler d1 execute DB --local --file=migrations/0001_schema.sql
npx wrangler d1 execute DB --local --file=migrations/0002_push_subscriptions.sql
npx wrangler d1 execute DB --local --file=migrations/0003_channels.sql

# 完整本地環境（Cloudflare Pages Functions + D1）
npm run build
npx wrangler pages dev dist --d1=DB
```

---

## 環境變數

### Cloudflare Pages Secrets
Cloudflare Dashboard → Pages → jolike-english → Settings → Environment variables

| 變數 | 用途 |
|---|---|
| `ADMIN_TOKEN` | 影片庫管理員刪除 token |
| `CHANNEL_SYNC_SECRET` | 頻道 RSS cron + batch 上傳驗證 |
| `GITHUB_TOKEN` | 觸發 GitHub Actions 的 fine-grained PAT |
| `VAPID_PRIVATE_JWK` | Web Push 私鑰 |
| `PUSH_SEND_SECRET` | Push 發送 API 保護 |

更新 secret：
```bash
npx wrangler pages secret put CHANNEL_SYNC_SECRET --project-name jolike-english
```

### GitHub Actions Secrets
Settings → Secrets and variables → Actions

| 變數 | 用途 |
|---|---|
| `CLOUDFLARE_API_TOKEN` | 自動部署用 |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare 帳號 ID |
| `CHANNEL_SYNC_SECRET` | 與 Cloudflare 端相同值 |
| `PUSH_SEND_SECRET` | 每日推播 cron 驗證 |

---

## 字幕批次處理（Transcript Fetching）

### 重要限制

YouTube 對 **datacenter IP（含 GitHub Actions / Cloudflare Workers）** 實施多層 bot 封鎖：
- Cloudflare Workers（Singapore IP）→ HTTP 429
- GitHub Actions（Azure IP）→ PO Token 要求，字幕無法取得

**字幕必須從本機（住宅 IP）抓取。**

### 本機批次跑法

適用於首次大量匯入，或清空 stubs（資料庫中無字幕的影片佔位符）：

```bash
# 安裝依賴（只需一次）
pip3 install yt-dlp "youtube-transcript-api==0.6.2"

# 跑全部頻道（每頻道最多 500 個）
API_BASE=https://jolike.com \
BATCH_SECRET=<CHANNEL_SYNC_SECRET 的值> \
python3 scripts/fetch-transcripts.py --limit 500

# 只跑特定頻道
API_BASE=https://jolike.com \
BATCH_SECRET=<CHANNEL_SYNC_SECRET 的值> \
python3 scripts/fetch-transcripts.py --channel UCxxxxxx --limit 200
```

每部影片約 1-2 秒，500 個 stubs 約 15-20 分鐘。

### GitHub Actions 自動觸發

`.github/workflows/fetch-transcripts.yml` 在以下情況自動觸發：
- 使用者提交影片 URL 遇到 RATE_LIMITED → `analyze.js` 自動呼叫
- 管理員在 `/admin-channels/` 點「抓取字幕」按鈕

由於 Azure IP 限制，**成功率約 2-5%**，主要依賴本機批次處理補齊。

---

## GitHub Actions Workflows

| 檔案 | 說明 | 觸發 |
|---|---|---|
| `channel-sync.yml` | 每小時 RSS 同步，將新影片寫入 D1 為 stub | 每小時 cron + 手動 |
| `fetch-transcripts.yml` | 對 stubs 抓字幕（成效有限，見上方說明）| 手動 + API 自動觸發 |
| `push-notify.yml` | 每日推播通知 | 每日 cron |
| `deploy.yml` | 部署到 Cloudflare Pages | push main |

---

## 頻道訂閱管理

進入 `https://jolike.com/admin-channels/`

**訂閱流程：**
1. 貼上頻道網址（支援 `@handle`、`/channel/UCxxxxxx`、raw channel ID）
2. 訂閱後立即透過 RSS 匯入最近 15 部影片（存為 stubs）
3. 點「📥 掃描全部歷史影片」→ InnerTube browse 取得全部歷史影片 ID
4. 用本機腳本批次抓字幕（見上方說明）

**API 端點：**

| 方法 | 路徑 | 說明 |
|---|---|---|
| `GET` | `/api/channels` | 列出所有頻道 |
| `POST` | `/api/channels` | 新增頻道（`{ url }`）|
| `DELETE` | `/api/channels/:id` | 取消訂閱（影片保留）|
| `POST` | `/api/channels/:id?action=sync` | 手動 RSS 同步 |
| `POST` | `/api/channels/:id?action=import-all&page=N` | 掃描歷史影片（分頁）|
| `POST` | `/api/channels/sync` | 同步所有頻道（cron 用）|

---

## D1 Migrations

```bash
# Production（遠端）
npx wrangler d1 execute jolike-english-db --remote --file=migrations/000X_xxx.sql

# 本地測試
npx wrangler d1 execute jolike-english-db --local --file=migrations/000X_xxx.sql
```

新增 migration 檔後，同步更新本地開發指令（README 上方）。

---

## 注意事項

- **NLP 在瀏覽器端執行**，learning_cards 不存 D1，由 `nlp.js` 即時產生
- **SRS 資料存 localStorage**（key prefix：`jolike_srs_`）
- 所有 SQL 必須使用 parameterized query（`?` 佔位符），禁止字串拼接
- D1 binding 名稱固定為 `DB`（`wrangler.toml` + `context.env.DB`）

---

## Admin 功能

### 影片庫管理（軟刪除）

```
https://jolike.com/library/?admin=<ADMIN_TOKEN>
```

瀏覽器將 token 存入 localStorage，之後直接進 `/library/` 即可看到刪除按鈕。

### 詞彙索引補建

進入 `https://jolike.com/admin-backfill/`，點「開始補建」，對無詞彙索引的舊影片重新掃描並寫入 `video_vocab` 表。
