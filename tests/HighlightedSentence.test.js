/**
 * HighlightedSentence.vue — unit tests
 *
 * Tests the computed `parts` logic that splits a sentence around a keyword.
 * The component replaced v-html+regex to eliminate XSS risk.
 */

import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import HighlightedSentence from '../src/components/HighlightedSentence.vue'

// Helper: mount and return the computed parts via rendered output
function getParts(sentence, keyword, cloze = false) {
  const wrapper = mount(HighlightedSentence, {
    props: { sentence, keyword, cloze },
  })
  return wrapper
}

describe('HighlightedSentence — highlight mode', () => {
  it('T-HS-1 — keyword in middle: before/keyword/after split correctly', () => {
    const w = getParts('The economy grew rapidly.', 'economy')
    expect(w.text()).toContain('The ')
    expect(w.text()).toContain('economy')
    expect(w.text()).toContain(' grew rapidly.')
    // keyword wrapped in <mark>
    expect(w.find('mark').text()).toBe('economy')
  })

  it('T-HS-2 — keyword at sentence start: before is empty', () => {
    const w = getParts('Capitalism drives innovation.', 'Capitalism')
    expect(w.find('mark').text()).toBe('Capitalism')
    // No text before the mark
    const spans = w.findAll('span')
    const beforeSpan = spans.find(s => s.text() === '' || !s.text())
    // Before should have no visible text before mark
    expect(w.text().startsWith('Capitalism')).toBe(true)
  })

  it('T-HS-3 — keyword not found: full sentence shown in before, no mark', () => {
    const sentence = 'This word is missing.'
    const w = getParts(sentence, 'xyznothere')
    expect(w.find('mark').exists()).toBe(false)
    expect(w.text()).toContain(sentence)
  })

  it('T-HS-4 — case-insensitive match: keyword=ECONOMY matches "economy" in sentence', () => {
    const w = getParts('The economy grew.', 'ECONOMY')
    // indexOf uses toLowerCase match, so mark should appear
    expect(w.find('mark').exists()).toBe(true)
    // the rendered text should be the original casing from sentence
    expect(w.find('mark').text()).toBe('economy')
  })
})

describe('HighlightedSentence — cloze mode', () => {
  it('T-HS-5 — cloze mode: keyword is hidden, blank placeholder shown', () => {
    const w = getParts('The economy shrank.', 'economy', true)
    // keyword text should not appear
    expect(w.find('mark').exists()).toBe(false)
    // cloze blank should exist (a span or inline-block element)
    expect(w.html()).toContain('border-b-2')
    // before and after still visible
    expect(w.text()).toContain('The ')
    expect(w.text()).toContain(' shrank.')
  })

  it('T-HS-6 — cloze mode with keyword not found: no crash, shows full sentence', () => {
    const w = getParts('Some sentence here.', 'notfound', true)
    expect(w.find('mark').exists()).toBe(false)
    expect(w.text()).toContain('Some sentence here.')
  })
})

describe('HighlightedSentence — edge cases', () => {
  it('T-HS-7 — empty sentence prop: renders without crashing', () => {
    // empty string — component guards: `if (!props.sentence || !props.keyword)`
    const w = getParts('', 'economy')
    expect(w.find('mark').exists()).toBe(false)
  })

  it('T-HS-8 — empty keyword prop: no highlight, full sentence in before', () => {
    const w = getParts('The economy shrank.', '')
    expect(w.find('mark').exists()).toBe(false)
  })
})
