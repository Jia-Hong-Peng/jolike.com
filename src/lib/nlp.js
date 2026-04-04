/**
 * NLP analysis — runs entirely in the browser.
 *
 * Word difficulty is determined by tier classification:
 *   Tier 1 (A1/A2): basic vocabulary any intermediate+ learner knows
 *                   → penalized ×0.08, filtered at intermediate/advanced
 *   Tier 2 (B1):    everyday vocabulary, learnable at intermediate level
 *                   → neutral ×0.7, filtered at advanced
 *   Tier 3 (B2):    Academic/professional vocabulary (AWL + business)
 *                   → boosted ×1.6, shown at all levels
 *   Tier 4 (C1+):   Specialized/rare — unknown to most learners
 *                   → highly boosted ×2.5, always shown
 *
 * Levels:
 *   beginner     — tier 1+ (all content words, min 3 chars)
 *   intermediate — tier 2+ (filter out A1/A2 basics)
 *   advanced     — tier 3+ (academic & specialized only; fallback to tier 2 if sparse)
 */

import nlp from 'compromise'
import awlWords from '@/data/coca5000.json'   // AWL + business vocab = B2 tier
import cedict from '@/data/cedict.json'

// B2 tier: Academic Word List + business vocabulary (713 words)
const awlSet = new Set(awlWords.map(w => w.toLowerCase()))

const MAX_WORDS    = 10
const MAX_PHRASES  = 5
const MAX_PATTERNS = 3
const CLIP_MIN_S   = 3
const MIN_WORDS_BEFORE_FALLBACK = 5  // if fewer words pass tier, drop tier by 1

// ── Always-excluded function words (POS tagging misses) ───────────────────────
const STOPS_ALWAYS = new Set([
  'have','been','were','will','would','could','should','might','must','shall',
  'being','having','said','says','going','gonna','gotta','wanna','kinda',
  'yeah','okay','well','like','just','also','even','still','really','already',
  'actually','very','quite','rather','much','many','most','some','more','less',
  'here','there','then','when','where','how','why','what','which',
])

// ── Tier 1: A1/A2 — heavily penalized, filtered at intermediate/advanced ─────
const TIER1_A1A2 = new Set([
  // core verbs (A1)
  'act','add','allow','appear','ask','become','begin','bring','build','buy',
  'call','carry','catch','change','check','choose','close','come','continue',
  'cost','create','cut','decide','do','drive','eat','enjoy','enter','fall',
  'feel','fight','fill','find','finish','follow','get','give','go','grow',
  'happen','have','hear','help','hold','hope','include','join','keep','know',
  'learn','leave','let','like','listen','live','look','love','make','meet',
  'move','need','offer','open','pass','pay','pick','plan','play','pull','push',
  'put','read','receive','remember','run','save','say','send','show','sit',
  'sleep','speak','spend','stand','start','stay','stop','talk','tell','think',
  'travel','try','turn','understand','use','visit','wait','walk','want','watch',
  'work','write',
  // people / social
  'adult','baby','boy','brother','child','children','daughter','family','father',
  'friend','girl','group','husband','man','mother','parent','people','person',
  'sister','son','teacher','team','wife','woman',
  // everyday places / objects
  'air','animal','area','art','bank','battery','body','book','box','building',
  'bus','camera','car','card','cash','center','city','class','color','computer',
  'country','cup','data','day','door','drink','earth','email','energy','eye',
  'face','fact','fire','floor','flower','food','foot','game','ground','hand',
  'head','heart','heat','home','house','idea','image','internet','job','key',
  'land','language','law','leg','letter','level','light','line','list','map',
  'message','mind','money','month','morning','mountain','music','name','news',
  'night','number','ocean','office','order','page','paper','part','phone',
  'photo','picture','place','plant','power','price','problem','question','result',
  'road','room','rule','school','screen','sea','service','shop','sky','sound',
  'space','star','store','story','street','system','table','thing','time','tool',
  'town','tree','type','video','voice','wall','water','way','week','wind',
  'window','word','world','year',
  // basic adjectives
  'able','afraid','angry','bad','beautiful','big','black','blue','bright','busy',
  'cheap','clean','clear','close','cold','common','complete','cool','correct',
  'dark','dead','deep','different','direct','early','easy','empty','equal',
  'extra','fair','false','famous','far','fast','fine','free','full','global',
  'good','great','green','happy','hard','heavy','high','hot','human','large',
  'last','late','light','little','local','long','loud','low','main','modern',
  'national','natural','near','new','next','nice','normal','old','open','own',
  'personal','poor','possible','public','quiet','ready','real','red','rich',
  'right','round','safe','same','short','sick','simple','slow','small','social',
  'soft','special','strong','sure','tall','thin','tired','true','warm','weak',
  'white','wide','wrong','young',
  // tech at A2 in modern life
  'cable','charge','charging','chip','circuit','cool','cooling','electric',
  'electronic','engine','fuel','heating','launch','machine','motor','network',
  'nuclear','orbit','rocket','satellite','signal','solar','speed','station',
  'temperature','wireless',
  // commonly known proper nouns / countries
  'africa','america','asia','australia','china','europe','india','japan',
  'russia','english','global',
  // common inflected forms frequently encountered
  'built','building','builds','calls','called','changed','changed','changes',
  'coming','costs','created','creating','cutting','decided','dropped','eating',
  'entering','falling','felt','found','getting','given','giving','gone','grew',
  'growing','heard','holding','joined','kept','knew','known','leading','learned',
  'leaving','lived','looked','making','meant','moved','moving','opened','paid',
  'planned','playing','pulled','pulled','pushed','reading','received','running',
  'saying','seen','sent','showing','sitting','sleeping','speaking','spending',
  'started','staying','stopped','taken','talking','taught','thinking','told',
  'trying','turned','understood','used','visited','waited','walking','wanted',
  'watched','working','written','wrote',
])

