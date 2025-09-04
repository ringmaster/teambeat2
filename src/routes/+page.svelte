<script lang="ts">
    import { onMount } from "svelte";
    import { goto } from "$app/navigation";
    import { fade, fly } from "svelte/transition";
    import { cubicOut } from "svelte/easing";
    import UserManagement from "$lib/components/UserManagement.svelte";
    import InputWithButton from "$lib/components/ui/InputWithButton.svelte";
    import Icon from "$lib/components/ui/Icon.svelte";

    let user: any = $state(null);
    let series: any[] = $state([]);
    let loading = $state(true);
    let scrollY = $state(0);
    let newSeriesName = $state("");
    let seriesError = $state("");
    let creatingNewSeries = $state(false);
    let boardNames = $state({} as Record<string, string>); // seriesId -> board name
    let boardErrors = $state({} as Record<string, string>); // seriesId -> error message
    let creatingBoards = $state({} as Record<string, boolean>); // seriesId -> creating status
    let showDeleteModal = $state(false);
    let seriesToDelete: any = $state(null);
    let showUserManagementModal = $state(false);
    let seriesToManage: any = $state(null);
    let currentSeriesUsers = $state([]);

    onMount(async () => {
        window.addEventListener("scroll", () => (scrollY = window.scrollY));
        try {
            const userResponse = await fetch("/api/auth/me");
            if (userResponse.ok) {
                const userData = await userResponse.json();
                user = userData.user;

                // Load user's series
                const seriesResponse = await fetch("/api/series");

                if (seriesResponse.ok) {
                    const seriesData = await seriesResponse.json();
                    series = seriesData.series;

                    // Initialize board names for each series
                    series.forEach((s) => {
                        initializeBoardName(s.id, s.name);
                    });
                }
            }
        } catch (error) {
            console.error("Failed to load dashboard data:", error);
        } finally {
            loading = false;
        }
    });

    async function createSeries() {
        if (!newSeriesName.trim()) {
            seriesError = "Series name is required";
            return;
        }

        if (newSeriesName.trim().length < 2) {
            seriesError = "Series name must be at least 2 characters";
            return;
        }

        creatingNewSeries = true;
        seriesError = "";

        try {
            const response = await fetch("/api/series", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: newSeriesName.trim() }),
            });

            const data = await response.json();

            if (response.ok) {
                // Add the new series to the existing list immediately
                series = [...series, data.series];
                // Initialize board name for the new series (same as server-side does)
                initializeBoardName(data.series.id, data.series.name);
                // Reset form
                newSeriesName = "";
            } else {
                seriesError = data.error || "Failed to create series";
            }
        } catch (error) {
            seriesError = "Network error. Please try again.";
        } finally {
            creatingNewSeries = false;
        }
    }

    function generateBoardName(seriesName: string): string {
        return seriesName;
    }

    function initializeBoardName(seriesId: string, seriesName: string) {
        if (!boardNames[seriesId]) {
            boardNames = {
                ...boardNames,
                [seriesId]: generateBoardName(seriesName),
            };
        }
    }

    async function createBoard(seriesId: string, seriesName: string) {
        const boardName = boardNames[seriesId]?.trim();

        if (!boardName) {
            boardErrors[seriesId] = "Board name is required";
            return;
        }

        if (boardName.length < 2) {
            boardErrors[seriesId] = "Board name must be at least 2 characters";
            return;
        }

        creatingBoards[seriesId] = true;
        boardErrors[seriesId] = "";

        try {
            const response = await fetch("/api/boards", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: boardName, seriesId }),
            });

            const data = await response.json();

            if (response.ok) {
                goto(`/board/${data.board.id}`);
            } else {
                boardErrors[seriesId] = data.error || "Failed to create board";
            }
        } catch (error) {
            boardErrors[seriesId] = "Network error. Please try again.";
        } finally {
            creatingBoards[seriesId] = false;
        }
    }

    function confirmDeleteSeries(seriesItem: any) {
        seriesToDelete = seriesItem;
        showDeleteModal = true;
    }

    function cancelDelete() {
        showDeleteModal = false;
        seriesToDelete = null;
    }

    async function deleteSeries() {
        if (!seriesToDelete) return;

        try {
            const response = await fetch(`/api/series/${seriesToDelete.id}`, {
                method: "DELETE",
            });

            if (response.ok) {
                // Remove from local state
                series = series.filter((s) => s.id !== seriesToDelete.id);
                showDeleteModal = false;
                seriesToDelete = null;
            } else {
                const data = await response.json();
                const errorDetails = data.details
                    ? `\n\nDetails: ${data.details}`
                    : "";
                const errorType = data.type ? `\nType: ${data.type}` : "";
                alert(
                    `${data.error || "Failed to delete series"}${errorDetails}${errorType}`,
                );
                console.error("Series deletion error:", data);
            }
        } catch (error) {
            alert("Network error. Please try again.");
        }
    }

    async function openSeriesUserManagement(seriesItem: any) {
        seriesToManage = seriesItem;
        showUserManagementModal = true;

        // Load users for this series
        try {
            const response = await fetch(`/api/series/${seriesItem.id}/users`);
            if (response.ok) {
                const data = await response.json();
                currentSeriesUsers = data.users;
            }
        } catch (error) {
            console.error("Failed to load users:", error);
        }
    }

    function closeUserManagementModal() {
        showUserManagementModal = false;
        seriesToManage = null;
        currentSeriesUsers = [];
    }

    async function handleUserAdded(email: string) {
        try {
            const response = await fetch(
                `/api/series/${seriesToManage.id}/users`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email, role: "member" }),
                },
            );

            if (response.ok) {
                // Reload users list
                const usersResponse = await fetch(
                    `/api/series/${seriesToManage.id}/users`,
                );
                if (usersResponse.ok) {
                    const data = await usersResponse.json();
                    currentSeriesUsers = data.users;
                }
            } else {
                const data = await response.json();
                throw new Error(data.error || "Failed to add user");
            }
        } catch (error) {
            throw error;
        }
    }

    async function handleUserRemoved(userId: string) {
        try {
            const response = await fetch(
                `/api/series/${seriesToManage.id}/users?userId=${userId}`,
                {
                    method: "DELETE",
                },
            );

            if (response.ok) {
                // Remove user from local state
                currentSeriesUsers = currentSeriesUsers.filter(
                    (u) => u.userId !== userId,
                );
            } else {
                const data = await response.json();
                console.error("Failed to remove user:", data.error);
            }
        } catch (error) {
            console.error("Failed to remove user:", error);
        }
    }

    async function handleUserRoleChanged(userId: string, newRole: string) {
        try {
            const response = await fetch(
                `/api/series/${seriesToManage.id}/users`,
                {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ userId, role: newRole }),
                },
            );

            if (response.ok) {
                // Update user role in local state
                currentSeriesUsers = currentSeriesUsers.map((u) =>
                    u.userId === userId ? { ...u, role: newRole } : u,
                );
            } else {
                const data = await response.json();
                console.error("Failed to update user role:", data.error);
            }
        } catch (error) {
            console.error("Failed to update user role:", error);
        }
    }
