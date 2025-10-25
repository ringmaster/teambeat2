<script lang="ts">
import { getUserDisplayName } from "$lib/utils/animalNames";

interface UserStatus {
	userId: string;
	userName: string;
	userRole: string;
	isActive: boolean;
	lastSeen: number | null;
	currentActivity: string | null;
	votesRemaining: number;
	totalVotes: number;
	votesUsed: number;
}

interface Props {
	open: boolean;
	boardId: string;
	blameFreeMode: boolean;
	onClose: () => void;
}

let { open = false, boardId, blameFreeMode = false, onClose }: Props = $props();

let loading = $state(true);
let error = $state("");
let users = $state<UserStatus[]>([]);
let summary = $state({
	totalUsers: 0,
	activeUsers: 0,
	totalVotesRemaining: 0,
	totalVotesUsed: 0,
});

// Load user status data when modal opens
$effect(() => {
	if (open && boardId) {
		loadUserStatus();
	}
});

async function loadUserStatus() {
	loading = true;
	error = "";

	try {
		const response = await fetch(`/api/boards/${boardId}/user-status`);

		if (!response.ok) {
			const errorData = await response.json();
			throw new Error(errorData.error || "Failed to load user status");
		}

		const data = await response.json();
		users = data.users || [];
		summary = data.summary || {};
	} catch (err) {
		console.error("Failed to load user status:", err);
		error = err instanceof Error ? err.message : "Failed to load user status";
	} finally {
		loading = false;
	}
}

function handleBackdropClick(event: MouseEvent) {
	if (event.target === event.currentTarget) {
		onClose();
	}
}

function handleKeydown(event: KeyboardEvent) {
	if (event.key === "Escape") {
		onClose();
	}
}

function formatLastSeen(lastSeen: number | null): string {
	if (!lastSeen) return "";

	const now = Date.now();
	const diff = now - lastSeen;

	if (diff < 60000) return "Just now";
	if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
	if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
	return `${Math.floor(diff / 86400000)}d ago`;
}

function getDisplayName(user: UserStatus): string {
	return getUserDisplayName(user.userName, boardId, blameFreeMode);
}

function getRoleBadgeClass(role: string): string {
	switch (role) {
		case "admin":
			return "role-admin";
		case "facilitator":
			return "role-facilitator";
		case "member":
			return "role-member";
		default:
			return "";
	}
}
</script>

<svelte:window on:keydown={handleKeydown} />

