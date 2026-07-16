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
		"surfaces": [
			{ "id": "orgs", "title": "Organizations", "path": "/surfaces/orgs" },
			{ "id": "roster", "title": "Weekly roster", "path": "/orgs/<org-id>/surfaces/roster" }
		]
	}
}
```

- `kind: "store"` — a surface-artifact store (topos shape). Responses carry the
  outer `SurfaceArtifactResponse` envelope. Declared entries name a stored
  `artifact_id`; dynamic ids stay reachable via `/surfaces/[artifactId]` on the
  source named `default`.
- `kind: "kernel"` — a kernel-direct source (Taxis/chreos/… shape). Responses
  are a **bare `CompiledSurface`**; the viewer wrapper-lifts them through the
  identical trust gate and synthesizes the envelope identity (`<source>:<id>`,
  dialect from entry → source → `ledger`).
- `token_env` — name of the PRIVATE env var holding the source's bearer token,
  injected during SSR only; the browser never sees it. A named-but-unset token
  env is a 503, never a silent unauthenticated fetch.
- The browse space is config-declared only — unknown sources/surfaces 404; the
  viewer is not an open proxy onto the docker network.

Legacy fallback: with `MORPHE_SOURCES` unset, `MORPHE_ARTIFACT_BASE_URL`
synthesizes the single `default` store source (KRA-648 behavior, unchanged).
