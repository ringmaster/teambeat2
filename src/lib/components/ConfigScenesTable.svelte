<script lang="ts">
    import Icon from "./ui/Icon.svelte";

    interface Props {
        board: any;
        onAddNewScene: () => void;
        onUpdateScene: (sceneId: string, data: any) => void;
        onDeleteScene: (sceneId: string) => void;
        onDragStart: (e: DragEvent, id: string) => void;
        onDragOver: (e: DragEvent, id: string) => void;
        onDragLeave: (e: DragEvent) => void;
        onDrop: (e: DragEvent, id: string) => void;
        onEndDrop: (e: DragEvent) => void;
        dragState: any;
    }

    let {
        board,
        onAddNewScene,
        onUpdateScene,
        onDeleteScene,
        onDragStart,
        onDragOver,
        onDragLeave,
        onDrop,
        onEndDrop,
        dragState,
    }: Props = $props();

    // Inline editing state
    let editingMode = $state(""); // "permissions", "display", or ""
    let activeSceneId = $state("");
    let activeSceneName = $state("");

    function updateSceneTitle(sceneId: string, title: string) {
        onUpdateScene(sceneId, { title });
    }

    function updateSceneMode(sceneId: string, mode: string) {
        onUpdateScene(sceneId, { mode });
    }

    function showOptionsForScene(sceneId: string) {
        const scene = board.scenes.find((s: any) => s.id === sceneId);
        if (!scene) return;

        activeSceneId = sceneId;
        activeSceneName = scene.title;
        editingMode = "permissions";
    }

    async function showColumnsForScene(sceneId: string) {
        const scene = board.scenes.find((s: any) => s.id === sceneId);
        if (!scene) return;

        activeSceneId = sceneId;
        activeSceneName = scene.title;
        editingMode = "display";

        // Initialize column states from board data
        if (!columnStates[sceneId]) {
            columnStates[sceneId] = {};
        }
        // Set all columns to visible by default
        const columnsToUse = board.allColumns || board.columns;
        columnsToUse?.forEach((col: any) => {
            columnStates[sceneId][col.id] = "visible";
        });
        // Mark hidden columns if they exist in the board data
        if (board.hiddenColumnsByScene && board.hiddenColumnsByScene[sceneId]) {
            board.hiddenColumnsByScene[sceneId].forEach((colId: string) => {
                columnStates[sceneId][colId] = "hidden";
            });
        }
    }

    function togglePermission(sceneId: string, permission: string) {
        const scene = board.scenes.find((s: any) => s.id === sceneId);
        if (!scene) return;

        const updates = { [permission]: !scene[permission] };
        onUpdateScene(sceneId, updates);
    }

    function exitEditingMode() {
        editingMode = "";
        activeSceneId = "";
        activeSceneName = "";
    }

    async function updateColumnDisplay(
        sceneId: string,
        columnId: string,
        state: string,
    ) {
        try {
            const response = await fetch(
                `/api/boards/${board.id}/scenes/${sceneId}/columns`,
                {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ columnId, state }),
                },
            );

            if (response.ok) {
                // Update local state
                if (!columnStates[sceneId]) {
                    columnStates[sceneId] = {};
                }
                columnStates[sceneId][columnId] = state;
            } else {
                console.error(
                    "Failed to update column display:",
                    await response.json(),
                );
            }
        } catch (error) {
            console.error("Failed to update column display:", error);
        }
    }

    // Track column states per scene
    let columnStates = $state<Record<string, Record<string, string>>>({});
</script>

