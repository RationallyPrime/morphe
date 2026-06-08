# Seed mining — SUBSTRATE layer

Source seed (read-only): `/home/rationallyprime/Sokrates/packages/design-library`
Compared against Morphe's locked core: `/home/rationallyprime/projects/morphe/src/lib/morphe/{context,tokens}`
Contract authority: `/home/rationallyprime/projects/morphe/CONTRACT.md`

Scope: the SUBSTRATE — context propagation, the style-props DSL, the token
structure, and a11y/reduced-motion utilities. Plus the specific NEW
tokens/intents/slots the Action + Overlay families (the families the proposal's
§4 omitted) will require.

Bottom line up front: **the seed's substrate is almost entirely a cautionary
tale.** Its context system is a coarse 3-level spacing heuristic; its style-prop
DSL is the legacy's central liability (the very thing the contract bans) and is
already self-deprecated in the seed source; its tokens are *welded* (vertical
vocabulary baked into scale names) exactly as the contract warns. Morphe's
context algebra and three-layer token model are strictly more principled and
already implement everything worth having from the seed. **What is genuinely
worth lifting is small and bounded: a11y helpers, the reduced-motion CSS, and —
most importantly — the *evidence* of which channels/intents/slots the Action +
Overlay families actually consume**, which lets us close the gaps the proposal
left open.

---

## 1. Context propagation — `contexts/CompositionContext.tsx` + `UIContext.tsx`

### What the seed does

`contexts/CompositionContext.tsx`:
- A `CompositionContext` carrying `{ config, level, isMobile }`. `config` is a
  `{ gap, padding }` map keyed by a 3-value hierarchy `"atom"|"molecule"|"organism"`
  (lines 10–32). Defaults: atom=2, molecule=4, organism=6 (Tailwind spacing units).
- `level` is a plain integer bumped by the `<Composition>` wrapper
  (lines 140–155); `useComponentSpacing` maps `level` → hierarchy
  (`0→organism, 1→molecule, else atom`, lines 121–123).
- `isMobile` from a `useSyncExternalStore` matchMedia subscription at `768px`
  (lines 52–66), with SSR-safe snapshot; mobile halves gap/padding when no
  explicit mobile override exists (lines 126–134).

`contexts/UIContext.tsx`: app-shell concerns only — `sidebarOpen`, `chatOpen`,
`theme` (light/dark/system) with `localStorage` persistence and a
`prefers-color-scheme` listener, plus a duplicate `isMobile` at `1024px`. This is
application state, **not** a design-substrate primitive.

### Comparison to Morphe's context algebra (`context/algebra.ts`)

The seed's "depth/density/spacing propagation" the brief asked about is, in
reality, just `level → hierarchy → fixed gap/padding`, plus a mobile halving. It
has **none** of Morphe's laws:

| Concern | Seed `CompositionContext` | Morphe `algebra.ts` |
|---|---|---|
| Propagated record | `{config, level:int, isMobile}` | `MorpheContext = {depth, density, scaleTier, emphasisBudget, surface}` |
| Per-role transform | none — only a `level++` bump | `transform(parent, role, opts)` with a role→demotion map (LOCALITY) |
| Sibling-count sensitivity | none | `densityForCount` gated by enumerated `THRESHOLDS` (STABILITY) |
| Scale monotonicity | none | `scaleTier` non-increasing; only `enterFrame` resets (MONOTONE-DEPTH) |
| Emphasis arbitration | none | `renormalizeBudget` + `TOP_TIER_CAP` (BUDGET-CONSERVATION) |
| Continuous vs discrete split | all baked into one config | discrete in ctx record; continuous emitted as CSS vars at boundaries |
| Reset boundary | none (level only grows) | `Frame`/`enterFrame` is the single scale-tier reset |

**Verdict: discard the seed context wholesale; lift nothing.** Morphe already
supersedes it on every axis. Three small observations worth keeping in mind,
none requiring a core change:

1. **Mobile/axis handling.** The seed reaches for JS (`useSyncExternalStore` +
   matchMedia) to halve spacing on mobile. The contract already says the
   responsive flex loop is **container queries, no JS** (CONTRACT §4: a
   `direction:"auto"` Stack flips axis via a container query; Frame/MorpheRoot
   set `container-type: inline-size`). This confirms Morphe's choice — the seed's
   JS-driven viewport reactivity is precisely what the contract's
   container-query approach avoids. Do **not** port the matchMedia path.
