#!/usr/bin/env node
/**
 * scripts/migrate-transcripts-to-r2.mjs
 *
 * Triggers the /api/admin/migrate-r2 endpoint in batches until all
 * D1 raw_transcript rows are migrated to R2.
 *
 * Usage:
 *   set -a && source .env && set +a
 *   node scripts/migrate-transcripts-to-r2.mjs [--limit N]
 */

const API_BASE     = (process.env.API_BASE || 'https://jolike.com').replace(/\/$/, '')
const BATCH_SECRET = process.env.BATCH_SECRET || ''
const PAGE_SIZE    = 50
const DELAY_MS     = 300

const args = process.argv.slice(2)
const MAX  = (() => { const i = args.indexOf('--limit'); return i >= 0 ? parseInt(args[i + 1]) : Infinity })()

if (!BATCH_SECRET) { console.error('BATCH_SECRET required in env'); process.exit(1) }

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function migratePage() {
  const res = await fetch(`${API_BASE}/api/admin/migrate-r2`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ secret: BATCH_SECRET, limit: PAGE_SIZE }),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`HTTP ${res.status}: ${text}`)
  }
  return res.json()
}

async function main() {
  console.log(`API: ${API_BASE}`)
  console.log(`Migrating raw_transcript → R2 in pages of ${PAGE_SIZE}...`)

  let totalMigrated = 0
  let totalSkipped  = 0
  let totalErrors   = 0
  let page = 1

  while (true) {
    if (totalMigrated >= MAX) {
      console.log(`\nReached limit (${MAX}), stopping.`)
      break
    }

    process.stdout.write(`Page ${page} ... `)

    let result
    try {
      result = await migratePage()
    } catch (e) {
      console.error(`\nError on page ${page}: ${e.message}`)
      console.error('Retry after fixing the issue.')
      break
    }

    const { migrated, skipped, errors, has_more } = result
    totalMigrated += migrated
    totalSkipped  += skipped
    totalErrors   += errors

    console.log(`migrated=${migrated} skipped=${skipped} errors=${errors} | total=${totalMigrated}`)

    if (migrated === 0 && skipped === 0 && errors === 0) {
      console.log('\nAll done — no more rows to migrate.')
      break
    }

    page++
    await sleep(DELAY_MS)
  }

  console.log(`\n✓ Final: ${totalMigrated} migrated, ${totalSkipped} skipped, ${totalErrors} errors`)
}

main().catch(e => { console.error(e); process.exit(1) })
