<script lang="ts">
    import { onMount } from "svelte";
    import { goto } from "$app/navigation";
    import { fade, fly } from "svelte/transition";
    import UserManagement from "$lib/components/UserManagement.svelte";
    import InputWithButton from "$lib/components/ui/InputWithButton.svelte";
    import Icon from "$lib/components/ui/Icon.svelte";
    import Pill from "$lib/components/ui/Pill.svelte";
    import BoardListingItem from "$lib/components/ui/BoardListingItem.svelte";

    interface Props {
        user: any;
    }

    let { user }: Props = $props();

    let series: any[] = $state([]);
    let loading = $state(true);
    let newSeriesName = $state("");
    let seriesError = $state("");
    let creatingNewSeries = $state(false);
    let boardNames = $state({} as Record<string, string>);
    let boardErrors = $state({} as Record<string, string>);
    let creatingBoards = $state({} as Record<string, boolean>);
    let showDeleteModal = $state(false);
    let seriesToDelete: any = $state(null);
    let showUserManagementModal = $state(false);
    let seriesToManage: any = $state(null);
    let currentSeriesUsers = $state([]);

    onMount(async () => {
        try {
            const seriesResponse = await fetch("/api/series");

            if (seriesResponse.ok) {
                const seriesData = await seriesResponse.json();
                series = seriesData.series;

                series.forEach((s) => {
                    initializeBoardName(s.id, s.name);
                });
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
                series = [...series, data.series];
                initializeBoardName(data.series.id, data.series.boards.length);
                newSeriesName = "";
            } else {
                seriesError = data.error || "Failed to create series";
            }
        } catch (error) {
            seriesError = `Network error. Please try again. Error:${error}`;
        } finally {
            creatingNewSeries = false;
        }
    }

    function generateBoardName(seed: string): string {
        const colors = [
            "Amber",
            "Azure",
            "Crimson",
            "Emerald",
            "Golden",
            "Indigo",
            "Jade",
            "Lavender",
            "Magenta",
            "Navy",
            "Olive",
            "Pearl",
            "Quartz",
            "Ruby",
            "Sage",
            "Teal",
            "Violet",
            "White",
            "Coral",
            "Ebony",
            "Frost",
            "Gray",
            "Ivory",
            "Lime",
            "Mint",
            "Onyx",
            "Pink",
            "Rose",
            "Sand",
            "Tan",
            "Aqua",
            "Beige",
            "Cyan",
            "Dusk",
            "Fire",
            "Gold",
            "Jade",
            "Kiwi",
            "Lava",
            "Moss",
            "Opal",
            "Plum",
            "Rain",
            "Snow",
            "Tusk",
            "Wine",
            "Zinc",
            "Bone",
            "Clay",
            "Dawn",
        ];

        const objects = [
            "Bridge",
            "Tower",
            "Compass",
            "Arrow",
            "Shield",
            "Anchor",
            "Crown",
            "Hammer",
            "Lantern",
            "Mirror",
            "Pyramid",
            "River",
            "Stone",
            "Thread",
            "Vault",
            "Wheel",
            "Beacon",
            "Canyon",
            "Dagger",
            "Engine",
            "Falcon",
            "Garden",
            "Harbor",
            "Island",
            "Journey",
            "Kettle",
            "Ladder",
            "Mountain",
            "Needle",
            "Ocean",
            "Palace",
            "Quill",
            "Ribbon",
            "Summit",
            "Temple",
            "Umbrella",
            "Valley",
            "Waterfall",
            "Axe",
            "Blade",
            "Canvas",
            "Door",
            "Eagle",
            "Forge",
            "Gate",
            "Horizon",
            "Iron",
            "Jewel",
            "Key",
            "Lock",
        ];

        let hash = 0;
        for (let i = 0; i < seed.length; i++) {
            const char = seed.charCodeAt(i);
            hash = (hash << 5) - hash + char;
            hash = hash & hash;
        }

        const colorIndex = Math.abs(hash) % colors.length;
        const objectIndex = Math.abs(hash >> 8) % objects.length;

        return `${colors[colorIndex]} ${objects[objectIndex]}`;
    }

    function initializeBoardName(seriesId: string, boardCount: number) {
        if (!boardNames[seriesId]) {
            const currentDate = new Date().toISOString().split("T")[0];
            boardNames = {
                ...boardNames,
                [seriesId]: generateBoardName(
                    `${seriesId} ${boardCount} ${currentDate}`,
                ),
            };
        }
    }

    async function createBoard(seriesId: string) {
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
            boardErrors[seriesId] =
                `Network error. Please try again. Error: ${error}`;
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
            alert(`Network error. Please try again. Error: ${error}`);
        }
    }

    async function openSeriesUserManagement(seriesItem: any) {
        seriesToManage = seriesItem;
        showUserManagementModal = true;

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
        const response = await fetch(`/api/series/${seriesToManage.id}/users`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, role: "member" }),
        });

        if (response.ok) {
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
                        buttonVariant="primary"
                        buttonDisabled={creatingNewSeries ||
                            !newSeriesName.trim()}
                        onButtonClick={createSeries}
                        onkeydown={(e) => {
                            if (e.key === "Enter") createSeries();
                        }}
                        class="series-input-with-button"
                    >
                        {#snippet buttonContent()}
                            {#if creatingNewSeries}
                                Creating...
                            {:else}
                                <Icon name="plus" size="sm" />
                            {/if}
                        {/snippet}
                    </InputWithButton>
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
                                buttonVariant="primary"
                                buttonDisabled={creatingNewSeries ||
                                    !newSeriesName.trim()}
                                onButtonClick={createSeries}
                                onkeydown={(e) => {
                                    if (e.key === "Enter") createSeries();
                                }}
                                class="min-w-64"
                            >
                                {#snippet buttonContent()}
                                    {#if creatingNewSeries}
                                        Creating...
                                    {:else}
                                        <Icon name="plus" size="sm" />
                                    {/if}
                                {/snippet}
                            </InputWithButton>
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
                <div class="series-grid">
                    {#each series as s (s.id)}
                        <div class="series-card">
                            <div class="card-content">
                                <div class="series-card-header">
                                    <div class="series-card-info">
                                        <div class="series-card-title-row">
                                            <h3 class="card-title">
                                                {s.name}
                                            </h3>
                                            <Pill preset={s.role}>{s.role}</Pill
                                            >
                                        </div>
                                        {#if s.description}
                                            <p
                                                class="text-sm text-muted line-clamp-2"
                                            >
                                                {s.description}
                                            </p>
                                        {/if}
                                    </div>
                                    <div class="series-card-actions">
                                        {#if s.role === "admin"}
                                            <button
                                                onclick={() =>
                                                    openSeriesUserManagement(s)}
                                                class="icon-button icon-button-primary"
                                                title="Manage users"
                                                aria-label="Manage users"
                                            >
                                                <Icon name="users" size="sm" />
                                            </button>
                                            <button
                                                onclick={() =>
                                                    confirmDeleteSeries(s)}
                                                class="icon-button icon-button-danger"
                                                title="Delete series"
                                                aria-label="Delete series"
                                            >
                                                <Icon name="trash" size="sm" />
                                            </button>
                                        {/if}
                                    </div>
                                </div>

                                <div class="space-y-3">
                                    <!-- Active and Draft Boards -->
                                    {#if s.boards && s.boards.filter( (b) => ["active", "draft"].includes(b.status), ).length > 0}
                                        <div class="board-section">
                                            <h4 class="board-section-title">
                                                Active & Draft Boards:
                                            </h4>
                                            <div class="board-list">
                                                {#each s.boards.filter( (b) => ["active", "draft"].includes(b.status), ) as board (board.id)}
                                                    <BoardListingItem
                                                        name={board.name}
                                                        meetingDate={board.meetingDate}
                                                        createdAt={board.createdAt}
                                                        status={board.status}
                                                        onclick={() =>
                                                            goto(
                                                                `/board/${board.id}`,
                                                            )}
                                                    />
                                                {/each}
                                            </div>
                                        </div>
                                    {:else}
                                        <div class="alert">
                                            <p class="text-sm text-muted">
                                                No active or draft boards for
                                                this series
                                            </p>
                                        </div>
                                    {/if}

                                    <!-- Completed Boards -->
                                    {#if s.boards && s.boards.filter((b) => b.status === "completed").length > 0}
                                        <div class="board-section">
                                            <h4 class="board-section-title">
                                                Completed Boards:
                                            </h4>
                                            <div class="board-list">
                                                {#each s.boards
                                                    .filter((b) => b.status === "completed")
                                                    .slice(0, 5) as board (board.id)}
                                                    <BoardListingItem
                                                        name={board.name}
                                                        meetingDate={board.meetingDate}
                                                        createdAt={board.createdAt}
                                                        status="complete"
                                                        onclick={() =>
                                                            goto(
                                                                `/board/${board.id}`,
                                                            )}
                                                    />
                                                {/each}
                                            </div>
                                        </div>
                                    {/if}

                                    <!-- Create New Board -->
                                    <InputWithButton
                                        type="text"
                                        bind:value={boardNames[s.id]}
                                        placeholder="Board name..."
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
                                    >
                                        {#snippet buttonContent()}
                                            {#if creatingBoards[s.id]}
                                                ...
                                            {:else}
                                                <Icon name="plus" size="sm" />
                                            {/if}
                                        {/snippet}
                                    </InputWithButton>
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
        <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
        <!-- svelte-ignore a11y_click_events_have_key_events -->
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
                            <Icon
                                name="warning"
                                size="sm"
                                color="danger"
                                class="flex-shrink-0 mt-0.5"
                            />
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
        <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
        <!-- svelte-ignore a11y_click_events_have_key_events -->
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
        border: 4px solid var(--input-border);
        border-top: 4px solid var(--color-primary);
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
        color: var(--color-text-primary);
        font-weight: 500;
        font-size: 1rem;
        margin: 0;
    }

    .dashboard-container {
        max-width: 80rem;
        margin: 0 auto;
        padding: var(--spacing-8) var(--spacing-4);
        display: flex;
        flex-direction: column;
        gap: var(--spacing-8);
        height: 100%;
        overflow-y: scroll;
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
        color: var(--color-text-primary);
        margin: 0;
    }

    .dashboard-subtitle {
        color: var(--color-text-secondary);
        margin: var(--spacing-2) 0 0 0;
        font-size: 1rem;
    }

    .add-series-form {
        display: flex;
        align-items: center;
        gap: var(--spacing-2);
    }

    .section-title {
        font-size: 1.25rem;
        line-height: 1.75rem;
        font-weight: 700;
        color: var(--color-text-primary);
        margin: 0 0 var(--spacing-4) 0;
    }

    .empty-state {
        text-align: center;
        padding: var(--spacing-12) var(--spacing-4);
        background-color: white;
        border-radius: 1rem;
        border: 2px dashed var(--color-border);
    }

    .empty-state-text {
        color: var(--color-text-secondary);
        margin: 0 0 var(--spacing-4) 0;
        font-size: 1rem;
    }

    .warning-icon {
        width: 2.5rem;
        height: 2.5rem;
        background-color: var(--status-error-bg);
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        flex-shrink: 0;
    }
</style>
