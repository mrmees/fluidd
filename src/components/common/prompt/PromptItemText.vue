<template>
  <div class="prompt-item-text">
    {{ item.text }}
  </div>
</template>

<script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator'
import type { PromptDialogItemText } from '@/store/console/types'

@Component({})
export default class PromptItemText extends Vue {
  @Prop({ type: Object, required: true })
  readonly item!: PromptDialogItemText
}
</script>

<style scoped>
.prompt-item-text {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  margin: 4px 0;
}
</style>
