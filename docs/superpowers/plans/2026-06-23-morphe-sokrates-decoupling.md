# Morphe / Sokrates Website Decoupling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Decouple Morphe from the Sokrates marketing website by replacing `sokrates-website` with the current Morphe/SvelteKit implementation of the live site, consuming Morphe through the real `@rationallyprime/morphe` package seam, then removing Sokrates-specific routes, copy, assets, and deployment ownership from the Morphe repo.

**Architecture:** Morphe becomes the substrate package plus Morphe-local CMS/API/MCP surface plus a neutral playground. `sokrates-website` becomes the host application: routes, copy, native controls, composer UI, Sokrates assets, form side effects, and production deployment. The host imports Morphe only through package exports: `@rationallyprime/morphe`, `@rationallyprime/morphe/components`, and `@rationallyprime/morphe/styles.css`.

**Tech Stack:** SvelteKit 2, Svelte 5, TypeScript strict, Bun, Biome, Vitest, Vercel adapter, `@rationallyprime/morphe` from GitHub Packages, Vercel production deployment.

---

## File Structure

### Morphe Repo

Worktree branch:

`/tmp/morphe-decouple-sokrates-site` on `migration/decouple-sokrates-site`

Files to keep Morphe-owned:

```
src/lib/**
src/routes/substrate/**
src/routes/_demo/**
src/routes/p/**
src/routes/preview/**
py/morphe_grammar/**
py/morphe_cms/**
schema/**
scripts/pack-verify.ts
PACKAGING.md
CONTRACT.md
CONTEXT.md
VISION.md
docs/adr/**
docs/superpowers/**
```

Files to remove from Morphe after website replacement is verified:

```
src/app/site/**
src/app/compose/**
src/app/server/**
src/routes/+page.svelte
src/routes/+layout.server.ts
src/routes/how-it-works/**
src/routes/architecture/**
src/routes/onboarding/**
src/routes/compose/**
src/routes/api/contact/**
src/routes/api/onboarding/**
src/routes/api/rerank/**
assets/plates/**
static/images/plates/**
static/images/sokrates-mark.svg
static/sokrates-mark.svg
static/images/the-box.png
static/images/reykjavik-arch.png
static/images/team/**
static/favicon.svg
```

Files to add or update in Morphe:

```
docs/superpowers/plans/2026-06-23-morphe-sokrates-decoupling.md
docs/superpowers/specs/2026-06-23-morphe-sokrates-decoupling-inventory.md
docs/adr/0008-replace-sokrates-website-with-morphe-consumer.md
docs/adr/0009-keep-morphe-cms-behind-service-seam.md
docs/adr/0010-keep-full-featured-morphe-playground.md
docs/adr/0011-move-sokrates-plate-assets-out-of-morphe.md
docs/adr/0012-cut-over-sokrates-production-deployment-to-website-repo.md
docs/adr/0013-split-morphe-and-sokrates-documentation.md
src/test-fixtures/cms/render-smoke.test.ts
src/test-fixtures/cms/capability-page.tree.json
```

### Sokrates Website Repo

Worktree branch:

`/tmp/sokrates-website-morphe-site` on `migration/morphe-sveltekit-site`

Files to move from Morphe into `sokrates-website`:

```
src/app/site/**
src/app/compose/**
src/app/server/**
src/routes/+page.svelte
src/routes/+layout.svelte
src/routes/+layout.server.ts
src/routes/how-it-works/**
src/routes/architecture/**
src/routes/onboarding/**
src/routes/compose/**
src/routes/api/contact/**
src/routes/api/onboarding/**
src/routes/api/rerank/**
src/app.html
src/app.css
static/images/sokrates-mark.svg
static/sokrates-mark.svg
static/images/the-box.png
static/images/reykjavik-arch.png
static/images/team/**
static/images/plates/**
assets/plates/**
scripts/derive-plates.ts
scripts/plate-manifest.ts
scripts/plate-manifest.test.ts
scripts/embed-corpus.ts
scripts/build-evidence.ts
data/evidence/**
data/specs/**
data/bamboohr-public-openapi.yaml
data/capability-seed.md
data/specs-scope.md
```

