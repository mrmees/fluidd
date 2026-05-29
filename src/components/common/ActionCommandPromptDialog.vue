<template>
  <app-dialog
    v-model="open"
    :title="dialog.title"
    :max-width="maxWidth"
    :fullscreen="isFullscreen"
    :no-actions="dialog.footerButtons.length === 0"
    persistent
    closable-x
  >
    <v-card-text>
      <component
        :is="ITEM_COMPONENTS[item.type]"
        v-for="item in dialog.items"
        :key="item.id"
        :item="item"
        @gcode="handleGcode"
      />
    </v-card-text>

    <template #actions>
      <v-spacer />
      <prompt-footer-button
        v-for="button in dialog.footerButtons"
        :key="button.id"
        :button="button"
        @gcode="handleGcode"
      />
    </template>
  </app-dialog>
</template>

<script lang="ts">
import { Component, Mixins } from 'vue-property-decorator'
import StateMixin from '@/mixins/state'
import type { PromptDialog, PromptSize } from '@/store/console/types'
import PromptItemText from './prompt/PromptItemText.vue'
import PromptItemMarkup from './prompt/PromptItemMarkup.vue'
import PromptItemImage from './prompt/PromptItemImage.vue'
import PromptItemButton from './prompt/PromptItemButton.vue'
import PromptItemRow from './prompt/PromptItemRow.vue'
import PromptButtonGroup from './prompt/PromptButtonGroup.vue'
import PromptFooterButton from './prompt/PromptFooterButton.vue'

// 'full-screen' is handled via the dialog's :fullscreen prop, not a max-width.
const SIZE_MAP: Record<Exclude<PromptSize, 'full-screen'>, number> = {
  small: 400,
  normal: 600,
  large: 800,
  'x-large': 1000
}

const ITEM_COMPONENTS = {
  text: 'PromptItemText',
  markup: 'PromptItemMarkup',
  image: 'PromptItemImage',
  button: 'PromptItemButton',
  row: 'PromptItemRow',
  button_group: 'PromptButtonGroup'
} as const

@Component({
  components: {
    PromptItemText,
    PromptItemMarkup,
    PromptItemImage,
    PromptItemButton,
    PromptItemRow,
    PromptButtonGroup,
    PromptFooterButton
  }
})
export default class ActionCommandPromptDialog extends Mixins(StateMixin) {
  readonly ITEM_COMPONENTS = ITEM_COMPONENTS

  get dialog (): PromptDialog {
    return this.$typedState.console.promptDialog
  }

  get open (): boolean {
    return this.dialog.open
  }

  set open (value: boolean) {
    if (!value) {
      this.sendGcode('RESPOND TYPE=command MSG="action:prompt_end"')
    }
  }

  get isFullscreen (): boolean {
    return this.dialog.size === 'full-screen'
  }

  get maxWidth (): number | undefined {
    return this.isFullscreen ? undefined : SIZE_MAP[this.dialog.size as Exclude<PromptSize, 'full-screen'>]
  }

  handleGcode (gcode: string) {
    this.sendGcode(gcode)
  }
}
</script>
