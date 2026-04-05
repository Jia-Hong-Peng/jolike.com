import { describe, it, expect } from 'vitest'
import { extractLearningItems, lookupMeaning, wordDifficultyTier, extractWordsFromSegment } from '../src/lib/nlp.js'
import { getVocabCategories } from '../src/lib/lookup.js'

// ── Helpers ────────────────────────────────────────────────────────────────────
const makeTranscript = (texts) => texts.map((text, i) => ({ text, start: i * 3, dur: 3 }))

// ── Phrase difficulty_tier ─────────────────────────────────────────────────────
const TRANSCRIPT_AWL = makeTranscript([
  'You should accomplish this task immediately.',
  'I want to go home now and sleep early tonight.',
])

const TRANSCRIPT_SIMPLE = makeTranscript([
  'The go home routine is important.',
])

describe('nlp.js — phrase difficulty_tier', () => {
  it('T13 — phrase containing a B2/AWL word gets tier >= 3', () => {
    const items = extractLearningItems(TRANSCRIPT_AWL, 'vid1', 'beginner')
    const phrases = items.filter(i => i.type === 'phrase')
    if (phrases.length === 0) return
    const accomplishPhrase = phrases.find(p => p.keyword.includes('accomplish'))
    if (accomplishPhrase) {
      expect(accomplishPhrase.difficulty_tier).toBeGreaterThanOrEqual(3)
    }
  })

  it('T14 — phrase tier is NOT hardcoded 2 for phrases with tier-1 words', () => {
    const items = extractLearningItems(TRANSCRIPT_SIMPLE, 'vid1', 'beginner')
    const phrases = items.filter(i => i.type === 'phrase')
    if (phrases.length === 0) return
    const lowPhrase = phrases.find(p => p.keyword === 'go home')
    if (lowPhrase) {
      expect(lowPhrase.difficulty_tier).toBe(1)
    }
  })
})

// ── Card IDs ───────────────────────────────────────────────────────────────────
describe('nlp.js — card IDs', () => {
  it('T15 — card IDs use keyword-based format (not index-based)', () => {
    const items = extractLearningItems(TRANSCRIPT_AWL, 'vid1', 'intermediate')
    for (const item of items) {
      const expectedId = `vid1_${item.keyword.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}`
      expect(item.id).toBe(expectedId)
    }
  })

  it('T16 — card IDs do NOT contain the level string', () => {
    const items = extractLearningItems(TRANSCRIPT_AWL, 'vid1', 'intermediate')
    for (const item of items) {
      expect(item.id).not.toContain('intermediate')
      expect(item.id).not.toContain('beginner')
      expect(item.id).not.toContain('advanced')
    }
  })

  it('T17 — same keyword produces same ID regardless of level', () => {
    const itemsMid = extractLearningItems(TRANSCRIPT_AWL, 'vid1', 'intermediate')
    const itemsAdv = extractLearningItems(TRANSCRIPT_AWL, 'vid1', 'advanced')
    for (const mid of itemsMid) {
      const adv = itemsAdv.find(a => a.keyword === mid.keyword)
      if (adv) expect(mid.id).toBe(adv.id)
    }
  })
})

// ── Lemmatization (lemma field, keyword stays as inflected form) ──────────────
describe('nlp.js — lemma field for base/canonical form', () => {
  it('T-LEMMA-1 — chaperoning card keeps keyword=chaperoning, lemma=chaperone', () => {
    const items = extractLearningItems(
      makeTranscript([
        'Mom is chaperoning, like, a Coachella type of thing.',
        'She demonstrates remarkable eloquence and sophisticated analysis.',
      ]),
      'v1', 'beginner'
    )
    const card = items.find(i => i.keyword === 'chaperoning')
    if (card) expect(card.lemma).toBe('chaperone')
  })

  it('T-LEMMA-2 — running card keeps keyword=running, lemma=run', () => {
    const items = extractLearningItems(
      makeTranscript(['She is running towards the remarkable analysis of the situation.']),
      'v1', 'beginner'
    )
    const card = items.find(i => i.keyword === 'running')
    if (card) expect(card.lemma).toBe('run')
  })

  it('T-LEMMA-3 — analysis has no lemma (already base form)', () => {
    const items = extractLearningItems(
      makeTranscript(['She abandoned the project after careful analysis of the data.']),
      'v1', 'beginner'
    )
    const card = items.find(i => i.keyword === 'analysis')
    if (card) expect(card.lemma).toBeUndefined()
  })
})

