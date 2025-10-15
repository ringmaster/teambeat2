<script lang="ts">
    import { onMount } from "svelte";
    import type {
        Scorecard,
        ScorecardDatasource,
        ScorecardRule,
    } from "$lib/types/scorecard";
    import {
        parseRPNString,
        serializeRPNExpression,
    } from "$lib/utils/rpn-parser";
    import { extractPathsFromJSON } from "$lib/utils/json-path-extractor";
    import {
        validateRPNCondition,
        type ValidationResult,
    } from "$lib/utils/rpn-validator";
    import Modal from "$lib/components/ui/Modal.svelte";
    import Icon from "$lib/components/ui/Icon.svelte";
    import RPNTestModal from "$lib/components/RPNTestModal.svelte";
    import { toastStore } from "$lib/stores/toast";
    import { parseFile } from "$lib/utils/data-parser";

    interface Props {
        seriesId: string;
        canEdit: boolean;
    }

    let { seriesId, canEdit }: Props = $props();

    // Editable rule with condition as string for UI
    interface EditableRule extends Omit<ScorecardRule, "condition"> {
        condition: string;
    }

    // State
    let scorecards = $state<Scorecard[]>([]);
    let selectedScorecardId = $state<string | null>(null);
    let selectedDatasourceId = $state<string | null>(null);
    let selectedScorecard = $state<Scorecard | null>(null);
    let datasources = $state<ScorecardDatasource[]>([]);
    let selectedDatasource = $state<ScorecardDatasource | null>(null);
    let rules = $state<EditableRule[]>([]);
    let editingRuleIndex = $state<number | null>(null);

    // Loading and error states
    let loadingScorecards = $state(true);
    let loadingScorecardDetail = $state(false);
    let loadingDatasourceDetail = $state(false);
    let error = $state<string | null>(null);
    let saving = $state(false);

    // Edit state for scorecard
    let editedScorecardName = $state("");
    let editedScorecardDescription = $state("");

    // Edit state for datasource
    let editedDatasourceName = $state("");
    let editedDatasourceSourceType = $state<"paste" | "api">("paste");
    let editedDatasourceSampleData = $state("");

    // Derived state for available paths from sample data
    let availablePaths = $derived(
        extractPathsFromJSON(editedDatasourceSampleData),
    );

    // Validation state - map of rule index to validation result
    let ruleValidations = $state<Map<number, ValidationResult>>(new Map());

    // RPN help modal state
    let showRPNHelpModal = $state(false);
    // RPN Test Modal state
    let showTestModal = $state(false);
    let testingRuleIndex = $state<number | null>(null);
    let testingThresholdIndex = $state<number | null>(null);
    // Validation state for threshold rules - map of "ruleIndex-thresholdIndex" to validation result
    let thresholdRuleValidations = $state<Map<string, ValidationResult>>(
        new Map(),
    );
    // Sample data drag state
    let isDraggingSampleData = $state(false);

    // Derived validation for each rule
    function validateRule(rule: EditableRule, index: number): ValidationResult {
        const result = validateRPNCondition(
            rule.condition,
            editedDatasourceSampleData,
            rule.iterate_over,
        );
        return result;
    }

    // Update validations when rules or sample data changes
    $effect(() => {
        const newValidations = new Map<number, ValidationResult>();
        const newThresholdValidations = new Map<string, ValidationResult>();

        rules.forEach((rule, index) => {
            newValidations.set(index, validateRule(rule, index));

            // Validate threshold rules
            if (rule.threshold_rules) {
                rule.threshold_rules.forEach(
                    (thresholdRule, thresholdIndex) => {
                        const key = `${index}-${thresholdIndex}`;
                        const result = validateRPNCondition(
                            typeof thresholdRule.condition === "string"
                                ? thresholdRule.condition
                                : serializeRPNExpression(
                                      thresholdRule.condition,
                                  ),
                            editedDatasourceSampleData,
                            rule.iterate_over,
                        );
                        newThresholdValidations.set(key, result);
                    },
                );
            }
        });

        ruleValidations = newValidations;
        thresholdRuleValidations = newThresholdValidations;
    });

    // Drag and drop state
    let draggedDatasourceIndex = $state<number | null>(null);

    // Derived state
    let selectedScorecardData = $derived(
        scorecards.find((s) => s.id === selectedScorecardId) || null,
    );

    // ============================================================================
    // API Functions - Scorecards
    // ============================================================================

    async function loadScorecards() {
        try {
            loadingScorecards = true;
            error = null;
            const response = await fetch(`/api/series/${seriesId}/scorecards`);
            const data = await response.json();

            if (data.success) {
                scorecards = data.scorecards;
            } else {
                error = data.error || "Failed to load scorecards";
            }
        } catch (e) {
            error = "Failed to load scorecards";
            console.error("Error loading scorecards:", e);
        } finally {
            loadingScorecards = false;
        }
    }

    async function createScorecard() {
        if (!canEdit) return;

        try {
            const timestamp = new Date()
                .toISOString()
                .replace(/[:.]/g, "-")
                .slice(0, 19);
            const response = await fetch(`/api/series/${seriesId}/scorecards`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: `New Scorecard ${timestamp}`,
                    description: null,
                }),
            });

            const data = await response.json();

            if (data.success) {
                scorecards = [...scorecards, data.scorecard];
                // Auto-select the new scorecard
                await selectScorecard(data.scorecard.id);
            } else {
                error = data.error || "Failed to create scorecard";
            }
        } catch (e) {
            error = "Failed to create scorecard";
            console.error("Error creating scorecard:", e);
        }
    }

    async function saveScorecard() {
        if (!selectedScorecardId || !editedScorecardName.trim()) return;

        try {
            saving = true;
            error = null;
            const response = await fetch(
                `/api/series/${seriesId}/scorecards/${selectedScorecardId}`,
                {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        name: editedScorecardName,
                        description: editedScorecardDescription || null,
                    }),
                },
            );

            const data = await response.json();

            if (data.success) {
                selectedScorecard = data.scorecard;
                // Update in list
                scorecards = scorecards.map((s) =>
                    s.id === data.scorecard.id ? data.scorecard : s,
                );
            } else {
                error = data.error || "Failed to save scorecard";
            }
        } catch (e) {
            error = "Failed to save scorecard";
            console.error("Error saving scorecard:", e);
        } finally {
            saving = false;
        }
    }

    async function deleteScorecard(scorecardId: string, event: Event) {
        event.stopPropagation();

        if (!canEdit) return;

        toastStore.warning(
            "Are you sure you want to delete this scorecard? This will remove it from all scenes.",
            {
                autoHide: false,
                actions: [
                    {
                        label: "Delete",
                        onClick: async () => {
                            try {
                                const response = await fetch(
                                    `/api/series/${seriesId}/scorecards/${scorecardId}`,
                                    {
                                        method: "DELETE",
                                    },
                                );

                                const data = await response.json();

                                if (data.success) {
                                    scorecards = scorecards.filter(
                                        (s) => s.id !== scorecardId,
                                    );
                                    if (selectedScorecardId === scorecardId) {
                                        selectedScorecardId = null;
                                        selectedScorecard = null;
                                        datasources = [];
                                    }
                                    toastStore.success("Scorecard deleted successfully");
                                } else {
                                    error = data.error || "Failed to delete scorecard";
                                    toastStore.error("Failed to delete scorecard");
                                }
                            } catch (e) {
                                error = "Failed to delete scorecard";
                                toastStore.error("Failed to delete scorecard");
                                console.error("Error deleting scorecard:", e);
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
            },
        );
    }

    async function selectScorecard(scorecardId: string) {
        if (selectedScorecardId === scorecardId) return;

        selectedScorecardId = scorecardId;
        selectedDatasourceId = null;
        selectedDatasource = null;
        rules = [];

        await loadScorecardDetail(scorecardId);
    }

    async function loadScorecardDetail(scorecardId: string) {
        try {
            loadingScorecardDetail = true;
            error = null;
            const response = await fetch(
                `/api/series/${seriesId}/scorecards/${scorecardId}`,
            );
            const data = await response.json();

            if (data.success) {
                selectedScorecard = data.scorecard;
                datasources = data.scorecard.datasources || [];
                editedScorecardName = data.scorecard.name;
                editedScorecardDescription = data.scorecard.description || "";
            } else {
                error = data.error || "Failed to load scorecard";
            }
        } catch (e) {
            error = "Failed to load scorecard";
            console.error("Error loading scorecard:", e);
        } finally {
            loadingScorecardDetail = false;
        }
    }

    // ============================================================================
    // API Functions - Datasources
    // ============================================================================

    async function createDatasource() {
        if (!canEdit || !selectedScorecardId) return;

        try {
            const timestamp = new Date()
                .toISOString()
                .replace(/[:.]/g, "-")
                .slice(0, 19);
            const response = await fetch(
                `/api/scorecards/${selectedScorecardId}/datasources`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        name: `New Datasource ${timestamp}`,
                        source_type: "paste",
                        data_schema: null,
                        rules: [],
                        api_config: null,
                    }),
                },
            );

            const data = await response.json();

            if (data.success) {
                datasources = [...datasources, data.datasource];
                // Auto-select the new datasource
                await selectDatasource(data.datasource.id);
            } else {
                error = data.error || "Failed to create datasource";
            }
        } catch (e) {
            error = "Failed to create datasource";
            console.error("Error creating datasource:", e);
        }
    }

    async function selectDatasource(datasourceId: string) {
        if (selectedDatasourceId === datasourceId) return;

        selectedDatasourceId = datasourceId;
        await loadDatasourceDetail(datasourceId);
    }

    async function loadDatasourceDetail(datasourceId: string) {
        if (!selectedScorecardId) return;

        try {
            loadingDatasourceDetail = true;
            error = null;
            const response = await fetch(
                `/api/scorecards/${selectedScorecardId}/datasources/${datasourceId}`,
            );
            const data = await response.json();

            if (data.success) {
                selectedDatasource = data.datasource;
                editedDatasourceName = data.datasource.name;
                editedDatasourceSourceType = data.datasource.sourceType;
                editedDatasourceSampleData = data.datasource.dataSchema || "";

                // Convert ScorecardRule[] to EditableRule[] by serializing conditions
                const loadedRules: ScorecardRule[] = JSON.parse(
                    data.datasource.rules,
                );
                rules = loadedRules.map((rule) => ({
                    ...rule,
                    condition: serializeRPNExpression(rule.condition),
                    threshold_rules: rule.threshold_rules?.map((tr) => ({
                        condition: serializeRPNExpression(tr.condition),
                        severity: tr.severity,
                    })),
                }));
            } else {
                error = data.error || "Failed to load datasource";
            }
        } catch (e) {
            error = "Failed to load datasource";
            console.error("Error loading datasource:", e);
        } finally {
            loadingDatasourceDetail = false;
        }
    }

    async function saveDatasource() {
        if (
            !selectedDatasourceId ||
            !selectedScorecardId ||
            !editedDatasourceName.trim()
        )
            return;

        if (rules.length === 0) {
            error = "At least one rule is required";
            return;
        }

        try {
            saving = true;
            error = null;

            // Convert EditableRule[] to ScorecardRule[] by parsing conditions
            const parsedRules: ScorecardRule[] = rules.map((rule) => {
                try {
                    return {
                        ...rule,
                        condition: parseRPNString(rule.condition),
                        threshold_rules: rule.threshold_rules?.map((tr) => ({
                            condition: parseRPNString(
                                typeof tr.condition === "string"
                                    ? tr.condition
                                    : serializeRPNExpression(tr.condition),
                            ),
                            severity: tr.severity,
                        })),
                    };
                } catch (parseError) {
                    throw new Error(
                        `Invalid RPN expression in rule "${rule.title_template}": ${parseError instanceof Error ? parseError.message : String(parseError)}`,
                    );
                }
            });

            const response = await fetch(
                `/api/scorecards/${selectedScorecardId}/datasources/${selectedDatasourceId}`,
                {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        name: editedDatasourceName,
                        data_schema: editedDatasourceSampleData || null,
                        rules: parsedRules,
                        api_config: null,
                    }),
                },
            );

            const data = await response.json();

            if (data.success) {
                selectedDatasource = data.datasource;
                // Update in list
                datasources = datasources.map((d) =>
                    d.id === data.datasource.id ? data.datasource : d,
                );
            } else {
                error = data.error || "Failed to save datasource";
            }
        } catch (e) {
            error =
                e instanceof Error ? e.message : "Failed to save datasource";
            console.error("Error saving datasource:", e);
        } finally {
            saving = false;
        }
    }

    async function deleteDatasource(datasourceId: string, event: Event) {
        event.stopPropagation();

        if (!canEdit || !selectedScorecardId) return;

        toastStore.warning("Are you sure you want to delete this datasource?", {
            autoHide: false,
            actions: [
                {
                    label: "Delete",
                    onClick: async () => {
                        try {
                            const response = await fetch(
                                `/api/scorecards/${selectedScorecardId}/datasources/${datasourceId}`,
                                {
                                    method: "DELETE",
                                },
                            );

                            const data = await response.json();

                            if (data.success) {
                                datasources = datasources.filter(
                                    (d) => d.id !== datasourceId,
                                );
                                if (selectedDatasourceId === datasourceId) {
                                    selectedDatasourceId = null;
                                    selectedDatasource = null;
                                    rules = [];
                                }
                                toastStore.success("Datasource deleted successfully");
                            } else {
                                error = data.error || "Failed to delete datasource";
                                toastStore.error("Failed to delete datasource");
                            }
                        } catch (e) {
                            error = "Failed to delete datasource";
                            toastStore.error("Failed to delete datasource");
                            console.error("Error deleting datasource:", e);
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

    // Drag and drop for datasource reordering
    function handleDatasourceDragStart(index: number) {
        draggedDatasourceIndex = index;
    }

    function handleDatasourceDragOver(e: DragEvent) {
        e.preventDefault();
    }

    async function handleDatasourceDrop(e: DragEvent, dropIndex: number) {
        e.preventDefault();
        if (
            !selectedScorecardId ||
            draggedDatasourceIndex === null ||
            draggedDatasourceIndex === dropIndex
        ) {
            draggedDatasourceIndex = null;
            return;
        }

        // Reorder datasources array
        const reordered = [...datasources];
        const [movedItem] = reordered.splice(draggedDatasourceIndex, 1);
        reordered.splice(dropIndex, 0, movedItem);
        datasources = reordered;

        // Save new order to server
        try {
            const response = await fetch(
                `/api/scorecards/${selectedScorecardId}/datasources/reorder`,
                {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        datasource_ids: reordered.map((d) => d.id),
                    }),
                },
            );

            const data = await response.json();

            if (data.success) {
                datasources = data.datasources;
            } else {
                error = data.error || "Failed to reorder datasources";
                // Reload to get correct order
                if (selectedScorecardId) {
                    await loadScorecardDetail(selectedScorecardId);
                }
            }
        } catch (e) {
            error = "Failed to reorder datasources";
            console.error("Error reordering datasources:", e);
            // Reload to get correct order
            if (selectedScorecardId) {
                await loadScorecardDetail(selectedScorecardId);
            }
        } finally {
            draggedDatasourceIndex = null;
        }
    }

    // ============================================================================
    // Rule Management
    // ============================================================================

    function addRule() {
        const newRule: EditableRule = {
            id: `rule-${Date.now()}`,
            section: "Default Section",
            iterate_over: null,
            condition: "true",
            title_template: "New Rule",
            value_template: "",
            severity: "info",
        };
        rules = [...rules, newRule];
        editingRuleIndex = rules.length - 1;
    }

    function deleteRule(index: number) {
        rules = rules.filter((_, i) => i !== index);
        if (editingRuleIndex === index) {
            editingRuleIndex = null;
        }
    }

    function moveRuleUp(index: number) {
        if (index === 0) return;
        const newRules = [...rules];
        [newRules[index - 1], newRules[index]] = [
            newRules[index],
            newRules[index - 1],
        ];
        rules = newRules;
        if (editingRuleIndex === index) {
            editingRuleIndex = index - 1;
        } else if (editingRuleIndex === index - 1) {
            editingRuleIndex = index;
        }
    }

    function moveRuleDown(index: number) {
        if (index === rules.length - 1) return;
        const newRules = [...rules];
        [newRules[index], newRules[index + 1]] = [
            newRules[index + 1],
            newRules[index],
        ];
        rules = newRules;
        if (editingRuleIndex === index) {
            editingRuleIndex = index + 1;
        } else if (editingRuleIndex === index + 1) {
            editingRuleIndex = index;
        }
    }

    function addThresholdRule(ruleIndex: number) {
        const rule = rules[ruleIndex];
        if (!rule.threshold_rules) {
            rule.threshold_rules = [];
        }
        rule.threshold_rules = [
            ...rule.threshold_rules,
            {
                condition: "true",
                severity: "warning",
            },
        ];
        rules = [...rules]; // Trigger reactivity
    }

    function removeThresholdRule(ruleIndex: number, thresholdIndex: number) {
        const rule = rules[ruleIndex];
        if (!rule.threshold_rules) return;
        rule.threshold_rules = rule.threshold_rules.filter(
            (_, i) => i !== thresholdIndex,
        );
        rules = [...rules]; // Trigger reactivity
        saveDatasource(); // Save changes to database
    }

    function moveThresholdRuleUp(ruleIndex: number, thresholdIndex: number) {
        if (thresholdIndex === 0) return;
        const rule = rules[ruleIndex];
        if (!rule.threshold_rules) return;

        const newThresholdRules = [...rule.threshold_rules];
        [
            newThresholdRules[thresholdIndex - 1],
            newThresholdRules[thresholdIndex],
        ] = [
            newThresholdRules[thresholdIndex],
            newThresholdRules[thresholdIndex - 1],
        ];

        rule.threshold_rules = newThresholdRules;
        rules = [...rules]; // Trigger reactivity
        saveDatasource(); // Save changes to database
    }

    function moveThresholdRuleDown(ruleIndex: number, thresholdIndex: number) {
        const rule = rules[ruleIndex];
        if (
            !rule.threshold_rules ||
            thresholdIndex === rule.threshold_rules.length - 1
        )
            return;

        const newThresholdRules = [...rule.threshold_rules];
        [
            newThresholdRules[thresholdIndex],
            newThresholdRules[thresholdIndex + 1],
        ] = [
            newThresholdRules[thresholdIndex + 1],
            newThresholdRules[thresholdIndex],
        ];

        rule.threshold_rules = newThresholdRules;
        rules = [...rules]; // Trigger reactivity
        saveDatasource(); // Save changes to database
    }

    function openTestModal(ruleIndex: number, thresholdIndex: number | null = null) {
        testingRuleIndex = ruleIndex;
        testingThresholdIndex = thresholdIndex;
        showTestModal = true;
    }

    function handleSampleDataDragOver(e: DragEvent) {
        e.preventDefault();
        if (!canEdit) return;
        isDraggingSampleData = true;
    }

    function handleSampleDataDragLeave(e: DragEvent) {
        e.preventDefault();
        isDraggingSampleData = false;
    }

    async function handleSampleDataDrop(e: DragEvent) {
        e.preventDefault();
        isDraggingSampleData = false;

        if (!canEdit) return;

        const files = e.dataTransfer?.files;
        if (!files || files.length === 0) return;

        const file = files[0];
        const result = await parseFile(file);

        if (result.success && result.data) {
            // Convert parsed data back to formatted string for display
            editedDatasourceSampleData = JSON.stringify(result.data, null, 2);
            // Trigger save
            await saveDatasource();
        } else {
            toastStore.error(result.error || "Failed to parse file");
        }
    }

    function handleUpdateRuleFromTest(updatedRule: string) {
        if (testingRuleIndex !== null) {
            if (testingThresholdIndex !== null) {
                // Updating a threshold rule
                const rule = rules[testingRuleIndex];
                if (rule.threshold_rules && rule.threshold_rules[testingThresholdIndex]) {
                    rule.threshold_rules[testingThresholdIndex].condition = updatedRule;
                    rules = [...rules]; // Trigger reactivity
                    saveDatasource();
                }
            } else {
                // Updating a main rule
                rules[testingRuleIndex].condition = updatedRule;
                rules = [...rules]; // Trigger reactivity
                saveDatasource();
            }
        }
    }

    // ============================================================================
    // Lifecycle
    // ============================================================================

    onMount(() => {
        loadScorecards();
    });
</script>

<div class="scorecard-manager">
    {#if error}
        <div class="global-error">{error}</div>
    {/if}

    <!-- Left Panel: Scorecard List -->
    <div class="panel scorecard-list-panel">
        <div class="panel-header">
            <h2>Scorecards</h2>
        </div>
        <div class="panel-content">
            {#if loadingScorecards}
                <div class="loading-state">Loading scorecards...</div>
            {:else if scorecards.length === 0}
                <div class="empty-state">
                    <p>No scorecards yet.</p>
                    {#if canEdit}
                        <p>Create your first scorecard to get started.</p>
                    {/if}
                </div>
            {:else}
                <div class="list">
                    {#each scorecards as scorecard}
                        <div
                            class="list-item"
                            class:selected={selectedScorecardId ===
                                scorecard.id}
                            onclick={() => selectScorecard(scorecard.id)}
                        >
                            <div class="list-item-content">
                                <div class="list-item-title">
                                    {scorecard.name}
                                </div>
                                {#if scorecard.description}
                                    <div class="list-item-description">
                                        {scorecard.description}
                                    </div>
                                {/if}
                            </div>
                            {#if canEdit}
                                <button
                                    class="list-item-delete"
                                    onclick={(e) =>
                                        deleteScorecard(scorecard.id, e)}
                                    title="Delete scorecard"
                                >
                                    ×
                                </button>
                            {/if}
                        </div>
                    {/each}
                </div>
            {/if}
        </div>
        {#if canEdit}
            <div class="panel-footer">
                <button onclick={createScorecard} class="btn-primary">
                    + New Scorecard
                </button>
            </div>
        {/if}
    </div>

    <!-- Middle Panel: Scorecard Detail + Datasource List -->
    <div class="panel scorecard-detail-panel">
        {#if selectedScorecardId}
            {#if loadingScorecardDetail}
                <div class="loading-state">Loading scorecard details...</div>
            {:else if selectedScorecard}
                <div class="panel-header">
                    <h3>Scorecard Details</h3>
                </div>
                <div class="detail-section">
                    <div class="form-group">
                        <label for="scorecard-name">Name</label>
                        <input
                            id="scorecard-name"
                            type="text"
                            bind:value={editedScorecardName}
                            onblur={saveScorecard}
                            disabled={!canEdit}
                        />
                    </div>
                    <div class="form-group">
                        <label for="scorecard-description">Description</label>
                        <textarea
                            id="scorecard-description"
                            bind:value={editedScorecardDescription}
                            onblur={saveScorecard}
                            rows="2"
                            disabled={!canEdit}
                        ></textarea>
                    </div>
                </div>

                <div class="section-divider"></div>

                <div class="panel-subheader">
                    <h4>Datasources</h4>
                </div>
                <div class="panel-content">
                    {#if datasources.length === 0}
                        <div class="empty-state">
                            <p>No datasources configured.</p>
                            {#if canEdit}
                                <p>
                                    Add your first datasource to start tracking
                                    metrics.
                                </p>
                            {/if}
                        </div>
                    {:else}
                        <div class="list">
                            {#each datasources as datasource, index}
                                <div
                                    class="list-item"
                                    class:selected={selectedDatasourceId ===
                                        datasource.id}
                                    draggable={canEdit}
                                    ondragstart={() =>
                                        handleDatasourceDragStart(index)}
                                    ondragover={handleDatasourceDragOver}
                                    ondrop={(e) =>
                                        handleDatasourceDrop(e, index)}
                                    onclick={() =>
                                        selectDatasource(datasource.id)}
                                >
                                    {#if canEdit}
                                        <span class="drag-handle">⋮⋮</span>
                                    {/if}
                                    <div class="list-item-content">
                                        <div class="list-item-title">
                                            {datasource.name}
                                        </div>
                                        <div class="list-item-meta">
                                            {datasource.sourceType === "paste"
                                                ? "Manual Paste"
                                                : "API"} • {JSON.parse(
                                                datasource.rules,
                                            ).length} rule(s)
                                        </div>
                                    </div>
                                    {#if canEdit}
                                        <button
                                            class="list-item-delete"
                                            onclick={(e) =>
                                                deleteDatasource(
                                                    datasource.id,
                                                    e,
                                                )}
                                            title="Delete datasource"
                                        >
                                            ×
                                        </button>
                                    {/if}
                                </div>
                            {/each}
                        </div>
                    {/if}
                </div>
                {#if canEdit}
                    <div class="panel-footer">
                        <button onclick={createDatasource} class="btn-primary">
                            + Add Datasource
                        </button>
                    </div>
                {/if}
            {/if}
        {:else}
            <div class="empty-state-panel">
                <p>Select a scorecard from the list</p>
            </div>
        {/if}
    </div>

    <!-- Right Panel: Datasource Detail + Rules List -->
    <div class="panel datasource-detail-panel">
        {#if selectedDatasourceId}
            {#if loadingDatasourceDetail}
                <div class="loading-state">Loading datasource details...</div>
            {:else if selectedDatasource}
                <div class="panel-header">
                    <h3>Datasource Details</h3>
                </div>
                <div class="panel-content">
                    <div class="detail-section">
                        <div class="form-group">
                            <label for="datasource-name">Name</label>
                            <input
                                id="datasource-name"
                                type="text"
                                bind:value={editedDatasourceName}
                                onblur={saveDatasource}
                                disabled={!canEdit}
                            />
                        </div>
                        <div class="form-group">
                            <label for="source-type">Source Type</label>
                            <select
                                id="source-type"
                                bind:value={editedDatasourceSourceType}
                                onchange={saveDatasource}
                                disabled={!canEdit}
                            >
                                <option value="paste">Manual Paste</option>
                                <option value="api" disabled
                                    >API (Coming Soon)</option
                                >
                            </select>
                        </div>
                        <div class="form-group">
                            <label for="sample-data">Sample Data (JSON)</label>
                            <div
                                class="sample-data-wrapper"
                                class:dragging={isDraggingSampleData}
                                ondragover={handleSampleDataDragOver}
                                ondragleave={handleSampleDataDragLeave}
                                ondrop={handleSampleDataDrop}
                                role="region"
                                aria-label="Sample data input with file drop support"
                            >
                                <textarea
                                    id="sample-data"
                                    bind:value={editedDatasourceSampleData}
                                    onblur={saveDatasource}
                                    rows="6"
                                    placeholder={`{"cards": [{"id": 1}], "wip": 4}`}
                                    disabled={!canEdit}
                                ></textarea>
                                {#if isDraggingSampleData}
                                    <div class="drop-overlay">
                                        <div class="drop-message">📥 Drop JSON/YAML/CSV file here</div>
                                    </div>
                                {/if}
                            </div>
                            <small
                                >Provide sample JSON to see available paths for
                                iteration (or drag and drop JSON/YAML/CSV file)</small
                            >
                        </div>
                    </div>

                    <div class="section-divider"></div>

                    <div class="panel-subheader">
                        <h4>Rules</h4>
                    </div>

                    {#if rules.length === 0}
                        <div class="empty-state">
                            <p>No rules configured.</p>
                            {#if canEdit}
                                <p>
                                    Add a rule to define what data to display
                                    and how to evaluate it.
                                </p>
                            {/if}
                        </div>
                    {:else}
                        <div class="rules-list">
                            {#each rules as rule, index (rule.id)}
                                <div
                                    class="rule-card"
                                    class:expanded={editingRuleIndex === index}
                                >
                                    <div
                                        class="rule-header"
                                        onclick={() =>
                                            (editingRuleIndex =
                                                editingRuleIndex === index
                                                    ? null
                                                    : index)}
                                    >
                                        <span class="rule-number"
                                            >{index + 1}</span
                                        >
                                        <span class="rule-title"
                                            >{rule.title_template ||
                                                "Untitled Rule"}</span
                                        >
                                        <span
                                            class="rule-severity severity-{rule.severity}"
                                            >{rule.severity}</span
                                        >
                                        {#if canEdit}
                                            <div class="rule-controls">
                                                <button
                                                    type="button"
                                                    onclick={(e) => {
                                                        e.stopPropagation();
                                                        moveRuleUp(index);
                                                    }}
                                                    disabled={index === 0}
                                                    title="Move up"
                                                >
                                                    ↑
                                                </button>
                                                <button
                                                    type="button"
                                                    onclick={(e) => {
                                                        e.stopPropagation();
                                                        moveRuleDown(index);
                                                    }}
                                                    disabled={index ===
                                                        rules.length - 1}
                                                    title="Move down"
                                                >
                                                    ↓
                                                </button>
                                                <button
                                                    type="button"
                                                    onclick={(e) => {
                                                        e.stopPropagation();
                                                        deleteRule(index);
                                                    }}
                                                    class="btn-delete"
                                                    title="Delete"
                                                >
                                                    ×
                                                </button>
                                            </div>
                                        {/if}
                                    </div>

                                    {#if editingRuleIndex === index}
                                        <div class="rule-editor">
                                            <div class="form-group">
                                                <label>Iterate Over</label>
                                                <select
                                                    bind:value={
                                                        rule.iterate_over
                                                    }
                                                    onchange={saveDatasource}
                                                    disabled={!canEdit}
                                                >
                                                    <option value={null}
                                                        >Nothing (evaluate once)</option
                                                    >
                                                    {#each availablePaths as path (path)}
                                                        <option value={path}
                                                            >{path}</option
                                                        >
                                                    {/each}
                                                </select>
                                                <small
                                                    >Choose a path to iterate
                                                    over, or "Nothing" for a
                                                    single evaluation. {availablePaths.length ===
                                                    0
                                                        ? "Add sample data above to see available paths."
                                                        : ""}</small
                                                >
                                            </div>

                                            <div class="form-group">
                                                <label>Section</label>
                                                <input
                                                    type="text"
                                                    bind:value={rule.section}
                                                    onblur={saveDatasource}
                                                    disabled={!canEdit}
                                                    placeholder="e.g., Section A"
                                                />
                                                <small
                                                    >Section name for grouping
                                                    results. Supports templates
                                                    like <code
                                                        >{"{$.section}"}</code
                                                    ></small
                                                >
                                            </div>

                                            <div class="form-group">
                                                <label
                                                    >Condition (RPN Expression)</label
                                                >
                                                <div class="input-with-button">
                                                    <input
                                                        type="text"
                                                        bind:value={
                                                            rule.condition
                                                        }
                                                        onblur={saveDatasource}
                                                        placeholder="e.g., $.count 10 gt"
                                                        disabled={!canEdit}
                                                        class:validation-error={ruleValidations.get(
                                                            index,
                                                        ) &&
                                                            !ruleValidations.get(
                                                                index,
                                                            )!.valid}
                                                    />
                                                    <button
                                                        type="button"
                                                        class="btn-test"
                                                        onclick={() => openTestModal(index)}
                                                        title="Test this RPN rule"
                                                    >
                                                        🧪 Test
                                                    </button>
                                                    <button
                                                        type="button"
                                                        class="help-button"
                                                        onclick={() =>
                                                            (showRPNHelpModal = true)}
                                                        title="Show RPN operators help"
                                                    >
                                                        <Icon
                                                            name="info"
                                                            circle
                                                            size="sm"
                                                        />
                                                    </button>
                                                </div>
                                                {#if ruleValidations.get(index)}
                                                    {@const validation =
                                                        ruleValidations.get(
                                                            index,
                                                        )!}
                                                    {#if !validation.valid}
                                                        <div
                                                            class="validation-message error"
                                                        >
                                                            {validation.error}
                                                            {#if validation.details}
                                                                <div
                                                                    class="validation-details"
                                                                >
                                                                    {validation.details}
                                                                </div>
                                                            {/if}
                                                        </div>
                                                    {:else if validation.error}
                                                        <div
                                                            class="validation-message warning"
                                                        >
                                                            {validation.error}
                                                        </div>
                                                    {/if}
                                                {/if}
                                                <small
                                                    >Stack-based expression.
                                                    Example: "$.count 10 gt"
                                                    means count > 10</small
                                                >
                                            </div>

                                            <div class="form-group">
                                                <label>Title Template</label>
                                                <input
                                                    type="text"
                                                    bind:value={
                                                        rule.title_template
                                                    }
                                                    onblur={saveDatasource}
                                                    placeholder="Use {'{'}field{'}'} for interpolation"
                                                    disabled={!canEdit}
                                                />
                                            </div>

                                            <div class="form-group">
                                                <label
                                                    >Value Template (optional)</label
                                                >
                                                <input
                                                    type="text"
                                                    bind:value={
                                                        rule.value_template
                                                    }
                                                    onblur={saveDatasource}
                                                    placeholder="Primary value to display"
                                                    disabled={!canEdit}
                                                />
                                            </div>

                                            <div class="form-group">
                                                <label>Base Severity</label>
                                                <select
                                                    bind:value={rule.severity}
                                                    onchange={saveDatasource}
                                                    disabled={!canEdit}
                                                >
                                                    <option value="info"
                                                        >Info</option
                                                    >
                                                    <option value="warning"
                                                        >Warning</option
                                                    >
                                                    <option value="critical"
                                                        >Critical</option
                                                    >
                                                </select>
                                                <small
                                                    >Default severity when no
                                                    threshold rules match</small
                                                >
                                            </div>

                                            <div class="form-group">
                                                <label
                                                    >Threshold Rules (optional)</label
                                                >
                                                <small
                                                    >Override severity based on
                                                    additional conditions</small
                                                >

                                                {#if rule.threshold_rules && rule.threshold_rules.length > 0}
                                                    <div
                                                        class="threshold-rules-list"
                                                    >
                                                        {#each rule.threshold_rules as thresholdRule, thresholdIndex}
                                                            <div
                                                                class="threshold-rule-item"
                                                            >
                                                                <div
                                                                    class="threshold-rule-header"
                                                                >
                                                                    <span
                                                                        class="threshold-rule-number"
                                                                        >Threshold
                                                                        {thresholdIndex +
                                                                            1}</span
                                                                    >
                                                                    {#if canEdit}
                                                                        <div
                                                                            class="threshold-rule-controls"
                                                                        >
                                                                            <button
                                                                                onclick={() =>
                                                                                    moveThresholdRuleUp(
                                                                                        index,
                                                                                        thresholdIndex,
                                                                                    )}
                                                                                disabled={thresholdIndex ===
                                                                                    0}
                                                                                title="Move up"
                                                                                class="btn-control"
                                                                            >
                                                                                ↑
                                                                            </button>
                                                                            <button
                                                                                onclick={() =>
                                                                                    moveThresholdRuleDown(
                                                                                        index,
                                                                                        thresholdIndex,
                                                                                    )}
                                                                                disabled={thresholdIndex ===
                                                                                    rule
                                                                                        .threshold_rules!
                                                                                        .length -
                                                                                        1}
                                                                                title="Move down"
                                                                                class="btn-control"
                                                                            >
                                                                                ↓
                                                                            </button>
                                                                            <button
                                                                                onclick={() =>
                                                                                    removeThresholdRule(
                                                                                        index,
                                                                                        thresholdIndex,
                                                                                    )}
                                                                                class="btn-delete-small"
                                                                                title="Delete threshold rule"
                                                                            >
                                                                                ×
                                                                            </button>
                                                                        </div>
                                                                    {/if}
                                                                </div>

                                                                <div
                                                                    class="threshold-rule-fields"
                                                                >
                                                                    <div
                                                                        class="form-group-inline"
                                                                    >
                                                                        <label
                                                                            >Condition</label
                                                                        >
                                                                        <div class="input-with-button">
                                                                            <input
                                                                                type="text"
                                                                                bind:value={
                                                                                    thresholdRule.condition
                                                                                }
                                                                                onblur={saveDatasource}
                                                                                placeholder="e.g., get_json_value count 20 gt"
                                                                                disabled={!canEdit}
                                                                                class:validation-error={thresholdRuleValidations.get(
                                                                                    `${index}-${thresholdIndex}`,
                                                                                ) &&
                                                                                    !thresholdRuleValidations.get(
                                                                                        `${index}-${thresholdIndex}`,
                                                                                    )!
                                                                                        .valid}
                                                                            />
                                                                            <button
                                                                                type="button"
                                                                                class="btn-test-small"
                                                                                onclick={() => openTestModal(index, thresholdIndex)}
                                                                                title="Test threshold rule"
                                                                            >
                                                                                🧪
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                    {#if thresholdRuleValidations.get(`${index}-${thresholdIndex}`)}
                                                                        {@const validation =
                                                                            thresholdRuleValidations.get(
                                                                                `${index}-${thresholdIndex}`,
                                                                            )!}
                                                                        {#if !validation.valid}
                                                                            <div
                                                                                class="validation-message error"
                                                                            >
                                                                                {validation.error}
                                                                                {#if validation.details}
                                                                                    <div
                                                                                        class="validation-details"
                                                                                    >
                                                                                        {validation.details}
                                                                                    </div>
                                                                                {/if}
                                                                            </div>
                                                                        {:else if validation.error}
                                                                            <div
                                                                                class="validation-message warning"
                                                                            >
                                                                                {validation.error}
                                                                            </div>
                                                                        {/if}
                                                                    {/if}

                                                                    <div
                                                                        class="form-group-inline"
                                                                    >
                                                                        <label
                                                                            >Severity</label
                                                                        >
                                                                        <select
                                                                            bind:value={
                                                                                thresholdRule.severity
                                                                            }
                                                                            onchange={saveDatasource}
                                                                            disabled={!canEdit}
                                                                        >
                                                                            <option
                                                                                value="info"
                                                                                >Info</option
                                                                            >
                                                                            <option
                                                                                value="warning"
                                                                                >Warning</option
                                                                            >
                                                                            <option
                                                                                value="critical"
                                                                                >Critical</option
                                                                            >
                                                                        </select>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        {/each}
                                                    </div>
                                                {/if}

                                                {#if canEdit}
                                                    <button
                                                        onclick={() =>
                                                            addThresholdRule(
                                                                index,
                                                            )}
                                                        class="btn-secondary btn-small"
                                                    >
                                                        + Add Threshold Rule
                                                    </button>
                                                {/if}
                                            </div>
                                        </div>
                                    {/if}
                                </div>
                            {/each}
                        </div>
                    {/if}
                </div>
                {#if canEdit}
                    <div class="panel-footer">
                        <button onclick={addRule} class="btn-primary">
                            + Add Rule
                        </button>
                    </div>
                {/if}
            {/if}
        {:else}
            <div class="empty-state-panel">
                <p>Select a datasource from the list</p>
            </div>
        {/if}
    </div>
</div>

<!-- RPN Test Modal -->
<RPNTestModal
    show={showTestModal}
    initialRule={testingRuleIndex !== null
        ? (testingThresholdIndex !== null
            ? (rules[testingRuleIndex]?.threshold_rules?.[testingThresholdIndex]?.condition || '')
            : (rules[testingRuleIndex]?.condition || ''))
        : ''}
    initialData={editedDatasourceSampleData}
    initialIterateOver={testingRuleIndex !== null
        ? (rules[testingRuleIndex]?.iterate_over ?? null)
        : null}
    onClose={() => {
        showTestModal = false;
        testingRuleIndex = null;
        testingThresholdIndex = null;
    }}
    onUpdateRule={handleUpdateRuleFromTest}
/>

<!-- RPN Help Modal -->
<Modal
    show={showRPNHelpModal}
    title="RPN (Reverse Polish Notation) Operators"
    onClose={() => (showRPNHelpModal = false)}
    size="lg"
>
    {#snippet children()}
        <div class="rpn-help-content">
            <p class="rpn-intro">
                RPN expressions are evaluated using a stack. Values are pushed
                onto the stack, and operators pop values, perform operations,
                and push results back.
            </p>

            <h4>Data Access</h4>
            <div class="operator-list">
                <div class="operator-item">
                    <code>$</code>
                    <span
                        >Pushes the current iteration value (or root if not
                        iterating)</span
                    >
                </div>
                <div class="operator-item">
                    <code>$.field</code>
                    <span
                        >Pushes the value of "field" from the current iteration
                        context. Example: <code>$.count</code></span
                    >
                </div>
                <div class="operator-item">
                    <code>get path</code>
                    <span
                        >Pushes the value at the specified path. Takes the next
                        token as the path parameter. Example: <code
                            >get count</code
                        ></span
                    >
                </div>
                <div class="operator-item">
                    <code>literal value</code>
                    <span
                        >Pushes a literal value onto the stack. Takes the next
                        token as the value. Example: <code>literal "Hello"</code
                        ></span
                    >
                </div>
            </div>

            <h4>Stack Manipulation</h4>
            <div class="operator-list">
                <div class="operator-item">
                    <code>dup</code>
                    <span>Duplicates the top value on the stack</span>
                </div>
                <div class="operator-item">
                    <code>swap</code>
                    <span>Swaps the top two values on the stack</span>
                </div>
                <div class="operator-item">
                    <code>drop</code>
                    <span>Removes the top value from the stack</span>
                </div>
            </div>

            <h4>Comparison Operators</h4>
            <div class="operator-list">
                <div class="operator-item">
                    <code>eq</code>
                    <span
                        >Equals: Pops two values (b, a), pushes true if a === b</span
                    >
                </div>
                <div class="operator-item">
                    <code>ne</code>
                    <span
                        >Not equals: Pops two values (b, a), pushes true if a
                        !== b</span
                    >
                </div>
                <div class="operator-item">
                    <code>gt</code>
                    <span
                        >Greater than: Pops two values (b, a), pushes true if a
                        &gt; b</span
                    >
                </div>
                <div class="operator-item">
                    <code>gte</code>
                    <span
                        >Greater than or equal: Pops two values (b, a), pushes
                        true if a &gt;= b</span
                    >
                </div>
                <div class="operator-item">
                    <code>lt</code>
                    <span
                        >Less than: Pops two values (b, a), pushes true if a
                        &lt; b</span
                    >
                </div>
                <div class="operator-item">
                    <code>lte</code>
                    <span
                        >Less than or equal: Pops two values (b, a), pushes true
                        if a &lt;= b</span
                    >
                </div>
            </div>

            <h4>Logical Operators</h4>
            <div class="operator-list">
                <div class="operator-item">
                    <code>and</code>
                    <span
                        >Logical AND: Pops two values (b, a), pushes a
                        &amp;&amp; b</span
                    >
                </div>
                <div class="operator-item">
                    <code>or</code>
                    <span
                        >Logical OR: Pops two values (b, a), pushes a || b</span
                    >
                </div>
                <div class="operator-item">
                    <code>not</code>
                    <span>Logical NOT: Pops one value, pushes !value</span>
                </div>
            </div>

            <h4>Arithmetic Operators</h4>
            <div class="operator-list">
                <div class="operator-item">
                    <code>add</code>
                    <span>Addition: Pops two values (b, a), pushes a + b</span>
                </div>
                <div class="operator-item">
                    <code>sub</code>
                    <span
                        >Subtraction: Pops two values (b, a), pushes a - b</span
                    >
                </div>
                <div class="operator-item">
                    <code>mul</code>
                    <span
                        >Multiplication: Pops two values (b, a), pushes a * b</span
                    >
                </div>
                <div class="operator-item">
                    <code>div</code>
                    <span
                        >Division: Pops two values (b, a), pushes a / b (throws
                        error if b is 0)</span
                    >
                </div>
                <div class="operator-item">
                    <code>mod</code>
                    <span>Modulo: Pops two values (b, a), pushes a % b</span>
                </div>
            </div>

            <h4>String Operators</h4>
            <div class="operator-list">
                <div class="operator-item">
                    <code>concat</code>
                    <span
                        >Concatenation: Pops two values (b, a), pushes a + b as
                        strings</span
                    >
                </div>
                <div class="operator-item">
                    <code>contains</code>
                    <span
                        >Substring test: Pops two values (substring, string),
                        pushes true if string contains substring</span
                    >
                </div>
                <div class="operator-item">
                    <code>matches_regex</code>
                    <span
                        >Regex test: Pops two values (pattern, string), pushes
                        true if string matches the regex pattern</span
                    >
                </div>
            </div>

            <h4>Aggregation Functions</h4>
            <div class="operator-list">
                <div class="operator-item">
                    <code>count</code>
                    <span>Pops an array, pushes its length</span>
                </div>
                <div class="operator-item">
                    <code>sum</code>
                    <span>Pops an array of numbers, pushes their sum</span>
                </div>
                <div class="operator-item">
                    <code>avg</code>
                    <span>Pops an array of numbers, pushes their average</span>
                </div>
                <div class="operator-item">
                    <code>min</code>
                    <span
                        >Pops an array of numbers, pushes the minimum value</span
                    >
                </div>
                <div class="operator-item">
                    <code>max</code>
                    <span
                        >Pops an array of numbers, pushes the maximum value</span
                    >
                </div>
            </div>

            <h4>Date Functions</h4>
            <div class="operator-list">
                <div class="operator-item">
                    <code>days_since</code>
                    <span
                        >Pops a date string, pushes the number of days since
                        that date (ISO format)</span
                    >
                </div>
                <div class="operator-item">
                    <code>days_since_uk</code>
                    <span
                        >Pops a UK-formatted date string (DD/MMM/YY HH:mm
                        AM/PM), pushes the number of days since that date</span
                    >
                </div>
            </div>

            <h4>Examples</h4>
            <div class="example-list">
                <div class="example-item">
                    <code>$ 10 gt</code>
                    <span>True if the current value is greater than 10</span>
                </div>
                <div class="example-item">
                    <code>$.count 5 gte $.count 20 lte and</code>
                    <span>True if count is between 5 and 20 (inclusive)</span>
                </div>
                <div class="example-item">
                    <code>$.status literal "active" eq</code>
                    <span>True if status equals "active"</span>
                </div>
                <div class="example-item">
                    <code>$.items count 0 gt</code>
                    <span>True if items array has at least one element</span>
                </div>
                <div class="example-item">
                    <code>$.created_at days_since 30 lt</code>
                    <span>True if created within the last 30 days</span>
                </div>
            </div>
        </div>
    {/snippet}
</Modal>

<style lang="less">
    .scorecard-manager {
        display: flex;
        flex-direction: row;
        height: calc(100vh - 200px);
        gap: 0;
        background-color: var(--surface-elevated);
    }

    .global-error {
        position: fixed;
        top: var(--spacing-4);
        left: 50%;
        transform: translateX(-50%);
        padding: var(--spacing-3) var(--spacing-6);
        background-color: var(--status-error-bg);
        border: 1px solid color-mix(in srgb, var(--color-danger) 30%, transparent);
        border-radius: var(--radius-md);
        color: var(--status-error-text);
        z-index: 1000;
        box-shadow: var(--shadow-md);
    }

    /* Panel Structure */
    .panel {
        display: flex;
        flex-direction: column;
        background-color: var(--card-background);
        border-right: 1px solid var(--color-border);

        &:last-child {
            border-right: none;
        }
    }

    .scorecard-list-panel {
        flex: 0 0 300px;
    }

    .scorecard-detail-panel {
        flex: 0 0 400px;
    }

    .datasource-detail-panel {
        flex: 1 1 auto;

        .panel-content {
            overflow-y: auto;
            overflow-x: hidden;
        }
    }

    .panel-header {
        flex: 0 0 auto;
        padding: var(--spacing-4);
        border-bottom: 1px solid var(--color-border);
        background-color: var(--surface-elevated);

        h2,
        h3 {
            margin: 0;
            font-size: 1.25rem;
            font-weight: 600;
            color: var(--color-text-primary);
        }
    }

    .panel-subheader {
        flex: 0 0 auto;
        padding: var(--spacing-3) var(--spacing-4);
        background-color: var(--surface-elevated);
        border-bottom: 1px solid var(--color-border);

        h4 {
            margin: 0;
            font-size: 1rem;
            font-weight: 600;
            color: var(--color-text-primary);
        }
    }

    .panel-content {
        flex: 1;
        overflow-y: auto;
        overflow-x: hidden;
    }

    .panel-footer {
        flex: 0 0 auto;
        padding: var(--spacing-4);
        text-align: right;
        border-top: 1px solid var(--color-border);
        background-color: var(--surface-elevated);
    }

    .detail-section {
        padding: var(--spacing-4);
    }

    .section-divider {
        height: 8px;
        background-color: var(--surface-elevated);
        border-top: 1px solid var(--color-border);
        border-bottom: 1px solid var(--color-border);
    }

    /* List Items */
    .list {
        display: flex;
        flex-direction: column;
    }

    .list-item {
        display: flex;
        align-items: center;
        padding: var(--spacing-3) var(--spacing-4);
        border-bottom: 1px solid var(--color-border);
        cursor: pointer;
        transition: all var(--transition-fast);

        &:hover {
            background-color: var(--surface-elevated);
        }

        &.selected {
            background-color: color-mix(in srgb, var(--color-primary) 12%, transparent);
            border-left: 3px solid var(--color-primary);
        }
    }

    .list-item-content {
        flex: 1;
        min-width: 0;
    }

    .list-item-title {
        font-weight: 500;
        margin-bottom: var(--spacing-1);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        color: var(--color-text-primary);
    }

    .list-item-description,
    .list-item-meta {
        font-size: var(--text-sm);
        color: var(--color-text-secondary);
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .drag-handle {
        margin-right: var(--spacing-2);
        color: var(--color-text-muted);
        cursor: grab;
        font-size: 1rem;
    }

    .list-item:active .drag-handle {
        cursor: grabbing;
    }

    .list-item-delete {
        flex: 0 0 auto;
        background: none;
        border: none;
        font-size: 1.5rem;
        color: var(--color-text-muted);
        cursor: pointer;
        padding: 0 var(--spacing-2);
        margin-left: var(--spacing-2);
        line-height: 1;
        transition: color var(--transition-fast);

        &:hover {
            color: var(--color-danger);
        }
    }

    /* Empty States */
    .empty-state,
    .loading-state {
        padding: var(--spacing-8);
        text-align: center;
        color: var(--color-text-secondary);
    }

    .empty-state-panel {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100%;
        color: var(--color-text-muted);
        font-style: italic;
    }

    .empty-state p {
        margin: var(--spacing-2) 0;
    }

    /* Form Elements */
    .form-group {
        margin-bottom: var(--spacing-4);

        label {
            display: block;
            margin-bottom: var(--spacing-1);
            font-weight: 500;
            font-size: var(--text-sm);
            color: var(--color-text-primary);
        }

        input,
        select,
        textarea {
            width: 100%;
            padding: var(--spacing-2);
            border: 1px solid var(--color-border);
            border-radius: var(--radius-md);
            font-family: inherit;
            font-size: var(--text-sm);
            transition: all var(--transition-fast);

            &:focus {
                outline: none;
                border-color: var(--color-primary);
                box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 15%, transparent);
            }

            &:disabled {
                background-color: var(--surface-elevated);
                cursor: not-allowed;
            }
        }

        textarea {
            resize: vertical;
        }

        small {
            display: block;
            margin-top: var(--spacing-1);
            color: var(--color-text-secondary);
            font-size: 0.75rem;
        }
    }

    /* Sample data drag-and-drop */
    .sample-data-wrapper {
        position: relative;

        &.dragging {
            .drop-overlay {
                display: flex;
            }
        }

        textarea {
            font-family: "Monaco", "Menlo", "Ubuntu Mono", monospace;
            font-size: 0.8125rem;
            line-height: 1.5;
        }
    }

    .drop-overlay {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: color-mix(in srgb, var(--color-primary) 10%, transparent);
        border: 2px dashed var(--color-primary);
        border-radius: var(--radius-md);
        display: none;
        align-items: center;
        justify-content: center;
        pointer-events: none;
        z-index: 10;
    }

    .drop-message {
        background-color: white;
        padding: 1rem 1.5rem;
        border-radius: var(--radius-md);
        font-size: 0.9375rem;
        font-weight: 500;
        color: var(--color-primary);
        box-shadow: var(--shadow-md);
    }

    /* Validation feedback */
    .validation-error {
        border-color: var(--color-danger) !important;
        background-color: var(--status-error-bg) !important;

        &:focus {
            border-color: var(--color-danger) !important;
            box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-danger) 20%, transparent) !important;
        }
    }

    .validation-message {
        margin-top: var(--spacing-2);
        padding: var(--spacing-2);
        border-radius: var(--radius-md);
        font-size: var(--text-sm);

        &.error {
            background-color: var(--status-error-bg);
            border: 1px solid color-mix(in srgb, var(--color-danger) 30%, transparent);
            color: var(--status-error-text);
        }

        &.warning {
            background-color: var(--status-warning-bg);
            border: 1px solid color-mix(in srgb, var(--color-warning) 30%, transparent);
            color: var(--status-warning-text);
        }
    }

    .validation-details {
        margin-top: var(--spacing-1);
        font-size: 0.8125rem;
        opacity: 0.9;
    }

    /* Rules */
    .rules-list {
        display: flex;
        flex-direction: column;
        gap: var(--spacing-2);
        padding: var(--spacing-2);
    }

    .rule-card {
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        background-color: var(--card-background);
        overflow: hidden;
        transition: border-color var(--transition-fast);

        &.expanded {
            border-color: var(--color-primary);
        }
    }

    .rule-header {
        display: flex;
        align-items: center;
        padding: var(--spacing-3);
        cursor: pointer;
        background-color: var(--surface-elevated);
        gap: var(--spacing-2);
        transition: background-color var(--transition-fast);

        &:hover {
            background-color: var(--surface-hover);
        }
    }

    .rule-number {
        flex: 0 0 auto;
        width: 1.5rem;
        height: 1.5rem;
        display: flex;
        align-items: center;
        justify-content: center;
        background-color: var(--color-primary);
        color: var(--color-text-inverse);
        border-radius: 50%;
        font-size: 0.75rem;
        font-weight: 600;
    }

    .rule-title {
        flex: 1;
        font-weight: 500;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        color: var(--color-text-primary);
    }

    .rule-severity {
        flex: 0 0 auto;
        padding: var(--spacing-1) var(--spacing-2);
        border-radius: var(--radius-sm);
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
    }

    .severity-info {
        background-color: color-mix(in srgb, var(--color-info) 20%, transparent);
        color: var(--status-info-text);
    }

    .severity-warning {
        background-color: color-mix(in srgb, var(--color-warning) 20%, transparent);
        color: var(--status-warning-text);
    }

    .severity-critical {
        background-color: color-mix(in srgb, var(--color-danger) 20%, transparent);
        color: var(--status-error-text);
    }

    .rule-controls {
        flex: 0 0 auto;
        display: flex;
        gap: var(--spacing-1);

        button {
            background: var(--card-background);
            border: 1px solid var(--color-border);
            border-radius: var(--radius-sm);
            padding: var(--spacing-1) var(--spacing-2);
            cursor: pointer;
            font-size: var(--text-sm);
            transition: all var(--transition-fast);

            &:hover:not(:disabled) {
                background-color: var(--surface-elevated);
                border-color: var(--color-border-hover);
            }

            &:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }
        }

        .btn-delete {
            color: var(--color-danger);
            border-color: var(--color-danger);

            &:hover {
                background-color: var(--color-danger);
                color: var(--color-text-inverse);
            }
        }
    }

    .rule-editor {
        padding: var(--spacing-4);
        border-top: 1px solid var(--color-border);
        background-color: var(--card-background);
    }

    /* Buttons */
    .btn-primary {
        padding: var(--spacing-2) var(--spacing-4);
        background: var(--btn-primary-bg);
        color: var(--btn-primary-text);
        border: none;
        border-radius: var(--radius-md);
        cursor: pointer;
        font-size: var(--text-sm);
        font-weight: 500;
        transition: all var(--transition-fast);

        &:hover:not(:disabled) {
            background: var(--btn-primary-bg-hover);
            transform: translateY(-1px);
            box-shadow: var(--shadow-md);
        }

        &:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
    }

    .btn-secondary {
        padding: var(--spacing-2) var(--spacing-4);
        background: var(--btn-secondary-bg);
        color: var(--btn-secondary-text);
        border: none;
        border-radius: var(--radius-md);
        cursor: pointer;
        font-size: var(--text-sm);
        font-weight: 500;
        transition: all var(--transition-fast);

        &:hover:not(:disabled) {
            background: var(--btn-secondary-bg-hover);
            transform: translateY(-1px);
            box-shadow: var(--shadow-md);
        }

        &:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
    }

    .btn-small {
        padding: var(--spacing-1-5) var(--spacing-3);
        font-size: 0.8125rem;
    }

    /* Threshold Rules */
    .threshold-rules-list {
        display: flex;
        flex-direction: column;
        gap: var(--spacing-3);
        margin-top: var(--spacing-2);
        margin-bottom: var(--spacing-3);
    }

    .threshold-rule-item {
        border: 1px solid var(--color-border);
        border-radius: var(--radius-md);
        padding: var(--spacing-3);
        background-color: var(--surface-elevated);
    }

    .threshold-rule-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: var(--spacing-2);
    }

    .threshold-rule-number {
        font-weight: 600;
        font-size: var(--text-sm);
        color: var(--color-text-primary);
    }

    .threshold-rule-controls {
        display: flex;
        gap: var(--spacing-1);
        align-items: center;
    }

    .btn-control {
        background: var(--card-background);
        border: 1px solid var(--color-border);
        border-radius: var(--radius-sm);
        padding: 0.125rem var(--spacing-1-5);
        cursor: pointer;
        font-size: var(--text-sm);
        line-height: 1;
        color: var(--color-text-primary);
        transition: all var(--transition-fast);

        &:hover:not(:disabled) {
            background-color: var(--surface-elevated);
            border-color: var(--color-border-hover);
        }

        &:disabled {
            opacity: 0.3;
            cursor: not-allowed;
        }
    }

    .btn-delete-small {
        background: transparent;
        border: none;
        color: var(--color-danger);
        font-size: 1.5rem;
        line-height: 1;
        cursor: pointer;
        padding: 0;
        width: 1.5rem;
        height: 1.5rem;
        transition: color var(--transition-fast);

        &:hover {
            color: var(--color-danger-hover);
        }
    }

    .threshold-rule-fields {
        display: flex;
        flex-direction: column;
        gap: var(--spacing-2);
    }

    .form-group-inline {
        display: flex;
        flex-direction: column;
        gap: var(--spacing-1);

        label {
            font-size: 0.8125rem;
            font-weight: 600;
            color: var(--color-text-primary);
        }

        input,
        select {
            padding: var(--spacing-1-5) var(--spacing-2);
            border: 1px solid var(--color-border);
            border-radius: var(--radius-md);
            font-size: var(--text-sm);
            transition: all var(--transition-fast);

            &:focus {
                outline: none;
                border-color: var(--color-primary);
                box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 15%, transparent);
            }
        }
    }

    /* Input with Button Layout */
    .input-with-button {
        display: flex;
        gap: var(--spacing-2);
        align-items: center;

        input {
            flex: 1;
        }
    }

    .btn-test {
        padding: var(--spacing-2) var(--spacing-4);
        border: 1px solid var(--color-success);
        background-color: var(--color-success);
        color: var(--color-text-inverse);
        border-radius: var(--radius-md);
        cursor: pointer;
        font-size: var(--text-sm);
        font-weight: 500;
        white-space: nowrap;
        transition: all var(--transition-fast);

        &:hover {
            background-color: var(--color-success-hover);
            border-color: var(--color-success-hover);
            transform: translateY(-1px);
            box-shadow: var(--shadow-sm);
        }

        &:active {
            transform: translateY(0);
        }
    }

    .btn-test-small {
        padding: var(--spacing-1) var(--spacing-2);
        border: 1px solid var(--color-success);
        background-color: var(--color-success);
        color: var(--color-text-inverse);
        border-radius: var(--radius-sm);
        cursor: pointer;
        font-size: 0.75rem;
        white-space: nowrap;
        transition: all var(--transition-fast);

        &:hover {
            background-color: var(--color-success-hover);
            border-color: var(--color-success-hover);
            transform: translateY(-1px);
        }
    }

    .help-button {
        background: none;
        border: none;
        cursor: pointer;
        padding: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: opacity var(--transition-fast);

        &:hover {
            opacity: 0.7;
        }
    }

    /* RPN Help Modal Content */
    .rpn-help-content {
        font-size: 0.9375rem;
    }

    .rpn-intro {
        margin-bottom: var(--spacing-6);
        padding: var(--spacing-3);
        background-color: var(--surface-elevated);
        border-left: 3px solid var(--color-primary);
        line-height: 1.6;
        color: var(--color-text-primary);
    }

    .rpn-help-content h4 {
        margin-top: var(--spacing-6);
        margin-bottom: var(--spacing-3);
        font-size: 1.125rem;
        font-weight: 600;
        color: var(--color-text-primary);

        &:first-of-type {
            margin-top: 0;
        }
    }

    .operator-list,
    .example-list {
        display: flex;
        flex-direction: column;
        gap: var(--spacing-3);
        margin-bottom: var(--spacing-4);
    }

    .operator-item,
    .example-item {
        display: flex;
        flex-direction: column;
        gap: var(--spacing-1);
        padding: var(--spacing-3);
        background-color: var(--surface-elevated);
        border-radius: var(--radius-md);
        border: 1px solid var(--color-border);

        code {
            font-family: "Courier New", monospace;
            font-size: var(--text-sm);
            font-weight: 600;
            color: var(--color-primary);
            background-color: color-mix(in srgb, var(--color-primary) 10%, transparent);
            padding: var(--spacing-1) var(--spacing-2);
            border-radius: var(--radius-sm);
            align-self: flex-start;
        }

        span {
            color: var(--color-text-secondary);
            line-height: 1.5;
        }
    }
</style>