Files to replace in `sokrates-website`:

```
package.json
bunfig.toml
bun.lock
svelte.config.js
vite.config.ts
tsconfig.json
tsconfig.node.json
biome.json
vercel.json
.gitignore
```

---

## Task 1: Commit the Decision Record and Create Isolated Worktrees

This task preserves the design record before implementation branches start moving code.

### Steps

- [ ] From the current Morphe worktree, inspect the pending documentation changes.

```bash
git status --short
git diff -- CONTEXT.md docs/superpowers/specs/2026-06-23-morphe-sokrates-decoupling-inventory.md docs/adr
```

- [ ] Add the accepted decision artifacts.

```bash
git add CONTEXT.md \
  docs/superpowers/specs/2026-06-23-morphe-sokrates-decoupling-inventory.md \
  docs/superpowers/plans/2026-06-23-morphe-sokrates-decoupling.md \
  docs/adr/0008-replace-sokrates-website-with-morphe-consumer.md \
  docs/adr/0009-keep-morphe-cms-behind-service-seam.md \
  docs/adr/0010-keep-full-featured-morphe-playground.md \
  docs/adr/0011-move-sokrates-plate-assets-out-of-morphe.md \
  docs/adr/0012-cut-over-sokrates-production-deployment-to-website-repo.md \
  docs/adr/0013-split-morphe-and-sokrates-documentation.md
```

- [ ] Commit the decision record.

```bash
git commit -m "docs: record morphe and sokrates decoupling decisions"
```

- [ ] Preserve the dirty state in the existing `sokrates-website` checkout before creating a replacement branch.

```bash
mkdir -p /tmp/morphe-sokrates-migration-2026-06-23
git -C /home/rationallyprime/projects/sokrates-website status --short > /tmp/morphe-sokrates-migration-2026-06-23/sokrates-website-status-before.txt
git -C /home/rationallyprime/projects/sokrates-website diff > /tmp/morphe-sokrates-migration-2026-06-23/sokrates-website-diff-before.patch
git -C /home/rationallyprime/projects/sokrates-website ls-files --others --exclude-standard > /tmp/morphe-sokrates-migration-2026-06-23/sokrates-website-untracked-before.txt
```

- [ ] Create the Morphe execution worktree from the committed planning branch.

```bash
git -C /home/rationallyprime/projects/morphe worktree add /tmp/morphe-decouple-sokrates-site HEAD -b migration/decouple-sokrates-site
```

- [ ] Create the `sokrates-website` execution worktree from `origin/main`.

```bash
git -C /home/rationallyprime/projects/sokrates-website fetch origin
git -C /home/rationallyprime/projects/sokrates-website worktree add /tmp/sokrates-website-morphe-site origin/main -b migration/morphe-sveltekit-site
```

### Verification

- [ ] `git -C /tmp/morphe-decouple-sokrates-site status --short --branch` shows branch `migration/decouple-sokrates-site`.
- [ ] `git -C /tmp/sokrates-website-morphe-site status --short --branch` shows branch `migration/morphe-sveltekit-site`.
- [ ] `/tmp/morphe-sokrates-migration-2026-06-23/sokrates-website-status-before.txt` records the original dirty files.

---

## Task 2: Prove the Morphe Package Seam Before Moving the Website

This task makes the package seam the only allowed coupling point before the website is replaced.

### Steps

- [ ] In `/tmp/morphe-decouple-sokrates-site`, move the CMS render smoke fixture out of `src/lib` so package library code remains substrate-only.

Move:

```
src/lib/cms/render-smoke.test.ts
src/lib/cms/fixtures/capability-page.tree.json
```

To:

```
src/test-fixtures/cms/render-smoke.test.ts
src/test-fixtures/cms/capability-page.tree.json
```

- [ ] Update `src/test-fixtures/cms/render-smoke.test.ts` imports to this exact shape.

