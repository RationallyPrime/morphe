/**
 * Container HEALTHCHECK probe — distroless has no shell/curl, so the check is
 * a node one-liner against the viewer's own /healthz (which also reports the
 * supported grammar_version for deploy-to-box assertions).
 */
try {
	const port = process.env.PORT ?? "3000";
	const res = await fetch(`http://127.0.0.1:${port}/healthz`);
	process.exit(res.ok ? 0 : 1);
} catch {
	process.exit(1);
}
