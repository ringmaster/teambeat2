<script lang="ts">
    import { goto } from "$app/navigation";
    import { toastStore } from "$lib/stores/toast";
    import AdminNav from "$lib/components/AdminNav.svelte";
    import type { PageData } from "./$types";

    let { data }: { data: PageData } = $props();

    let searchInput = $state(data.search);
    let isSearching = $state(false);
    let deletingUserId = $state<string | null>(null);

    async function handleSearch(event: Event) {
        event.preventDefault();
        isSearching = true;
        const params = new URLSearchParams();
        params.set("page", "1");
        if (searchInput) {
            params.set("search", searchInput);
        }
        await goto(`/admin/users?${params.toString()}`);
        isSearching = false;
    }

    function handleClearSearch() {
        searchInput = "";
        goto("/admin/users");
    }

    async function generateResetUrl(userId: string, userEmail: string) {
        try {
            const response = await fetch(
                "/api/admin/users/generate-reset-token",
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ userId }),
                },
            );

            if (!response.ok) {
                throw new Error("Failed to generate reset URL");
            }

            const result = await response.json();

            // Copy to clipboard
            await navigator.clipboard.writeText(result.resetUrl);
            toastStore.success(`Password reset URL copied for ${userEmail}`);
        } catch (err) {
            toastStore.error("Failed to generate reset URL");
            console.error(err);
        }
    }

    function confirmDeleteUser(userId: string, userEmail: string) {
        toastStore.warning(
            `Delete user ${userEmail}? This action cannot be undone.`,
            {
                autoHide: false,
                actions: [
                    {
                        label: "Delete",
                        onClick: () => deleteUser(userId, userEmail),
                        variant: "primary",
                    },
                    {
                        label: "Cancel",
                        onClick: () => {},
                        variant: "secondary",
                    },
                ],
            },
        );
    }

    async function deleteUser(userId: string, userEmail: string) {
        deletingUserId = userId;
        try {
            const response = await fetch(`/api/admin/users/${userId}`, {
                method: "DELETE",
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || "Failed to delete user");
            }

            toastStore.success(`User ${userEmail} deleted successfully`);

            // Reload the page
            window.location.reload();
        } catch (err) {
            toastStore.error(
                err instanceof Error ? err.message : "Failed to delete user",
            );
            console.error(err);
        } finally {
            deletingUserId = null;
        }
    }

    function goToPage(page: number) {
        const params = new URLSearchParams();
        params.set("page", page.toString());
        if (data.search) {
            params.set("search", data.search);
        }
        goto(`/admin/users?${params.toString()}`);
    }

    const totalPages = Math.ceil(data.totalCount / data.pageSize);
    const hasPrevPage = data.page > 1;
    const hasNextPage = data.page < totalPages;

    function formatDate(dateStr: string): string {
        const date = new Date(dateStr);
        return date.toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
        });
    }
</script>

