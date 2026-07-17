# Morphe box viewer

The stripped standalone viewer app (KRA-648 / MO-D3): SSR routes + `/healthz`
over the shared `$lib` renderer/dialects/tokens. Deliberately NOT the
playground app — no decision endpoint, no outbound proxy surface.

## Routes

| Route | What it renders |
| -- | -- |
| `/` | Source index: every configured source and its declared surfaces |
| `/s/[source]/[surfaceId]` | A declared surface from a configured source |
| `/surfaces/[artifactId]` | A dynamic-id artifact from the `default` store source |
| `/healthz` | Liveness + the supported `grammar_version` |

Every render path runs the same trust gate: generated-schema validation of the
compiled artifact, dialect-mask enforcement, and the fail-closed grammar gate —
a foreign `grammar_version` renders a 409 diagnostic naming both versions,
never a silent partial render (MO-D5). `?dialect=` overrides the pane dialect
when it names a shipped dialect.

Kernel entries are representation-selectable. Omitted `representation` is the
unchanged compiled-tree (`legacy`) reader. An explicit `source-v1` entry instead
negotiates signed source testimony, verifies and compiles it at the viewer edge,
then runs the same grammar and dialect gates. Link rewriting is inside the final
gate, and the load result carries a dialect-aware delivery receipt for the exact
tree that renders.

## Configuration (KRA-752 §4)

`MORPHE_SOURCES` — JSON object mapping a path-safe source id to a source:

```json
{
	"default": {
		"kind": "store",
		"title": "Topos artifacts",
		"base_url": "http://topos:8000/api/v1/surfaces",
		"surfaces": [
			{ "id": "digest", "title": "Balance digest", "artifact_id": "surface:digest:run-1" }
		]
	},
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
			{ "id": "orgs", "title": "Organizations", "path": "/surfaces/orgs" },
			{
				"id": "roster",
				"title": "Weekly roster",
				"path": "/orgs/<org-id>/surfaces/roster",
				"representation": "source-v1",
				"surface_id": "taxis.roster:<org-id>:<period>"
			}
		]
	}
}
```

- `kind: "store"` — a surface-artifact store (topos shape). Responses carry the
  outer `SurfaceArtifactResponse` envelope. Declared entries name a stored
  `artifact_id`; dynamic ids stay reachable via `/surfaces/[artifactId]` on the
  source named `default`.
- `kind: "kernel"` — a kernel-direct source (Taxis/chreos/… shape). Responses
  default to a **bare `CompiledSurface`**; the viewer wrapper-lifts them through
  the identical trust gate and synthesizes the envelope identity
  (`<source>:<id>`, dialect from entry → source → `ledger`).
- `representation: "source-v1"` — additive per-surface opt-in. The viewer sends
  `Accept: application/vnd.morphe.source-surface+json;v=1` and requires that
  exact response `Content-Type`. The entry's `surface_id` must equal the signed
  concrete identity. Omit the field (or set `legacy`) for instant rollback to
  the existing reader and response contract.
- `source_trust` — required when any surface selects source v1. `issuer` and
  `surface_id` are exact pins; `public_keys` maps an allowed signed `key_id` to
  its canonical unpadded base64url **raw 32-byte Ed25519 public key**. Rotation
  can overlap entries in that map. Freshness values are optional host policy.
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

Legacy fallback: with `MORPHE_SOURCES` unset, `MORPHE_ARTIFACT_BASE_URL`
synthesizes the single `default` store source (KRA-648 behavior, unchanged).
