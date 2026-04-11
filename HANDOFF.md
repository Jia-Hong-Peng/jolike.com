# Transcript Fetch Handoff

## What This Is

Bulk-fetching YouTube transcripts for all channel video stubs and saving them to the production database via `/api/analyze`.

Must be run **locally on a residential IP** — YouTube blocks datacenter IPs (GitHub Actions, Cloudflare Workers) with HTTP 429.

---

## Current Status (2026-04-09, 重開機前更新)

### 已完成的 Channel

| Channel | 狀態 |
|---------|------|
| All Ears English | ✅ 完成（919 ok + 84 no_captions） |
| Team Coco | ✅ 完成（604 ok） |
| 其餘 21 個 channels | ❌ 全部需重跑（見下方說明） |

### IP 封鎖情況（2026-04-09 更新）

- **All Ears English / Team Coco 成功**：前次 session 已抓完，DB 已儲存
- **本次 session（2026-04-09）**：IP 初始測試乾淨，但跑完大量影片後 429 再度觸發
  - yt-dlp 回傳 `no_captions`（找不到 json3 檔）
  - youtube-transcript-api 的 `fetch()` 也收到 `429 Too Many Requests`
  - 因此所有 channel 本次跑完都是 **0 saved**，資料庫未被修改，影片仍為 stub
- **已跑過但 0 saved 的 channel**（需重跑）：BBC Learning English、The Mindset Mentor、A Better You Podcast、anything goes with emma chamberlain、BBC News、BBC World Service、CNBC、Big Think、gabbyreads、The Diary Of A CEO、Tucker Carlson、Jay Shetty Podcast、Ben Shapiro、Brett Cooper、Chris Williamson、MrBeast、TED（進行到 674/903 時停止）、Dwarkesh Patel、The Tonight Show、All-In Podcast、PowerfulJRE
- **換IP方式**：重開機讓路由器重新取得新的外部IP

### 重要：`no_captions` 不會污染資料庫

腳本在 `segments is None` 時只計數，**不呼叫 `save_transcript`**，所以即使大量 no_captions，影片仍維持 `hasTranscript = false`，下次重跑安全。

---

### 本次 Session 的程式碼修改

1. **`scripts/fetch-transcripts.py`** — 兩處改動：
   - 移除 `web` client，改為只用 `android,ios`（web client 需要 PO Token，且 cookies 與 android/ios 不相容）
   - `api_post` 加入 retry 機制（timeout 自動重試 3 次，間隔 5/10/15 秒），避免單次 timeout 導致整個 process crash

2. **`src/data/basic_zh.json`**（新增）— ~350 個高頻基礎字的中文翻譯（first、the、go、you 等 A1/A2 詞）

3. **`src/lib/lookup.js`** — `lookupMeaning` 加入 `basic_zh` fallback，cedict 查不到時 fallback 到 basic_zh，並對 morphStems 做額外嘗試（解決 running→run 的 canonical form 問題）

4. **已部署**：上述前端修改已 build 並 deploy 到 Cloudflare Pages

---

## 重開機後如何繼續

### 1. 驗證新 IP 是否乾淨

```bash
yt-dlp --skip-download --write-auto-sub --sub-lang en --sub-format json3 \
  --extractor-args 'youtube:player_client=android,ios' \
  --output "/tmp/ip_test" --no-playlist \
  'https://www.youtube.com/watch?v=HluANRwPyNo' 2>&1 | tail -5
ls /tmp/ip_test* 2>/dev/null && echo "IP 乾淨，可以繼續" || echo "還是被擋"
```

- 有 `/tmp/ip_test*.json3` 出現 → IP 乾淨
- 出現 `429` → 換IP失敗，需等待或重試

### 2. 執行 fetch 腳本

```bash
set -a && source .env && set +a && nohup python3 scripts/fetch-transcripts.py --limit 9999 > /tmp/fetch-transcripts.log 2>&1 &
tail -f /tmp/fetch-transcripts.log
```