{#if open}
    <div
        class="modal-overlay"
        onclick={handleBackdropClick}
        onkeydown={handleKeydown}
        role="button"
        tabindex="-1"
    >
        <div
            class="modal-dialog-large"
            onclick={(e) => e.stopPropagation()}
            onkeydown={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="modal-title"
            aria-modal="true"
            tabindex="0"
        >
            <div class="modal-header">
                <h2 id="modal-title" class="modal-title">User Voting Status</h2>
                <button
                    class="close-button"
                    onclick={onClose}
                    aria-label="Close modal"
                >
                    <svg
                        width="24"
                        height="24"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        stroke-width="2"
                        stroke-linecap="round"
                        stroke-linejoin="round"
                    >
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>
            </div>

            <div class="modal-content">
                {#if loading}
                    <div class="loading-state">
                        <div class="spinner"></div>
                        <p>Loading user status...</p>
                    </div>
                {:else if error}
                    <div class="error-state">
                        <p class="error-message">{error}</p>
                        <button
                            class="btn btn-primary btn-sm"
                            onclick={loadUserStatus}
                        >
                            Try Again
                        </button>
                    </div>
                {:else}
                    <!-- Summary Stats -->
                    <div class="summary-stats">
                        <div class="stat-card">
                            <div class="stat-value">
                                {summary.activeUsers}/{summary.totalUsers}
                            </div>
                            <div class="stat-label">Active Users</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-value">
                                {summary.totalVotesRemaining}
                            </div>
                            <div class="stat-label">Votes Remaining</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-value">
                                {summary.totalVotesUsed}
                            </div>
                            <div class="stat-label">Votes Used</div>
                        </div>
                    </div>

                    <!-- User Table -->
                    <div class="table-container">
                        <table class="data-table">
                            <thead>
                                <tr>
                                    <th>User</th>
                                    <th>Role</th>
                                    <th>Status</th>
                                    <th>Votes Used</th>
                                    <th>Votes Remaining</th>
                                </tr>
                            </thead>
                            <tbody>
                                {#each users as user (user.userId)}
                                    <tr
                                        class="user-row"
                                        class:inactive={!user.isActive}
                                    >
                                        <td>
                                            <div class="user-info">
                                                <div class="user-name">
                                                    {getDisplayName(user)}
                                                </div>
                                                {#if !user.isActive && user.lastSeen}
                                                    <div class="last-seen">
                                                        Last seen {formatLastSeen(
                                                            user.lastSeen,
                                                        )}
                                                    </div>
                                                {/if}
                                            </div>
                                        </td>
                                        <td>
                                            <span
                                                class="role-badge {getRoleBadgeClass(
                                                    user.userRole,
                                                )}"
                                            >
                                                {user.userRole}
                                            </span>
                                        </td>
                                        <td>
                                            <div
                                                class="status-indicator"
                                                class:online={user.isActive}
                                                class:offline={!user.isActive}
                                            >
                                                {user.isActive
                                                    ? "Online"
                                                    : "Offline"}
                                            </div>
                                        </td>
                                        <td>
                                            <span class="vote-fraction"
                                                >{user.votesUsed}/{user.totalVotes}</span
                                            >
                                        </td>
                                        <td>
                                            <span class="votes-remaining"
                                                >{user.votesRemaining}</span
                                            >
                                        </td>
                                    </tr>
                                {/each}
                            </tbody>
                        </table>
                    </div>
                {/if}
            </div>

            <div class="modal-actions">
                {#if !loading && !error}
                    <button class="btn btn-secondary" onclick={loadUserStatus}
                        >Refresh</button
                    >
                {/if}
                <button class="btn btn-primary" onclick={onClose}>Close</button>
            </div>
        </div>
    </div>
{/if}

<style>
    .loading-state,
    .error-state {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: var(--spacing-8);
        gap: var(--spacing-4);
        min-height: 200px;
    }

    .spinner {
        width: 32px;
        height: 32px;
        border: 3px solid var(--color-gray-200);
        border-top: 3px solid var(--color-primary);
        border-radius: 50%;
        animation: spin 1s linear infinite;
    }

    @keyframes spin {
        0% {
            transform: rotate(0deg);
        }
        100% {
            transform: rotate(360deg);
        }
    }

    .error-message {
        color: var(--color-danger);
        margin: 0;
        text-align: center;
    }

    .close-button {
        background: none;
        border: none;
        padding: var(--spacing-2);
        cursor: pointer;
        color: var(--color-text-secondary);
        border-radius: var(--radius-md);
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s ease;
    }

    .close-button:hover {
        background: var(--color-gray-100);
        color: var(--color-text-primary);
    }

    .summary-stats {
        display: flex;
        gap: var(--spacing-4);
        margin-bottom: var(--spacing-6);
        padding: var(--spacing-4);
        background: var(--color-gray-50);
        border-radius: var(--radius-md);
        border: 1px solid var(--color-gray-200);
    }

    .stat-card {
        text-align: center;
        flex: 1;
    }

    .stat-value {
        font-size: var(--text-xl);
        font-weight: 700;
        color: var(--color-text-primary);
        line-height: 1;
    }

    .stat-label {
        font-size: var(--text-sm);
        color: var(--color-text-secondary);
        margin-top: var(--spacing-1);
    }

    .table-container {
        border: 1px solid var(--color-gray-200);
        border-radius: var(--radius-md);
        overflow: hidden;
    }

    .data-table {
        width: 100%;
        border-collapse: collapse;
    }

    .data-table th {
        background: var(--color-gray-50);
        padding: var(--spacing-3);
        text-align: left;
        font-weight: 600;
        color: var(--color-text-primary);
        border-bottom: 1px solid var(--color-gray-200);
        font-size: var(--text-sm);
    }

    .data-table td {
        padding: var(--spacing-3);
        border-bottom: 1px solid var(--color-gray-200);
        vertical-align: top;
    }

    .user-row:last-child td {
        border-bottom: none;
    }

    .user-row.inactive {
        opacity: 0.6;
        background: var(--color-gray-25);
    }

    .user-info {
        display: flex;
        flex-direction: column;
        gap: var(--spacing-1);
    }

    .user-name {
        font-weight: 600;
        color: var(--color-text-primary);
    }

    .last-seen {
        font-size: var(--text-xs);
        color: var(--color-text-secondary);
    }

    .role-badge {
        display: inline-block;
        padding: var(--spacing-1) var(--spacing-2);
        border-radius: var(--radius-sm);
        font-size: var(--text-xs);
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }

    .role-admin {
        background: var(--color-purple-100);
        color: var(--color-purple-700);
    }

    .role-facilitator {
        background: var(--color-blue-100);
        color: var(--color-blue-700);
    }

    .role-member {
        background: var(--color-gray-100);
        color: var(--color-gray-700);
    }

    .status-indicator {
        display: inline-flex;
        align-items: center;
        gap: var(--spacing-2);
        font-size: var(--text-sm);
        font-weight: 500;
    }

    .status-indicator::before {
        content: "";
        width: 8px;
        height: 8px;
        border-radius: 50%;
    }

    .status-indicator.online {
        color: var(--color-success);
    }

    .status-indicator.online::before {
        background: var(--color-success);
    }

    .status-indicator.offline {
        color: var(--color-gray-500);
    }

    .status-indicator.offline::before {
        background: var(--color-gray-400);
    }

    .vote-fraction {
        font-weight: 500;
        font-variant-numeric: tabular-nums;
        color: var(--color-text-primary);
    }

    .votes-remaining {
        font-weight: 600;
        font-variant-numeric: tabular-nums;
        color: var(--color-primary);
        font-size: var(--text-base);
    }
</style>
