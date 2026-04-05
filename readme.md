以下是幫你整理好的 **繁體中文版本 Markdown 草稿**（已調整語氣，更貼近產品＋品牌用語，可直接用👇）

---

```md id="jolike-english-md-zh"
# JoLike English

## Learn English. Just like you.

---

## 🚀 品牌願景

我們不是用「上課」的方式教英文。

我們把你正在看的影片，  
變成你真正能理解、能使用、能說出口的英文。

👉 從觀看 → 理解 → 開口說  
👉 幾分鐘內完成，任何地方都可以（甚至捷運上）

---

## 💡 核心理念

JoLike English 不是「學英文」

而是：

> 🎯 從你正在看的內容中，學會你真正需要的英文

---

## 🔥 產品概念

👉「滑一滑，就學會英文」

- 不用背單字書  
- 不用上長時間課程  
- 不浪費時間  

只給你：

👉 真實影片中的「實用英文」

---

## 📱 MVP 目標

打造一個：

👉 **通勤也能用的英文強化工具**

特點：

- ⏱ 每次 1～5 分鐘
- 📱 單手操作
- 🔁 可隨時中斷 / 重複
- 🧠 有感進步

---

## 🧩 使用流程

### 1️⃣ 輸入

使用者貼上 YouTube 連結

```

[ 貼上 YouTube URL ]

```id="input-example"

---

### 2️⃣ 系統處理

系統自動：

- 取得字幕
- 分析內容
- 找出：
  - 關鍵單字
  - 片語
  - 常用句型
- 產生學習片段（clips）

---

### 3️⃣ 輸出（核心🔥）

👉 產生「學習滑動流（Learning Feed）」

類似：

👉 IG / TikTok 滑卡片

---

## 🎬 學習卡片設計（核心單位）

👉 一張卡片 = 一個學習單位

---

### ▶️ 影片片段（3～6 秒）

```

"...try to figure out why..."

```id="clip-example"

👉 單字高亮：

```

figure out

```id="highlight-example"

---

### 📘 中文解釋（極簡）

```

figure out = 搞懂 / 想清楚

```id="meaning-example"

---

### 🎧 操作功能

- ▶️ 重播
- ⏱ 慢速播放
- 🔊 聽音

---

### 🗣 跟讀功能（核心🔥）

👉 Shadowing（跟讀模式）

流程：

1. 播放句子  
2. 顯示字幕  
3. 使用者跟讀  
4. 錄音  
5. 播放自己的聲音  

👉 不做評分（MVP）  
👉 目標：讓使用者「開口說」

---

### ⭐ 互動按鈕

- 👍 我會了
- ⭐ 收藏
- ❓ 不熟

---

## 🧠 學習設計（80/20）

我們不會給你全部內容

只給你：

👉 現在最重要的

每支影片產出：

- 10 個單字
- 5 個片語
- 3 個句型

---

## 🎯 核心體驗

👉 滑 → 看 → 懂 → 說

👉 5 分鐘內完成一次有效學習

---

## 🚇 使用情境

適合：

- 捷運 🚇
- 公車 🚌
- 等待時間 ⏳

👉 碎片時間也能進步

---

## 💥 產品價值

你不再：

❌ 背單字  
❌ 硬記文法  

你會：

✅ 從真實語境學習  
✅ 聽真實發音  
✅ 說真實句子  

---

## 🧭 產品定位

JoLike English 是：

> 🔥 真實世界的英文加速器

---

## 🏷 品牌設計

### 品牌名稱
JoLike English

---

### Slogan
👉 **Learn English. Just like you.**

---

### 延伸文案

- 從你看的影片學英文  
- 英文開始變得有感  
- 停止死背，開始理解  
- 讓英文真正用得上  

---

## 🔑 核心洞察

我們不是在教英文

而是在：

> 👉 幫助你理解並使用「真實世界的英文」

---

## 🧱 MVP 範圍

### ✅ 必做功能

- YouTube 輸入
- 字幕取得
- Clip 產生
- 學習滑動流（Feed）
- 單字高亮
- 簡單中文解釋
- 跟讀（錄音＋播放）
- 基本互動（會 / 收藏 / 不熟）

---

### ❌ MVP 不做

- 不做登入系統
- 不做 AI 對話
- 不做文法教學
- 不做排行榜
- 不做社交功能
- 不做寫作練習

---

## 🎯 成功指標（MVP）

使用者產生感覺：

👉「我真的懂了」  
👉「我真的可以說這句」

---

## 🔥 一句話總結

> JoLike English 把影片變成你最快學會英文的方法

---
```

---

# 🔥 補一句給你（產品層）

這份你可以直接用在：

* Notion 規格文件
* GitHub README
* 對外介紹
* Pitch Deck 初稿

---

# 🛠 開發者交接文件

## 技術架構

| 層 | 技術 |
|---|---|
| 前端 | Vue 3 + Vite（MPA，無 Router）+ Tailwind CSS v3 |
| 後端 | Cloudflare Pages Functions（`functions/api/`）|
| 資料庫 | Cloudflare D1（SQLite）binding 名稱固定為 `DB` |
| 部署 | git push main → Cloudflare Pages 自動部署 |

## 頁面路由

| 路徑 | 說明 |
|---|---|
| `/` | InputPage — 貼 YouTube 連結，選模式 |
| `/feed/?v={id}` | FeedPage — NLP 詞彙學習（TikTok 滑卡片）|
| `/shadow/?v={id}` | ShadowingPage — 逐字幕跟讀模式 |
| `/review/` | ReviewPage — SRS 間隔複習（Active Recall）|
| `/progress/` | ProgressPage — 詞彙學習進度統計 |
| `/library/` | LibraryPage — 全站公開影片庫 |
| `/vocab-study/` | VocabStudyPage — 多益／雅思／托福詞彙清單學習 |
| `/admin-channels/` | 頻道訂閱管理（Admin）|
| `/admin-backfill/` | 詞彙索引補建（Admin）|

