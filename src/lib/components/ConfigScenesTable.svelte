<script lang="ts">
    import Icon from "./ui/Icon.svelte";
    import { fly, fade } from "svelte/transition";
    import { cubicOut } from "svelte/easing";

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
    let editingMode = $state(""); // "permissions", "display", "scorecards", or ""
    let activeSceneId = $state("");
    let activeSceneName = $state("");
    let availableScorecards = $state<any[]>([]);
    let attachedScorecards = $state<any[]>([]);
    let loadingScorecards = $state(false);

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

    async function showScorecardsForScene(sceneId: string) {
        const scene = board.scenes.find((s: any) => s.id === sceneId);
        if (!scene) return;

        activeSceneId = sceneId;
        activeSceneName = scene.title;
        editingMode = "scorecards";
        loadingScorecards = true;

        try {
            // Load available scorecards from the series
            const scorecardsResponse = await fetch(`/api/series/${board.seriesId}/scorecards`);
            if (scorecardsResponse.ok) {
                const scorecardsData = await scorecardsResponse.json();
                availableScorecards = scorecardsData.scorecards || [];
            }

            // Load scorecards attached to this scene
            const attachedResponse = await fetch(`/api/scenes/${sceneId}/scorecards`);
            if (attachedResponse.ok) {
                const attachedData = await attachedResponse.json();
                attachedScorecards = attachedData.sceneScorecards || [];
            }
        } catch (error) {
            console.error('Failed to load scorecards:', error);
        } finally {
            loadingScorecards = false;
        }
    }

    async function attachScorecard(scorecardId: string) {
        try {
            const response = await fetch(`/api/scenes/${activeSceneId}/scorecards`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ scorecard_id: scorecardId })
            });

            if (response.ok) {
                // Reload attached scorecards
                const attachedResponse = await fetch(`/api/scenes/${activeSceneId}/scorecards`);
                if (attachedResponse.ok) {
                    const attachedData = await attachedResponse.json();
                    attachedScorecards = attachedData.sceneScorecards || [];
                }
            }
        } catch (error) {
            console.error('Failed to attach scorecard:', error);
        }
    }

    async function detachScorecard(sceneScorecardId: string) {
        try {
            const response = await fetch(`/api/scene-scorecards/${sceneScorecardId}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                // Remove from local state
                attachedScorecards = attachedScorecards.filter(ss => ss.id !== sceneScorecardId);
            }
        } catch (error) {
            console.error('Failed to detach scorecard:', error);
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

    // Reactively update column states when board hiddenColumnsByScene changes
    $effect(() => {
        // If we're in display mode and the board hiddenColumnsByScene data changes, update local state
        if (
            editingMode === "display" &&
            activeSceneId &&
            board.hiddenColumnsByScene
        ) {
            if (!columnStates[activeSceneId]) {
                columnStates[activeSceneId] = {};
            }

            // Reset all columns to visible first
            const columnsToUse = board.allColumns || board.columns;
            columnsToUse?.forEach((col: any) => {
                columnStates[activeSceneId][col.id] = "visible";
            });

            // Mark hidden columns based on board data
            if (board.hiddenColumnsByScene[activeSceneId]) {
                board.hiddenColumnsByScene[activeSceneId].forEach(
                    (colId: string) => {
                        if (columnStates[activeSceneId]) {
                            columnStates[activeSceneId][colId] = "hidden";
                        }
                    },
                );
            }
        }
    });
</script>

<div class="mb-6">
    <div class="config-section-header">
        <h3 class="config-section-title">
            {#if editingMode}
                Board Scenes - {editingMode === "permissions"
                    ? "Permissions"
                    : "Display"} for {activeSceneName}

                <button
                    onclick={exitEditingMode}
                    class="button button-secondary"
                >
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
</div>

{#key editingMode}
    <div class="config-table-wrapper">
        {#if !editingMode}
            <!-- Scenes Table -->
            <table class="config-table">
                <thead>
                    <tr class="config-table-header">
                        <th class="config-table-th" style="width: 40px;"
                            >Order</th
                        >
                        <th class="config-table-th">Title</th>
                        <th class="config-table-th"
                            >Permissions &amp; Display</th
                        >
                        <th class="config-table-th">Mode</th>
                        <th class="config-table-th" style="width: 120px;"
                            >Delete</th
                        >
                    </tr>
                </thead>
                <tbody>
                    {#each board.scenes || [] as scene (scene.id)}
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
                                <div
                                    class="drag-handle"
                                    title="Drag to reorder"
                                >
                                    <Icon
                                        name="grip-vertical"
                                        size="sm"
                                        class="drag-handle-icon"
                                    />
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
                            <td style="text-align: center;">
                                <button
                                    onclick={() =>
                                        showOptionsForScene(scene.id)}
                                    class="button button-secondary"
                                    >Options</button
                                >
                                <button
                                    onclick={() =>
                                        showColumnsForScene(scene.id)}
                                    class="button button-secondary"
                                    >Columns</button
                                >
                                {#if scene.mode === 'scorecard'}
                                    <button
                                        onclick={() =>
                                            showScorecardsForScene(scene.id)}
                                        class="button button-secondary"
                                        >Scorecards</button
                                    >
                                {/if}
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
                                    <option value="agreements"
                                        >Agreements</option
                                    >
                                    <option value="scorecard"
                                        >Scorecard</option
                                    >
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
        {:else}
            <!-- Inline Editing Content -->

            {#if editingMode === "permissions"}
                {@const activeScene = board.scenes.find(
                    (s: any) => s.id === activeSceneId,
                )}
                {#if activeScene}
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
                                togglePermission(
                                    activeSceneId,
                                    "multipleVotesPerCard",
                                )}
                            class="btn-secondary {activeScene.multipleVotesPerCard
                                ? 'permission-active'
                                : ''}"
                        >
                            Multiple Votes Per Card
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
                            Edit Comments
                            <Icon
                                name="check"
                                size="md"
                                class="permission-icon"
                            />
                        </button>
                    </div>
                {/if}
            {:else if editingMode === "display"}
                <div class="permissions-section">
                    <h4 class="permissions-title">Column Display Settings</h4>
                    <div class="permissions-grid">
                        {#each board.allColumns || board.columns || [] as column (column.id)}
                            {@const currentState =
                                columnStates[activeSceneId]?.[column.id] ||
                                "visible"}
                            <button
                                onclick={() =>
                                    updateColumnDisplay(
                                        activeSceneId,
                                        column.id,
                                        currentState === "visible"
                                            ? "hidden"
                                            : "visible",
                                    )}
                                class="btn-secondary {currentState === 'visible'
                                    ? 'permission-active'
                                    : ''}"
                            >
                                {column.title}
                                <Icon
                                    name="check"
                                    size="md"
                                    class="permission-icon"
                                />
                            </button>
                        {/each}
                    </div>
                </div>
            {:else if editingMode === "scorecards"}
                <div class="permissions-section">
                    <h4 class="permissions-title">Scorecard Management</h4>

                    {#if loadingScorecards}
                        <p>Loading scorecards...</p>
                    {:else}
                        <div class="scorecards-management">
                            <!-- Attached Scorecards -->
                            {#if attachedScorecards.length > 0}
                                <div class="attached-scorecards">
                                    <h5>Attached Scorecards</h5>
                                    <div class="scorecard-list">
                                        {#each attachedScorecards as sceneScorecard}
                                            <div class="scorecard-item">
                                                <span>{sceneScorecard.scorecard?.name || 'Unknown Scorecard'}</span>
                                                <button
                                                    onclick={() => detachScorecard(sceneScorecard.id)}
                                                    class="button button-danger"
                                                    style="padding: 0.25rem 0.5rem; font-size: 0.875rem;"
                                                >
                                                    Remove
                                                </button>
                                            </div>
                                        {/each}
                                    </div>
                                </div>
                            {/if}

                            <!-- Available Scorecards -->
                            <div class="available-scorecards">
                                <h5>Available Scorecards</h5>
                                {#if availableScorecards.length === 0}
                                    <p class="text-muted">No scorecards available. <a href="/series/{board.seriesId}/scorecards">Create one</a></p>
                                {:else}
                                    <div class="scorecard-list">
                                        {#each availableScorecards as scorecard}
                                            {@const isAttached = attachedScorecards.some(ss => ss.scorecardId === scorecard.id)}
                                            <div class="scorecard-item">
                                                <span>{scorecard.name}</span>
                                                {#if isAttached}
                                                    <span class="badge">Attached</span>
                                                {:else}
                                                    <button
                                                        onclick={() => attachScorecard(scorecard.id)}
                                                        class="button button-primary"
                                                        style="padding: 0.25rem 0.5rem; font-size: 0.875rem;"
                                                    >
                                                        Attach
                                                    </button>
                                                {/if}
                                            </div>
                                        {/each}
                                    </div>
                                {/if}
                            </div>
                        </div>
                    {/if}
                </div>
            {/if}
        {/if}
    </div>
{/key}

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
        background: var(--color-bg-secondary);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        padding: var(--spacing-2) var(--spacing-4);
        font-size: 0.875rem;
        font-weight: 500;
        color: var(--color-text-primary);
        cursor: pointer;
        transition: all 0.2s ease;
        background-image: url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e");
        background-position: right var(--spacing-2) center;
        background-repeat: no-repeat;
        background-size: 1em 1em;
        padding-right: var(--spacing-8);
    }

    .select:hover {
        border-color: var(--color-border-hover);
        background-color: var(--surface-elevated);
    }

    .select:focus {
        outline: none;
        border-color: var(--color-border-focus);
        box-shadow: 0 0 0 3px var(--color-border-focus);
        opacity: 0.1;
    }

    /* Permission Section Styles */
    .permissions-section {
        margin-bottom: var(--spacing-6);
    }

    .permissions-title {
        font-size: 0.875rem;
        font-weight: 500;
        color: var(--color-text-primary);
        margin-bottom: var(--spacing-4);
    }

    .permissions-grid {
        display: flex;
        flex-wrap: wrap;
        gap: var(--spacing-3);
    }

    /* Permission Button Styles */
    .permissions-grid .btn-secondary {
        flex: 0 0 calc(33.333% - var(--spacing-2));
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
        background-color: var(--btn-unselected-bg);
        border-color: var(--btn-unselected-border);
        color: var(--btn-unselected-text);
    }

    .permissions-grid .btn-secondary:hover {
        background-color: var(--btn-unselected-bg-hover);
        border-color: var(--btn-unselected-border);
    }

    /* Active (checked) Permission Button State - primary color */
    .btn-secondary.permission-active {
        background-color: var(--btn-primary-bg);
        border-color: var(--btn-primary-bg);
        color: var(--btn-primary-text);
    }

    .btn-secondary.permission-active:hover {
        background-color: var(--btn-primary-bg-hover);
        border-color: var(--btn-primary-bg-hover);
        color: var(--btn-primary-text);
    }

    /* Show icon when permission is active - higher specificity */
    :global(
            .permissions-grid .btn-secondary.permission-active .permission-icon
        ) {
        display: inherit;
    }

    .drag-handle {
        cursor: grab;
        color: var(--color-text-muted);
    }

    .scorecards-management {
        display: flex;
        flex-direction: column;
        gap: 1.5rem;
    }

    .attached-scorecards,
    .available-scorecards {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
    }

    .attached-scorecards h5,
    .available-scorecards h5 {
        margin: 0;
        font-size: 1rem;
        font-weight: 600;
        color: var(--color-text-primary);
    }

    .scorecard-list {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .scorecard-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 0.75rem;
        border: 1px solid var(--color-border);
        border-radius: 4px;
        background-color: var(--color-bg);
    }

    .badge {
        padding: 0.25rem 0.5rem;
        background-color: var(--color-success-bg);
        color: var(--color-success-text);
        border-radius: 3px;
        font-size: 0.75rem;
        font-weight: 500;
    }

    .text-muted {
        color: var(--color-text-muted);
    }

    .text-muted a {
        color: var(--color-primary);
        text-decoration: underline;
    }
</style>
