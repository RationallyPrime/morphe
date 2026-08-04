// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/svelte";
import { afterEach, describe, expect, it } from "vitest";
import SubstratePage from "../routes/substrate/+page.svelte";

afterEach(cleanup);

describe("/substrate deterministic live proof controls", () => {
	it("keeps host evidence native while routing every proposal through the bounded ledger", async () => {
		render(SubstratePage);

		await fireEvent.click(screen.getByRole("button", { name: /Deterministic Vary \+ Delta/ }));
		expect(screen.getByRole("heading", { name: "Bounded evidence ledger" })).toBeInTheDocument();
		expect(screen.getByText("No host proposals have been admitted or rejected yet.")).toBeVisible();
		expect(screen.getByText(/wired at MorpheRoot/)).toBeVisible();

		await fireEvent.click(screen.getByRole("button", { name: "Run policy" }));
		expect(screen.getByText("8 immutable records retained (newest twenty-four).")).toBeVisible();
		expect(screen.getAllByText("accepted")).toHaveLength(4);
		await fireEvent.click(screen.getByRole("button", { name: "Compare identical replay inputs" }));
		expect(screen.getByText("16 immutable records retained (newest twenty-four).")).toBeVisible();
		expect(screen.getByText("replay comparison").parentElement).toHaveTextContent("stable");

		await fireEvent.click(
			screen.getByRole("button", { name: "Reject structurally live host-only socket" }),
		);
		expect(screen.getByText(/out-of-policy-target/)).toBeVisible();

		await fireEvent.click(screen.getByRole("button", { name: "Replay stale epoch" }));
		expect(screen.getByText(/stale-epoch/)).toBeVisible();

		await fireEvent.click(screen.getByRole("button", { name: "Apply user override" }));
		expect(screen.getByText("user locks").parentElement).toHaveTextContent("live.proof.mode");
	});
});
