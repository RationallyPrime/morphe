import { redirect } from "@sveltejs/kit";
import type { PageLoad } from "./$types";

// The composer is now the home page's interactive centerpiece. Keep the old
// /compose link (it was deployed publicly) pointing at the front door.
export const load: PageLoad = () => {
	redirect(308, "/");
};