2. **Theme/dark-mode in `UIContext`.** Out of scope for the substrate — Morphe is
   a single dialect selected by `data-mo-dialect`, and dialect re-theming is a
   CSS var remap (CONTRACT §8), not a React context + `localStorage` toggle.
   `useDarkMode`/`resolvedTheme` have no Morphe analogue and need none.
3. **The 3-level `atom/molecule/organism` hierarchy** is a *widget-taxonomy*
   framing — exactly the framing the proposal §4 rejects ("factored by
   compositional role, not widget taxonomy"). Morphe's `ContainerRole` (page,
   section, panel, toolbar, list, form, field-group, inline) is the correct
   replacement and is already in the grammar. Confirms the de-taxonomy lesson.

---

## 2. The typed style-props DSL — `styles/core-props.ts`

### What the seed does

This file is **self-deprecated in its own source**. `CoreStyleProps` is `{}`
(line 18). Every meaningful export carries `DEPRECATED` JSDoc:
- `CORE_STYLE_KEYS` (lines 23–93): a ~90-entry `Set<string>` of style prop names
  (`bg`, `p`, `px`, `hoverBg`, `focusRing`, `darkFocusBg`, …) — the surface area
  of the old runtime className-synthesis DSL.
- `ResponsiveProps` (lines 108–290): the same props × 5 breakpoints
  (`smBg`, `mdBg`, …, `2xlGridCols`) — ~150 typed keys, marked "DEPRECATED: use
  responsive Tailwind classes directly."
- `resolveIntent`, `getBasePropName`, `getBreakpointPrefix`: all stubs returning
  empty (lines 402–418).
- `BaseComponentProps` (lines 425–439) ends with `[key: string]: any` — an
  explicit "allow any prop during migration" escape hatch.

`styles/hooks.ts` is the matching tombstone: `useCoreStyle`, `useComponentStyle`,
`splitCoreProps`, `createStyledComponent`, `createIntentComponent` are all
deprecated stubs returning `{ className: "", style: undefined }`. The only live
function is `getIntentClasses` (lines 11–26) — a hardcoded
`IntentName → Tailwind className string` map (`primary →
"bg-deep-navy text-document-white hover:bg-deep-navy/90"`, etc.).

### What maps onto Morphe's slot layer / what to discard

- **Discard the entire DSL.** It IS the "runtime className synthesis" the
  contract names as "the legacy's central liability" (CONTRACT §1, §6). The seed
  authors had already reached the same conclusion and gutted it. Nothing in
  `core-props.ts` or `hooks.ts` should be ported. The `PolymorphicProps` /
  `HTMLAttributes` helpers (lines 444–467) are React-specific and irrelevant to a
  Svelte-runes core.
- **The one transferable idea — already implemented.** The *shape* of the dead
  DSL (a prop maps to a styling decision that resolves to a CSS value) is exactly
  what Morphe's `slot()` does, but correctly: `slot(intent, channel)` returns a
  `var(--mo-intent-…)` string a primitive drops into `style:` (slots.ts) —
  resolution happens in the cascade, never via string concatenation of class
  names. So the DSL's intent maps onto Morphe's slot layer **conceptually only**;
  the implementation is already there and is better.
- **What the dead DSL's key list usefully *reveals*** is the channel vocabulary
  real components needed: `hoverBg`, `focusBg`, `focusRing`, `focusBorderColor`,
  `activeBg`, `disabledBg`/`disabledOpacity`. Morphe's `IntentChannel` is
  `surface | on | hover | border | ring` — it has hover, border, ring, but
  **no `active` and no `disabled` channel**. See §5: the Action family needs
  these, and the seed's key list is the evidence for that need.

---

## 3. Token structure — `styles/design-tokens.ts` (+ `main.css`)

### What the seed does — and the welding lesson, confirmed

`design-tokens.ts` is a **two-layer, welded** model:

