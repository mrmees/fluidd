<template>
  <div class="prompt-item-markup">
    <prompt-markup-node
      v-for="(node, i) in item.ast"
      :key="i"
      :node="node"
    />
  </div>
</template>

<script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator'
import type { PromptDialogItemMarkup } from '@/store/console/types'
import PromptMarkupNode from './PromptMarkupNode.vue'

@Component({ components: { PromptMarkupNode } })
export default class PromptItemMarkup extends Vue {
  @Prop({ type: Object, required: true })
  readonly item!: PromptDialogItemMarkup
}
</script>

<style scoped>
.prompt-item-markup {
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  margin: 4px 0;
}
</style>
