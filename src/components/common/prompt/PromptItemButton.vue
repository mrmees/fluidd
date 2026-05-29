<template>
  <div class="prompt-item-button">
    <v-btn
      :color="item.style"
      block
      @click="$emit('gcode', item.gcode)"
    >
      {{ item.label }}
    </v-btn>
  </div>
</template>

<script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator'
import type { PromptDialogItemButton } from '@/store/console/types'

@Component({})
export default class PromptItemButton extends Vue {
  @Prop({ type: Object, required: true })
  readonly item!: PromptDialogItemButton
}
</script>

<style scoped>
.prompt-item-button {
  margin: 4px 0;
}
</style>
