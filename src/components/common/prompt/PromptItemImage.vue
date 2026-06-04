<template>
  <div class="prompt-item-image">
    <img
      v-if="!loadFailed"
      :src="imageUrl"
      :alt="item.alt"
      :style="imageStyle"
      @error="loadFailed = true"
    >
    <span v-else-if="item.alt">{{ item.alt }}</span>
  </div>
</template>

<script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator'
import type { PromptDialogItemImage, PromptSize } from '@/store/console/types'

// Image base width tracks dialog envelope size, so scale=1 has roughly the
// same visual prominence across small/normal/large dialogs. Each value is
// ~1/3 of its matching dialog max-width.
const IMAGE_BASE_BY_DIALOG_SIZE_PX: Record<Exclude<PromptSize, 'full-screen'>, number> = {
  small: 133,
  normal: 200,
  large: 267,
  'x-large': 333
}

@Component({})
export default class PromptItemImage extends Vue {
  @Prop({ type: Object, required: true })
  readonly item!: PromptDialogItemImage

  loadFailed = false

  get imageUrl (): string {
    // $store.state cast is `any` to avoid pulling RootState (and its ambient
    // Moonraker/Klipper namespace deps) into this component's type closure —
    // they aren't visible to the vitest tsconfig. The actual runtime access is correct.
    const apiUrl = (this.$store.state as any).config.apiUrl as string
    // Path is already validated by the reducer; encode segments to preserve / structure.
    const encoded = this.item.path.split('/').map(encodeURIComponent).join('/')
    return `${apiUrl}/server/files/${encoded}`
  }

  get imageStyle (): Record<string, string> {
    // Absent scale → 1.0. Closes the "viewBox-only SVG with no explicit width
    // fills the container" trap where browsers expand SVG-as-img to 100% width.
    const scale = this.item.scale ?? 1
    const size = (this.$store.state as any).console.promptDialog.size as PromptSize
    if (size === 'full-screen') {
      // Viewport-relative so the image tracks the dialog as the window resizes.
      return {
        width: `${33 * scale}vw`,
        'max-width': '100%',
        height: 'auto'
      }
    }
    const base = IMAGE_BASE_BY_DIALOG_SIZE_PX[size] ?? IMAGE_BASE_BY_DIALOG_SIZE_PX.normal
    return {
      width: `${base * scale}px`,
      'max-width': '100%',
      height: 'auto'
    }
  }
}
</script>

<style scoped>
.prompt-item-image {
  margin: 4px 0;
}
</style>
