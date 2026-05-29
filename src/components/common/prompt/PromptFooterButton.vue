<template>
  <app-btn
    :color="button.style"
    type="button"
    @click="$emit('gcode', button.gcode)"
  >
    {{ button.label }}
  </app-btn>
</template>

<script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator'
import type { PromptDialogFooterButton } from '@/store/console/types'

@Component({})
export default class PromptFooterButton extends Vue {
  @Prop({ type: Object, required: true })
  readonly button!: PromptDialogFooterButton
}
</script>
