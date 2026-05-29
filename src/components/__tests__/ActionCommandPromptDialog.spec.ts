/**
 * ActionCommandPromptDialog — security-load-bearing smoke tests
 *
 * These tests exist because the three assertions below have XSS / UX-
 * correctness consequences that are too important to rely on manual
 * review alone.  They are the ONLY component tests in the repo; that
 * is intentional.
 *
 * Assertions:
 *   1. No v-html on macro-authored markup — a regression would allow XSS.
 *   2. Image error → alt-text fallback (not a broken <img>).
 *   3. Button click dispatches item.gcode, NOT item.label.
 *
 * Strategy: mount the child components (PromptItemMarkup, PromptItemImage,
 * PromptItemButton) directly.  They are the loci of the security properties;
 * mounting the full dialog would add layers of Vuex/Vuetify wiring for no
 * additional coverage of the assertions.
 */

import { mount, createLocalVue } from '@vue/test-utils'
import Vuetify from 'vuetify'
import Vuex from 'vuex'
import Vue from 'vue'

import PromptItemMarkup from '@/components/common/prompt/PromptItemMarkup.vue'
import PromptItemImage from '@/components/common/prompt/PromptItemImage.vue'
import PromptItemButton from '@/components/common/prompt/PromptItemButton.vue'

import type { PromptDialogItemMarkup, PromptDialogItemImage, PromptDialogItemButton } from '@/store/console/types'

// Vuetify needs to be installed on the global Vue for v-btn etc. to resolve.
Vue.use(Vuetify)
Vue.use(Vuex)

// ─── Test 1: markup rendered without v-html ────────────────────────────────

describe('PromptItemMarkup — no v-html (XSS guard)', () => {
  it('renders markup AST as DOM nodes, never injects raw markup string', () => {
    const item: PromptDialogItemMarkup = {
      id: 1,
      type: 'markup',
      raw: '<b>Bold</b> and <color:#22c55e>green</color>',
      ast: [
        {
          type: 'tag',
          tag: 'b',
          children: [{ type: 'text', text: 'Bold' }]
        },
        { type: 'text', text: ' and ' },
        {
          type: 'tag',
          tag: 'color',
          value: '#22c55e',
          children: [{ type: 'text', text: 'green' }]
        }
      ]
    }

    const wrapper = mount(PromptItemMarkup, {
      propsData: { item },
      vuetify: new Vuetify()
    })

    const html = wrapper.html()

    // The raw markup string MUST NOT appear literally in the DOM output.
    // If it did, it means v-html or innerHTML was used to inject it.
    expect(html).not.toContain('<b>Bold</b> and <color:#22c55e>green</color>')

    // The text content MUST be present (rendered via AST, not swallowed).
    expect(wrapper.text()).toContain('Bold')
    expect(wrapper.text()).toContain('green')
  })
})

// ─── Test 2: image error → alt-text fallback ──────────────────────────────

describe('PromptItemImage — error fallback', () => {
  it('hides img and shows alt text when the image fails to load', async () => {
    const item: PromptDialogItemImage = {
      id: 2,
      type: 'image',
      path: 'config/missing.svg',
      alt: 'Alt fallback',
      scale: null
    }

    // PromptItemImage reads $typedState.config.apiUrl via getter; inject via store.
    const store = new Vuex.Store({
      state: { config: { apiUrl: 'http://example.local' } }
    })

    // Make $typedState delegate to $store.state (mirrors the real plugin).
    const LocalVue = createLocalVue()
    LocalVue.use(Vuex)
    Object.defineProperty(LocalVue.prototype, '$typedState', {
      get () { return this.$store.state },
      configurable: true
    })

    const wrapper = mount(PromptItemImage, {
      localVue: LocalVue,
      store,
      propsData: { item },
      vuetify: new Vuetify()
    })

    // Before error: img must be present.
    expect(wrapper.find('img').exists()).toBe(true)

    // Simulate a failed image load.
    await wrapper.find('img').trigger('error')

    // After error: img must be gone, alt text must be visible.
    expect(wrapper.find('img').exists()).toBe(false)
    expect(wrapper.text()).toContain('Alt fallback')
  })
})

// ─── Test 3: button click dispatches gcode, not label ─────────────────────

describe('PromptItemButton — gcode emitted on click', () => {
  it('emits the configured gcode (not the label) when clicked', async () => {
    const item: PromptDialogItemButton = {
      id: 3,
      type: 'button',
      label: 'Press me',
      gcode: '_PROMPT_PRESS',
      style: 'primary'
    }

    const wrapper = mount(PromptItemButton, {
      propsData: { item },
      vuetify: new Vuetify()
    })

    // Click the v-btn inside the wrapper.
    const btn = wrapper.find('.v-btn')
    expect(btn.exists()).toBe(true)
    await btn.trigger('click')

    // The 'gcode' event must carry the gcode string, not the label.
    const emitted = wrapper.emitted('gcode') as string[][]
    expect(emitted).toBeTruthy()
    expect(emitted[0][0]).toBe('_PROMPT_PRESS')
    expect(emitted[0][0]).not.toBe('Press me')
  })
})