```ts
import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";
import type { Node } from "../../lib/grammar/types.js";
import MorpheRoot from "../../lib/render/MorpheRoot.svelte";
import tree from "./capability-page.tree.json";
```

- [ ] Confirm `package.json` still exports only package seams:

```json
{
  ".": {
    "types": "./dist/index.d.ts",
    "svelte": "./dist/index.js",
    "default": "./dist/index.js"
  },
  "./components": {
    "types": "./dist/components.d.ts",
    "svelte": "./dist/components.js",
    "default": "./dist/components.js"
  },
  "./tokens": {
    "types": "./dist/tokens.d.ts",
    "default": "./dist/tokens.js"
  },
  "./styles.css": "./dist/styles.css",
  "./tokens.css": "./dist/tokens.css",
  "./intents.css": "./dist/intents.css",
  "./primitives.css": "./dist/primitives.css"
}
```

- [ ] Fix `.github/workflows/publish.yml` triggers so package publication can happen from version tags and package dry-runs can run on PRs. The `on:` block must include:

```yaml
on:
  workflow_dispatch:
  push:
    tags:
      - "v*"
  pull_request:
    paths:
      - "package.json"
      - "bun.lock"
      - "src/lib/**"
      - "scripts/pack-verify.ts"
      - ".github/workflows/publish.yml"
```

- [ ] Run the local Morphe gates.

```bash
cd /tmp/morphe-decouple-sokrates-site
just gates
```

- [ ] Verify a consumer can install and render the currently published package.

```bash
cd /tmp/morphe-decouple-sokrates-site
MORPHE_VERIFY_PACKAGE=0.3.0 bun run registry:verify
```

- [ ] If registry verification fails because `0.3.0` is absent, publish a real package version before website migration. Use a patch bump only if GitHub Packages already contains immutable `0.3.0` with different contents.

```bash
cd /tmp/morphe-decouple-sokrates-site
bun run package
```

When bumping is required, set `package.json` version to `0.3.1`, run `bun install`, run `just gates`, tag `v0.3.1`, and publish through the fixed workflow.

### Verification

- [ ] `just gates` passes in `/tmp/morphe-decouple-sokrates-site`.
- [ ] `MORPHE_VERIFY_PACKAGE=0.3.0 bun run registry:verify` passes, or the replacement version is recorded in `PACKAGING.md` and in the website dependency.
- [ ] `git diff -- src/lib` does not introduce Sokrates host application code into Morphe package source.

---

## Task 3: Replace `sokrates-website` with the SvelteKit Host App

This task replaces the older Next/React ancestor with the current live Sokrates implementation, consuming Morphe as a package.

### Steps

- [ ] In `/tmp/sokrates-website-morphe-site`, remove the old Next application source and config using git-aware deletes for tracked files.

```bash
cd /tmp/sokrates-website-morphe-site
git rm -r src app components public styles next.config.* middleware.* tailwind.config.* postcss.config.* || true
git rm package.json pnpm-lock.yaml pnpm-workspace.yaml || true
```

- [ ] Copy Sokrates host-owned code from Morphe into the website worktree.

