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
 * GET /api/library
 * Fetch all public videos for the library page.
 *
 * @param {{ limit?: number, offset?: number }} options
 * @returns {Promise<{videos: Array<{id,title,duration_seconds,analyzed_at}>}>}
 */
export async function getLibrary({ limit = 50, offset = 0 } = {}) {
  let res
  try {
    res = await fetch(`${BASE}/api/library?limit=${limit}&offset=${offset}`)
  } catch {
    throw { error: 'NETWORK_ERROR', message: '請確認網路連線' }
  }

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw { error: data.error || 'SERVER_ERROR', message: data.message || '載入失敗' }
  }
  return data
}

/**
 * DELETE /api/library/:id
 * Admin soft-delete a video from the library.
 *
 * @param {string} videoId
 * @param {string} adminToken - Bearer token from env
 */
export async function deleteLibraryVideo(videoId, adminToken) {
  let res
  try {
    res = await fetch(`${BASE}/api/library/${videoId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminToken}` },
    })
  } catch {
    throw { error: 'NETWORK_ERROR', message: '請確認網路連線' }
  }

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw { error: data.error || 'SERVER_ERROR', message: data.message || '刪除失敗' }
  }
  return data
}

/**
 * POST /api/video-vocab
 * Store vocabulary index for a video (called after client-side transcript scan).
 *
 * @param {string} videoId
 * @param {Record<string, string[]>} vocab - { list_id: [word, ...] }
 */
export async function postVocabIndex(videoId, vocab) {
  try {
    await fetch(`${BASE}/api/video-vocab`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ video_id: videoId, vocab }),
    })
  } catch {
    // Non-critical: fire-and-forget, don't block user
  }
}

/**
 * GET /api/vocab-videos?list=X&word=Y
 * Return videos containing a specific word from a vocab list.
 *
 * @param {string} listId
 * @param {string} word
 * @returns {Promise<Array<{id, title}>>}
 */
export async function getVocabVideos(listId, word) {
  try {
    const res = await fetch(`${BASE}/api/vocab-videos?list=${encodeURIComponent(listId)}&word=${encodeURIComponent(word)}`)
    const data = await res.json().catch(() => ({}))
    return data.videos ?? []
  } catch {
    return []
  }
}

// ── Channels (subscription management) ────────────────────────────────────────

export async function getChannels() {
  const res = await fetch(`${BASE}/api/channels`)
  const data = await res.json().catch(() => ({}))
  return data.channels ?? []
}

export async function addChannel(url) {
  const res = await fetch(`${BASE}/api/channels`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw { error: data.error || 'ADD_FAILED', channel: data.channel }
  return data
}

export async function deleteChannel(channelId) {
  const res = await fetch(`${BASE}/api/channels/${channelId}`, { method: 'DELETE' })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw { error: data.error || 'DELETE_FAILED' }
  return data
}

export async function syncChannel(channelId) {
  const res = await fetch(`${BASE}/api/channels/${channelId}?action=sync`, { method: 'POST' })
  return res.json().catch(() => ({}))
}

/**
 * Import one page (up to 300) of historical videos from InnerTube browse.
 * Large channels require multiple calls. Use page=0,1,2... until hasMore=false.
 */
export async function importChannelVideosPage(channelId, page = 0) {
  const res = await fetch(`${BASE}/api/channels/${channelId}?action=import-all&page=${page}`, { method: 'POST' })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw { error: data.error || 'IMPORT_FAILED' }
  return data  // { page, imported, total_so_far, hasMore }
}


export async function getChannelVideos(channelId, { limit = 200, offset = 0 } = {}) {
  const res = await fetch(`${BASE}/api/channels/${channelId}?limit=${limit}&offset=${offset}`)
  const data = await res.json().catch(() => ({}))
  return data
}

/**
 * GET /api/vocab-stats?list=X&limit=N
 * Return word frequency rankings for a vocabulary list.
 * @param {string} listId
 * @param {number} limit
 * @returns {Promise<Array<{word: string, video_count: number}>>}
 */
export async function getVocabStats(listId, limit = 100, offset = 0) {
  const res = await fetch(`${BASE}/api/vocab-stats?list=${encodeURIComponent(listId)}&limit=${limit}&offset=${offset}`)
  const data = await res.json().catch(() => ({}))
  return { words: data.words ?? [], stats: data.stats ?? null, available_lists: data.available_lists ?? null }
}

export async function getWordExamples(word, listId = 'ngsl', limit = 3) {
  const res = await fetch(`${BASE}/api/word-examples?word=${encodeURIComponent(word)}&list=${encodeURIComponent(listId)}&limit=${limit}`)
  const data = await res.json().catch(() => ({}))
  return data.examples ?? []
}

export async function getPhraseStats({ limit = 100, offset = 0, minVideos = 3 } = {}) {
  const res = await fetch(`${BASE}/api/phrase-stats?limit=${limit}&offset=${offset}&min_videos=${minVideos}`)
  const data = await res.json().catch(() => ({}))
  return { phrases: data.phrases ?? [], has_more: data.has_more ?? false }
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
    TRANSCRIPT_PENDING: '字幕準備中，請稍候 1-2 分鐘再試',
    ANALYSIS_FAILED: '分析失敗，請稍後再試',
    NETWORK_ERROR: '請確認網路連線',
    NOT_FOUND: '找不到影片資料，請重新輸入',
  }
  return messages[errorCode] || '發生錯誤，請稍後再試'
}
