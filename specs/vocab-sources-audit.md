# Vocabulary Sources Audit

**Date:** 2026-04-05  
**Scope:** `src/data/` 詞庫擴充、來源治理、重疊分析與架構建議

---

## 1. 現有資料盤點

### 1.1 各檔案結構與統計

| 檔案 | 格式 | 詞數 | 欄位 | 說明 |
|------|------|------|------|------|
| `ngsl_defs.json` | `{word: definition}` | 4,054 | 詞 + 英文定義 | NGSL 核心詞彙附定義 |
| `cefr_vocab.json` | `{word: tier}` | 8,818 | 詞 + tier(1-4) | tier 1=A1, 2=A2, 3=B1, 4=B2；無 C1 |
| `coca5000.json` | `[word]` | 713 | 詞陣列（無額外資訊） | COCA 高頻詞，實際僅 713 詞（非 5000） |
| `awl_nawl.json` | `{word: sublist}` | 2,336 | 詞 + sublist(1-12) | AWL 1-10 + NAWL-like 11-12 |
| `toeic_vocab.json` | `{word: 1}` | 378 | 詞（值固定為 1）| 僅有詞，無頻率/定義 |
| `opal_phrases.json` | `[phrase]` | 572 | 片語陣列 | Oxford Phrasal Academic Lexicon |

### 1.2 CEFR 層級分布

| 資料集 | A1 | A2 | B1 | B2 | C1 |
|--------|----|----|----|----|-----|
| `cefr_vocab.json` | 2,342 | 2,167 | 2,485 | 1,824 | — |
| AWL sublists 1-10 | — | — | — | — | ~431 |
| AWL sublists 11-12 | — | — | — | — | ~1,905 |

### 1.3 各 Tab 詞彙重疊分析

| 對比組合 | 重疊數 | 重疊率（以較小集合為基準） |
|---------|--------|---------------------------|
| COCA ∩ CEFR | 533 | 74.8% of COCA |
| COCA ∩ NGSL | 482 | 67.6% of COCA |
| NGSL ∩ CEFR | 3,631 | 89.6% of NGSL |
| AWL ∩ CEFR | 1,592 | 68.2% of AWL |
| AWL ∩ NGSL | 1,577 | 67.5% of AWL |
| TOEIC(old) ∩ NGSL | 284 | 75.1% of TOEIC |
| TOEIC(old) ∩ CEFR | 276 | 73.0% of TOEIC |

**關鍵觀察：**
- COCA 資料只有 713 詞而非完整 5000，是殘缺資料集
- `toeic_vocab.json` 只有 378 詞，遠少於完整 TOEIC 詞彙
- 所有現有資料缺乏詞性（POS）欄位（除 `cefr_vocab.json` 無，awl/ngsl 亦無）
- 無發音資料
- 現有資料合集唯一詞數：**9,737 詞**

---

## 2. 已成功取得的新來源

### 2.1 Oxford 5000 with CEFR levels
- **來源：** Oxford Learner's Dictionaries 官方 PDF  
  `https://www.oxfordlearnersdictionaries.com/external/pdf/wordlists/oxford-3000-5000/The_Oxford_3000_by_CEFR_level.pdf`  
  `https://www.oxfordlearnersdictionaries.com/external/pdf/wordlists/oxford-3000-5000/The_Oxford_5000_by_CEFR_level.pdf`
- **授權：** © Oxford University Press（教育用途可引用，商業使用需確認）
- **詞數：** 4,864 詞（Oxford 3000 A1-B2 合併 Oxford 5000 B2-C1）
- **欄位：** `{word: {level: "A1"|"A2"|"B1"|"B2"|"C1", pos: "n"|"v"|"adj"|"adv"|...}}`
- **CEFR 分布：** A1:694, A2:734, B1:749, B2:1400, C1:1287
- **與現有資料 delta：** 新增 **447 詞**（未出現在現有 CEFR + NGSL 的詞，多為 C1 層級）
- **已轉換檔案：** `src/data/oxford5000.json` (259 KB)
- **特別價值：** 唯一包含 **C1 詞彙 + 詞性**的官方標注資料集；Oxford 是 EFL 界最權威的 CEFR 來源

### 2.2 SUBTLEX-US Frequency List（前 10,000 詞）
- **來源：** Maximax67/Words-CEFR-Dataset GitHub  
  `https://raw.githubusercontent.com/Maximax67/Words-CEFR-Dataset/main/datasets/valid_words_sorted_by_frequency.csv`