```bash
cd /tmp/sokrates-website-morphe-site
mkdir -p src/routes src/app static/images assets scripts
cp -R /tmp/morphe-decouple-sokrates-site/src/app/site src/app/site
cp -R /tmp/morphe-decouple-sokrates-site/src/app/compose src/app/compose
cp -R /tmp/morphe-decouple-sokrates-site/src/app/server src/app/server
cp -R /tmp/morphe-decouple-sokrates-site/src/routes/+page.svelte src/routes/+page.svelte
cp -R /tmp/morphe-decouple-sokrates-site/src/routes/+layout.svelte src/routes/+layout.svelte
cp -R /tmp/morphe-decouple-sokrates-site/src/routes/+layout.server.ts src/routes/+layout.server.ts
cp -R /tmp/morphe-decouple-sokrates-site/src/routes/how-it-works src/routes/how-it-works
cp -R /tmp/morphe-decouple-sokrates-site/src/routes/architecture src/routes/architecture
cp -R /tmp/morphe-decouple-sokrates-site/src/routes/onboarding src/routes/onboarding
cp -R /tmp/morphe-decouple-sokrates-site/src/routes/compose src/routes/compose
mkdir -p src/routes/api
cp -R /tmp/morphe-decouple-sokrates-site/src/routes/api/contact src/routes/api/contact
cp -R /tmp/morphe-decouple-sokrates-site/src/routes/api/onboarding src/routes/api/onboarding
cp -R /tmp/morphe-decouple-sokrates-site/src/routes/api/rerank src/routes/api/rerank
cp /tmp/morphe-decouple-sokrates-site/src/app.html src/app.html
cp /tmp/morphe-decouple-sokrates-site/src/app.css src/app.css
cp -R /tmp/morphe-decouple-sokrates-site/static/images static/images
cp /tmp/morphe-decouple-sokrates-site/static/sokrates-mark.svg static/sokrates-mark.svg
cp -R /tmp/morphe-decouple-sokrates-site/assets/plates assets/plates
cp /tmp/morphe-decouple-sokrates-site/scripts/derive-plates.ts scripts/derive-plates.ts
cp /tmp/morphe-decouple-sokrates-site/scripts/plate-manifest.ts scripts/plate-manifest.ts
cp /tmp/morphe-decouple-sokrates-site/scripts/plate-manifest.test.ts scripts/plate-manifest.test.ts
cp /tmp/morphe-decouple-sokrates-site/scripts/embed-corpus.ts scripts/embed-corpus.ts
cp /tmp/morphe-decouple-sokrates-site/scripts/build-evidence.ts scripts/build-evidence.ts
mkdir -p data
cp -R /tmp/morphe-decouple-sokrates-site/data/evidence data/evidence
cp -R /tmp/morphe-decouple-sokrates-site/data/specs data/specs
cp /tmp/morphe-decouple-sokrates-site/data/bamboohr-public-openapi.yaml data/bamboohr-public-openapi.yaml
cp /tmp/morphe-decouple-sokrates-site/data/capability-seed.md data/capability-seed.md
cp /tmp/morphe-decouple-sokrates-site/data/specs-scope.md data/specs-scope.md
```

- [ ] Add `package.json` as a Bun/SvelteKit host app. Use the Morphe version proven in Task 2.

```json
{
  "name": "sokrates-website",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "packageManager": "bun@1.3.11",
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "preview": "vite preview",
    "check": "svelte-kit sync && svelte-check --tsconfig ./tsconfig.json",
    "test": "vitest run",
    "lint": "biome check .",
    "format": "biome check --write .",
    "codegen": "orval --config ./orval.config.ts",
    "embed": "bun scripts/embed-corpus.ts",
    "plates": "bun scripts/derive-plates.ts"
  },
  "dependencies": {
    "@rationallyprime/morphe": "0.3.0",
    "@sveltejs/adapter-vercel": "5.10.2",
    "@sveltejs/kit": "2.49.0",
    "@sveltejs/vite-plugin-svelte": "6.2.1",
    "@tanstack/svelte-query": "5.90.12",
    "dotenv": "17.2.3",
    "orval": "7.16.1",
    "zod": "4.1.13"
  },
  "devDependencies": {
    "@biomejs/biome": "2.3.8",
    "@sveltejs/package": "2.5.5",
    "@testing-library/jest-dom": "6.9.1",
    "@testing-library/svelte": "5.2.9",
    "@types/node": "25.0.3",
    "jsdom": "27.3.0",
    "typescript": "5.9.3",
    "vite": "7.2.7",
    "vitest": "4.0.16",
    "yaml": "2.8.2"
  }
}
```

- [ ] Add `bunfig.toml` so Bun installs Morphe from GitHub Packages.

```toml
[install.scopes]
"@rationallyprime" = { url = "https://npm.pkg.github.com", token = "$GITHUB_PACKAGES_TOKEN" }
```

- [ ] Copy SvelteKit, Vite, TypeScript, and Biome config from Morphe, then delete package-builder-only settings from the website app.

