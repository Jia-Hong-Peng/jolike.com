import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ActionBar from '../src/components/ActionBar.vue'

// ── Rendering ─────────────────────────────────────────────────────────────────
describe('ActionBar — rendering', () => {
  it('T-AB-1 — renders 我會了, prev (◀), and next (▶) buttons', () => {
    const wrapper = mount(ActionBar, {
      props: { cardId: 'vid1_run', status: null, canGoPrev: true },
    })
    expect(wrapper.text()).toContain('我會了')
    expect(wrapper.text()).toContain('◀')
    expect(wrapper.text()).toContain('▶')
  })

  it('T-AB-2 — all three buttons have min-h-[44px] for touch target', () => {
    const wrapper = mount(ActionBar, {
      props: { cardId: 'vid1_run', status: null, canGoPrev: true },
    })
    const buttons = wrapper.findAll('button')
    expect(buttons.length).toBe(3)
    for (const btn of buttons) {
      expect(btn.classes()).toContain('min-h-[44px]')
    }
  })

  it('T-AB-3 — known button is highlighted when status=known', () => {
    const wrapper = mount(ActionBar, {
      props: { cardId: 'vid1_run', status: 'known', canGoPrev: false },
    })
    const knownBtn = wrapper.findAll('button')[1]  // middle button
    expect(knownBtn.classes()).toContain('bg-green-600')
  })

  it('T-AB-4 — known button not highlighted when status=null', () => {
    const wrapper = mount(ActionBar, {
      props: { cardId: 'vid1_run', status: null, canGoPrev: false },
    })
    const knownBtn = wrapper.findAll('button')[1]
    expect(knownBtn.classes()).not.toContain('bg-green-600')
  })

  it('T-AB-5 — prev button is disabled when canGoPrev=false', () => {
    const wrapper = mount(ActionBar, {
      props: { cardId: 'vid1_run', status: null, canGoPrev: false },
    })
    const prevBtn = wrapper.findAll('button')[0]
    expect(prevBtn.attributes('disabled')).toBeDefined()
  })

  it('T-AB-5b — prev button is enabled when canGoPrev=true', () => {
    const wrapper = mount(ActionBar, {
      props: { cardId: 'vid1_run', status: null, canGoPrev: true },
    })
    const prevBtn = wrapper.findAll('button')[0]
    expect(prevBtn.attributes('disabled')).toBeUndefined()
  })
})

// ── Event emission ────────────────────────────────────────────────────────────
describe('ActionBar — events', () => {
  it('T-AB-6 — clicking 我會了 emits mark with status=known', async () => {
    const wrapper = mount(ActionBar, {
      props: { cardId: 'vid1_run', status: null, canGoPrev: false },
    })
    await wrapper.findAll('button')[1].trigger('click')
    const emitted = wrapper.emitted('mark')
    expect(emitted).toBeTruthy()
    expect(emitted[0][0]).toEqual({ id: 'vid1_run', status: 'known' })
  })

  it('T-AB-7 — clicking ▶ emits next', async () => {
    const wrapper = mount(ActionBar, {
      props: { cardId: 'vid1_run', status: null, canGoPrev: false },
    })
    await wrapper.findAll('button')[2].trigger('click')
    expect(wrapper.emitted('next')).toBeTruthy()
  })

  it('T-AB-8 — clicking ◀ emits prev when enabled', async () => {
    const wrapper = mount(ActionBar, {
      props: { cardId: 'vid1_run', status: null, canGoPrev: true },
    })
    await wrapper.findAll('button')[0].trigger('click')
    expect(wrapper.emitted('prev')).toBeTruthy()
  })

  it('T-AB-9 — emitted mark payload uses the cardId prop', async () => {
    const wrapper = mount(ActionBar, {
      props: { cardId: 'vid2_accomplish', status: null, canGoPrev: false },
    })
    await wrapper.findAll('button')[1].trigger('click')
    expect(wrapper.emitted('mark')[0][0].id).toBe('vid2_accomplish')
  })
})
