# ADR-0006 — The stage home and the intent engine (morphs as governed Deltas)

- **Status:** Accepted — superseded in scope by ADR-0008/ADR-0012
- **Date:** 2026-06-10
- **Deciders:** Hákon (founder), D7–D10/D12 of the site-reconstruction grill
- **Related:** VISION.md (the adaptive tower), CONTRACT.md (Delta/envelope, render
  totality, factory gate), ADR-0002 (retrieve→rerank), ADR-0005 (dialect pair),
  docs/redesign-plan.md (D1–D5)

> **Superseded:** the stage-home/intent-engine surface this ADR describes
> moved to the `sokrates-website` repo in the 2026-06-23 decoupling
> (ADR-0008, ADR-0012) and no longer lives in this repo. Kept as historical
> record.

## Context

The home page is a corridor: hero → sections → CTA → footer, walked in order —
structurally identical to every templated SaaS landing page, and it buries the
substrate's actual capability. Meanwhile the machinery for reshaping a live tree
from data already exists and is tested: Delta/envelope isolation (R2), the
factory gate (grammar type-check, intent keyset, depth bounds), and render
totality (a malformed tree is rejected, never rendered broken). It is used
nowhere on the site.

Separately (D12): visitor-facing reassurance copy ("It reads nothing from your
systems…") implants the fear it claims to soothe, and internal doctrine
vocabulary ("under governance", "the appliance is what acts") has leaked from
repo documents into UI strings.

## Decision

1. **The home becomes a stage, not a corridor (D7).** Above the fold: a short
   statement, then the composer. The composer's empty state is an invitation —
   the question, the field, example-friction chips — never cards (D10); cards
   exist only as answers. The governance two-column section and the footer are
   removed; legal/contact compresses to a whispered line. `/how-it-works`
   survives as a canonical, crawlable page and serves as content source for
   morphs.
2. **Everything else becomes morphable content behind one intent engine.**
   A visible row of **intent chips** ("How is it governed?", "Show me the
   technical version", …) is the primary affordance — recognition over recall,
   phone-first. A **keystroke palette** (Cmd/Ctrl+K) rides the same engine as
   the power-user accelerator and as a performed demo for technical visitors.
3. **A morph is a hand-authored Delta, executed through the existing gates.**
   v1 intent resolution is curated matching (fuzzy/semantic over a registered
   morph vocabulary — the ADR-0002 pipeline generalizes if needed). The Delta
   is applied to the live tree via the R2 machinery; the factory gate validates;
   render totality means a bad morph is *rejected, not rendered*. LLM-authored
   Deltas are v2, behind the same gate — the gate is what makes them safe.
4. **Constraints carried as requirements, not afterthoughts:**
   - **Crawlability:** morphs are progressive enhancement; canonical content
     stays server-rendered (`/how-it-works`, the home's initial tree). Chips
     degrade to plain anchors without JS.
   - **A11y:** a morph announces itself (live region); `prefers-reduced-motion`
     is respected for morph transitions.
   - **Voice (D12):** reassurance copy is deleted, not rewritten — security
     posture lives in onboarding/diligence surfaces, never in hero ledes.
     Doctrine vocabulary is banned from UI strings.

## Consequences

**Positive**

- The site demos the product by being the product: "state your interest, the
  page composes itself" is the same shape as the appliance's pitch — and it is
  the Morphe-specific thing no template has.
- The idle machinery (Delta, envelope, gate, totality) gets its first production
  consumer; the architecture claim becomes demonstrable in one click.
- The page is as long as the visitor's curiosity, not as long as our anxiety.

**Negative / costs**

- Each shipped intent is real authored content (a tree fragment + a Delta);
  the morph vocabulary is the scope knob (D9 locked the launch set at six).
- A reshaping page raises QA surface: every morph × both dialects × mobile.
- Discoverability rests on the chips; if their copy fails, the keystroke
  palette alone will not save it.

## Alternatives considered

- **A freestanding "ask me anything" bar:** pattern-matches to chatbot widget,
  invites open-ended queries v1 cannot honor. Rejected.
- **IDE-style hidden palette as the only affordance:** keyboard-first and
  hidden-by-default serve returning expert users; a marketing page has neither.
  Kept, but demoted to accelerator.
- **Routing site-intents through the composer** (one mouth for pain + intent):
  elegant, risks muddying the composer's demo job; deferred as a v2 question.
- **Keep the corridor, polish the sections:** rejected — the genericness is
  structural, not cosmetic.
