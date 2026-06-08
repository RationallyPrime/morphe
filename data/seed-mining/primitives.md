# Seed Mining — Missing Primitives (Action / Link / Overlay / Disclosure)

**Scope.** This report mines the *correct* seed
(`/home/rationallyprime/Sokrates/packages/design-library`, read-only) for the
primitives the Morphe CONTRACT §3 grammar does **not** yet name: the **action**
(Button), **link** (Link), **overlay** family (Dialog, Popover), and
**disclosure** family (Disclosure/accordion + Tabs). It also re-mines the input
atoms that back Morphe's existing `Field` / `Toggle` / `Select` modes so their
a11y contract is captured from the source rather than re-derived.

It is a *concept* report: the contract is locked (`CONTRACT.md` §0), so adding
any of these is a grammar change for the contract owner. What follows is the
behaviour/a11y contract to replicate, the prop surface worth keeping, the legacy
cruft to discard, and the elegant Svelte-5 + native-platform-API
re-implementation — written to slot into the existing locked stub idiom
(`primitives/input/Field.svelte`, `primitives/input/Toggle.svelte`):
runes-only, `SLOTS → intents → scales`, CSS-var carriers for stateful/continuous
values, required a11y, shape-never-color-only.

---

## 0. The legacy liabilities to DISCARD across the board

Confirmed by reading the seed; every new primitive must shed these.

1. **Runtime className synthesis.** Every atom builds its appearance by
   `cn(...)` over per-variant/intent/size Tailwind lookup tables
   (`Button.tsx` `intentColors[intent][variant]`, `Radio.tsx`
   `INTENT_DOT_CLASSES`, `Slider.tsx` `INTENT_FILL_CLASSES`). CONTRACT §1 names
   this "the legacy's central liability." Discard wholesale. Morphe carries
   discrete decisions on Svelte context and continuous/stateful values on CSS
   custom properties (`Field.svelte` `--mo-field-border`, `Toggle.svelte`
   `--mo-toggle-track`).
2. **`core-props.ts` is dead.** The file itself is marked `DEPRECATED: This
   entire system is being removed` (`styles/core-props.ts` lines 16-18); the
   `CoreStyleProps`/`ResponsiveProps`/`smBg…2xlGridCols` matrices and
   `resolveIntent()` are tombstones. Do **not** port any of it.
3. **Dual `dark:` variants.** Every atom doubles each color
   (`bg-blue-600 dark:bg-blue-500`). Morphe is a single dialected theme
   (`icelandic-archive`); intents already encode the surface relationship.
   Discard the `dark:` half entirely.
4. **Raw scale / hex / domain color names in components.** Atoms name
   `text-citation-blue`, `bg-judicial-crimson`, `border-warm-gray`. CONTRACT §6:
   "Nothing authored ever names a scale or a raw value." Replace with
   `SLOTS.*` / `var(--mo-intent-*)`.
5. **`@floating-ui/react`, `@headlessui/react`, `@heroicons` deps.** Tooltip
   uses Floating UI (`Tooltip.tsx` lines 4-18); Modal/Dropdown/Radio/RadioGroup
   use Headless UI; everything pulls Heroicons. These are runtime JS solving
   positioning, portaling, focus-trap, and dismissal that the **native
   platform** now does (see §3). Morphe's only icon dependency is Material
   Symbols (CONTRACT, CLAUDE.md). Discard all three.
6. **`forwardRef` / `useImperativeHandle` / `displayName`.** React ceremony
   (`Checkbox.tsx` lines 126-127). Svelte 5 has no ref-forwarding need; gone.
7. **The 9-step `size` ramp + free-form `className` passthrough.** Atoms expose
   `xs…5xl` size enums and accept arbitrary `className`. Morphe sizing is the
   context algebra (density/scale tier via `--mo-ctx-*`); a primitive does not
   take a size prop or a className escape hatch.
