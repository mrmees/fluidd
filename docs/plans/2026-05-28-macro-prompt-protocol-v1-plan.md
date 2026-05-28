# Klipper Macro Prompt Protocol v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring Fluidd into full compliance with the Klipper Macro Prompt Protocol v1 draft, implementing all core commands plus optional extensions (targeting, button groups, rows, images, PromptMarkup, plus a new `prompt_size` extension) as a reference implementation for cross-frontend discussion.

**Architecture:** Pure TypeScript parser/reducer module under `src/util/prompt-protocol/` consumes raw Klipper action lines and produces fully-shaped `PromptDialog` state. Vuex stores the state; a Vue 2 dialog with per-item-type subcomponents renders it. Markup is parsed to an AST and rendered through a recursive Vue component — never `v-html` on macro-authored content.

**Tech Stack:** Vue 2.7, Vuetify 2, Vuex, TypeScript, vitest + jsdom. Package manager: pnpm via `corepack pnpm`. Build: Vite 8.

**Source-of-truth design:** `docs/plans/2026-05-28-macro-prompt-protocol-v1-design.md`. Refer to it for full rationale on every locked decision. This plan is the HOW; the design doc is the WHAT and WHY.

**Branch:** `feat/macro-prompt-protocol-v1` (already created from `develop` after merging up to `72bdb0e0`). DO NOT base on `feat/custom-nav-links` (that's PR #1786, unrelated).

**Commit conventions** (per `AGENTS.md`):
- Conventional commits, subject ≤50 chars (husky `commit-msg` hook enforces)
- Sign-off requested: pass `-s` to `git commit`
- Co-author trailer for AI-assisted commits: `Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>`
- Locales: only edit `src/locales/en.yaml`; others come from Weblate

**TDD discipline:** Tests first. Run each test to confirm failure before implementing. Run again to confirm pass. Commit after each green task. Where multiple tests can be written together (one `describe` block), grouping them before implementation is acceptable — the principle is "tests describe behavior before code exists," not "one assert at a time."

**No placeholder caveats:** Trust model is user-authored macros (see design §9.1). No caps on items, nesting depth, or text length. No try/catch around parser functions — they return typed results, never throw.

---

## Task 1: Verify toolchain and branch state

**Files:** None modified; setup verification only.

- [ ] **Step 1: Confirm current branch**

```bash
git branch --show-current
```

Expected: `feat/macro-prompt-protocol-v1`

- [ ] **Step 2: Confirm `feat/custom-nav-links` was not modified**

```bash
git log --oneline feat/custom-nav-links -1
```

Expected: `72bdb0e0 chore: sync upstream/develop (85 commits)`

- [ ] **Step 3: Confirm pnpm reachable via corepack**

```bash
corepack pnpm --version
```

Expected: `11.3.0` (the version pinned by `packageManager` in `package.json`).

- [ ] **Step 4: Install dependencies if needed**

```bash
corepack pnpm install
```

Expected: lockfile satisfied; no errors.

- [ ] **Step 5: Confirm CI sequence passes on baseline**

```bash
corepack pnpm lint --no-fix && corepack pnpm type-check && corepack pnpm test:unit && corepack pnpm circular-check && corepack pnpm build
```

Expected: every step green. If any step fails on baseline, STOP and investigate — we need a clean starting line.

**Commit:** none (verification only).

---

## Task 2: Define protocol types

**Files:**
- Create: `src/util/prompt-protocol/types.ts`

This task defines the static type structure for everything downstream. No tests yet (types alone have no behavior).

- [ ] **Step 1: Create the types file**

```ts
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
```

- [ ] **Step 2: Run type-check to confirm valid TypeScript**

```bash
corepack pnpm type-check
```

Expected: pass (file has no imports; just type declarations).

- [ ] **Step 3: Commit**

```bash
git add src/util/prompt-protocol/types.ts
git commit -s -m "feat(prompt): add protocol type definitions" -m "Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 3: Update Vuex PromptDialog types

**Files:**
- Modify: `src/store/console/types.ts`

Replace the existing minimal `PromptDialog` shape with the full v1 model, re-exporting the protocol types so Vuex consumers don't import directly from the util module.

- [ ] **Step 1: Replace the file**

```ts
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
  gcodeHelp: Moonraker.KlippyApis.GcodeHelpResponse;
  consoleEntryCount: number;
  commandHistory: string[];
  autoScroll: boolean;
  lastCleared: number;
  promptDialog: PromptDialog;
  consoleFilters: ConsoleFilter[];
  consoleFiltersRegexp: RegExp[];
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
```

- [ ] **Step 2: Run type-check (expect failures elsewhere — that's the point)**

```bash
corepack pnpm type-check 2>&1 | tail -30
```

Expected: errors in `state.ts`, `mutations.ts`, `actions.ts`, `ActionCommandPromptDialog.vue` because their consumers see the new shape. We fix those in subsequent tasks. Acceptable for this task to leave the codebase in a temporarily-broken state because the rest of the plan restores it.

- [ ] **Step 3: Commit**

```bash
git add src/store/console/types.ts
git commit -s -m "refactor(console): expand PromptDialog types" -m "Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 4: Update Vuex defaultState and mutations skeleton

**Files:**
- Modify: `src/store/console/state.ts`
- Modify: `src/store/console/mutations.ts`

Provide a fully-shaped `defaultState.promptDialog` (Vue 2 reactivity requires all reactive fields exist from init) and consolidate prompt mutations into a single `setPromptDialog` replace.

- [ ] **Step 1: Read current state.ts and mutations.ts**

```bash
cat src/store/console/state.ts src/store/console/mutations.ts
```

This is informational — review what's there so the rewrite preserves existing non-prompt fields.

- [ ] **Step 2: Update `src/store/console/state.ts`**

Within the `defaultState` factory function, replace the existing `promptDialog` field with:

```ts
import type { ConsoleState, PromptDialog } from './types'

function initialPromptDialog (): PromptDialog {
  return {
    open: false,
    title: '',
    size: 'normal',
    items: [],
    footerButtons: [],
    machine: {
      lifecycle: 'idle',
      activeContainer: null,
      activeTargets: [],
      pendingTargets: null,
      pendingSize: null,
      nextItemId: 0
    }
  }
}

export const defaultState = (): ConsoleState => {
  return {
    consoleCommand: '',
    consoleSearch: '',
    console: [],
    gcodeHelp: {},
    consoleEntryCount: 0,
    commandHistory: [],
    autoScroll: true,
    lastCleared: 0,
    promptDialog: initialPromptDialog(),
    consoleFilters: [],
    consoleFiltersRegexp: []
  }
}

export const state = defaultState()
```

(Preserve any existing fields not shown above by reading the file first and merging.)

- [ ] **Step 3: Update `src/store/console/mutations.ts`**

Remove these existing prompt mutations: `setResetPromptDialog`, `setPromptDialogItem`, `setPromptDialogFooterButton`, `setPromptDialogOpen`.

Add a single replace mutation:

```ts
import type { MutationTree } from 'vuex'
import type { ConsoleState, PromptDialog } from './types'
import { defaultState } from './state'

export const mutations: MutationTree<ConsoleState> = {
  // ... existing non-prompt mutations preserved ...

  setPromptDialog (state, payload: PromptDialog) {
    state.promptDialog = payload
  },

  setReset (state) {
    Object.assign(state, defaultState())
  }
}
```

Preserve all non-prompt mutations from the current file.

- [ ] **Step 4: Type-check**

```bash
corepack pnpm type-check 2>&1 | tail -20
```

Expected: errors in `actions.ts` and `ActionCommandPromptDialog.vue` remain (fixed later); state.ts and mutations.ts should now type-check.

- [ ] **Step 5: Commit**

```bash
git add src/store/console/state.ts src/store/console/mutations.ts
git commit -s -m "refactor(console): reshape prompt state + mutations" -m "Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 5: Implement style normalizer

**Files:**
- Create: `src/util/prompt-protocol/style.ts`
- Create: `src/util/__tests__/prompt-protocol/style.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/util/__tests__/prompt-protocol/style.spec.ts
import { normalizeStyle, isPromptStyle } from '@/util/prompt-protocol/style'

describe('normalizeStyle', () => {
  it.each([
    ['primary', 'primary'],
    ['secondary', 'secondary'],
    ['info', 'info'],
    ['warning', 'warning'],
    ['error', 'error'],
    ['success', 'success'],
    ['PRIMARY', 'primary'],
    ['  Warning  ', 'warning'],
    ['', 'secondary'],
    ['unknown', 'secondary'],
    [undefined, 'secondary']
  ])('normalizes "%s" → "%s"', (input, expected) => {
    expect(normalizeStyle(input)).toBe(expected)
  })
})

describe('isPromptStyle', () => {
  it.each([
    ['primary', true],
    ['secondary', true],
    ['unknown', false],
    ['', false]
  ])('detects "%s" → %s', (value, expected) => {
    expect(isPromptStyle(value)).toBe(expected)
  })
})
```

- [ ] **Step 2: Run test to verify failure**

```bash
corepack pnpm test:unit -- src/util/__tests__/prompt-protocol/style.spec.ts
```

Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

```ts
// src/util/prompt-protocol/style.ts
import type { PromptStyle } from './types'

const KNOWN_STYLES: ReadonlySet<PromptStyle> = new Set([
  'primary', 'secondary', 'info', 'warning', 'error', 'success'
])

export function normalizeStyle (input: string | undefined): PromptStyle {
  if (typeof input !== 'string') return 'secondary'
  const normalized = input.trim().toLowerCase()
  return (KNOWN_STYLES as ReadonlySet<string>).has(normalized)
    ? normalized as PromptStyle
    : 'secondary'
}

export function isPromptStyle (value: string): value is PromptStyle {
  return (KNOWN_STYLES as ReadonlySet<string>).has(value)
}
```

- [ ] **Step 4: Run test to verify pass**

```bash
corepack pnpm test:unit -- src/util/__tests__/prompt-protocol/style.spec.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/util/prompt-protocol/style.ts src/util/__tests__/prompt-protocol/style.spec.ts
git commit -s -m "feat(prompt): style normalizer" -m "Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 6: Implement image path validator and scale parser

**Files:**
- Create: `src/util/prompt-protocol/image-path.ts`
- Create: `src/util/__tests__/prompt-protocol/image-path.spec.ts`

Spec rules: forward slashes; starts with `config/`; no leading `/` or `~`; no empty segments; no `.` or `..` segments; no `:` in any segment.

- [ ] **Step 1: Write failing tests**

```ts
// src/util/__tests__/prompt-protocol/image-path.spec.ts
import { isValidImagePath, parseImageScale } from '@/util/prompt-protocol/image-path'

describe('isValidImagePath', () => {
  it.each<[string, boolean]>([
    ['config/spool.svg', true],
    ['config/images/spool.svg', true],
    ['config/prompt-assets/blue-pla.png', true],
    ['config/a/b/c/d/e.jpg', true],
    // Invalid: missing config/ prefix
    ['spool.svg', false],
    ['images/spool.svg', false],
    // Invalid: leading slash or tilde
    ['/config/spool.svg', false],
    ['~/spool.svg', false],
    ['~config/spool.svg', false],
    // Invalid: empty segments
    ['config//spool.svg', false],
    ['config/', false],
    // Invalid: . or .. segments
    ['config/./spool.svg', false],
    ['config/../etc/passwd', false],
    ['config/sub/../sibling/x.svg', false],
    ['config/.hidden.svg', true], // a filename starting with . is fine; only `.` or `..` as full segments are illegal
    // Invalid: colon in segment
    ['config/C:/spool.svg', false],
    ['config/sub:dir/x.svg', false],
    // Invalid: remote URLs
    ['http://example.com/spool.svg', false],
    ['https://example.com/spool.svg', false],
    ['file:///etc/passwd', false],
    // Invalid: empty
    ['', false]
  ])('treats "%s" valid=%s', (path, expected) => {
    expect(isValidImagePath(path)).toBe(expected)
  })
})

describe('parseImageScale', () => {
  it.each<[string | undefined, number | null]>([
    [undefined, null],
    ['', null],
    ['1', 1],
    ['0.75', 0.75],
    ['2.5', 2.5],
    // Invalid: zero, negative, non-finite
    ['0', null],
    ['-1', null],
    ['-0.5', null],
    ['Infinity', null],
    ['NaN', null],
    // Invalid: non-`.` decimal separator
    ['0,75', null],
    // Invalid: non-numeric
    ['abc', null],
    ['1.5abc', null],
    // Whitespace handling
    ['  0.5  ', 0.5]
  ])('parses scale "%s" → %s', (input, expected) => {
    expect(parseImageScale(input)).toBe(expected)
  })
})
```

- [ ] **Step 2: Run tests to verify failure**

```bash
corepack pnpm test:unit -- src/util/__tests__/prompt-protocol/image-path.spec.ts
```

Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

```ts
// src/util/prompt-protocol/image-path.ts

export function isValidImagePath (path: string): boolean {
  if (typeof path !== 'string' || path.length === 0) return false
  if (path.startsWith('/') || path.startsWith('~')) return false
  // Forward slashes only — backslash anywhere is invalid.
  if (path.includes('\\')) return false

  const segments = path.split('/')
  if (segments[0] !== 'config') return false
  if (segments.length < 2) return false

  for (const segment of segments) {
    if (segment.length === 0) return false
    if (segment === '.' || segment === '..') return false
    if (segment.includes(':')) return false
  }

  return true
}

export function parseImageScale (input: string | undefined): number | null {
  if (input === undefined) return null
  const trimmed = input.trim()
  if (trimmed.length === 0) return null
  // Reject comma decimals explicitly (spec: decimal separator is `.`).
  if (trimmed.includes(',')) return null
  // Require strict numeric form — reject "1.5abc" etc.
  if (!/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(trimmed)) return null
  const n = Number(trimmed)
  if (!Number.isFinite(n) || n <= 0) return null
  return n
}
```

- [ ] **Step 4: Run tests to verify pass**

```bash
corepack pnpm test:unit -- src/util/__tests__/prompt-protocol/image-path.spec.ts
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/util/prompt-protocol/image-path.ts src/util/__tests__/prompt-protocol/image-path.spec.ts
git commit -s -m "feat(prompt): image path + scale validation" -m "Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 7: Implement button field parser

**Files:**
- Create: `src/util/prompt-protocol/button.ts`
- Create: `src/util/__tests__/prompt-protocol/button.spec.ts`

Parses `<label>|<gcode>|<style>` per spec rules:
- label required (empty → button ignored → null)
- gcode defaults to label if omitted/empty
- style defaults to `secondary` if omitted/empty/unknown (case-insensitive)
- pipes are reserved; macros must not put `|` in fields

- [ ] **Step 1: Write failing tests**

```ts
// src/util/__tests__/prompt-protocol/button.spec.ts
import { parseButtonFields } from '@/util/prompt-protocol/button'

describe('parseButtonFields', () => {
  it('parses full label|gcode|style', () => {
    expect(parseButtonFields('Do thing|_PROMPT_DO_THING|primary')).toEqual({
      label: 'Do thing',
      gcode: '_PROMPT_DO_THING',
      style: 'primary'
    })
  })

  it('defaults gcode to label when missing', () => {
    expect(parseButtonFields('Cancel')).toEqual({
      label: 'Cancel',
      gcode: 'Cancel',
      style: 'secondary'
    })
  })

  it('defaults gcode to label when empty', () => {
    expect(parseButtonFields('Cancel||primary')).toEqual({
      label: 'Cancel',
      gcode: 'Cancel',
      style: 'primary'
    })
  })

  it('defaults style to secondary when missing', () => {
    expect(parseButtonFields('Cancel|_CANCEL')).toEqual({
      label: 'Cancel',
      gcode: '_CANCEL',
      style: 'secondary'
    })
  })

  it('defaults style to secondary when empty', () => {
    expect(parseButtonFields('Cancel|_CANCEL|')).toEqual({
      label: 'Cancel',
      gcode: '_CANCEL',
      style: 'secondary'
    })
  })

  it('defaults style to secondary when unknown', () => {
    expect(parseButtonFields('Cancel|_CANCEL|funky')).toEqual({
      label: 'Cancel',
      gcode: '_CANCEL',
      style: 'secondary'
    })
  })

  it('normalizes style case', () => {
    expect(parseButtonFields('OK|_OK|PRIMARY')).toEqual({
      label: 'OK',
      gcode: '_OK',
      style: 'primary'
    })
  })

  it('returns null for empty label', () => {
    expect(parseButtonFields('')).toBeNull()
    expect(parseButtonFields('|gcode|primary')).toBeNull()
    expect(parseButtonFields('   ')).toBeNull()
    expect(parseButtonFields('  |gcode|primary')).toBeNull()
  })

  it('preserves internal whitespace in label and gcode', () => {
    expect(parseButtonFields('Press me|GCODE WITH ARGS|primary')).toEqual({
      label: 'Press me',
      gcode: 'GCODE WITH ARGS',
      style: 'primary'
    })
  })

  it('trims whitespace around label and gcode', () => {
    expect(parseButtonFields('  OK  |  _OK  |primary')).toEqual({
      label: 'OK',
      gcode: '_OK',
      style: 'primary'
    })
  })

  it('ignores extra pipe fields beyond style', () => {
    // Spec: pipe is reserved; macros must not put | in labels/gcode/styles.
    // If they do, downstream fields are dropped silently rather than corrupting earlier ones.
    expect(parseButtonFields('OK|_OK|primary|extra')).toEqual({
      label: 'OK',
      gcode: '_OK',
      style: 'primary'
    })
  })
})
```

- [ ] **Step 2: Run tests to verify failure**

```bash
corepack pnpm test:unit -- src/util/__tests__/prompt-protocol/button.spec.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
// src/util/prompt-protocol/button.ts
import { normalizeStyle } from './style'
import type { PromptStyle } from './types'

export interface ParsedButton {
  label: string
  gcode: string
  style: PromptStyle
}

export function parseButtonFields (param: string | undefined): ParsedButton | null {
  if (typeof param !== 'string') return null
  const parts = param.split('|')
  const label = (parts[0] ?? '').trim()
  if (label.length === 0) return null

  const rawGcode = (parts[1] ?? '').trim()
  const gcode = rawGcode.length > 0 ? rawGcode : label

  const style = normalizeStyle(parts[2])

  return { label, gcode, style }
}
```

- [ ] **Step 4: Run tests to verify pass**

```bash
corepack pnpm test:unit -- src/util/__tests__/prompt-protocol/button.spec.ts
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/util/prompt-protocol/button.ts src/util/__tests__/prompt-protocol/button.spec.ts
git commit -s -m "feat(prompt): button field parser" -m "Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 8: Implement markup parser — text, entities, plainText

**Files:**
- Create: `src/util/prompt-protocol/markup.ts`
- Create: `src/util/__tests__/prompt-protocol/markup.spec.ts`

Implement entity decoding and `toPlainText` first; tag parsing in Task 9. Splitting markup into two tasks keeps each one's TDD cycle small.

- [ ] **Step 1: Write failing tests for text + entities + plainText**

```ts
// src/util/__tests__/prompt-protocol/markup.spec.ts
import { parseMarkup, toPlainText } from '@/util/prompt-protocol/markup'

describe('parseMarkup — text and entities', () => {
  it('parses plain text', () => {
    expect(parseMarkup('Hello world')).toEqual([{ type: 'text', text: 'Hello world' }])
  })

  it('parses empty string', () => {
    expect(parseMarkup('')).toEqual([])
  })

  it('decodes &lt; &gt; &amp;', () => {
    expect(parseMarkup('a &lt; b &gt; c &amp; d')).toEqual([
      { type: 'text', text: 'a < b > c & d' }
    ])
  })

  it('decodes &amp;lt; to literal &lt; (no double-decode)', () => {
    expect(parseMarkup('&amp;lt;')).toEqual([{ type: 'text', text: '&lt;' }])
  })

  it('decodes \\n to line break', () => {
    expect(parseMarkup('line1\\nline2')).toEqual([
      { type: 'text', text: 'line1\nline2' }
    ])
  })

  it('does not decode escapes inside an already-decoded entity payload', () => {
    expect(parseMarkup('&amp;amp;')).toEqual([{ type: 'text', text: '&amp;' }])
  })

  it('preserves literal text adjacent to decoded entities', () => {
    expect(parseMarkup('a&amp;b')).toEqual([{ type: 'text', text: 'a&b' }])
  })
})

describe('toPlainText', () => {
  it('returns empty string for empty AST', () => {
    expect(toPlainText([])).toBe('')
  })

  it('returns text from a single text node', () => {
    expect(toPlainText([{ type: 'text', text: 'Hello' }])).toBe('Hello')
  })

  it('concatenates multiple text nodes', () => {
    expect(toPlainText([
      { type: 'text', text: 'A' },
      { type: 'text', text: 'B' }
    ])).toBe('AB')
  })
})
```

- [ ] **Step 2: Run tests to verify failure**

```bash
corepack pnpm test:unit -- src/util/__tests__/prompt-protocol/markup.spec.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement skeleton with text + entities + plainText**

```ts
// src/util/prompt-protocol/markup.ts
import type { MarkupNode } from './types'

const ENTITY_MAP: Record<string, string> = {
  '&lt;': '<',
  '&gt;': '>',
  '&amp;': '&'
}

// Decode entities and \n escapes in a single left-to-right pass.
// Decoded output is NOT reparsed (entity bomb defense per spec).
function decodeEscapes (input: string): string {
  let out = ''
  let i = 0
  while (i < input.length) {
    const ch = input[i]
    if (ch === '&') {
      // Match the longest known entity at this position.
      let matched = false
      for (const entity of Object.keys(ENTITY_MAP)) {
        if (input.startsWith(entity, i)) {
          out += ENTITY_MAP[entity]
          i += entity.length
          matched = true
          break
        }
      }
      if (!matched) {
        out += ch
        i += 1
      }
    } else if (ch === '\\' && input[i + 1] === 'n') {
      out += '\n'
      i += 2
    } else {
      out += ch
      i += 1
    }
  }
  return out
}

export function parseMarkup (input: string): MarkupNode[] {
  if (typeof input !== 'string' || input.length === 0) return []
  // Tag parsing comes in the next task. For now, treat the entire input as text.
  return [{ type: 'text', text: decodeEscapes(input) }]
}

export function toPlainText (ast: MarkupNode[]): string {
  let out = ''
  for (const node of ast) {
    if (node.type === 'text') {
      out += node.text
    } else {
      out += toPlainText(node.children)
    }
  }
  return out
}
```

- [ ] **Step 4: Run tests to verify pass**

```bash
corepack pnpm test:unit -- src/util/__tests__/prompt-protocol/markup.spec.ts
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/util/prompt-protocol/markup.ts src/util/__tests__/prompt-protocol/markup.spec.ts
git commit -s -m "feat(prompt): markup text + entity decoder" -m "Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 9: Markup parser — tags, nesting, validation

**Files:**
- Modify: `src/util/prompt-protocol/markup.ts`
- Modify: `src/util/__tests__/prompt-protocol/markup.spec.ts`

Add tag tokenization, AST building with nesting, validation of color/size values, unknown-tag stripping.

- [ ] **Step 1: Append failing tests**

Add to the existing `markup.spec.ts`:

```ts
describe('parseMarkup — tags', () => {
  it('parses a single <b> tag', () => {
    expect(parseMarkup('<b>Bold</b>')).toEqual([
      { type: 'tag', tag: 'b', children: [{ type: 'text', text: 'Bold' }] }
    ])
  })

  it('parses <i> and <u> simple tags', () => {
    expect(parseMarkup('<i>It</i>')).toEqual([
      { type: 'tag', tag: 'i', children: [{ type: 'text', text: 'It' }] }
    ])
    expect(parseMarkup('<u>Un</u>')).toEqual([
      { type: 'tag', tag: 'u', children: [{ type: 'text', text: 'Un' }] }
    ])
  })

  it('parses nested <b><i>...</i></b>', () => {
    expect(parseMarkup('<b><i>BI</i></b>')).toEqual([
      {
        type: 'tag',
        tag: 'b',
        children: [{
          type: 'tag',
          tag: 'i',
          children: [{ type: 'text', text: 'BI' }]
        }]
      }
    ])
  })

  it('parses adjacent text and tags', () => {
    expect(parseMarkup('Hi <b>there</b>!')).toEqual([
      { type: 'text', text: 'Hi ' },
      { type: 'tag', tag: 'b', children: [{ type: 'text', text: 'there' }] },
      { type: 'text', text: '!' }
    ])
  })

  it('parses <color:#22c55e> value tags', () => {
    expect(parseMarkup('<color:#22c55e>Green</color>')).toEqual([
      { type: 'tag', tag: 'color', value: '#22c55e', children: [{ type: 'text', text: 'Green' }] }
    ])
  })

  it('parses <bgcolor:#XXXXXX>', () => {
    expect(parseMarkup('<bgcolor:#ff0000>Red bg</bgcolor>')).toEqual([
      { type: 'tag', tag: 'bgcolor', value: '#ff0000', children: [{ type: 'text', text: 'Red bg' }] }
    ])
  })

  it('parses <size:large>', () => {
    expect(parseMarkup('<size:large>Big</size>')).toEqual([
      { type: 'tag', tag: 'size', value: 'large', children: [{ type: 'text', text: 'Big' }] }
    ])
  })

  it('accepts uppercase color hex digits', () => {
    expect(parseMarkup('<color:#FF00AA>X</color>')).toEqual([
      { type: 'tag', tag: 'color', value: '#FF00AA', children: [{ type: 'text', text: 'X' }] }
    ])
  })

  it('strips unknown tag, preserves children', () => {
    expect(parseMarkup('<funky>kept</funky>')).toEqual([
      { type: 'text', text: 'kept' }
    ])
  })

  it('strips invalid color (3-char hex), preserves children', () => {
    expect(parseMarkup('<color:#fff>x</color>')).toEqual([
      { type: 'text', text: 'x' }
    ])
  })

  it('strips invalid color (named), preserves children', () => {
    expect(parseMarkup('<color:red>x</color>')).toEqual([
      { type: 'text', text: 'x' }
    ])
  })

  it('strips invalid size value, preserves children', () => {
    expect(parseMarkup('<size:huge>x</size>')).toEqual([
      { type: 'text', text: 'x' }
    ])
  })

  it('treats orphan opening tag as literal text', () => {
    // Spec: unsupported frontends should strip markup and display readable plain text.
    // Best-effort recovery here: an unmatched <b> appears as literal text.
    expect(parseMarkup('<b>oops')).toEqual([
      { type: 'text', text: '<b>oops' }
    ])
  })

  it('treats orphan closing tag as literal text', () => {
    expect(parseMarkup('oops</b>')).toEqual([
      { type: 'text', text: 'oops</b>' }
    ])
  })

  it('treats mismatched closing tag as literal text', () => {
    // <b>...</i> — the </i> does not match the open <b>; emit best-effort.
    // We close the open tag at the mismatch and treat the rest as text.
    expect(parseMarkup('<b>x</i>y')).toEqual([
      { type: 'tag', tag: 'b', children: [{ type: 'text', text: 'x' }] },
      { type: 'text', text: '</i>y' }
    ])
  })

  it('decodes entities inside tags', () => {
    expect(parseMarkup('<b>&lt;</b>')).toEqual([
      { type: 'tag', tag: 'b', children: [{ type: 'text', text: '<' }] }
    ])
  })

  it('toPlainText walks nested tags', () => {
    expect(toPlainText(parseMarkup('<b><color:#22c55e>OK</color> done</b>'))).toBe('OK done')
  })

  it('treats malformed `<` not followed by tag-like start as literal', () => {
    expect(parseMarkup('1 < 2')).toEqual([{ type: 'text', text: '1 < 2' }])
  })

  it('case-insensitive size value normalizes to lowercase', () => {
    expect(parseMarkup('<size:LARGE>x</size>')).toEqual([
      { type: 'tag', tag: 'size', value: 'large', children: [{ type: 'text', text: 'x' }] }
    ])
  })

  it('rejects uppercase tag names (case-sensitive per spec grammar)', () => {
    expect(parseMarkup('<B>x</B>')).toEqual([
      { type: 'text', text: '<B>x</B>' }
    ])
  })
})
```

- [ ] **Step 2: Run tests to verify failure**

```bash
corepack pnpm test:unit -- src/util/__tests__/prompt-protocol/markup.spec.ts
```

Expected: new tag tests FAIL; pre-existing tests still pass.

- [ ] **Step 3: Replace `parseMarkup` with a tag-aware implementation**

```ts
// src/util/prompt-protocol/markup.ts (replace parseMarkup; keep decodeEscapes, toPlainText, ENTITY_MAP)
import type { MarkupNode, PromptSize } from './types'

const SIMPLE_TAGS = new Set(['b', 'i', 'u'])
const VALUE_TAGS = new Set(['color', 'bgcolor', 'size'])
const VALID_SIZES: ReadonlySet<PromptSize> = new Set(['small', 'normal', 'large', 'x-large'])
const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/

interface OpenTag {
  tag: string
  value: string | null
  children: MarkupNode[]
}

// Lex one tag at position i. Returns { kind: 'open' | 'close' | 'text', length, tag?, value? }.
type Token =
  | { kind: 'text'; length: number }
  | { kind: 'open'; length: number; tag: string; value: string | null }
  | { kind: 'close'; length: number; tag: string }

function scanTag (input: string, i: number): Token | null {
  if (input[i] !== '<') return null
  const closeBracket = input.indexOf('>', i + 1)
  if (closeBracket === -1) return null
  const inner = input.slice(i + 1, closeBracket)
  if (inner.length === 0) return null

  if (inner.startsWith('/')) {
    const tag = inner.slice(1)
    if (SIMPLE_TAGS.has(tag) || VALUE_TAGS.has(tag)) {
      return { kind: 'close', length: closeBracket - i + 1, tag }
    }
    return null
  }

  if (SIMPLE_TAGS.has(inner)) {
    return { kind: 'open', length: closeBracket - i + 1, tag: inner, value: null }
  }

  const colon = inner.indexOf(':')
  if (colon > 0) {
    const tag = inner.slice(0, colon)
    const rawValue = inner.slice(colon + 1)
    if (VALUE_TAGS.has(tag)) {
      return { kind: 'open', length: closeBracket - i + 1, tag, value: rawValue }
    }
  }

  return null
}

function isValidValueForTag (tag: string, rawValue: string): boolean {
  if (tag === 'color' || tag === 'bgcolor') {
    return HEX_COLOR_RE.test(rawValue)
  }
  if (tag === 'size') {
    return (VALID_SIZES as ReadonlySet<string>).has(rawValue.toLowerCase())
  }
  return false
}

function normalizeValueForTag (tag: string, rawValue: string): string {
  // Hex preserved as-given (per test expectations); size lowercased.
  if (tag === 'size') return rawValue.toLowerCase()
  return rawValue
}

function buildAst (input: string): MarkupNode[] {
  const root: MarkupNode[] = []
  const stack: OpenTag[] = []
  let textBuffer = ''
  let i = 0

  const currentChildren = () => stack.length > 0 ? stack[stack.length - 1].children : root

  const flushText = () => {
    if (textBuffer.length === 0) return
    currentChildren().push({ type: 'text', text: decodeEscapes(textBuffer) })
    textBuffer = ''
  }

  while (i < input.length) {
    if (input[i] === '<') {
      const token = scanTag(input, i)
      if (token === null) {
        // Not a recognized tag — literal text.
        textBuffer += input[i]
        i += 1
        continue
      }
      if (token.kind === 'open') {
        flushText()
        stack.push({
          tag: token.tag,
          value: token.value !== null ? token.value : null,
          children: []
        })
        i += token.length
        continue
      }
      if (token.kind === 'close') {
        // Mismatched close → literal text (best-effort recovery).
        if (stack.length === 0 || stack[stack.length - 1].tag !== token.tag) {
          textBuffer += input.slice(i, i + token.length)
          i += token.length
          continue
        }
        flushText()
        const open = stack.pop()!
        let node: MarkupNode | null = null
        if (open.value === null) {
          // simple tag
          if (open.tag === 'b' || open.tag === 'i' || open.tag === 'u') {
            node = { type: 'tag', tag: open.tag, children: open.children }
          }
        } else {
          if (isValidValueForTag(open.tag, open.value)) {
            const value = normalizeValueForTag(open.tag, open.value)
            if (open.tag === 'color' || open.tag === 'bgcolor') {
              node = { type: 'tag', tag: open.tag, value, children: open.children }
            } else if (open.tag === 'size') {
              node = { type: 'tag', tag: 'size', value: value as PromptSize, children: open.children }
            }
          } else {
            // Invalid value — strip tag, preserve children.
            currentChildren().push(...open.children)
          }
        }
        if (node !== null) {
          currentChildren().push(node)
        } else if (open.value === null) {
          // Unknown simple tag (shouldn't happen given scanTag filter, but defensive).
          currentChildren().push(...open.children)
        }
        i += token.length
        continue
      }
    }
    textBuffer += input[i]
    i += 1
  }

  // Unclosed open tags → re-emit their literal `<tag>` and flatten children to root.
  while (stack.length > 0) {
    const open = stack.shift()!
    const literal = open.value !== null
      ? `<${open.tag}:${open.value}>`
      : `<${open.tag}>`
    // Pre-pend the literal to whatever children we accumulated, then re-emit as text + child nodes.
    const target = stack.length > 0 ? stack[0].children : root
    target.push({ type: 'text', text: literal })
    target.push(...open.children)
  }

  if (textBuffer.length > 0) {
    currentChildren().push({ type: 'text', text: decodeEscapes(textBuffer) })
    textBuffer = ''
  }

  return root
}

export function parseMarkup (input: string): MarkupNode[] {
  if (typeof input !== 'string' || input.length === 0) return []
  return buildAst(input)
}
```

(Keep `decodeEscapes`, `ENTITY_MAP`, `toPlainText` from the previous task.)

- [ ] **Step 4: Run tests; iterate until green**

```bash
corepack pnpm test:unit -- src/util/__tests__/prompt-protocol/markup.spec.ts
```

Expected: all tests pass. If a test fails, read the test, read the implementation, and fix the implementation (NOT the test, unless the test contradicts the spec). Common iteration spots: orphan-tag recovery, mismatched-close handling, unclosed-tag flattening.

- [ ] **Step 5: Commit**

```bash
git add src/util/prompt-protocol/markup.ts src/util/__tests__/prompt-protocol/markup.spec.ts
git commit -s -m "feat(prompt): markup tag parser + validation" -m "Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 10: Implement parseAction line tokenizer

**Files:**
- Create: `src/util/prompt-protocol/parse-action.ts`
- Create: `src/util/__tests__/prompt-protocol/parse-action.spec.ts`

Accepts three input forms (`// action:prompt_X`, `action:prompt_X`, `prompt_X`). Emits one `ProtocolEvent` per known command, `{ kind: 'unknown', command }` for unknown `prompt_*`, `null` for non-prompt lines.

- [ ] **Step 1: Write failing tests**

```ts
// src/util/__tests__/prompt-protocol/parse-action.spec.ts
import { parseAction, type ProtocolEvent } from '@/util/prompt-protocol/parse-action'

describe('parseAction — non-prompt lines', () => {
  it('returns null for empty input', () => {
    expect(parseAction('')).toBeNull()
  })
  it('returns null for non-action line', () => {
    expect(parseAction('M114')).toBeNull()
  })
  it('returns null for unrelated action', () => {
    expect(parseAction('// action:notify_status_update message')).toBeNull()
  })
})

describe('parseAction — three input forms', () => {
  it('parses console-prefixed form', () => {
    expect(parseAction('// action:prompt_text Hello')).toEqual({ kind: 'text', text: 'Hello' })
  })
  it('parses bare action form', () => {
    expect(parseAction('action:prompt_text Hello')).toEqual({ kind: 'text', text: 'Hello' })
  })
  it('parses stripped form', () => {
    expect(parseAction('prompt_text Hello')).toEqual({ kind: 'text', text: 'Hello' })
  })
})

describe('parseAction — known commands', () => {
  it('parses begin with title', () => {
    expect(parseAction('prompt_begin My Title')).toEqual({ kind: 'begin', title: 'My Title' })
  })
  it('parses begin with empty title', () => {
    expect(parseAction('prompt_begin')).toEqual({ kind: 'begin', title: '' })
  })
  it('parses text', () => {
    expect(parseAction('prompt_text Some text')).toEqual({ kind: 'text', text: 'Some text' })
  })
  it('parses text with empty body', () => {
    expect(parseAction('prompt_text')).toEqual({ kind: 'text', text: '' })
  })
  it('parses show', () => {
    expect(parseAction('prompt_show')).toEqual({ kind: 'show' })
  })
  it('parses end', () => {
    expect(parseAction('prompt_end')).toEqual({ kind: 'end' })
  })
  it('parses button with full fields', () => {
    expect(parseAction('prompt_button OK|_OK|primary')).toEqual({
      kind: 'button', label: 'OK', gcode: '_OK', style: 'primary'
    })
  })
  it('parses button with defaults', () => {
    expect(parseAction('prompt_button OK')).toEqual({
      kind: 'button', label: 'OK', gcode: 'OK', style: 'secondary'
    })
  })
  it('emits unknown for empty-label button', () => {
    // Empty label means "button ignored" per spec. Parser surfaces this as unknown
    // (reducer no-ops); alternative is emitting nothing, but `unknown` keeps a uniform shape.
    expect(parseAction('prompt_button')).toEqual({ kind: 'unknown', command: 'button' })
    expect(parseAction('prompt_button   ')).toEqual({ kind: 'unknown', command: 'button' })
  })
  it('parses footer_button', () => {
    expect(parseAction('prompt_footer_button Cancel|_CANCEL|secondary')).toEqual({
      kind: 'footer_button', label: 'Cancel', gcode: '_CANCEL', style: 'secondary'
    })
  })
  it('parses target with comma-separated list', () => {
    expect(parseAction('prompt_target fluidd,web')).toEqual({
      kind: 'target', targets: ['fluidd', 'web']
    })
  })
  it('trims target entries and lowercases for compare', () => {
    expect(parseAction('prompt_target  Fluidd , Web ')).toEqual({
      kind: 'target', targets: ['fluidd', 'web']
    })
  })
  it('parses target with single entry', () => {
    expect(parseAction('prompt_target all')).toEqual({ kind: 'target', targets: ['all'] })
  })
  it('parses size', () => {
    expect(parseAction('prompt_size large')).toEqual({ kind: 'size', size: 'large' })
  })
  it('falls back size to normal for invalid value', () => {
    expect(parseAction('prompt_size huge')).toEqual({ kind: 'size', size: 'normal' })
    expect(parseAction('prompt_size')).toEqual({ kind: 'size', size: 'normal' })
    expect(parseAction('prompt_size  ')).toEqual({ kind: 'size', size: 'normal' })
  })
  it('normalizes size case', () => {
    expect(parseAction('prompt_size LARGE')).toEqual({ kind: 'size', size: 'large' })
  })
  it('parses row_start/row_end', () => {
    expect(parseAction('prompt_row_start')).toEqual({ kind: 'row_start' })
    expect(parseAction('prompt_row_end')).toEqual({ kind: 'row_end' })
  })
  it('parses button_group_start/end', () => {
    expect(parseAction('prompt_button_group_start')).toEqual({ kind: 'button_group_start' })
    expect(parseAction('prompt_button_group_end')).toEqual({ kind: 'button_group_end' })
  })
  it('parses image with path, alt, scale', () => {
    expect(parseAction('prompt_image config/spool.svg|Blue PLA|0.75')).toEqual({
      kind: 'image', path: 'config/spool.svg', alt: 'Blue PLA', scale: 0.75
    })
  })
  it('parses image with empty alt + scale', () => {
    expect(parseAction('prompt_image config/spool.svg||0.5')).toEqual({
      kind: 'image', path: 'config/spool.svg', alt: '', scale: 0.5
    })
  })
  it('parses image with only path', () => {
    expect(parseAction('prompt_image config/spool.svg')).toEqual({
      kind: 'image', path: 'config/spool.svg', alt: '', scale: null
    })
  })
  it('parses markup as AST', () => {
    const ev = parseAction('prompt_markup <b>Hi</b>')
    expect(ev?.kind).toBe('markup')
    if (ev?.kind === 'markup') {
      expect(ev.ast).toEqual([
        { type: 'tag', tag: 'b', children: [{ type: 'text', text: 'Hi' }] }
      ])
    }
  })
})

describe('parseAction — unknown commands', () => {
  it('emits unknown for prompt_xyz', () => {
    expect(parseAction('prompt_unknown_thing arg')).toEqual({ kind: 'unknown', command: 'unknown_thing' })
  })
  it('emits unknown for prompt_text_scale (KlipperScreen-local alias)', () => {
    expect(parseAction('prompt_text_scale 1.5')).toEqual({ kind: 'unknown', command: 'text_scale' })
  })
})
```

- [ ] **Step 2: Run tests to verify failure**

```bash
corepack pnpm test:unit -- src/util/__tests__/prompt-protocol/parse-action.spec.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement**

```ts
// src/util/prompt-protocol/parse-action.ts
import { parseButtonFields } from './button'
import { normalizeStyle } from './style'
import { parseImageScale } from './image-path'
import { parseMarkup } from './markup'
import type { MarkupNode, PromptStyle, PromptSize } from './types'

export type ProtocolEvent =
  | { kind: 'begin'; title: string }
  | { kind: 'text'; text: string }
  | { kind: 'markup'; ast: MarkupNode[] }
  | { kind: 'image'; path: string; alt: string; scale: number | null }
  | { kind: 'button'; label: string; gcode: string; style: PromptStyle }
  | { kind: 'footer_button'; label: string; gcode: string; style: PromptStyle }
  | { kind: 'show' }
  | { kind: 'end' }
  | { kind: 'target'; targets: string[] }
  | { kind: 'size'; size: PromptSize }
  | { kind: 'row_start' }
  | { kind: 'row_end' }
  | { kind: 'button_group_start' }
  | { kind: 'button_group_end' }
  | { kind: 'disconnect' }
  | { kind: 'unknown'; command: string }

const SIZE_NORMAL: PromptSize = 'normal'
const VALID_SIZES: ReadonlySet<PromptSize> = new Set(['small', 'normal', 'large', 'x-large'])

function normalizeSize (raw: string | undefined): PromptSize {
  if (typeof raw !== 'string') return SIZE_NORMAL
  const trimmed = raw.trim().toLowerCase()
  return (VALID_SIZES as ReadonlySet<string>).has(trimmed) ? trimmed as PromptSize : SIZE_NORMAL
}

// Strip canonical prefixes: "// action:" or "action:" leading text.
// Returns null if the remaining text does not look like a prompt_* command.
function canonicalize (rawLine: string): string | null {
  if (typeof rawLine !== 'string') return null
  let line = rawLine
  if (line.startsWith('// action:')) line = line.slice('// action:'.length)
  else if (line.startsWith('action:')) line = line.slice('action:'.length)
  if (!line.startsWith('prompt_')) return null
  return line.slice('prompt_'.length)
}

export function parseAction (rawLine: string): ProtocolEvent | null {
  const command = canonicalize(rawLine)
  if (command === null) return null

  // Split into command name + optional argument.
  const spaceIdx = command.indexOf(' ')
  const name = spaceIdx === -1 ? command : command.slice(0, spaceIdx)
  const param = spaceIdx === -1 ? '' : command.slice(spaceIdx + 1)

  switch (name) {
    case 'begin':
      return { kind: 'begin', title: param }
    case 'text':
      return { kind: 'text', text: param }
    case 'show':
      return { kind: 'show' }
    case 'end':
      return { kind: 'end' }
    case 'button': {
      const parsed = parseButtonFields(param)
      if (!parsed) return { kind: 'unknown', command: 'button' }
      return { kind: 'button', ...parsed }
    }
    case 'footer_button': {
      const parsed = parseButtonFields(param)
      if (!parsed) return { kind: 'unknown', command: 'footer_button' }
      return { kind: 'footer_button', ...parsed }
    }
    case 'target': {
      const targets = param
        .split(',')
        .map(s => s.trim().toLowerCase())
        .filter(s => s.length > 0)
      return { kind: 'target', targets }
    }
    case 'size':
      return { kind: 'size', size: normalizeSize(param) }
    case 'row_start':
      return { kind: 'row_start' }
    case 'row_end':
      return { kind: 'row_end' }
    case 'button_group_start':
      return { kind: 'button_group_start' }
    case 'button_group_end':
      return { kind: 'button_group_end' }
    case 'image': {
      const parts = param.split('|')
      const path = (parts[0] ?? '').trim()
      const alt = (parts[1] ?? '').trim()
      const scale = parseImageScale(parts[2])
      return { kind: 'image', path, alt, scale }
    }
    case 'markup':
      return { kind: 'markup', ast: parseMarkup(param) }
    default:
      return { kind: 'unknown', command: name }
  }
}
```

- [ ] **Step 4: Run tests to verify pass**

```bash
corepack pnpm test:unit -- src/util/__tests__/prompt-protocol/parse-action.spec.ts
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/util/prompt-protocol/parse-action.ts src/util/__tests__/prompt-protocol/parse-action.spec.ts
git commit -s -m "feat(prompt): action line tokenizer" -m "Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 11: Reducer — initial state and core lifecycle

**Files:**
- Create: `src/util/prompt-protocol/reducer.ts`
- Create: `src/util/__tests__/prompt-protocol/reducer.spec.ts`

Implements `initialPromptState()` and the core idle/building/shown transitions. Targeting, sizing, containers, disconnect come in subsequent tasks.

- [ ] **Step 1: Write failing tests**

```ts
// src/util/__tests__/prompt-protocol/reducer.spec.ts
import { initialPromptState, reducePrompt } from '@/util/prompt-protocol/reducer'
import type { ProtocolEvent } from '@/util/prompt-protocol/parse-action'
import type { PromptDialog } from '@/util/prompt-protocol/types'

const OPTS = { frontendId: 'fluidd', frontendCategories: ['web'] }

function feed (state: PromptDialog, ...events: ProtocolEvent[]): PromptDialog {
  return events.reduce((s, e) => reducePrompt(s, e, OPTS), state)
}

describe('initialPromptState', () => {
  it('returns a fully shaped idle state', () => {
    expect(initialPromptState()).toEqual({
      open: false,
      title: '',
      size: 'normal',
      items: [],
      footerButtons: [],
      machine: {
        lifecycle: 'idle',
        activeContainer: null,
        activeTargets: [],
        pendingTargets: null,
        pendingSize: null,
        nextItemId: 0
      }
    })
  })
})

describe('reducer — idle state', () => {
  it('ignores content commands while idle', () => {
    const state = feed(initialPromptState(),
      { kind: 'text', text: 'orphan' },
      { kind: 'button', label: 'X', gcode: 'X', style: 'primary' }
    )
    expect(state.items).toEqual([])
    expect(state.machine.lifecycle).toBe('idle')
  })

  it('show before begin is no-op', () => {
    const state = reducePrompt(initialPromptState(), { kind: 'show' }, OPTS)
    expect(state.open).toBe(false)
    expect(state.machine.lifecycle).toBe('idle')
  })

  it('end before begin is no-op', () => {
    const state = reducePrompt(initialPromptState(), { kind: 'end' }, OPTS)
    expect(state.open).toBe(false)
  })

  it('begin transitions to building and sets title', () => {
    const state = reducePrompt(initialPromptState(), { kind: 'begin', title: 'Hi' }, OPTS)
    expect(state.machine.lifecycle).toBe('building')
    expect(state.title).toBe('Hi')
    expect(state.open).toBe(false)
    expect(state.machine.activeTargets).toEqual(['all'])
  })
})

describe('reducer — building state', () => {
  function building (): PromptDialog {
    return reducePrompt(initialPromptState(), { kind: 'begin', title: 'T' }, OPTS)
  }

  it('appends text items with monotonic ids', () => {
    const state = feed(building(),
      { kind: 'text', text: 'a' },
      { kind: 'text', text: 'b' }
    )
    expect(state.items).toEqual([
      { id: 0, type: 'text', text: 'a' },
      { id: 1, type: 'text', text: 'b' }
    ])
    expect(state.machine.nextItemId).toBe(2)
  })

  it('appends button items', () => {
    const state = feed(building(),
      { kind: 'button', label: 'OK', gcode: '_OK', style: 'primary' }
    )
    expect(state.items[0]).toEqual({ id: 0, type: 'button', label: 'OK', gcode: '_OK', style: 'primary' })
  })

  it('appends footer buttons to footerButtons, not items', () => {
    const state = feed(building(),
      { kind: 'footer_button', label: 'Cancel', gcode: '_CANCEL', style: 'secondary' }
    )
    expect(state.items).toEqual([])
    expect(state.footerButtons).toEqual([
      { id: 0, label: 'Cancel', gcode: '_CANCEL', style: 'secondary' }
    ])
  })

  it('show transitions to shown and opens dialog', () => {
    const state = feed(building(), { kind: 'show' })
    expect(state.machine.lifecycle).toBe('shown')
    expect(state.open).toBe(true)
  })

  it('end clears to idle', () => {
    const state = feed(building(), { kind: 'text', text: 'a' }, { kind: 'end' })
    expect(state.machine.lifecycle).toBe('idle')
    expect(state.title).toBe('')
    expect(state.items).toEqual([])
    expect(state.open).toBe(false)
  })

  it('begin during building restarts with new title', () => {
    const state = feed(building(),
      { kind: 'text', text: 'old' },
      { kind: 'begin', title: 'New' }
    )
    expect(state.title).toBe('New')
    expect(state.items).toEqual([])
    expect(state.machine.lifecycle).toBe('building')
  })
})

describe('reducer — shown state', () => {
  function shown (): PromptDialog {
    return feed(initialPromptState(),
      { kind: 'begin', title: 'T' },
      { kind: 'show' }
    )
  }

  it('appends content live after show', () => {
    const state = feed(shown(), { kind: 'text', text: 'live' })
    expect(state.items).toEqual([{ id: 0, type: 'text', text: 'live' }])
    expect(state.open).toBe(true)
  })

  it('show while shown is no-op', () => {
    const initial = shown()
    const state = reducePrompt(initial, { kind: 'show' }, OPTS)
    expect(state).toEqual(initial)
  })

  it('end while shown clears and closes', () => {
    const state = feed(shown(), { kind: 'text', text: 'x' }, { kind: 'end' })
    expect(state.open).toBe(false)
    expect(state.machine.lifecycle).toBe('idle')
    expect(state.items).toEqual([])
  })

  it('begin while shown restarts (clears + reopens at building)', () => {
    const state = feed(shown(),
      { kind: 'text', text: 'old' },
      { kind: 'begin', title: 'New' }
    )
    expect(state.title).toBe('New')
    expect(state.items).toEqual([])
    expect(state.machine.lifecycle).toBe('building')
    expect(state.open).toBe(false)
  })

  it('unknown event is no-op', () => {
    const initial = shown()
    const state = reducePrompt(initial, { kind: 'unknown', command: 'whatever' }, OPTS)
    expect(state).toEqual(initial)
  })
})
```

- [ ] **Step 2: Run tests to verify failure**

```bash
corepack pnpm test:unit -- src/util/__tests__/prompt-protocol/reducer.spec.ts
```

Expected: FAIL.

- [ ] **Step 3: Implement (core lifecycle only — containers/targeting/sizing/disconnect in later tasks)**

```ts
// src/util/prompt-protocol/reducer.ts
import type {
  PromptDialog,
  PromptDialogFooterButton,
  PromptDialogItem,
  PromptDialogItemButton,
  PromptDialogItemImage,
  PromptDialogItemMarkup,
  PromptDialogItemText,
  PromptSize,
  PromptStateMachine
} from './types'
import type { ProtocolEvent } from './parse-action'

export interface ReducerOptions {
  frontendId: string
  frontendCategories: string[]
}

export function initialPromptState (): PromptDialog {
  return {
    open: false,
    title: '',
    size: 'normal',
    items: [],
    footerButtons: [],
    machine: {
      lifecycle: 'idle',
      activeContainer: null,
      activeTargets: [],
      pendingTargets: null,
      pendingSize: null,
      nextItemId: 0
    }
  }
}

function freshIdle (machine?: Partial<PromptStateMachine>): PromptDialog {
  const base = initialPromptState()
  if (machine) {
    base.machine = { ...base.machine, ...machine }
  }
  return base
}

function beginPrompt (
  prev: PromptDialog,
  title: string,
  opts: ReducerOptions
): PromptDialog {
  const activeTargets = prev.machine.pendingTargets ?? ['all']
  const matched = targetsMatch(activeTargets, opts)
  const size = prev.machine.pendingSize ?? 'normal'

  // Discard pending after consumption (whether matched or not).
  return {
    open: false,
    title,
    size,
    items: [],
    footerButtons: [],
    machine: {
      lifecycle: matched ? 'building' : 'suppressed',
      activeContainer: null,
      activeTargets,
      pendingTargets: null,
      pendingSize: null,
      // Continue ID counter across prompts — IDs are session-monotonic.
      nextItemId: prev.machine.nextItemId
    }
  }
}

function targetsMatch (targets: string[], opts: ReducerOptions): boolean {
  if (targets.includes('all')) return true
  if (targets.includes(opts.frontendId.toLowerCase())) return true
  for (const category of opts.frontendCategories) {
    if (targets.includes(category.toLowerCase())) return true
  }
  return false
}

// Append item helpers — Task 12 expands these for containers.
function appendItem (state: PromptDialog, item: Omit<PromptDialogItem, 'id'>): PromptDialog {
  const id = state.machine.nextItemId
  const withId = { ...item, id } as PromptDialogItem
  return {
    ...state,
    items: [...state.items, withId],
    machine: { ...state.machine, nextItemId: id + 1 }
  }
}

function appendFooterButton (
  state: PromptDialog,
  button: Omit<PromptDialogFooterButton, 'id'>
): PromptDialog {
  const id = state.machine.nextItemId
  return {
    ...state,
    footerButtons: [...state.footerButtons, { ...button, id }],
    machine: { ...state.machine, nextItemId: id + 1 }
  }
}

export function reducePrompt (
  state: PromptDialog,
  event: ProtocolEvent,
  opts: ReducerOptions
): PromptDialog {
  // Targeting / sizing / disconnect added in Task 13.
  switch (event.kind) {
    case 'begin':
      return beginPrompt(state, event.title, opts)
    case 'unknown':
      return state
    case 'show':
      if (state.machine.lifecycle === 'building') {
        return { ...state, open: true, machine: { ...state.machine, lifecycle: 'shown' } }
      }
      return state
    case 'end':
      if (state.machine.lifecycle === 'idle') return state
      return freshIdle({ nextItemId: state.machine.nextItemId })
  }

  // From here, content commands depend on lifecycle.
  const lc = state.machine.lifecycle
  if (lc === 'idle' || lc === 'suppressed') return state

  switch (event.kind) {
    case 'text':
      return appendItem(state, { type: 'text', text: event.text } as Omit<PromptDialogItemText, 'id'>)
    case 'markup':
      return appendItem(state, { type: 'markup', ast: event.ast } as Omit<PromptDialogItemMarkup, 'id'>)
    case 'image': {
      // Invalid path → text fallback at reducer. Validation done in Task 13 once
      // image-path module is wired here. For now, accept all paths.
      const item: Omit<PromptDialogItemImage, 'id'> = {
        type: 'image', path: event.path, alt: event.alt, scale: event.scale
      }
      return appendItem(state, item)
    }
    case 'button':
      return appendItem(state, {
        type: 'button', label: event.label, gcode: event.gcode, style: event.style
      } as Omit<PromptDialogItemButton, 'id'>)
    case 'footer_button':
      return appendFooterButton(state, {
        label: event.label, gcode: event.gcode, style: event.style
      })
  }

  // row/group/target/size/disconnect added in later tasks.
  return state
}
```

- [ ] **Step 4: Run tests to verify pass**

```bash
corepack pnpm test:unit -- src/util/__tests__/prompt-protocol/reducer.spec.ts
```

Expected: all Task 11 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/util/prompt-protocol/reducer.ts src/util/__tests__/prompt-protocol/reducer.spec.ts
git commit -s -m "feat(prompt): reducer core lifecycle" -m "Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 12: Reducer — containers (rows and button groups)

**Files:**
- Modify: `src/util/prompt-protocol/reducer.ts`
- Modify: `src/util/__tests__/prompt-protocol/reducer.spec.ts`

Container rules: row contains inline items only; group contains buttons only; nesting prohibited (inner start ignored).

- [ ] **Step 1: Append failing tests**

```ts
// Append to reducer.spec.ts:
describe('reducer — rows', () => {
  function building (): PromptDialog {
    return reducePrompt(initialPromptState(), { kind: 'begin', title: 'T' }, OPTS)
  }

  it('opens a row container', () => {
    const state = feed(building(), { kind: 'row_start' })
    expect(state.machine.activeContainer).toBe('row')
    expect(state.items).toEqual([])
  })

  it('routes content into the open row', () => {
    const state = feed(building(),
      { kind: 'row_start' },
      { kind: 'text', text: 'a' },
      { kind: 'text', text: 'b' }
    )
    expect(state.items).toHaveLength(1)
    expect(state.items[0].type).toBe('row')
    if (state.items[0].type === 'row') {
      expect(state.items[0].items).toEqual([
        { id: 1, type: 'text', text: 'a' },
        { id: 2, type: 'text', text: 'b' }
      ])
    }
  })

  it('closes the row on row_end', () => {
    const state = feed(building(),
      { kind: 'row_start' },
      { kind: 'text', text: 'in' },
      { kind: 'row_end' },
      { kind: 'text', text: 'out' }
    )
    expect(state.machine.activeContainer).toBeNull()
    expect(state.items).toHaveLength(2)
    expect(state.items[1]).toEqual({ id: 2, type: 'text', text: 'out' })
  })

  it('ignores nested row_start', () => {
    const state = feed(building(),
      { kind: 'row_start' },
      { kind: 'row_start' },  // ignored
      { kind: 'text', text: 'x' }
    )
    expect(state.machine.activeContainer).toBe('row')
    expect(state.items[0].type).toBe('row')
    if (state.items[0].type === 'row') {
      expect(state.items[0].items).toEqual([{ id: 2, type: 'text', text: 'x' }])
    }
  })

  it('routes footer_button to footerButtons even inside a row', () => {
    const state = feed(building(),
      { kind: 'row_start' },
      { kind: 'footer_button', label: 'Cancel', gcode: '_CANCEL', style: 'secondary' }
    )
    expect(state.footerButtons).toHaveLength(1)
    if (state.items[0]?.type === 'row') {
      expect(state.items[0].items).toEqual([])
    }
  })

  it('end while row open implicitly closes container', () => {
    const state = feed(building(),
      { kind: 'row_start' },
      { kind: 'text', text: 'x' },
      { kind: 'end' }
    )
    expect(state.machine.activeContainer).toBeNull()
  })
})

describe('reducer — button groups', () => {
  function building (): PromptDialog {
    return reducePrompt(initialPromptState(), { kind: 'begin', title: 'T' }, OPTS)
  }

  it('opens a button group container', () => {
    const state = feed(building(), { kind: 'button_group_start' })
    expect(state.machine.activeContainer).toBe('button_group')
  })

  it('routes buttons into the open group', () => {
    const state = feed(building(),
      { kind: 'button_group_start' },
      { kind: 'button', label: '+1', gcode: '_PLUS1', style: 'secondary' },
      { kind: 'button', label: '-1', gcode: '_MINUS1', style: 'secondary' }
    )
    expect(state.items).toHaveLength(1)
    if (state.items[0].type === 'button_group') {
      expect(state.items[0].buttons).toEqual([
        { id: 1, type: 'button', label: '+1', gcode: '_PLUS1', style: 'secondary' },
        { id: 2, type: 'button', label: '-1', gcode: '_MINUS1', style: 'secondary' }
      ])
    }
  })

  it('drops non-button content inside button group (spec: groups contain buttons only)', () => {
    const state = feed(building(),
      { kind: 'button_group_start' },
      { kind: 'text', text: 'oops' },
      { kind: 'button', label: 'OK', gcode: 'OK', style: 'primary' }
    )
    if (state.items[0].type === 'button_group') {
      expect(state.items[0].buttons).toEqual([
        { id: 1, type: 'button', label: 'OK', gcode: 'OK', style: 'primary' }
      ])
    }
  })

  it('ignores nested button_group_start', () => {
    const state = feed(building(),
      { kind: 'button_group_start' },
      { kind: 'button_group_start' },
      { kind: 'button', label: 'OK', gcode: 'OK', style: 'primary' }
    )
    expect(state.machine.activeContainer).toBe('button_group')
  })

  it('ignores row_start inside button_group (and vice versa)', () => {
    const state = feed(building(),
      { kind: 'button_group_start' },
      { kind: 'row_start' },
      { kind: 'button', label: 'OK', gcode: 'OK', style: 'primary' }
    )
    expect(state.machine.activeContainer).toBe('button_group')
    if (state.items[0].type === 'button_group') {
      expect(state.items[0].buttons).toHaveLength(1)
    }
  })

  it('closes on button_group_end', () => {
    const state = feed(building(),
      { kind: 'button_group_start' },
      { kind: 'button_group_end' },
      { kind: 'text', text: 'after' }
    )
    expect(state.machine.activeContainer).toBeNull()
    expect(state.items).toHaveLength(2)
  })
})
```

- [ ] **Step 2: Run tests; observe failures**

```bash
corepack pnpm test:unit -- src/util/__tests__/prompt-protocol/reducer.spec.ts
```

Expected: new container tests FAIL.

- [ ] **Step 3: Extend reducer with container handling**

Replace the bottom-half of `reducePrompt` (everything after the `if (lc === 'idle' || lc === 'suppressed') return state` line) and the `appendItem` helper with the container-aware versions below. Keep the existing `freshIdle`, `targetsMatch`, `beginPrompt`, `initialPromptState`, and `appendFooterButton`.

```ts
function appendInRow (state: PromptDialog, item: Omit<PromptDialogInlineItem, 'id'>): PromptDialog {
  const id = state.machine.nextItemId
  const items = state.items.map((existing, idx) => {
    if (idx !== state.items.length - 1) return existing
    if (existing.type !== 'row') return existing
    const newItem = { ...item, id } as PromptDialogInlineItem
    return { ...existing, items: [...existing.items, newItem] }
  })
  return { ...state, items, machine: { ...state.machine, nextItemId: id + 1 } }
}

function appendInGroup (state: PromptDialog, button: Omit<PromptDialogItemButton, 'id'>): PromptDialog {
  const id = state.machine.nextItemId
  const items = state.items.map((existing, idx) => {
    if (idx !== state.items.length - 1) return existing
    if (existing.type !== 'button_group') return existing
    return { ...existing, buttons: [...existing.buttons, { ...button, id }] }
  })
  return { ...state, items, machine: { ...state.machine, nextItemId: id + 1 } }
}

function appendTopLevel (state: PromptDialog, item: Omit<PromptDialogItem, 'id'>): PromptDialog {
  const id = state.machine.nextItemId
  return {
    ...state,
    items: [...state.items, { ...item, id } as PromptDialogItem],
    machine: { ...state.machine, nextItemId: id + 1 }
  }
}

function appendContent (state: PromptDialog, item: Omit<PromptDialogItem, 'id'>): PromptDialog {
  const container = state.machine.activeContainer
  if (container === 'row') {
    // Spec: rows can contain inline items only (text, markup, image, button).
    if (item.type === 'row' || item.type === 'button_group') return state
    return appendInRow(state, item)
  }
  if (container === 'button_group') {
    // Spec: groups contain content buttons only.
    if (item.type !== 'button') return state
    return appendInGroup(state, item as Omit<PromptDialogItemButton, 'id'>)
  }
  return appendTopLevel(state, item)
}

function openContainer (state: PromptDialog, kind: 'row' | 'button_group'): PromptDialog {
  if (state.machine.activeContainer !== null) return state // ignore nested
  const id = state.machine.nextItemId
  const container: PromptDialogItem = kind === 'row'
    ? { id, type: 'row', items: [] }
    : { id, type: 'button_group', buttons: [] }
  return {
    ...state,
    items: [...state.items, container],
    machine: { ...state.machine, activeContainer: kind, nextItemId: id + 1 }
  }
}

function closeContainer (state: PromptDialog, kind: 'row' | 'button_group'): PromptDialog {
  if (state.machine.activeContainer !== kind) return state
  return { ...state, machine: { ...state.machine, activeContainer: null } }
}
```

Update the content switch in `reducePrompt` to use `appendContent`, and add row/group handling. The full new `reducePrompt` body (replacing what Task 11 wrote):

```ts
export function reducePrompt (
  state: PromptDialog,
  event: ProtocolEvent,
  opts: ReducerOptions
): PromptDialog {
  switch (event.kind) {
    case 'begin':
      return beginPrompt(state, event.title, opts)
    case 'unknown':
      return state
    case 'show':
      if (state.machine.lifecycle === 'building') {
        return { ...state, open: true, machine: { ...state.machine, lifecycle: 'shown' } }
      }
      return state
    case 'end':
      if (state.machine.lifecycle === 'idle') return state
      return freshIdle({ nextItemId: state.machine.nextItemId })
  }

  const lc = state.machine.lifecycle
  if (lc === 'idle' || lc === 'suppressed') return state

  switch (event.kind) {
    case 'text':
      return appendContent(state, { type: 'text', text: event.text })
    case 'markup':
      return appendContent(state, { type: 'markup', ast: event.ast })
    case 'image':
      return appendContent(state, { type: 'image', path: event.path, alt: event.alt, scale: event.scale })
    case 'button':
      return appendContent(state, { type: 'button', label: event.label, gcode: event.gcode, style: event.style })
    case 'footer_button':
      return appendFooterButton(state, { label: event.label, gcode: event.gcode, style: event.style })
    case 'row_start':
      return openContainer(state, 'row')
    case 'row_end':
      return closeContainer(state, 'row')
    case 'button_group_start':
      return openContainer(state, 'button_group')
    case 'button_group_end':
      return closeContainer(state, 'button_group')
  }

  return state
}
```

Delete the now-unused `appendItem` from Task 11.

- [ ] **Step 4: Run tests; iterate until green**

```bash
corepack pnpm test:unit -- src/util/__tests__/prompt-protocol/reducer.spec.ts
```

Expected: all reducer tests pass (Task 11 + Task 12).

- [ ] **Step 5: Commit**

```bash
git add src/util/prompt-protocol/reducer.ts src/util/__tests__/prompt-protocol/reducer.spec.ts
git commit -s -m "feat(prompt): reducer row + group containers" -m "Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 13: Reducer — targeting, sizing, disconnect, image fallback

**Files:**
- Modify: `src/util/prompt-protocol/reducer.ts`
- Modify: `src/util/__tests__/prompt-protocol/reducer.spec.ts`

- [ ] **Step 1: Append failing tests**

```ts
describe('reducer — targeting', () => {
  it('stash target before begin', () => {
    const state = feed(initialPromptState(),
      { kind: 'target', targets: ['fluidd'] },
      { kind: 'begin', title: 'T' }
    )
    expect(state.machine.lifecycle).toBe('building')
    expect(state.machine.activeTargets).toEqual(['fluidd'])
    expect(state.machine.pendingTargets).toBeNull()
  })

  it('last target wins', () => {
    const state = feed(initialPromptState(),
      { kind: 'target', targets: ['klipperscreen'] },
      { kind: 'target', targets: ['fluidd'] },
      { kind: 'begin', title: 'T' }
    )
    expect(state.machine.activeTargets).toEqual(['fluidd'])
  })

  it('begin matches "all" target', () => {
    const state = feed(initialPromptState(),
      { kind: 'target', targets: ['all'] },
      { kind: 'begin', title: 'T' }
    )
    expect(state.machine.lifecycle).toBe('building')
  })

  it('begin matches frontend category', () => {
    const state = feed(initialPromptState(),
      { kind: 'target', targets: ['web'] },
      { kind: 'begin', title: 'T' }
    )
    expect(state.machine.lifecycle).toBe('building')
  })

  it('begin enters suppressed when no target matches', () => {
    const state = feed(initialPromptState(),
      { kind: 'target', targets: ['klipperscreen'] },
      { kind: 'begin', title: 'T' }
    )
    expect(state.machine.lifecycle).toBe('suppressed')
    expect(state.open).toBe(false)
  })

  it('suppressed ignores content commands and show', () => {
    const state = feed(initialPromptState(),
      { kind: 'target', targets: ['klipperscreen'] },
      { kind: 'begin', title: 'T' },
      { kind: 'text', text: 'never' },
      { kind: 'show' }
    )
    expect(state.items).toEqual([])
    expect(state.open).toBe(false)
    expect(state.machine.lifecycle).toBe('suppressed')
  })

  it('suppressed -> end clears to idle', () => {
    const state = feed(initialPromptState(),
      { kind: 'target', targets: ['klipperscreen'] },
      { kind: 'begin', title: 'T' },
      { kind: 'end' }
    )
    expect(state.machine.lifecycle).toBe('idle')
  })

  it('suppressed -> begin re-evaluates with prior pending', () => {
    const state = feed(initialPromptState(),
      { kind: 'target', targets: ['klipperscreen'] },
      { kind: 'begin', title: 'T1' },
      { kind: 'target', targets: ['fluidd'] },
      { kind: 'begin', title: 'T2' }
    )
    expect(state.machine.lifecycle).toBe('building')
    expect(state.title).toBe('T2')
  })

  it('target during active prompt applies only to next', () => {
    const state = feed(initialPromptState(),
      { kind: 'begin', title: 'T1' },
      { kind: 'target', targets: ['klipperscreen'] }, // applies to T2, not T1
      { kind: 'text', text: 'still visible' }
    )
    expect(state.machine.lifecycle).toBe('building')
    expect(state.items).toHaveLength(1)
    expect(state.machine.pendingTargets).toEqual(['klipperscreen'])
  })
})

describe('reducer — sizing', () => {
  it('default size is normal after begin without pendingSize', () => {
    const state = feed(initialPromptState(), { kind: 'begin', title: 'T' })
    expect(state.size).toBe('normal')
  })

  it('pendingSize consumed at begin', () => {
    const state = feed(initialPromptState(),
      { kind: 'size', size: 'large' },
      { kind: 'begin', title: 'T' }
    )
    expect(state.size).toBe('large')
    expect(state.machine.pendingSize).toBeNull()
  })

  it('last size wins', () => {
    const state = feed(initialPromptState(),
      { kind: 'size', size: 'small' },
      { kind: 'size', size: 'x-large' },
      { kind: 'begin', title: 'T' }
    )
    expect(state.size).toBe('x-large')
  })

  it('size during active prompt applies only to next', () => {
    const state = feed(initialPromptState(),
      { kind: 'begin', title: 'T1' },
      { kind: 'size', size: 'large' }
    )
    expect(state.size).toBe('normal')
    expect(state.machine.pendingSize).toBe('large')
  })
})

describe('reducer — disconnect', () => {
  it('clears building state', () => {
    const state = feed(initialPromptState(),
      { kind: 'begin', title: 'T' },
      { kind: 'text', text: 'x' },
      { kind: 'disconnect' }
    )
    expect(state.machine.lifecycle).toBe('idle')
    expect(state.items).toEqual([])
    expect(state.open).toBe(false)
  })

  it('clears shown state and closes dialog', () => {
    const state = feed(initialPromptState(),
      { kind: 'begin', title: 'T' },
      { kind: 'show' },
      { kind: 'disconnect' }
    )
    expect(state.open).toBe(false)
    expect(state.machine.lifecycle).toBe('idle')
  })

  it('idle disconnect is a no-op', () => {
    const state = reducePrompt(initialPromptState(), { kind: 'disconnect' }, OPTS)
    expect(state).toEqual(initialPromptState())
  })

  it('clears suppressed state', () => {
    const state = feed(initialPromptState(),
      { kind: 'target', targets: ['klipperscreen'] },
      { kind: 'begin', title: 'T' },
      { kind: 'disconnect' }
    )
    expect(state.machine.lifecycle).toBe('idle')
  })
})

describe('reducer — image fallback', () => {
  it('invalid path becomes text item using alt', () => {
    const state = feed(initialPromptState(),
      { kind: 'begin', title: 'T' },
      { kind: 'image', path: 'config/../etc/passwd', alt: 'fallback', scale: null }
    )
    expect(state.items).toEqual([{ id: 0, type: 'text', text: 'fallback' }])
  })

  it('invalid path with empty alt is dropped', () => {
    const state = feed(initialPromptState(),
      { kind: 'begin', title: 'T' },
      { kind: 'image', path: 'http://evil.example/x.png', alt: '', scale: null }
    )
    expect(state.items).toEqual([])
  })

  it('valid path passes through', () => {
    const state = feed(initialPromptState(),
      { kind: 'begin', title: 'T' },
      { kind: 'image', path: 'config/spool.svg', alt: 'spool', scale: 0.5 }
    )
    expect(state.items).toEqual([
      { id: 0, type: 'image', path: 'config/spool.svg', alt: 'spool', scale: 0.5 }
    ])
  })
})

describe('reducer — replay edge cases', () => {
  function feedAll (events: ProtocolEvent[]): PromptDialog {
    return feed(initialPromptState(), ...events)
  }

  it('begin without end then show -> shown', () => {
    const state = feedAll([
      { kind: 'begin', title: 'T' },
      { kind: 'text', text: 'x' },
      { kind: 'show' }
    ])
    expect(state.open).toBe(true)
  })

  it('begin/begin replacement preserves nothing of first', () => {
    const state = feedAll([
      { kind: 'begin', title: 'T1' },
      { kind: 'text', text: 'first' },
      { kind: 'begin', title: 'T2' }
    ])
    expect(state.title).toBe('T2')
    expect(state.items).toEqual([])
  })

  it('end after suppressed restores idle', () => {
    const state = feedAll([
      { kind: 'target', targets: ['klipperscreen'] },
      { kind: 'begin', title: 'T' },
      { kind: 'end' }
    ])
    expect(state.machine.lifecycle).toBe('idle')
  })
})
```

- [ ] **Step 2: Run tests; observe failures**

```bash
corepack pnpm test:unit -- src/util/__tests__/prompt-protocol/reducer.spec.ts
```

Expected: new tests FAIL.

- [ ] **Step 3: Extend reducer with target/size/disconnect handling and image validation**

Import the path validator at the top:

```ts
import { isValidImagePath } from './image-path'
```

Add `target`, `size`, and `disconnect` to the top switch in `reducePrompt`. Replace the existing top switch with this expanded version (preserving the body below it from Task 12):

```ts
export function reducePrompt (
  state: PromptDialog,
  event: ProtocolEvent,
  opts: ReducerOptions
): PromptDialog {
  switch (event.kind) {
    case 'target':
      return { ...state, machine: { ...state.machine, pendingTargets: event.targets } }
    case 'size':
      return { ...state, machine: { ...state.machine, pendingSize: event.size } }
    case 'disconnect':
      if (state.machine.lifecycle === 'idle') return state
      return freshIdle({ nextItemId: state.machine.nextItemId })
    case 'begin':
      return beginPrompt(state, event.title, opts)
    case 'unknown':
      return state
    case 'show':
      if (state.machine.lifecycle === 'building') {
        return { ...state, open: true, machine: { ...state.machine, lifecycle: 'shown' } }
      }
      return state
    case 'end':
      if (state.machine.lifecycle === 'idle') return state
      return freshIdle({ nextItemId: state.machine.nextItemId })
  }

  const lc = state.machine.lifecycle
  if (lc === 'idle' || lc === 'suppressed') return state

  switch (event.kind) {
    case 'text':
      return appendContent(state, { type: 'text', text: event.text })
    case 'markup':
      return appendContent(state, { type: 'markup', ast: event.ast })
    case 'image': {
      if (isValidImagePath(event.path)) {
        return appendContent(state, { type: 'image', path: event.path, alt: event.alt, scale: event.scale })
      }
      // Fallback: invalid path → text item using alt, or drop if alt is empty.
      if (event.alt.length === 0) return state
      return appendContent(state, { type: 'text', text: event.alt })
    }
    case 'button':
      return appendContent(state, { type: 'button', label: event.label, gcode: event.gcode, style: event.style })
    case 'footer_button':
      return appendFooterButton(state, { label: event.label, gcode: event.gcode, style: event.style })
    case 'row_start':
      return openContainer(state, 'row')
    case 'row_end':
      return closeContainer(state, 'row')
    case 'button_group_start':
      return openContainer(state, 'button_group')
    case 'button_group_end':
      return closeContainer(state, 'button_group')
  }

  return state
}
```

- [ ] **Step 4: Run tests; iterate until green**

```bash
corepack pnpm test:unit -- src/util/__tests__/prompt-protocol/reducer.spec.ts
```

Expected: all reducer tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/util/prompt-protocol/reducer.ts src/util/__tests__/prompt-protocol/reducer.spec.ts
git commit -s -m "feat(prompt): reducer targeting + sizing + disconnect" -m "Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 14: Barrel export

**Files:**
- Create: `src/util/prompt-protocol/index.ts`

- [ ] **Step 1: Write the file**

```ts
// src/util/prompt-protocol/index.ts
export { parseAction } from './parse-action'
export type { ProtocolEvent } from './parse-action'
export { reducePrompt, initialPromptState } from './reducer'
export type { ReducerOptions } from './reducer'
export { isValidImagePath, parseImageScale } from './image-path'
export { parseMarkup, toPlainText as promptMarkupToPlainText } from './markup'
export { normalizeStyle, isPromptStyle } from './style'
export { parseButtonFields } from './button'
export type * from './types'
```

- [ ] **Step 2: Type-check**

```bash
corepack pnpm type-check 2>&1 | tail -20
```

Expected: errors remain in `actions.ts`/dialog (fixed in Task 17+). Protocol module + Vuex state/mutations clean.

- [ ] **Step 3: Commit**

```bash
git add src/util/prompt-protocol/index.ts
git commit -s -m "feat(prompt): barrel export" -m "Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 15: Vendor protocol fixtures

**Files:**
- Create: `tests/fixtures/prompt-protocol/fixtures.json` (copied)
- Create: `tests/fixtures/prompt-protocol/PROVENANCE.md`

- [ ] **Step 1: Download the latest fixtures**

Run from the repo root:

```bash
mkdir -p tests/fixtures/prompt-protocol
curl -fsSL https://raw.githubusercontent.com/mrmees/klipper-macro-prompt-protocol/main/fixtures/fixtures.json -o tests/fixtures/prompt-protocol/fixtures.json
```

Expected: file present, valid JSON. Sanity check:

```bash
node -e "console.log(Object.keys(JSON.parse(require('fs').readFileSync('tests/fixtures/prompt-protocol/fixtures.json','utf8'))))"
```

Expected output: includes `schema_version`, `protocol`, `event_prefix`, `fixtures`.

- [ ] **Step 2: Capture the source commit SHA**

```bash
curl -fsSL https://api.github.com/repos/mrmees/klipper-macro-prompt-protocol/commits/main 2>/dev/null | grep -m1 '"sha"' | sed 's/.*"sha": "\(.*\)",/\1/'
```

Record the SHA for use in PROVENANCE.md below.

- [ ] **Step 3: Write PROVENANCE.md**

```markdown
<!-- tests/fixtures/prompt-protocol/PROVENANCE.md -->
# Provenance — Klipper Macro Prompt Protocol fixtures

**Source:** https://github.com/mrmees/klipper-macro-prompt-protocol
**File:** `fixtures/fixtures.json`
**Vendored:** 2026-05-28
**Source commit SHA:** `<paste sha from step 2>`

## Why this is vendored, not consumed live

Tests must be deterministic and runnable offline. We copy the protocol's
fixture corpus at design time and bump on protocol-repo updates.

## Update procedure

When the protocol repo's `fixtures/fixtures.json` changes:

1. Re-run the curl command from `tasks/macro-prompt-protocol-v1-plan.md` Task 15 step 1.
2. Update the SHA in this file (step 2 of that task).
3. Re-run `corepack pnpm test:unit -- prompt-protocol` and fix any regressions.
4. Commit with `chore(prompt): bump fixtures to <short-sha>`.

If a regression reveals a genuine Fluidd impl gap, file a follow-up task in
the active plan rather than masking the failure.
```

- [ ] **Step 4: Commit**

```bash
git add tests/fixtures/prompt-protocol/
git commit -s -m "test(prompt): vendor protocol fixtures" -m "Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 16: Fixtures conformance test

**Files:**
- Create: `src/util/__tests__/prompt-protocol/_fixture-helpers.ts`
- Create: `src/util/__tests__/prompt-protocol/fixtures.spec.ts`

- [ ] **Step 1: Add the JSON import shim if missing**

Check whether vitest/Vite is configured to import JSON. Most setups support it natively; if not, the test will error and you'll need to add a JSON-import config. Try without first.

- [ ] **Step 2: Write helpers**

```ts
// src/util/__tests__/prompt-protocol/_fixture-helpers.ts
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
      return { type: 'markup', plain_text: promptMarkupToPlainText(item.ast) }
    case 'image':
      return { type: 'image', path: item.path, alt: item.alt, scale: item.scale }
    case 'button':
      return { type: 'button', label: item.label, gcode: item.gcode, style: item.style }
    case 'row':
      return { type: 'row', children: item.items.map(toComparableItem) }
    case 'button_group':
      return { type: 'button_group', children: item.buttons.map(b => toComparableItem(b as PromptDialogItemButton)) }
  }
}
```

- [ ] **Step 3: Write the runner**

```ts
// src/util/__tests__/prompt-protocol/fixtures.spec.ts
import doc from '../../../../tests/fixtures/prompt-protocol/fixtures.json'
import { initialPromptState, parseAction, reducePrompt } from '@/util/prompt-protocol'
import { REDUCER_OPTS, canRun, toComparable } from './_fixture-helpers'

