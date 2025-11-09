<script lang="ts">
import { onDestroy, onMount } from "svelte";
import AdminNav from "$lib/components/AdminNav.svelte";
import TimeSeriesChart from "$lib/components/TimeSeriesChart.svelte";
import FeatureUsagePieChart from "$lib/components/analytics/FeatureUsagePieChart.svelte";
import type { PerformanceStats } from "$lib/server/performance/tracker";
import { toastStore } from "$lib/stores/toast";

let stats: any = $state(null);
let loading = $state(true);
let error = $state("");
let autoRefresh = $state(true);
let timeRange = $state("1h");
let refreshInterval: ReturnType<typeof setInterval> | null = null;

// Reload stats when time range changes
$effect(() => {
	if (timeRange) {
		loadStats();
	}
});

async function loadStats() {
	try {
		const response = await fetch(`/api/admin/performance?range=${timeRange}`);
		if (!response.ok) {
			throw new Error("Failed to load performance stats");
		}
		stats = await response.json();
		error = "";
	} catch (err) {
		error = err instanceof Error ? err.message : "Unknown error";
	}
}

async function resetMetrics() {
	toastStore.warning("Reset all performance counters?", {
		autoHide: false,
		actions: [
			{
				label: "Reset",
				onClick: async () => {
					try {
						const response = await fetch("/api/admin/performance", {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({ action: "reset" }),
						});
						if (response.ok) {
							await loadStats();
							toastStore.success("Performance counters reset successfully");
						}
					} catch (err) {
						error =
							err instanceof Error ? err.message : "Failed to reset metrics";
						toastStore.error("Failed to reset metrics");
					}
				},
				variant: "primary",
			},
			{
				label: "Cancel",
				onClick: () => {},
				variant: "secondary",
			},
		],
	});
}

function formatBytes(bytes: number): string {
	return (bytes / 1024 / 1024).toFixed(2) + " MB";
}

function formatDuration(ms: number): string {
	if (ms < 1000) return ms.toFixed(2) + " ms";
	return (ms / 1000).toFixed(2) + " s";
}

let takingSnapshot = $state(false);

async function takeSnapshot() {
	try {
		takingSnapshot = true;
		const response = await fetch("/api/admin/analytics/snapshot", {
			method: "POST",
		});

		if (response.ok) {
			toastStore.success("Snapshot saved to database successfully");
		} else {
			const data = await response.json();
			toastStore.error(data.error || "Failed to take snapshot");
		}
	} catch (err) {
		console.error("Failed to take snapshot:", err);
		toastStore.error("Failed to take snapshot");
	} finally {
		takingSnapshot = false;
	}
}

function formatUptime(ms: number): string {
	const seconds = Math.floor(ms / 1000);
	const minutes = Math.floor(seconds / 60);
	const hours = Math.floor(minutes / 60);
	const days = Math.floor(hours / 24);

	if (days > 0) return `${days}d ${hours % 24}h`;
	if (hours > 0) return `${hours}h ${minutes % 60}m`;
	if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
	return `${seconds}s`;
}

onMount(async () => {
	loading = true;
	await loadStats();
	loading = false;

	refreshInterval = setInterval(async () => {
		if (autoRefresh) {
			await loadStats();
		}
	}, 5000);
});

onDestroy(() => {
	if (refreshInterval) {
		clearInterval(refreshInterval);
	}
});
</script>

