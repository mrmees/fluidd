// src/util/prompt-protocol/types.ts
//
// Protocol type definitions for Klipper Macro Prompt Protocol v1.
// Mirror of src/store/console/types.ts PromptDialog shape — kept here
// so the protocol module has no upward dependency on Vuex types.

export type PromptLifecycle = 'idle' | 'building' | 'shown' | 'suppressed'

export type PromptStyle =
  | 'primary'
  | 'secondary'
  | 'info'
  | 'warning'
  | 'error'
  | 'success'

export type PromptSize = 'small' | 'normal' | 'large' | 'x-large'

export interface PromptDialog {
  // Renderer-facing
  open: boolean
  title: string
  size: PromptSize
  items: PromptDialogItem[]
  footerButtons: PromptDialogFooterButton[]
  // Reducer state-machine bookkeeping; renderer does not read.
  machine: PromptStateMachine
}

export interface PromptStateMachine {
  lifecycle: PromptLifecycle
  activeContainer: 'row' | 'button_group' | null
  activeTargets: string[]
  pendingTargets: string[] | null
  pendingSize: PromptSize | null
  nextItemId: number
}

export type PromptDialogItem =
  | PromptDialogItemText
  | PromptDialogItemMarkup
  | PromptDialogItemImage
  | PromptDialogItemButton
  | PromptDialogItemRow
  | PromptDialogItemButtonGroup

export type PromptDialogInlineItem =
  | PromptDialogItemText
  | PromptDialogItemMarkup
  | PromptDialogItemImage
  | PromptDialogItemButton

export interface PromptDialogItemText {
  id: number
  type: 'text'
  text: string
}

export interface PromptDialogItemMarkup {
  id: number
  type: 'markup'
  ast: MarkupNode[]
}

export interface PromptDialogItemImage {
  id: number
  type: 'image'
  path: string
  alt: string
  scale: number | null
}

export interface PromptDialogItemButton {
  id: number
  type: 'button'
  label: string
  gcode: string
  style: PromptStyle
}

export interface PromptDialogItemRow {
  id: number
  type: 'row'
  items: PromptDialogInlineItem[]
}

export interface PromptDialogItemButtonGroup {
  id: number
  type: 'button_group'
  buttons: PromptDialogItemButton[]
}

export interface PromptDialogFooterButton {
  id: number
  label: string
  gcode: string
  style: PromptStyle
}

export type MarkupNode = MarkupTextNode | MarkupTagNode

export interface MarkupTextNode {
  type: 'text'
  text: string
}

export type MarkupTagNode =
  | { type: 'tag'; tag: 'b' | 'i' | 'u'; children: MarkupNode[] }
  | { type: 'tag'; tag: 'color' | 'bgcolor'; value: string; children: MarkupNode[] }
  | { type: 'tag'; tag: 'size'; value: PromptSize; children: MarkupNode[] }
