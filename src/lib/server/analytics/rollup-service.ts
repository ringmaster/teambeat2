/**
 * Feature analytics rollup service
 * Aggregates hourly data into daily summaries
 */

import { db } from "../db/index.js";
import { featureAnalyticsHourly, featureAnalyticsDaily } from "../db/schema.js";
import { eq, and, gte, lt, sql } from "drizzle-orm";
import { nanoid } from "nanoid";

class RollupService {
	private rollupInterval: NodeJS.Timeout | null = null;
	private readonly ROLLUP_INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 hours

	/**
	 * Get the date string for a given timestamp
	 */
	private getDateString(timestamp: number): string {
		const date = new Date(timestamp);
		return date.toISOString().split("T")[0]; // "2025-01-09"
	}

	/**
	 * Aggregate hourly data for a specific date into daily summary
	 */
	async aggregateDailyData(date: string) {
		try {
			console.log(`[RollupService] Aggregating daily data for ${date}`);

			// Calculate date range (00:00:00 to 23:59:59 of the given date)
			const startOfDay = new Date(date + "T00:00:00.000Z").toISOString();
			const endOfDay = new Date(date + "T23:59:59.999Z").toISOString();

			// Get all hourly records for this date
			const hourlyRecords = await db
				.select()
				.from(featureAnalyticsHourly)
				.where(
					and(
						gte(featureAnalyticsHourly.hourStart, startOfDay),
						lt(featureAnalyticsHourly.hourStart, endOfDay),
					),
				);

			if (hourlyRecords.length === 0) {
				console.log(`[RollupService] No hourly data found for ${date}`);
				return 0;
			}

			// Aggregate by feature + action
			const dailyAggregates: Record<
				string,
				{ eventCount: number; uniqueUsersCount: number }
			> = {};

			for (const record of hourlyRecords) {
				const key = `${record.feature}:${record.action}`;
				if (!dailyAggregates[key]) {
					dailyAggregates[key] = {
						eventCount: 0,
						uniqueUsersCount: 0,
					};
				}
				dailyAggregates[key].eventCount += record.eventCount;
				dailyAggregates[key].uniqueUsersCount += record.uniqueUsersCount;
			}

			// Upsert daily records
			let recordsUpserted = 0;
			for (const [key, data] of Object.entries(dailyAggregates)) {
				const [feature, action] = key.split(":");

				// Check if daily record already exists
				const existing = await db
					.select()
					.from(featureAnalyticsDaily)
					.where(
						and(
							eq(featureAnalyticsDaily.date, date),
							eq(featureAnalyticsDaily.feature, feature),
							eq(featureAnalyticsDaily.action, action),
						),
					)
					.limit(1);

				if (existing.length > 0) {
					// Update existing record
					await db
						.update(featureAnalyticsDaily)
						.set({
							eventCount: data.eventCount,
							uniqueUsersCount: data.uniqueUsersCount,
						})
						.where(eq(featureAnalyticsDaily.id, existing[0].id));
				} else {
					// Insert new record
					await db.insert(featureAnalyticsDaily).values({
						id: nanoid(),
						date,
						feature,
						action,
						eventCount: data.eventCount,
						uniqueUsersCount: data.uniqueUsersCount,
						createdAt: new Date().toISOString(),
					});
				}

				recordsUpserted++;
			}

			console.log(
				`[RollupService] Aggregated ${hourlyRecords.length} hourly records into ${recordsUpserted} daily records for ${date}`,
			);

			return recordsUpserted;
		} catch (error) {
			console.error(
				`[RollupService] Failed to aggregate daily data for ${date}:`,
				error,
			);
			throw error;
		}
	}

	/**
	 * Rollup yesterday's data
	 */
	async rollupYesterday() {
		const yesterday = new Date();
		yesterday.setDate(yesterday.getDate() - 1);
		const dateString = this.getDateString(yesterday.getTime());

		await this.aggregateDailyData(dateString);
	}

	/**
	 * Start periodic daily rollups (runs at 2 AM every day)
	 */
	startPeriodicRollups() {
		if (this.rollupInterval) {
			console.log("[RollupService] Periodic rollups already running");
			return;
		}

		// Calculate time until next 2 AM
		const now = new Date();
		const next2AM = new Date();
		next2AM.setHours(2, 0, 0, 0);

		// If it's already past 2 AM today, schedule for tomorrow
		if (now.getHours() >= 2) {
			next2AM.setDate(next2AM.getDate() + 1);
		}

		const msUntilNext2AM = next2AM.getTime() - now.getTime();

		console.log(
			`[RollupService] Scheduling daily rollup at 2 AM (in ${Math.round(msUntilNext2AM / 1000 / 60)} minutes)`,
		);

		// Schedule first rollup
		setTimeout(() => {
			this.rollupYesterday();

			// Then run daily at 2 AM
			this.rollupInterval = setInterval(() => {
				this.rollupYesterday();
			}, this.ROLLUP_INTERVAL_MS);
		}, msUntilNext2AM);
	}

	/**
	 * Stop periodic rollups
	 */
	stopPeriodicRollups() {
		if (this.rollupInterval) {
			clearInterval(this.rollupInterval);
			this.rollupInterval = null;
			console.log("[RollupService] Stopped periodic rollups");
		}
	}

	/**
	 * Manually trigger rollup for a specific date (format: "2025-01-09")
	 */
	async rollupDate(date: string) {
		return await this.aggregateDailyData(date);
	}

	/**
	 * Backfill daily rollups for a date range
	 */
	async backfillDateRange(startDate: string, endDate: string) {
		const start = new Date(startDate);
		const end = new Date(endDate);
		const dates: string[] = [];

		// Generate list of dates
		for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
			dates.push(this.getDateString(d.getTime()));
		}

		console.log(
			`[RollupService] Backfilling ${dates.length} days from ${startDate} to ${endDate}`,
		);

		let successCount = 0;
		for (const date of dates) {
			try {
				await this.aggregateDailyData(date);
				successCount++;
			} catch (error) {
				console.error(
					`[RollupService] Failed to backfill ${date}:`,
					error,
				);
			}
		}

		console.log(
			`[RollupService] Backfill complete: ${successCount}/${dates.length} days processed`,
		);
	}
}

// Singleton instance
export const rollupService = new RollupService();

// Start periodic rollups when module loads
rollupService.startPeriodicRollups();
