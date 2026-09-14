import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";

export const FORBIDDEN = [
	/Bearer\s+[A-Za-z0-9._~+/=-]+/,
	/"bearer"\s*:\s*"[^"]+"/,
	/Authorization/,
];
const CLIENT_EXTENSIONS = new Set([".js", ".html", ".json"]);

export function viewerClientScanRoots(buildRoot: string): readonly string[] {
	const client = join(buildRoot, "client");
	if (!statSync(client, { throwIfNoEntry: false })?.isDirectory()) {
		throw new Error(`viewer client build is missing: ${client}`);
	}
	const roots = [client];
	const prerendered = join(buildRoot, "prerendered");
	if (statSync(prerendered, { throwIfNoEntry: false })?.isDirectory()) {
		roots.push(prerendered);
	}
	return roots;
}

export function walkClientArtifacts(directory: string): readonly string[] {
	if (!statSync(directory, { throwIfNoEntry: false })?.isDirectory()) {
		throw new Error(`viewer client build is missing: ${directory}`);
	}
	const files: string[] = [];
	for (const entry of readdirSync(directory, { withFileTypes: true })) {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) files.push(...walkClientArtifacts(path));
		else if (entry.isFile() && CLIENT_EXTENSIONS.has(extname(entry.name))) {
			files.push(path);
		}
	}
	return files;
}

export function collectCredentialOffenders(roots: readonly string[]): readonly string[] {
	const offenders: string[] = [];
	for (const root of roots) {
		for (const file of walkClientArtifacts(root)) {
			const source = readFileSync(file, "utf8");
			for (const pattern of FORBIDDEN) {
				if (pattern.test(source)) offenders.push(`${file}: ${pattern}`);
			}
		}
	}
	return offenders;
}

export function checkViewerClientCredentials(buildRoot: string): void {
	const offenders = collectCredentialOffenders(viewerClientScanRoots(buildRoot));
	if (offenders.length > 0) {
		throw new Error(`viewer client/build leaked credentials:\n${offenders.join("\n")}`);
	}
}

if (import.meta.main) {
	checkViewerClientCredentials(join(process.cwd(), "viewer", "build"));
	process.stdout.write("viewer client build contains no bearer credentials\n");
}
