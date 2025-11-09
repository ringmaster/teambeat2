/**
 * Feature usage analytics tracker
 * Tracks which features users are actually using
 */

import { db } from "../db/index.js";
import { featureAnalyticsHourly } from "../db/schema.js";
import { eq, and } from "drizzle-orm";
import { nanoid } from "nanoid";

interface FeatureEvent {
	feature: string;
	action: string;
	userId: string;
	boardId?: string;
	metadata?: Record<string, any>;
	timestamp: number;
}

interface FeatureStats {
	[feature: string]: {
		totalUses: number;
		uniqueUsers: Set<string>;
		lastUsed: number;
		actions: {
			[action: string]: number;
		};
	};
}

class FeatureTracker {
	private events: FeatureEvent[] = [];
	private stats: FeatureStats = {};
	private readonly MAX_EVENTS = 1000; // Keep last 1000 events in memory
	private lastSnapshotTime = 0;
	private snapshotInterval: NodeJS.Timeout | null = null;
	private readonly SNAPSHOT_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

	/**
	 * Track a feature usage event
	 */
	trackFeature(
		feature: string,
		action: string,
		userId: string,
		options?: {
			boardId?: string;
			metadata?: Record<string, any>;
		},
	) {
		const event: FeatureEvent = {
			feature,
			action,
			userId,
			boardId: options?.boardId,
			metadata: options?.metadata,
			timestamp: Date.now(),
		};

		// Add to events list (FIFO)
		this.events.push(event);
		if (this.events.length > this.MAX_EVENTS) {
			this.events.shift();
		}

		// Update stats
		if (!this.stats[feature]) {
			this.stats[feature] = {
				totalUses: 0,
				uniqueUsers: new Set(),
				lastUsed: 0,
				actions: {},
			};
		}

		const featureStats = this.stats[feature];
		featureStats.totalUses++;
		featureStats.uniqueUsers.add(userId);
		featureStats.lastUsed = event.timestamp;
		featureStats.actions[action] = (featureStats.actions[action] || 0) + 1;
	}

	/**
	 * Get aggregated feature statistics
	 */
	getStats() {
		return Object.entries(this.stats).map(([feature, stats]) => ({
			feature,
			totalUses: stats.totalUses,
			uniqueUsers: stats.uniqueUsers.size,
			lastUsed: new Date(stats.lastUsed).toISOString(),
			actions: stats.actions,
		}));
	}

	/**
	 * Get recent feature events
	 */
	getRecentEvents(limit = 100) {
		return this.events.slice(-limit).map((event) => ({
			...event,
			timestamp: new Date(event.timestamp).toISOString(),
		}));
	}

	/**
	 * Get feature usage by time period
	 */
	getUsageByPeriod(hours = 24) {
		const cutoff = Date.now() - hours * 60 * 60 * 1000;
		const recentEvents = this.events.filter((e) => e.timestamp > cutoff);

		const usage: Record<string, number> = {};
		for (const event of recentEvents) {
			usage[event.feature] = (usage[event.feature] || 0) + 1;
		}

		return Object.entries(usage)
			.map(([feature, count]) => ({ feature, count }))
			.sort((a, b) => b.count - a.count);
	}

	/**
	 * Get most active users
	 */
	getMostActiveUsers(limit = 10) {
		const userActivity: Record<string, number> = {};

		for (const event of this.events) {
			userActivity[event.userId] = (userActivity[event.userId] || 0) + 1;
		}

		return Object.entries(userActivity)
			.map(([userId, count]) => ({ userId, featureUses: count }))
			.sort((a, b) => b.featureUses - a.featureUses)
			.slice(0, limit);
	}

	/**
	 * Reset all stats (useful for testing)
	 */
	reset() {
		this.events = [];
		this.stats = {};
	}

	/**
	 * Get the hour start timestamp for a given timestamp
	 */
	private getHourStart(timestamp: number): string {
		const date = new Date(timestamp);
		date.setMinutes(0, 0, 0);
		return date.toISOString();
	}

