import { describe, expect, it, vi } from "vitest";
import { invokeAction } from "./actions.js";

describe("Morphe action binding — declared in-tree Button wire (R1.4)", () => {
	it("mapped action id invokes the handler exactly once", () => {
		const save = vi.fn();

		const invoked = invokeAction({ save }, "save", { dev: true });

		expect(invoked).toBe(true);
		expect(save).toHaveBeenCalledTimes(1);
	});

	it("unmapped action id warns in dev and does not throw", () => {
		const warn = vi.fn();

		expect(() => {
			const invoked = invokeAction({}, "missing", { dev: true, warn });
			expect(invoked).toBe(false);
		}).not.toThrow();

		expect(warn).toHaveBeenCalledOnce();
		expect(warn).toHaveBeenCalledWith('Unknown Morphe action "missing".');
	});

	it("missing action id is a no-op and does not inspect the map", () => {
		const actions = new Proxy(
			{},
			{
				get() {
					throw new Error("actions map should not be read");
				},
			},
		);

		const invoked = invokeAction(actions, undefined, { dev: true });

		expect(invoked).toBe(false);
	});
});
