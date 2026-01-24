<script lang="ts">
import { onDestroy, onMount } from "svelte";
import AdminNav from "$lib/components/AdminNav.svelte";
import { toastStore } from "$lib/stores/toast";

interface ConnectionUser {
	userId: string;
	userName: string;
	clientId: string;
	connectedAt: number;
	lastSeen: number;
}

interface BoardGroup {
	boardId: string;
	boardName: string;
	users: ConnectionUser[];
}

interface ConnectionsData {
	totalConnections: number;
	uniqueUsers: number;
	uniqueBoards: number;
	byBoard: BoardGroup[];
}

let data: ConnectionsData | null = $state(null);
let loading = $state(true);
let error = $state("");
let autoRefresh = $state(true);
let refreshInterval: ReturnType<typeof setInterval> | null = null;

async function loadConnections() {
	try {
		const response = await fetch("/api/admin/performance/connections");
		if (!response.ok) {
			throw new Error("Failed to load connections");
		}
		data = await response.json();
		error = "";
	} catch (err) {
		error = err instanceof Error ? err.message : "Unknown error";
	}
}

function formatDuration(timestamp: number): string {
	const seconds = Math.floor((Date.now() - timestamp) / 1000);
	if (seconds < 60) return `${seconds}s ago`;
	const minutes = Math.floor(seconds / 60);
	if (minutes < 60) return `${minutes}m ago`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `${hours}h ${minutes % 60}m ago`;
	const days = Math.floor(hours / 24);
	return `${days}d ${hours % 24}h ago`;
}

