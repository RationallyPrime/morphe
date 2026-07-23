# Morphe box viewer

The stripped standalone viewer app (KRA-648 / MO-D3): SSR routes + `/healthz`
over the shared `$lib` renderer/dialects/tokens. Deliberately NOT the
playground app — no decision endpoint, no outbound proxy surface.

## Routes

| Route | What it renders |
| -- | -- |
| `/` | Source index: every configured source and its declared surfaces |
| `/s/[source]/[surfaceId]` | A declared surface from a configured source |
| `/healthz` | Liveness + the supported `grammar_version` |

Every render path runs the same trust gate: generated-schema validation of the
compiled artifact, dialect-mask enforcement, and the fail-closed grammar gate —
a foreign `grammar_version` renders a 409 diagnostic naming both versions,
never a silent partial render (MO-D5). `?dialect=` overrides the pane dialect
when it names a shipped dialect.

Kernel entries admit signed `source-v1` testimony only (KRA-775 Stage 5): the
viewer negotiates the source-v1 media type, verifies and compiles the testimony
at the viewer edge, then runs the same grammar and dialect gates. The store
reader and the legacy compiled-tree reader are retired — a config declaring
either fails closed. Link rewriting is inside the final gate, and the load
result carries a dialect-aware delivery receipt for the exact tree that renders.

## Configuration (KRA-752 §4)

`MORPHE_SOURCES` — one exact version-2 board envelope. The former flat source
map is retired and rejected; joins and mounts travel atomically:

```json
{
	"version": 2,
	"board": "timaeus-demo",
	"dimensions": {
		"include_pii": false,
		"justification": "Public demo board keeps governed identities redacted"
	},
	"sources": {
		"taxis": {
			"kind": "kernel",
			"title": "Taxis — workforce time",
			"base_url": "http://taxis:8205",
			"dialect_hint": "timaeus",
			"token_env": "VIEWER_TAXIS_TOKEN",
			"source_trust": {
				"issuer": "taxis",
				"public_keys": {
					"taxis-fixture-2026-01": "11qYAYKxCrfVS_7TyWQHOg7hcvPapiMlrwIaaPcHURo"
				},
				"max_age_seconds": 300,
				"max_future_skew_seconds": 30
			},
			"surfaces": [
				{
					"id": "orgs",
					"title": "Organizations",
					"path": "/surfaces/orgs",
					"representation": "source-v1",
					"surface_id": "taxis.orgs:<org-id>:<period>",
					"route_only": false
				},
				{
					"id": "employee",
					"title": "Employee",
					"path": "/orgs/<org-id>/surfaces/employee?worker_id=<worker-id>",
					"representation": "source-v1",
					"surface_id": "taxis.employee:<org-id>:<worker-id>:<date>",
					"route_only": true
				}
			]
		}
	},
	"joins": []
}
```

- `kind: "kernel"` — the only source kind: a kernel-direct source
  (Taxis/chreos/… shape). The viewer synthesizes the envelope identity
  (`<source>:<id>`, dialect from entry → source → `ledger`). `kind: "store"`
  is retired (KRA-775 Stage 5) and fails closed.
- `representation: "source-v1"` — required on every surface entry. The viewer
  sends `Accept: application/vnd.morphe.source-surface+json;v=1` and requires
  that exact response `Content-Type`. The entry's `surface_id` must equal the
  signed concrete identity. An omitted or `legacy` representation fails closed
  (the legacy bare-`CompiledSurface` reader is retired).
- `route_only` — required on every surface. Route-only panes are legal declared
  `/s/...` destinations but never become catalog tiles, collection roots, or
  home panels.
- `joins` — strict directional board declarations. Active detail joins extract
  identity only from the admitted signed `surface_id`; collection joins consume
  exact signed ExternalRef carriers. The viewer never falls back to request
  queries, labels, displayed values, or legacy field names.
- `dimensions` — required board policy. `include_pii` is a trusted server-side
  dimension, never browser authority: the viewer strips hand-typed and
  link-carried governed parameters, then requests `include_pii=true` only when
  this board value is true and the source governs that parameter.
  `justification` is a required nonempty declaration of why the board chose the
  dimension. The trusted parameter affects upstream admission and cache identity
  but is never carried into rewritten browser links.
- `source_trust` — required whenever a source declares surfaces. `issuer` and
  `surface_id` are exact pins; `public_keys` maps an allowed signed `key_id` to
  its canonical unpadded base64url **raw 32-byte Ed25519 public key**. Rotation
  can overlap entries in that map. The host materializes these as composite
  `(issuer, key_id)` trust roots; a key ID is never global across issuers.
  Freshness values are optional host policy.
- The compiler build SHA is generated from the runtime compiler closure and
  lockfile at build time, verified during the Docker build, and stamped by the
  compiler itself; it is not accepted from testimony, callers, or mutable
  runtime configuration. `/healthz` reports this identity, compiler/wire
  versions, media type, and delivery-receipt version alongside `grammar_version`.
- `token_env` — name of the PRIVATE env var holding the source's bearer token,
  injected during SSR only; the browser never sees it. A named-but-unset token
  env is a 503, never a silent unauthenticated fetch.
- The browse space is config-declared only — unknown sources/surfaces 404; the
  viewer is not an open proxy onto the docker network.

With `MORPHE_SOURCES` unset, no sources are configured; the retired
`MORPHE_ARTIFACT_BASE_URL` fallback is ignored (KRA-775 Stage 5).
