import { json } from "@sveltejs/kit";
import { GRAMMAR_VERSION } from "$lib";
import { COMPILER_BUILD_SHA256 } from "$lib/surface-edge/build-id.generated.js";
import { COMPILER_VERSION } from "$lib/surface-edge/compile.js";
import { SOURCE_SURFACE_V1_MEDIA_TYPE } from "../../surface-reader.js";
import type { RequestHandler } from "./$types.js";

/**
 * /healthz — liveness + compiler/viewer agreement (KRA-648).
 *
 * Reports the grammar version this viewer supports so `deploy-to-box` can
 * assert compiler/viewer agreement post-deploy (MO-D5).
 */
export const GET: RequestHandler = () => {
	return json({
		status: "ok",
		grammar_version: GRAMMAR_VERSION,
		edge_compiler_version: COMPILER_VERSION,
		compiler_build_sha256: COMPILER_BUILD_SHA256,
		source_surface_wire_version: "1.0",
		source_surface_media_type: SOURCE_SURFACE_V1_MEDIA_TYPE,
		delivery_receipt_version: "dialect-aware-v1",
	});
};