<AdminNav />
<div class="page-container">
    <div class="performance-dashboard">
        <header class="dashboard-header">
            <h1>Performance Monitoring</h1>
            <div class="controls">
                <div class="time-range-selector">
                    <button
                        class:active={timeRange === "5m"}
                        onclick={() => (timeRange = "5m")}>5m</button
                    >
                    <button
                        class:active={timeRange === "15m"}
                        onclick={() => (timeRange = "15m")}>15m</button
                    >
                    <button
                        class:active={timeRange === "1h"}
                        onclick={() => (timeRange = "1h")}>1h</button
                    >
                    <button
                        class:active={timeRange === "1d"}
                        onclick={() => (timeRange = "1d")}>1d</button
                    >
                    <button
                        class:active={timeRange === "1w"}
                        onclick={() => (timeRange = "1w")}>1w</button
                    >
                </div>
                <label>
                    <input type="checkbox" bind:checked={autoRefresh} />
                    Auto-refresh (5s)
                </label>
                <button onclick={resetMetrics} class="reset-button"
                    >Reset Counters</button
                >
            </div>
        </header>

        {#if loading}
            <div class="loading">Loading performance data...</div>
        {:else if error}
            <div class="error">{error}</div>
        {:else if stats}
            <!-- Time Series Charts -->
            <section class="charts-section">
                <TimeSeriesChart
                    metric="concurrentUsers"
                    range={timeRange}
                    title="Concurrent Users Over Time"
                    yAxisLabel="Users"
                    color="#2196F3"
                />

                <TimeSeriesChart
                    metric="messagesSent"
                    range={timeRange}
                    title="Messages Sent Over Time"
                    yAxisLabel="Messages"
                    color="#4CAF50"
                />
            </section>

            <div class="metrics-grid">
                <!-- System Overview -->
                <section class="metric-card">
                    <h2>System Overview</h2>
                    <div class="metric-row">
                        <span class="label">Uptime:</span>
                        <span class="value">{formatUptime(stats.uptime)}</span>
                    </div>
                    <div class="metric-row">
                        <span class="label">Memory (Heap):</span>
                        <span class="value"
                            >{formatBytes(stats.memory.heapUsed)} / {formatBytes(
                                stats.memory.heapTotal,
                            )}</span
                        >
                    </div>
                    <div class="metric-row">
                        <span class="label">Memory (RSS):</span>
                        <span class="value"
                            >{formatBytes(stats.memory.rss)}</span
                        >
                    </div>
                </section>

                <!-- SSE Metrics -->
                <section class="metric-card">
                    <h2>Real-time Connections</h2>
                    <div class="metric-row highlight">
                        <span class="label">Concurrent Users:</span>
                        <span class="value large"
                            >{stats.sse.concurrentUsers}</span
                        >
                    </div>
                    <div class="metric-row">
                        <span class="label">Peak Users:</span>
                        <span class="value"
                            >{stats.sse.peakConcurrentUsers}</span
                        >
                    </div>
                    <div class="metric-row">
                        <span class="label">Active Connections:</span>
                        <span class="value">{stats.sse.activeConnections}</span>
                    </div>
                    <div class="metric-row">
                        <span class="label">Messages Sent:</span>
                        <span class="value"
                            >{stats.sse.messagesSent.toLocaleString()}</span
                        >
                    </div>
                    <div class="metric-row">
                        <span class="label">Total Operations:</span>
                        <span class="value"
                            >{stats.sse.totalOperations.toLocaleString()}</span
                        >
                    </div>
                </section>

                <!-- Broadcast Performance -->
                <section class="metric-card">
                    <h2>Broadcast Performance</h2>
                    <div class="metric-row">
                        <span class="label">P50:</span>
                        <span class="value"
                            >{formatDuration(
                                stats.sse.broadcastPercentiles.p50,
                            )}</span
                        >
                    </div>
                    <div class="metric-row">
                        <span class="label">P95:</span>
                        <span class="value"
                            >{formatDuration(
                                stats.sse.broadcastPercentiles.p95,
                            )}</span
                        >
                    </div>
                    <div class="metric-row">
                        <span class="label">P99:</span>
                        <span class="value"
                            >{formatDuration(
                                stats.sse.broadcastPercentiles.p99,
                            )}</span
                        >
                    </div>
                </section>

                <!-- API Performance -->
                <section class="metric-card">
                    <h2>API Performance</h2>
                    <div class="metric-row">
                        <span class="label">Total Requests:</span>
                        <span class="value"
                            >{stats.apiPerformance.totalRequests.toLocaleString()}</span
                        >
                    </div>
                    <div class="metric-row">
                        <span class="label">P50:</span>
                        <span class="value"
                            >{formatDuration(
                                stats.apiPerformance.percentiles.p50,
                            )}</span
                        >
                    </div>
                    <div class="metric-row">
                        <span class="label">P95:</span>
                        <span class="value"
                            >{formatDuration(
                                stats.apiPerformance.percentiles.p95,
                            )}</span
                        >
                    </div>
                    <div class="metric-row">
                        <span class="label">P99:</span>
                        <span class="value"
                            >{formatDuration(
                                stats.apiPerformance.percentiles.p99,
                            )}</span
                        >
                    </div>
                </section>
            </div>

            <!-- Recent Broadcasts -->
            {#if stats.sse.recentBroadcasts.length > 0}
                <section class="data-table">
                    <h2>Recent Broadcasts (Last 20)</h2>
                    <table>
                        <thead>
                            <tr>
                                <th>Time</th>
                                <th>Event Type</th>
                                <th>Board ID</th>
                                <th>Recipients</th>
                                <th>Duration</th>
                            </tr>
                        </thead>
                        <tbody>
                            {#each stats.sse.recentBroadcasts
                                .slice(-20)
                                .toReversed() as broadcast}
                                <tr>
                                    <td
                                        >{new Date(
                                            broadcast.timestamp,
                                        ).toLocaleTimeString()}</td
                                    >
                                    <td>{broadcast.eventType}</td>
                                    <td>{broadcast.boardId}</td>
                                    <td>{broadcast.recipientCount}</td>
                                    <td>{formatDuration(broadcast.duration)}</td
                                    >
                                </tr>
                            {/each}
                        </tbody>
                    </table>
                </section>
            {/if}

            <!-- Slow Queries -->
            {#if stats.slowQueries.length > 0}
                <section class="data-table">
                    <h2>Slow Queries (> 100ms)</h2>
                    <table>
                        <thead>
                            <tr>
                                <th>Time</th>
                                <th>Duration</th>
                                <th>Board ID</th>
                                <th>Query</th>
                            </tr>
                        </thead>
                        <tbody>
                            {#each stats.slowQueries
                                .slice(-20)
                                .toReversed() as query}
                                <tr>
                                    <td
                                        >{new Date(
                                            query.timestamp,
                                        ).toLocaleTimeString()}</td
                                    >
                                    <td class="slow"
                                        >{formatDuration(query.duration)}</td
                                    >
                                    <td>{query.boardId || "N/A"}</td>
                                    <td class="query-text"
                                        >{query.query.substring(0, 100)}{query
                                            .query.length > 100
                                            ? "..."
                                            : ""}</td
                                    >
                                </tr>
                            {/each}
                        </tbody>
                    </table>
                </section>
            {/if}

            <!-- Recent API Requests -->
            {#if stats.apiPerformance.recentRequests.length > 0}
                <section class="data-table">
                    <h2>Recent API Requests (Last 20)</h2>
                    <table>
                        <thead>
                            <tr>
                                <th>Time</th>
                                <th>Method</th>
                                <th>Path</th>
                                <th>Status</th>
                                <th>Duration</th>
                            </tr>
                        </thead>
                        <tbody>
                            {#each stats.apiPerformance.recentRequests
                                .slice(-20)
                                .toReversed() as request}
                                <tr>
                                    <td
                                        >{new Date(
                                            request.timestamp,
                                        ).toLocaleTimeString()}</td
                                    >
                                    <td>{request.method}</td>
                                    <td class="path">{request.path}</td>
                                    <td
                                        class:error-status={request.status >=
                                            400}>{request.status}</td
                                    >
                                    <td>{formatDuration(request.duration)}</td>
                                </tr>
                            {/each}
                        </tbody>
                    </table>
                </section>
            {/if}

            <!-- Feature Analytics -->
            {#if stats.featureAnalytics}
                <section class="feature-analytics">
                    <div class="section-header">
                        <h2>Feature Usage Analytics</h2>
                        <button
                            class="snapshot-button"
                            onclick={takeSnapshot}
                            disabled={takingSnapshot}
                            aria-label="Save current analytics to database"
                        >
                            {takingSnapshot ? "Saving..." : "📸 Take Snapshot"}
                        </button>
                    </div>

                    <!-- Most Used Features -->
                    {#if stats.featureAnalytics.overview && stats.featureAnalytics.overview.length > 0}
                        <div class="analytics-section">
                            <h3>Most Used Features (All Time)</h3>
                            <div class="analytics-with-chart">
                                <div class="analytics-table">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>Feature</th>
                                                <th>Total Uses</th>
                                                <th>Unique Users</th>
                                                <th>Last Used</th>
                                                <th>Actions</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {#each stats.featureAnalytics.overview.toSorted((a, b) => b.totalUses - a.totalUses) as feature}
                                                <tr>
                                                    <td class="feature-name">{feature.feature}</td>
                                                    <td><strong>{feature.totalUses.toLocaleString()}</strong></td>
                                                    <td>{feature.uniqueUsers}</td>
                                                    <td>{new Date(feature.lastUsed).toLocaleString()}</td>
                                                    <td class="actions-list">
                                                        {#each Object.entries(feature.actions) as [action, count]}
                                                            <span class="action-badge">{action}: {count}</span>
                                                        {/each}
                                                    </td>
                                                </tr>
                                            {/each}
                                        </tbody>
                                    </table>
                                </div>
                                <div class="analytics-chart">
                                    <FeatureUsagePieChart
                                        data={stats.featureAnalytics.overview.map(f => ({
                                            feature: f.feature,
                                            count: f.totalUses
                                        }))}
                                        title="All Time Usage"
                                    />
                                </div>
                            </div>
                        </div>
                    {/if}

                    <!-- Usage By Time Period -->
                    {#if stats.featureAnalytics.usageByPeriod && stats.featureAnalytics.usageByPeriod.length > 0}
                        <div class="analytics-section">
                            <h3>Feature Usage (Last {timeRange})</h3>
                            <div class="analytics-with-chart">
                                <div class="analytics-table">
                                    <table>
                                        <thead>
                                            <tr>
                                                <th>Feature</th>
                                                <th>Uses</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {#each stats.featureAnalytics.usageByPeriod as usage}
                                                <tr>
                                                    <td class="feature-name">{usage.feature}</td>
                                                    <td><strong>{usage.count}</strong></td>
                                                </tr>
                                            {/each}
                                        </tbody>
                                    </table>
                                </div>
                                <div class="analytics-chart">
                                    <FeatureUsagePieChart
                                        data={stats.featureAnalytics.usageByPeriod}
                                        title="Usage (Last {timeRange})"
                                    />
                                </div>
                            </div>
                        </div>
                    {/if}

                    <!-- Top Users -->
                    {#if stats.featureAnalytics.topUsers && stats.featureAnalytics.topUsers.length > 0}
                        <div class="analytics-section">
                            <h3>Most Active Users</h3>
                            <table>
                                <thead>
                                    <tr>
                                        <th>User ID</th>
                                        <th>Feature Uses</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {#each stats.featureAnalytics.topUsers as user}
                                        <tr>
                                            <td>{user.userId}</td>
                                            <td><strong>{user.featureUses}</strong></td>
                                        </tr>
                                    {/each}
                                </tbody>
                            </table>
                        </div>
                    {/if}

                    <!-- Recent Activity -->
                    {#if stats.featureAnalytics.recentActivity && stats.featureAnalytics.recentActivity.length > 0}
                        <div class="analytics-section">
                            <h3>Recent Feature Activity (Last 50 Events)</h3>
                            <table>
                                <thead>
                                    <tr>
                                        <th>Time</th>
                                        <th>Feature</th>
                                        <th>Action</th>
                                        <th>User ID</th>
                                        <th>Board ID</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {#each stats.featureAnalytics.recentActivity.slice(0, 20) as event}
                                        <tr>
                                            <td>{new Date(event.timestamp).toLocaleTimeString()}</td>
                                            <td class="feature-name">{event.feature}</td>
                                            <td><span class="action-badge">{event.action}</span></td>
                                            <td>{event.userId.substring(0, 8)}...</td>
                                            <td>{event.boardId || 'N/A'}</td>
                                        </tr>
                                    {/each}
                                </tbody>
                            </table>
                        </div>
                    {/if}
                </section>
            {/if}
        {/if}
    </div>
</div>

<style lang="less">
    @import "$lib/styles/_mixins.less";
    .page-container {
        .page-container();
    }
    .performance-dashboard {
        padding: 2rem;
        max-width: 1400px;
        margin: 0 auto;
    }

    .dashboard-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 2rem;

        h1 {
            margin: 0;
            font-size: 2rem;
        }

        .controls {
            display: flex;
            gap: 1rem;
            align-items: center;
            flex-wrap: wrap;

            label {
                display: flex;
                align-items: center;
                gap: 0.5rem;
            }
        }
    }

    .time-range-selector {
        display: flex;
        gap: 0;
        border: 1px solid #d1d5db;
        border-radius: 4px;
        overflow: hidden;

        button {
            padding: 0.5rem 1rem;
            background: white;
            color: #374151;
            border: none;
            border-right: 1px solid #d1d5db;
            cursor: pointer;
            transition: all 0.2s;

            &:last-child {
                border-right: none;
            }

            &:hover {
                background: #f3f4f6;
            }

            &.active {
                background: #2196f3;
                color: white;
            }
        }
    }

    .charts-section {
        margin-bottom: 2rem;
    }

    .reset-button {
        padding: 0.5rem 1rem;
        background: #dc2626;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;

        &:hover {
            background: #b91c1c;
        }
    }

    .loading,
    .error {
        text-align: center;
        padding: 2rem;
        font-size: 1.2rem;
    }

    .error {
        color: #dc2626;
    }

    .metrics-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 1.5rem;
        margin-bottom: 2rem;
    }

    .metric-card {
        background: white;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        padding: 1.5rem;

        h2 {
            margin: 0 0 1rem 0;
            font-size: 1.2rem;
            color: #374151;
        }
    }

    .metric-row {
        display: flex;
        justify-content: space-between;
        padding: 0.5rem 0;
        border-bottom: 1px solid #f3f4f6;

        &:last-child {
            border-bottom: none;
        }

        &.highlight {
            background: #eff6ff;
            padding: 0.75rem;
            border-radius: 4px;
            margin-bottom: 0.5rem;
        }

        .label {
            color: #6b7280;
            font-weight: 500;
        }

        .value {
            font-weight: 600;
            color: #111827;

            &.large {
                font-size: 1.5rem;
                color: #2563eb;
            }
        }
    }

    .data-table {
        background: white;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        padding: 1.5rem;
        margin-bottom: 2rem;

        h2 {
            margin: 0 0 1rem 0;
            font-size: 1.2rem;
            color: #374151;
        }

        table {
            width: 100%;
            border-collapse: collapse;

            th,
            td {
                text-align: left;
                padding: 0.75rem;
                border-bottom: 1px solid #e5e7eb;
            }

            th {
                background: #f9fafb;
                font-weight: 600;
                color: #374151;
            }

            tr:last-child td {
                border-bottom: none;
            }

            tr:hover {
                background: #f9fafb;
            }
        }

        .slow {
            color: #dc2626;
            font-weight: 600;
        }

        .error-status {
            color: #dc2626;
            font-weight: 600;
        }

        .query-text {
            font-family: "Courier New", monospace;
            font-size: 0.9rem;
            max-width: 400px;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .path {
            font-family: "Courier New", monospace;
            font-size: 0.9rem;
        }
    }

    .feature-analytics {
        background: white;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        padding: 1.5rem;
        margin-bottom: 2rem;

        > h2 {
            margin: 0 0 1.5rem 0;
            font-size: 1.5rem;
            color: #374151;
            padding-bottom: 0.5rem;
            border-bottom: 2px solid #e5e7eb;
        }
    }

    .section-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1.5rem;
        padding-bottom: 0.5rem;
        border-bottom: 2px solid #e5e7eb;

        h2 {
            margin: 0;
            font-size: 1.5rem;
            color: #374151;
        }
    }

    .snapshot-button {
        padding: 0.5rem 1rem;
        background: #3b82f6;
        color: white;
        border: none;
        border-radius: 6px;
        font-size: 0.9rem;
        font-weight: 500;
        cursor: pointer;
        transition: background 0.2s;

        &:hover:not(:disabled) {
            background: #2563eb;
        }

        &:disabled {
            background: #9ca3af;
            cursor: not-allowed;
        }
    }

    .analytics-section {
        margin-bottom: 2rem;

        h3 {
            margin: 0 0 1rem 0;
            font-size: 1.2rem;
            color: #4b5563;
        }

        table {
            width: 100%;
            border-collapse: collapse;

            th,
            td {
                text-align: left;
                padding: 0.75rem;
                border-bottom: 1px solid #e5e7eb;
            }

            th {
                background: #f9fafb;
                font-weight: 600;
                color: #374151;
                font-size: 0.9rem;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }

            tr:last-child td {
                border-bottom: none;
            }

            tr:hover {
                background: #f9fafb;
            }
        }

        .feature-name {
            font-weight: 600;
            color: #2563eb;
            text-transform: capitalize;
        }

        .actions-list {
            display: flex;
            gap: 0.5rem;
            flex-wrap: wrap;
        }

        .action-badge {
            display: inline-block;
            padding: 0.25rem 0.5rem;
            background: #eff6ff;
            color: #2563eb;
            border-radius: 4px;
            font-size: 0.85rem;
            font-weight: 500;
        }

        .usage-bar-container {
            position: relative;
            width: 100%;
            height: 24px;
            background: #f3f4f6;
            border-radius: 4px;
            overflow: hidden;
        }

        .usage-bar {
            position: absolute;
            height: 100%;
            background: linear-gradient(90deg, #3b82f6, #2563eb);
            transition: width 0.3s ease;
        }

        .usage-bar-label {
            position: absolute;
            right: 8px;
            top: 50%;
            transform: translateY(-50%);
            font-size: 0.85rem;
            font-weight: 600;
            color: #374151;
        }

        .analytics-with-chart {
            display: flex;
            gap: 2rem;
            align-items: flex-start;

            @media (max-width: 1200px) {
                flex-direction: column;
            }

            .analytics-table {
                flex: 1;
                min-width: 0;
            }

            .analytics-chart {
                flex-shrink: 0;
                width: 400px;

                @media (max-width: 1200px) {
                    width: 100%;
                    max-width: 500px;
                    margin: 0 auto;
                }
            }
        }
    }
</style>
