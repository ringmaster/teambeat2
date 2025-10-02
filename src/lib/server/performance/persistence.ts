/**
 * Persistence layer for performance metrics
 * Periodically saves metrics to database for historical analysis
 */

import { db } from '$lib/server/db';
import { metricSnapshots, boardMetrics, slowQueries } from '$lib/server/db/schema';
import { performanceTracker } from './tracker';
import { lt } from 'drizzle-orm';

class MetricsPersistence {
	private persistInterval: NodeJS.Timeout | null = null;
	private readonly PERSIST_INTERVAL = 60 * 1000; // Every 1 minute
	private readonly RETENTION_DAYS = 7; // Keep 7 days of history

	constructor() {
		this.startPersisting();
	}

	private startPersisting() {
		this.persistInterval = setInterval(async () => {
			await this.persistSnapshot();
			await this.cleanup();
		}, this.PERSIST_INTERVAL);
	}

	private async persistSnapshot() {
		try {
			const stats = performanceTracker.getStats();

			// Save overall snapshot
			await db.insert(metricSnapshots).values({
				id: `ms_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
				timestamp: stats.timestamp,
				concurrent_users: stats.sse.concurrentUsers,
				peak_concurrent_users: stats.sse.peakConcurrentUsers,
				active_connections: stats.sse.activeConnections,
				total_operations: stats.sse.totalOperations,
				broadcast_p95: stats.sse.broadcastPercentiles.p95,
				broadcast_p99: stats.sse.broadcastPercentiles.p99,
				messages_sent: stats.sse.messagesSent
			});

			// Aggregate board-level metrics
			const boardStats = new Map<number, { count: number; totalDuration: number }>();
			for (const broadcast of stats.sse.recentBroadcasts) {
				const existing = boardStats.get(broadcast.boardId) || { count: 0, totalDuration: 0 };
				existing.count++;
				existing.totalDuration += broadcast.duration;
				boardStats.set(broadcast.boardId, existing);
			}

			// Save board metrics
			for (const [boardId, metrics] of boardStats) {
				await db.insert(boardMetrics).values({
					id: `bm_${boardId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
					board_id: boardId.toString(),
					timestamp: stats.timestamp,
					broadcast_count: metrics.count,
					avg_broadcast_duration: metrics.totalDuration / metrics.count
				});
			}

			// Save slow queries
			for (const query of stats.slowQueries) {
				await db.insert(slowQueries).values({
					id: `sq_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
					timestamp: query.timestamp,
					duration: query.duration,
					query: query.query,
					board_id: query.boardId?.toString() || null
				});
			}
		} catch (error) {
			console.error('Failed to persist performance metrics:', error);
		}
	}

	private async cleanup() {
		try {
			const cutoff = Date.now() - (this.RETENTION_DAYS * 24 * 60 * 60 * 1000);

			await db.delete(metricSnapshots).where(lt(metricSnapshots.timestamp, cutoff));
			await db.delete(boardMetrics).where(lt(boardMetrics.timestamp, cutoff));
			await db.delete(slowQueries).where(lt(slowQueries.timestamp, cutoff));
		} catch (error) {
			console.error('Failed to cleanup old metrics:', error);
		}
	}

	async getHistoricalMetrics(startTime: number, endTime: number) {
		return await db.select()
			.from(metricSnapshots)
			.where(lt(metricSnapshots.timestamp, endTime))
			.orderBy(metricSnapshots.timestamp);
	}

	async getBoardHistory(boardId: number, startTime: number, endTime: number) {
		return await db.select()
			.from(boardMetrics)
			.where(lt(boardMetrics.timestamp, endTime))
			.orderBy(boardMetrics.timestamp);
	}

	async getSlowQueryHistory(limit = 100) {
		return await db.select()
			.from(slowQueries)
			.orderBy(slowQueries.timestamp)
			.limit(limit);
	}

	stop() {
		if (this.persistInterval) {
			clearInterval(this.persistInterval);
			this.persistInterval = null;
		}
	}
}

export const metricsPersistence = new MetricsPersistence();