- **授權：** 原始 SUBTLEX-US 資料由 Brysbaert & New (2009) 釋出為學術免費使用；GitHub 版本為二手整理
- **詞數：** 10,000 詞（純字母，從 172,783 詞中取前 1 萬）
- **欄位：** `{word: {rank: number, freq: number}}`（頻率為原始語料庫計次，規模龐大如 `the`=93 billion）
- **與現有資料 delta：** 新增 **4,919 詞**（現有資料未涵蓋的常見詞）
- **已轉換檔案：** `src/data/subtlex_us.json` (578 KB)
- **特別價值：** 唯一提供字幕/口語頻率排名的資料集，可用於「依使用頻率排序詞彙」功能

### 2.3 NGSL-Spoken 1.2
- **來源：** New General Service List Project  
  `https://www.newgeneralservicelist.com/s/NGSL-Spoken_12_stats.csv`
- **授權：** Creative Commons（CC BY 4.0）Browne & Culligan (2013)
- **詞數：** 721 lemmas
- **欄位：** `{word: rank}`（rank 1 = 最高頻）
- **與現有資料 delta：** 與現有資料集 100% 重疊（零新詞）
- **已轉換檔案：** `src/data/ngsl_spoken.json` (11 KB)
- **特別價值：** 提供口語 rank 排序，可強化口語詞彙 Tab 的排序邏輯；721 詞涵蓋 90% 口語英語

### 2.4 Business Service List (BSL) 1.2
- **來源：** New General Service List Project  
  `https://www.newgeneralservicelist.com/s/BSL_120_stats.csv`
- **授權：** Creative Commons（CC BY 4.0）Browne, Culligan & Phillips
- **詞數：** 1,744 詞，分 3 bands
- **欄位：** `{word: {rank: number, band: 1|2|3}}`
- **與現有資料 delta：** 新增 **381 詞**（現有資料未涵蓋的商業詞彙）
- **已轉換檔案：** `src/data/bsl.json` (89 KB)
- **特別價值：** 唯一專門商業/職場英語詞彙集，適合「商務英語」Tab

### 2.5 TOEIC Service List (TSL) 1.2
- **來源：** New General Service List Project  
  `https://www.newgeneralservicelist.com/s/TSL_12_stats.csv`
- **授權：** Creative Commons（CC BY 4.0）
- **詞數：** 1,250 詞
- **欄位：** `{word: rank}`
- **與現有資料 delta：** 新增 **6 詞**（與現有資料高度重疊）
- **已轉換檔案：** `src/data/tsl.json` (23 KB)
- **特別價值：** TSL 由語料庫分析而來，比現有 `toeic_vocab.json`（378 詞）完整 3 倍，可取代舊資料

### 2.6 Longman Communication 3000
- **來源：** jnoodle/English-Vocabulary-Word-List GitHub  
  `https://raw.githubusercontent.com/jnoodle/English-Vocabulary-Word-List/master/Longman%20Communication%203000.txt`
- **授權：** Longman/Pearson 版權（GitHub 版本為二手整理，授權不明確）
- **詞數：** 3,158 詞
- **欄位：** `{word: 1}`（純詞表，無額外資訊）
- **與現有資料 delta：** 新增 **57 詞**
- **已轉換檔案：** `src/data/longman3000.json` (47 KB)
- **注意：** 授權有疑慮，建議僅用於驗證/交叉比對，不直接展示

### 2.7 Maximax67 CEFR Dataset（Oxford-based）
- **來源：** Maximax67/Words-CEFR-Dataset GitHub  
  `https://raw.githubusercontent.com/Maximax67/Words-CEFR-Dataset/main/datasets/word_list_cefr.csv`
- **授權：** 二手整理，原始資料來自 Oxford；授權不確定
- **詞數：** 7,035 詞（A1:1009, A2:1249, B1:2201, B2:2576）—無 C1
- **欄位：** `{word: {level: string, pos: string}}`
- **與現有資料 delta：** 233 個未出現在 `cefr_vocab.json` 的詞（含多字組如 `carbon footprint`）
- **與現有 CEFR 比較：** 6,802 詞重疊，其中 **85.7% 層級不一致**（非錯誤，是不同標注標準）
- **已轉換檔案：** `src/data/maximax_cefr.json` (402 KB)
- **建議：** 僅用作參照，不作主要 CEFR 來源；Oxford 5000 官方 PDF 更可靠