8. **`Math.random()` ID generation.** `Tabs.tsx` line 59 and `FormField.tsx`
   line 84 mint IDs with `Math.random().toString(36)` — non-deterministic,
   breaks SSR hydration and the replay/snapshot discipline (proposal Cor. 2).
   Morphe carries IDs in the grammar (`InputA11y.id`) or derives them
   deterministically.

---

## 1. Button — the **action** primitive (proposed `kind:"action"`)

**Seed:** `components/atoms/Button.tsx`.

### Behaviour + a11y contract to replicate
- Renders a real `<button>` by default → native Space/Enter activation, focus,
  `:disabled` semantics for free.
- `disabled` also set when loading; loading must announce (`aria-busy="true"`,
  the spinner `aria-hidden` — the seed *omits* this; the
  `ACCESSIBILITY_AUDIT.md` flags it lines 14-18 — fix on the way in).
- `focus-visible:ring-2` is the keyboard affordance; keep a focus-visible ring
  (CONTRACT §7).
- Polymorphic `as` let it render an `<a>` — **discard** this; that's what the
  Link primitive is for. Forcing `<button>` keeps the action/link split honest.

### Prop surface worth keeping (re-expressed as grammar)
| Seed prop | Keep as | Notes |
|---|---|---|
| `intent` (primary/secondary/danger/…) | `intent?: IntentRef` | map onto `SLOTS.action.*`; the amber `primary-action` beacon used sparingly |
| `variant` (solid/outline/ghost/link) | `variant?: "solid"\|"outline"\|"ghost"` | drop `"link"` variant — use the Link primitive |
| `isLoading` | `busy?: boolean` | drives `aria-busy` + a shape (spinner) honouring reduced motion |
| label/content | a `label:string` field or a `Slot` child | grammar trees pass text/nodes, not `children` |
| `disabled` | `disabled?: boolean` | native |

### DISCARD
`size` 5-ramp, `fullWidth` (a layout concern — Cluster/Stack owns width),
`as` polymorphism, `className`, all `intentColors[…][…]` tables, `forwardRef`.

### Elegant Svelte-5 + native approach
```svelte
<script lang="ts">
  let { node }: PrimitiveProps<Action> = $props();
  const surface = $derived(SLOTS.action.surface());  // intent → CSS var
</script>
<button type="button" class="mo-action" data-variant={node.variant ?? "solid"}
        disabled={node.disabled || node.busy} aria-busy={node.busy || undefined}
        style:--mo-action-surface={surface}>
  {#if node.busy}<span class="mo-action__spin material-symbols-outlined" aria-hidden="true">progress_activity</span>{/if}
  {node.label}
</button>
```
Reduced-motion is a media query in `<style>` (the seed already ships
`styles/reduced-motion.css`), not a JS hook (`usePrefersReducedMotion`) — kill
the hook. Variant is a `data-variant` attribute selected in `<style>`, not a
className lookup table.

---

## 2. Link — the **link** primitive (proposed `kind:"link"`)

**Seed:** `components/atoms/Link.tsx`.

### Behaviour + a11y contract to replicate
- Real `<a href>` → native navigation, middle-click, context menu, Cmd-click.
- **External-link affordance** is the load-bearing a11y detail: when the target
  is cross-origin, set `target="_blank" rel="noopener noreferrer"`, render a
  visible indicator icon **and** an SR-only `"(opens in new tab)"` span
  (`Link.tsx` lines 207-218; the audit calls external indication critical,
  lines 57-60). Keep this exactly; it is the one thing the seed Link does well.
- `focus-visible` ring.

### Prop surface worth keeping
| Seed prop | Keep as | Notes |
|---|---|---|
| `href` (required) | `href: string` | required |
| `intent` | `intent?: IntentRef` | maps to `SLOTS` (default the provenance/citation blue, not amber) |
| `showExternalIndicator` / `hideExternalIndicator` | `external?: "auto"\|"force"\|"hide"` | collapse the two booleans into one tri-state |
| label/content | `label:string` or `Slot` | grammar |
| `variant` (default/underline/nav) | drop or fold to `data-variant` | "nav" is an app concern, not a primitive's |

