import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join } from "node:path";

const ROOT = join(process.cwd(), "viewer", "build");
const FORBIDDEN = [/Bearer\s+[A-Za-z0-9._~+/=-]+/, /"bearer"\s*:\s*"[^"]+"/, /Authorization/];

function walk(directory: string): readonly string[] {
	if (!statSync(directory, { throwIfNoEntry: false })?.isDirectory()) {
		throw new Error(`viewer client build is missing: ${directory}`);
	}
	const files: string[] = [];
	for (const entry of readdirSync(directory, { withFileTypes: true })) {
		const path = join(directory, entry.name);
		if (entry.isDirectory()) files.push(...walk(path));
		else if (entry.isFile() && [".js", ".html", ".json"].includes(extname(entry.name))) {
			files.push(path);
		}
	}
	return files;
}

const offenders: string[] = [];
for (const file of walk(ROOT)) {
	const source = readFileSync(file, "utf8");
	for (const pattern of FORBIDDEN) {
		if (pattern.test(source)) offenders.push(`${file}: ${pattern}`);
	}
}
if (offenders.length > 0) {
	throw new Error(`viewer client/build leaked credentials:\n${offenders.join("\n")}`);
}
process.stdout.write("viewer client build contains no bearer credentials\n");