<div class="mb-6">
    <div class="config-section-header">
        <h3 class="config-section-title">
            {#if editingMode}
                Board Scenes - {editingMode === "permissions"
                    ? "Permissions"
                    : "Display"} for {activeSceneName}
            {:else}
                Board Scenes
            {/if}
        </h3>
        {#if !editingMode}
            <button onclick={onAddNewScene} class="btn-primary">
                <Icon name="plus" size="md" class="icon-white" />
                Add Scene
            </button>
        {/if}
    </div>
    {#if editingMode}
        <button onclick={exitEditingMode} class="button button-secondary">
            <svg
                class="w-4 h-4 mr-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
            >
                <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    stroke-width="2"
                    d="M15 19l-7-7 7-7"
                />
            </svg>
            Back
        </button>
    {/if}
</div>

{#if !editingMode}
    <!-- Scenes Table -->
    <div class="config-table-wrapper">
        <table class="config-table">
            <thead>
                <tr class="config-table-header">
                    <th class="config-table-th" style="width: 40px;">Order</th>
                    <th class="config-table-th">Title</th>
                    <th class="config-table-th">Permissions</th>
                    <th class="config-table-th">Display</th>
                    <th class="config-table-th">Mode</th>
                    <th class="config-table-th" style="width: 120px;">Delete</th
                    >
                </tr>
            </thead>
            <tbody>
                {#each board.scenes || [] as scene}
                    <tr
                        draggable="true"
                        ondragstart={(e) => onDragStart(e, scene.id)}
                        ondragover={(e) => onDragOver(e, scene.id)}
                        ondragleave={onDragLeave}
                        ondrop={(e) => onDrop(e, scene.id)}
                        class="config-table-row draggable {dragState.draggedSceneId ===
                        scene.id
                            ? 'dragging'
                            : ''} {dragState.dragOverSceneId === scene.id &&
                        dragState.draggedSceneId !== scene.id &&
                        dragState.sceneDropPosition === 'above'
                            ? 'drag-over-top'
                            : ''} {dragState.dragOverSceneId === scene.id &&
                        dragState.draggedSceneId !== scene.id &&
                        dragState.sceneDropPosition === 'below'
                            ? 'drag-over-bottom'
                            : ''}"
                    >
                        <td>
                            <div class="drag-handle" title="Drag to reorder">
                                <svg
                                    class="drag-handle-icon"
                                    viewBox="0 0 24 24"
                                    fill="currentColor"
                                >
                                    <path
                                        d="M11 18c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm-2-8c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm6 4c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"
                                    />
                                </svg>
                            </div>
                        </td>
                        <td>
                            <input
                                type="text"
                                value={scene.title}
                                onblur={(e) =>
                                    updateSceneTitle(
                                        scene.id,
                                        e.currentTarget.value,
                                    )}
                                class="input"
                            />
                        </td>
                        <td>
                            <button
                                onclick={() => showOptionsForScene(scene.id)}
                                class="button button-secondary">Options</button
                            >
                        </td>
                        <td>
                            <button
                                onclick={() => showColumnsForScene(scene.id)}
                                class="button button-secondary">Columns</button
                            >
                        </td>
                        <td>
                            <select
                                value={scene.mode}
                                onchange={(e) =>
                                    updateSceneMode(
                                        scene.id,
                                        e.currentTarget.value,
                                    )}
                                class="select"
                            >
                                <option value="columns">Columns</option>
                                <option value="present">Present</option>
                                <option value="review">Review</option>
                            </select>
                        </td>
                        <td>
                            <button
                                onclick={() => onDeleteScene(scene.id)}
                                class="button button-danger"
                            >
                                Delete
                            </button>
                        </td>
                    </tr>
                {/each}
                <!-- Drop zone for adding items at the end -->
                <tr
                    ondragover={onEndDrop}
                    ondragleave={() => {}}
                    ondrop={onEndDrop}
                    class="config-table-drop-zone {dragState.dragOverSceneEnd
                        ? 'drag-over-bottom'
                        : ''}"
                >
                    <td colspan="6" class="config-table-drop-zone-cell">
                        {dragState.dragOverSceneEnd
                            ? "Drop here to move to end"
                            : ""}
                    </td>
                </tr>
            </tbody>
        </table>
    </div>
{:else}
    <!-- Inline Editing Content -->
    <div class="max-h-96 overflow-y-auto">
        {#if editingMode === "permissions"}
            {@const activeScene = board.scenes.find(
                (s: any) => s.id === activeSceneId,
            )}
            {#if activeScene}
                <div class="permissions-section">
                    <h4 class="permissions-title">Scene Permissions</h4>
                    <div class="permissions-grid">
                        <button
                            onclick={() =>
                                togglePermission(
                                    activeSceneId,
                                    "allowAddCards",
                                )}
                            class="btn-secondary {activeScene.allowAddCards
                                ? 'permission-active'
                                : ''}"
                        >
                            Add Cards
                            <Icon
                                name="check"
                                size="md"
                                class="permission-icon"
                            />
                        </button>

                        <button
                            onclick={() =>
                                togglePermission(
                                    activeSceneId,
                                    "allowEditCards",
                                )}
                            class="btn-secondary {activeScene.allowEditCards
                                ? 'permission-active'
                                : ''}"
                        >
                            Edit Cards
                            <Icon
                                name="check"
                                size="md"
                                class="permission-icon"
                            />
                        </button>

                        <button
                            onclick={() =>
                                togglePermission(
                                    activeSceneId,
                                    "allowObscureCards",
                                )}
                            class="btn-secondary {activeScene.allowObscureCards
                                ? 'permission-active'
                                : ''}"
                        >
                            Obscure Cards
                            <Icon
                                name="check"
                                size="md"
                                class="permission-icon"
                            />
                        </button>

                        <button
                            onclick={() =>
                                togglePermission(
                                    activeSceneId,
                                    "allowMoveCards",
                                )}
                            class="btn-secondary {activeScene.allowMoveCards
                                ? 'permission-active'
                                : ''}"
                        >
                            Move Cards
                            <Icon
                                name="check"
                                size="md"
                                class="permission-icon"
                            />
                        </button>

                        <button
                            onclick={() =>
                                togglePermission(
                                    activeSceneId,
                                    "allowGroupCards",
                                )}
                            class="btn-secondary {activeScene.allowGroupCards
                                ? 'permission-active'
                                : ''}"
                        >
                            Group Cards
                            <Icon
                                name="check"
                                size="md"
                                class="permission-icon"
                            />
                        </button>

                        <button
                            onclick={() =>
                                togglePermission(activeSceneId, "showVotes")}
                            class="btn-secondary {activeScene.showVotes
                                ? 'permission-active'
                                : ''}"
                        >
                            Show Votes
                            <Icon
                                name="check"
                                size="md"
                                class="permission-icon"
                            />
                        </button>

                        <button
                            onclick={() =>
                                togglePermission(activeSceneId, "allowVoting")}
                            class="btn-secondary {activeScene.allowVoting
                                ? 'permission-active'
                                : ''}"
                        >
                            Enable Votes
                            <Icon
                                name="check"
                                size="md"
                                class="permission-icon"
                            />
                        </button>

                        <button
                            onclick={() =>
                                togglePermission(activeSceneId, "showComments")}
                            class="btn-secondary {activeScene.showComments
                                ? 'permission-active'
                                : ''}"
                        >
                            Show Comments
                            <Icon
                                name="check"
                                size="md"
                                class="permission-icon"
                            />
                        </button>

                        <button
                            onclick={() =>
                                togglePermission(
                                    activeSceneId,
                                    "allowComments",
                                )}
                            class="btn-secondary {activeScene.allowComments
                                ? 'permission-active'
                                : ''}"
                        >
                            Enable Comments
                            <Icon
                                name="check"
                                size="md"
                                class="permission-icon"
                            />
                        </button>
                    </div>
                </div>
            {/if}
        {:else if editingMode === "display"}
            <div class="space-y-3">
                <h4 class="text-sm font-medium text-gray-900 mb-4">
                    Column Display Settings
                </h4>
                <div class="space-y-3">
                    {#each board.allColumns || board.columns || [] as column}
                        {@const currentState =
                            columnStates[activeSceneId]?.[column.id] ||
                            "visible"}
                        <div
                            class="p-4 border border-gray-200 rounded-lg bg-gray-50"
                        >
                            <div class="flex items-center justify-between mb-3">
                                <span class="text-sm text-gray-700 font-medium"
                                    >{column.title}</span
                                >
                            </div>
                            <div class="flex gap-4">
                                <label class="flex items-center cursor-pointer">
                                    <input
                                        type="radio"
                                        name="column-{column.id}"
                                        value="visible"
                                        checked={currentState === "visible"}
                                        onchange={() =>
                                            updateColumnDisplay(
                                                activeSceneId,
                                                column.id,
                                                "visible",
                                            )}
                                        class="mr-2 text-blue-600 focus:ring-blue-500"
                                    />
                                    <span class="text-sm text-gray-600"
                                        >Visible</span
                                    >
                                </label>
                                <label class="flex items-center cursor-pointer">
                                    <input
                                        type="radio"
                                        name="column-{column.id}"
                                        value="hidden"
                                        checked={currentState === "hidden"}
                                        onchange={() =>
                                            updateColumnDisplay(
                                                activeSceneId,
                                                column.id,
                                                "hidden",
                                            )}
                                        class="mr-2 text-blue-600 focus:ring-blue-500"
                                    />
                                    <span class="text-sm text-gray-600"
                                        >Hidden</span
                                    >
                                </label>
                            </div>
                        </div>
                    {/each}
                </div>
            </div>
        {/if}
    </div>
{/if}

<style>
    .config-section-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1.5rem;
    }

    .config-table-wrapper {
        width: 100%;
    }

    .config-table {
        width: 100%;
    }

    /* Style select boxes to match buttons */
    .select {
        appearance: none;
        background: white;
        border: 1px solid rgb(var(--color-border));
        border-radius: var(--radius-md);
        padding: var(--spacing-2) var(--spacing-4);
        font-size: 0.875rem;
        font-weight: 500;
        color: rgb(var(--color-text-primary));
        cursor: pointer;
        transition: all 0.2s ease;
        background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e");
        background-position: right var(--spacing-2) center;
        background-repeat: no-repeat;
        background-size: 1em 1em;
        padding-right: var(--spacing-8);
    }

    .select:hover {
        border-color: rgb(var(--color-border-hover));
        background-color: rgb(var(--color-gray-50));
    }

    .select:focus {
        outline: none;
        border-color: rgb(var(--color-primary));
        box-shadow: 0 0 0 3px rgb(var(--color-primary) / 0.1);
    }

    /* Permission Section Styles */
    .permissions-section {
        margin-bottom: var(--spacing-6);
    }

    .permissions-title {
        font-size: 0.875rem;
        font-weight: 500;
        color: rgb(var(--color-text-primary));
        margin-bottom: var(--spacing-4);
    }

    .permissions-grid {
        display: flex;
        flex-wrap: wrap;
        gap: var(--spacing-3);
    }

    /* Permission Button Styles */
    .permissions-grid .btn-secondary {
        flex: 1 1 calc(33.333% - var(--spacing-2));
        min-width: 120px;
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: var(--spacing-3) var(--spacing-4);
        text-align: left;
        white-space: nowrap;
    }

    /* Permission Icon - Hidden by default */
    :global(.permission-icon) {
        display: none;
        color: white;
    }

    /* Inactive (unchecked) buttons - muted secondary color */
    .permissions-grid .btn-secondary {
        background-color: rgb(var(--color-gray-100));
        border-color: rgb(var(--color-border));
        color: rgb(var(--color-text-secondary));
    }

    .permissions-grid .btn-secondary:hover {
        background-color: rgb(var(--color-gray-200));
        border-color: rgb(var(--color-border-hover));
    }

    /* Active (checked) Permission Button State - primary color */
    .btn-secondary.permission-active {
        background-color: rgb(var(--color-primary));
        border-color: rgb(var(--color-primary));
        color: white;
    }

    .btn-secondary.permission-active:hover {
        background-color: rgb(var(--color-primary) / 0.9);
        border-color: rgb(var(--color-primary));
    }

    /* Show icon when permission is active - higher specificity */
    :global(
            .permissions-grid .btn-secondary.permission-active .permission-icon
        ) {
        display: inherit;
    }
</style>