Copy:

```
/tmp/morphe-decouple-sokrates-site/svelte.config.js
/tmp/morphe-decouple-sokrates-site/vite.config.ts
/tmp/morphe-decouple-sokrates-site/tsconfig.json
/tmp/morphe-decouple-sokrates-site/tsconfig.node.json
/tmp/morphe-decouple-sokrates-site/biome.json
```

Website aliases in `svelte.config.js` must include:

```js
alias: {
  $site: "src/app/site",
  $compose: "src/app/compose",
  $serverlib: "src/app/server"
}
```

- [ ] Replace Morphe source imports with package imports.

Required rewrites:

```
"$lib/styles.css" -> "@rationallyprime/morphe/styles.css"
"$lib/components" -> "@rationallyprime/morphe/components"
"$lib" -> "@rationallyprime/morphe"
```

Use `rg` to locate remaining package-boundary violations:

```bash
cd /tmp/sokrates-website-morphe-site
rg 'from "\$lib|from '\''\$lib|"\$lib/|'\''\$lib/' src
```

- [ ] Create `src/routes/dignity/+page.ts` as a compatibility redirect away from the removed Morphe substrate demo.

```ts
import { redirect } from "@sveltejs/kit";

export function load(): never {
  redirect(308, "/how-it-works");
}
```

- [ ] Keep `/compose` as the existing redirect to `/`.

- [ ] Remove any copied Morphe-only routes from the website worktree:

```
src/routes/substrate/**
src/routes/_demo/**
src/routes/p/**
src/routes/preview/**
src/routes/api/adaptive/**
```

- [ ] Replace `vercel.json` with a SvelteKit-compatible minimal file.

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json"
}
```

### Verification

- [ ] `rg 'from "\$lib|"\$lib/|from '\''\$lib|'\''\$lib/' src` returns no matches in `/tmp/sokrates-website-morphe-site`.
- [ ] `rg 'substrate|Morphe CMS|morphe_cms|/preview|/p/\[slug\]' src static assets` returns only intentional prose or no matches.
- [ ] `git status --short` shows the Next app replaced by SvelteKit files and no accidental `node_modules`, `.svelte-kit`, `.vercel/output`, `.next`, or `dist` files.

---

## Task 4: Validate the Website as a Real Morphe Consumer

This task proves the website builds and behaves without reaching into the Morphe repo.

### Steps

- [ ] Install website dependencies with Bun.

```bash
cd /tmp/sokrates-website-morphe-site
bun install
```

- [ ] Run the website gates.

```bash
cd /tmp/sokrates-website-morphe-site
bun run lint
bun run check
bun run test
bun run build
```

- [ ] Start the website locally on a non-default port for smoke verification.

```bash
cd /tmp/sokrates-website-morphe-site
bun run dev --host 127.0.0.1 --port 5174
```

- [ ] Smoke the main routes.

```bash
curl -sS -o /tmp/sokrates-root.html -w "%{http_code}\n" http://127.0.0.1:5174/
curl -sS -o /tmp/sokrates-how.html -w "%{http_code}\n" http://127.0.0.1:5174/how-it-works
curl -sS -o /tmp/sokrates-architecture.html -w "%{http_code}\n" http://127.0.0.1:5174/architecture
curl -sS -o /tmp/sokrates-onboarding.html -w "%{http_code}\n" http://127.0.0.1:5174/onboarding
curl -sS -o /tmp/sokrates-compose-redirect.html -w "%{http_code} %{redirect_url}\n" http://127.0.0.1:5174/compose
```

- [ ] Smoke graceful server behavior when optional env vars are absent.

```bash
curl -sS -o /tmp/sokrates-contact.json -w "%{http_code}\n" \
  -H "content-type: application/json" \
  --data '{"name":"Local Smoke","email":"smoke@example.com","message":"Testing missing-env behavior"}' \
  http://127.0.0.1:5174/api/contact

curl -sS -o /tmp/sokrates-onboarding-link.json -w "%{http_code}\n" \
  -H "content-type: application/json" \
  --data '{"email":"smoke@example.com"}' \
  http://127.0.0.1:5174/api/onboarding/request-link
```