// ── Tier 2: B1 — neutral scoring, filtered at advanced ───────────────────────
const TIER2_B1 = new Set([
  // B1 verbs
  'achieve','adapt','affect','analyze','announce','apply','assess','assign',
  'assist','attract','calculate','campaign','capture','combine','communicate',
  'compare','compete','conduct','confirm','connect','construct','consume',
  'contribute','convince','coordinate','decrease','define','deliver','demonstrate',
  'design','detect','determine','distribute','eliminate','enable','encourage',
  'engage','establish','evaluate','expand','experience','explore','finance',
  'focus','fund','generate','identify','illustrate','implement','improve',
  'indicate','influence','install','introduce','investigate','limit','locate',
  'maintain','measure','modify','monitor','obtain','operate','organize','perform',
  'predict','prepare','prevent','process','promote','propose','protect','prove',
  'reduce','reflect','relate','release','remove','replace','represent','require',
  'resolve','respond','restrict','review','select','solve','suggest','summarize',
  'transfer','transform',
  // B1 nouns
  'ability','access','achievement','advantage','agreement','analysis','approach',
  'aspect','authority','basis','behavior','benefit','capacity','challenge',
  'choice','circumstance','claim','commitment','community','competition',
  'concept','concern','condition','context','contribution','control','culture',
  'decision','demand','description','development','discovery','distance',
  'document','economy','education','element','environment','equipment','estimate',
  'evaluation','evidence','experiment','explanation','failure','feature','field',
  'foundation','function','growth','health','impact','improvement','industry',
  'information','institution','interest','investment','issue','leadership',
  'management','material','method','model','movement','opportunity','organization',
  'output','period','policy','position','potential','practice','pressure',
  'principle','production','progress','purpose','quality','range','rate',
  'reaction','reason','relationship','research','resource','response',
  'responsibility','risk','role','scale','section','shortage','situation',
  'solution','source','stage','standard','statement','structure','supply',
  'technology','term','theory','topic','trade','transport','treatment','trend',
  'understanding','value','variety',
  // B1 adjectives
  'accurate','active','additional','advanced','appropriate','available','average',
  'careful','central','chemical','commercial','complex','comprehensive',
  'considerable','consistent','continuous','creative','critical','cultural',
  'current','detailed','effective','efficient','essential','existing',
  'experimental','external','financial','formal','independent','industrial',
  'internal','major','mental','minor','necessary','negative','numerous','obvious',
  'official','original','overall','physical','political','positive','previous',
  'primary','professional','reasonable','regular','relevant','scientific',
  'secondary','serious','significant','specific','standard','successful',
  'suitable','technical','traditional','urban','useful','valid','various','visual',
])