</script>

{#if loading}
    <div class="loading-page">
        <div class="loading-content">
            <div class="loading-spinner"></div>
            <p class="loading-text">Loading TeamBeat...</p>
        </div>
    </div>
{:else if !user}
    <div class="welcome-page">
        <div class="welcome-container">
            <h1 class="welcome-title">Welcome to TeamBeat</h1>
            <p class="welcome-subtitle">
                Please sign in to access your retrospectives
            </p>
            <div class="welcome-actions">
                <a href="/login" class="btn-primary">Sign In</a>
                <a href="/register" class="btn-secondary">Register</a>
            </div>
        </div>
    </div>
{:else}
    <div class="dashboard-container">
        <!-- Dashboard Header -->
        <div class="dashboard-header">
            <div class="header-content">
                <div>
                    <h1 class="dashboard-title">
                        Welcome back{user?.name ? `, ${user.name}` : ""}!
                    </h1>
                    <p class="dashboard-subtitle">
                        Ready to run an amazing retrospective?
                    </p>
                </div>
                <div class="add-series-form">
                    <InputWithButton
                        id="newSeriesInput"
                        type="text"
                        bind:value={newSeriesName}
                        placeholder="Enter series name..."
                        buttonText={creatingNewSeries ? "Creating..." : "Add"}
                        buttonVariant="primary"
                        buttonDisabled={creatingNewSeries ||
                            !newSeriesName.trim()}
                        onButtonClick={createSeries}
                        onkeydown={(e) => {
                            if (e.key === "Enter") createSeries();
                        }}
                        class="series-input-with-button"
                    />
                </div>
            </div>
            {#if seriesError}
                <div class="form-error">
                    <svg
                        class="icon-sm status-text-danger"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                    >
                        <path
                            fill-rule="evenodd"
                            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                            clip-rule="evenodd"
                        />
                    </svg>
                    <span>{seriesError}</span>
                </div>
            {/if}
        </div>

        <!-- Board Series -->
        <div>
            <h2 class="section-title">Your Series</h2>
            {#if series.length === 0}
                <div class="empty-state">
                    <p class="empty-state-text">
                        No series yet. Create your first one to get started!
                    </p>
                    <div class="space-y-4">
                        <div class="flex items-center space-x-2 justify-center">
                            <InputWithButton
                                type="text"
                                bind:value={newSeriesName}
                                placeholder="Enter series name..."
                                buttonText={creatingNewSeries
                                    ? "Creating..."
                                    : "Create Series"}
                                buttonVariant="primary"
                                buttonDisabled={creatingNewSeries ||
                                    !newSeriesName.trim()}
                                onButtonClick={createSeries}
                                onkeydown={(e) => {
                                    if (e.key === "Enter") createSeries();
                                }}
                                class="min-w-64"
                            />
                        </div>
                        {#if seriesError}
                            <div
                                class="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl flex items-center space-x-2"
                            >
                                <svg
                                    class="w-5 h-5 text-red-500"
                                    fill="currentColor"
                                    viewBox="0 0 20 20"
                                >
                                    <path
                                        fill-rule="evenodd"
                                        d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                                        clip-rule="evenodd"
                                    />
                                </svg>
                                <span>{seriesError}</span>
                            </div>
                        {/if}
                    </div>
                </div>
            {:else}
                <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                    {#each series as s}
                        <div
                            class="card hover:shadow-2xl transition-shadow"
                        >
                            <div class="card-content">
                                <div
                                    class="flex justify-between items-start mb-4"
                                >
                                    <div class="flex-1">
                                        <h3 class="card-title">
                                            {s.name}
                                        </h3>
                                        {#if s.description}
                                            <p
                                                class="text-sm text-muted line-clamp-2"
                                            >
                                                {s.description}
                                            </p>
                                        {/if}
                                    </div>
                                    <div class="flex items-center space-x-2">
                                        <div class="badge badge-primary">
                                            {s.role}
                                        </div>
                                        {#if s.role === "admin"}
                                            <button
                                                onclick={() =>
                                                    openSeriesUserManagement(s)}
                                                class="btn btn-ghost btn-sm text-blue-500 hover:bg-blue-50"
                                                title="Manage users"
                                                aria-label="Manage users"
                                            >
                                                <svg
                                                    class="w-4 h-4"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    viewBox="0 0 24 24"
                                                >
                                                    <path
                                                        stroke-linecap="round"
                                                        stroke-linejoin="round"
                                                        stroke-width="2"
                                                        d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"
                                                    />
                                                </svg>
                                            </button>
                                            <button
                                                onclick={() =>
                                                    confirmDeleteSeries(s)}
                                                class="btn btn-ghost btn-sm text-red-500 hover:bg-red-50"
                                                title="Delete series"
                                                aria-label="Delete series"
                                            >
                                                <svg
                                                    class="w-4 h-4"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    viewBox="0 0 24 24"
                                                >
                                                    <path
                                                        stroke-linecap="round"
                                                        stroke-linejoin="round"
                                                        stroke-width="2"
                                                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                                    />
                                                </svg>
                                            </button>
                                        {/if}
                                    </div>
                                </div>

                                <div class="space-y-3">
                                    <!-- Active and Draft Boards -->
                                    {#if s.boards && s.boards.filter( (b) => ["active", "draft"].includes(b.status), ).length > 0}
                                        <div
                                            class="bg-base-200 rounded-lg p-3 space-y-2"
                                        >
                                            <h4
                                                class="text-sm font-semibold mb-2"
                                            >
                                                Active & Draft Boards:
                                            </h4>

                                            {#each s.boards.filter( (b) => ["active", "draft"].includes(b.status), ) as board}
                                                <div
                                                    class="flex items-center justify-between"
                                                >
                                                    <div class="flex-1 min-w-0">
                                                        <a
                                                            href="/board/{board.id}"
                                                            class="link link-primary font-medium text-sm truncate block"
                                                        >
                                                            {board.name}
                                                        </a>
                                                        <div
                                                            class="text-xs text-gray-500"
                                                        >
                                                            {new Date(
                                                                board.createdAt,
                                                            ).toLocaleDateString()}
                                                        </div>
                                                    </div>
                                                    <div
                                                        class="badge badge-sm
													{board.status === 'active'
                                                            ? 'badge-success'
                                                            : board.status ===
                                                                'draft'
                                                              ? 'badge-warning'
                                                              : 'badge-neutral'}"
                                                    >
                                                        {board.status}
                                                    </div>
                                                </div>
                                            {/each}
                                        </div>
                                    {:else}
                                        <div class="alert">
                                            <p
                                                class="text-sm text-muted"
                                            >
                                                No active or draft boards for
                                                this series
                                            </p>
                                        </div>
                                    {/if}

                                    <!-- Completed Boards -->
                                    {#if s.boards && s.boards.filter((b) => b.status === "completed").length > 0}
                                        <div
                                            class="bg-base-200 rounded-lg p-3 space-y-2"
                                        >
                                            <h4
                                                class="text-sm font-semibold mb-2"
                                            >
                                                Completed Boards:
                                            </h4>

                                            {#each s.boards
                                                .filter((b) => b.status === "completed")
                                                .slice(0, 5) as board}
                                                <div
                                                    class="flex items-center justify-between"
                                                >
                                                    <div class="flex-1 min-w-0">
                                                        <a
                                                            href="/board/{board.id}"
                                                            class="text-blue-600 hover:text-blue-800 font-medium text-sm hover:underline truncate block"
                                                        >
                                                            {board.name}
                                                        </a>
                                                        <div
                                                            class="text-xs text-gray-500"
                                                        >
                                                            {new Date(
                                                                board.createdAt,
                                                            ).toLocaleDateString()}
                                                        </div>
                                                    </div>
                                                    <span
                                                        class="px-2 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-700"
                                                    >
                                                        completed
                                                    </span>
                                                </div>
                                            {/each}
                                        </div>
                                    {/if}

                                    <!-- Create New Board -->
                                    <InputWithButton
                                        type="text"
                                        bind:value={boardNames[s.id]}
                                        placeholder="Board name..."
                                        buttonText={creatingBoards[s.id]
                                            ? "..."
                                            : "+"}
                                        buttonVariant="primary"
                                        buttonDisabled={creatingBoards[s.id] ||
                                            !boardNames[s.id]?.trim()}
                                        onButtonClick={() =>
                                            createBoard(s.id, s.name)}
                                        onkeydown={(e) => {
                                            if (e.key === "Enter")
                                                createBoard(s.id, s.name);
                                        }}
                                        class="board-input-with-button"
                                    />
                                    {#if boardErrors[s.id]}
                                        <div class="alert alert-error">
                                            <svg
                                                class="w-4 h-4"
                                                fill="currentColor"
                                                viewBox="0 0 20 20"
                                            >
                                                <path
                                                    fill-rule="evenodd"
                                                    d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                                                    clip-rule="evenodd"
                                                />
                                            </svg>
                                            <span>{boardErrors[s.id]}</span>
                                        </div>
                                    {/if}
                                </div>
                            </div>
                        </div>
                    {/each}
                </div>
            {/if}
        </div>
    </div>
{/if}

<!-- Delete Series Confirmation Modal -->
{#if showDeleteModal && seriesToDelete}
    <div
        class="modal-overlay"
        role="dialog"
        aria-modal="true"
        tabindex="-1"
        onclick={cancelDelete}
        onkeydown={(e) => e.key === "Escape" && cancelDelete()}
    >
        <div
            class="modal-dialog"
            role="document"
            onclick={(e) => e.stopPropagation()}
        >
            <div class="modal-content">
                <div class="flex items-center gap-3 mb-4">
                    <div class="warning-icon">
                        <Icon name="warning" size="md" color="danger" circle />
                    </div>
                    <div>
                        <h3 class="modal-title">Delete Series</h3>
                        <p class="modal-subtitle">
                            This action cannot be undone
                        </p>
                    </div>
                </div>

                <div class="mb-6">
                    <p class="text-muted mb-4">
                        Are you sure you want to delete <strong
                            >"{seriesToDelete.name}"</strong
                        >?
                    </p>
                    <div class="warning-section">
                        <div class="flex gap-3">
                            <Icon name="warning" size="sm" color="danger" class="flex-shrink-0 mt-0.5" />
                            <div>
                                <p
                                    class="text-sm font-medium status-text-danger mb-2"
                                >
                                    This will permanently delete:
                                </p>
                                <ul
                                    class="text-sm status-text-danger space-y-1"
                                >
                                    <li>All boards in this series</li>
                                    <li>All cards, votes, and comments</li>
                                    <li>All series member access</li>
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="modal-actions">
                    <button onclick={cancelDelete} class="btn-secondary">
                        Cancel
                    </button>
                    <button onclick={deleteSeries} class="btn-danger">
                        Delete Series
                    </button>
                </div>
            </div>
        </div>
    </div>
{/if}

<!-- User Management Modal -->
{#if showUserManagementModal && seriesToManage}
    <div
        class="modal-overlay"
        role="dialog"
        aria-modal="true"
        tabindex="-1"
        onclick={closeUserManagementModal}
        onkeydown={(e) => e.key === "Escape" && closeUserManagementModal()}
        transition:fade={{ duration: 300 }}
    >
        <div
            class="modal-dialog-large"
            role="document"
            onclick={(e) => e.stopPropagation()}
        >
            <!-- Header -->
            <div class="modal-header">
                <div>
                    <h2 class="modal-title">Manage Users</h2>
                    <p class="modal-subtitle">Series: {seriesToManage.name}</p>
                </div>
                <button
                    onclick={closeUserManagementModal}
                    class="close-button"
                    aria-label="Close user management"
                >
                    <Icon name="close" size="md" />
                </button>
            </div>

            <!-- Content -->
            <div class="modal-content">
                <UserManagement
                    seriesId={seriesToManage.id}
                    currentUserRole="admin"
                    bind:users={currentSeriesUsers}
                    onUserAdded={handleUserAdded}
                    onUserRemoved={handleUserRemoved}
                    onUserRoleChanged={handleUserRoleChanged}
                />
            </div>
        </div>
    </div>
{/if}

<style>
    .loading-page {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
    }

    .loading-content {
        text-align: center;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: var(--spacing-4);
    }

    .loading-spinner {
        width: 3rem;
        height: 3rem;
        border: 4px solid rgb(var(--color-gray-200));
        border-top: 4px solid rgb(var(--color-primary));
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

    .loading-text {
        color: rgb(var(--color-text-primary));
        font-weight: 500;
        font-size: 1rem;
        margin: 0;
    }

    .welcome-page {
        min-height: 80vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 0 var(--spacing-4);
    }

    .welcome-container {
        text-align: center;
        max-width: 32rem;
        width: 100%;
    }

    .welcome-title {
        font-size: 2.25rem;
        line-height: 2.5rem;
        font-weight: 700;
        background: linear-gradient(
            to right,
            rgb(var(--color-primary)),
            rgb(var(--color-secondary))
        );
        -webkit-background-clip: text;
        background-clip: text;
        color: transparent;
        margin: 0 0 var(--spacing-4) 0;
    }

    .welcome-subtitle {
        color: rgb(var(--color-text-muted));
        font-size: 1.125rem;
        margin: 0 0 var(--spacing-8) 0;
    }

    .welcome-actions {
        display: flex;
        gap: var(--spacing-4);
        justify-content: center;
        flex-wrap: wrap;
    }

    .dashboard-container {
        max-width: 80rem;
        margin: 0 auto;
        padding: var(--spacing-8) var(--spacing-4);
        display: flex;
        flex-direction: column;
        gap: var(--spacing-8);
    }

    .dashboard-header {
        background-color: white;
        border-radius: 1rem;
        box-shadow: var(--shadow-sm);
        padding: var(--spacing-8);
    }

    .header-content {
        display: flex;
        flex-direction: column;
        gap: var(--spacing-4);
        justify-content: space-between;
        align-items: flex-start;
    }

    @media (min-width: 768px) {
        .header-content {
            flex-direction: row;
            align-items: center;
        }
    }

    .dashboard-title {
        font-size: 1.875rem;
        line-height: 2.25rem;
        font-weight: 700;
        color: rgb(var(--color-gray-900));
        margin: 0;
    }

    .dashboard-subtitle {
        color: rgb(var(--color-gray-600));
        margin: var(--spacing-2) 0 0 0;
        font-size: 1rem;
    }

    .add-series-form {
        display: flex;
        align-items: center;
        gap: var(--spacing-2);
    }

    .series-input-with-button {
        width: 100%;
        max-width: 20rem;
    }

    .board-input-with-button {
        width: 100%;
    }

    .section-title {
        font-size: 1.25rem;
        line-height: 1.75rem;
        font-weight: 700;
        color: rgb(var(--color-gray-900));
        margin: 0 0 var(--spacing-4) 0;
    }

    .empty-state {
        text-align: center;
        padding: var(--spacing-12) var(--spacing-4);
        background-color: white;
        border-radius: 1rem;
        border: 2px dashed rgb(var(--color-border));
    }

    .empty-state-icon {
        width: 4rem;
        height: 4rem;
        background: linear-gradient(
            to bottom right,
            rgba(var(--color-indigo-500), 0.1),
            rgba(var(--color-purple-500), 0.1)
        );
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto var(--spacing-4) auto;
    }

    .empty-state-text {
        color: rgb(var(--color-gray-600));
        margin: 0 0 var(--spacing-4) 0;
        font-size: 1rem;
    }

    .warning-icon {
        width: 2.5rem;
        height: 2.5rem;
        background-color: rgb(var(--color-red-100));
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
    }
</style>
