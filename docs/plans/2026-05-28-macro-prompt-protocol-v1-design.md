# Klipper Macro Prompt Protocol v1 — Fluidd Reference Implementation

**Status:** Design locked, ready for implementation plan.
**Author:** Matthew Mees (with Claude + Codex consults).
**Date:** 2026-05-28.
**Related:** [`mrmees/klipper-macro-prompt-protocol`](https://github.com/mrmees/klipper-macro-prompt-protocol) (SPEC.md v1 draft).

---

## 1. Purpose

Bring Fluidd into full compliance with the draft Klipper Macro Prompt Protocol v1, serving as the **reference implementation** for cross-frontend discussion. Implement core + all optional extensions (`prompt_target`, `prompt_image`, `prompt_markup`, `prompt_row_*`, `prompt_button_group_*`, plus a new `prompt_size` extension introduced here).

Today's Fluidd impl is ~130 lines (parser in `src/store/console/actions.ts::onUpdatePromptDialog`, dialog in `src/components/common/ActionCommandPromptDialog.vue`). It supports 6 of 14 core/optional commands and has four spec-conformance bugs flagged during this design (see §11).

## 2. Strategic posture

This work targets `mrmees/fluidd` as a **reference implementation**. Goal: serve as the working artifact in the cross-project discussion ("here's it working") without forcing the upstream maintainer's hand.

- No upstream PR until cross-maintainer agreement on the spec exists.
- Fork lives on a long-lived branch off `develop`.
- Can be promoted to a core-only PR (or full PR) later if upstream signals interest.

## 3. New spec extension: `prompt_size`

Authored alongside this implementation. To be added to `mrmees/klipper-macro-prompt-protocol/SPEC.md` under "Optional v1 Extensions".

### 3.1 Syntax

```text
prompt_size <size>
```

Where `<size>` ∈ `small | normal | large | x-large`. Case-insensitive on parse; invalid values (including missing argument, empty string, or unknown token) normalize to `normal`.

### 3.2 Semantics

- **Optional v1 extension.** Unsupported frontends ignore the command; prompt still renders at the frontend's default size.
- **Consumed at next `prompt_begin`** — applies as per-prompt metadata, like `prompt_target`. Last-wins if multiple `prompt_size` arrive before a `begin`.
- **Default if omitted:** `normal`.
- **Best-effort envelope hint.** Frontends MAY clamp or ignore based on viewport, kiosk mode, touchscreen constraints, or user accessibility preferences. KlipperScreen (GTK) is expected to no-op this command since its dialogs have fixed sizing.
- **During active prompt:** applies only to the *next* prompt, not the current one (mirrors `prompt_target` lifecycle).
- **Pre-render application:** the resolved size affects the *initial* presentation of the prompt, not a mid-stream resize.
- **Vocabulary note (spec prose):** `prompt_size` controls the **dialog envelope** size. PromptMarkup `<size:...>` controls **text** size. The vocabulary overlap is intentional (shared semantic ladder); the two operate on different layers.

### 3.3 Fluidd mapping

| Size | `max-width` (px) |
|---|---|
| `small` | 400 |
| `normal` | 600 (default) |
| `large` | 800 |
| `x-large` | 1000 |

Mobile viewport constrains the dialog naturally; Vuetify's responsive behavior handles screens smaller than these caps without configuration.

## 4. Architecture

```
                  ┌─────────────────────────────────────┐
   Moonraker      │  src/store/console/actions.ts       │
   action lines   │  onAddConsoleEntry                  │
   (raw,          │    raw line: → onUpdatePromptDialog │
   pre-sanitize)──┤    sanitized:  → setConsoleEntry    │
                  │         │                           │
                  │         ▼                           │
                  │  src/util/prompt-protocol/          │
                  │    parseAction(line) → event        │
                  │    reducePrompt(state, event, opts) │
                  │         │                           │
                  │         ▼                           │
                  │  console/actions.ts                 │
                  │    commit('setPromptDialog', state) │
                  └─────────────────┬───────────────────┘
                                    │ Vuex state
                                    ▼
                  ┌─────────────────────────────────────┐
                  │  components/common/                 │
                  │   ActionCommandPromptDialog.vue     │
                  │     <component :is> dispatch        │
                  │       ├ PromptItemText              │
                  │       ├ PromptItemMarkup            │
                  │       │   └ PromptMarkupNode (rec.) │
                  │       ├ PromptItemImage             │
                  │       ├ PromptItemButton            │
                  │       ├ PromptItemRow               │
                  │       ├ PromptButtonGroup           │
                  │       └ PromptFooterButton          │
                  └─────────────────────────────────────┘
```

### 4.1 Key architectural choices

1. **Pure parser/reducer module** under `src/util/prompt-protocol/` — small, testable, framework-free. Mirrors `src/util/nav-link.ts` conventions.
2. **Vuex remains state owner.** Reducer is pure: returns fully-shaped state; one mutation replaces the whole `PromptDialog` object.
3. **Raw line to parser, sanitized line to console.** Today's bug: `onAddConsoleEntry` overwrites `payload.message` with the sanitized version, then hands it to the prompt parser. Fix: preserve raw, sanitize a copy for console, hand raw to parser.
4. **AST-driven markup rendering, no `v-html` on macro content.** Markup is parsed to `MarkupNode[]` at the reducer; rendered by recursive Vue components. Inline `style` only for color/bgcolor (hex-validated). Class-based for size.
5. **Subcomponent-per-item-type rendering** via `<component :is>` lookup. Dialog is a dumb container.
6. **No singleton state in the util module.** Container tracking lives in Vuex `PromptDialog.machine.activeContainer`.
7. **Replay via reducer.** `onGcodeStore` feeds the full `action:prompt_*` event stream since the last `prompt_end` through `parseAction` + `reducePrompt`. No more ad-hoc slicing.

## 5. Data model

Lives in `src/store/console/types.ts` (replacing the current `PromptDialog` shape).

```ts
type PromptLifecycle = 'idle' | 'building' | 'shown' | 'suppressed'

type PromptStyle = 'primary' | 'secondary' | 'info' | 'warning' | 'error' | 'success'

type PromptSize = 'small' | 'normal' | 'large' | 'x-large'

interface PromptDialog {
  // Renderer-facing
  open: boolean
  title: string
  size: PromptSize                 // drives dialog max-width
  items: PromptDialogItem[]
  footerButtons: PromptDialogFooterButton[]

  // Reducer state-machine bookkeeping (renderer does not read)
  machine: PromptStateMachine
}

interface PromptStateMachine {
  lifecycle: PromptLifecycle
  activeContainer: 'row' | 'button_group' | null
  activeTargets: string[]
  pendingTargets: string[] | null
  pendingSize: PromptSize | null
  nextItemId: number               // monotonic, for stable Vue keys
}

// Discriminated union — renderer dispatches per `type`
type PromptDialogItem =
  | PromptDialogItemText
  | PromptDialogItemMarkup
  | PromptDialogItemImage
  | PromptDialogItemButton
  | PromptDialogItemRow
  | PromptDialogItemButtonGroup

type PromptDialogInlineItem =
  | PromptDialogItemText
  | PromptDialogItemMarkup
  | PromptDialogItemImage
  | PromptDialogItemButton

interface PromptDialogItemText {
  id: number
  type: 'text'
  text: string
}

interface PromptDialogItemMarkup {
  id: number
  type: 'markup'
  ast: MarkupNode[]                // pre-parsed at reducer; never raw string
}

interface PromptDialogItemImage {
  id: number
  type: 'image'
  path: string                     // validated config/... path
  alt: string                      // empty string if not provided
  scale: number | null             // null = no hint
}

interface PromptDialogItemButton {
  id: number
  type: 'button'
  label: string                    // non-empty (empty-label dropped at parse)
  gcode: string                    // pre-defaulted to label if omitted
  style: PromptStyle               // normalized, unknowns → 'secondary'
}

interface PromptDialogItemRow {
  id: number
  type: 'row'
  items: PromptDialogInlineItem[]  // nested rows/groups disallowed by typing
}

interface PromptDialogItemButtonGroup {
  id: number
  type: 'button_group'
  buttons: PromptDialogItemButton[]
}

interface PromptDialogFooterButton {
  id: number
  label: string
  gcode: string
  style: PromptStyle
}

// Markup AST — semantic, never raw HTML strings
type MarkupNode =
  | { type: 'text'; text: string }
  | { type: 'tag'; tag: 'b' | 'i' | 'u'; children: MarkupNode[] }
  | { type: 'tag'; tag: 'color' | 'bgcolor'; value: string; children: MarkupNode[] }
  | { type: 'tag'; tag: 'size'; value: 'small' | 'normal' | 'large' | 'x-large'; children: MarkupNode[] }
```

### 5.1 Data model rationale

- **`PromptLifecycle` 4-state enum** — encodes spec rules (content-before-begin ignored, repeated-show no-op, target-suppression) without scattering booleans through the reducer.
- **`activeTargets` vs. `pendingTargets`** — explicit modeling of "target applies to next begin, consumed there." `pendingTargets` is the inbox; `activeTargets` is what the current prompt is targeting.
- **`pendingSize` mirrors targets** — same lifecycle semantics for the new `prompt_size` extension.
- **Markup pre-parsed to AST** — single source of truth; renderer never sees raw markup; guarantees the no-v-html rule structurally. `toPlainText(ast)` helper derives plain-text on demand (used for accessibility fallback and fixture comparison).
- **Row items typed to `PromptDialogInlineItem[]`** — nested rows/groups become a compile error rather than a runtime bug.
- **Button group contains `PromptDialogItemButton[]`** — group-of-footer-buttons is unrepresentable.
- **`id: number` on every item** — assigned by reducer from monotonic `machine.nextItemId`. Used as Vue `:key` for stable diffing during live appends.
- **Sub-object grouping (`machine`)** — matches Fluidd's existing convention (e.g. `AfcState.dialog`, `MmuState.dialog`). Semantic boundary without introducing underscore-prefix or other foreign conventions.

## 6. Parser API

Lives in `src/util/prompt-protocol/`. Pure TypeScript, no Vuex/Vue imports.

### 6.1 File layout

```
src/util/prompt-protocol/
  types.ts            # Public types
  parse-action.ts     # Line → ProtocolEvent
  button.ts           # label|gcode|style field parser
  image-path.ts       # config/... path validator + scale parser
  markup.ts           # PromptMarkup → MarkupNode[] + toPlainText
  style.ts            # PromptStyle normalizer + type guard
  reducer.ts          # (state, event, opts) → newState
  index.ts            # Barrel export
```

### 6.2 ProtocolEvent

```ts
type ProtocolEvent =
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
  | { kind: 'disconnect' }            // synthesized from socket layer
  | { kind: 'unknown'; command: string }
```

### 6.3 Public functions

```ts
// Line tokenizer. Accepts:
//   "// action:prompt_text Hello"   (console-prefixed)
//   "action:prompt_text Hello"      (bare action)
//   "prompt_text Hello"             (stripped)
// Canonicalization is explicit: strip optional "// action:" or "action:",
// then parse as "prompt_*". Returns null if not a prompt action line.
function parseAction(rawLine: string): ProtocolEvent | null

// Field parsers
function parseButtonFields(param: string): ParsedButton | null  // null = empty label
function isValidImagePath(path: string): boolean
function parseImageScale(s: string | undefined): number | null
function parseMarkup(input: string): MarkupNode[]
function toPlainText(ast: MarkupNode[]): string
function normalizeStyle(input: string | undefined): PromptStyle
function isPromptStyle(value: string): value is PromptStyle

// State machine
interface ReducerOptions {
  frontendId: string             // e.g. 'fluidd'
  frontendCategories: string[]   // e.g. ['web']
}
function initialPromptState(): PromptDialog
function reducePrompt(
  state: PromptDialog,
  event: ProtocolEvent,
  opts: ReducerOptions
): PromptDialog
```

### 6.4 Barrel export

```ts
// index.ts
export { parseAction } from './parse-action'
export { reducePrompt, initialPromptState } from './reducer'
export { isValidImagePath, parseImageScale } from './image-path'
export { toPlainText as promptMarkupToPlainText } from './markup'
export { normalizeStyle, isPromptStyle } from './style'
export type { ProtocolEvent } from './parse-action'
export type * from './types'
```

### 6.5 No exceptions thrown

Every malformed input maps to a typed result. The Vuex action never needs a try/catch.

### 6.6 No effects array

Reducer signature is `(state, event, opts) => state`. No `effects[]` channel. No spec-mandated side effects justify one; warnings/metrics are derivable from inputs and outputs.

## 7. State machine

Transitions encoded in `reducePrompt`. `state.machine.lifecycle` drives the rules.

| Current lifecycle | Event | Result |
|---|---|---|
| any | `target` | Stash in `pendingTargets`. |
| any | `size` | Stash in `pendingSize`. |
| any | `disconnect` | Clear → `idle`, `open: false`. |
| `idle` | `begin` | Consume `pendingTargets` → target match? → `building` or `suppressed`. Consume `pendingSize` or default to `normal`. Set title. |
| `idle` | content (text/markup/image/button/etc.) | Ignored. |
| `idle` | `show`, `end` | No-op. |
| `building` | content commands | Append to current container (`items` or open row/group). |
| `building` | `row_start` / `button_group_start` | Open container; further content routes into it. |
| `building` | `row_end` / `button_group_end` | Close container. |
| `building` | `show` | → `shown`, set `open: true`. |
| `building` | `begin` | Restart (equivalent to `end` + `begin`). |
| `building` | `end` | Clear → `idle`. |
| `shown` | content commands | Append live (per spec: live appends after show). |
| `shown` | `show` | No-op. |
| `shown` | `begin` | Restart. |
| `shown` | `end` | Clear → `idle`, `open: false`. |
| `suppressed` | content / show / row_start / group_start | Ignored. |
| `suppressed` | `begin` | Re-evaluate target match → `building` or `suppressed`. |
| `suppressed` | `end` | Clear → `idle`. |
| any | `unknown` | No-op (spec: degrade gracefully on unknown commands). |

### 7.1 Container management

- Nested rows or groups disallowed by spec. If `row_start` arrives inside an open row (or group inside group, or row-in-group, or group-in-row), the inner command is ignored; content commands continue to route to the valid outer container.
- An unclosed container at `prompt_end` (or restart via new `prompt_begin`) is implicitly closed.

### 7.2 Footer buttons

- Footer buttons are NEVER inside rows or groups. They route directly to `footerButtons[]` regardless of `activeContainer`.
- Footer button styles default to `secondary` (per spec). Today's Fluidd defaults to `primary` — this is a spec deviation to be fixed.

### 7.3 Target match logic

Frontend matches an `activeTargets[]` list if any of the following is true:
- The list contains `'all'`
- The list contains `frontendId` (e.g. `'fluidd'`)
- The list contains any element of `frontendCategories` (e.g. `'web'`)

Case-insensitive comparison; targets trimmed on parse.

### 7.4 Image fallback at reducer

Invalid `prompt_image` paths (per spec validation rules) become text items at the reducer:
```
{ id, type: 'text', text: <alt-text> }
```
If alt is empty, the image is dropped entirely. Renderer is dumb about this; reducer owns the fallback policy. (Renderer still handles load-time failures via `<img @error>`.)

## 8. UI rendering

### 8.1 File layout

```
src/components/common/ActionCommandPromptDialog.vue        # existing, refactored
src/components/common/prompt/
  PromptItemText.vue
  PromptItemMarkup.vue
  PromptMarkupNode.vue                                     # recursive
  PromptItemImage.vue
  PromptItemButton.vue
  PromptItemRow.vue
  PromptButtonGroup.vue
  PromptFooterButton.vue
```

### 8.2 Dialog shell

```vue
<app-dialog
  v-model="open"
  :title="dialog.title"
  :max-width="SIZE_MAP[dialog.size]"
  :no-actions="!dialog.footerButtons.length"
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
```

```ts
const SIZE_MAP: Record<PromptSize, number> = {
  small: 400, normal: 600, large: 800, 'x-large': 1000
}

const ITEM_COMPONENTS: Record<PromptDialogItem['type'], string> = {
  text: 'prompt-item-text',
  markup: 'prompt-item-markup',
  image: 'prompt-item-image',
  button: 'prompt-item-button',
  row: 'prompt-item-row',
  button_group: 'prompt-button-group'
}
```

Existing dialog behavior preserved: closing (setting `open = false`) dispatches `RESPOND TYPE=command MSG="action:prompt_end"`.

### 8.3 Markup rendering (recursive component)

`PromptMarkupNode.vue` (self-registered with `name: 'PromptMarkupNode'`):

```vue
<template>
  <span :class="nodeClass" :style="nodeStyle">
    <template v-if="node.type === 'text'">{{ node.text }}</template>
    <prompt-markup-node
      v-for="(child, i) in (node as TagNode).children"
      v-else
      :key="i"
      :node="child"
    />
  </span>
</template>
```

`nodeClass` computed:
- `<b>` → font-weight bold
- `<i>` → font-style italic
- `<u>` → text-decoration underline
- `<size:small>` → `prompt-size-small` (CSS: `font-size: 0.85rem`)
- `<size:normal>` → no class (default)
- `<size:large>` → `prompt-size-large` (`font-size: 1.25rem`)
- `<size:x-large>` → `prompt-size-x-large` (`font-size: 1.5rem`)

`nodeStyle` inline (necessary for dynamic hex):
- `<color:#XXX>` → `{ color: '#XXX' }`
- `<bgcolor:#XXX>` → `{ background-color: '#XXX', padding: '0 2px', border-radius: '2px' }`

NO `v-html` anywhere. Text nodes interpolate with `{{ }}` (auto-escaped).

### 8.4 Image rendering

`PromptItemImage.vue` uses plain `<img>` (not `<v-img>`):

```vue
<template>
  <img
    v-if="!loadFailed"
    :src="imageUrl"
    :alt="item.alt"
    :style="imageStyle"
    @error="loadFailed = true"
  />
  <span v-else-if="item.alt">{{ item.alt }}</span>
</template>
```

URL construction:
```ts
const apiUrl = this.$typedState.config.apiUrl
const encodedPath = item.path.split('/').map(encodeURIComponent).join('/')
const imageUrl = `${apiUrl}/server/files/${encodedPath}`
```

Scale interpretation: advisory multiplier against a 200px base, capped at 100% of dialog content width.

```ts
const DEFAULT_IMAGE_BASE_PX = 200
const imageStyle = {
  width: item.scale != null ? `${DEFAULT_IMAGE_BASE_PX * item.scale}px` : 'auto',
  'max-width': '100%',
  height: 'auto'
}
```

### 8.5 Button rendering

Direct semantic style → Vuetify color mapping (1:1):

```vue
<v-btn :color="item.style" block @click="$emit('gcode', item.gcode)">
  {{ item.label }}
</v-btn>
```

Vuetify 2 has all six theme colors (`primary, secondary, info, warning, error, success`) — no mapping helper needed.

### 8.6 Row layout

Flex container, items inline:

```vue
<div class="prompt-row d-flex align-center" style="gap: 8px;">
  <component
    :is="ITEM_COMPONENTS[item.type]"
    v-for="item in row.items"
    :key="item.id"
    :item="item"
    @gcode="$emit('gcode', $event)"
  />
</div>
```

### 8.7 Button group layout

CSS-grouped flex row (Vuetify 2 has no `<v-btn-group>`):

```vue
<div class="prompt-button-group d-flex">
  <v-btn v-for="btn in group.buttons" :key="btn.id" :color="btn.style" @click="$emit('gcode', btn.gcode)">
    {{ btn.label }}
  </v-btn>
</div>
```

Scoped CSS:
```css
.prompt-button-group .v-btn { border-radius: 0; }
.prompt-button-group .v-btn:first-child { border-top-left-radius: 4px; border-bottom-left-radius: 4px; }
.prompt-button-group .v-btn:last-child { border-top-right-radius: 4px; border-bottom-right-radius: 4px; }
```

### 8.8 Accessibility

- Plain `<img>` carries `alt` directly.
- Markup renders semantic text via `{{ }}` interpolation — screen readers read it naturally. No `aria-label` on the outer markup span (would flatten child semantics).
- `toPlainText(ast)` available for any future needs (e.g. visually-hidden fallback) but not actively used in v1.

### 8.9 Long content & contrast

- `overflow-wrap: anywhere` on text/markup containers to prevent unbroken strings from blowing out the dialog.
- `<bgcolor:#XXX>` runs get small padding + border-radius for readable inline highlights.
- Author-chosen colors are NOT auto-rewritten for contrast. Trust the macro author; if a `<color:#FFFF99>` is unreadable on a dark theme, that's a macro bug.

### 8.10 Live append reactivity

Reducer always returns a fully-shaped `PromptDialog`. One mutation:

```ts
function setPromptDialog(state: ConsoleState, next: PromptDialog) {
  state.promptDialog = next
}
```

Whole-object replace sidesteps every Vue 2 reactivity gotcha — no `Vue.set`, no field-add-after-mount issues. AST objects are NOT frozen (freezing would fight Vue 2's observer); the reducer never mutates them, and the renderer treats them readonly by convention.

## 9. Error handling & security

### 9.1 Trust model

Macros are **user-authored** on their own printer. Not adversarial input in the web-XSS sense, but may include shared community macros where the user trusts the author less than themselves. Klipper → Moonraker → Fluidd transports strings; no path is a sandbox. Button `gcode` is intentionally executed (this is the explicit design — `prompt_button` always means "send this gcode on click").

### 9.2 Security handling matrix

| Concern | Handling |
|---|---|
| Markup XSS | AST-driven Vue rendering, no v-html anywhere. `{{ }}` interpolation only on text nodes. Inline `style` for color/bgcolor (hex-validated at parse). Class-based for size. |
| Image path injection (e.g. `config/../../etc/passwd`) | Reducer rejects via `isValidImagePath` (spec rules: no `..`, no `~`, no `:`, no empty segments, must start `config/`). Rejected paths become text item using alt. |
| URL construction safety | Image src built as `${apiUrl}/server/files/${encodedPath}` where each path segment is `encodeURIComponent`'d (preserves `/` structure, encodes `?`, `#`, `%`, spaces, non-ASCII). |
| Unmatched/nested markup tags | AST parser strips the offending tag, preserves inner text. Recursive for matched siblings. No exceptions thrown. |
| Entity bombs (e.g. `&amp;amp;amp;...`) | Spec: decode once, never reparse. Parser implements single-pass decoding; output is NOT reinterpreted as markup. |
| Invalid color/size values | Tag stripped, inner text preserved (spec rule). |
| Unknown commands | `parseAction` → `{ kind: 'unknown', command }`. Reducer no-ops. |
| Unknown styles | `normalizeStyle` → `'secondary'`. |
| Empty button label | `parseButtonFields` returns null; reducer no-ops. |
| Image load failure (network) | Renderer `<img @error>` falls back to `<span>{{ item.alt }}</span>` or hides if alt empty. |
| Long unbroken text | `overflow-wrap: anywhere` on text/markup containers. |
| SVG safety | Spec mandates SVGs rendered as image assets only. Fluidd uses `<img src="...svg">` — browser image context does not expose SVG DOM or execute event handlers. **Never** `<object>`, `<iframe>`, inline SVG, or `v-html`. |

### 9.3 No resource caps

**Decision:** no caps on markup nesting depth, item count, per-item text length, or image count per prompt.

**Rationale:** Trust model is user-authored macros. Users are expected to know when enough is enough. Caps add complexity, can be hit accidentally by edge cases, and the spec doesn't mandate them.

**Caveat documented in code:** `PromptMarkupNode.vue` adds a brief comment noting "no depth cap by design — if a macro nests this deep, that's a macro bug to fix" so future maintainers see the explicit choice. Practical risk: a deliberately constructed deep-nested markup payload could exhaust the call stack and crash the page. Considered acceptable given trust model.

### 9.4 Logging policy

- `consola.debug` for spec-defined graceful-ignore cases (unknown commands, invalid styles, invalid image paths, empty labels, nesting violations).
- NO `consola.warn` for spec-defined ignores — those aren't warnings, that's the spec.
- `consola.warn` ONLY for implementation invariant violations (e.g. reducer state corruption).

### 9.5 Disconnect handling

- `disconnect` is a `ProtocolEvent` synthesized by the Vuex layer when Moonraker socket leaves `ready`.
- Dispatch site: console module's existing `reset` action, called from `socket/actions.ts::onSetStatus` via `MODULES_TO_RESET_ON_DROP`.
- Reducer behavior: from any non-`idle` state → clear → `idle`, `open: false`.
- One event for all disconnect causes (Moonraker only — Fluidd does not talk directly to Klipper).

### 9.6 Replay (`onGcodeStore`) vs disconnect

Two distinct scenarios:

| Scenario | Behavior |
|---|---|
| **Initial page load** — no disconnect this session | Replay reduces the full `action:prompt_*` event stream from `gcode_store` (starting from the beginning of the stream; the reducer naturally tolerates any prior `prompt_end`s as it transitions back to `idle`). If the stream ends with an unclosed `prompt_show`, the dialog re-opens. The prompt is genuinely live; resurrect from history. |
| **Reconnect after disconnect** — `disconnect` was already dispatched this session | Replay reduces the stream as above, then the bootstrap path explicitly dispatches `{ kind: 'disconnect' }` again to clear anything the replay re-opened. Spec requires disconnect to close active prompts; re-fetching history shouldn't undo that. |

Single source of truth: the disconnect rule lives in one place (post-bootstrap conditional dispatch), not threaded into replay logic.

### 9.7 Race conditions

Vuex actions are serialized on a single event loop; no concurrent execution. Mutations are atomic.

**Possible stale-message race:** a `prompt_begin`/`prompt_show` message in flight from the dying socket could arrive after `disconnect` was dispatched, resurrecting a prompt. Fluidd's socket layer already nulls the connection ID on entering `connecting` (saw at `src/store/socket/actions.ts:166`). Implementation plan will verify whether console action handlers drop stale-connection messages and add a guard if not.

## 10. Testing

### 10.1 Test layout

Vitest + jsdom (Fluidd's existing setup). Mirrors `nav-link.spec.ts` conventions.

```
src/util/__tests__/prompt-protocol/
  parse-action.spec.ts
  button.spec.ts
  image-path.spec.ts
  markup.spec.ts
  style.spec.ts
  reducer.spec.ts
  fixtures.spec.ts            # consumes vendored fixtures.json

src/components/__tests__/
  ActionCommandPromptDialog.spec.ts   # ONE focused smoke test (see 10.5)

tests/fixtures/prompt-protocol/
  fixtures.json               # vendored from protocol repo
  PROVENANCE.md               # source URL, commit SHA, vendoring date, update procedure
```

### 10.2 Fixture vendoring

Copy `fixtures.json` from `mrmees/klipper-macro-prompt-protocol` at design time. Bump on protocol repo updates. `PROVENANCE.md` documents source URL, commit SHA, vendoring date, and update procedure.

### 10.3 Fixtures.spec.ts shape

```ts
import doc from '../../../../tests/fixtures/prompt-protocol/fixtures.json'
import { parseAction, reducePrompt, initialPromptState } from '@/util/prompt-protocol'
import { toComparable, REDUCER_OPTS, canRun } from './_fixture-helpers'  // test-local helpers

describe.each(doc.fixtures.filter(canRun))('fixture: $id ($level)', (fixture) => {
  it('produces expected state', () => {
    let state = initialPromptState()
    for (const line of fixture.events) {
      const event = parseAction(line)
      if (event) state = reducePrompt(state, event, REDUCER_OPTS)
    }
    const expected = fixture.expected_by_frontend?.fluidd ?? fixture.expected
    expect(toComparable(state)).toMatchObject(expected)
  })
})
```

**`canRun`** filters fixtures we don't implement (none currently — we implement all of v1). Skips `fallback_expected` and `legacy_behavior` blocks (those test cross-frontend compat-mode, not v1 conformance).

**`toComparable(state)`** renames TS fields to fixture's snake_case shape:
```ts
function toComparable(state) {
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
```

Markup items emit `{ type: 'markup', plain_text: toPlainText(item.ast) }` — the raw `markup` field is omitted from comparison. AST↔markup-string fidelity is separately tested in `markup.spec.ts` via direct `parseMarkup` calls.

Uses `toMatchObject` for partial-shape matching: tolerant if fixture format adds fields.

### 10.4 Per-module test coverage

- **parse-action.spec.ts** — all three input forms (console-prefixed, bare, stripped), every ProtocolEvent kind, malformed lines → unknown/null.
- **button.spec.ts** — field parsing, defaults (gcode→label, style→secondary), empty-label ignore, pipe handling, whitespace.
- **image-path.spec.ts** — every spec rule (no `..`, no `~`, no `:`, no empty segments, must start `config/`), scale parser (invalid → null).
- **markup.spec.ts** — happy paths, unknown-tag preserves children, malformed `<`/`>` becomes text, `\n` only in markup, `prompt_text` is literal (no tag parsing), `&amp;lt;` decodes once and is not reparsed, invalid closing order, adjacent text around stripped tags, case sensitivity rules, `toPlainText` round-trip.
- **style.spec.ts** — normalizer, case-insensitivity, unknown → secondary, type guard.
- **reducer.spec.ts** — every state machine transition, target consumption + match logic, size consumption, container nesting violations, **replay edge cases**: begin-without-end-then-show, begin/begin replacement, target-during-active-prompt-pending, size-during-active-prompt-pending, end-after-suppressed, disconnect-then-stale-replay.
- **fixtures.spec.ts** — protocol corpus pass-through.

### 10.5 Component smoke test (deliberate convention break)

One `ActionCommandPromptDialog.spec.ts` covering three security-load-bearing assertions:

```ts
describe('ActionCommandPromptDialog', () => {
  it('renders markup AST without v-html', () => {
    // Mount with a markup item, assert no element has innerHTML matching the raw markup string.
  })
  it('falls back to alt text when image load fails', () => {
    // Mount with image item, trigger @error on <img>, assert alt span renders.
  })
  it('emits gcode on button click', () => {
    // Mount with button item, click, assert sendGcode was called with item.gcode.
  })
})
```

**Why this breaks the no-component-tests convention:** v-html prohibition is security-load-bearing. Honor-system enforcement will degrade; CI enforcement won't. Three assertions, one file, ~50 lines.

### 10.6 Coverage targets

No formal threshold (Fluidd has none). Targets:
- Every public function tested
- Every state machine transition exercised
- All protocol fixtures pass
- All markup edge cases pass
- The three component smoke assertions pass

### 10.7 Manual UAT

Per Fluidd convention (and the nav-link PR precedent): manual click-through on `ender3.local`. Use protocol repo's `fixtures/macro-examples.cfg` as a starter macro set. Verify visually: rendering correctness, sizing, drag-target behavior, image scaling, button group visual grouping.

## 11. Pre-existing spec deviations to fix

Discovered during this design review:

1. **DOMPurify-before-parse** (`actions.ts:46`). Current code sanitizes `payload.message` before handing it to `onUpdatePromptDialog`. Wrong for `prompt_markup` (entities must decode exactly once and never be reparsed). Fix: preserve raw message, sanitize a copy for console, hand raw to parser.
2. **`prompt_end` does not clear state.** Current code only flips `setPromptDialogOpen(false)`. Spec requires close AND clear.
3. **`onGcodeStore` replay slices entries after last `prompt_begin`, excluding the begin itself.** Loses title and any consumed `prompt_target` on reload. Fix: replay full `action:prompt_*` stream through reducer.
4. **Footer button default color is `'primary'`.** Spec mandates `secondary` (same as content buttons). Fix in renderer.

## 12. Files touched

### Added

```
src/util/prompt-protocol/
  types.ts
  parse-action.ts
  button.ts
  image-path.ts
  markup.ts
  style.ts
  reducer.ts
  index.ts

src/util/__tests__/prompt-protocol/
  parse-action.spec.ts
  button.spec.ts
  image-path.spec.ts
  markup.spec.ts
  style.spec.ts
  reducer.spec.ts
  fixtures.spec.ts

src/components/common/prompt/
  PromptItemText.vue
  PromptItemMarkup.vue
  PromptMarkupNode.vue
  PromptItemImage.vue
  PromptItemButton.vue
  PromptItemRow.vue
  PromptButtonGroup.vue
  PromptFooterButton.vue

src/components/__tests__/
  ActionCommandPromptDialog.spec.ts

tests/fixtures/prompt-protocol/
  fixtures.json
  PROVENANCE.md
```

### Modified

```
src/store/console/types.ts       # PromptDialog reshape
src/store/console/state.ts       # defaultState fully shaped
src/store/console/mutations.ts   # setPromptDialog single mutation
src/store/console/actions.ts     # thin shim around parser/reducer
src/components/common/ActionCommandPromptDialog.vue   # delegates to subcomponents
src/locales/en.yaml              # any new strings (likely minimal)
```

### Upstream protocol repo (separate change)

```
mrmees/klipper-macro-prompt-protocol/SPEC.md   # prompt_size extension prose
mrmees/klipper-macro-prompt-protocol/fixtures/fixtures.json   # prompt_size fixture cases (optional, Fluidd tests locally without)
```

## 13. Codex consultations

Four adversarial design reviews via `gpt-5.5 --effort high`:

1. **Architecture choice (A/B/C)** — confirmed B (pure parser/reducer module) is the right altitude. Flagged 4 pre-existing spec-conformance bugs (now §11).
2. **Data model** — locked the union shape, recommended `PromptLifecycle = 'idle'|'building'|'shown'|'suppressed'` (added `suppressed` state), recommended named-union over `Exclude<>` for row items, confirmed AST-at-reducer over store-raw-string.
3. **Parser API + state machine** — recommended dropping `noop` (kept `unknown` only), adding `disconnect` as a ProtocolEvent, no effects array, container tracking in Vuex state.
4. **UI rendering** — confirmed plain `<img>` over `<v-img>`, CSS-grouped flex row over `<v-btn-toggle>`, dialog width 600, footer-button-default-secondary, monotonic IDs for stable Vue keys.
5. **`prompt_size` spec extension** — confirmed shape, lock semantic vocabulary `small|normal|large|x-large` matching markup, consume-at-next-begin (not live), default `normal`.
6. **Error handling & robustness** — confirmed segment-by-segment `encodeURIComponent`, logging policy, SVG-via-`<img>` safety. Flagged the replay-vs-disconnect conflict (now §9.6).
7. **Testing strategy** — confirmed vendoring approach, identified actual fixture shape (`fixtures[]` not `cases[]`), recommended one component smoke test for security-load-bearing v-html assertion (now §10.5).

## 14. Open follow-ups (post-implementation)

- Add `prompt_size` extension prose to `mrmees/klipper-macro-prompt-protocol/SPEC.md`.
- Add `prompt_size` fixture cases to `fixtures/fixtures.json`.
- Post in the cross-project discussion issue once implementation is verified working.
- Decide whether the existing `feat/custom-nav-links` PR #1786 unblocks before opening any upstream conversation about this work.
- RTL support: acknowledged not addressed in v1; flag as future work if Fluidd ever ships RTL.

---

**End of design.**
