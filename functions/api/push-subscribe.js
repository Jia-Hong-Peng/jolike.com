/**
 * POST /api/push-subscribe
 * Save a Web Push subscription to D1.
 * Called from usePWA.subscribePush() after user grants push permission.
 */

import { savePushSubscription } from './_lib/db.js'

export async function onRequestPost(context) {
  const { request, env } = context
  const DB = env.DB

  let body
  try {
    body = await request.json()
  } catch {
    return jsonError(400, 'Invalid JSON')
  }

  const { subscription } = body || {}
  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return jsonError(400, 'Missing subscription fields')
  }

  try {
    await savePushSubscription(DB, subscription)
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('push-subscribe error:', err)
    return jsonError(500, 'Failed to save subscription')
  }
}

function jsonError(status, message) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}