### DISCARD
The 9-step `size` ramp and `iconSizeClasses` map, the `intentClasses` /
`focusRingClasses` lookup tables, the inline `ExternalLinkIcon` SVG (use a
Material Symbol `open_in_new`), `forwardRef`, `className`.

### Elegant Svelte-5 + native approach
- External detection (`new URL(href, location.href).origin !== …`) is fine but
  must be SSR-safe: compute it in a `$derived` guarded for `typeof window`, or
  better, let the grammar carry `external?: boolean` so the **agent/server**
  decides and the primitive stays pure (preferred — no `window` read in a
  server-driven primitive). The SR-only span + Material Symbol stay.

---

## 3. Overlay family — Dialog & Popover (the big native-API win)

The seed solved overlays with **three different runtime libraries**, all
fighting the same fights — positioning, portaling, focus trap, escape/outside
dismissal, stacking/overflow:

- **Modal** (`layout/Modal.tsx`) → Headless UI `Dialog` + `Transition`, a
  hand-rolled `keydown` Escape listener (lines 117-129), `initialFocus` ref,
  a manual scrim div.
- **Tooltip** (`atoms/Tooltip.tsx`) → Floating UI `useFloating` + `offset`/
  `flip`/`shift`/`arrow` middleware, `FloatingPortal`, `useHover`/`useFocus`/
  `useDismiss`/`useRole` (lines 80-124).
- **Dropdown** (`molecules/Dropdown/Dropdown.tsx`) → Headless UI `Menu` +
  `Transition`, absolute-positioned `Menu.Items` with hand-coded `position`
  className branches (lines 200-209) and a manual `z-10`.
- **ActionsMenu** (`molecules/ActionsMenu`) → pure CSS `absolute` + a
  `POSITION_MAPPINGS` table (lines 149-154), `z-10`, no focus management, no
  dismissal at all (it just returns `null` when `!isOpen`).
- **Combobox** (`molecules/Combobox`) → hand-rolled outside-click
  `mousedown` listener + `useEffect` cleanup (lines 116-132), manual
  `activeIndex` roving, manual `aria-*` IDs.

**The lesson (CONTRACT brief, explicit).** Every one of these re-implements
positioning, portaling, focus-trap, and top-layer stacking in JS because the
platform couldn't do it in 2025. It can now. Morphe should prefer the **native
`<dialog>` element and the Popover API**, which give the *top layer* (no
`z-index` wars, no portal, no overflow clipping), light-dismiss, and focus
management for free.

### 3a. Dialog (proposed `kind:"dialog"`)
**Replicate** from Modal: `aria-labelledby` → title, `aria-describedby` →
optional description, Escape-to-close, focus moves in on open and **returns to
the invoker on close**, a close affordance with `aria-label`, a scrim.

**Native approach.** Use `<dialog>` + `dialog.showModal()`:
- Top layer (above everything, no `z-index`), built-in backdrop via
  `::backdrop` (style it tonally per CONTRACT — no drop shadow), built-in
  focus trap, built-in Escape (`cancel` event), focus restoration to the
  opener — **all the Modal's hand-rolled `useEffect`/`useFocusTrap` deleted.**
- `aria-labelledby`/`aria-describedby` wired to grammar-carried IDs.
- Open state is tier-0 `$state`; an `$effect` calls `showModal()`/`close()` when
  it flips. The `useFocusTrap` hook in `utils/accessibility.ts` (lines 67-110)
  becomes **dead code** — native `<dialog>` traps focus itself.

### 3b. Popover (proposed `kind:"popover"`) — covers Tooltip / Dropdown / Menu / Combobox-shell
**Replicate** the union of the seed's overlay behaviours: anchored to a trigger,
light-dismiss (Escape + outside click), `role` appropriate to use
(`tooltip` | `menu` | `listbox`), arrow-key roving for menu/listbox variants.

