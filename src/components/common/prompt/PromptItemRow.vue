<template>
  <div class="prompt-item-row d-flex align-center">
    <component
      :is="INLINE_COMPONENTS[inline.type]"
      v-for="inline in item.items"
      :key="inline.id"
      :item="inline"
      @gcode="$emit('gcode', $event)"
    />
  </div>
</template>

<script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator'
import type { PromptDialogItemRow } from '@/store/console/types'
import PromptItemText from './PromptItemText.vue'
import PromptItemMarkup from './PromptItemMarkup.vue'
import PromptItemImage from './PromptItemImage.vue'
import PromptItemButton from './PromptItemButton.vue'

const INLINE_COMPONENTS = {
  text: 'PromptItemText',
  markup: 'PromptItemMarkup',
  image: 'PromptItemImage',
  button: 'PromptItemButton'
} as const

@Component({
  components: { PromptItemText, PromptItemMarkup, PromptItemImage, PromptItemButton }
})
export default class PromptItemRow extends Vue {
  @Prop({ type: Object, required: true })
  readonly item!: PromptDialogItemRow

  readonly INLINE_COMPONENTS = INLINE_COMPONENTS
}
</script>

<style scoped>
.prompt-item-row {
  gap: 8px;
  margin: 4px 0;
}
.prompt-item-row > * {
  flex: 1 1 0;
  display: flex;
  justify-content: center;
  align-items: center;
  margin: 0;
  min-width: 0;
}
</style>