// ── Difficulty tier lookup (with morphological stem fallback) ─────────────────
function wordDifficultyTier(word) {
  const w = word.toLowerCase()
  if (TIER1_A1A2.has(w)) return 1
  if (TIER2_B1.has(w)) return 2
  if (awlSet.has(w)) return 3

  // Morphological stem fallback — handles: cooling→cool, cheaper→cheap,
  //   builds→build, started→start, moving→move, quickly→quick
  const stems = new Set()
  if (w.endsWith('ing') && w.length > 5) {
    stems.add(w.slice(0, -3))          // cooling  → cool
    stems.add(w.slice(0, -3) + 'e')   // using    → use
    stems.add(w.slice(0, -4))          // running  → run (double consonant)
  }
  if (w.endsWith('er') && w.length > 4) stems.add(w.slice(0, -2))   // cheaper → cheap
  if (w.endsWith('est') && w.length > 5) stems.add(w.slice(0, -3))  // cheapest→ cheap
  if (w.endsWith('ed') && w.length > 4) {
    stems.add(w.slice(0, -2))          // started → start
    stems.add(w.slice(0, -1))          // moved   → move
    stems.add(w.slice(0, -3))          // stopped → stop (double)
  }
  if (w.endsWith('ly') && w.length > 4) stems.add(w.slice(0, -2))   // quickly → quick
  if (w.endsWith('tion') && w.length > 6) stems.add(w.slice(0, -3)) // nation  → nat (rough, ok)
  if (w.endsWith('ness') && w.length > 6) stems.add(w.slice(0, -4)) // darkness→ dark
  if (w.endsWith('ment') && w.length > 6) stems.add(w.slice(0, -4)) // movement→ move
  if (w.endsWith('s') && w.length > 4 && !w.endsWith('ss')) {
    stems.add(w.slice(0, -1))          // cars → car
    stems.add(w.slice(0, -2))          // houses → hous (rough)
  }

  for (const stem of stems) {
    if (TIER1_A1A2.has(stem)) return 1
    if (TIER2_B1.has(stem)) return 2
    if (awlSet.has(stem)) return 3
  }
  return 4 // C1+ specialized
}

// Score multiplier by tier — tier4 (rare/specialized) gets highest boost
function tierMultiplier(tier) {
  return [0, 0.08, 0.7, 1.6, 2.5][tier] ?? 1.0
}

// Minimum tier required for this level
function minTierForLevel(level) {
  if (level === 'advanced') return 3     // B2+ (AWL + specialized)
  if (level === 'intermediate') return 2  // B1+
  return 1                               // Any tier
}

