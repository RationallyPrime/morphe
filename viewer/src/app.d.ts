declare global {
	namespace App {
		/**
		 * Structured error surface for the fail-closed grammar gate (MO-D5):
		 * a grammar_version mismatch renders a diagnostic page naming BOTH
		 * versions — never a silent partial render.
		 */
		interface Error {
			message: string;
			code?: "grammar-mismatch" | "upstream-unreachable" | "not-configured";
			artifactId?: string;
			artifactVersion?: string;
			supportedVersion?: string;
		}
	}
}

export {};