	/**
	 * Aggregate events into hourly buckets
	 * Returns a map of hourStart -> feature -> action -> {count, uniqueUsers}
	 */
	private aggregateEventsToHourly(events: FeatureEvent[]) {
		const hourlyData: Record<
			string,
			Record<
				string,
				Record<string, { count: number; uniqueUsers: Set<string> }>
			>
		> = {};

		for (const event of events) {
			const hourStart = this.getHourStart(event.timestamp);

			if (!hourlyData[hourStart]) {
				hourlyData[hourStart] = {};
			}
			if (!hourlyData[hourStart][event.feature]) {
				hourlyData[hourStart][event.feature] = {};
			}
			if (!hourlyData[hourStart][event.feature][event.action]) {
				hourlyData[hourStart][event.feature][event.action] = {
					count: 0,
					uniqueUsers: new Set(),
				};
			}

			const bucket = hourlyData[hourStart][event.feature][event.action];
			bucket.count++;
			bucket.uniqueUsers.add(event.userId);
		}

		return hourlyData;
	}

	/**
	 * Persist hourly aggregates to database
	 */
	async persistHourlyAggregates() {
		try {
			// Only persist events that haven't been persisted yet
			const eventsToPersist = this.events.filter(
				(e) => e.timestamp > this.lastSnapshotTime,
			);

			if (eventsToPersist.length === 0) {
				console.log("[FeatureTracker] No new events to persist");
				return;
			}

			const hourlyData = this.aggregateEventsToHourly(eventsToPersist);
			let recordsUpserted = 0;

			for (const [hourStart, features] of Object.entries(hourlyData)) {
				for (const [feature, actions] of Object.entries(features)) {
					for (const [action, data] of Object.entries(actions)) {
						// Check if record exists
						const existing = await db
							.select()
							.from(featureAnalyticsHourly)
							.where(
								and(
									eq(featureAnalyticsHourly.hourStart, hourStart),
									eq(featureAnalyticsHourly.feature, feature),
									eq(featureAnalyticsHourly.action, action),
								),
							)
							.limit(1);

						if (existing.length > 0) {
							// Update existing record
							await db
								.update(featureAnalyticsHourly)
								.set({
									eventCount: existing[0].eventCount + data.count,
									uniqueUsersCount:
										existing[0].uniqueUsersCount + data.uniqueUsers.size,
								})
								.where(eq(featureAnalyticsHourly.id, existing[0].id));
						} else {
							// Insert new record
							await db.insert(featureAnalyticsHourly).values({
								id: nanoid(),
								hourStart,
								feature,
								action,
								eventCount: data.count,
								uniqueUsersCount: data.uniqueUsers.size,
								createdAt: new Date().toISOString(),
							});
						}

						recordsUpserted++;
					}
				}
			}

			// Update last snapshot time
			const latestEventTime = Math.max(
				...eventsToPersist.map((e) => e.timestamp),
			);
			this.lastSnapshotTime = latestEventTime;

			console.log(
				`[FeatureTracker] Persisted ${eventsToPersist.length} events into ${recordsUpserted} hourly records`,
			);
		} catch (error) {
			console.error("[FeatureTracker] Failed to persist hourly aggregates:", error);
		}
	}

	/**
	 * Start periodic snapshots to database
	 */
	startPeriodicSnapshots() {
		if (this.snapshotInterval) {
			console.log("[FeatureTracker] Periodic snapshots already running");
			return;
		}

		console.log(
			`[FeatureTracker] Starting periodic snapshots every ${this.SNAPSHOT_INTERVAL_MS / 1000}s`,
		);

		// Run first snapshot after 1 minute
		setTimeout(() => {
			this.persistHourlyAggregates();
		}, 60 * 1000);

		// Then run every SNAPSHOT_INTERVAL_MS
		this.snapshotInterval = setInterval(() => {
			this.persistHourlyAggregates();
		}, this.SNAPSHOT_INTERVAL_MS);
	}

	/**
	 * Stop periodic snapshots
	 */
	stopPeriodicSnapshots() {
		if (this.snapshotInterval) {
			clearInterval(this.snapshotInterval);
			this.snapshotInterval = null;
			console.log("[FeatureTracker] Stopped periodic snapshots");
		}
	}
}

// Singleton instance
export const featureTracker = new FeatureTracker();

// Start periodic snapshots when module loads
featureTracker.startPeriodicSnapshots();