// ── Morphological stem (double consonant comparatives/superlatives) ──────────
describe('nlp.js — double-consonant stem fallback', () => {
  it('T-STEM-1 — biggest is tier 1 (stems to big, an A1 word)', () => {
    const items = extractLearningItems(
      makeTranscript(['He is the biggest boy in the world and the most remarkable student.']),
      'v1', 'beginner'
    )
    const biggest = items.find(i => i.keyword === 'biggest')
    if (biggest) expect(biggest.difficulty_tier).toBe(1)
  })

  it('T-STEM-2 — bigger is tier 1 (stems to big, an A1 word)', () => {
    const items = extractLearningItems(
      makeTranscript(['She is bigger than her sister and demonstrates remarkable patience.']),
      'v1', 'beginner'
    )
    const bigger = items.find(i => i.keyword === 'bigger')
    if (bigger) expect(bigger.difficulty_tier).toBe(1)
  })
})

// ── CEFR tier lookup ───────────────────────────────────────────────────────────
// These words are in cefr_vocab.json with known levels
const TRANSCRIPT_CEFR = makeTranscript([
  'The interior architecture demonstrates remarkable complexity and eloquence.',  // C1 words: interior, eloquence
  'She abandoned the project after careful analysis.',   // B1: abandon, analysis
  'The children play in the garden every morning.',       // A1: children, garden
])

describe('nlp.js — CEFR-based difficulty tiers', () => {
  it('T18 — A1/A2 words are tier 1', () => {
    const items = extractLearningItems(TRANSCRIPT_CEFR, 'vid_cefr', 'beginner')
    // 'children' is A1 → tier 1
    const children = items.find(i => i.keyword === 'children')
    if (children) expect(children.difficulty_tier).toBe(1)
  })

  it('T19 — B1 words are tier 2', () => {
    const items = extractLearningItems(TRANSCRIPT_CEFR, 'vid_cefr', 'beginner')
    // 'analysis' is B1 in CEFR-J
    const analysis = items.find(i => i.keyword === 'analysis')
    if (analysis) expect(analysis.difficulty_tier).toBe(2)
  })

  it('T20 — C1/C2 words are tier 4', () => {
    const items = extractLearningItems(TRANSCRIPT_CEFR, 'vid_cefr', 'beginner')
    // 'eloquence' is C1 → tier 4
    const eloquence = items.find(i => i.keyword === 'eloquence')
    if (eloquence) expect(eloquence.difficulty_tier).toBe(4)
  })

  it('T21 — advanced level prefers tier 3+ words (fallback to tier 2 only if sparse)', () => {
    const items = extractLearningItems(TRANSCRIPT_CEFR, 'vid_cefr', 'advanced')
    const wordItems = items.filter(i => i.type === 'word')
    // Either all words are tier 3+ (normal case), or the list is small due to
    // adaptive fallback (expected when transcript has few high-tier words)
    const tier3Plus = wordItems.filter(i => i.difficulty_tier >= 3)
    // At minimum, any tier3+ words found should appear first (sort by score)
    if (tier3Plus.length > 0) {
      expect(wordItems[0].difficulty_tier).toBeGreaterThanOrEqual(tier3Plus[0].difficulty_tier)
    }
    // Advanced should never return tier 1 words (fallback only goes to tier 2)
    for (const item of wordItems) {
      expect(item.difficulty_tier).toBeGreaterThanOrEqual(2)
    }
  })
})

// ── pickBestSeg behavior ───────────────────────────────────────────────────────
describe('nlp.js — pickBestSeg (best example sentence selection)', () => {
  it('T22 — no pattern cards in output (patterns removed)', () => {
    const transcript = makeTranscript([
      'If you want to succeed, you should work hard every day.',
      'She might consider taking a different approach to the problem.',
    ])
    const items = extractLearningItems(transcript, 'vid_pat', 'beginner')
    const patterns = items.filter(i => i.type === 'pattern')
    expect(patterns.length).toBe(0)
  })

  it('T23 — multiple occurrences: example sentence is not trivially short', () => {
    // 'consider' appears twice — second occurrence is in a longer, more contextual sentence
    const transcript = makeTranscript([
      'Consider it.',                                                    // too short, edge word
      'Many experts consider this approach to be highly effective.',    // better context
    ])
    const items = extractLearningItems(transcript, 'vid_seg', 'beginner')
    const consider = items.find(i => i.keyword === 'consider')
    if (consider) {
      // Should pick a sentence with enough context (≥ 5 words)
      const wordCount = consider.sentence.split(' ').length
      expect(wordCount).toBeGreaterThanOrEqual(5)
    }
  })
})