### 2.8 CMU Pronouncing Dictionary（已過濾）
- **來源：** Carnegie Mellon University  
  `https://raw.githubusercontent.com/cmusphinx/cmudict/master/cmudict.dict`
- **授權：** BSD 2-Clause（完全開源）
- **詞數：** 全集 117,493 詞；**過濾後 14,124 詞**（限本專案詞彙宇宙內的詞）
- **欄位：** `{word: "ARPAbet phonemes string"}`（如 `"absorb": "AH0 B S AO1 R B"`）
- **已轉換檔案：** `src/data/cmudict.json` (474 KB，過濾前為 3.6 MB)
- **特別價值：** 唯一發音資料集；ARPAbet 可轉換為近似 IPA，用於發音顯示功能

---

## 3. 建議但未取得的來源

### 3.1 WordNet（Princeton）
- **狀況：** 未下載
- **原因：** 資料結構複雜（synsets、關係圖、offset）；整合需要大量前處理；檔案較大
- **如何取得：** `pip install nltk` 後 `nltk.download('wordnet')`，或從 https://wordnet.princeton.edu/download/current-version 取得 3.1 版
- **價值：** 提供同義詞、反義詞、定義、例句（是非常高價值的來源）

### 3.2 NGSL 完整版（核心 2,809 詞 with sublist）
- **狀況：** 未找到帶 sublist 的 CSV 版本
- **原因：** `newgeneralservicelist.org` 域名已被賭場網站接管；舊版下載連結失效
- **如何取得：** 從 `newgeneralservicelist.com`（.com 而非 .org）找 NGSL 1.2 stats CSV；現有 `ngsl_defs.json` 已覆蓋主要詞彙

### 3.3 AVL（Academic Vocabulary List）
- **狀況：** 未找到可直接下載的機器可讀版
- **原因：** Victoria University（Paul Nation）網站 URL 已更新，且 AVL 主要以 PDF 形式發布
- **如何取得：** 聯繫 Paul Nation 或從 https://www.victoria.ac.nz/lals/about/staff/publications/paul-nation 取得
- **替代：** 現有 `awl_nawl.json` 涵蓋 AWL（學術詞彙），功能相近

### 3.4 SUBTLEX-US 完整版（原始學術版）
- **狀況：** 已透過 Maximax67 取得前 10,000 詞
- **如何取得完整版：** http://www.lexique.org/databases/SUBTLEX-US/ 或 Brysbaert 個人頁面
- **注意：** 原始版有 74,286 個詞形，提供 SUBTLWF（每百萬字頻率）等更細緻欄位

### 3.5 NGSL-Spoken 定義版
- **狀況：** 未下載（`NGSL-Spoken_12_with_en_definitions.csv` 格式可能是 .xlsx）
- **如何取得：** `https://www.newgeneralservicelist.com/s/NGSL-Spoken_12_with_en_definitions.csv`

### 3.6 BSL/TSL 定義版
- **狀況：** TSL 定義版為 XLSX 格式，需要額外 pandas/openpyxl 處理
- **如何取得：** `https://www.newgeneralservicelist.com/s/TSL_12_definitions.xlsx`

### 3.7 Tatoeba 英文例句
- **狀況：** 未下載
- **原因：** CSV 檔案約 500MB+ 壓縮後，前處理成本高
- **如何取得：** https://tatoeba.org/en/downloads → sentences.csv
- **價值：** 可以為詞彙提供真實例句，是高價值但需要大量處理

---

## 4. 建議的新 Tab / 資料層架構

### 4.1 建議新增 Tabs

| Tab 名稱 | 資料來源 | 說明 |
|---------|---------|------|
| **Oxford 5000 C1** | `oxford5000.json` (C1 entries) | 填補現有 CEFR 完全缺乏 C1 層級的空缺 |
| **商務英語 BSL** | `bsl.json` | 職場商務詞彙，Band 1-3 分級 |
| **TOEIC 完整版** | `tsl.json` | 取代現有只有 378 詞的 `toeic_vocab.json`，升級至 1,250 詞 |

### 4.2 建議修改現有 Tabs

| 現有 Tab | 問題 | 建議 |
|---------|------|------|
| COCA 高頻（713詞）| 資料殘缺，並非完整 5000 詞 | 替換為 `subtlex_us.json` 前 1000 詞，提供真實字幕頻率 |
| CEFR C1 | 實際用的是 AWL sublists 11-12（NAWL），與 C1 概念不精確 | 改用 `oxford5000.json` 中的 C1 entries（1,287 詞） |
| 多益 TOEIC | 只有 378 詞，覆蓋不足 | 替換為 TSL 1,250 詞 |

