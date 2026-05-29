import type {
  PromptDialog,
  PromptDialogItem,
  PromptDialogInlineItem,
  PromptDialogItemButton
} from '@/util/prompt-protocol/types'
import { promptMarkupToPlainText } from '@/util/prompt-protocol'

export const REDUCER_OPTS = {
  frontendId: 'fluidd',
  frontendCategories: ['web']
}

// Filter fixtures we cannot run. Currently: nothing (we implement all of v1).
// Skip legacy-behavior-only or fallback-only fixtures.
export function canRun (fixture: any): boolean {
  if (fixture.skip === true) return false
  return true
}

export function toComparable (state: PromptDialog): any {
  return {
    visible: state.open,
    title: state.title,
    targets: state.machine.activeTargets,
    size: state.size,
    items: state.items.map(toComparableItem),
    footer_buttons: state.footerButtons.map(b => ({
      label: b.label, gcode: b.gcode, style: b.style
    }))
  }
}

function toComparableItem (item: PromptDialogItem | PromptDialogInlineItem): any {
  switch (item.type) {
    case 'text':
      return { type: 'text', text: item.text }
    case 'markup':
      return { type: 'markup', markup: item.raw, plain_text: promptMarkupToPlainText(item.ast) }
    case 'image':
      return { type: 'image', path: item.path, alt: item.alt, scale: item.scale }
    case 'button':
      return { type: 'button', label: item.label, gcode: item.gcode, style: item.style }
    case 'row':
      return { type: 'row', children: item.items.map(toComparableItem) }
    case 'button_group':
      return { type: 'button_group', children: item.buttons.map(b => toComparableItem(b as PromptDialogItemButton)) }
    default:
      throw new Error(`unhandled item type: ${(item as { type: string }).type}`)
  }
}