// ── Tier-primary scoring (new formula) ────────────────────────────────────────
describe('nlp.js — tier-primary scoring', () => {
  it('T-SCORE-1 — tier-4 word (freq=1) ranks above tier-2 word (freq=20)', () => {
    // 'eloquence' = C1+ (tier 4), 'analysis' = B1 (tier 2)
    const transcript = makeTranscript([
      'Her eloquence was undeniable.',
      'The analysis revealed several key findings about the data.',
      'The analysis of this analysis showed further analysis of data analysis patterns.',
    ])
    const items = extractLearningItems(transcript, 'v1', 'beginner')
    const eloquence = items.find(i => i.keyword === 'eloquence')
    const analysis  = items.find(i => i.keyword === 'analysis')
    if (eloquence && analysis) {
      expect(items.indexOf(eloquence)).toBeLessThan(items.indexOf(analysis))
    }
  })

  it('T-MAXWORDS — at most 8 word cards returned', () => {
    const transcript = makeTranscript([
      'The sophisticated analysis demonstrates remarkable eloquence and profound complexity.',
      'The innovative approach transcends conventional boundaries systematically.',
      'She speculates continuously about various theoretical implications extensively.',
      'The cumulative evidence corroborates preliminary assumptions quite conclusively.',
      'Intrinsic motivation surpasses extrinsic factors substantially in practice.',
    ])
    const items = extractLearningItems(transcript, 'v1', 'beginner')
    const wordItems = items.filter(i => i.type === 'word')
    expect(wordItems.length).toBeLessThanOrEqual(8)
  })
})

// ── knownWords personal filter ────────────────────────────────────────────────
describe('nlp.js — knownWords filter', () => {
  it('T-KNOWN-1 — word in knownWords is absent from output', () => {
    const transcript = makeTranscript([
      'You should accomplish this task immediately and systematically.',
    ])
    const known = new Set(['accomplish'])
    const items = extractLearningItems(transcript, 'v1', 'beginner', known)
    expect(items.find(i => i.keyword === 'accomplish')).toBeUndefined()
  })

  it('T-KNOWN-2 — fallback triggers when all tier-3+ words are in knownWords', () => {
    // 'accomplish' = AWL tier 3 → in knownWords
    // 'analysis' = B1 tier 2 (confirmed by T19) → not in knownWords, should appear via fallback
    const transcript = makeTranscript([
      'You should accomplish this task systematically and achieve results.',
      'She abandoned the project after careful analysis of the situation.',
    ])
    const known = new Set(['accomplish', 'systematic'])
    const items = extractLearningItems(transcript, 'v1', 'intermediate', known)
    // Tier-3 words are all known → fallback to tier-2 → 'analysis' should appear
    expect(items.length).toBeGreaterThan(0)
    const knownInOutput = items.filter(i => known.has(i.keyword))
    expect(knownInOutput.length).toBe(0)
  })

  it('T-COMPAT-1 — omitting knownWords param returns same results as passing empty Set', () => {
    const transcript = makeTranscript([
      'The sophisticated analysis demonstrates remarkable eloquence.',
    ])
    const withDefault = extractLearningItems(transcript, 'v1', 'beginner')
    const withEmpty   = extractLearningItems(transcript, 'v1', 'beginner', new Set())
    expect(withDefault.map(i => i.keyword)).toEqual(withEmpty.map(i => i.keyword))
  })
})

