<template>
  <span
    :class="nodeClass"
    :style="nodeStyle"
  >
    <template v-if="node.type === 'text'">{{ node.text }}</template>
    <prompt-markup-node
      v-for="(child, i) in tagChildren"
      v-else
      :key="i"
      :node="child"
    />
  </span>
</template>

<script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator'
import type { MarkupNode } from '@/store/console/types'

// No depth cap by design (see design §9.3) — if a macro nests this deep,
// it's a macro bug to fix.

@Component({ name: 'PromptMarkupNode' })
export default class PromptMarkupNode extends Vue {
  @Prop({ type: Object, required: true })
  readonly node!: MarkupNode

  get tagChildren (): MarkupNode[] {
    if (this.node.type === 'tag') return this.node.children
    return []
  }

  get nodeClass (): string | null {
    if (this.node.type !== 'tag') return null
    switch (this.node.tag) {
      case 'b': return 'prompt-markup-bold'
      case 'i': return 'prompt-markup-italic'
      case 'u': return 'prompt-markup-underline'
      case 'size':
        if (this.node.value === 'small') return 'prompt-markup-size-small'
        if (this.node.value === 'large') return 'prompt-markup-size-large'
        if (this.node.value === 'x-large') return 'prompt-markup-size-x-large'
        return null
      default:
        return null
    }
  }

  get nodeStyle (): Record<string, string> | undefined {
    if (this.node.type !== 'tag') return undefined
    if (this.node.tag === 'color') return { color: this.node.value }
    if (this.node.tag === 'bgcolor') {
      return {
        'background-color': this.node.value,
        padding: '0 2px',
        'border-radius': '2px'
      }
    }
    return undefined
  }
}
</script>

<style scoped>
.prompt-markup-bold { font-weight: 700; }
.prompt-markup-italic { font-style: italic; }
.prompt-markup-underline { text-decoration: underline; }
.prompt-markup-size-small { font-size: 0.85rem; }
.prompt-markup-size-large { font-size: 1.25rem; }
.prompt-markup-size-x-large { font-size: 1.5rem; }
</style>
