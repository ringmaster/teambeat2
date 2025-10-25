/**
 * Performance tracking for SSE operations, database queries, and API requests
 */

export interface PerformanceStats {
	timestamp: number;
	uptime: number;
	memory: {
		heapUsed: number;
		heapTotal: number;
		external: number;
		rss: number;
	};
	sse: {
		concurrentUsers: number;
		peakConcurrentUsers: number;
		activeConnections: number;
		totalOperations: number;
		recentBroadcasts: Array<{
			timestamp: number;
			duration: number;
			recipientCount: number;
			boardId: number;
			eventType: string;
		}>;
		broadcastPercentiles: {
			p50: number;
			p95: number;
			p99: number;
		};
		messagesSent: number;
	};
	slowQueries: Array<{
		timestamp: number;
		duration: number;
		query: string;
		boardId?: number;
	}>;
	apiPerformance: {
		totalRequests: number;
		recentRequests: Array<{
			timestamp: number;
			duration: number;
			method: string;
			path: string;
			status: number;
		}>;
		percentiles: {
			p50: number;
			p95: number;
			p99: number;
		};
	};
}

class PerformanceTracker {
	private startTime = Date.now();
	private metrics = {
		sse: {
			concurrentUsers: 0,
			peakConcurrentUsers: 0,
			activeConnections: 0,
			totalOperations: 0,
			broadcasts: [] as Array<{
				timestamp: number;
				duration: number;
				recipientCount: number;
				boardId: number;
				eventType: string;
			}>,
			messagesSent: 0,
		},
		slowQueries: [] as Array<{
			timestamp: number;
			duration: number;
			query: string;
			boardId?: number;
		}>,
		api: {
			totalRequests: 0,
			requests: [] as Array<{
				timestamp: number;
				duration: number;
				method: string;
				path: string;
				status: number;
			}>,
		},
	};

	private timeSeries = {
		concurrentUsers: [] as Array<{ timestamp: number; value: number }>,
		messagesSent: [] as Array<{ timestamp: number; value: number }>,
	};

	private readonly MAX_BROADCAST_SAMPLES = 1000;
	private readonly MAX_SLOW_QUERIES = 100;
	private readonly TIME_SERIES_RETENTION = 60 * 60 * 1000; // 1 hour

	constructor() {
		this.startTimeSeriesCollection();
	}

	private startTimeSeriesCollection() {
		setInterval(() => {
			const now = Date.now();
			const cutoff = now - this.TIME_SERIES_RETENTION;

			// Add current samples
			this.timeSeries.concurrentUsers.push({
				timestamp: now,
				value: this.metrics.sse.concurrentUsers,
			});
			this.timeSeries.messagesSent.push({
				timestamp: now,
				value: this.metrics.sse.messagesSent,
			});

			// Clean old samples
			this.timeSeries.concurrentUsers = this.timeSeries.concurrentUsers.filter(
				(s) => s.timestamp > cutoff,
			);
			this.timeSeries.messagesSent = this.timeSeries.messagesSent.filter(
				(s) => s.timestamp > cutoff,
			);
		}, 10000); // Sample every 10 seconds
	}

	// SSE Connection tracking
	recordConnection(add: boolean) {
		if (add) {
			this.metrics.sse.activeConnections++;
			this.metrics.sse.concurrentUsers++;
			if (
				this.metrics.sse.concurrentUsers > this.metrics.sse.peakConcurrentUsers
			) {
				this.metrics.sse.peakConcurrentUsers = this.metrics.sse.concurrentUsers;
			}
		} else {
			this.metrics.sse.activeConnections--;
			this.metrics.sse.concurrentUsers--;
		}
	}