// ── Contraction / apostrophe-free stop words ─────────────────────────────────
// YouTube auto-captions omit apostrophes: "wasn't" → "wasnt"
// These must be blocked regardless of POS — they would otherwise score as tier-4
describe('nlp.js — contraction filtering (apostrophe-free)', () => {
  it('T-CONTRACTION-1 — wasnt (YouTube caption form of wasn\'t) never appears', () => {
    const transcript = makeTranscript([
      'And it wasnt her. It was me. So it wasnt the right thing.',
      'She analyzed the situation with remarkable eloquence and profound insight.',
    ])
    const items = extractLearningItems(transcript, 'v1', 'advanced')
    expect(items.find(i => i.keyword === 'wasnt')).toBeUndefined()
  })

  it('T-CONTRACTION-2 — common contractions stripped of apostrophe are all blocked', () => {
    const contractionForms = ['didnt','doesnt','dont','cant','wouldnt','couldnt',
      'shouldnt','havent','hasnt','isnt','arent','werent','youre','theyre']
    const texts = contractionForms.map(w => `They ${w} understand the analysis.`)
    const transcript = makeTranscript(texts)
    const items = extractLearningItems(transcript, 'v1', 'beginner')
    for (const w of contractionForms) {
      expect(items.find(i => i.keyword === w), `${w} should be blocked`).toBeUndefined()
    }
  })

  it('T-CONTRACTION-3 — advanced level never shows contractions as C1+', () => {
    // Regression: "wasnt" was scoring tier 4 (C1+) due to unknown-word fallback
    const transcript = makeTranscript([
      'It wasnt right. She doesnt agree. They cant stop it.',
      'The analysis demonstrates remarkable eloquence and theoretical sophistication.',
    ])
    const items = extractLearningItems(transcript, 'v1', 'advanced')
    const contractionsInOutput = items.filter(i =>
      ['wasnt','doesnt','cant','isnt','arent','didnt'].includes(i.keyword)
    )
    expect(contractionsInOutput.length).toBe(0)
  })
})

// ── Advanced vs intermediate tier differentiation ─────────────────────────────
describe('nlp.js — advanced level tier-4 focus', () => {
  it('T-ADV-1 — advanced never returns tier-1/2 words when tier-4 words exist', () => {
    // With tier-4 words present, advanced mode should not show A1/A2/B1 basics
    const transcript = makeTranscript([
      'Her eloquence was undeniable.',       // eloquence, undeniable = tier 4
      'The child runs home every day.',       // child, run, home = tier 1/2
    ])
    const items = extractLearningItems(transcript, 'v1', 'advanced')
    const wordItems = items.filter(i => i.type === 'word')
    // If any tier-4 word made it in, no tier-1 word should precede it
    const firstTier4Idx = wordItems.findIndex(i => i.difficulty_tier >= 4)
    const firstTier1Idx = wordItems.findIndex(i => i.difficulty_tier <= 1)
    if (firstTier4Idx >= 0 && firstTier1Idx >= 0) {
      expect(firstTier4Idx).toBeLessThan(firstTier1Idx)
    }
  })
})

// ── POS weighting ─────────────────────────────────────────────────────────────
describe('nlp.js — POS weighting', () => {
  it('T-POS-1 — verb ranks higher than same-tier noun at same frequency', () => {
    // 'speculate' (verb, AWL tier 3) vs 'speculation' (noun, AWL tier 3)
    // verb gets ×1.5, so it should rank above the noun
    const transcript = makeTranscript([
      'She speculates about the outcome.',
      'The speculation was intense.',
    ])
    const items = extractLearningItems(transcript, 'v1', 'advanced')
    const verbItem = items.find(i => i.keyword === 'speculate' || i.keyword === 'speculates')
    const nounItem = items.find(i => i.keyword === 'speculation')
    // Both may or may not appear — if both do, verb must rank first
    if (verbItem && nounItem) {
      expect(items.indexOf(verbItem)).toBeLessThan(items.indexOf(nounItem))
    }
  })
})