1. **Welded scale/intent names.** `BaseColorToken` (lines 5–47) literally hard-codes
   vertical vocabulary as the token names: `deep-navy`, `judicial-crimson`,
   `citation-blue`, `amendment-gold`, `document-white`, `warm-gray`, plus their
   `dl-color-*` prefixed twins. These are simultaneously "the scale" and "the
   meaning" — there is no neutral ramp underneath. This is **exactly** the fatal
   mistake the contract calls out by name ("`judicial-crimson` as a *scale*",
   CONTRACT §6 / scales.css header). The seed is the primary evidence for the
   de-welding lesson. Morphe's `scales.css` deliberately re-expresses the *same
   Archive palette* as neutral `--mo-amber-500` / `--mo-blue-700` / `--mo-red-700`
   ramps, and pushes `judicial-crimson`-style meaning up to the dialect intent
   layer. **Confirmed: keep Morphe's three-layer scales→intents→slots split;
   the seed's two-layer welded model is the anti-pattern.**

2. **The `INTENTS` record (lines 332–432).** Seven intents
   (`primary, secondary, info, success, warning, danger, minimal`) each as an
   `IntentThemeEntry` with channels: **`bg, fg, hoverBg, ring, activeBg, disabledBg,
   disabledOpacity, darkBg, darkFg`** (interface lines 310–327). This is the most
   useful single artifact in the seed for our purposes — it is an empirical list
   of the channels a *real* button/intent system needed. Note it has
   `activeBg`, `disabledBg`, `disabledOpacity` — channels Morphe currently lacks.

3. **`ZLayer` enum (lines 523–530)** — the stacking-order contract for overlays:
   `BASE=0, DROPDOWN=10, STICKY=20, MODAL=30, TOAST=40, TOOLTIP=50`. Morphe has
   **no z-index / layer token at all.** The Overlay family needs one. This is the
   single most directly portable token in the seed (as values, not as a TS enum —
   it should become a `--mo-layer-*` scale).

