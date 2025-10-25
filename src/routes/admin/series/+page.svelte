<script lang="ts">
import { onMount } from "svelte";
import AdminNav from "$lib/components/AdminNav.svelte";
import UserManagement from "$lib/components/UserManagement.svelte";
import type { SeriesStats } from "$lib/server/repositories/board-series";
import { toastStore } from "$lib/stores/toast";

interface SeriesStatsResponse {
	series: SeriesStats[];
	total: number;
	page: number;
	pageSize: number;
	totalPages: number;
}

let data: SeriesStatsResponse | null = $state(null);
let loading = $state(true);
let error = $state("");
let currentPage = $state(1);
let showUserModal = $state(false);
let selectedSeriesId = $state<string | null>(null);
let selectedSeriesName = $state<string>("");
let seriesUsers = $state<any[]>([]);
let loadingUsers = $state(false);

async function loadSeriesStats(page: number = 1) {
	loading = true;
	try {
		const response = await fetch(`/api/admin/series?page=${page}&pageSize=50`);
		if (!response.ok) {
			const errorData = await response
				.json()
				.catch(() => ({ message: response.statusText }));
			throw new Error(
				errorData.message || `HTTP ${response.status}: ${response.statusText}`,
			);
		}
		data = await response.json();
		currentPage = page;
		error = "";
	} catch (err) {
		error = err instanceof Error ? err.message : String(err);
		console.error("Failed to load series stats:", err);
	} finally {
		loading = false;
	}
}

async function deleteSeries(seriesId: string, seriesName: string) {
	toastStore.warning(`Delete series "${seriesName}" and all associated data?`, {
		autoHide: false,
		actions: [
			{
				label: "Delete",
				onClick: async () => {
					try {
						const response = await fetch("/api/admin/series", {
							method: "DELETE",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({ seriesId }),
						});

						if (response.ok) {
							toastStore.success("Series deleted successfully");
							await loadSeriesStats(currentPage);
						} else {
							throw new Error("Failed to delete series");
						}
					} catch (err) {
						toastStore.error("Failed to delete series");
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

async function toggleMembership(seriesId: string) {
	try {
		const response = await fetch("/api/admin/series", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				action: "toggle_membership",
				seriesId,
			}),
		});

		if (response.ok) {
			const result = await response.json();
			toastStore.success(
				result.isMember ? "Membership added" : "Membership removed",
			);
			await loadSeriesStats(currentPage);
		} else {
			throw new Error("Failed to toggle membership");
		}
	} catch (err) {
		toastStore.error("Failed to toggle membership");
	}
}

async function openUserManagement(seriesId: string, seriesName: string) {
	selectedSeriesId = seriesId;
	selectedSeriesName = seriesName;
	showUserModal = true;
	await loadSeriesUsers(seriesId);
}

async function loadSeriesUsers(seriesId: string) {
	loadingUsers = true;
	try {
		const response = await fetch(`/api/series/${seriesId}/users`);
		if (!response.ok) {
			throw new Error("Failed to load users");
		}
		const data = await response.json();
		seriesUsers = data.users || [];
	} catch (err) {
		toastStore.error("Failed to load series users");
		seriesUsers = [];
	} finally {
		loadingUsers = false;
	}
}

function closeUserModal() {
	showUserModal = false;
	selectedSeriesId = null;
	selectedSeriesName = "";
	seriesUsers = [];
}

async function handleUserAdded(email: string) {
	if (!selectedSeriesId) return;

	const response = await fetch(`/api/series/${selectedSeriesId}/users`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ email, role: "member" }),
	});

	if (!response.ok) {
		const errorData = await response.json();
		throw new Error(errorData.message || "Failed to add user");
	}

	await loadSeriesUsers(selectedSeriesId);
	toastStore.success("User added successfully");
}

async function handleUserRemoved(userId: string) {
	if (!selectedSeriesId) return;

	const response = await fetch(`/api/series/${selectedSeriesId}/users`, {
		method: "DELETE",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ userId }),
	});

	if (!response.ok) {
		throw new Error("Failed to remove user");
	}

	await loadSeriesUsers(selectedSeriesId);
	toastStore.success("User removed successfully");
}

