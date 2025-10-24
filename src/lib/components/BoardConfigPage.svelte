<script lang="ts">
    import { onMount } from "svelte";
    import Icon from "./ui/Icon.svelte";
    import Modal from "./ui/Modal.svelte";
    import RPNTestModal from "./RPNTestModal.svelte";
    import UserManagement from "./UserManagement.svelte";
    import HealthQuestionsManager from "./HealthQuestionsManager.svelte";
    import SceneOptionsConfig from "./SceneOptionsConfig.svelte";
    import flatpickr from "flatpickr";
    import "flatpickr/dist/flatpickr.min.css";
    import { buildDisplayRuleContext } from "$lib/utils/display-rule-context";
    import { COLUMN_PRESETS } from "$lib/data/column-presets";
    import Autocomplete from "./ui/Autocomplete.svelte";

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

    // Column presets for autocomplete
    let columnPresets = $state<Array<{ value: string; used?: boolean }>>([]);

    // Debounce timer for static scene content
    let contentDebounceTimer: ReturnType<typeof setTimeout> | null = null;

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

    // Load column presets when columns tab is active and user can edit
    $effect(async () => {
        if (activeTab === "columns" && board?.id && ['admin', 'facilitator'].includes(userRole)) {
            try {
                const response = await fetch(`/api/boards/${board.id}/column-presets`);
                if (response.ok) {
                    const data = await response.json();
                    columnPresets = data.presets || [];
                }
            } catch (error) {
                console.error("Failed to load column presets:", error);
                // Fallback to presets without usage tracking
                columnPresets = (COLUMN_PRESETS['Icebreaker'] || []).map(value => ({ value }));
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
            // Default to current scene if available, otherwise first scene
            selectedSceneId = board.currentSceneId || board.scenes[0].id;
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

    function updateSceneFlags(sceneId: string, flags: string[]) {
        onUpdateScene(sceneId, { flags });
    }

    function debouncedUpdateSceneDescription(
        sceneId: string,
        description: string,
    ) {
        if (contentDebounceTimer) {
            clearTimeout(contentDebounceTimer);
        }
        contentDebounceTimer = setTimeout(() => {
            onUpdateScene(sceneId, { description });
        }, 500);
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
                    <Autocomplete
                        bind:value={selectedColumn.description}
                        options={columnPresets}
                        placeholder="Enter description..."
                        onSelect={(value) => updateColumnDescription(selectedColumn.id, value)}
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
                        <option value="agreements">Agreements</option>
                        <option value="columns">Columns</option>
                        <option value="present">Present</option>
                        <option value="review">Review</option>
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
                        <label for="scene-description">Content (Markdown)</label
                        >
                        <textarea
                            id="scene-description"
                            value={selectedScene.description || ""}
                            oninput={(e) =>
                                debouncedUpdateSceneDescription(
                                    selectedScene.id,
                                    e.currentTarget.value,
                                )}
                            class="input"
                            rows="15"
                            placeholder="Enter markdown content to display in this scene..."
                        ></textarea>
                        <p class="field-hint">
                            Use GitHub-flavored markdown to format your content.
                        </p>
                    </div>
                {/if}

                {#if selectedScene.flags}
                    <SceneOptionsConfig
                        sceneMode={selectedScene.mode}
                        bind:selectedFlags={selectedScene.flags}
                        onchange={() =>
                            updateSceneFlags(
                                selectedScene.id,
                                selectedScene.flags,
                            )}
                    />
                {/if}

                {#if selectedScene.mode !== "static" && selectedScene.mode !== "survey"}
                    <div class="form-section">
                        <h3>Columns</h3>
                        <div class="checkbox-grid">
                            {#each board.allColumns || board.columns || [] as column (column.id)}
                                {@const currentState =
                                    columnStates[selectedScene.id]?.[
                                        column.id
                                    ] || "visible"}
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
                                {#each availableScorecards as scorecard (scorecard.id)}
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
                                onclick={() => (showDisplayRuleContext = true)}
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
                                        displayRule:
                                            e.currentTarget.value || null,
                                    })}
                                class="input"
                                placeholder="e.g., $.columns.Kvetches.cards.length 0 >"
                            />
                            <button
                                type="button"
                                onclick={() => (showRPNTestModal = true)}
                                class="test-button"
                                title="Test this RPN rule"
                            >
                                🧪 Test
                            </button>
                        </div>
                        <p class="field-hint">
                            Optional RPN expression to conditionally display
                            this scene. Leave empty to always show. Scene is
                            skipped if rule evaluates to false.
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
    onClose={() => (showDisplayRuleContext = false)}
>
    <div class="context-help">
        <p>
            The following data structure is available when your display rule is
            evaluated. Access values using <code>$</code> followed by the path:
        </p>

        <div class="context-section">
            <h4>Board Data</h4>
            <pre><code
                    >$.board.title          - Board title (string)
$.board.status         - Board status (string)
$.board.blameFreeMode  - Blame-free mode (boolean)</code
                ></pre>
        </div>

        <div class="context-section">
            <h4>Scene Data</h4>
            <pre><code
                    >$.scene.title          - Current scene title (string)
$.scene.mode           - Scene mode (string)</code
                ></pre>
        </div>

        <div class="context-section">
            <h4>Columns Data</h4>
            <pre><code
                    >$.columns                        - Object with column data by title
$.columns.&lt;ColumnTitle&gt;.cards   - Array of cards in that column

Examples:
  $.columns.Kvetches.cards.length                - Number of cards (single word)
  $.columns["Issues to Discuss"].cards.length    - Number of cards (multi-word)

Single-word column titles:
  $.columns.Kvetches.cards

Multi-word column titles (use bracket notation):
  $.columns["Issues to Discuss"].cards
  $.columns["Action Items"].cards.length</code
                ></pre>
            <p class="context-note">
                <strong>Note:</strong> Replace <code>&lt;ColumnTitle&gt;</code>
                with the actual column title from your board. For titles with
                spaces or special characters, use bracket notation with quotes.
                <br /><strong>Current columns:</strong>
                {#if board?.allColumns}{board.allColumns
                        .map((c: any) => c.title)
                        .join(", ")}{:else}none{/if}
            </p>
        </div>

        <div class="context-section">
            <h4>Agreements Data</h4>
            <pre><code
                    >$.agreements.all                 - Array of all agreements
$.agreements.incomplete          - Array of incomplete agreements
$.agreements.completed           - Array of completed agreements
$.agreements.totalCount          - Total number of agreements (number)
$.agreements.incompleteCount     - Number of incomplete agreements (number)
$.agreements.completedCount      - Number of completed agreements (number)

Examples:
  $.agreements.incompleteCount 0 >    - Has incomplete agreements
  $.agreements.totalCount 5 >=        - Has at least 5 agreements
  $.agreements.completedCount 10 >    - More than 10 completed</code
                ></pre>
        </div>

        <div class="context-section">
            <h4>Example Rules</h4>
            <pre><code
                    >// Skip scene if "Kvetches" column has no cards
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
$.agreements.completedCount 3 ></code
                ></pre>
        </div>

        <div class="context-section">
            <h4>RPN Operators</h4>
            <pre><code
                    >Comparison (symbols):   =  !=  &lt;&gt;  &gt;  &lt;  &gt;=  &lt;=
Comparison (words):     eq ne  ne  gt lt gte lte

Arithmetic (symbols):   +   -   *   /   %
Arithmetic (words):     add sub mul div mod

Logic (symbols):        &&  ||  !
Logic (words):          and or  not

Aggregation:            count sum avg min max
String:                 concat contains matches_regex
Date:                   days_since days_since_uk</code
                ></pre>
        </div>
    </div>
</Modal>

<!-- RPN Test Modal -->
{#if selectedScene}
    <RPNTestModal
        show={showRPNTestModal}
        initialRule={selectedScene.displayRule || ""}
        initialData={JSON.stringify(
            buildDisplayRuleContext(
                board,
                selectedScene,
                [],
                agreements,
                lastHealthCheckDate,
            ),
            null,
            2,
        )}
        onClose={() => (showRPNTestModal = false)}
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
        background: linear-gradient(
            135deg,
            color-mix(in srgb, var(--color-primary) 2%, transparent),
            color-mix(in srgb, var(--color-secondary) 2%, transparent)
        );
        gap: 0;
    }

    .config-left-column {
        flex: 0 0 280px;
        background-color: white;
        border-right: 1px solid var(--color-border);
        display: flex;
        flex-direction: column;
        overflow-y: auto;
        padding: var(--spacing-4);
        box-shadow: var(--shadow-sm);
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
        font-weight: 500;
        transition: all 0.2s ease;

        &:hover {
            color: var(--color-primary-hover);
            transform: translateX(-2px);
        }

        &:active {
            transform: translateX(0);
        }
    }

    .board-info {
        margin-bottom: var(--spacing-6);
        padding: var(--spacing-4);
        background: linear-gradient(
            135deg,
            color-mix(in srgb, var(--color-primary) 5%, transparent),
            color-mix(in srgb, var(--color-secondary) 5%, transparent)
        );
        border-radius: var(--radius-lg);
        border: 1px solid var(--color-border);

        h3 {
            margin: 0 0 var(--spacing-2) 0;
            font-size: var(--text-lg);
            font-weight: 700;
            background: linear-gradient(
                135deg,
                var(--color-primary),
                var(--color-secondary)
            );
            background-clip: text;
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        .board-meta {
            display: flex;
            flex-direction: column;
            gap: var(--spacing-1);

            .meta-item {
                font-size: var(--text-sm);
                color: var(--color-text-secondary);
                font-weight: 500;
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
        border-radius: var(--radius-md);
        cursor: pointer;
        text-align: left;
        color: var(--color-text-primary);
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        font-weight: 500;
        position: relative;

        &:hover {
            background-color: var(--surface-elevated);
            transform: translateX(2px);
        }

        &.active {
            background: linear-gradient(
                135deg,
                color-mix(in srgb, var(--color-primary) 15%, transparent),
                color-mix(in srgb, var(--color-secondary) 10%, transparent)
            );
            border-left: 3px solid var(--color-primary);
            color: var(--color-primary);
            font-weight: 600;
            box-shadow: var(--shadow-sm);

            &::before {
                content: "";
                position: absolute;
                left: 0;
                top: 0;
                bottom: 0;
                width: 3px;
                background: linear-gradient(
                    180deg,
                    var(--color-primary),
                    var(--color-secondary)
                );
            }
        }
    }

    .config-middle-column {
        flex: 0 0 320px;
        background-color: white;
        border-right: 1px solid var(--color-border);
        display: flex;
        flex-direction: column;
        padding: var(--spacing-4);
        box-shadow: var(--shadow-sm);
    }

    .column-list,
    .scene-list {
        flex: 1;
        overflow-y: auto;
        overflow-x: visible;
        display: flex;
        flex-direction: column;
        gap: var(--spacing-2);
        margin-bottom: var(--spacing-4);
        padding-right: var(--spacing-2);
    }

    .list-item {
        display: flex;
        align-items: center;
        gap: var(--spacing-2);
        padding: 0.875rem 1rem;
        background: white;
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        cursor: pointer;
        text-align: left;
        color: var(--color-text-primary);
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        font-weight: 500;
        position: relative;
        box-shadow: var(--shadow-sm);
        z-index: 1;

        &::before {
            content: "";
            position: absolute;
            left: 0;
            top: 0;
            bottom: 0;
            width: 3px;
            background: linear-gradient(
                180deg,
                var(--color-accent),
                var(--color-secondary)
            );
            opacity: 0;
            transition: opacity 0.2s ease;
        }

        &:hover {
            background-color: var(--surface-elevated);
            border-color: var(--color-primary);
            transform: translateX(3px);
            box-shadow: var(--shadow-md);
            z-index: 10;

            &::before {
                opacity: 1;
            }
        }

        &.selected {
            background: linear-gradient(
                135deg,
                color-mix(in srgb, var(--color-primary) 12%, transparent),
                color-mix(in srgb, var(--color-secondary) 8%, transparent)
            );
            border-color: var(--color-primary);
            font-weight: 600;
            box-shadow: var(--shadow-md);

            &::before {
                opacity: 1;
            }
        }

        &.draggable {
            cursor: move;
        }

        &.dragging {
            opacity: 0.5;
            transform: scale(0.98);
        }

        &.drag-over-top {
            border-top: 3px solid var(--color-accent);
            box-shadow: 0 -4px 8px color-mix(in srgb, var(--color-accent) 20%, transparent);
        }

        &.drag-over-bottom {
            border-bottom: 3px solid var(--color-accent);
            box-shadow: 0 4px 8px
                color-mix(in srgb, var(--color-accent) 20%, transparent);
        }

        span {
            flex: 1;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }
    }

    .drop-zone {
        min-height: 50px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: var(--color-text-muted);
        font-size: 0.875rem;
        font-weight: 500;
        transition: all 0.2s ease;
        border-radius: var(--radius-md);
        border: 2px dashed transparent;

        &.drag-over {
            border-color: var(--color-accent);
            background: linear-gradient(
                135deg,
                color-mix(in srgb, var(--color-accent) 10%, transparent),
                color-mix(in srgb, var(--color-secondary) 8%, transparent)
            );
            color: var(--color-accent);
            box-shadow: var(--shadow-md);
        }
    }

    .add-button {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: var(--spacing-2);
        padding: 0.625rem 1.25rem;
        background: var(--btn-primary-bg);
        color: var(--btn-primary-text);
        border: none;
        border-radius: var(--radius-md);
        cursor: pointer;
        font-size: 0.875rem;
        font-weight: 600;
        align-self: flex-end;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        box-shadow: var(--shadow-sm);
        min-height: 44px;

        &:hover {
            background: var(--btn-primary-bg-hover);
            transform: translateY(-1px);
            box-shadow: var(--shadow-md);
        }

        &:active {
            transform: translateY(0);
            box-shadow: var(--shadow-sm);
        }
    }

    .config-right-column {
        flex: 1 1 auto;
        background-color: white;
        overflow-y: auto;
        padding: var(--spacing-6);
        box-shadow: var(--shadow-sm);

        &.two-col {
            /* Fills remaining space in 2-column mode */
        }

        &.three-col {
            /* Standard width in 3-column mode */
        }

        h2 {
            margin: 0 0 var(--spacing-6) 0;
            font-size: var(--text-xl);
            font-weight: 700;
            background: linear-gradient(
                135deg,
                var(--color-primary),
                var(--color-secondary)
            );
            background-clip: text;
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }

        h3 {
            margin: 0 0 var(--spacing-3) 0;
            font-size: var(--text-lg);
            font-weight: 600;
            color: var(--color-text-primary);
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
            font-weight: 600;
            color: var(--color-text-primary);
        }

        .input,
        .select {
            width: 100%;
            padding: 0.625rem 0.875rem;
            border: 1px solid var(--color-border);
            border-radius: var(--radius-md);
            font-family: inherit;
            font-size: 0.875rem;
            background-color: white;
            transition: all 0.2s ease;
            min-height: 44px;

            &:hover {
                border-color: var(--color-border-hover);
            }

            &:focus {
                outline: none;
                border-color: var(--color-primary);
                box-shadow: 0 0 0 3px
                    color-mix(in srgb, var(--color-primary) 15%, transparent);
            }

            &::placeholder {
                color: var(--color-text-muted);
            }
        }

        textarea.input {
            resize: vertical;
            min-height: 120px;
            line-height: 1.6;
            font-family: "Monaco", "Menlo", "Ubuntu Mono", monospace;
        }

        &.checkbox-group {
            label {
                display: flex;
                align-items: center;
                gap: var(--spacing-2);
                font-weight: 500;
                cursor: pointer;

                input[type="checkbox"] {
                    width: 18px;
                    height: 18px;
                    cursor: pointer;
                    accent-color: var(--color-primary);
                }
            }
        }
    }

    .field-hint {
        font-size: var(--text-sm);
        color: var(--color-text-secondary);
        margin: 0;
        font-style: italic;
    }

    .help-text {
        font-size: var(--text-sm);
        color: var(--color-text-secondary);
        margin: 0;
        line-height: 1.5;
    }

    .form-section {
        padding: var(--spacing-5) 0;
        border-top: 1px solid var(--color-border);

        &:first-child {
            padding-top: 0;
            border-top: none;
        }

        &.manage-section {
            margin-top: var(--spacing-4);
            padding: var(--spacing-5);
            background: linear-gradient(
                135deg,
                color-mix(in srgb, var(--color-danger) 3%, transparent),
                color-mix(in srgb, var(--color-danger) 5%, transparent)
            );
            border: 1px solid
                color-mix(in srgb, var(--color-danger) 30%, transparent);
            border-radius: var(--radius-lg);
        }
    }

    .checkbox-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: 1rem;

        label {
            display: flex;
            align-items: center;
            gap: 0.625rem;
            font-size: 0.875rem;
            font-weight: 500;
            cursor: pointer;
            padding: 0.5rem;
            border-radius: var(--radius-md);
            transition: background-color 0.2s ease;

            &:hover {
                background-color: var(--surface-elevated);
            }

            input[type="checkbox"] {
                width: 18px;
                height: 18px;
                cursor: pointer;
                accent-color: var(--color-primary);
            }
        }
    }

    .form-actions {
        padding-top: var(--spacing-4);
        border-top: 1px solid var(--color-border);
    }

    .btn-danger {
        background: var(--btn-danger-bg);
        color: var(--btn-danger-text);
        border: none;
        border-radius: var(--radius-md);
        padding: 0.625rem 1.25rem;
        font-size: 0.875rem;
        font-weight: 600;
        cursor: pointer;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        box-shadow: var(--shadow-sm);
        min-height: 44px;

        &:hover {
            background: var(--btn-danger-bg-hover);
            transform: translateY(-1px);
            box-shadow: var(--shadow-md);
        }

        &:active {
            transform: translateY(0);
            box-shadow: var(--shadow-sm);
        }
    }

    .empty-state {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 200px;
        color: var(--color-text-muted);
        font-style: italic;
        font-size: 0.9375rem;
        padding: var(--spacing-6);
        border: 2px dashed var(--color-border);
        border-radius: var(--radius-lg);
        background: linear-gradient(
            135deg,
            color-mix(in srgb, var(--color-primary) 2%, transparent),
            color-mix(in srgb, var(--color-secondary) 2%, transparent)
        );
    }

    .maintenance-section {
        h3 {
            color: var(--color-danger);
            font-weight: 700;
        }
    }

    .info-button {
        background: none;
        border: none;
        color: var(--color-primary);
        cursor: pointer;
        padding: 0.25rem;
        margin-left: 0.5rem;
        vertical-align: middle;
        border-radius: var(--radius-md);
        transition: all 0.2s ease;

        &:hover {
            color: var(--color-primary-hover);
            background-color: var(--surface-elevated);
        }

        &:active {
            transform: scale(0.95);
        }
    }

    .display-rule-input-group {
        display: flex;
        gap: 0.75rem;
        align-items: stretch;

        input {
            flex: 1;
        }

        .test-button {
            flex-shrink: 0;
        }
    }

    .test-button {
        padding: 0.625rem 1.25rem;
        border: none;
        background: var(--btn-accent-bg);
        color: var(--btn-accent-text);
        border-radius: var(--radius-md);
        cursor: pointer;
        font-size: 0.875rem;
        font-weight: 600;
        white-space: nowrap;
        transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        box-shadow: var(--shadow-sm);
        min-height: 44px;

        &:hover {
            background: var(--btn-accent-bg-hover);
            transform: translateY(-1px);
            box-shadow: var(--shadow-md);
        }

        &:active {
            transform: translateY(0);
            box-shadow: var(--shadow-sm);
        }
    }

    .context-help {
        max-height: 70vh;
        overflow-y: auto;

        p {
            margin-bottom: 1rem;
            line-height: 1.6;
            color: var(--color-text-primary);
        }

        code {
            background-color: color-mix(
                in srgb,
                var(--color-primary) 8%,
                transparent
            );
            color: var(--color-primary);
            padding: 0.25rem 0.5rem;
            border-radius: var(--radius-md);
            font-family: "Monaco", "Menlo", "Ubuntu Mono", monospace;
            font-size: 0.875em;
            font-weight: 500;
        }

        pre {
            background: linear-gradient(
                135deg,
                color-mix(in srgb, var(--color-primary) 3%, transparent),
                color-mix(in srgb, var(--color-secondary) 3%, transparent)
            );
            border: 1px solid var(--color-border);
            padding: 1.25rem;
            border-radius: var(--radius-lg);
            overflow-x: auto;
            margin: 0.75rem 0;
            box-shadow: var(--shadow-sm);

            code {
                background: none;
                padding: 0;
                color: var(--color-text-primary);
            }
        }
    }

    .context-section {
        margin-bottom: 2rem;

        h4 {
            margin-bottom: 0.75rem;
            font-weight: 700;
            color: var(--color-primary);
            font-size: 1rem;
        }

        .context-note {
            background: linear-gradient(
                135deg,
                color-mix(in srgb, var(--color-secondary) 10%, transparent),
                color-mix(in srgb, var(--color-accent) 8%, transparent)
            );
            border: 1px solid var(--color-border);
            padding: 1rem;
            border-radius: var(--radius-lg);
            margin-top: 0.75rem;
            font-size: 0.875rem;
            line-height: 1.6;
            box-shadow: var(--shadow-sm);

            strong {
                color: var(--color-accent);
                font-weight: 700;
            }

            code {
                background-color: color-mix(
                    in srgb,
                    var(--color-accent) 15%,
                    transparent
                );
                color: var(--color-accent);
            }
        }
    }
</style>
