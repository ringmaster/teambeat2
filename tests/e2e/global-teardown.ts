import { FullConfig } from "@playwright/test";
import { existsSync, unlinkSync } from "fs";

async function globalTeardown(_config: FullConfig) {
	console.log("Cleaning up global test environment...");

	try {
		// Clean up the specific test database file
		const testDbPath = "./teambeat-test.db";
		const filesToClean = [testDbPath, testDbPath + "-shm", testDbPath + "-wal"];

		for (const file of filesToClean) {
			if (existsSync(file)) {
				try {
					unlinkSync(file);
				} catch (error) {
					// Ignore cleanup errors
				}
			}
		}

		console.log("Test database cleaned up");
	} catch (error) {
		console.warn("Error during test database cleanup:", error);
	}

	// Clear test environment variables
	delete process.env.TEST_FACILITATOR_ID;
	delete process.env.TEST_PARTICIPANT1_ID;
	delete process.env.TEST_PARTICIPANT2_ID;
	delete process.env.TEST_SERIES_ID;
	delete process.env.TEST_BOARD_ID;
	delete process.env.TEST_BOARD_SLUG;

	console.log("Global test teardown completed");
}

export default globalTeardown;