- [ ] Inspect generated HTML for Morphe render output and Sokrates assets.

```bash
rg 'Sokrates|Sókrates|mo-root|sokrates-mark|the-box|plates' /tmp/sokrates-root.html /tmp/sokrates-how.html /tmp/sokrates-architecture.html /tmp/sokrates-onboarding.html
```

### Verification

- [ ] All website gates pass.
- [ ] All route smoke requests return expected HTTP status codes: pages `200`, `/compose` redirect `3xx`, API endpoints no unhandled `500`.
- [ ] Browser smoke confirms:
  - [ ] `/` renders the composer and intent-stage interaction.
  - [ ] `/how-it-works` renders.
  - [ ] `/architecture` renders.
  - [ ] `/onboarding` renders progress/confirmation flow.
  - [ ] Sokrates mark, box, Reykjavik arch, and plate images load from the website repo.

---

## Task 5: Cut Production Deployment Ownership to `sokrates-website`

This task moves live Sokrates deployment responsibility out of Morphe and into the website repo.

### Steps

- [ ] In `/tmp/sokrates-website-morphe-site`, verify the existing Vercel project linkage before changing deployment state.

Expected current linkage from `.vercel/repo.json`:

```json
{
  "projects": [
    {
      "id": "prj_6HHnuT3oywzd3IjMZlBEBV73tY8u",
      "name": "sokrates-ai",
      "directory": ".",
      "orgId": "team_ql28y8VgWlwURB8BxICpyesR"
    }
  ]
}
```

- [ ] Use the Vercel project/API surface during execution to verify the Morphe production project, the website production project, production env vars, and attached domains before cutover. Record the result in `/tmp/morphe-sokrates-migration-2026-06-23/vercel-cutover-before.txt` without printing secret values.

Required production env keys for the website project:

```
VOYAGE_API_KEY
POSTMARK_SERVER_TOKEN
MAGIC_LINK_SECRET
SOKRATES_EMAIL_FROM
SOKRATES_EMAIL_TO
```

Optional production env keys:

```
NTFY_TOPIC
NTFY_TOKEN
```

- [ ] Deploy the website branch to a Vercel preview from the website project.

```bash
cd /tmp/sokrates-website-morphe-site
bunx vercel deploy --yes
```

- [ ] Smoke the preview deployment:

```
/
/how-it-works
/architecture
/onboarding
/compose
/api/contact
/api/onboarding/request-link
```

- [ ] After preview verification, deploy the website branch to production.

```bash
cd /tmp/sokrates-website-morphe-site
bunx vercel deploy --prod --yes
```

- [ ] Move the Sokrates production domain from the Morphe Vercel project to the website Vercel project. Use the Vercel API/dashboard/CLI path available in the execution environment, and record the before/after project-domain mapping in:

```
/tmp/morphe-sokrates-migration-2026-06-23/vercel-domain-cutover.txt
```

- [ ] Smoke the production domain after DNS/Vercel routing settles:

```bash
curl -sS -o /tmp/sokrates-prod-root.html -w "%{http_code}\n" https://sokrates.ai/
curl -sS -o /tmp/sokrates-prod-how.html -w "%{http_code}\n" https://sokrates.ai/how-it-works
curl -sS -o /tmp/sokrates-prod-architecture.html -w "%{http_code}\n" https://sokrates.ai/architecture
curl -sS -o /tmp/sokrates-prod-onboarding.html -w "%{http_code}\n" https://sokrates.ai/onboarding
```

Use the actual production domain if Vercel shows a different canonical Sokrates domain.

### Verification

- [ ] Preview deployment succeeds from `sokrates-website`.
- [ ] Production deployment succeeds from `sokrates-website`.
- [ ] Production domain serves the SvelteKit/Morphe consumer implementation.
- [ ] Production pages and assets do not depend on the Morphe Vercel project.
- [ ] Production composer, contact, onboarding link request, and rerank behavior match the current live behavior.

