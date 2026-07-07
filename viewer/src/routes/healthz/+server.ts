import { json } from "@sveltejs/kit";
import { GRAMMAR_VERSION } from "$lib";
import type { RequestHandler } from "./$types.js";

/**
 * /healthz — liveness + compiler/viewer agreement (KRA-648).
 *
 * Reports the grammar version this viewer supports so `deploy-to-box` can
 * assert compiler/viewer agreement post-deploy (MO-D5).
 */
export const GET: RequestHandler = () => {
	return json({ status: "ok", grammar_version: GRAMMAR_VERSION });
};