const fixtures = (doc as any).fixtures as Array<{
  id: string
  level: 'core' | 'optional'
  description?: string
  events: string[]
  expected?: any
  expected_by_frontend?: { [frontend: string]: any }
}>

describe.each(fixtures.filter(canRun))('fixture: $id ($level)', (fixture) => {
  it('produces expected state', () => {
    let state = initialPromptState()
    for (const line of fixture.events) {
      const event = parseAction(line)
      if (event) state = reducePrompt(state, event, REDUCER_OPTS)
    }
    const expected = fixture.expected_by_frontend?.fluidd ?? fixture.expected
    if (!expected) throw new Error(`fixture ${fixture.id} has no expected state`)
    expect(toComparable(state)).toMatchObject(expected)
  })
})
```

- [ ] **Step 4: Run the fixture runner**

```bash
corepack pnpm test:unit -- src/util/__tests__/prompt-protocol/fixtures.spec.ts
```

Expected: most pass. Some may fail. For each failure:

- Read the fixture's `events` and `expected`.
- Trace through the reducer in your head OR add a `console.log(state)` mid-fixture.
- Decide: is our impl wrong, or is the fixture expecting behavior we don't implement (and is the extension we don't cover)?
- If impl wrong: fix the impl, NOT the fixture.
- If fixture expects unimplemented behavior: add it to `canRun`'s skip list with a brief comment. We aim for zero skips, but a documented skip is better than a hidden bug.

- [ ] **Step 5: Commit**

```bash
git add src/util/__tests__/prompt-protocol/_fixture-helpers.ts src/util/__tests__/prompt-protocol/fixtures.spec.ts
git commit -s -m "test(prompt): fixtures conformance runner" -m "Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 17: Refactor console actions as parser shim