---

## Task 6: Remove Sokrates Website Ownership from Morphe

This task cleans Morphe after the website branch is proven and the deployment cutover is stable.

### Steps

- [ ] In `/tmp/morphe-decouple-sokrates-site`, remove Sokrates host application code.

```bash
cd /tmp/morphe-decouple-sokrates-site
git rm -r src/app/site src/app/compose src/app/server
git rm -r src/routes/how-it-works src/routes/architecture src/routes/onboarding src/routes/compose
git rm -r src/routes/api/contact src/routes/api/onboarding src/routes/api/rerank
git rm src/routes/+page.svelte src/routes/+layout.server.ts
```

- [ ] Replace the root route with a Morphe product/playground entry route that contains no Sokrates copy. The route must point users to the neutral playground and to package documentation.

Required route files:

```
src/routes/+page.svelte
src/app/playground/**
```

- [ ] Preserve Morphe-owned CMS preview routes:

```
src/routes/preview/**
src/routes/p/**
```

- [ ] Preserve and reframe `/substrate` as Morphe's playground surface. It must demonstrate:

```
grammar node tree rendering
dialect switching across all shipped dialects
context algebra through nested roles
intent remapping
compound expansion
input primitives with typed a11y labels
feedback primitives with non-color signals
action ids through MorpheRoot.actions
bind paths through the client store
Vary-driven alternate branches
media primitive rendering with neutral demo assets
CMS-published artifact rendering through /preview and /p
```

- [ ] Remove Sokrates assets from Morphe after confirming they exist in `sokrates-website`.

```bash
cd /tmp/morphe-decouple-sokrates-site
git rm -r assets/plates static/images/plates static/images/team
git rm static/images/sokrates-mark.svg static/sokrates-mark.svg static/images/the-box.png static/images/reykjavik-arch.png static/favicon.svg
```

- [ ] Add Morphe neutral demo assets under:

```
static/images/demo/morphe-surface-01.png
static/images/demo/morphe-surface-02.png
static/images/demo/morphe-surface-03.png
```

The assets must be non-Sokrates, non-Timaeus, and reusable as product-neutral playground imagery.

- [ ] Split mixed documentation:

Morphe keeps and revises:

```
CONTEXT.md
CONTRACT.md
VISION.md
STATUS.md
PACKAGING.md
docs/adr/**
docs/agents/**
docs/reconstruction-plan.md
MIGRATION.md
```

Sokrates-specific material moves to `sokrates-website`:

```
PRODUCT.md
DESIGN.md
marketing-context.md
onboarding/contact/composer/stage docs
plate-generation docs
deployment notes for the public site
```

- [ ] Update Morphe `AGENTS.md` and `CLAUDE.md` to remove statements that Morphe deploys the public Sokrates site. They must state:

```
Morphe is the package/CMS/playground repo.
The Sokrates website lives in /home/rationallyprime/projects/sokrates-website.
The website consumes @rationallyprime/morphe as a package.
The Morphe repo does not own Sokrates production routes, brand assets, or deployment.
```

- [ ] Update package docs to make the host application seam explicit.

Required consumer import examples:

```ts
import "@rationallyprime/morphe/styles.css";
import type { Node } from "@rationallyprime/morphe";
import { MorpheRoot } from "@rationallyprime/morphe/components";
```

### Verification

- [ ] `rg 'Sókrates|Sokrates|Timaeus|plate|the-box|reykjavik|sokrates-mark|POSTMARK|MAGIC_LINK|VOYAGE_API_KEY' src static assets docs AGENTS.md CLAUDE.md` returns only intentional archived references, ADR history, or migration notes.
- [ ] `just gates` passes in `/tmp/morphe-decouple-sokrates-site`.
- [ ] `bun run package` passes.
- [ ] `bun run pack:verify` passes for local package shape.
- [ ] `MORPHE_VERIFY_PACKAGE=0.3.0 bun run registry:verify` passes, or the bumped version passes if Task 2 changed it.
- [ ] Local browser smoke confirms `/`, `/substrate`, `/preview/...`, and `/p/...` render without Sokrates-specific content.