	// SSE Broadcast tracking
	recordBroadcast(
		duration: number,
		recipientCount: number,
		boardId: number,
		eventType: string,
	) {
		this.metrics.sse.totalOperations++;
		this.metrics.sse.messagesSent += recipientCount;
		this.metrics.sse.broadcasts.push({
			timestamp: Date.now(),
			duration,
			recipientCount,
			boardId,
			eventType,
		});

		// Keep only recent broadcasts
		if (this.metrics.sse.broadcasts.length > this.MAX_BROADCAST_SAMPLES) {
			this.metrics.sse.broadcasts = this.metrics.sse.broadcasts.slice(
				-this.MAX_BROADCAST_SAMPLES,
			);
		}
	}

	// Database query tracking
	recordQuery(duration: number, query: string, boardId?: number) {
		if (duration > 100) {
			// Only track queries > 100ms
			this.metrics.slowQueries.push({
				timestamp: Date.now(),
				duration,
				query,
				boardId,
			});

			// Keep only recent slow queries
			if (this.metrics.slowQueries.length > this.MAX_SLOW_QUERIES) {
				this.metrics.slowQueries = this.metrics.slowQueries.slice(
					-this.MAX_SLOW_QUERIES,
				);
			}
		}
	}

	// API request tracking
	recordApiRequest(
		duration: number,
		method: string,
		path: string,
		status: number,
	) {
		this.metrics.api.totalRequests++;
		this.metrics.api.requests.push({
			timestamp: Date.now(),
			duration,
			method,
			path,
			status,
		});

		// Keep only recent requests
		if (this.metrics.api.requests.length > this.MAX_BROADCAST_SAMPLES) {
			this.metrics.api.requests = this.metrics.api.requests.slice(
				-this.MAX_BROADCAST_SAMPLES,
			);
		}
	}

	private calculatePercentiles(values: number[]): {
		p50: number;
		p95: number;
		p99: number;
	} {
		if (values.length === 0) {
			return { p50: 0, p95: 0, p99: 0 };
		}

		const sorted = [...values].sort((a, b) => a - b);
		const p50 = sorted[Math.floor(sorted.length * 0.5)] || 0;
		const p95 = sorted[Math.floor(sorted.length * 0.95)] || 0;
		const p99 = sorted[Math.floor(sorted.length * 0.99)] || 0;

		return { p50, p95, p99 };
	}

	getStats(): PerformanceStats {
		const mem = process.memoryUsage();
		const broadcastDurations = this.metrics.sse.broadcasts.map(
			(b) => b.duration,
		);
		const apiDurations = this.metrics.api.requests.map((r) => r.duration);

		return {
			timestamp: Date.now(),
			uptime: Date.now() - this.startTime,
			memory: {
				heapUsed: mem.heapUsed,
				heapTotal: mem.heapTotal,
				external: mem.external,
				rss: mem.rss,
			},
			sse: {
				concurrentUsers: this.metrics.sse.concurrentUsers,
				peakConcurrentUsers: this.metrics.sse.peakConcurrentUsers,
				activeConnections: this.metrics.sse.activeConnections,
				totalOperations: this.metrics.sse.totalOperations,
				recentBroadcasts: this.metrics.sse.broadcasts.slice(-50),
				broadcastPercentiles: this.calculatePercentiles(broadcastDurations),
				messagesSent: this.metrics.sse.messagesSent,
			},
			slowQueries: this.metrics.slowQueries.slice(-20),
			apiPerformance: {
				totalRequests: this.metrics.api.totalRequests,
				recentRequests: this.metrics.api.requests.slice(-50),
				percentiles: this.calculatePercentiles(apiDurations),
			},
		};
	}

	getTimeSeries() {
		return {
			concurrentUsers: this.timeSeries.concurrentUsers,
			messagesSent: this.timeSeries.messagesSent,
		};
	}

	reset() {
		this.metrics.sse.totalOperations = 0;
		this.metrics.sse.broadcasts = [];
		this.metrics.sse.messagesSent = 0;
		this.metrics.slowQueries = [];
		this.metrics.api.totalRequests = 0;
		this.metrics.api.requests = [];
	}
}

export const performanceTracker = new PerformanceTracker();
