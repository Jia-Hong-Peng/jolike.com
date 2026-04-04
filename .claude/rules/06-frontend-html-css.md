# Rule 06 — Frontend HTML/CSS

`trigger: 任何前端 HTML / CSS / Vue SFC template 實作`

---

## 核心約束回顧

- **Tailwind CSS v3** 是本專案唯一 CSS 系統（`@tailwind base/components/utilities`）
- **Vue 3 SFC** `<template>` 搭配 Tailwind utility class
- 不使用自訂 CSS 框架、BEM、CSS-in-JS、或 component library（shadcn / Vuetify 等）
- 若 Tailwind utility 無法滿足，才在 `<style scoped>` 補充最小 CSS，並需在 code review 說明原因

---

## 1. Mobile-First 原則（必守）

設計從 375px 開始，向上增強。

```html
<!-- 正確：先 mobile，再加 responsive prefix -->
<div class="flex flex-col md:flex-row gap-4">

<!-- 錯誤：先桌面版，再用 override 修 mobile -->
<div class="flex flex-row flex-col">  <!-- Bad: later class overrides -->
```

本專案 Tailwind v3 Breakpoints：

| Class Prefix | Min Width | 用途 |
|-------------|----------|------|
| *(無 prefix)* | 0px | Mobile 基準（Base = 375px 設計）|
| `sm:` | 640px | 大螢幕手機 |
| `md:` | 768px | 平板（導覽切換點）|
| `lg:` | 1024px | 小筆電 |
| `xl:` | 1280px | 標準桌機 |
| `2xl:` | 1536px | 大桌機 |

---

## 2. 語義化 HTML（必守）

結構標籤決定無障礙與 SEO 品質，不能用 `<div>` 全兜。

```html
<!-- 每個頁面的基本骨架 -->
<header>   <!-- 頁首 / 導覽區 -->
<nav>      <!-- 導覽選單 -->
<main>     <!-- 頁面主要內容，每頁唯一 -->
<section>  <!-- 有意義的內容區塊（需有 heading）-->
<article>  <!-- 可獨立閱讀的內容單元 -->
<aside>    <!-- 側欄 / 補充資訊 -->
<footer>   <!-- 頁尾 -->
```

**命名規則**：`id` 用於錨點與 JS 綁定，`class` 用於樣式。

---

## 3. 無障礙（非選擇性）

| 項目 | 要求 |
|------|------|
| 顏色對比 | 文字對背景 4.5:1 最低，7:1 優先 |
| 觸控目標 | 所有互動元素 ≥ 44×44px（Tailwind：`min-h-[44px] min-w-[44px]`）|
| 鍵盤焦點 | 所有互動元素有可見 focus 樣式（Tailwind `focus:ring-2` 系列）|
| 表單標籤 | `<label for="xxx">` 與 `<input id="xxx">` 配對，不省略 |
| 圖片 Alt | 內容圖片有描述性 alt；裝飾性圖片 `alt=""`（空字串，非省略）|
| Toggle ARIA | `aria-expanded`、`aria-label` 在 hamburger / accordion 上必填 |
| Skip Link | 含大型導覽的頁面加 `<a href="#main-content" class="sr-only focus:not-sr-only">跳至主要內容</a>` |

---

## 4. 排版規則

1. **字體大小對比鮮明**：標題 3-4× 內文。Hero title 用 `clamp(2.5rem, 6vw, 5rem)` 或 Tailwind `text-4xl md:text-6xl`
2. **字重變化**：混用 `font-light` 與 `font-bold`，避免全頁 `font-normal`
3. **內文對齊**：內文 left-align（`text-left`），只有 hero 與短標語才 center
4. **行寬上限**：長文段落加 `max-w-prose`（65ch），避免過寬難讀

---

## 5. 間距系統

使用 Tailwind spacing scale，不亂用任意值（`p-[37px]` 是警訊）。

| 情境 | Tailwind Class |
|------|---------------|
| 頁面 section 垂直間距 | `py-12 md:py-20 lg:py-28` |
| 卡片內距 | `p-4 md:p-6` |
| 元素間水平間距 | `gap-4 md:gap-6` |
| 容器最大寬度 | `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8` |

---

## 6. 圖片與媒體

```html
<!-- 響應式圖片（永遠加） -->
<img src="..." alt="..." class="w-full h-auto object-cover" loading="lazy">

<!-- Hero / above-fold 圖片 -->
<img src="..." alt="..." class="w-full h-auto" loading="eager">

<!-- Google Maps 容器（本專案常見） -->
<div id="map" class="w-full h-64 md:h-96"></div>
```

禁止：
- 固定 `width` / `height` 屬性（除 favicon 與 icon 外）
- 缺少 `loading` 屬性（至少要有 `lazy`）

---

## 7. Tailwind 使用紀律

```html
<!-- 正確：utility classes 直接用 -->
<button class="bg-blue-600 hover:bg-blue-700 text-white font-semibold
               px-4 py-2 rounded-lg transition-colors
               focus:outline-none focus:ring-2 focus:ring-blue-500">
  送出
</button>

<!-- 可接受：重複樣式提取為 @apply（少量，需說明理由）-->
<!-- tailwind.config.js 的 theme.extend 處理設計 token，不用 CSS variables 系統 -->

<!-- 需要特殊值才使用 arbitrary values -->
<div class="top-[57px]">  <!-- 對應 header 固定高度時可接受 -->
```

`@apply` 超過 3 處重複時才考慮提取，且寫在 `<style scoped>` 中。

---

## 8. Anti-AI Patterns（避免這些特徵）

| 模式 | 問題 |
|------|------|
| Hero → 信任 bar → 3 卡片 → 功能 → Stat → CTA → Footer（骨架） | 過度公式化 |
| 每個 section 相同 padding，無呼吸感差異 | 版面無節奏 |
| 所有 section：heading + subheading + 內容（單調重複） | 視覺疲勞 |
| 所有 CTA 都叫「了解更多 / Learn More」 | 無指向性 |
| 裝飾性元素無目的性 | 視覺噪音 |
| 忽略 empty state 與 error state | 不完整的 UX |

---

## 9. Vue SFC Template 規範

```html
<!-- Vue 3 SFC 模板中的 Tailwind 使用 -->
<template>
  <!-- v-bind:class 處理動態樣式 -->
  <button
    :class="[
      'px-4 py-2 rounded-lg transition-colors',
      isActive ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'
    ]"
  >

  <!-- 條件渲染保留語義結構 -->
  <section v-if="hasData" aria-label="搜尋結果">
    ...
  </section>
  <p v-else class="text-center text-gray-500 py-8">
    尚無結果
  </p>
</template>
```

禁止在 Vue template 中使用 inline `style` 屬性（除非動態計算值，例如 Google Maps 容器高度）。

---

## 10. 完成前品質清單

```markdown
前端 HTML/CSS 完成前必查：

- [ ] Mobile 375px 無水平 overflow
- [ ] 所有互動元素 ≥ 44×44px
- [ ] 顏色對比通過 4.5:1（白底黑字 / 品牌色 CTA 需確認）
- [ ] 每個 <img> 有 alt + loading 屬性
- [ ] 表單 <label> 與 <input> 正確配對
- [ ] 無 arbitrary Tailwind 值（`[37px]` 等）除非有明確理由
- [ ] 不同 section 有視覺節奏差異（不全相同 padding）
- [ ] Empty state 與 error state 有實作
- [ ] 使用 responsiveness-check skill 跑過至少 Standard Check
```