**Native approach.** Use the **Popover API** (`popover` attribute +
`popovertarget`) for top-layer + light-dismiss for free, paired with **CSS
Anchor Positioning** (`anchor-name` / `position-anchor` / `position-area` +
`position-try`) to replace Floating UI's `flip`/`shift`/`offset` middleware
entirely — positioning becomes declarative CSS, **zero JS in the position loop**
(this is exactly the τ_fast "browser-visible flexes need no JS" principle,
proposal §5). Where Anchor Positioning isn't yet available, a minimal
`@floating-ui/dom` (core, not the React bindings) is the fallback — but the
React-coupled `@floating-ui/react` hooks are discarded.
- Roving tabindex for `menu`/`listbox` variants: reuse the keyboard pattern from
  `utils/accessibility.ts useArrowKeyNavigation` (lines 115-164) and
  `TabsList.tsx` (§5), re-expressed as a tiny Svelte action — but only for the
  variants that need it; a `tooltip` popover needs none.
- The hand-rolled outside-click listeners in Combobox/Tooltip are deleted
  (light-dismiss is native to the Popover API).

**a11y to keep:** Tooltip-on-focus-not-just-hover (the audit flags hover-only as
critical, lines 63-70 — the native focus + `aria-describedby` linkage fixes it);
Combobox's full `role="combobox"` + `aria-expanded`/`aria-controls`/
`aria-activedescendant` (audit lines 75-80 — the seed Combobox is missing these;
add on the way in).

---

## 4. Input modes already in the grammar — capture the a11y contract from source

CONTRACT §3 already has `Field`, `Toggle`, `Select`, `Range`; the stubs
(`Field.svelte`, `Toggle.svelte`) already implement the right idiom. This
section pins the a11y contract each *mode* must satisfy, mined from the seed
atoms, so the multiline / checkbox / radiogroup variants are built right.

### 4a. Field-multiline mode (seed `atoms/TextArea.tsx`)
- Same `InputA11y` wiring as `Field` (label relation, `aria-describedby` for
  hint+error, `aria-invalid`).
- **DISCARD** the seed's `variant` (default/filled/outline/minimal) and the
  `TextArea.Filled/.Outline/.Minimal` compound — that's runtime-className
  styling; Morphe surfaces come from the dialect/context.
- **Keep** `rows` and `resizable` (genuine textarea semantics).
- **Fix the seed bug:** its focus ring is on the *wrapper div*, not the
  `<textarea>` (audit lines 27-30). In Morphe put `:focus-visible` on the
  control itself, mirroring `Field.svelte` lines 126-130.
- Native `<textarea>` — no JS.

### 4b. Toggle / checkbox mode (seed `atoms/Checkbox.tsx`, `atoms/Switch.tsx`)
- `Toggle.svelte` already does the **switch** role correctly (real `<button
  role="switch" aria-checked>`, shape glyph + thumb so state is not color-only).
- For a **checkbox** semantic (tri-state), replicate Checkbox's `indeterminate`
  → set `el.indeterminate` via an `$effect` (the seed uses `useEffect` +
  `useImperativeHandle`, lines 126-150; Svelte does it with one `$effect` and a
  bound element — drop the imperative-handle ceremony) and expose
  `aria-checked="mixed"`.
