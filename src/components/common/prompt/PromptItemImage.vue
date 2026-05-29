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
import type { PromptDialogItemImage } from '@/store/console/types'

const DEFAULT_IMAGE_BASE_PX = 200

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
    if (this.item.scale === null) {
      return { 'max-width': '100%', height: 'auto' }
    }
    return {
      width: `${DEFAULT_IMAGE_BASE_PX * this.item.scale}px`,
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