4. Other categories — `SpacingToken`, `RadiusToken`, `FontSizeToken`,
   `ShadowToken`, `ComponentSize`, `BREAKPOINT_VALUES`, `COMPONENT_PADDING_SCALE`,
   `FORM_FIELD_GAP_SCALE`, `SpacingSize` enum — are all Tailwind-shaped string/number
   unions for a className DSL. **Discard.** Morphe's `scales.css` already owns
   space/type/radius/elevation as CSS custom properties (the correct home).
   Note: the seed has a `ShadowToken` (`none|sm|md|lg|xl|2xl`) — Morphe correctly
   has **no shadow scale** (CONTRACT §1, §6: "No drop shadows; depth is tonal
   surface layering"). Do **not** port shadows; the elevation ramp
   (`--mo-elev-0..4`, tonal) is the deliberate replacement.

### Token categories Morphe lacks (that the new families need) — summary

| Category | Seed evidence | Morphe today | Needed for |
|---|---|---|---|
| z-index / layer order | `ZLayer` enum (design-tokens.ts 523–530) | absent | Overlay (Modal, Popover, Tooltip, Dropdown, Toast) |
| `active` state channel | `IntentThemeEntry.activeBg` (311–326) | `IntentChannel` has no `active` | Action (Button pressed state) |
| `disabled` state channel | `disabledBg` + `disabledOpacity` | absent | Action (Button/Link disabled) |
| overlay surface / scrim | Modal scrim `bg-deep-navy/30` (Modal.tsx 156) | absent | Overlay (modal backdrop) |
| elevated-overlay surface | popovers use `bg-document-white` + shadow | tonal surfaces exist (base/raised/sunken) but no "floating/overlay" tier | Overlay panels |
| focus-ring offset | Button `focus-visible:ring-offset-2` (Button 111) | `ring` color only, no offset/width token | Action + Overlay focus rings |

---

## 4. a11y + reduced-motion utilities

These are the genuine, low-risk **lifts** from the seed substrate.

### `utils/accessibility.ts` — PORT (re-expressed for Svelte/runes)

- `announce(message, priority)` (lines 10–28): creates a transient
  `aria-live` region, sets text, removes after 1s. Clean, framework-agnostic
  DOM. Morphe's `InlineAlert` already carries `live:"polite"|"assertive"`
  (CONTRACT §3) but an imperative `announce()` is the right tool for transient
  Toast/Status announcements the Overlay family will need. **Port as a plain
  function** (drop the React import).
- `prefersReducedMotion()` (lines 33–38): SSR-safe matchMedia check. **Port** —
  pairs with the reduced-motion CSS below. (The `usePrefersReducedMotion` *hook*,
  lines 43–62, is React — re-express as a Svelte rune/`$effect` if a reactive
  version is wanted; the pure function is enough for most uses.)
- `useFocusTrap(isActive)` (lines 67–110): focus-trap for modals/dialogs —
  queries focusable descendants, focuses first, wraps Tab/Shift-Tab. **Directly
  relevant to the Overlay family (Modal).** Port the *logic* as a Svelte action
  (`use:focusTrap`); the focusable-selector string (line 74–76) is reusable
  as-is. Note: the seed's selector misses `input[type="email"]`, `textarea` is
  covered but several input types are not — tighten when porting (prefer a
  `:is(...)` selector or `tabindex` + visibility check).
- `useArrowKeyNavigation(items, orientation)` (lines 115–164): roving-tabindex
  arrow/Home/End handler for lists/menus. **Relevant to Dropdown/ActionsMenu
  (disclosure family).** Port the keydown logic as a Svelte action.
- `getAriaFormControlProps(...)` (lines 184–205): derives
  `id / aria-label / aria-invalid / aria-describedby / aria-required /
  aria-errormessage` from `{id,label,error,description,required}`. **Conceptually
  already in Morphe** — the Input stubs wire these from `InputA11y` per CONTRACT
  §3/§7. Use this as a *reference checklist* (it adds `aria-errormessage`, which
  is worth confirming Morphe's Field stub emits) rather than porting verbatim.
- `visuallyHidden()` (lines 169–171): returns a utility class string — Tailwind
  shaped; replace with a Morphe `.mo-sr-only` CSS class. Trivial.

### `styles/reduced-motion.css` — PORT (adapt selectors)

- The global `@media (prefers-reduced-motion: reduce)` block (lines 4–36) that
  zeroes animation/transition durations and `scroll-behavior` is the standard,
  correct guard. **Port the global block.** Morphe is motion-light by house style,
  but any motion (the contract permits container-query axis flips, and overlay
  enter/leave transitions will exist) MUST respect this.
- The `.animate-spin/.animate-pulse/.animate-bounce` and `.motion-safe\:*`
  utility overrides (lines 14–63) are Tailwind-class-specific — **discard**;
  re-author as `.mo-*` equivalents only if/when a primitive actually animates.

### Where a11y lives in Morphe (no conflict)

Morphe already makes inaccessible trees *unrepresentable at the type level*
(`InputA11y`, required `Icon`/`Media` a11y, `StatusSignal` non-color signal —
CONTRACT §3, §7). The seed's a11y utilities are the **runtime behaviors** that
complement those static guarantees (focus management, live announcements,
keyboard nav). They are additive, not overlapping.

---

## 5. NEW tokens / intents / slots the Action + Overlay families require

The proposal §4 enumerates Layout / Content / Input / Feedback / Meta but
**omits action, link, overlay, and disclosure** — that omission is what this
mining is fixing. The seed's `INTENTS` record, `ZLayer`, and the actual
Button/Link/Modal/Popover/Dropdown/Tooltip sources give us the exact substrate
gaps. None of these are primitive-agent edits — per CONTRACT §0 they are
**grammar/contract changes** (new channels, new scale, new slot bindings) and go
through the contract owner.

### 5a. New IntentChannels (extend `IntentChannel` in `tokens/intents.ts`)

Current: `surface | on | hover | border | ring`. Add:

- **`active`** — pressed/active state. Seed evidence: `IntentThemeEntry.activeBg`
  (design-tokens.ts 311–326), every seed intent defines it; Button uses
  per-intent active in its variant maps. Without it, Action primitives have no
  pressed feedback.
- **`disabled`** — disabled surface. Seed evidence: `disabledBg` +
  `disabledOpacity` (design-tokens.ts 311–326); Button uses
  `disabled:opacity-50 disabled:pointer-events-none` (Button.tsx 111). Minimal
  port: a single `--mo-intent-<name>-disabled` plus a global
  `--mo-disabled-opacity` (see 5c) — opacity-based disabling is simpler and
  matches the seed's effective behavior (opacity 50–70%).

Each new channel must be defined for every core intent in `intents.css`
(8 intents × 2 channels = 16 new vars in the default-dialect block).

### 5b. New scale: layer / z-index (`scales.css`)

Morphe has no stacking token. Port `ZLayer`'s values as a neutral ramp:

```
--mo-layer-base:     0;
--mo-layer-dropdown: 10;   /* Dropdown, Select, ActionsMenu panels */
--mo-layer-sticky:   20;   /* sticky toolbars/headers */
--mo-layer-overlay:  30;   /* Modal scrim + panel (seed MODAL) */
--mo-layer-toast:    40;   /* Toast region */
--mo-layer-tooltip:  50;   /* Tooltip (always on top) */
```

Source: `design-tokens.ts` `ZLayer` (523–530). Confirmed against live usage —
ActionsMenu/Dropdown panels use `z-10`, Modal `z-10`, Tooltip/Popover `z-50`
(ActionsMenu.tsx 263, Dropdown.tsx 202, Modal.tsx 139, Tooltip.tsx 146,
Popover.tsx 50). Keep as raw integers in the scale layer (these are neutral, not
intent-scoped).

### 5c. New surface/intent vars for overlays (`tokens/intents.ts` SURFACE_VARS + `intents.css`)

The Overlay family paints onto *floating* surfaces over a *scrim*; Morphe's
current `surface-{base,raised,sunken}` ladder has no "floating overlay" tier and
no scrim. Add to `SURFACE_VARS` (intents.ts 55–62) and define in `intents.css`:

- **`--mo-intent-surface-overlay`** — the floating-panel surface (Modal panel,
  Popover/Dropdown/Tooltip content). Seed paints these `bg-document-white`
  (light) / `bg-deep-navy` (dark) (Modal.tsx 176, Popover.tsx 51, Dropdown.tsx
  202). In the Archive dark dialect this should be the **highest tonal surface**
  (e.g. `var(--mo-neutral-4)` or `-5`) — depth via tone, not the seed's
  `shadow-lg`/`shadow-xl` (which we deliberately drop).
- **`--mo-scrim`** — the modal backdrop. Seed: `bg-deep-navy/30` light,
  `/50` dark (Modal.tsx 156). Port as a single
  `color-mix(in srgb, var(--mo-neutral-0) 55%, transparent)` (or similar) scrim
  var. This is the one overlay token the seed expresses purely as opacity, and it
  is genuinely needed — there is no tonal-layering substitute for a backdrop.
- **`--mo-overlay-border`** — overlay panels use a faint hairline to separate
  from scrim/content (`border-warm-gray-200/20` in Popover/Dropdown). Map to the
  existing `--mo-intent-outline` (already low-opacity) — likely no new var
  needed; confirm at implementation. The contract bans 1px borders *for
  sectioning* but allows "ghost borders for accessibility" — an overlay edge over
  a scrim qualifies.

### 5d. Focus-ring tokens (`scales.css` + slots)

Morphe has per-intent `ring` *color* but no ring geometry. The seed's
interactive primitives all use `focus-visible:ring-2 ring-offset-2`
(Button.tsx 111, Link.tsx 197, Modal.tsx 178/208, ActionsMenu/Dropdown
`focus:outline-none`). The Action + Overlay families need a **consistent focus
ring** that the contract already demands ("Keep focus-visible rings on
interactive primitives", CONTRACT §7). Add neutral scale tokens:

- `--mo-ring-width: 2px;`
- `--mo-ring-offset: 2px;`

and a slot binding so primitives don't hardcode them, e.g. extend `SLOTS` with:

```
focus: {
  ring:   (intent) => slot(intent, "ring"),     // color (exists)
  width:  () => "var(--mo-ring-width)",          // new
  offset: () => "var(--mo-ring-offset)",         // new
}
```

The ring *color* per intent already exists in `intents.css` (every intent has a
`-ring` channel) — only the geometry is missing.

### 5e. New SLOTS groups (`tokens/slots.ts`)

`SLOTS` today has `field`, `action`, `feedback`. The action group is minimal
(`surface/on/hover` only). The new families need:

- **`SLOTS.action`** extended with `active` and `disabled` channels (once 5a
  lands), and variant awareness. The seed's Button has 4 variants
  (`solid|outline|ghost|link`) × 6 intents (Button.tsx 8–16, 51–100); Link has
  3 variants (`default|underline|nav`) (Link.tsx 6). Morphe should NOT bake
  variant×intent into a className matrix (the seed's anti-pattern, 50–100). The
  right shape: a single `action` slot group reading the chosen intent's channels;
  *variant* (solid vs outline vs ghost) is a structural decision the Action
  primitive makes by choosing **which channels it paints** (solid = surface+on;
  outline = border+on, transparent surface; ghost = on only, hover surface;
  link = on only, underline). No new tokens needed for variants — they are
  re-combinations of existing channels. This is the key de-welding move for the
  Action family: variants are channel-selection, not new tokens.
- **`SLOTS.overlay`** (new group): `surface` → `var(--mo-intent-surface-overlay)`,
  `scrim` → `var(--mo-scrim)`, `border` → `var(--mo-intent-outline)`,
  `layer.{dropdown,overlay,toast,tooltip}` → the `--mo-layer-*` scale vars.
- **`SLOTS.link`** (or fold into `action`): links are `on`-color forward with a
  hover color shift and underline; reuse intent `on`/`hover` channels — no new
  tokens, just a slot binding so the Link primitive reads them.

### 5f. Grammar implications (flag only — contract-owner territory)

The proposal/contract grammar (CONTRACT §3) has no `Button`/`Link`/`Modal`/
`Popover`/`Disclosure` Node kinds — consistent with §4's omission. Adding the
Action + Overlay *families* is a grammar change (new Node kinds + registry
entries, CONTRACT §0/§9), not just a token change. The token/intent/slot
additions above are the **substrate prerequisites** that must land first so the
new primitives have channels to bind to. The two state channels (`active`,
`disabled`), the layer scale, the overlay surface + scrim, and the ring geometry
are the complete substrate delta; nothing else from the seed is required.

---

## Appendix — disposition table

| Seed artifact | Path | Disposition |
|---|---|---|
| `CompositionContext` (level→gap/padding) | contexts/CompositionContext.tsx | DISCARD — superseded by algebra.ts |
| `useIsMobile` / matchMedia spacing | contexts/CompositionContext.tsx 52–66 | DISCARD — use container queries |
| `UIContext` (sidebar/chat/theme) | contexts/UIContext.tsx | DISCARD — app state, dialect handles theming |
| `atom/molecule/organism` hierarchy | contexts/types.ts | DISCARD — confirms de-taxonomy lesson |
| `CoreStyleProps` / `CORE_STYLE_KEYS` | styles/core-props.ts 18–93 | DISCARD — the banned className DSL (already dead in seed) |
| `ResponsiveProps` (×5 breakpoints) | styles/core-props.ts 108–397 | DISCARD |
| `getIntentClasses` className map | styles/hooks.ts 11–26 | DISCARD — className synthesis |
| all `hooks.ts` stubs | styles/hooks.ts | DISCARD (already deprecated stubs) |
| welded `BaseColorToken` names | styles/design-tokens.ts 5–47 | DISCARD — the welding anti-pattern (confirms lesson) |
| `INTENTS` channel set | styles/design-tokens.ts 310–432 | MINE — evidence for `active`/`disabled` channels |
| `ZLayer` enum | styles/design-tokens.ts 523–530 | LIFT (as `--mo-layer-*` scale values) |
| `ShadowToken` | styles/design-tokens.ts 167–175 | DISCARD — no drop shadows (tonal elevation instead) |
| `announce()` | utils/accessibility.ts 10–28 | LIFT (plain fn, drop React) |
| `prefersReducedMotion()` | utils/accessibility.ts 33–38 | LIFT |
| `useFocusTrap` | utils/accessibility.ts 67–110 | LIFT (as Svelte action; for Modal) |
| `useArrowKeyNavigation` | utils/accessibility.ts 115–164 | LIFT (as Svelte action; for Dropdown/ActionsMenu) |
| `getAriaFormControlProps` | utils/accessibility.ts 184–205 | REFERENCE (Morphe already wires from InputA11y; check `aria-errormessage`) |
| reduced-motion global block | styles/reduced-motion.css 4–36 | LIFT |
| `.motion-safe\:*` Tailwind utilities | styles/reduced-motion.css 14–63 | DISCARD (re-author as `.mo-*` if needed) |
