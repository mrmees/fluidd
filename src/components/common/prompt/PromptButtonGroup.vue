<template>
  <div class="prompt-button-group d-flex">
    <v-btn
      v-for="btn in item.buttons"
      :key="btn.id"
      :color="btn.style"
      @click="$emit('gcode', btn.gcode)"
    >
      {{ btn.label }}
    </v-btn>
  </div>
</template>

<script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator'
import type { PromptDialogItemButtonGroup } from '@/store/console/types'

@Component({})
export default class PromptButtonGroup extends Vue {
  @Prop({ type: Object, required: true })
  readonly item!: PromptDialogItemButtonGroup
}
</script>

<style scoped>
.prompt-button-group {
  margin: 4px 0;
}
.prompt-button-group .v-btn {
  flex: 1 1 0;
  min-width: 0;
  border-radius: 0;
}
.prompt-button-group .v-btn:first-child {
  border-top-left-radius: 4px;
  border-bottom-left-radius: 4px;
}
.prompt-button-group .v-btn:last-child {
  border-top-right-radius: 4px;
  border-bottom-right-radius: 4px;
}
</style>