- Native `<input type="checkbox">` gives Space-toggle free.
- **DISCARD** the intent/size lookup tables; **keep** the required-label
  enforcement (the grammar's `InputA11y` already makes unlabelled
  unrepresentable — the audit lists "no label text" as critical for
  Checkbox/Radio, lines 32-36; Morphe's grammar fixes this by construction).

### 4c. Select / radiogroup mode (seed `molecules/RadioGroup`, `molecules/Select.tsx`)
- **radiogroup:** replicate the `<fieldset>` + `<legend>` grouping,
  `aria-required`/`aria-invalid` on the fieldset, one `role="radio"` per option,
  **roving tabindex** (one tab stop for the group, arrow keys move selection),
  and error/helper text wired via `aria-describedby` (`RadioGroup.tsx` lines
  105-150). The seed leans on Headless UI `RadioGroup` for the roving —
  **discard Headless**, re-implement roving as the same tiny Svelte keyboard
  action used by Popover-menu and Tabs (§3b, §5).
- **select:** the grammar's `Select` carries
  `options:{value,label,disabled?}[]`. Render a **native `<select>`** for the
  plain case (free keyboard, type-ahead, mobile pickers) — the seed's
  `Dropdown`/`Select` molecules only exist because native `<select>` couldn't be
  styled in 2024; with modern CSS (`appearance: base-select` /
  customisable-select where available, falling back to native) it can. A
  *searchable* select is the Popover `listbox` variant (§3b), not a separate
  primitive.
- **DISCARD** the `Math.random` IDs (`FormField.tsx` line 84), the
  `React.cloneElement` prop-injection of `FormField` (lines 87-102) — Morphe
  wires a11y through the grammar node, not by cloning children.

---

## 5. Disclosure family — accordion + Tabs (show/hide + roving)

The seed has **no standalone Disclosure/accordion atom**; the closest
show/hide-with-roving pattern is `organisms/Tabs`.

### Tabs contract mined (seed `organisms/Tabs/`)
- `TabsList.tsx`: `role="tablist"` + `aria-orientation`, full keyboard nav —
  Arrow (orientation-aware), Home, End, with focus moved to the newly selected
  tab (lines 30-80). This is the **roving-tabindex** reference for the whole
  library.
- `TabsTab.tsx`: `role="tab"`, `aria-selected`, `aria-controls` → panel id,
  `tabIndex={isActive ? 0 : -1}` (the roving) — lines 36-54.
- `TabsPanel.tsx`: `role="tabpanel"`, `aria-labelledby` → tab id,
  `tabIndex={0}`, unmounts inactive panels (lines 22-39).
- Controlled/uncontrolled value via React context + `useState`.

### What to replicate / discard
- **Replicate** the ARIA triad (tablist/tab/tabpanel + the labelledby/controls
  cross-links) and the orientation-aware Arrow/Home/End roving.
- **DISCARD** the `Math.random` baseId (line 59 — use a deterministic
  grammar-carried id), the React context plumbing (Svelte context), the
  `setTimeout(…,0)` focus hack (lines 71-78 — use `$effect` /
  `tick()` then `.focus()`), and the `CompositionContext`
  (`contexts/CompositionContext.tsx`) spacing system entirely — Morphe's context
  algebra (`context/Context.svelte.ts descend()`) replaces it; the
  atom/molecule/organism `level` ramp and `useIsMobile` media-query store are
  superseded by the role-driven `transform` + container queries.

### Disclosure (proposed `kind:"disclosure"`) — the missing primitive
There is **no** accordion in the seed, but it is the canonical show/hide. The
native answer is `<details>`/`<summary>`:
- `<details>` gives open/close state, keyboard toggle, and built-in
  `aria-expanded`-equivalent semantics with **zero JS**.
- For an animated/grouped accordion, keep `<details>` and animate
  `::details-content` / `content-visibility` per modern CSS, honouring
  `reduced-motion`. A single-open "accordion" group is `name=` on the
  `<details>` elements (native exclusive accordion) — again no JS.
- Where richer control is needed (controlled open from the wire), back it with a
  `button[aria-expanded][aria-controls]` + a region, reusing Tabs' id-crosslink
  discipline.

---

## 6. How these consume Morphe's tokens/context (the binding rules)

For every primitive above, the consumption pattern is the locked stub idiom
(`Field.svelte` / `Toggle.svelte`), not the legacy `cn()`:

1. **Colors:** `SLOTS.action.* / SLOTS.field.* / SLOTS.feedback.*` →
   `intentVar()` → `var(--mo-intent-*)` → scales. Never `text-citation-blue`,
   never hex (CONTRACT §6).
2. **Stateful/continuous chrome** (border, ring, track color, open-progress):
   own CSS vars set with `style:--mo-x={$derived(...)}` (the C9 carrier), e.g.
   `--mo-field-border`, `--mo-toggle-track`. **No runtime className synthesis.**
3. **Density/scale:** read `var(--mo-ctx-type)` / `var(--mo-ctx-space)` from the
   boundary the nearest Layout ancestor set (CONTRACT §4) — primitives take no
   `size` prop.
4. **Discrete decisions** (variant): a `data-variant` attribute selected in
   `<style>`, not a TS lookup table.
5. **a11y is required and grammar-carried:** inputs take `InputA11y` (id, label
   relation, describedBy, required); icons take `{role:"decorative"}|{role:"img";
   label}`; functional state is never color-only — error = caution color **+**
   alert text **+** shape glyph; switch state = thumb position **+** track glyph
   (CONTRACT §7, already done in the stubs).
6. **Init side-effects** (`showModal()`, `setContext`, focus moves) read props
   directly with `// svelte-ignore state_referenced_locally`; template-consumed
   values are `$derived` (CONTRACT §1).

---

## 7. Net recommendation (what to add to the grammar)

Five new `kind`s, each a thin native-platform wrapper, no new runtime deps:

| Proposed kind | Native substrate | Replaces (seed) | New runtime deps |
|---|---|---|---|
| `action` | `<button>` | Button.tsx | none |
| `link` | `<a href>` | Link.tsx | none |
| `dialog` | `<dialog>` + `showModal()` | Modal.tsx (+ Headless) | **removes** Headless UI |
| `popover` | Popover API + CSS Anchor Positioning | Tooltip/Dropdown/ActionsMenu/Combobox-shell | **removes** Floating UI + Headless |
| `disclosure` | `<details>`/`<summary>` (+ Tabs ARIA for the controlled case) | (no seed equivalent) | none |

Plus capture, on the input modes already in the grammar, the multiline
(`<textarea>`), checkbox-with-indeterminate, and radiogroup
(`<fieldset>`/roving) a11y contracts above. Net effect: the four hardest
problems the seed threw three libraries at — positioning, portaling, focus
trap, dismissal — are solved by the platform, and the runtime dependency
surface (`@floating-ui/react`, `@headlessui/react`) **shrinks to zero** for
these primitives. The roving-tabindex keyboard pattern is implemented **once**
(a small Svelte action, mined from `TabsList.tsx` + `useArrowKeyNavigation`) and
shared by Popover-menu/listbox, RadioGroup, and Tabs.

---

### Seed paths cited
- `components/atoms/Button.tsx`, `Link.tsx`, `Input.tsx`, `TextArea.tsx`,
  `Checkbox.tsx`, `Radio.tsx`, `Switch.tsx`, `Slider.tsx`, `Label.tsx`,
  `Tooltip.tsx`
- `components/layout/Modal.tsx`
- `components/molecules/Dropdown/Dropdown.tsx`, `ActionsMenu/ActionsMenu.tsx`,
  `Combobox/Combobox.tsx`, `Toast/Toast.tsx`, `RadioGroup/RadioGroup.tsx`,
  `FormField/FormField.tsx`
- `components/organisms/Tabs/{Tabs,TabsList,TabsTab,TabsPanel}.tsx`
- `contexts/CompositionContext.tsx`
- `styles/core-props.ts` (the deprecated tombstone)
- `utils/accessibility.ts` (`useFocusTrap`, `useArrowKeyNavigation`,
  `getAriaFormControlProps`, `announce`)
- `ACCESSIBILITY_AUDIT.md` (documented gaps to fix on the way in)

### Morphe references
- `CONTRACT.md` §1, §3, §4, §6, §7 (locked grammar + idiom)
- `src/lib/morphe/primitives/input/Field.svelte`, `Toggle.svelte` (the stub
  idiom to mirror)
- `src/lib/morphe/render/props.ts` (`PrimitiveProps<N>`)