function kickClient(clientId: string, userName: string) {
	toastStore.warning(`Disconnect this specific connection for ${userName}?`, {
		autoHide: false,
		actions: [
			{
				label: "Disconnect",
				onClick: async () => {
					try {
						const response = await fetch("/api/admin/performance/connections", {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({
								action: "kickClient",
								clientId,
								redirectTo: "/dashboard",
							}),
						});
						const result = await response.json();
						if (response.ok && result.success) {
							toastStore.success("Connection disconnected");
							await loadConnections();
						} else {
							toastStore.error(result.message || "Failed to disconnect");
						}
					} catch (err) {
						toastStore.error("Failed to disconnect");
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

onMount(async () => {
	loading = true;
	await loadConnections();
	loading = false;

	refreshInterval = setInterval(async () => {
		if (autoRefresh) {
			await loadConnections();
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
    <div class="connections-dashboard">
        <header class="dashboard-header">
            <h1>Active Connections</h1>
            <div class="controls">
                <label>
                    <input type="checkbox" bind:checked={autoRefresh} />
                    Auto-refresh (5s)
                </label>
                <button class="refresh-button" onclick={loadConnections} aria-label="Refresh connections">
                    Refresh
                </button>
            </div>
        </header>

        {#if loading}
            <div class="loading">Loading connections...</div>
        {:else if error}
            <div class="error">{error}</div>
        {:else if data}
            <div class="summary-cards">
                <div class="summary-card">
                    <span class="summary-value">{data.totalConnections}</span>
                    <span class="summary-label">Total Connections</span>
                </div>
                <div class="summary-card">
                    <span class="summary-value">{data.uniqueUsers}</span>
                    <span class="summary-label">Unique Users</span>
                </div>
                <div class="summary-card">
                    <span class="summary-value">{data.uniqueBoards}</span>
                    <span class="summary-label">Active Boards</span>
                </div>
            </div>

            {#if data.byBoard.length === 0}
                <div class="no-connections">
                    <p>No active connections</p>
                </div>
            {:else}
                <div class="boards-list">
                    {#each data.byBoard as board (board.boardId)}
                        <section class="board-card">
                            <header class="board-header">
                                <h2>
                                    {#if board.boardId === "__no_board__"}
                                        <span class="board-name idle">Not on a board</span>
                                    {:else}
                                        <span class="board-name">{board.boardName}</span>
                                        <span class="board-id">#{board.boardId}</span>
                                    {/if}
                                </h2>
                                <span class="user-count">{board.users.length} user{board.users.length !== 1 ? 's' : ''}</span>
                            </header>
                            <table class="users-table">
                                <thead>
                                    <tr>
                                        <th>User</th>
                                        <th>Connected</th>
                                        <th>Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {#each board.users as user (user.clientId)}
                                        <tr>
                                            <td class="user-cell">
                                                <span class="user-name">{user.userName}</span>
                                                {#if user.userId !== "__anonymous__"}
                                                    <span class="user-id">{user.userId.substring(0, 8)}...</span>
                                                {/if}
                                            </td>
                                            <td>{formatDuration(user.connectedAt)}</td>
                                            <td>
                                                <button
                                                    class="kick-button"
                                                    onclick={() => kickClient(user.clientId, user.userName)}
                                                    aria-label="Disconnect this connection for {user.userName}"
                                                >
                                                    Disconnect
                                                </button>
                                            </td>
                                        </tr>
                                    {/each}
                                </tbody>
                            </table>
                        </section>
                    {/each}
                </div>
            {/if}
        {/if}
    </div>
</div>

<style lang="less">
    @import "$lib/styles/_mixins.less";

    .page-container {
        .page-container();
    }

    .connections-dashboard {
        padding: 2rem;
        max-width: 1200px;
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

            label {
                display: flex;
                align-items: center;
                gap: 0.5rem;
            }
        }
    }

    .refresh-button {
        padding: 0.5rem 1rem;
        background: var(--btn-primary-bg);
        color: var(--btn-primary-text);
        border: none;
        border-radius: 4px;
        cursor: pointer;

        &:hover {
            background: var(--btn-primary-bg-hover);
        }
    }

    .loading,
    .error,
    .no-connections {
        text-align: center;
        padding: 2rem;
        font-size: 1.2rem;
    }

    .error {
        color: var(--color-error);
    }

    .no-connections {
        color: var(--text-secondary);
    }

    .summary-cards {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 1rem;
        margin-bottom: 2rem;
    }

    .summary-card {
        background: var(--surface-primary);
        border: 1px solid var(--surface-tertiary);
        border-radius: 8px;
        padding: 1.5rem;
        text-align: center;

        .summary-value {
            display: block;
            font-size: 2.5rem;
            font-weight: 700;
            color: var(--color-primary);
        }

        .summary-label {
            display: block;
            font-size: 0.875rem;
            color: var(--text-secondary);
            margin-top: 0.25rem;
        }
    }

    .boards-list {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
    }

    .board-card {
        background: var(--surface-primary);
        border: 1px solid var(--surface-tertiary);
        border-radius: 8px;
        overflow: hidden;
    }

    .board-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 1rem 1.5rem;
        background: var(--surface-secondary);
        border-bottom: 1px solid var(--surface-tertiary);

        h2 {
            margin: 0;
            font-size: 1.1rem;
            display: flex;
            align-items: center;
            gap: 0.5rem;
        }

        .board-name {
            font-weight: 600;

            &.idle {
                color: var(--text-secondary);
                font-style: italic;
            }
        }

        .board-id {
            font-size: 0.85rem;
            color: var(--text-tertiary);
            font-weight: normal;
        }

        .user-count {
            font-size: 0.875rem;
            color: var(--text-secondary);
            background: var(--surface-tertiary);
            padding: 0.25rem 0.75rem;
            border-radius: 1rem;
        }
    }

    .users-table {
        width: 100%;
        border-collapse: collapse;

        th,
        td {
            text-align: left;
            padding: 0.75rem 1.5rem;
            border-bottom: 1px solid var(--surface-tertiary);
        }

        th {
            font-size: 0.75rem;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: var(--text-tertiary);
            font-weight: 600;
        }

        tbody tr:last-child td {
            border-bottom: none;
        }

        tbody tr:hover {
            background: var(--surface-secondary);
        }
    }

    .user-cell {
        .user-name {
            font-weight: 500;
            display: block;
        }

        .user-id {
            font-size: 0.75rem;
            color: var(--text-tertiary);
            font-family: monospace;
        }
    }

    .kick-button {
        padding: 0.375rem 0.75rem;
        border: 1px solid #dc2626;
        border-radius: 4px;
        font-size: 0.8rem;
        cursor: pointer;
        transition: all 0.2s;
        background: white;
        color: #dc2626;
        font-weight: 500;

        &:hover {
            background: #dc2626;
            color: white;
        }
    }

    @media (max-width: 768px) {
        .summary-cards {
            grid-template-columns: 1fr;
        }

        .dashboard-header {
            flex-direction: column;
            gap: 1rem;
            align-items: flex-start;
        }

        .users-table {
            th,
            td {
                padding: 0.5rem 1rem;
            }
        }

        .actions-cell {
            flex-direction: column;
        }
    }
</style>