---

## Task 7: Final Cross-Repo Verification, Merge, and Closeout

This task finishes only after both branches are independently verified.

### Steps

- [ ] Record final verification commands and results in:

```
/tmp/morphe-sokrates-migration-2026-06-23/final-verification.txt
```

Required entries:

```
Morphe branch:
  just gates
  bun run package
  registry or pack verification

Website branch:
  bun run lint
  bun run check
  bun run test
  bun run build
  local smoke routes
  preview deployment smoke
  production deployment smoke
```

- [ ] Commit the Morphe cleanup branch.

```bash
cd /tmp/morphe-decouple-sokrates-site
git status --short
git add .
git commit -m "refactor: decouple sokrates website from morphe"
```

- [ ] Commit the Sokrates website replacement branch.

```bash
cd /tmp/sokrates-website-morphe-site
git status --short
git add .
git commit -m "refactor: replace site with morphe consumer"
```

- [ ] Merge to each repo's `main` only after production verification is stable.

```bash
git -C /home/rationallyprime/projects/sokrates-website fetch origin
git -C /home/rationallyprime/projects/sokrates-website checkout main
git -C /home/rationallyprime/projects/sokrates-website merge --ff-only migration/morphe-sveltekit-site

git -C /home/rationallyprime/projects/morphe fetch origin
git -C /home/rationallyprime/projects/morphe checkout main
git -C /home/rationallyprime/projects/morphe merge --ff-only migration/decouple-sokrates-site
```

- [ ] If `--ff-only` fails, stop and inspect divergence. Do not force-push and do not rewrite `main`.

- [ ] Push only after both `main` branches contain the verified commits and the user explicitly approves remote publication.

### Verification

- [ ] `sokrates-website/main` serves the production website and owns deployment.
- [ ] `morphe/main` has no Sokrates production website code or deployment ownership.
- [ ] The package seam remains the only coupling point.
- [ ] No untracked migration artifacts remain in either repo.

---

## Parallel Execution Map

Use subagents only after Task 1 creates the execution worktrees.

```
Agent A: Task 2, Morphe package seam and publish workflow.
Agent B: Task 3 and Task 4, Sokrates website replacement and local verification.
Agent C: Task 5, Vercel environment/deployment cutover verification.
Agent D: Task 6, Morphe cleanup and neutral playground.
Main agent: sequencing, conflict resolution, final cross-repo verification, merges.
```

Ordering constraints:

```
Task 1 before all tasks.
Task 2 before Task 3 dependency install.
Task 4 before Task 5 production deploy.
Task 5 production smoke before Task 6 deletes Sokrates site from Morphe.
Task 6 before final Morphe merge.
Task 7 last.
```

---

## Acceptance Criteria

- [ ] `sokrates-website` is a SvelteKit app that imports Morphe from `@rationallyprime/morphe`, not from Morphe source paths.
- [ ] Sokrates production pages, composer, onboarding, contact, assets, and metadata live in `sokrates-website`.
- [ ] Morphe keeps the substrate package, Morphe-local CMS/API/MCP surface, and a neutral full-featured playground.
- [ ] Timaeus/plate/Sokrates brand assets are absent from Morphe except in ADR or migration history.
- [ ] Vercel production deployment for the public Sokrates site belongs to `sokrates-website`.
- [ ] Both repos pass their gates before merge.
- [ ] Both repos stay on separate branches/worktrees until the migration is verified stable.

---

## Self-Review Checklist

- [ ] The plan uses the accepted domain split: substrate/package/CMS/playground vs host website.
- [ ] The plan consumes Morphe through the real package seam.
- [ ] The plan includes production deployment cutover.
- [ ] The plan preserves current live Sokrates behavior before Morphe cleanup.
- [ ] The plan names the files and commands each subagent needs.
- [ ] The plan leaves no Sokrates-specific production ownership in Morphe.
