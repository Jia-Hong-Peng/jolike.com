import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import ActionBar from '../src/components/ActionBar.vue'

// ── Rendering ─────────────────────────────────────────────────────────────────
describe('ActionBar — rendering', () => {
  it('T-AB-1 — renders both 我會了 and 不熟 buttons', () => {
    const wrapper = mount(ActionBar, {
      props: { cardId: 'vid1_run', status: null },
    })
    expect(wrapper.text()).toContain('我會了')
    expect(wrapper.text()).toContain('不熟')
  })

  it('T-AB-2 — both buttons have min-h-[44px] for touch target', () => {
    const wrapper = mount(ActionBar, {
      props: { cardId: 'vid1_run', status: null },
    })
    const buttons = wrapper.findAll('button')
    expect(buttons.length).toBe(2)
    for (const btn of buttons) {
      expect(btn.classes()).toContain('min-h-[44px]')
    }
  })

  it('T-AB-3 — known button is highlighted when status=known', () => {
    const wrapper = mount(ActionBar, {
      props: { cardId: 'vid1_run', status: 'known' },
    })
    const buttons = wrapper.findAll('button')
    expect(buttons[0].classes()).toContain('bg-green-600')  // known
    expect(buttons[1].classes()).not.toContain('bg-orange-600')  // unsure not highlighted
  })

  it('T-AB-4 — unsure button is highlighted when status=unsure', () => {
    const wrapper = mount(ActionBar, {
      props: { cardId: 'vid1_run', status: 'unsure' },
    })
    const buttons = wrapper.findAll('button')
    expect(buttons[0].classes()).not.toContain('bg-green-600')
    expect(buttons[1].classes()).toContain('bg-orange-600')
  })

  it('T-AB-5 — neither button highlighted when status=null', () => {
    const wrapper = mount(ActionBar, {
      props: { cardId: 'vid1_run', status: null },
    })
    const buttons = wrapper.findAll('button')
    expect(buttons[0].classes()).not.toContain('bg-green-600')
    expect(buttons[1].classes()).not.toContain('bg-orange-600')
  })
})

// ── Event emission ────────────────────────────────────────────────────────────
describe('ActionBar — mark event', () => {
  it('T-AB-6 — clicking 我會了 emits mark with status=known', async () => {
    const wrapper = mount(ActionBar, {
      props: { cardId: 'vid1_run', status: null },
    })
    await wrapper.findAll('button')[0].trigger('click')
    const emitted = wrapper.emitted('mark')
    expect(emitted).toBeTruthy()
    expect(emitted[0][0]).toEqual({ id: 'vid1_run', status: 'known' })
  })

  it('T-AB-7 — clicking 不熟 emits mark with status=unsure', async () => {
    const wrapper = mount(ActionBar, {
      props: { cardId: 'vid1_run', status: null },
    })
    await wrapper.findAll('button')[1].trigger('click')
    const emitted = wrapper.emitted('mark')
    expect(emitted).toBeTruthy()
    expect(emitted[0][0]).toEqual({ id: 'vid1_run', status: 'unsure' })
  })

  it('T-AB-8 — emitted payload uses the cardId prop', async () => {
    const wrapper = mount(ActionBar, {
      props: { cardId: 'vid2_accomplish', status: null },
    })
    await wrapper.findAll('button')[0].trigger('click')
    expect(wrapper.emitted('mark')[0][0].id).toBe('vid2_accomplish')
  })

  it('T-AB-9 — multiple clicks emit separate events', async () => {
    const wrapper = mount(ActionBar, {
      props: { cardId: 'vid1_run', status: null },
    })
    await wrapper.findAll('button')[0].trigger('click')
    await wrapper.findAll('button')[1].trigger('click')
    expect(wrapper.emitted('mark').length).toBe(2)
    expect(wrapper.emitted('mark')[0][0].status).toBe('known')
    expect(wrapper.emitted('mark')[1][0].status).toBe('unsure')
  })
})
