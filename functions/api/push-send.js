/**
 * GET /api/push-send
 * Send SRS review reminders to all subscribed users.
 *
 * Triggered by an external daily cron (e.g. GitHub Actions, Uptime Robot, or a
 * separate Cloudflare Worker with a scheduled trigger).
 *
 * Required Cloudflare environment secrets:
 *   VAPID_PRIVATE_JWK  — JSON string of the EC P-256 private key JWK
 *                        (generated at project setup, stored as CF secret)
 *   PUSH_SEND_SECRET   — Authorization token for this endpoint
 *                        set as: wrangler secret put PUSH_SEND_SECRET
 *
 * VAPID_PUBLIC_KEY (embedded in usePWA.js):
 *   BJibwPlh8oxZM_Aa76J94vIZWpwWT-4ixt_1ct2qWXL6oxu8qea6KLZe6Bahx4sxN4jgtoYFfH1lCA1nzXH1JVo
 */

import { getAllPushSubscriptions, deletePushSubscription } from './_lib/db.js'

const VAPID_SUBJECT = 'mailto:admin@jolike.com'

export async function onRequestGet(context) {
  const { request, env } = context

  // Simple bearer token guard
  const authHeader = request.headers.get('Authorization') || ''
  if (env.PUSH_SEND_SECRET && authHeader !== `Bearer ${env.PUSH_SEND_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  if (!env.VAPID_PRIVATE_JWK) {
    return new Response(JSON.stringify({ error: 'VAPID_PRIVATE_JWK not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const DB = env.DB
  const subscriptions = await getAllPushSubscriptions(DB)
  if (subscriptions.length === 0) {
    return jsonOk({ sent: 0, message: 'No subscriptions' })
  }

  const vapidJwk = JSON.parse(env.VAPID_PRIVATE_JWK)
  const privateKey = await importVapidPrivateKey(vapidJwk)

  const payload = JSON.stringify({
    title: 'JoLike English',
    body: '你有單字到複習時間了！點此開始今日練習 💪',
  })

  let sent = 0
  let failed = 0

  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      const result = await sendPush(sub, payload, privateKey, env)
      if (result === 'gone') {
        await deletePushSubscription(DB, sub.endpoint).catch(() => {})
        failed++
      } else if (result) {
        sent++
      } else {
        failed++
      }
    })
  )

  return jsonOk({ sent, failed, total: subscriptions.length })
}

// ── VAPID JWT signing (Web Crypto API — available in CF Workers/Pages) ─────────

async function importVapidPrivateKey(jwk) {
  return crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  )
}

async function createVapidJWT(endpoint, privateKey) {
  const url = new URL(endpoint)
  const audience = `${url.protocol}//${url.host}`
  const expiration = Math.floor(Date.now() / 1000) + 12 * 3600  // 12h

  const header = { typ: 'JWT', alg: 'ES256' }
  const payload = { aud: audience, exp: expiration, sub: VAPID_SUBJECT }

  const toBase64url = (str) =>
    btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')

  const headerB64  = toBase64url(JSON.stringify(header))
  const payloadB64 = toBase64url(JSON.stringify(payload))
  const signingInput = `${headerB64}.${payloadB64}`

  const encoder = new TextEncoder()
  const sigBuf = await crypto.subtle.sign(
    { name: 'ECDSA', hash: { name: 'SHA-256' } },
    privateKey,
    encoder.encode(signingInput)
  )

  const sigB64 = toBase64url(String.fromCharCode(...new Uint8Array(sigBuf)))
  return `${signingInput}.${sigB64}`
}

const VAPID_PUBLIC_KEY = 'BJibwPlh8oxZM_Aa76J94vIZWpwWT-4ixt_1ct2qWXL6oxu8qea6KLZe6Bahx4sxN4jgtoYFfH1lCA1nzXH1JVo'

async function sendPush(sub, payload, privateKey, _env) {
  try {
    const jwt = await createVapidJWT(sub.endpoint, privateKey)

    const res = await fetch(sub.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'TTL': '86400',
        'Authorization': `vapid t=${jwt},k=${VAPID_PUBLIC_KEY}`,
        'Content-Encoding': 'aesgcm',
      },
      body: payload,
    })

    if (res.status === 410 || res.status === 404) return 'gone'
    return res.ok
  } catch {
    return false
  }
}

function jsonOk(data) {
  return new Response(JSON.stringify(data), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
