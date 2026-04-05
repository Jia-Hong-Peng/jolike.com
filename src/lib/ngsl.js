/**
 * ngsl.js — NGSL/TSL easy English definition lookup (lazy-loaded).
 *
 * Kept in its own module (~246KB minified) so callers that only occasionally
 * need a fallback definition can dynamic-import this file on demand instead of
 * paying the cost upfront in the initial bundle.
 *
 * Usage (lazy):
 *   const { lookupNgslDef } = await import('@/lib/ngsl.js')
 *   const def = lookupNgslDef('allocate')
 */

import ngslDefs from '@/data/ngsl_defs.json'

/**
 * Look up an easy English definition from NGSL or TSL.
 * Returns '' if the word is not in the list.
 *
 * @param {string} keyword
 * @returns {string}
 */
export function lookupNgslDef(keyword) {
  const key = keyword.toLowerCase()
  return ngslDefs[key] || ngslDefs[key.replace(/-/g, ' ')] || ''
}
