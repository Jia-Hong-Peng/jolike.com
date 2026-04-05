# jolike.com Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-04-02

## Active Technologies

- JavaScript (ES2022) (001-mvp-learning-feed)

## Project Structure

```text
src/
tests/
```

## Commands

npm test && npm run lint

## Code Style

JavaScript (ES2022): Follow standard conventions

## Recent Changes

- 001-mvp-learning-feed: Added JavaScript (ES2022)

<!-- MANUAL ADDITIONS START -->
## Architecture Notes (001-mvp-learning-feed)

### NLP 前端執行
- NLP 分析（`src/lib/nlp.js`）在瀏覽器端執行，使用 `compromise.js` + `src/data/coca5000.json` + `src/data/cedict.json`
- 後端（Cloudflare Pages Functions）只負責 YouTube timedtext proxy 與 D1 快取
- Cloudflare Workers 免費方案 CPU 10ms 上限，NLP 不可在 Worker 端執行

### D1 Binding 規則
- binding 名稱固定為 `DB`（`wrangler.toml` + `context.env.DB`）
- 所有 SQL 必須使用 parameterized query（`?` 佔位符），禁止字串拼接
- D1 只有 `videos` 表；`learning_cards` 不入 D1（前端記憶體）

### MPA 路由慣例
- 兩個頁面：`/`（InputPage）和 `/feed/`（FeedPage）
- 頁面切換一律用 `window.location.href`，不引入 Vue Router
- videoId 透過 URL query string `?v={id}` 傳遞

### 本地開發
```bash
npm install
npm run dev          # Vite dev server (port 5173，proxy /api → 8788)
wrangler pages dev dist --d1=DB  # Cloudflare Pages local（需先 npm run build）
wrangler d1 execute DB --local --file=migrations/0001_schema.sql  # 初始化 schema
```
<!-- MANUAL ADDITIONS END -->

## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.
The skill has specialized workflows that produce better results than ad-hoc answers.

Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke office-hours
- Bugs, errors, "why is this broken", 500 errors → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the site, find bugs → invoke qa
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Weekly retro → invoke retro
- Design system, brand → invoke design-consultation
- Visual audit, design polish → invoke design-review
- Architecture review → invoke plan-eng-review
- Save progress, checkpoint, resume → invoke checkpoint
- Code quality, health check → invoke health