function minLength(level) {
  if (level === 'advanced') return 5
  if (level === 'intermediate') return 4
  return 3
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function learningScore(word, freq) {
  const tier = wordDifficultyTier(word)
  const boost = tierMultiplier(tier) * (cedict[word] ? 1.2 : 1.0)
  return freq * boost
}

function lookupMeaning(keyword) {
  const key = keyword.toLowerCase()
  const meaning = cedict[key] || cedict[key.replace(/-/g, ' ')] || ''
  return meaning.slice(0, 10) || '—'
}

function getClip(segment) {
  const clip_start = Math.max(0, segment.start - 0.5)
  const segEnd     = segment.start + Math.max(segment.dur, CLIP_MIN_S)
  const clip_end   = segEnd + 1.5
  return { clip_start: +clip_start.toFixed(2), clip_end: +clip_end.toFixed(2) }
}

// ── Main ───────────────────────────────────────────────────────────────────────

/**
 * @param {Array<{text,start,dur}>} transcript
 * @param {string} videoId
 * @param {'beginner'|'intermediate'|'advanced'} level
 */
export function extractLearningItems(transcript, videoId, level = 'intermediate') {
  const minLen  = minLength(level)
  let   minTier = minTierForLevel(level)

  // ── Step 1: Extract and score words ──────────────────────────────────────────
  const wordFreq     = new Map()
  const wordFirstSeg = new Map()

  for (const segment of transcript) {
    if (!segment.text) continue
    const doc = nlp(segment.text)
    const tokens = [
      ...doc.nouns().not('#Pronoun').out('array'),
      ...doc.adjectives().out('array'),
      ...doc.verbs().not('#Auxiliary').out('array'),
    ]
    for (const token of tokens) {
      if (token.trim().includes(' ')) continue  // multi-word → phrase extraction
      const w = token.replace(/[^a-zA-Z]/g, '').toLowerCase()
      if (w.length < minLen) continue
      if (STOPS_ALWAYS.has(w)) continue
      wordFreq.set(w, (wordFreq.get(w) || 0) + 1)
      if (!wordFirstSeg.has(w)) wordFirstSeg.set(w, segment)
    }
  }

  // Tier-filtered ranking
  function rankWords(tierThreshold) {
    return [...wordFreq.entries()]
      .filter(([w]) => wordDifficultyTier(w) >= tierThreshold)
      .sort((a, b) => learningScore(b[0], b[1]) - learningScore(a[0], a[1]))
  }

  // Adaptive tier fallback: if too sparse, lower threshold by 1
  let rankedWords = rankWords(minTier)
  if (rankedWords.length < MIN_WORDS_BEFORE_FALLBACK && minTier > 1) {
    minTier -= 1
    rankedWords = rankWords(minTier)
  }

  const seenKeywords = new Set()
  const words = []
  for (const [word, freq] of rankedWords) {
    if (words.length >= MAX_WORDS) break
    if (seenKeywords.has(word)) continue
    seenKeywords.add(word)
    const seg = wordFirstSeg.get(word)
    words.push({
      type: 'word',
      keyword: word,
      meaning_zh: lookupMeaning(word),
      frequency: freq,
      difficulty_tier: wordDifficultyTier(word),
      sentence: seg.text,
      ...getClip(seg),
    })
  }

  // ── Step 2: Phrases — phrasal verbs + compound nouns ─────────────────────────
  const PARTICLES = 'up|out|off|in|on|down|back|away|over|through|into|around|along|ahead|apart|together|forward'
  const DETERMINERS = /^(the|a|an|this|that|these|those|my|your|his|her|its|our|their|some|any|each|every)\s/i

  const phraseFreq     = new Map()
  const phraseFirstSeg = new Map()

  function addPhrase(phrase, segment) {
    const key = phrase.toLowerCase().trim()
    if (!key || key.split(' ').length < 2) return
    phraseFreq.set(key, (phraseFreq.get(key) || 0) + 1)
    if (!phraseFirstSeg.has(key)) phraseFirstSeg.set(key, segment)
  }

  for (const segment of transcript) {
    if (!segment.text) continue

    // Phrasal verbs via regex
    const phrasalMatches = segment.text.matchAll(
      new RegExp(`\\b([a-zA-Z]{3,})\\s+(${PARTICLES})\\b`, 'gi')
    )
    for (const m of phrasalMatches) addPhrase(m[0], segment)

    // Compound nouns — no determiners
    const nounPhrases = nlp(segment.text).nouns().out('array')
    for (const np of nounPhrases) {
      const clean = np.replace(/[^a-zA-Z ]/g, '').trim()
      if (DETERMINERS.test(clean)) continue
      if (clean.split(' ').length < 2) continue
      addPhrase(clean, segment)
    }
  }

  const rankedPhrases = [...phraseFreq.entries()]
    .sort((a, b) => learningScore(b[0], b[1]) - learningScore(a[0], a[1]))

  const phrases = []
  for (const [phrase, freq] of rankedPhrases) {
    if (phrases.length >= MAX_PHRASES) break
    if (seenKeywords.has(phrase)) continue
    seenKeywords.add(phrase)
    const seg = phraseFirstSeg.get(phrase)
    phrases.push({
      type: 'phrase',
      keyword: phrase,
      meaning_zh: lookupMeaning(phrase),
      frequency: freq,
      difficulty_tier: 2,  // phrases are inherently B1+ by nature
      sentence: seg.text,
      ...getClip(seg),
    })
  }

  // ── Step 3: Sentence patterns ─────────────────────────────────────────────────
  const patterns     = []
  const seenPatterns = new Set()

  for (const segment of transcript) {
    if (!segment.text || patterns.length >= MAX_PATTERNS) continue
    for (const sentence of nlp(segment.text).sentences().out('array')) {
      if (patterns.length >= MAX_PATTERNS) break
      const s = sentence.trim()
      const wc = s.split(' ').length
      if (wc < 4 || wc > 14 || seenPatterns.has(s)) continue
      const hasModal       = /\b(should|would|could|might|must|need to|have to|going to|want to)\b/i.test(s)
      const hasConditional = /\b(if|unless|when|whenever|while)\b/i.test(s)
      if (!hasModal && !hasConditional) continue
      seenPatterns.add(s)
      patterns.push({
        type: 'pattern',
        keyword: s,
        meaning_zh: hasModal ? '情態句型' : '條件句型',
        frequency: 1,
        difficulty_tier: 3,
        sentence: segment.text,
        ...getClip(segment),
      })
    }
  }

  // ── Step 4: Merge, sort, assign IDs ──────────────────────────────────────────
  return [...words, ...phrases, ...patterns]
    .sort((a, b) => learningScore(b.keyword, b.frequency) - learningScore(a.keyword, a.frequency))
    .map((item, index) => ({
      id: `${videoId}_${level}_${index}`,
      video_id: videoId,
      sort_order: index,
      level,
      ...item,
    }))
}
