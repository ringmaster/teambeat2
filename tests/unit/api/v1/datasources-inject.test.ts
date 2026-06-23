import { describe, expect, it } from "vitest";
import { POST } from "../../../../src/routes/api/v1/datasources/[id]/inject/+server";
import { createMockRequestEvent } from "../../helpers/mock-request";

describe("POST /api/v1/datasources/:id/inject", () => {
	it("returns 501 Not Implemented", async () => {
		const event = createMockRequestEvent({
			method: "POST",
			url: "http://localhost/api/v1/datasources/ds-1/inject",
			params: { id: "ds-1" },
			body: { data: "anything" },
		});
		const response = await POST(event);
		const data = await response.json();

		expect(response.status).toBe(501);
		expect(data.success).toBe(false);
		expect(data.error).toBe("This endpoint is not yet available");
	});
});
