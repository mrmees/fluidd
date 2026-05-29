// src/store/console/types.ts
import type {
  PromptDialog,
  PromptDialogItem,
  PromptDialogItemText,
  PromptDialogItemMarkup,
  PromptDialogItemImage,
  PromptDialogItemButton,
  PromptDialogItemRow,
  PromptDialogItemButtonGroup,
  PromptDialogInlineItem,
  PromptDialogFooterButton,
  PromptLifecycle,
  PromptStyle,
  PromptSize,
  PromptStateMachine,
  MarkupNode
} from '@/util/prompt-protocol/types'

export type {
  PromptDialog,
  PromptDialogItem,
  PromptDialogItemText,
  PromptDialogItemMarkup,
  PromptDialogItemImage,
  PromptDialogItemButton,
  PromptDialogItemRow,
  PromptDialogItemButtonGroup,
  PromptDialogInlineItem,
  PromptDialogFooterButton,
  PromptLifecycle,
  PromptStyle,
  PromptSize,
  PromptStateMachine,
  MarkupNode
}

export interface ConsoleState {
  consoleCommand: string;
  consoleSearch: string;
  console: ConsoleEntry[];
  gcodeHelp: Record<string, string>;
  consoleEntryCount: number;
  commandHistory: string[];
  autoScroll: boolean;
  lastCleared: number;
  promptDialog: PromptDialog;
  consoleFilters: ConsoleFilter[];
  consoleFiltersRegexp: RegExp[];
  hasReplayedGcodeStore: boolean;
}

export interface ConsoleEntry {
  id: number;
  message: string;
  time?: number;
  type: 'command' | 'response' | 'action';
}

export type ConsoleFilterType = 'contains' | 'starts-with' | 'expression'

export interface ConsoleFilter {
  id: string;
  name: string;
  type: ConsoleFilterType;
  value: string;
  enabled: boolean;
}
