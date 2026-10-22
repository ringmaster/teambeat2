import { afterEach, describe, expect, it, vi } from "vitest";

// Sentry contract: captureException(error, hint) records the error and returns an event id.
// It is a no-op when Sentry.init has not run.
vi.mock("@sentry/sveltekit", () => ({
	captureException: vi.fn(() => "event-id"),
}));

import * as Sentry from "@sentry/sveltekit";
import { reportApiError } from "../../../src/lib/server/api/report-error";

describe("reportApiError", () => {
	afterEach(() => vi.restoreAllMocks());

	it("logs the error with its label and sends it to Sentry tagged with the label", () => {
		const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
		const err = new Error("query failed");

		reportApiError("[v1 GET /boards/:id]", err);

		expect(consoleError).toHaveBeenCalledWith("[v1 GET /boards/:id]", err);
		expect(Sentry.captureException).toHaveBeenCalledWith(err, {
			tags: { api_handler: "[v1 GET /boards/:id]" },
		});
	});
});
