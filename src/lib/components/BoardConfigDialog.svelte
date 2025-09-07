<script lang="ts">
    import { fade, fly } from "svelte/transition";
    import { cubicOut } from "svelte/easing";
    import { onMount } from "svelte";
    import ConfigScenesTable from "./ConfigScenesTable.svelte";
    import ConfigColumnsTable from "./ConfigColumnsTable.svelte";
    import UserManagement from "./UserManagement.svelte";
    import flatpickr from "flatpickr";
    import "flatpickr/dist/flatpickr.min.css";

    interface Props {
        showBoardConfig: boolean;
        userRole: string;
        configActiveTab: string;
        board: any;
        configForm: any;
        onClose: () => void;
        onTabChange: (tab: string) => void;
        onUpdateBoardConfig: (config: any) => void;
        onAddNewColumn: () => void;
        onAddNewScene: () => void;
        onUpdateColumn: (columnId: string, data: any) => void;
        onDeleteColumn: (columnId: string) => void;
        onUpdateScene: (sceneId: string, data: any) => void;
        onDeleteScene: (sceneId: string) => void;
        onDragStart: (
            type: "column" | "scene",
            e: DragEvent,
            id: string,
        ) => void;
        onDragOver: (
            type: "column" | "scene",
            e: DragEvent,
            id: string,
        ) => void;
        onDragLeave: (type: "column" | "scene", e: DragEvent) => void;
        onDrop: (type: "column" | "scene", e: DragEvent, id: string) => void;
        onEndDrop: (type: "column" | "scene", e: DragEvent) => void;
        onDeleteBoard?: () => void;
        dragState: {
            draggedColumnId: string;
            draggedSceneId: string;
            dragOverColumnId: string;
            dragOverSceneId: string;
            columnDropPosition: string;
            sceneDropPosition: string;
            dragOverColumnEnd: boolean;
            dragOverSceneEnd: boolean;
        };
    }

    let {
        showBoardConfig,
        userRole,
        configActiveTab = $bindable(),
        board,
        configForm = $bindable(),
        onClose,
        onTabChange,
        onUpdateBoardConfig,
        onAddNewColumn,
        onAddNewScene,
        onUpdateColumn,
        onDeleteColumn,
        onUpdateScene,
        onDeleteScene,
        onDragStart,
        onDragOver,
        onDragLeave,
        onDrop,
        onEndDrop,
        onDeleteBoard,
        dragState,
    }: Props = $props();

    // User management state
    let seriesUsers = $state([]);

    // Date picker instance
    let datePickerInstance: any = null;
    let datePickerElement: HTMLInputElement;

    // Load users when the users tab is opened
    $effect(async () => {
        if (configActiveTab === "users" && board?.seriesId) {
            try {
                const response = await fetch(
                    `/api/series/${board.seriesId}/users`,
                );
                if (response.ok) {
                    const data = await response.json();
                    seriesUsers = data.users;
                }
            } catch (error) {
                console.error("Failed to load users:", error);
            }
        }
    });

    // Initialize date picker when dialog opens or tab changes
    $effect(() => {
        if (
            showBoardConfig &&
            configActiveTab === "general" &&
            datePickerElement &&
            !datePickerInstance
        ) {
            const boardCreatedAt = board?.createdAt
                ? new Date(board.createdAt)
                : new Date();

            datePickerInstance = flatpickr(datePickerElement, {
                dateFormat: "Y-m-d",
                defaultDate: boardCreatedAt,
                enableTime: false,
                onChange: (selectedDates) => {
                    if (selectedDates.length > 0) {
                        const newDate = selectedDates[0];
                        // Update the board's creation date
                        onUpdateBoardConfig({
                            createdAt: newDate.toISOString(),
                        });
                    }
                },
            });
        }

        return () => {
            // Cleanup date picker when dialog closes
            if (datePickerInstance && !showBoardConfig) {
                datePickerInstance.destroy();
                datePickerInstance = null;
            }
        };
    });

    async function handleUserAdded(email: string) {
        const response = await fetch(`/api/series/${board.seriesId}/users`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, role: "member" }),
        });

        if (response.ok) {
            // Reload users list
            const usersResponse = await fetch(
                `/api/series/${board.seriesId}/users`,
            );
            if (usersResponse.ok) {
                const data = await usersResponse.json();
                seriesUsers = data.users;
            }
        } else {
            const data = await response.json();
            throw new Error(data.error || "Failed to add user");
        }
    }

    async function handleUserRemoved(userId: string) {
        try {
            const response = await fetch(
                `/api/series/${board.seriesId}/users?userId=${userId}`,
                {
                    method: "DELETE",
                },
            );

            if (response.ok) {
                // Remove user from local state
                seriesUsers = seriesUsers.filter((u) => u.userId !== userId);
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
                `/api/series/${board.seriesId}/users`,
                {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ userId, role: newRole }),
                },
            );

            if (response.ok) {
                // Update user role in local state
                seriesUsers = seriesUsers.map((u) =>
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

<!-- Board Configuration Modal -->
{#if showBoardConfig && ["admin", "facilitator"].includes(userRole)}
    <!-- svelte-ignore a11y_no_static_element_interactions -->
    <div
        id="board-config-modal-overlay"
        class="modal-overlay"
        transition:fade={{ duration: 300 }}
        onclick={onClose}
        onkeydown={(e) => e.key === "Escape" && onClose()}
    >
        <!-- svelte-ignore a11y_click_events_have_key_events -->
        <div
            id="board-config-modal"
            class="config-modal-dialog"
            transition:fly={{ y: -20, duration: 300, easing: cubicOut }}
            onclick={(e) => e.stopPropagation()}
        >
            <!-- Modal Header with Tabs -->
            <div class="config-modal-header">
                <div class="config-header-content">
                    <h2 class="config-modal-title">Board Configuration</h2>
                    <!-- Tab Navigation -->
                    <nav class="config-tabs">
                        <button
                            onclick={() => onTabChange("columns")}
                            class="config-tab {configActiveTab === 'columns'
                                ? 'config-tab-active'
                                : ''}"
                        >
                            Columns
                        </button>
                        <button
                            onclick={() => onTabChange("scenes")}
                            class="config-tab {configActiveTab === 'scenes'
                                ? 'config-tab-active'
                                : ''}"
                        >
                            Scenes
                        </button>
                        {#if ["admin", "facilitator"].includes(userRole)}
                            <button
                                onclick={() => onTabChange("users")}
                                class="config-tab {configActiveTab === 'users'
                                    ? 'config-tab-active'
                                    : ''}"
                            >
                                Users
                            </button>
                        {/if}
                        <button
                            onclick={() => onTabChange("general")}
                            class="config-tab {configActiveTab === 'general'
                                ? 'config-tab-active'
                                : ''}"
                        >
                            General
                        </button>
                    </nav>
                </div>
                <button
                    onclick={onClose}
                    class="close-button"
                    aria-label="Close dialog"
                >
                    <svg
                        class="w-6 h-6"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            stroke-width="2"
                            d="M6 18L18 6M6 6l12 12"
                        />
                    </svg>
                </button>
            </div>

            <!-- Tab Content -->
            <div class="config-modal-content">
                {#if configActiveTab === "scenes"}
                    <div
                        class="space-y-4 animate-in fade-in duration-200 ease-out"
                    >
                        <ConfigScenesTable
                            {board}
                            {onAddNewScene}
                            {onUpdateScene}
                            {onDeleteScene}
                            onDragStart={(e, id) => onDragStart("scene", e, id)}
                            onDragOver={(e, id) => onDragOver("scene", e, id)}
                            onDragLeave={(e) => onDragLeave("scene", e)}
                            onDrop={(e, id) => onDrop("scene", e, id)}
                            onEndDrop={(e) => onEndDrop("scene", e)}
                            {dragState}
                        />
                    </div>
                {:else if configActiveTab === "general"}
                    <div class="general-settings">
                        <div class="config-section-header">
                            <h3 class="config-section-title">
                                General Settings
                            </h3>
                        </div>

                        <div class="general-form">
                            <div class="general-form-row">
                                <div class="general-form-label">
                                    <label for="board-name-input" class="text-medium text-secondary">
                                        Board Name
                                    </label>
                                </div>
                                <div class="general-form-control">
                                    <input
                                        id="board-name-input"
                                        type="text"
                                        bind:value={configForm.name}
                                        class="input"
                                        onblur={() =>
                                            onUpdateBoardConfig({
                                                name: configForm.name,
                                            })}
                                    />
                                </div>
                            </div>

                            <div class="general-form-row">
                                <div class="general-form-label">
                                    <span class="text-medium text-secondary">
                                        Blame-free Mode
                                    </span>
                                    <p class="caption text-muted">
                                        Hide user names on cards to encourage open feedback
                                    </p>
                                </div>
                                <div class="general-form-control">
                                    <input
                                        type="checkbox"
                                        bind:checked={configForm.blameFreeMode}
                                        onchange={() =>
                                            onUpdateBoardConfig({
                                                blameFreeMode: configForm.blameFreeMode,
                                            })}
                                        class="general-checkbox"
                                    />
                                </div>
                            </div>

                            <div class="general-form-row">
                                <div class="general-form-label">
                                    <label for="board-status-select" class="text-medium text-secondary">
                                        Board Status
                                    </label>
                                    <p class="caption text-muted">
                                        Controls board visibility and accessibility
                                    </p>
                                </div>
                                <div class="general-form-control">
                                    <select
                                        id="board-status-select"
                                        bind:value={configForm.status}
                                        onchange={() =>
                                            onUpdateBoardConfig({
                                                status: configForm.status,
                                            })}
                                        class="select"
                                    >
                                        <option value="draft">Draft</option>
                                        <option value="active">Active</option>
                                        <option value="completed">Completed</option>
                                        <option value="archived">Archived</option>
                                    </select>
                                </div>
                            </div>

                            <div class="general-form-row">
                                <div class="general-form-label">
                                    <label for="board-creation-date" class="text-medium text-secondary">
                                        Retrospective Date
                                    </label>
                                    <p class="caption text-muted">
                                        When this retrospective is meant to take place
                                    </p>
                                </div>
                                <div class="general-form-control">
                                    <input
                                        id="board-creation-date"
                                        type="text"
                                        bind:this={datePickerElement}
                                        class="input"
                                        placeholder="Select date"
                                        readonly
                                    />
                                </div>
                            </div>
                        </div>

                        <!-- Delete Board Section -->
                        {#if onDeleteBoard}
                            <div class="general-delete-section">
                                <div class="general-form-row">
                                    <div class="general-form-label">
                                        <span class="text-medium text-danger">
                                            Delete Board
                                        </span>
                                        <p class="caption text-muted">
                                            Permanently delete this board and all its contents. This action cannot be undone.
                                        </p>
                                    </div>
                                    <div class="general-form-control">
                                        <button
                                            onclick={() => onDeleteBoard?.()}
                                            class="general-delete-button"
                                        >
                                            Delete Board
                                        </button>
                                    </div>
                                </div>
                            </div>
                        {/if}
                    </div>
                {/if}

                {#if configActiveTab === "users"}
                    <div
                        class="space-y-6 animate-in fade-in duration-200 ease-out"
                    >
                        <UserManagement
                            seriesId={board.seriesId}
                            currentUserRole={userRole}
                            bind:users={seriesUsers}
                            onUserAdded={handleUserAdded}
                            onUserRemoved={handleUserRemoved}
                            onUserRoleChanged={handleUserRoleChanged}
                        />
                    </div>
                {:else if configActiveTab === "columns"}
                    <div
                        class="space-y-4 animate-in fade-in duration-200 ease-out"
                    >
                        <ConfigColumnsTable
                            {board}
                            {onAddNewColumn}
                            {onUpdateColumn}
                            {onDeleteColumn}
                            onDragStart={(e, id) =>
                                onDragStart("column", e, id)}
                            onDragOver={(e, id) => onDragOver("column", e, id)}
                            onDragLeave={(e) => onDragLeave("column", e)}
                            onDrop={(e, id) => onDrop("column", e, id)}
                            {dragState}
                        />
                    </div>
                {/if}
            </div>
        </div>
    </div>
{/if}

<style lang="less">
    /* Config Modal Dialog Styles */
    .config-modal-dialog {
        background: white;
        border-radius: var(--radius-lg);
        box-shadow: var(--shadow-2xl);
        width: 100%;
        max-width: 64rem;
        max-height: 70vh;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        margin-top: 100px;
    }

    .config-modal-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: var(--spacing-4) var(--spacing-6);
        border-bottom: 1px solid var(--color-border);
    }

    .config-header-content {
        display: flex;
        align-items: center;
        gap: var(--spacing-8);
        flex: 1;
    }

    .config-modal-title {
        font-size: 1.25rem;
        font-weight: 600;
        color: var(--color-text-primary);
        margin: 0;
    }

    .config-modal-content {
        padding: var(--spacing-6);
        overflow-y: auto;
        flex: 1;
    }

    /* Config Tabs Styling */
    .config-tabs {
        display: flex;
        gap: var(--spacing-1);
    }

    .config-tab {
        position: relative;
        padding: var(--spacing-3) var(--spacing-4);
        font-size: 0.875rem;
        font-weight: 500;
        color: var(--color-text-secondary);
        background: transparent;
        border: none;
        border-bottom: 3px solid transparent;
        cursor: pointer;
        transition: all 0.2s ease;
        margin-bottom: -1px;

        &:hover:not(.config-tab-active) {
            color: var(--color-text-primary);
            background: var(--surface-elevated);
            border-bottom-color: var(--surface-secondary);
        }

        &.config-tab-active {
            color: var(--color-primary);
            background: white;
            border-bottom-color: var(--color-primary);

            &::after {
                content: "";
                position: absolute;
                bottom: -1px;
                left: 0;
                right: 0;
                height: 1px;
                background: white;
            }
        }
    }

    /* Config Section Styles */
    .config-section-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: var(--spacing-6);
    }

    .config-section-title {
        font-size: 1.125rem;
        font-weight: 500;
        color: var(--color-text-primary);
    }

    /* Config Add Button Styles */
    .config-add-button {
        display: inline-flex;
        align-items: center;
        gap: var(--spacing-2);
        padding: var(--spacing-2) var(--spacing-4);
        background: var(--color-primary);
        color: white;
        border: none;
        border-radius: var(--radius-md);
        font-size: 0.875rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
        white-space: nowrap;

        &:hover {
            background: var(--card-vote-button-hover);
            transform: translateY(-1px);
            box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        }

        &:active {
            transform: translateY(0);
        }
    }

    .config-add-icon {
        width: 1rem;
        height: 1rem;
        flex-shrink: 0;
    }

    /* Config Table Styles */
    .config-table-wrapper {
        overflow-x: auto;
        border-radius: var(--radius-md);
        border: 1px solid var(--color-border);
    }

    .config-table {
        width: 100%;
        border-collapse: separate;
        border-spacing: 0;
        background: white;
    }

    .config-table-header {
        background: var(--surface-elevated);
        border-bottom: 1px solid var(--color-border);
    }

    .config-table-th {
        padding: var(--spacing-3) var(--spacing-4);
        text-align: left;
        font-size: 0.75rem;
        font-weight: 500;
        color: var(--color-text-secondary);
        text-transform: uppercase;
        letter-spacing: 0.05em;
    }

    .config-table-row {
        position: relative;
        transition: all 0.2s ease;

        td {
            padding: var(--spacing-3) var(--spacing-4);
            vertical-align: middle;
            border-bottom: 1px solid var(--color-border);
        }

        td .input {
            margin: 0;
        }

        td .button {
            margin: 0;
        }

        &:hover:not(.dragging) {
            background: var(--surface-elevated);
        }

        &:last-child td {
            border-bottom: none;
        }
    }

    .config-table-drop-zone {
        height: var(--spacing-4);

        td {
            padding: var(--spacing-2);
            text-align: center;
            font-size: 0.75rem;
            color: var(--color-text-muted);
            border-bottom: 1px solid var(--color-border);
        }

        &:hover {
            background: var(--surface-elevated);
        }
    }

    .config-table-drop-zone-cell {
        text-align: center;
        font-size: 0.75rem;
        color: var(--color-text-muted);
    }

    /* Drag and Drop Visual Indicators */
    .draggable {
        cursor: move;
        user-select: none;
    }

    .dragging {
        opacity: 0.5;
    }

    :global .drag-over-top td {
        border-top: 3px solid var(--color-accent) !important;
    }

    :global .drag-over-bottom td {
        border-bottom: 3px solid var(--color-accent) !important;
    }

    .drag-handle {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 24px;
        height: 24px;
        color: var(--color-text-muted);
        cursor: move;
        border-radius: var(--radius-sm);
        transition: all 0.2s ease;

        &:hover {
            color: var(--color-text-secondary);
            background: var(--surface-primary);
        }
    }

    .drag-handle-icon {
        width: 16px;
        height: 16px;
    }

    #board-config-modal-overlay {
        align-items: flex-start;
    }

    /* General Settings Form Layout */
    .general-form {
        display: flex;
        flex-direction: column;
        gap: var(--spacing-6);
    }

    .general-form-row {
        display: flex;
        align-items: flex-start;
        gap: var(--spacing-6);
        min-height: 2.5rem;
    }

    .general-form-label {
        flex: 0 0 16rem;
        display: flex;
        flex-direction: column;
        gap: var(--spacing-1);
        padding-top: var(--spacing-1);
    }

    .general-form-label label,
    .general-form-label span {
        font-weight: 500;
    }

    .general-form-control {
        flex: 1;
        display: flex;
        align-items: flex-start;
    }

    .general-form-control .input,
    .general-form-control .select {
        width: 100%;
        margin: 0;
    }

    .general-checkbox {
        width: 1rem;
        height: 1rem;
        accent-color: var(--color-primary);
        margin: 0;
        cursor: pointer;
    }

    .general-delete-section {
        margin-top: var(--spacing-8);
        padding-top: var(--spacing-6);
        border-top: 1px solid var(--color-border);
    }

    .general-delete-button {
        background-color: var(--color-danger);
        color: white;
        border: none;
        border-radius: var(--radius-md);
        padding: var(--spacing-3) var(--spacing-6);
        font-size: 0.875rem;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
        font-family: inherit;

        &:hover {
            background-color: var(--color-danger-hover);
            transform: translateY(-1px);
            box-shadow: 0 2px 4px rgba(220, 38, 38, 0.2);
        }

        &:active {
            transform: translateY(0);
        }

        &:focus {
            outline: 2px solid var(--color-danger);
            outline-offset: 2px;
        }
    }
</style>
