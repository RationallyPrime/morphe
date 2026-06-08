import { redirect } from "@sveltejs/kit";
import type { PageLoad } from "./$types";

// The dignity test now lives at /substrate (the engine, demoted from /). Keep
// the old /dignity link working.
export const load: PageLoad = () => {
	redirect(308, "/substrate");
};
