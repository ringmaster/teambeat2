<script lang="ts">
    import { onMount } from "svelte";
    import Icon from "./ui/Icon.svelte";
    import Modal from "./ui/Modal.svelte";
    import RPNTestModal from "./RPNTestModal.svelte";
    import UserManagement from "./UserManagement.svelte";
    import HealthQuestionsManager from "./HealthQuestionsManager.svelte";
    import flatpickr from "flatpickr";
    import "flatpickr/dist/flatpickr.min.css";
    import { buildDisplayRuleContext } from "$lib/utils/display-rule-context";

    interface Props {
        board: any;
        userRole: string;
        agreements?: any[];
        lastHealthCheckDate?: string | null;
        onClose: () => void;
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
        board,
        userRole,
        agreements = [],
        lastHealthCheckDate = null,
        onClose,
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

    // State
    let activeTab = $state("general");
    let selectedColumnId = $state("");
    let selectedSceneId = $state("");
    let configForm = $state({
        name: board?.name || "",
        status: board?.status || "draft",
        blameFreeMode: board?.blameFreeMode || false,
        meetingDate: board?.meetingDate || "",
    });

    // User management state
    let seriesUsers = $state([]);

    // Date picker
    let datePickerInstance: any = null;
    let datePickerElement = $state<HTMLInputElement>();

    // Column states for scene visibility
    let columnStates = $state<Record<string, Record<string, string>>>({});

    // Scorecard state
    let availableScorecards = $state<any[]>([]);
    let attachedScorecards = $state<any[]>([]);
    let loadingScorecards = $state(false);

    // Display rule context modal
    let showDisplayRuleContext = $state(false);
    let showRPNTestModal = $state(false);

    // Update form when board changes
    $effect(() => {
        if (board) {
            configForm.name = board.name || "";
            configForm.status = board.status || "draft";
            configForm.blameFreeMode = board.blameFreeMode || false;
            configForm.meetingDate = board.meetingDate || "";
        }
    });

    // Load users when the users tab is opened
    $effect(async () => {
        if (activeTab === "users" && board?.seriesId) {
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

    // Initialize date picker for general tab
    $effect(() => {
        if (
            activeTab === "general" &&
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
                        onUpdateBoardConfig({
                            createdAt: newDate.toISOString(),
                        });
                    }
                },
            });
        }

        return () => {
            if (datePickerInstance) {
                datePickerInstance.destroy();
                datePickerInstance = null;
            }
        };
    });

    // Load column states for scenes
    async function initializeColumnStates(sceneId: string) {
        if (!columnStates[sceneId]) {
            columnStates[sceneId] = {};
        }
        const columnsToUse = board.allColumns || board.columns;
        columnsToUse?.forEach((col: any) => {
            columnStates[sceneId][col.id] = "visible";
        });
        if (board.hiddenColumnsByScene && board.hiddenColumnsByScene[sceneId]) {
            board.hiddenColumnsByScene[sceneId].forEach((colId: string) => {
                columnStates[sceneId][colId] = "hidden";
            });
        }
    }

    // Load scorecards for scene
    async function loadScorecardsForScene(sceneId: string) {
        loadingScorecards = true;
        try {
            const scorecardsResponse = await fetch(
                `/api/series/${board.seriesId}/scorecards`,
            );
            if (scorecardsResponse.ok) {
                const scorecardsData = await scorecardsResponse.json();
                availableScorecards = scorecardsData.scorecards || [];
            }

            const attachedResponse = await fetch(
                `/api/scenes/${sceneId}/scorecards`,
            );
            if (attachedResponse.ok) {
                const attachedData = await attachedResponse.json();
                attachedScorecards = attachedData.sceneScorecards || [];
            }
        } catch (error) {
            console.error("Failed to load scorecards:", error);
        } finally {
            loadingScorecards = false;
        }
    }

    // Handle tab change
    function handleTabChange(tab: string) {
        activeTab = tab;

        // Auto-select first item when switching to columns or scenes
        if (
            tab === "columns" &&
            board.allColumns &&
            board.allColumns.length > 0
        ) {
            selectedColumnId = board.allColumns[0].id;
            selectedSceneId = "";
        } else if (
            tab === "scenes" &&
            board.scenes &&
            board.scenes.length > 0
        ) {
            selectedSceneId = board.scenes[0].id;
            selectedColumnId = "";
        } else {
            selectedColumnId = "";
            selectedSceneId = "";
        }
    }

    // Handle column selection
    function handleColumnSelect(columnId: string) {
        selectedColumnId = columnId;
        selectedSceneId = "";
    }

    // Handle scene selection
    async function handleSceneSelect(sceneId: string) {
        selectedSceneId = sceneId;
        selectedColumnId = "";
        await initializeColumnStates(sceneId);

        const scene = board.scenes?.find((s: any) => s.id === sceneId);
        if (scene?.mode === "scorecard") {
            await loadScorecardsForScene(sceneId);
        }
    }

    // Column handlers
    function updateColumnTitle(columnId: string, title: string) {
        onUpdateColumn(columnId, { title: title.trim() });
    }

    function updateColumnDescription(columnId: string, description: string) {
        onUpdateColumn(columnId, { description: description || null });
    }

    function updateColumnAppearance(columnId: string, appearance: string) {
        onUpdateColumn(columnId, { defaultAppearance: appearance });
    }

    // Scene handlers
    function updateSceneTitle(sceneId: string, title: string) {
        onUpdateScene(sceneId, { title });
    }

    function updateSceneMode(sceneId: string, mode: string) {
        onUpdateScene(sceneId, { mode });
    }

    function togglePermission(sceneId: string, permission: string) {
        const scene = board.scenes.find((s: any) => s.id === sceneId);
        if (!scene) return;
        const updates = { [permission]: !scene[permission] };
        onUpdateScene(sceneId, updates);
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
                if (!columnStates[sceneId]) {
                    columnStates[sceneId] = {};
                }
                columnStates[sceneId][columnId] = state;
            }
        } catch (error) {
            console.error("Failed to update column display:", error);
        }
    }

    // Scorecard handlers
    async function attachScorecard(scorecardId: string) {
        try {
            const response = await fetch(
                `/api/scenes/${selectedSceneId}/scorecards`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ scorecard_id: scorecardId }),
                },
            );

            if (response.ok) {
                const attachedResponse = await fetch(
                    `/api/scenes/${selectedSceneId}/scorecards`,
                );
                if (attachedResponse.ok) {
                    const attachedData = await attachedResponse.json();
                    attachedScorecards = attachedData.sceneScorecards || [];
                }
            }
        } catch (error) {
            console.error("Failed to attach scorecard:", error);
        }
    }

    async function detachScorecard(sceneScorecardId: string) {
        try {
            const response = await fetch(
                `/api/scene-scorecards/${sceneScorecardId}`,
                {
                    method: "DELETE",
                },
            );

            if (response.ok) {
                attachedScorecards = attachedScorecards.filter(
                    (ss) => ss.id !== sceneScorecardId,
                );
            }
        } catch (error) {
            console.error("Failed to detach scorecard:", error);
        }
    }

    // User management handlers
    async function handleUserAdded(email: string) {
        const response = await fetch(`/api/series/${board.seriesId}/users`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, role: "member" }),
        });

        if (response.ok) {
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
                { method: "DELETE" },
            );

            if (response.ok) {
                seriesUsers = seriesUsers.filter((u) => u.userId !== userId);
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
                seriesUsers = seriesUsers.map((u) =>
                    u.userId === userId ? { ...u, role: newRole } : u,
                );
            }
        } catch (error) {
            console.error("Failed to update user role:", error);
        }
    }

    // Computed values
    let selectedColumn = $derived(
        board.allColumns?.find((col: any) => col.id === selectedColumnId),
    );
    let selectedScene = $derived(
        board.scenes?.find((scene: any) => scene.id === selectedSceneId),
    );
    let isThreeColumnMode = $derived(
        activeTab === "columns" || activeTab === "scenes",
    );
