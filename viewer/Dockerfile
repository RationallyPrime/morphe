# Box viewer image (KRA-648 / MO-D3) — STRIPPED standalone viewer.
#
# Build from the REPO ROOT so the shared $lib rides in:
#   docker build -f viewer/Dockerfile -t morphe-viewer .
#
# Runtime contract:
#   MORPHE_SOURCES            exact v3 board envelope: dimensions, declared
#                             source-v1 mounts, trust policy, route-only panes,
#                             and joins.
#   VIEWER_*_TOKEN            optional named kernel bearer tokens, referenced
#                             only through MORPHE_SOURCES and never sent to the
#                             browser.
#   PORT                      listen port (default 3000)
#
# Publish LAN-only (topos :8000 posture); NEVER behind a cloudflared route.

FROM oven/bun:1.3.11 AS build
WORKDIR /repo
COPY package.json bun.lock ./
COPY viewer/package.json viewer/
RUN bun install --frozen-lockfile
COPY tsconfig.json vite.config.ts svelte.config.js ./
COPY src src
COPY static static
COPY scripts/compiler-build-id.ts scripts/compiler-build-id.ts
COPY viewer viewer
ENV MORPHE_VIEWER_ADAPTER=node
# Root svelte-kit sync first: src/lib files resolve the ROOT tsconfig.json,
# which extends the root app's generated .svelte-kit/tsconfig.json.
RUN bun run compiler-id:check && bun x svelte-kit sync && cd viewer && bun x vite build

# The adapter-node output is fully self-contained (verified: boots with no
# node_modules), so the final stage carries only the build tree + probe.
FROM gcr.io/distroless/nodejs22-debian12:nonroot
WORKDIR /app
COPY --from=build /repo/viewer/build ./
COPY --from=build /repo/viewer/healthcheck.mjs ./healthcheck.mjs
ENV NODE_ENV=production
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
	CMD ["/nodejs/bin/node", "/app/healthcheck.mjs"]
CMD ["index.js"]