### 4.3 建議的資料模型擴充

目前所有資料集都是扁平結構（詞 → 簡單值）。建議統一格式：

```json
{
  "word": {
    "cefr": "B2",
    "pos": "v",
    "freq_rank": 1234,
    "pronunciation": "AH0 B S AO1 R B",
    "ngsl_def": "to take in a substance or energy",
    "in_oxford5k": true,
    "in_ngsl": true,
    "in_awl": false,
    "in_tsl": false,
    "in_bsl": false
  }
}
```

**實作方式：** 在前端 `src/lib/vocab.js` 加一個 merge 函數，在 App 啟動時懶加載需要的資料集。不建議預先合併成一個超大 JSON（會影響首屏加載）。

### 4.4 發音功能路徑

`cmudict.json` (474 KB, 14,124 詞) 提供 ARPAbet 發音。ARPAbet → IPA 轉換表為已知規則（可用約 50 行 JS 完成）。建議：

1. 主詞彙顯示時按需加載 CMU 發音（懶加載）
2. 僅在使用者點擊「發音」時讀取
3. 或進一步過濾只保留 Oxford 5000 + NGSL 範圍（~5,000 詞，約 160 KB）

---

## 5. 授權風險清單

| 資料集 | 授權狀態 | 風險等級 | 建議 |
|--------|---------|---------|------|
| `oxford5000.json` | © Oxford University Press | **中高** | 官方 PDF 公開下載，解析後的資料用於教育 App 屬灰色地帶；建議標注來源並聯繫 OUP 確認 EFL App 使用條款 |
| `ngsl_spoken.json` | CC BY 4.0 | **低** | 可自由使用，需標注 Browne & Culligan (2013) |
| `bsl.json` | CC BY 4.0 | **低** | 可自由使用，需標注作者 |
| `tsl.json` | CC BY 4.0 | **低** | 可自由使用，需標注作者 |
| `subtlex_us.json` | 學術免費使用 | **低-中** | 原始 SUBTLEX-US 為學術授權；Maximax67 整理版未明確商業授權；建議直接引用原始學術來源 |
| `longman3000.json` | Longman/Pearson 版權 | **高** | 僅用於內部比對，**不可直接展示給用戶**；建議從資料夾移除或加入 .gitignore |
| `maximax_cefr.json` | 不明確（Oxford 衍生） | **中高** | 二手整理版；建議以 `oxford5000.json` 取代，棄用此檔 |
| `cmudict.json` | BSD 2-Clause | **低** | CMU 明確開源授權，可商業使用，只需保留版權聲明 |
| `cefr_vocab.json`（現有） | 來源不明 | **中** | 需確認原始來源與授權 |
| `ngsl_defs.json`（現有） | 來源不明 | **中** | NGSL 本身為 CC BY，但定義的來源需確認 |

### 立即行動建議

1. **移除或隔離** `longman3000.json`（Pearson 版權）
2. **標記為不展示** `maximax_cefr.json`（授權不明，且被 Oxford 5000 取代）
3. **確認** `cefr_vocab.json` 和 `ngsl_defs.json` 的原始來源
4. 在 App 頁腳/關於頁面加入資料來源與授權聲明

---

## 6. 新資料檔案一覽

| 檔案 | 大小 | 狀態 | 建議使用 |
|------|------|------|---------|
| `src/data/oxford5000.json` | 259 KB | 新增，**優先使用** | CEFR 分級（含 C1）+ POS |
| `src/data/subtlex_us.json` | 578 KB | 新增 | 頻率排名詞表 |
| `src/data/ngsl_spoken.json` | 11 KB | 新增 | 口語詞彙 rank |
| `src/data/bsl.json` | 89 KB | 新增 | 商務英語 Tab |
| `src/data/tsl.json` | 23 KB | 新增 | 取代舊 toeic_vocab.json |
| `src/data/longman3000.json` | 47 KB | 新增，**授權風險高** | 僅比對用，不展示 |
| `src/data/maximax_cefr.json` | 402 KB | 新增，**建議棄用** | 被 oxford5000 取代 |
| `src/data/cmudict.json` | 474 KB | 新增 | 發音資料（ARPAbet） |

---

*產生此報告的腳本邏輯保存在本次 session 記錄中。如需重新產生，請參考本 spec。*
