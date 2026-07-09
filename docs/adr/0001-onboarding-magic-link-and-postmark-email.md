# ADR-0001 — Onboarding behind a stateless magic-link; Postmark for transactional email

- **Status:** Accepted — superseded in scope by ADR-0008/ADR-0012
- **Date:** 2026-06-09
- **Deciders:** Hákon (founder), grill session on KRA-274 / D1
- **Related:** `docs/redesign-plan.md` (D1, WS8), PRODUCT.md (buyers, sovereignty), CLAUDE.md (native-control-surface idiom)

> **Superseded:** the onboarding/magic-link mechanism this ADR describes moved
> to the `sokrates-website` repo in the 2026-06-23 decoupling (ADR-0008,
> ADR-0012) and no longer lives in this repo. Kept as historical record.

## Context

The Sókrates marketing site has two outward actions after the home redesign: an open
**"Talk to us"** conversation (the founder-led sale's main motion) and a structured
multi-step **onboarding** intake. D1 resolved that onboarding *stays and is prominent*
but must not be a co-equal amber beacon, and that it should be **gated** to qualify
leads — without blocking the open conversation.

Two facts constrain the build:

1. **No visitor email today.** The existing `/api/contact` and `/api/onboarding`
   endpoints forward an **ntfy notification to the founder**. They cannot send an
   email *to a visitor*, which a magic link requires. So a gate implies a new
   outbound transactional-email dependency.
2. **`adapter-vercel`, stateless serverless.** There is no first-party session store
   or database in this project, and the brand posture (PRODUCT.md) is *sovereign,
   no-lock-in, exit-symmetric*. Any auth mechanism should avoid standing
   infrastructure and third-party auth platforms.

## Decision

1. **Gate `/onboarding` behind a stateless magic link.** The link carries an **HMAC**
   token: `HMAC(secret, email + exp)` with a short expiry, signed by a server-only
   `MAGIC_LINK_SECRET`. The route verifies the signature and expiry. **No session
   store, no database, no JWT library required** beyond HMAC. With no valid token the
   route renders an **email-capture gate screen** (native control surface, in the
   `--mo-*` token idiom) that triggers the link email.
2. **Adopt Postmark as the transactional-email provider.** It sends (a) the magic
   link to the **visitor**, and (b) lead notifications to **`hakon@sokrates.is`** for
   both contact submissions and onboarding-started events. Postmark becomes the
   canonical notifier; the existing **ntfy-to-founder** push may remain as an optional
   instant ping (it already degrades gracefully when its env is absent).
3. **Graceful degradation.** Missing `POSTMARK_SERVER_TOKEN` / `MAGIC_LINK_SECRET` /
   `FROM` behaves like the existing `/api/rerank` posture — the surface never shows an
   error; the gate degrades to the open conversation path.

## Consequences

**Positive**
- Onboarding qualifies leads (proves email ownership, captures the address for
  follow-up and attribution) without adding password/login friction.
- Zero standing infrastructure: stateless tokens fit `adapter-vercel` and keep the
  sovereignty/no-lock-in posture (no auth SaaS, no session DB).
- The conversion conversation ("Talk to us") stays fully open — the gate is on the
  higher-commitment path only.

**Negative / costs**
- **New dependency + DNS work:** Postmark requires a verified sender signature / DKIM
  + SPF on `sokrates.is` before visitor mail delivers reliably. This is a prerequisite,
  not optional.
- **Stateless tokens cannot be revoked**, only expired. Mitigation: short expiry; the
  token grants access to a read-only intake form, not sensitive data, so the blast
  radius of a leaked link is low.
- A US email provider now sits in the marketing funnel. Acceptable because the
  *marketing site* is not the appliance — the sovereignty guarantee is about the
  customer's operational data, which never touches this surface.

## Alternatives considered

- **Session/DB-backed auth** (Lucia, a KV store, Vercel Postgres): real revocation and
  richer sessions, but introduces standing state and infrastructure for a gate that
  only needs "prove you own this email." Rejected as over-built.
- **A hosted auth provider** (Clerk/Auth0/Supabase Auth): fastest to wire, but adds a
  third-party identity dependency and lock-in that cuts against the brand posture, for
  a single low-stakes gate. Rejected.
- **Leave onboarding open** (no gate): simplest, but loses lead qualification and
  reintroduces onboarding as a naked co-equal CTA — the thing D1 demoted. Rejected.
- **OTP code instead of a link:** equivalent security, more friction (type a code),
  and still needs the same outbound-email provider. Rejected in favour of one-click.