</script>

<div class="config-page">
    <!-- Left Column - Board Info + Navigation -->
    <div class="config-left-column">
        <button onclick={onClose} class="return-link">
            <Icon name="arrow-left" size="sm" />
            Return to board
        </button>

        <div class="board-info">
            <h3>{board.name}</h3>
            <div class="board-meta">
                <span class="meta-item">Status: {board.status}</span>
                {#if board.meetingDate}
                    <span class="meta-item">Meeting: {board.meetingDate}</span>
                {/if}
                {#if board.blameFreeMode}
                    <span class="meta-item">Blame-free mode</span>
                {/if}
            </div>
        </div>

        <nav class="tab-navigation">
            <button
                onclick={() => handleTabChange("general")}
                class="nav-tab {activeTab === 'general' ? 'active' : ''}"
            >
                General
                {#if activeTab === "general"}
                    <Icon name="chevron-right" size="sm" />
                {/if}
            </button>
            <button
                onclick={() => handleTabChange("columns")}
                class="nav-tab {activeTab === 'columns' ? 'active' : ''}"
            >
                Columns
                {#if activeTab === "columns"}
                    <Icon name="chevron-right" size="sm" />
                {/if}
            </button>
            <button
                onclick={() => handleTabChange("scenes")}
                class="nav-tab {activeTab === 'scenes' ? 'active' : ''}"
            >
                Scenes
                {#if activeTab === "scenes"}
                    <Icon name="chevron-right" size="sm" />
                {/if}
            </button>
            {#if ["admin", "facilitator"].includes(userRole)}
                <button
                    onclick={() => handleTabChange("users")}
                    class="nav-tab {activeTab === 'users' ? 'active' : ''}"
                >
                    Users
                    {#if activeTab === "users"}
                        <Icon name="chevron-right" size="sm" />
                    {/if}
                </button>
            {/if}
            <button
                onclick={() => handleTabChange("maintenance")}
                class="nav-tab {activeTab === 'maintenance' ? 'active' : ''}"
            >
                Maintenance
                {#if activeTab === "maintenance"}
                    <Icon name="chevron-right" size="sm" />
                {/if}
            </button>
        </nav>
    </div>

    <!-- Middle Column - Item Lists (3-column mode only) -->
    {#if isThreeColumnMode}
        <div class="config-middle-column">
            {#if activeTab === "columns"}
                <div class="column-list">
                    {#each board.allColumns || [] as column (column.id)}
                        <button
                            draggable="true"
                            ondragstart={(e) =>
                                onDragStart("column", e, column.id)}
                            ondragover={(e) =>
                                onDragOver("column", e, column.id)}
                            ondragleave={(e) => onDragLeave("column", e)}
                            ondrop={(e) => onDrop("column", e, column.id)}
                            onclick={() => handleColumnSelect(column.id)}
                            class="list-item draggable {selectedColumnId ===
                            column.id
                                ? 'selected'
                                : ''}
                                   {dragState.draggedColumnId === column.id
                                ? 'dragging'
                                : ''}
                                   {dragState.dragOverColumnId === column.id &&
                            dragState.draggedColumnId !== column.id &&
                            dragState.columnDropPosition === 'above'
                                ? 'drag-over-top'
                                : ''}
                                   {dragState.dragOverColumnId === column.id &&
                            dragState.draggedColumnId !== column.id &&
                            dragState.columnDropPosition === 'below'
                                ? 'drag-over-bottom'
                                : ''}"
                        >
                            <Icon
                                name="grip-vertical"
                                size="sm"
                                class="drag-handle"
                            />
                            <span>{column.title}</span>
                            {#if selectedColumnId === column.id}
                                <Icon name="chevron-right" size="sm" />
                            {/if}
                        </button>
                    {/each}
                    <div
                        ondragover={(e) => onEndDrop("column", e)}
                        ondrop={(e) => onEndDrop("column", e)}
                        class="drop-zone {dragState.dragOverColumnEnd
                            ? 'drag-over'
                            : ''}"
                    >
                        {#if dragState.dragOverColumnEnd}
                            Drop here to move to end
                        {/if}
                    </div>
                </div>
                <button onclick={onAddNewColumn} class="add-button">
                    <Icon name="plus" size="sm" />
                    Add Column
                </button>
            {:else if activeTab === "scenes"}
                <div class="scene-list">
                    {#each board.scenes || [] as scene (scene.id)}
                        <button
                            draggable="true"
                            ondragstart={(e) =>
                                onDragStart("scene", e, scene.id)}
                            ondragover={(e) => onDragOver("scene", e, scene.id)}
                            ondragleave={(e) => onDragLeave("scene", e)}
                            ondrop={(e) => onDrop("scene", e, scene.id)}
                            onclick={() => handleSceneSelect(scene.id)}
                            class="list-item draggable {selectedSceneId ===
                            scene.id
                                ? 'selected'
                                : ''}
                                   {dragState.draggedSceneId === scene.id
                                ? 'dragging'
                                : ''}
                                   {dragState.dragOverSceneId === scene.id &&
                            dragState.draggedSceneId !== scene.id &&
                            dragState.sceneDropPosition === 'above'
                                ? 'drag-over-top'
                                : ''}
                                   {dragState.dragOverSceneId === scene.id &&
                            dragState.draggedSceneId !== scene.id &&
                            dragState.sceneDropPosition === 'below'
                                ? 'drag-over-bottom'
                                : ''}"
                        >
                            <Icon
                                name="grip-vertical"
                                size="sm"
                                class="drag-handle"
                            />
                            <span>{scene.title}</span>
                            {#if selectedSceneId === scene.id}
                                <Icon name="chevron-right" size="sm" />
                            {/if}
                        </button>
                    {/each}
                    <div
                        ondragover={(e) => onEndDrop("scene", e)}
                        ondrop={(e) => onEndDrop("scene", e)}
                        class="drop-zone {dragState.dragOverSceneEnd
                            ? 'drag-over'
                            : ''}"
                    >
                        {#if dragState.dragOverSceneEnd}
                            Drop here to move to end
                        {/if}
                    </div>
                </div>
                <button onclick={onAddNewScene} class="add-button">
                    <Icon name="plus" size="sm" />
                    Add Scene
                </button>
            {/if}
        </div>
    {/if}

    <!-- Right Column - Detail Controls -->
    <div
        class="config-right-column {isThreeColumnMode
            ? 'three-col'
            : 'two-col'}"
    >
        {#if activeTab === "general"}
            <h2>General Settings</h2>
            <div class="detail-form">
                <div class="form-group">
                    <label for="board-name">Board Name</label>
                    <input
                        id="board-name"
                        type="text"
                        bind:value={configForm.name}
                        onblur={() =>
                            onUpdateBoardConfig({ name: configForm.name })}
                        class="input"
                    />
                </div>

                <div class="form-group">
                    <label for="board-status">Board Status</label>
                    <select
                        id="board-status"
                        bind:value={configForm.status}
                        onchange={() =>
                            onUpdateBoardConfig({ status: configForm.status })}
                        class="select"
                    >
                        <option value="draft">Draft</option>
                        <option value="active">Active</option>
                        <option value="completed">Completed</option>
                        <option value="archived">Archived</option>
                    </select>
                </div>

                <div class="form-group">
                    <label for="meeting-date">Meeting Date</label>
                    <input
                        id="meeting-date"
                        type="text"
                        bind:this={datePickerElement}
                        class="input"
                        placeholder="Select date"
                        readonly
                    />
                </div>

                <div class="form-group checkbox-group">
                    <label>
                        <input
                            type="checkbox"
                            bind:checked={configForm.blameFreeMode}
                            onchange={() =>
                                onUpdateBoardConfig({
                                    blameFreeMode: configForm.blameFreeMode,
                                })}
                        />
                        Blame-free Mode
                    </label>
                    <p class="help-text">
                        Hide user names on cards to encourage open feedback
                    </p>
                </div>
            </div>
        {:else if activeTab === "columns" && selectedColumn}
            <h2>Column Details</h2>
            <div class="detail-form">
                <div class="form-group">
                    <label for="column-title">Title</label>
                    <input
                        id="column-title"
                        type="text"
                        value={selectedColumn.title}
                        onblur={(e) =>
                            updateColumnTitle(
                                selectedColumn.id,
                                e.currentTarget.value,
                            )}
                        class="input"
                    />
                </div>

                <div class="form-group">
                    <label for="column-description">Description</label>
                    <input
                        id="column-description"
                        type="text"
                        value={selectedColumn.description || ""}
                        placeholder="Enter description..."
                        onblur={(e) =>
                            updateColumnDescription(
                                selectedColumn.id,
                                e.currentTarget.value,
                            )}
                        class="input"
                    />
                </div>

                <div class="form-group">
                    <label for="column-appearance">Appearance</label>
                    <select
                        id="column-appearance"
                        value={selectedColumn.defaultAppearance || "shown"}
                        onchange={(e) =>
                            updateColumnAppearance(
                                selectedColumn.id,
                                e.currentTarget.value,
                            )}
                        class="select"
                    >
                        <option value="shown">Shown</option>
                        <option value="locked">Locked</option>
                        <option value="spread">Spread</option>
                    </select>
                </div>

                <div class="form-actions">
                    <button
                        onclick={() => onDeleteColumn(selectedColumn.id)}
                        class="btn-danger"
                    >
                        Delete Column
                    </button>
                </div>
            </div>
        {:else if activeTab === "columns" && !selectedColumn}
            <div class="empty-state">
                <p>Select a column to edit its details</p>
            </div>
        {:else if activeTab === "scenes" && selectedScene}
            <h2>Scene Details</h2>
            <div class="detail-form">
                <div class="form-group">
                    <label for="scene-title">Title</label>
                    <input
                        id="scene-title"
                        type="text"
                        value={selectedScene.title}
                        onblur={(e) =>
                            updateSceneTitle(
                                selectedScene.id,
                                e.currentTarget.value,
                            )}
                        class="input"
                    />
                </div>

                <div class="form-group">
                    <label for="scene-mode">Mode</label>
                    <select
                        id="scene-mode"
                        value={selectedScene.mode}
                        onchange={(e) =>
                            updateSceneMode(
                                selectedScene.id,
                                e.currentTarget.value,
                            )}
                        class="select"
                    >
                        <option value="columns">Columns</option>
                        <option value="present">Present</option>
                        <option value="review">Review</option>
                        <option value="agreements">Agreements</option>
                        <option value="scorecard">Scorecard</option>
                        <option value="static">Static Content</option>
                        <option value="survey">Survey</option>
                    </select>
                </div>

                {#if selectedScene.mode === "survey"}
                    <div class="form-section">
                        <HealthQuestionsManager sceneId={selectedScene.id} />
                    </div>
                {/if}

                {#if selectedScene.mode === "static"}
                    <div class="form-group">
                        <label for="scene-description">Content (Markdown)</label>
                        <textarea
                            id="scene-description"
                            value={selectedScene.description || ""}
                            oninput={(e) =>
                                onUpdateScene(selectedScene.id, {
                                    description: e.currentTarget.value,
                                })}
                            class="input"
                            rows="15"
                            placeholder="Enter markdown content to display in this scene..."
                        ></textarea>
                        <p class="field-hint">Use GitHub-flavored markdown to format your content.</p>
                    </div>
                {/if}

                {#if selectedScene.mode !== "static" && selectedScene.mode !== "agreements" && selectedScene.mode !== "scorecard" && selectedScene.mode !== "survey"}
                    <div class="form-section">
                        <h3>Options</h3>
                    <div class="checkbox-grid">
                        <label>
                            <input
                                type="checkbox"
                                checked={selectedScene.allowAddCards}
                                onchange={() =>
                                    togglePermission(
                                        selectedScene.id,
                                        "allowAddCards",
                                    )}
                            />
                            Allow Add Cards
                        </label>
                        <label>
                            <input
                                type="checkbox"
                                checked={selectedScene.allowEditCards}
                                onchange={() =>
                                    togglePermission(
                                        selectedScene.id,
                                        "allowEditCards",
                                    )}
                            />
                            Allow Edit Cards
                        </label>
                        <label>
                            <input
                                type="checkbox"
                                checked={selectedScene.allowObscureCards}
                                onchange={() =>
                                    togglePermission(
                                        selectedScene.id,
                                        "allowObscureCards",
                                    )}
                            />
                            Allow Obscure Cards
                        </label>
                        <label>
                            <input
                                type="checkbox"
                                checked={selectedScene.allowMoveCards}
                                onchange={() =>
                                    togglePermission(
                                        selectedScene.id,
                                        "allowMoveCards",
                                    )}
                            />
                            Allow Move Cards
                        </label>
                        <label>
                            <input
                                type="checkbox"
                                checked={selectedScene.allowGroupCards}
                                onchange={() =>
                                    togglePermission(
                                        selectedScene.id,
                                        "allowGroupCards",
                                    )}
                            />
                            Allow Group Cards
                        </label>
                        <label>
                            <input
                                type="checkbox"
                                checked={selectedScene.showVotes}
                                onchange={() =>
                                    togglePermission(
                                        selectedScene.id,
                                        "showVotes",
                                    )}
                            />
                            Show Votes
                        </label>
                        <label>
                            <input
                                type="checkbox"
                                checked={selectedScene.allowVoting}
                                onchange={() =>
                                    togglePermission(
                                        selectedScene.id,
                                        "allowVoting",
                                    )}
                            />
                            Allow Voting
                        </label>
                        <label>
                            <input
                                type="checkbox"
                                checked={selectedScene.showComments}
                                onchange={() =>
                                    togglePermission(
                                        selectedScene.id,
                                        "showComments",
                                    )}
                            />
                            Show Comments
                        </label>
                        <label>
                            <input
                                type="checkbox"
                                checked={selectedScene.allowComments}
                                onchange={() =>
                                    togglePermission(
                                        selectedScene.id,
                                        "allowComments",
                                    )}
                            />
                            Allow Comments
                        </label>
                    </div>
                </div>
                {/if}

                {#if selectedScene.mode !== "static" && selectedScene.mode !== "survey"}
                <div class="form-section">
                    <h3>Columns</h3>
                    <div class="checkbox-grid">
                        {#each board.allColumns || board.columns || [] as column (column.id)}
                            {@const currentState =
                                columnStates[selectedScene.id]?.[column.id] ||
                                "visible"}
                            <label>
                                <input
                                    type="checkbox"
                                    checked={currentState === "visible"}
                                    onchange={() =>
                                        updateColumnDisplay(
                                            selectedScene.id,
                                            column.id,
                                            currentState === "visible"
                                                ? "hidden"
                                                : "visible",
                                        )}
                                />
                                {column.title}
                            </label>
                        {/each}
                    </div>
                </div>
                {/if}

                {#if selectedScene.mode === "scorecard"}
                    <div class="form-section">
                        <h3>Scorecards</h3>
                        {#if loadingScorecards}
                            <p>Loading scorecards...</p>
                        {:else if availableScorecards.length > 0}
                            <div class="checkbox-grid">
                                {#each availableScorecards as scorecard(scorecard.id)}
                                    {@const isAttached =
                                        attachedScorecards.some(
                                            (ss) =>
                                                ss.scorecardId === scorecard.id,
                                        )}
                                    {@const sceneScorecardId =
                                        attachedScorecards.find(
                                            (ss) =>
                                                ss.scorecardId === scorecard.id,
                                        )?.id}
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={isAttached}
                                            onchange={() => {
                                                if (
                                                    isAttached &&
                                                    sceneScorecardId
                                                ) {
                                                    detachScorecard(
                                                        sceneScorecardId,
                                                    );
                                                } else {
                                                    attachScorecard(
                                                        scorecard.id,
                                                    );
                                                }
                                            }}
                                        />
                                        {scorecard.name}
                                    </label>
                                {/each}
                            </div>
                        {:else}
                            <p class="help-text">
                                No scorecards available. <a
                                    href="/series/{board.seriesId}/scorecards"
                                    >Create one</a
                                >
                            </p>
                        {/if}
                    </div>
                {/if}

                <div class="form-section">
                    <h3>Display Rule</h3>
                    <div class="form-group">
                        <label for="scene-display-rule">
                            RPN Expression
                            <button
                                type="button"
                                onclick={() => showDisplayRuleContext = true}
                                class="info-button"
                                title="Show available data context"
                            >
                                <Icon name="info" size="sm" />
                            </button>
                        </label>
                        <div class="display-rule-input-group">
                            <input
                                id="scene-display-rule"
                                type="text"
                                value={selectedScene.displayRule || ""}
                                onblur={(e) =>
                                    onUpdateScene(selectedScene.id, {
                                        displayRule: e.currentTarget.value || null,
                                    })}
                                class="input"
                                placeholder="e.g., $.columns.Kvetches.cards.length 0 >"
                            />
                            <button
                                type="button"
                                onclick={() => showRPNTestModal = true}
                                class="test-button"
                                title="Test this RPN rule"
                            >
                                🧪 Test
                            </button>
                        </div>
                        <p class="field-hint">
                            Optional RPN expression to conditionally display this scene.
                            Leave empty to always show. Scene is skipped if rule evaluates to false.
                        </p>
                    </div>
                </div>

                <div class="form-section manage-section">
                    <h3>Manage</h3>
                    <button
                        onclick={() => onDeleteScene(selectedScene.id)}
                        class="btn-danger"
                    >
                        Delete Scene
                    </button>
                </div>
            </div>
        {:else if activeTab === "scenes" && !selectedScene}
            <div class="empty-state">
                <p>Select a scene to edit its details</p>
            </div>
        {:else if activeTab === "users"}
            <h2>User Management</h2>
            <UserManagement
                seriesId={board.seriesId}
                currentUserRole={userRole}
                bind:users={seriesUsers}
                onUserAdded={handleUserAdded}
                onUserRemoved={handleUserRemoved}
                onUserRoleChanged={handleUserRoleChanged}
            />
        {:else if activeTab === "maintenance"}
            <h2>Maintenance</h2>
            {#if onDeleteBoard}
                <div class="maintenance-section">
                    <h3>Delete Board</h3>
                    <p class="help-text">
                        Permanently delete this board and all its contents. This
                        action cannot be undone.
                    </p>
                    <button
                        onclick={() => onDeleteBoard?.()}
                        class="btn-danger"
                    >
                        Delete Board
                    </button>
                </div>
            {/if}
        {/if}
    </div>
</div>

<!-- Display Rule Context Modal -->
<Modal
    show={showDisplayRuleContext}
    title="Display Rule Data Context"
    onClose={() => showDisplayRuleContext = false}
>
        <div class="context-help">
            <p>
                The following data structure is available when your display rule is evaluated.
                Access values using <code>$</code> followed by the path:
            </p>

            <div class="context-section">
                <h4>Board Data</h4>
                <pre><code>$.board.title          - Board title (string)
$.board.status         - Board status (string)
$.board.blameFreeMode  - Blame-free mode (boolean)</code></pre>
            </div>

            <div class="context-section">
                <h4>Scene Data</h4>
                <pre><code>$.scene.title          - Current scene title (string)
$.scene.mode           - Scene mode (string)</code></pre>
            </div>

            <div class="context-section">
                <h4>Columns Data</h4>
                <pre><code>$.columns                        - Object with column data by title
$.columns.&lt;ColumnTitle&gt;.cards   - Array of cards in that column

Examples:
  $.columns.Kvetches.cards.length                - Number of cards (single word)
  $.columns["Issues to Discuss"].cards.length    - Number of cards (multi-word)

Single-word column titles:
  $.columns.Kvetches.cards

Multi-word column titles (use bracket notation):
  $.columns["Issues to Discuss"].cards
  $.columns["Action Items"].cards.length</code></pre>
                <p class="context-note">
                    <strong>Note:</strong> Replace <code>&lt;ColumnTitle&gt;</code> with the actual column title from your board.
                    For titles with spaces or special characters, use bracket notation with quotes.
                    <br><strong>Current columns:</strong> {#if board?.allColumns}{board.allColumns.map((c: any) => c.title).join(', ')}{:else}none{/if}
                </p>
            </div>

            <div class="context-section">
                <h4>Agreements Data</h4>
                <pre><code>$.agreements.all                 - Array of all agreements
$.agreements.incomplete          - Array of incomplete agreements
$.agreements.completed           - Array of completed agreements
$.agreements.totalCount          - Total number of agreements (number)
$.agreements.incompleteCount     - Number of incomplete agreements (number)
$.agreements.completedCount      - Number of completed agreements (number)

Examples:
  $.agreements.incompleteCount 0 >    - Has incomplete agreements
  $.agreements.totalCount 5 >=        - Has at least 5 agreements
  $.agreements.completedCount 10 >    - More than 10 completed</code></pre>
            </div>

            <div class="context-section">
                <h4>Example Rules</h4>
                <pre><code>// Skip scene if "Kvetches" column has no cards
$.columns.Kvetches.cards.length 0 =

// Show scene only if board is active
$.board.status "active" =

// Show scene if "Kvetches" has more than 5 cards
$.columns.Kvetches.cards.length 5 >

// Skip scene if "Issues to Discuss" column is empty (multi-word)
$.columns["Issues to Discuss"].cards.length 0 =

// Show scene only if there are incomplete agreements
$.agreements.incompleteCount 0 >

// Show scene if more than 3 agreements were completed
$.agreements.completedCount 3 ></code></pre>
            </div>

            <div class="context-section">
                <h4>RPN Operators</h4>
                <pre><code>Comparison (symbols):   =  !=  &lt;&gt;  &gt;  &lt;  &gt;=  &lt;=
Comparison (words):     eq ne  ne  gt lt gte lte

Arithmetic (symbols):   +   -   *   /   %
Arithmetic (words):     add sub mul div mod

Logic (symbols):        &&  ||  !
Logic (words):          and or  not

Aggregation:            count sum avg min max
String:                 concat contains matches_regex
Date:                   days_since days_since_uk</code></pre>
            </div>
        </div>
</Modal>

<!-- RPN Test Modal -->
{#if selectedScene}
    <RPNTestModal
        show={showRPNTestModal}
        initialRule={selectedScene.displayRule || ""}
        initialData={JSON.stringify(buildDisplayRuleContext(board, selectedScene, [], agreements, lastHealthCheckDate), null, 2)}
        onClose={() => showRPNTestModal = false}
        onUpdateRule={(rule) => {
            onUpdateScene(selectedScene.id, { displayRule: rule || null });
        }}
    />
{/if}

<style lang="less">
    @import "$lib/styles/_mixins.less";
    .config-page {
        .page-container();
        display: flex;
        height: calc(100vh - var(--header-height, 80px));
        width: 80rem;
        margin: 0 auto;
        background: #f8f9fa;
        gap: 0;
    }

    .config-left-column {
        flex: 0 0 280px;
        background-color: #fff;
        border-right: 1px solid #ddd;
        display: flex;
        flex-direction: column;
        overflow-y: auto;
        padding: var(--spacing-4);
    }

    .return-link {
        display: flex;
        align-items: center;
        gap: var(--spacing-2);
        color: var(--color-primary);
        background: none;
        border: none;
        padding: var(--spacing-2) 0;
        margin-bottom: var(--spacing-4);
        cursor: pointer;
        font-size: var(--text-sm);

        &:hover {
            text-decoration: underline;
        }
    }

    .board-info {
        margin-bottom: var(--spacing-6);

        h3 {
            margin: 0 0 var(--spacing-2) 0;
            font-size: var(--text-lg);
            font-weight: 600;
        }

        .board-meta {
            display: flex;
            flex-direction: column;
            gap: var(--spacing-1);

            .meta-item {
                font-size: var(--text-sm);
                color: var(--color-text-secondary);
            }
        }
    }

    .tab-navigation {
        display: flex;
        flex-direction: column;
        gap: var(--spacing-1);
    }

    .nav-tab {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 0.75rem 1rem;
        background: none;
        border: none;
        cursor: pointer;
        text-align: left;
        color: var(--color-text-primary);
        transition: background-color 0.2s;

        &:hover {
            background-color: #f8f9fa;
        }

        &.active {
            background-color: #e7f3ff;
            border-left: 3px solid #007bff;
            color: #007bff;
            font-weight: 500;
        }
    }

    .config-middle-column {
        flex: 0 0 320px;
        background-color: #fff;
        border-right: 1px solid #ddd;
        display: flex;
        flex-direction: column;
        padding: var(--spacing-4);
    }

    .column-list,
    .scene-list {
        flex: 1;
        overflow-y: auto;
        display: flex;
        flex-direction: column;
        margin-bottom: var(--spacing-4);
    }

    .list-item {
        display: flex;
        align-items: center;
        gap: var(--spacing-2);
        padding: 0.75rem 1rem;
        background: none;
        border: none;
        border-bottom: 1px solid #e9ecef;
        cursor: pointer;
        text-align: left;
        color: var(--color-text-primary);
        transition: background-color 0.2s;

        &:hover {
            background-color: #f8f9fa;
        }

        &.selected {
            background-color: #e7f3ff;
            border-left: 3px solid #007bff;
        }

        &.draggable {
            cursor: move;
        }

        &.dragging {
            opacity: 0.5;
        }

        &.drag-over-top {
            border-top: 3px solid #007bff;
        }

        &.drag-over-bottom {
            border-bottom: 3px solid #007bff;
        }

        span {
            flex: 1;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
    }

    .drop-zone {
        min-height: 40px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #999;
        font-size: 0.875rem;
        transition: all 0.2s;

        &.drag-over {
            border-bottom: 3px solid #007bff;
            background: #e7f3ff;
        }
    }

    .add-button {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: var(--spacing-2);
        padding: 0.5rem 1rem;
        background-color: #007bff;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.875rem;
        font-weight: 500;
        align-self: flex-end;

        &:hover {
            background-color: #0056b3;
        }
    }

    .config-right-column {
        flex: 1 1 auto;
        background-color: #fff;
        overflow-y: auto;
        padding: var(--spacing-6);

        &.two-col {
            /* Fills remaining space in 2-column mode */
        }

        &.three-col {
            /* Standard width in 3-column mode */
        }

        h2 {
            margin: 0 0 var(--spacing-6) 0;
            font-size: var(--text-xl);
            font-weight: 600;
        }

        h3 {
            margin: 0 0 var(--spacing-3) 0;
            font-size: var(--text-lg);
            font-weight: 500;
        }

    }

    .detail-form {
        display: flex;
        flex-direction: column;
        gap: var(--spacing-6);
    }

    .form-group {
        display: flex;
        flex-direction: column;
        gap: var(--spacing-2);

        label {
            font-size: var(--text-sm);
            font-weight: 500;
            color: var(--color-text-primary);
        }

        .input,
        .select {
            width: 100%;
            padding: 0.5rem;
            border: 1px solid #ddd;
            border-radius: 4px;
            font-family: inherit;
            font-size: 0.875rem;

            &:focus {
                outline: none;
                border-color: #007bff;
                box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.1);
            }
        }

        &.checkbox-group {
            label {
                display: flex;
                align-items: center;
                gap: var(--spacing-2);
                font-weight: normal;

                input[type="checkbox"] {
                    width: auto;
                }
            }
        }
    }

    .help-text {
        font-size: var(--text-sm);
        color: var(--color-text-secondary);
        margin: 0;
    }

    .form-section {
        padding-top: var(--spacing-4);
        border-top: 1px solid #ddd;

        &.manage-section {
            margin-top: var(--spacing-6);
        }
    }

    .checkbox-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: 0.75rem;

        label {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            font-size: 0.875rem;

            input[type="checkbox"] {
                width: 16px;
                height: 16px;
                cursor: pointer;
                accent-color: #007bff;
            }
        }
    }

    .form-actions {
        padding-top: var(--spacing-4);
        border-top: 1px solid #ddd;
    }

    .btn-danger {
        background: #dc3545;
        color: white;
        border: none;
        border-radius: 4px;
        padding: 0.5rem 1rem;
        font-size: 0.875rem;
        font-weight: 500;
        cursor: pointer;

        &:hover {
            background: #c82333;
        }
    }

    .empty-state {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 200px;
        color: #999;
        font-style: italic;
    }

    .maintenance-section {
        h3 {
            color: #dc3545;
        }
    }

    .info-button {
        background: none;
        border: none;
        color: var(--color-primary);
        cursor: pointer;
        padding: 0;
        margin-left: 0.5rem;
        vertical-align: middle;

        &:hover {
            color: var(--color-teal-600);
        }
    }

    .display-rule-input-group {
        display: flex;
        gap: 0.5rem;
        align-items: center;

        input {
            flex: 1;
        }
    }

    .test-button {
        padding: 0.5rem 1rem;
        border: 1px solid #28a745;
        background-color: #28a745;
        color: white;
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.875rem;
        font-weight: 500;
        white-space: nowrap;
        transition: all 0.2s ease;

        &:hover {
            background-color: #218838;
            border-color: #1e7e34;
        }

        &:active {
            transform: translateY(1px);
        }
    }

    .context-help {
        max-height: 70vh;
        overflow-y: auto;

        p {
            margin-bottom: 1rem;
            line-height: 1.6;
        }

        code {
            background-color: #f5f5f5;
            padding: 0.2rem 0.4rem;
            border-radius: 3px;
            font-family: 'Courier New', monospace;
            font-size: 0.9em;
        }

        pre {
            background-color: #f5f5f5;
            padding: 1rem;
            border-radius: 4px;
            overflow-x: auto;
            margin: 0.5rem 0;

            code {
                background: none;
                padding: 0;
            }
        }
    }

    .context-section {
        margin-bottom: 1.5rem;

        h4 {
            margin-bottom: 0.5rem;
            color: var(--color-gray-700);
        }

        .context-note {
            background-color: #e3f2fd;
            padding: 0.75rem;
            border-radius: 4px;
            margin-top: 0.5rem;
            font-size: 0.9em;

            strong {
                color: var(--color-teal-700);
            }

            code {
                background-color: #bbdefb;
            }
        }
    }
</style>
