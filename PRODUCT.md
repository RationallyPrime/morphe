# Product

*Scope note: this brief describes the Sókrates marketing website, which is now
built in the separate `sokrates-website` repo (ADR-0008/0012) and consumes
Morphe as `@rationallyprime/morphe`. It is kept here as the canonical brief —
the site's product thinking, not this repo's.*

## Register

brand

## Users

The site sells **Sókrates** — an on-premises AI department that runs a company's
cross-system operational work end to end. Three buyers read it, in order of
influence on the deal (lead with the first, arm the second, satisfy the third):

- **Decision Maker / Financial Buyer** — CEO, MD, COO, owner. Reads the hero and
  the close. Wants operational risk down, institutional knowledge to stop walking
  out the door, and the AI line item to be one decision instead of forty
  subscriptions. Has bought AI tools that didn't stick and watched consultants
  leave a PDF.
- **Champion / Operational Authority** — Head of Finance/Ops/Supply Chain, CFO.
  The person whose calendar *is* the integration layer. Wants the recurring
  questions answered without them, audit trails that hold, and to know what the
  system did and why.
- **Technical Influencer** — IT lead, CTO, head of data, migration lead. Gates on
  architecture. Wants data sovereignty, integration cost, no lock-in, and a story
  that survives scrutiny. Reads `/architecture` (a `sokrates-website` repo
  route, not one of this repo's).

Context of use: a founder-led sale, one honest conversation, not a 12-slide
discovery. The site is bilingual (EN/IS), `html lang="is"`. **Not** the audience:
self-serve SaaS shoppers, chatbot/RAG buyers, procurement teams running a
feature-matrix RFP, companies with no cross-system operational pain.

## Product Purpose

Sókrates connects to the systems a business already runs (ERP, finance stack, the
spreadsheets that actually run the place, procurement, HRIS, CRM), compiles their
structure into one typed semantic map, and runs the integration-layer work that
today routes through one overloaded senior person. It answers cross-system
questions with cited evidence, proposes actions, and executes the ones the
customer authorises — and it proactively surfaces friction the customer didn't
know to ask about. The appliance sits on the customer's premises; data residency
is structural, not a claim. Read-side discovery is always on; write-side action is
a dial the customer turns as track record accrues, human approval the default.

The marketing site's job: make a sceptical operator believe "I now have an AI
department" is a true, governed, sovereign, exit-symmetric statement — and book
one conversation. The interactive centerpiece (the capability composer) lets a
visitor *see* the substrate reason over a real operation, not read a claim about
it. Success = the conversation booked, by a buyer who already trusts the posture.

## Brand Personality

**Voice tier: "Quiet Confidence."** Editorial, monastic, Scandinavian-restrained
— closer to a philosophy press or a horologist's catalogue than a SaaS landing
page. Five adjectives: **disciplined, specific, philosophical** (Greek sense:
questions before claims), **honest** (especially about limits), **quiet** (the
opposite of frantic). The honesty *is* the differentiation: concede limits proudly
("business-hours support, founder-led, defined SEV tiers") rather than hiding them.

Emotional goal: the visitor should feel they are being told the truth by someone
who has clearly done the work — and that the artifact in front of them was
*curated, not generated*. The site must itself practice the product's posture:
governed, precise, evidence-bearing, unhurried.

Hard voice rules (full canon lives in the `sokrates-website` repo): no exclamation marks,
ever. No SaaS jargon (synergy/leverage/transform/seamless/unlock/empower/
next-generation/AI-first). No em-dash-free aphorism-spam. No "trusted by" logo
walls, no fake testimonials, no emoji. Sentence case headlines. "Sókrates" always
carries the acute ó in copy. Numeric-spine, parallel-structure headlines are the
signature ("Read by default. Propose with evidence. Act under a signed envelope.").

## Anti-references

What this must **not** look like:

- **The modal SaaS landing page.** Hero-metric template (big number / small label
  / gradient accent), identical icon-card grids, "trusted by" logo wall, feature
  matrix, pricing tiers. Sókrates publishes no tier pricing; it is bespoke.
- **The saturated editorial-typographic lane.** Display serif + tiny tracked mono
  eyebrow above every section + monochrome restraint + zero imagery is now an AI
  fingerprint. Sókrates shares ingredients with that lane (serif + mono +
  monochrome-plus-one-accent) — so the execution must escape it through
  asymmetry, real artifact imagery, and a
  single deliberate kicker system, not section-grammar eyebrows. *Restraint
  without intent reads as mediocre, not refined.*
- **The old `Design Sketch/DESIGN.md` literally.** It is the aesthetic *brief* (the
  "Digital Curator" north star is right), but its component recommendations —
  glassmorphism nav, 1px ghost-border inputs, ambient drop shadows — are patterns
  to beat, not follow. It is a floor.
- **"Digital startup" imagery.** No stock illustration, no glowing-circuit AI
  graphics, no diverse-smiling-team-in-modern-office. The aesthetic is *physical
  artifact* (stone, paper, brushed metal, the appliance), not digital startup.
- **Autonomous-agent / "the AI knows your business" framing.** Sókrates is a
  *governed participant*, not an autonomous agent. Never "trust the model."

## Design Principles

1. **The site is the product's first proof.** It should feel governed, precise,
   and curated — because that is what it sells. A generic execution refutes the
   pitch. Practice what you preach.
2. **Show, don't tell.** The composer lets the visitor watch the substrate reason
   over a real operation. One working demonstration beats five claim-shaped cards.
3. **Restraint with intent, never restraint by default.** Quiet is a deliberate
   posture (the beacon is rare; tonal layering, not lines) — not an excuse
   to ship the safe, average, invisible page. Commit to a POV.
4. **Second-meeting words stay gated.** The Greek lexicon (Hyle/Eidos/Demiurge/
   Aition, the four agents) is load-bearing on `/architecture` only. First-contact
   surfaces speak plain: the box, an AI department, the map, evidence, a signed
   envelope.
5. **Craft lives in the dialect layer; the system is the locked substrate; nothing
   else is holy.** The Morphe substrate is the design system; a dialect is one
   implementation and none is sacred — including the brand tokens, which are kept
   on merit, not seniority. Excellence is pursued by re-authoring dialects,
   compounds, and presenters (and killing whatever needs to die) — never by
   hardcoding color, bypassing the algebra, or editing the locked core.

## Accessibility & Inclusion

Target **WCAG 2.2 AA**, and the substrate enforces much of it structurally rather
than by convention (this is a differentiator worth preserving):

- An unlabelled input is *unrepresentable* — every Input carries a typed a11y
  label relation; an inaccessible tree is a type error.
- **Functional color is never the only signal** — status pairs tone with text +
  shape, alerts pair tone with a title, disclosure/toggle state is shape (chevron/
  thumb position), not color alone.
- Real `<button>`/`<a>` semantics (a clickable `<div>` is forbidden); overlays use
  the platform top layer (`<dialog>`/Popover API/`<details>`) for free focus trap,
  Escape, and restoration.
- Focus-visible rings on every interactive primitive; **reduced motion is honored**
  on every transition (a media query, not a JS hook) — non-negotiable.
- One light default ground (the gallery paper) with dark dialects a flip away
  (night, the Archive): verify body text ≥ 4.5:1 and large text ≥ 3:1 on every
  ground a surface can render under; light-on-dark type gets a line-height
  bump. Muted text must still clear 4.5:1 — do not let "quiet" drop contrast
  below the floor.
- Bilingual EN/IS; `html lang` follows the active locale. The user (founder, native
  Icelandic speaker) owns the canonical IS copy.
