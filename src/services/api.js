/**
 * Frontend API client — fetch wrapper for Cloudflare Pages Functions.
 * All errors are normalised to { error: CODE, message: string }.
 */

const BASE = ''  // same-origin; Vite proxy handles /api → localhost:8788

/**
 * POST /api/analyze
 * Validate YouTube URL, fetch transcript, cache to D1.
 *
 * @param {string} url - YouTube URL from user input
 * @returns {Promise<{video:{id,title,duration_seconds}, transcript:Array, cached:boolean}>}
 * @throws {{ error: 'INVALID_URL'|'NO_CAPTIONS'|'ANALYSIS_FAILED'|'NETWORK_ERROR', message: string }}
 */
export async function analyzeVideo(url) {
  let res
  try {
    res = await fetch(`${BASE}/api/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    })
  } catch {
    throw { error: 'NETWORK_ERROR', message: '請確認網路連線' }
  }

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    throw {
      error: data.error || 'ANALYSIS_FAILED',
      message: data.message || '分析失敗，請稍後再試',
    }
  }

  return data
}

/**
 * GET /api/video/:id
 * Retrieve cached video + transcript from D1.
 *
 * @param {string} videoId
 * @returns {Promise<{video:{id,title,duration_seconds}, transcript:Array, cached:boolean}>}
 * @throws {{ error: 'NOT_FOUND'|'NETWORK_ERROR', message: string }}
 */
export async function getVideo(videoId) {
  let res
  try {
    res = await fetch(`${BASE}/api/video/${videoId}`)
  } catch {
    throw { error: 'NETWORK_ERROR', message: '請確認網路連線' }
  }

  const data = await res.json().catch(() => ({}))

  if (!res.ok) {
    throw {
      error: data.error || 'NOT_FOUND',
      message: data.message || '找不到影片資料',
    }
  }

  return data
}

/**
 * Map API error codes to user-facing messages.
 * @param {string} errorCode
 * @returns {string}
 */
export function getErrorMessage(errorCode) {
  const messages = {
    INVALID_URL: '請輸入 YouTube 連結',
    NO_CAPTIONS: '此影片不含英文字幕，請換一支影片',
    ANALYSIS_FAILED: '分析失敗，請稍後再試',
    NETWORK_ERROR: '請確認網路連線',
    NOT_FOUND: '找不到影片資料，請重新輸入',
  }
  return messages[errorCode] || '發生錯誤，請稍後再試'
}