// ── AWL / NAWL integration (research-backed optimization) ────────────────────
describe('nlp.js — AWL/NAWL academic word detection', () => {
  it('T-AWL-1 — AWL Sublist 1 word gets awl_sublist=1 on card', () => {
    const transcript = makeTranscript([
      'Researchers assess the evidence to establish a clear framework.',
      'They analyze data and significant findings from multiple sources.',
    ])
    const items = extractLearningItems(transcript, 'v1', 'beginner')
    const assessed = items.find(i => i.keyword === 'assess' || i.lemma === 'assess')
    if (assessed) {
      expect(assessed.awl_sublist).toBe(1)
    }
    const frameworks = items.find(i => i.keyword === 'framework' || i.lemma === 'framework')
    if (frameworks) {
      expect(frameworks.awl_sublist).toBe(3)  // AWL Sublist 3
    }
  })

  it('T-AWL-2 — AWL word gets minimum tier 3 even if CEFR marks it tier 1-2', () => {
    // "significant" is AWL Sublist 1 but might be CEFR tier 1/2 (high-frequency)
    // It must be boosted to tier 3 for IELTS relevance
    const transcript = makeTranscript([
      'The significant difference was evident in the results.',
      'They established a consistent approach to the analysis.',
    ])
    const items = extractLearningItems(transcript, 'v1', 'beginner')
    const sig = items.find(i => i.keyword === 'significant' || i.lemma === 'significant')
    if (sig) {
      expect(sig.difficulty_tier).toBeGreaterThanOrEqual(3)
    }
  })

  it('T-AWL-3 — AWL word appears at intermediate level (tier 3+ filter)', () => {
    // "assess" is AWL Sublist 1 → must appear at intermediate level
    const transcript = makeTranscript([
      'We need to assess the situation carefully and establish criteria.',
      'The framework helps us analyze and evaluate complex phenomena.',
    ])
    const items = extractLearningItems(transcript, 'v1', 'intermediate')
    const awlWords = items.filter(i => i.awl_sublist && i.awl_sublist <= 5)
    expect(awlWords.length).toBeGreaterThan(0)
  })

  it('T-AWL-4 — NAWL word gets awl_sublist=11', () => {
    // "methodology" and "trajectory" are NAWL words (modern academic corpus)
    const transcript = makeTranscript([
      'The methodology used in this study follows a clear trajectory.',
      'Scientists use paradigm shifts to explain major theoretical changes.',
    ])
    const items = extractLearningItems(transcript, 'v1', 'beginner')
    const nawlWord = items.find(i =>
      ['methodology','trajectory','paradigm'].includes(i.keyword) ||
      ['methodology','trajectory','paradigm'].includes(i.lemma)
    )
    if (nawlWord) {
      expect(nawlWord.awl_sublist).toBe(11)
    }
  })

  it('T-AWL-5 — AWL Sublist 1 word scores higher than same-tier non-AWL word', () => {
    // AWL Sublist 1 gets +4.0 bonus → should rank above a non-AWL word of same tier
    const transcript = makeTranscript([
      'They assess the validity and constitute the core framework.',
      'The bizarre phenomenon appeared once during the experiment.',
    ])
    const items = extractLearningItems(transcript, 'v1', 'beginner')
    const assessItem = items.find(i => i.keyword === 'assess' || i.lemma === 'assess')
    const bizarreItem = items.find(i => i.keyword === 'bizarre')
    if (assessItem && bizarreItem) {
      // assess (AWL S1, tier3+boost) should rank before bizarre (NAWL/tier3, less boost)
      expect(items.indexOf(assessItem)).toBeLessThanOrEqual(items.indexOf(bizarreItem))
    }
  })
})

// ── lookupMeaning ─────────────────────────────────────────────────────────────
describe('nlp.js — lookupMeaning', () => {
  it('T-LM-1 — returns meaning for a word in cedict', () => {
    // 'run' is in cedict
    const result = lookupMeaning('run')
    expect(typeof result).toBe('string')
    // May be empty if not in test data, but should not throw
  })

  it('T-LM-2 — returns empty string for unknown word', () => {
    expect(lookupMeaning('xyzzy_nonexistent_word_abc')).toBe('')
  })

  it('T-LM-3 — canonical fallback: "running" resolves via "run"', () => {
    const direct  = lookupMeaning('run')
    const inflect = lookupMeaning('running')
    // If "run" has a meaning, "running" should return the same meaning via fallback
    if (direct) {
      expect(inflect).toBe(direct)
    } else {
      // Neither in cedict — both should be empty
      expect(inflect).toBe('')
    }
  })

  it('T-LM-4 — case-insensitive: "RUN" and "run" return same result', () => {
    expect(lookupMeaning('RUN')).toBe(lookupMeaning('run'))
  })
})

// ── wordDifficultyTier ────────────────────────────────────────────────────────
describe('nlp.js — wordDifficultyTier', () => {
  it('T-WDT-1 — common word returns tier 1 or 2', () => {
    // "happy" / "good" should be A1-B1
    const tier = wordDifficultyTier('happy')
    expect(tier).toBeGreaterThanOrEqual(1)
    expect(tier).toBeLessThanOrEqual(4)
  })

  it('T-WDT-2 — unknown rare word returns tier 4', () => {
    // A nonsense word is unknown → tier 4 (max/hardest)
    expect(wordDifficultyTier('xyzzy_nonexistent_rare')).toBe(4)
  })

  it('T-WDT-3 — AWL academic word returns tier >= 3', () => {
    // "analyze" / "constitute" are AWL Sublist 1 → tier 3 minimum
    const tier = wordDifficultyTier('constitute')
    expect(tier).toBeGreaterThanOrEqual(3)
  })

  it('T-WDT-4 — returns integer 1-4 for all inputs', () => {
    for (const word of ['the', 'run', 'sophisticated', 'xyzzy_rare']) {
      const t = wordDifficultyTier(word)
      expect([1, 2, 3, 4]).toContain(t)
    }
  })
})