<AdminNav />
<div class="page-container">
    <div class="users-page">
        <header class="page-header">
            <h1>User Management</h1>
            <div class="user-count">Total Users: {data.totalCount}</div>
        </header>

        <form class="search-form" onsubmit={handleSearch}>
            <input
                type="text"
                bind:value={searchInput}
                placeholder="Search by email or name..."
                class="search-input"
            />
            <button type="submit" class="search-button" disabled={isSearching}>
                {isSearching ? "Searching..." : "Search"}
            </button>
            {#if data.search}
                <button
                    type="button"
                    class="clear-button"
                    onclick={handleClearSearch}
                >
                    Clear
                </button>
            {/if}
        </form>

        {#if data.users.length === 0}
            <div class="empty-state">
                {#if data.search}
                    <p>No users found matching "{data.search}"</p>
                {:else}
                    <p>No users found</p>
                {/if}
            </div>
        {:else}
            <div class="users-table-container">
                <table class="users-table">
                    <thead>
                        <tr>
                            <th>Email</th>
                            <th>Name</th>
                            <th>Role</th>
                            <th>Created</th>
                            <th>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {#each data.users as user}
                            <tr>
                                <td class="email-cell">{user.email}</td>
                                <td class="name-cell">{user.name || "-"}</td>
                                <td class="role-cell">
                                    {#if user.isAdmin}
                                        <span class="admin-badge">Admin</span>
                                    {:else}
                                        User
                                    {/if}
                                </td>
                                <td class="date-cell"
                                    >{formatDate(user.createdAt)}</td
                                >
                                <td class="actions-cell">
                                    <button
                                        type="button"
                                        class="action-button copy-button"
                                        onclick={() =>
                                            generateResetUrl(
                                                user.id,
                                                user.email,
                                            )}
                                    >
                                        Copy Reset URL
                                    </button>
                                    <button
                                        type="button"
                                        class="action-button delete-button"
                                        onclick={() =>
                                            confirmDeleteUser(
                                                user.id,
                                                user.email,
                                            )}
                                        disabled={user.isAdmin ||
                                            deletingUserId === user.id}
                                    >
                                        {deletingUserId === user.id
                                            ? "Deleting..."
                                            : "Delete"}
                                    </button>
                                </td>
                            </tr>
                        {/each}
                    </tbody>
                </table>
            </div>

            {#if totalPages > 1}
                <div class="pagination">
                    <button
                        type="button"
                        class="pagination-button"
                        onclick={() => goToPage(data.page - 1)}
                        disabled={!hasPrevPage}
                    >
                        Previous
                    </button>
                    <span class="page-indicator">
                        Page {data.page} of {totalPages}
                    </span>
                    <button
                        type="button"
                        class="pagination-button"
                        onclick={() => goToPage(data.page + 1)}
                        disabled={!hasNextPage}
                    >
                    </button>
                </div>
            {/if}
        {/if}
    </div>
</div>

<style lang="less">
    @import "$lib/styles/_mixins.less";

    .page-container {
        .page-container();
        max-width: 1200px;
        margin: 0 auto;
        padding: 2rem 1rem;
    }

    .users-page {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
    }

    .page-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 1rem;

        h1 {
            margin: 0;
            font-size: 1.75rem;
            color: var(--color-text-primary);
        }

        .user-count {
            color: var(--color-text-secondary);
            font-size: 0.95rem;
        }
    }

    .search-form {
        display: flex;
        gap: 0.75rem;
        flex-wrap: wrap;

        .search-input {
            flex: 1;
            min-width: 250px;
            padding: 0.65rem 1rem;
            border: 1px solid var(--input-border);
            border-radius: 6px;
            font-size: 0.95rem;
            background: var(--color-bg-primary);
            color: var(--color-text-primary);

            &:focus {
                outline: none;
                border-color: var(--input-border-focus);
                box-shadow: 0 0 0 3px var(--interactive-focus-ring);
            }

            &::placeholder {
                color: var(--input-placeholder);
            }
        }

        .search-button,
        .clear-button {
            padding: 0.65rem 1.5rem;
            border-radius: 6px;
            font-size: 0.95rem;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s ease;
            min-height: 44px;

            &:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
        }

        .search-button {
            background: var(--color-primary);
            color: var(--color-text-inverse);
            border: none;

            &:hover:not(:disabled) {
                background: var(--color-primary-hover);
            }

            &:active:not(:disabled) {
                background: var(--color-primary-active);
            }
        }

        .clear-button {
            background: var(--color-bg-secondary);
            color: var(--color-text-primary);
            border: 1px solid var(--input-border);

            &:hover {
                background: var(--surface-hover);
            }
        }
    }

    .empty-state {
        padding: 3rem 1rem;
        text-align: center;
        color: var(--color-text-secondary);
        font-size: 1rem;

        p {
            margin: 0;
        }
    }

    .users-table-container {
        overflow-x: auto;
        border: 1px solid var(--input-border);
        border-radius: 8px;
        background: var(--color-bg-primary);
    }

    .users-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 0.95rem;

        thead {
            background: var(--color-bg-secondary);
            border-bottom: 2px solid var(--input-border);

            th {
                padding: 1rem;
                text-align: left;
                font-weight: 600;
                color: var(--color-text-primary);
                white-space: nowrap;
            }
        }

        tbody {
            tr {
                border-bottom: 1px solid var(--input-border);
                transition: background-color 0.15s ease;

                &:hover {
                    background: var(--surface-hover);
                }

                &:last-child {
                    border-bottom: none;
                }
            }

            td {
                padding: 1rem;
                color: var(--color-text-primary);
            }
        }

        .email-cell {
            font-weight: 500;
        }

        .name-cell {
            color: var(--color-text-secondary);
        }

        .role-cell {
            .admin-badge {
                display: inline-block;
                padding: 0.25rem 0.75rem;
                background: var(--color-accent);
                color: var(--color-text-inverse);
                border-radius: 4px;
                font-size: 0.85rem;
                font-weight: 600;
            }
        }

        .date-cell {
            color: var(--color-text-secondary);
            font-size: 0.9rem;
        }

        .actions-cell {
            display: flex;
            gap: 0.5rem;
            flex-wrap: wrap;

            .action-button {
                padding: 0.5rem 1rem;
                border-radius: 6px;
                font-size: 0.85rem;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s ease;
                white-space: nowrap;
                min-height: 44px;

                &:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
            }

            .copy-button {
                background: var(--color-secondary);
                color: var(--color-text-inverse);
                border: none;

                &:hover:not(:disabled) {
                    background: var(--color-secondary-hover);
                }
            }

            .delete-button {
                background: transparent;
                color: var(--color-danger);
                border: 1px solid var(--color-danger);

                &:hover:not(:disabled) {
                    background: var(--color-danger);
                    color: var(--color-text-inverse);
                }

                &:disabled {
                    color: var(--color-text-muted);
                    border-color: var(--input-border);
                }
            }
        }
    }

    .pagination {
        display: flex;
        justify-content: center;
        align-items: center;
        gap: 1rem;
        padding: 1rem 0;

        .pagination-button {
            padding: 0.65rem 1.5rem;
            background: var(--color-primary);
            color: var(--color-text-inverse);
            border: none;
            border-radius: 6px;
            font-size: 0.95rem;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s ease;
            min-height: 44px;

            &:hover:not(:disabled) {
                background: var(--color-primary-hover);
            }

            &:active:not(:disabled) {
                background: var(--color-primary-active);
            }

            &:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
        }

        .page-indicator {
            color: var(--color-text-secondary);
            font-size: 0.95rem;
            font-weight: 500;
        }
    }

    @media (max-width: 768px) {
        .page-container {
            padding: 1rem 0.5rem;
        }

        .users-table {
            font-size: 0.85rem;

            thead th,
            tbody td {
                padding: 0.75rem 0.5rem;
            }

            .actions-cell {
                flex-direction: column;

                .action-button {
                    width: 100%;
                }
            }
        }

        .page-header {
            h1 {
                font-size: 1.5rem;
            }
        }
    }
</style>