**Files:**
- Modify: `src/store/console/actions.ts`

The current `onUpdatePromptDialog` becomes a thin wrapper around the reducer. The raw line must be preserved BEFORE DOMPurify runs.

- [ ] **Step 1: Read current state and plan the edits**

```bash
cat src/store/console/actions.ts
```

Confirm the structure (the existing implementation is in your context — see design §11 bug #1).

- [ ] **Step 2: Replace `onAddConsoleEntry` and `onUpdatePromptDialog`**

Replace those two action handlers with:

```ts
import { parseAction, reducePrompt, initialPromptState } from '@/util/prompt-protocol'
import type { ProtocolEvent } from '@/util/prompt-protocol'

const REDUCER_OPTS = { frontendId: 'fluidd', frontendCategories: ['web'] }

  async onAddConsoleEntry ({ commit, dispatch }, payload: Omit<ConsoleEntry, 'id'>) {
    const rawMessage = payload.message
    const sanitized = DOMPurify.sanitize(rawMessage).replace(/\r\n|\r|\n/g, '<br />')
    if (!payload.time || payload.time <= 0) {
      payload.time = Date.now() / 1000 | 0
    }
    if (!payload.type) {
      payload.type = 'response'
    }
    if (payload.type === 'response' && rawMessage.startsWith('// action:')) {
      payload.type = 'action'
    }

    commit('setConsoleEntry', { ...payload, message: sanitized })

    // Hand RAW (unsanitized) line to the prompt parser; sanitization corrupts markup entities.
    dispatch('onUpdatePromptDialog', { rawMessage })
  },

  async onUpdatePromptDialog ({ state, commit }, payload: { rawMessage: string }) {
    const event = parseAction(payload.rawMessage)
    if (!event) return
    const next = reducePrompt(state.promptDialog, event, REDUCER_OPTS)
    commit('setPromptDialog', next)
  },
```

- [ ] **Step 3: Replace `onGcodeStore` prompt-replay logic**

Within `onGcodeStore`, the existing block that filters/splices `dialogEntries`/`dialogEntriesAfterEnd`/`dialogEntriesAfterBegin` and dispatches them must be replaced. New logic: collect every `action:prompt_*` raw line in order, run them through the reducer in one pass, commit the final state.

Replace the existing `gcode_store` reduction block with:

```ts
    if (payload && payload.gcode_store) {
      const entries = payload.gcode_store.map((entry, index): ConsoleEntry => {
        const rawMessage = Globals.CONSOLE_RECEIVE_PREFIX + entry.message
        const message = DOMPurify.sanitize(rawMessage).replace(/\r\n|\r|\n/g, '<br />')
        const type = (
          entry.type === 'response' &&
          entry.message.startsWith('// action:')
        ) ? 'action' : entry.type
        return { ...entry, id: index, message, type }
      })

      commit('setAllEntries', entries)

      // Replay all action:prompt_* events through the reducer in one pass.
      let promptState = initialPromptState()
      for (let i = 0; i < payload.gcode_store.length; i++) {
        const raw = Globals.CONSOLE_RECEIVE_PREFIX + payload.gcode_store[i].message
        if (!raw.includes('action:prompt_')) continue
        const event: ProtocolEvent | null = parseAction(raw)
        if (event) promptState = reducePrompt(promptState, event, REDUCER_OPTS)
      }
      commit('setPromptDialog', promptState)
    }
```

(The post-bootstrap conditional disconnect for the reconnect case lives in Task 18.)

- [ ] **Step 4: Replace `reset` to also clear prompt via disconnect**

```ts
  async reset ({ commit, state }) {
    if (state.promptDialog.machine.lifecycle !== 'idle') {
      commit('setPromptDialog', reducePrompt(state.promptDialog, { kind: 'disconnect' }, REDUCER_OPTS))
    }
    commit('setReset')
  },
```

- [ ] **Step 5: Type-check + run tests**

```bash
corepack pnpm type-check
corepack pnpm test:unit
```

Expected: type-check clean except for ActionCommandPromptDialog.vue (fixed in Task 27). Unit tests still pass.

- [ ] **Step 6: Commit**

```bash
git add src/store/console/actions.ts
git commit -s -m "refactor(console): use protocol reducer" -m "Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 18: Disconnect routing, post-reconnect clear, stale-connection guard

**Files:**
- Possibly modify: `src/store/socket/actions.ts`
- Possibly modify: `src/store/socket/state.ts`
- Possibly modify: `src/store/socket/mutations.ts`
- Possibly modify: `src/store/console/actions.ts`

Three sub-concerns:
1. **Disconnect cleanup** — verify `console` is in the reset module list (so Task 17's `reset` action runs on socket drop).
2. **Post-reconnect clear** (design §9.6) — on reconnect, after `gcode_store` replay restores any active prompt from history, dispatch `disconnect` again so the spec's "must close on disconnect" rule wins.
3. **Stale connection-id guard** (design §9.7) — check whether prompt-related action handlers can receive messages from a stale socket post-disconnect and add a guard if so.

- [ ] **Step 1: Inspect the existing disconnect-cleanup chain**

```bash
grep -n "MODULES_TO_RESET_ON_DROP\|prev === 'ready'\|dispatch.*reset" src/store/socket/actions.ts
```

Expected: find the `connecting` branch (`prev === 'ready'` → dispatches `reset` with a module list).

- [ ] **Step 2: Confirm `console` is in `MODULES_TO_RESET_ON_DROP`**

```bash
grep -n "MODULES_TO_RESET_ON_DROP" src/store/socket/actions.ts
```

If `console` is in the list, no change needed — Task 17's new `reset` action dispatches `disconnect`. If `console` is NOT in the list, add it:

```ts
const MODULES_TO_RESET_ON_DROP = [
  // ... existing modules ...
  'console'
]
```

- [ ] **Step 3: Add `hasBeenReady` flag to socket state**

To distinguish initial page load from reconnect, track whether the socket has ever reached `ready` in this Fluidd session.

Edit `src/store/socket/state.ts` — within `defaultState`, add:

```ts
hasBeenReady: false
```

Add to `SocketState` interface in `src/store/socket/types.ts`:

```ts
hasBeenReady: boolean
```

Add mutation in `src/store/socket/mutations.ts`:

```ts
setHasBeenReady (state, payload: boolean) {
  state.hasBeenReady = payload
}
```

- [ ] **Step 4: Dispatch post-bootstrap clear on reconnect**

In `src/store/socket/actions.ts::onSetStatus`, in the `case 'ready'` branch (if it exists) or in a small post-ready hook, add:

```ts
case 'ready': {
  const wasReady = state.hasBeenReady
  commit('setHasBeenReady', true)
  if (wasReady) {
    // Reconnect (not initial load): close any prompt the replay re-opened, per spec.
    await dispatch('console/clearPromptOnReconnect', undefined, { root: true })
  }
  break
}
```

If the existing `onSetStatus` has no `'ready'` case, add one. (Look for the existing switch on `next` — if `'ready'` already has a side-effect block, append; otherwise create.)

Add the new console action in `src/store/console/actions.ts`:

```ts
  async clearPromptOnReconnect ({ state, commit }) {
    if (state.promptDialog.machine.lifecycle === 'idle') return
    const next = reducePrompt(state.promptDialog, { kind: 'disconnect' }, REDUCER_OPTS)
    commit('setPromptDialog', next)
  },
```

- [ ] **Step 5: Verify stale-connection guard**

Read `src/store/console/actions.ts::onAddConsoleEntry`. Check whether the socket layer drops messages from a stale connection BEFORE they reach this action. If so, no guard needed (typical Fluidd design — `notifications` are accepted only when `acceptNotifications === true`, which is cleared on entering `connecting`).

```bash
grep -n "acceptNotifications" src/store/socket/
```

If a stale message could still reach the prompt parser (no upstream gate), add a guard at the top of `onUpdatePromptDialog`:

```ts
async onUpdatePromptDialog ({ state, commit, rootState }, payload: { rawMessage: string, connectionId?: number | null }) {
  if (payload.connectionId !== undefined && payload.connectionId !== rootState.socket.connectionId) return
  // ... existing body ...
}
```

If the existing dispatch site (`onAddConsoleEntry`) doesn't pass `connectionId`, leave the guard parameterless and **document in this step** that the socket layer's `acceptNotifications` flag covers the race.

- [ ] **Step 6: Type-check + run tests**

```bash
corepack pnpm type-check && corepack pnpm test:unit
```

Expected: all green.

- [ ] **Step 7: Commit**

```bash
git add src/store/socket/ src/store/console/actions.ts
git commit -s -m "fix(socket): clear prompt on reconnect" -m "Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 19: PromptItemText component

**Files:**
- Create: `src/components/common/prompt/PromptItemText.vue`

- [ ] **Step 1: Write the component**

```vue
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
```

- [ ] **Step 2: Type-check**

```bash
corepack pnpm type-check
```

Expected: clean except for the still-pending dialog.

- [ ] **Step 3: Commit**

```bash
git add src/components/common/prompt/PromptItemText.vue
git commit -s -m "feat(prompt): text item component" -m "Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 20: PromptItemButton component

**Files:**
- Create: `src/components/common/prompt/PromptItemButton.vue`

- [ ] **Step 1: Write the component**

```vue
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
```

- [ ] **Step 2: Commit**

```bash
git add src/components/common/prompt/PromptItemButton.vue
git commit -s -m "feat(prompt): button item component" -m "Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 21: PromptItemImage component

**Files:**
- Create: `src/components/common/prompt/PromptItemImage.vue`

- [ ] **Step 1: Write the component**

```vue
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
    const apiUrl = this.$typedState.config.apiUrl
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
```

- [ ] **Step 2: Commit**

```bash
git add src/components/common/prompt/PromptItemImage.vue
git commit -s -m "feat(prompt): image item component" -m "Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 22: PromptMarkupNode recursive renderer

**Files:**
- Create: `src/components/common/prompt/PromptMarkupNode.vue`

This is the recursive AST walker. NO `v-html`. Text nodes interpolate with `{{ }}`.

- [ ] **Step 1: Write the component**

```vue
<template>
  <span :class="nodeClass" :style="nodeStyle">
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

  get nodeStyle (): Record<string, string> | null {
    if (this.node.type !== 'tag') return null
    if (this.node.tag === 'color') return { color: this.node.value }
    if (this.node.tag === 'bgcolor') {
      return {
        'background-color': this.node.value,
        padding: '0 2px',
        'border-radius': '2px'
      }
    }
    return null
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
```

- [ ] **Step 2: Commit**

```bash
git add src/components/common/prompt/PromptMarkupNode.vue
git commit -s -m "feat(prompt): recursive markup node" -m "Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 23: PromptItemMarkup wrapper

**Files:**
- Create: `src/components/common/prompt/PromptItemMarkup.vue`

- [ ] **Step 1: Write the component**

```vue
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
```

- [ ] **Step 2: Commit**

```bash
git add src/components/common/prompt/PromptItemMarkup.vue
git commit -s -m "feat(prompt): markup item component" -m "Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 24: PromptItemRow component

**Files:**
- Create: `src/components/common/prompt/PromptItemRow.vue`

- [ ] **Step 1: Write the component**

```vue
<template>
  <div class="prompt-item-row d-flex align-center">
    <component
      :is="INLINE_COMPONENTS[inline.type]"
      v-for="inline in item.items"
      :key="inline.id"
      :item="inline"
      @gcode="$emit('gcode', $event)"
    />
  </div>
</template>

<script lang="ts">
import { Component, Prop, Vue } from 'vue-property-decorator'
import type { PromptDialogItemRow } from '@/store/console/types'
import PromptItemText from './PromptItemText.vue'
import PromptItemMarkup from './PromptItemMarkup.vue'
import PromptItemImage from './PromptItemImage.vue'
import PromptItemButton from './PromptItemButton.vue'

const INLINE_COMPONENTS = {
  text: 'PromptItemText',
  markup: 'PromptItemMarkup',
  image: 'PromptItemImage',
  button: 'PromptItemButton'
} as const

@Component({
  components: { PromptItemText, PromptItemMarkup, PromptItemImage, PromptItemButton }
})
export default class PromptItemRow extends Vue {
  @Prop({ type: Object, required: true })
  readonly item!: PromptDialogItemRow

  readonly INLINE_COMPONENTS = INLINE_COMPONENTS
}
</script>

<style scoped>
.prompt-item-row { gap: 8px; margin: 4px 0; }
.prompt-item-row > * { margin: 0; }
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/components/common/prompt/PromptItemRow.vue
git commit -s -m "feat(prompt): row container component" -m "Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 25: PromptButtonGroup component

**Files:**
- Create: `src/components/common/prompt/PromptButtonGroup.vue`

- [ ] **Step 1: Write the component**

```vue
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
```

- [ ] **Step 2: Commit**

```bash
git add src/components/common/prompt/PromptButtonGroup.vue
git commit -s -m "feat(prompt): button group component" -m "Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 26: PromptFooterButton component

**Files:**
- Create: `src/components/common/prompt/PromptFooterButton.vue`

- [ ] **Step 1: Write the component**

```vue
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
```

- [ ] **Step 2: Commit**

```bash
git add src/components/common/prompt/PromptFooterButton.vue
git commit -s -m "feat(prompt): footer button component" -m "Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 27: Refactor ActionCommandPromptDialog.vue

**Files:**
- Modify: `src/components/common/ActionCommandPromptDialog.vue`

- [ ] **Step 1: Replace the file**

```vue
<template>
  <app-dialog
    v-model="open"
    :title="dialog.title"
    :max-width="maxWidth"
    :no-actions="dialog.footerButtons.length === 0"
  >
    <v-card-text>
      <component
        :is="ITEM_COMPONENTS[item.type]"
        v-for="item in dialog.items"
        :key="item.id"
        :item="item"
        @gcode="handleGcode"
      />
    </v-card-text>

    <template #actions>
      <v-spacer />
      <prompt-footer-button
        v-for="button in dialog.footerButtons"
        :key="button.id"
        :button="button"
        @gcode="handleGcode"
      />
    </template>
  </app-dialog>
</template>

<script lang="ts">
import { Component, Mixins } from 'vue-property-decorator'
import StateMixin from '@/mixins/state'
import type { PromptDialog, PromptSize } from '@/store/console/types'
import PromptItemText from './prompt/PromptItemText.vue'
import PromptItemMarkup from './prompt/PromptItemMarkup.vue'
import PromptItemImage from './prompt/PromptItemImage.vue'
import PromptItemButton from './prompt/PromptItemButton.vue'
import PromptItemRow from './prompt/PromptItemRow.vue'
import PromptButtonGroup from './prompt/PromptButtonGroup.vue'
import PromptFooterButton from './prompt/PromptFooterButton.vue'

const SIZE_MAP: Record<PromptSize, number> = {
  small: 400,
  normal: 600,
  large: 800,
  'x-large': 1000
}

const ITEM_COMPONENTS = {
  text: 'PromptItemText',
  markup: 'PromptItemMarkup',
  image: 'PromptItemImage',
  button: 'PromptItemButton',
  row: 'PromptItemRow',
  button_group: 'PromptButtonGroup'
} as const

@Component({
  components: {
    PromptItemText,
    PromptItemMarkup,
    PromptItemImage,
    PromptItemButton,
    PromptItemRow,
    PromptButtonGroup,
    PromptFooterButton
  }
})
export default class ActionCommandPromptDialog extends Mixins(StateMixin) {
  readonly ITEM_COMPONENTS = ITEM_COMPONENTS

  get dialog (): PromptDialog {
    return this.$typedState.console.promptDialog
  }

  get open (): boolean {
    return this.dialog.open
  }

  set open (value: boolean) {
    if (!value) {
      this.sendGcode('RESPOND TYPE=command MSG="action:prompt_end"')
    }
  }

  get maxWidth (): number {
    return SIZE_MAP[this.dialog.size]
  }

  handleGcode (gcode: string) {
    this.sendGcode(gcode)
  }
}
</script>
```

- [ ] **Step 2: Type-check + run unit tests**

```bash
corepack pnpm type-check
corepack pnpm test:unit
```

Expected: type-check clean. Tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/components/common/ActionCommandPromptDialog.vue
git commit -s -m "refactor(prompt): subcomponent dispatch + sizing" -m "Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 28: Component smoke test

**Files:**
- Create: `src/components/__tests__/ActionCommandPromptDialog.spec.ts`

This deliberately breaks Fluidd's "no component tests" convention because v-html prohibition is security-load-bearing.

- [ ] **Step 1: Write the smoke test**

```ts
// src/components/__tests__/ActionCommandPromptDialog.spec.ts
import { mount } from '@vue/test-utils'
import Vue from 'vue'
import Vuetify from 'vuetify'
import Vuex from 'vuex'
import ActionCommandPromptDialog from '@/components/common/ActionCommandPromptDialog.vue'
import { initialPromptState, reducePrompt, parseAction } from '@/util/prompt-protocol'
import type { PromptDialog } from '@/util/prompt-protocol/types'

Vue.use(Vuetify)
Vue.use(Vuex)

const OPTS = { frontendId: 'fluidd', frontendCategories: ['web'] }

function buildPrompt (lines: string[]): PromptDialog {
  let s = initialPromptState()
  for (const line of lines) {
    const ev = parseAction(line)
    if (ev) s = reducePrompt(s, ev, OPTS)
  }
  return s
}

function mountWithState (promptDialog: PromptDialog) {
  const store = new Vuex.Store({
    modules: {
      console: {
        namespaced: false,
        state: () => ({ promptDialog }),
        getters: {}
      },
      config: {
        namespaced: false,
        state: () => ({ apiUrl: 'http://example.local' }),
        getters: {}
      }
    }
  })
  Object.defineProperty(Vue.prototype, '$typedState', { get () { return store.state } })
  return mount(ActionCommandPromptDialog, {
    store,
    stubs: { 'app-dialog': { template: '<div><slot /><slot name="actions" /></div>' }, 'app-btn': { template: '<button><slot /></button>' } },
    methods: { sendGcode: () => {} } as any
  })
}

describe('ActionCommandPromptDialog smoke tests', () => {
  it('renders markup AST without v-html (no raw markup string in DOM)', () => {
    const state = buildPrompt([
      'prompt_begin Title',
      'prompt_markup <b>Bold</b> and <color:#22c55e>green</color>',
      'prompt_show'
    ])
    const wrapper = mountWithState(state)
    const html = wrapper.html()
    // The raw markup MUST NOT appear literally in the DOM.
    expect(html).not.toContain('<b>Bold</b> and <color:#22c55e>green</color>')
    // The rendered text MUST appear.
    expect(wrapper.text()).toContain('Bold')
    expect(wrapper.text()).toContain('green')
  })

  it('falls back to alt text when an image fails to load', async () => {
    const state = buildPrompt([
      'prompt_begin Title',
      'prompt_image config/missing.svg|Alt fallback',
      'prompt_show'
    ])
    const wrapper = mountWithState(state)
    const img = wrapper.find('img')
    expect(img.exists()).toBe(true)
    await img.trigger('error')
    expect(wrapper.text()).toContain('Alt fallback')
    expect(wrapper.find('img').exists()).toBe(false)
  })

  it('emits gcode on button click via the configured gcode (not label)', async () => {
    const state = buildPrompt([
      'prompt_begin Title',
      'prompt_button Press me|_PROMPT_PRESS|primary',
      'prompt_show'
    ])
    const sent: string[] = []
    const store = new Vuex.Store({
      modules: {
        console: { namespaced: false, state: () => ({ promptDialog: state }), getters: {} },
        config: { namespaced: false, state: () => ({ apiUrl: 'http://example.local' }), getters: {} }
      }
    })
    Object.defineProperty(Vue.prototype, '$typedState', { get () { return store.state } })
    const wrapper = mount(ActionCommandPromptDialog, {
      store,
      stubs: { 'app-dialog': { template: '<div><slot /><slot name="actions" /></div>' }, 'app-btn': { template: '<button><slot /></button>' } },
      methods: { sendGcode: (g: string) => sent.push(g) } as any
    })
    await wrapper.find('.v-btn').trigger('click')
    expect(sent).toContain('_PROMPT_PRESS')
    expect(sent).not.toContain('Press me')
  })
})
```

- [ ] **Step 2: Run the smoke test; iterate**

```bash
corepack pnpm test:unit -- src/components/__tests__/ActionCommandPromptDialog.spec.ts
```

Iteration likely needed on stubs/mount config. The principle: the assertions must pass; the harness around them can be tweaked. If a stub interferes with the underlying behavior the assertion needs (e.g., `app-dialog` swallowing the slot content), inline more of the real markup.

- [ ] **Step 3: Commit**

```bash
git add src/components/__tests__/ActionCommandPromptDialog.spec.ts
git commit -s -m "test(prompt): dialog smoke assertions" -m "Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>"
```

---

## Task 29: Full CI run

**Files:** none.

- [ ] **Step 1: Run the full local CI sequence**

```bash
corepack pnpm lint --no-fix && corepack pnpm type-check && corepack pnpm test:unit && corepack pnpm circular-check && corepack pnpm build
```

Expected: every step green.

- [ ] **Step 2: Fix any failures and recommit**

Failures here are individual fixes. Each fix is a separate commit using a `fix` or `chore` conventional prefix. Examples:

```bash
git commit -s -m "fix(prompt): lint warnings in markup parser"
git commit -s -m "fix(prompt): unused import in dialog refactor"
```

- [ ] **Step 3: Confirm clean working tree**

```bash
git status
```

Expected: nothing to commit; working tree clean (modulo the original untracked `.claude/`, `docs/screenshots/`, `public/*.svg` etc. that were never ours to touch).

---

## Task 30: Manual UAT on ender3.local

**Files:** none (validation only).

This task validates against a real Klipper instance. Use the protocol repo's `fixtures/macro-examples.cfg` as starter macros.

- [ ] **Step 1: Start the dev server**

```bash
corepack pnpm dev
```

Expected: Vite serves on `http://localhost:8080` (or similar — note the URL).

- [ ] **Step 2: Connect to ender3.local in browser**

Open `http://localhost:8080` and connect to `ender3.local` via the Fluidd connection setup.

- [ ] **Step 3: Install `macro-examples.cfg` on the printer**

Copy `https://github.com/mrmees/klipper-macro-prompt-protocol/blob/main/fixtures/macro-examples.cfg` into the printer's `printer.cfg` includes. Restart Klipper.

- [ ] **Step 4: Walk through each test macro**

For each macro defined in `macro-examples.cfg`, run it from the Fluidd console and observe:

- Dialog renders with the expected items
- Markup formatting visible (bold, italic, colors, sizes)
- Images load (or alt text shows on failure)
- Rows lay out horizontally
- Button groups visually grouped
- `prompt_size` changes dialog max-width
- Footer buttons in actions bar
- Click → gcode dispatched (visible in console)
- Closing dialog sends `action:prompt_end`

- [ ] **Step 5: Force a Moonraker disconnect mid-prompt**

Show a prompt, then power-cycle the network (or stop Moonraker briefly via the printer's host). Confirm the dialog closes on disconnect and does NOT reappear on reconnect from the `gcode_store` replay.

- [ ] **Step 6: Record findings**

If any UAT step fails, file a follow-up task in this plan (or a separate fix-up plan) and address before considering the feature complete.

- [ ] **Step 7: Final commit if any fixes were applied**

Each fix-up commits separately with `fix(prompt): <issue>`.

---

## Post-implementation follow-ups (deferred — not part of this plan)

Documented for visibility; address after the implementation lands:

- Add `prompt_size` extension prose to `mrmees/klipper-macro-prompt-protocol/SPEC.md`.
- Add `prompt_size` fixture cases to the protocol repo's `fixtures/fixtures.json`.
- Post in the cross-project discussion issue once the reference impl is verified.
- Decide if/when to promote this branch toward upstream Fluidd (PR #1786 status dependent).

---

**End of plan. 30 tasks. ~30 commits. Begin with Task 1.**
