/**
 * usePWA — Service Worker registration + Web Push subscription.
 *
 * VAPID_PUBLIC_KEY: generated at project setup, embedded here.
 * Server-side VAPID_PRIVATE_JWK must be set as a Cloudflare secret
 * (see migrations/0002_push_subscriptions.sql for D1 schema).
 *
 * Call registerSW() once on app mount.
 * Call subscribePush() after user completes first review session.
 */

const VAPID_PUBLIC_KEY = 'BJibwPlh8oxZM_Aa76J94vIZWpwWT-4ixt_1ct2qWXL6oxu8qea6KLZe6Bahx4sxN4jgtoYFfH1lCA1nzXH1JVo'

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map((c) => c.charCodeAt(0)))
}

let swRegistration = null

export async function registerSW() {
  if (!('serviceWorker' in navigator)) return
  try {
    swRegistration = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
  } catch {
    // SW registration failed — non-fatal
  }
}

/**
 * Request push permission and save subscription to server.
 * Should be called only after a user gesture (button tap) to comply with browser policy.
 * @returns {Promise<boolean>} true if subscription succeeded
 */
export async function subscribePush() {
  if (!swRegistration) return false
  if (!('PushManager' in window)) return false

  try {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return false

    const subscription = await swRegistration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    })

    const res = await fetch('/api/push-subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription }),
    })

    return res.ok
  } catch {
    return false
  }
}

/**
 * Check if push notifications are currently enabled for this browser.
 * @returns {Promise<boolean>}
 */
export async function isPushEnabled() {
  if (!swRegistration || !('PushManager' in window)) return false
  try {
    const sub = await swRegistration.pushManager.getSubscription()
    return !!sub
  } catch {
    return false
  }
}