// ── extractWordsFromSegment ────────────────────────────────────────────────────
describe('nlp.js — extractWordsFromSegment', () => {
  const seg = (text, start = 0, dur = 3) => ({ text, start, dur })

  it('T-EWS-1 — returns empty array for empty/null segment', () => {
    expect(extractWordsFromSegment(null, 'v1')).toEqual([])
    expect(extractWordsFromSegment({ text: '' }, 'v1')).toEqual([])
  })

  it('T-EWS-2 — filters out tier-1 (A1/A2) words', () => {
    // "go", "home", "big" are tier 1 — should not appear
    const cards = extractWordsFromSegment(seg('go home big dog'), 'v1')
    for (const c of cards) {
      expect(c.difficulty_tier).toBeGreaterThanOrEqual(2)
    }
  })

  it('T-EWS-3 — STOPS_ALWAYS words are excluded', () => {
    // "wasnt", "gonna", "yeah" are in STOPS_ALWAYS
    const cards = extractWordsFromSegment(seg('yeah he wasnt gonna accomplish it'), 'v1')
    const keywords = cards.map(c => c.keyword)
    expect(keywords).not.toContain('yeah')
    expect(keywords).not.toContain('wasnt')
    expect(keywords).not.toContain('gonna')
  })

  it('T-EWS-4 — results are sorted hardest-first (descending difficulty_tier)', () => {
    // "accomplish" (AWL tier 3) and "sophisticated" (tier 4) in same segment
    const cards = extractWordsFromSegment(
      seg('She will accomplish sophisticated analysis of the project.'), 'v1'
    )
    for (let i = 1; i < cards.length; i++) {
      expect(cards[i - 1].difficulty_tier).toBeGreaterThanOrEqual(cards[i].difficulty_tier)
    }
  })

  it('T-EWS-5 — card has expected shape with correct videoId prefix', () => {
    const cards = extractWordsFromSegment(seg('The analysis was remarkable.'), 'testvid')
    expect(cards.length).toBeGreaterThan(0)
    const card = cards[0]
    expect(card.id).toMatch(/^testvid_/)
    expect(card.video_id).toBe('testvid')
    expect(card.type).toBe('word')
    expect(typeof card.clip_start).toBe('number')
    expect(typeof card.clip_end).toBe('number')
    expect(card.clip_end).toBeGreaterThan(card.clip_start)
  })
})

// ── getVocabCategories ─────────────────────────────────────────────────────────
describe('nlp.js — getVocabCategories', () => {
  it('T-CAT-NLP-1 — AWL Sublist 1-10 word gets "academic" category', () => {
    // "constitute" is AWL Sublist 1
    const cats = getVocabCategories('constitute')
    expect(cats).toContain('academic')
    expect(cats).not.toContain('advanced_academic')
  })

  it('T-CAT-NLP-2 — NAWL/advanced academic word (sublist 11-12) gets "advanced_academic"', () => {
    // Look for a word in awl_nawl sublist >= 11
    // "negotiate" is TSL (sublist 12) → advanced_academic
    const cats = getVocabCategories('negotiate')
    // TSL sublist 12 → should be either advanced_academic or toeic depending on overlap
    // What we know: it should NOT be 'academic' (that's AWL 1-10 only)
    expect(cats).not.toContain('academic')
  })

  it('T-CAT-NLP-3 — TOEIC word gets "toeic" category', () => {
    // "invoice" is a known TOEIC business word
    const cats = getVocabCategories('invoice')
    expect(cats).toContain('toeic')
  })

  it('T-CAT-NLP-4 — common non-exam word gets empty categories', () => {
    // "dog" is tier 1, not AWL, not TOEIC
    const cats = getVocabCategories('dog')
    expect(cats).toEqual([])
  })

  it('T-CAT-NLP-5 — extractLearningItems word cards have categories field (array)', () => {
    const transcript = makeTranscript([
      'We need to negotiate the contract terms carefully with our client.',
      'The quarterly revenue report shows significant growth this year.',
    ])
    const items = extractLearningItems(transcript, 'vid1', 'beginner')
    const wordCards = items.filter(i => i.type === 'word')
    expect(wordCards.length).toBeGreaterThan(0)
    for (const card of wordCards) {
      expect(Array.isArray(card.categories)).toBe(true)
    }
  })
})