腳本會從 All Ears English 開始，已存的影片會 idempotent 跳過（回傳 200），所以重複跑安全。

### 3. 監控是否再次被擋

正常的 no_captions 應該是「訊息說 no subtitles」，被擋的症狀是：

```
ERROR: Unable to download video subtitles for 'en': HTTP Error 429: Too Many Requests
```

如果大量出現 429，立刻 `kill <PID>` 停止，等IP冷卻。

---

## Credentials

Stored in `.env` (git-ignored):

```
API_BASE=https://jolike.com
BATCH_SECRET=f392161c5cdbc607fccf7e1c7ef63f0ebab1645bfde5ea4c575fb5835e3a9173
```

`BATCH_SECRET` matches `CHANNEL_SYNC_SECRET` in Cloudflare Pages environment variables. Both were updated together on 2026-04-07. **Do not change one without updating the other.**

---

## How the Script Works

1. Calls `GET /api/channels` to list all channels
2. For each channel, calls `GET /api/channels/{id}?limit=200&offset=N` and filters videos where `hasTranscript = false` (stubs)
3. Fetches transcript via **yt-dlp** first（`android,ios` client only），falls back to **youtube-transcript-api**
4. POSTs to `POST /api/analyze` with `Authorization: Bearer <BATCH_SECRET>`
5. API returns 200/201 on success; already-saved videos return 200 (idempotent, safe to re-run)
6. `api_post` 有 retry 機制：timeout 自動重試最多 3 次

---

## Dependencies

```bash
pip install yt-dlp "youtube-transcript-api==0.6.2"
```

Both are already installed on this machine.

---

## Channels

| Channel | Notes |
|---------|-------|
| All Ears English | ✅ 完成 |
| Team Coco | ✅ 完成 |
| BBC Learning English | 需重跑（被 429 擋住，本身有字幕） |
| BBC News | Mostly no_captions (short news clips, no subtitles) |
| BBC World Service | Mix |
| The Mindset Mentor Podcast | High success rate |
| A Better You Podcast | High success rate |
| anything goes with emma chamberlain | High success rate |
| CNBC | Unknown |
| Big Think | Mostly no_captions |
| gabbyreads | Unknown |
| The Diary Of A CEO | Unknown |
| Tucker Carlson | Unknown |
| Jay Shetty Podcast | Unknown |
| Ben Shapiro | Unknown |
| Brett Cooper | Unknown |
| Chris Williamson | Unknown |
| MrBeast | Old videos have no captions |
| TED | Unknown |
| Dwarkesh Patel | Unknown |
| The Tonight Show Starring Jimmy Fallon | Likely high success rate |
| All-In Podcast | Unknown |
| PowerfulJRE | Clips have no captions |

---

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| `HTTP 429` | IP rate-limited by YouTube | 重開機換IP，或等幾小時再重試 |
| 大量 `no_captions` 在已知有字幕的 channel | 假象，其實是 429 擋住 | 用上方驗證指令確認 IP 狀態 |
| `save failed` | API auth rejected | Check `.env` BATCH_SECRET matches Cloudflare `CHANNEL_SYNC_SECRET` |
| `no_captions`（真的） | Video genuinely has no English subtitles | Normal, skip |
| `[timeout, retry N/3]` | API timeout，自動重試中 | 正常，等待即可 |
| Process dies mid-run | SSL/network error | Re-run；script is idempotent |

### If BATCH_SECRET needs to be reset

```bash
# Generate new secret
python3 -c "import secrets; print(secrets.token_hex(32))"

# Update Cloudflare Pages
echo "<new_secret>" | npx wrangler pages secret put CHANNEL_SYNC_SECRET --project-name jolike-english

# Trigger re-deploy (required for secret to take effect)
npm run build && npx wrangler pages deploy dist --project-name jolike-english

# Update .env
# Edit .env and replace BATCH_SECRET value
```