async function handleUserRoleChanged(userId: string, newRole: string) {
	if (!selectedSeriesId) return;

	const response = await fetch(`/api/series/${selectedSeriesId}/users`, {
		method: "PATCH",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ userId, role: newRole }),
	});

	if (!response.ok) {
		throw new Error("Failed to update user role");
	}

	await loadSeriesUsers(selectedSeriesId);
	toastStore.success("User role updated successfully");
}

function formatDate(dateString: string | null): string {
	if (!dateString) return "Never";
	return new Date(dateString).toLocaleString();
}

onMount(() => {
	loadSeriesStats();
});
</script>

<AdminNav />
<div class="page-container">
    <div class="series-dashboard">
        <header class="dashboard-header">
            <h1>Series Management</h1>
        </header>

        {#if loading}
            <div class="loading">Loading series data...</div>
        {:else if error}
            <div class="error-message">{error}</div>
        {:else if data}
            <div class="stats-summary">
                <div class="stat">
                    <span class="stat-label">Total Series:</span>
                    <span class="stat-value">{data.total}</span>
                </div>
                <div class="stat">
                    <span class="stat-label">Page:</span>
                    <span class="stat-value"
                        >{data.page} of {data.totalPages}</span
                    >
                </div>
            </div>

            {#if data.series.length === 0}
                <div class="no-series">No series found.</div>
            {:else}
                <div class="series-table-container">
                    <table class="series-table">
                        <thead>
                            <tr>
                                <th>Series Name</th>
                                <th>Users</th>
                                <th>Boards</th>
                                <th>Last Access</th>
                                <th>Member</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {#each data.series as series}
                                <tr>
                                    <td class="series-name">
                                        <div class="series-name-content">
                                            <strong>{series.name}</strong>
                                            {#if series.description}
                                                <span class="description"
                                                    >{series.description}</span
                                                >
                                            {/if}
                                        </div>
                                    </td>
                                    <td>
                                        <button
                                            class="user-count-btn"
                                            onclick={() =>
                                                openUserManagement(
                                                    series.id,
                                                    series.name,
                                                )}
                                        >
                                            {series.userCount}
                                        </button>
                                    </td>
                                    <td>{series.boardCount}</td>
                                    <td class="last-access">
                                        {formatDate(series.lastAccessTime)}
                                    </td>
                                    <td>
                                        <button
                                            class="membership-toggle"
                                            class:is-member={series.adminIsMember}
                                            onclick={() =>
                                                toggleMembership(series.id)}
                                        >
                                            {series.adminIsMember ? "✓" : "✗"}
                                        </button>
                                    </td>
                                    <td>
                                        <button
                                            class="delete-btn"
                                            onclick={() =>
                                                deleteSeries(
                                                    series.id,
                                                    series.name,
                                                )}
                                        >
                                            Delete
                                        </button>
                                    </td>
                                </tr>
                            {/each}
                        </tbody>
                    </table>
                </div>

                {#if data.totalPages > 1}
                    <div class="pagination">
                        <button
                            disabled={currentPage === 1}
                            onclick={() => loadSeriesStats(currentPage - 1)}
                        >
                            Previous
                        </button>
                        <span class="page-info"
                            >Page {currentPage} of {data.totalPages}</span
                        >
                        <button
                            disabled={currentPage === data.totalPages}
                            onclick={() => loadSeriesStats(currentPage + 1)}
                        >
                            Next
                        </button>
                    </div>
                {/if}
            {/if}
        {/if}
    </div>
</div>

{#if showUserModal && selectedSeriesId}
    <div class="modal-overlay" onclick={closeUserModal}>
        <div class="modal-dialog" onclick={(e) => e.stopPropagation()}>
            <div class="modal-header">
                <h2>Manage Users - {selectedSeriesName}</h2>
                <button class="close-btn" onclick={closeUserModal}>×</button>
            </div>
            <div class="modal-content">
                {#if loadingUsers}
                    <div class="loading">Loading users...</div>
                {:else}
                    <UserManagement
                        seriesId={selectedSeriesId}
                        currentUserRole="admin"
                        bind:users={seriesUsers}
                        onUserAdded={handleUserAdded}
                        onUserRemoved={handleUserRemoved}
                        onUserRoleChanged={handleUserRoleChanged}
                    />
                {/if}
            </div>
        </div>
    </div>
{/if}

<style lang="less">
    @import "$lib/styles/_mixins.less";

    .page-container {
        .page-container();
    }

    .series-dashboard {
        padding: 2rem;
        max-width: 1400px;
        margin: 0 auto;
        width: 100%;
    }

    .dashboard-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 2rem;

        h1 {
            margin: 0;
            font-size: 2rem;
            color: @neutral-darker;
        }
    }

    .loading,
    .error-message,
    .no-series {
        text-align: center;
        padding: 2rem;
        font-size: 1.2rem;
    }

    .error-message {
        color: @brand-danger;
        background: lighten(@brand-danger, 35%);
        border: 1px solid @brand-danger;
        border-radius: 8px;
    }

    .stats-summary {
        display: flex;
        gap: 2rem;
        margin-bottom: 1.5rem;
        padding: 1rem;
        background: @neutral-white;
        border: 1px solid @neutral-gray;
        border-radius: 8px;

        .stat {
            display: flex;
            gap: 0.5rem;
            align-items: center;
        }

        .stat-label {
            color: @neutral-mid-gray;
            font-weight: 500;
        }

        .stat-value {
            font-weight: 600;
            color: @neutral-darker;
            font-size: 1.1rem;
        }
    }

    .series-table-container {
        background: @neutral-white;
        border: 1px solid @neutral-gray;
        border-radius: 8px;
        overflow: hidden;
        margin-bottom: 1.5rem;
    }

    .series-table {
        width: 100%;
        border-collapse: collapse;

        th,
        td {
            text-align: left;
            padding: 1rem;
            border-bottom: 1px solid @neutral-light-gray;
        }

        th {
            background: @neutral-light-gray;
            font-weight: 600;
            color: @neutral-darker;
        }

        tbody tr {
            transition: background 0.2s;

            &:hover {
                background: @neutral-off-white;
            }

            &:last-child td {
                border-bottom: none;
            }
        }

        .series-name {
            .series-name-content {
                display: flex;
                flex-direction: column;
                gap: 0.25rem;

                strong {
                    color: @neutral-darker;
                }

                .description {
                    font-size: 0.875rem;
                    color: @neutral-mid-gray;
                }
            }
        }

        .last-access {
            font-family: "Courier New", monospace;
            font-size: 0.9rem;
            color: @neutral-mid-gray;
        }
    }

    .user-count-btn {
        background: @interactive-secondary;
        color: @neutral-white;
        border: none;
        padding: 0.375rem 0.75rem;
        border-radius: 4px;
        cursor: pointer;
        font-weight: 600;
        transition: all 0.2s;

        &:hover {
            background: darken(@interactive-secondary, 10%);
        }
    }

    .membership-toggle {
        width: 2.5rem;
        height: 2.5rem;
        border-radius: 4px;
        border: 2px solid @neutral-mid-gray;
        background: @neutral-white;
        color: @neutral-mid-gray;
        font-size: 1.2rem;
        font-weight: bold;
        cursor: pointer;
        transition: all 0.2s;

        &:hover {
            transform: scale(1.1);
        }

        &.is-member {
            background: @brand-success;
            border-color: @brand-success;
            color: @neutral-white;
        }
    }

    .delete-btn {
        background: @brand-danger;
        color: @neutral-white;
        border: none;
        padding: 0.5rem 1rem;
        border-radius: 4px;
        cursor: pointer;
        font-weight: 500;
        transition: all 0.2s;

        &:hover {
            background: darken(@brand-danger, 10%);
        }
    }

    .pagination {
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 1rem;
        padding: 1rem;

        button {
            padding: 0.5rem 1rem;
            background: @interactive-primary;
            color: @neutral-white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            transition: all 0.2s;

            &:hover:not(:disabled) {
                background: darken(@interactive-primary, 10%);
            }

            &:disabled {
                background: @neutral-gray;
                cursor: not-allowed;
            }
        }

        .page-info {
            font-weight: 500;
            color: @neutral-darker;
        }
    }

    .modal-overlay {
        .modal-overlay();
    }

    .modal-dialog {
        .modal-dialog-large();
    }

    .modal-header {
        .modal-header();

        h2 {
            .modal-title();
        }
    }

    .modal-content {
        .modal-content();
    }

    .close-btn {
        .close-button();
        font-size: 1.5rem;
    }
</style>