## 本地開發

```bash
npm install
npm run dev          # Vite dev server（port 5173，/api 自動 proxy 到 8788）

# 初始化本地 D1（只需做一次，依序執行所有 migrations）
npx wrangler d1 execute DB --local --file=migrations/0001_schema.sql
npx wrangler d1 execute DB --local --file=migrations/0002_push_subscriptions.sql
npx wrangler d1 execute DB --local --file=migrations/0003_channels.sql

# Production 上線新 migration
npx wrangler d1 execute DB --remote --file=migrations/0003_channels.sql

# 啟動 Cloudflare Pages 本地環境（需先 npm run build）
npm run build
npx wrangler pages dev dist --d1=DB
```

## 環境變數（Cloudflare Pages Secrets）

所有 secret 存放於 Cloudflare Pages 後台：  
**Cloudflare Dashboard → Pages → jolike-english → Settings → Environment variables**

| 變數名稱 | 用途 |
|---|---|
| `DB` | D1 binding（自動綁定，非 secret）|
| `ADMIN_TOKEN` | 影片庫管理員刪除權限 token |
| `VAPID_PRIVATE_JWK` | Web Push 私鑰 |
| `PUSH_SEND_SECRET` | Push 發送 API 保護 |
| `CHANNEL_SYNC_SECRET` | 頻道 RSS cron 保護 token |

**GitHub Actions Secrets（Settings → Secrets → Actions）：**

| 變數名稱 | 用途 |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare 部署用 |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare 帳號 ID |
| `PUSH_SEND_SECRET` | 每日推播 cron 驗證 |
| `CHANNEL_SYNC_SECRET` | 每小時頻道同步 cron 驗證 |

---

## Admin 功能

### 影片庫管理（軟刪除）

管理員可從影片庫中移除影片（軟刪除，字幕快取保留）。

**啟用方式：**
```
https://jolike.com/library/?admin=<ADMIN_TOKEN 的值>
```
瀏覽器會將 token 存入 localStorage，之後直接進 `/library/` 即可看到每張影片右上角的刪除按鈕。

**更換 token：**
```bash
npx wrangler pages secret put ADMIN_TOKEN --project-name jolike-english
```

---

### 頻道訂閱管理（`/admin-channels/`）

訂閱 YouTube 頻道後，系統會自動把該頻道的影片入庫，並透過 GitHub Actions 每小時 RSS 同步更新。

**操作流程：**

1. 進入 `https://jolike.com/admin-channels/`
2. 貼上頻道網址（支援格式如下），點「訂閱」
   ```
   https://www.youtube.com/@TED
   https://www.youtube.com/channel/UCxxxxxx
   @TED
   UCxxxxxx（raw channel ID）
   ```
3. 訂閱後系統立即透過 RSS 匯入最近 15 部影片
4. 點「📥 掃描全部歷史影片」→ 透過 InnerTube browse 取得所有歷史影片 ID（無需 API key）
5. 點「🎬 抓取字幕」→ 瀏覽器逐批呼叫 `/api/analyze`，顯示進度條

**自動同步：**  
GitHub Actions cron 每小時執行，呼叫 `POST /api/channels/sync`，新影片自動入庫（儲存為 stub，無字幕）。字幕需使用者觸發或管理員手動抓取。

**設定 cron secret：**
```bash
# Cloudflare Pages 端
npx wrangler pages secret put CHANNEL_SYNC_SECRET --project-name jolike-english

# GitHub Actions 端（相同值）
# Settings → Secrets → Actions → New repository secret
# Name: CHANNEL_SYNC_SECRET
```

**API 端點：**

| 方法 | 路徑 | 說明 |
|---|---|---|
| `GET` | `/api/channels` | 列出所有訂閱頻道 |
| `POST` | `/api/channels` | 新增頻道（body: `{ url }` ）|
| `GET` | `/api/channels/:id` | 頻道詳情 + 影片清單 |
| `DELETE` | `/api/channels/:id` | 取消訂閱（影片保留）|
| `POST` | `/api/channels/:id?action=sync` | 手動 RSS 同步 |
| `POST` | `/api/channels/:id?action=import-all` | 掃描全部歷史影片 |
| `POST` | `/api/channels/sync` | 同步所有頻道（cron 用）|

---

### 詞彙索引補建（`/admin-backfill/`）

對資料庫中所有舊影片（無詞彙索引）重新掃描詞彙並寫入 `video_vocab` 表，讓「相關影片」功能可正確對應單字。

進入 `https://jolike.com/admin-backfill/`，點「開始補建」即可。

## D1 Migrations

新增欄位或表格時，在 `migrations/` 新增 SQL 檔，然後執行：

```bash
# 遠端 production（使用 --command 避免 file import 權限問題）
npx wrangler d1 execute jolike-english-db --remote --command="<SQL 語句>"

# 本地測試
npx wrangler d1 execute jolike-english-db --local --file=migrations/000X_xxx.sql
```

## 注意事項

- **NLP 分析在前端執行**（`src/lib/nlp.js`），不跑在 Cloudflare Worker（10ms CPU 限制）
- **learning_cards 不存 D1**，由 `nlp.js` 在瀏覽器即時產生
- **SRS 資料存在使用者 localStorage**（key prefix：`jolike_srs_`）
- 所有 SQL 必須使用 parameterized query（`?` 佔位符），禁止字串拼接

