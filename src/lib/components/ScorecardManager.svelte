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
                            <textarea
                                id="sample-data"
                                bind:value={editedDatasourceSampleData}
                                onblur={saveDatasource}
                                rows="6"
                                placeholder={`{"cards": [{"id": 1}], "wip": 4}`}
                                disabled={!canEdit}
                            ></textarea>
                            <small
                                >Provide sample JSON to see available paths for
                                iteration</small
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

<style>
    .scorecard-manager {
        display: flex;
        flex-direction: row;
        height: calc(100vh - 200px);
        gap: 0;
        background-color: #f8f9fa;
    }

    .global-error {
        position: fixed;
        top: 1rem;
        left: 50%;
        transform: translateX(-50%);
        padding: 0.75rem 1.5rem;
        background-color: #fee;
        border: 1px solid #fcc;
        border-radius: 4px;
        color: #c33;
        z-index: 1000;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    /* Panel Structure */
    .panel {
        display: flex;
        flex-direction: column;
        background-color: #fff;
        border-right: 1px solid #ddd;
    }

    .panel:last-child {
        border-right: none;
    }

    .scorecard-list-panel {
        flex: 0 0 300px;
    }

    .scorecard-detail-panel {
        flex: 0 0 400px;
    }

    .datasource-detail-panel {
        flex: 1 1 auto;
    }

    .datasource-detail-panel .panel-content {
        overflow-y: auto;
        overflow-x: hidden;
    }

    .panel-header {
        flex: 0 0 auto;
        padding: 1rem;
        border-bottom: 1px solid #ddd;
        background-color: #f8f9fa;
    }

    .panel-header h2,
    .panel-header h3 {
        margin: 0;
        font-size: 1.25rem;
        font-weight: 600;
    }

    .panel-subheader {
        flex: 0 0 auto;
        padding: 0.75rem 1rem;
        background-color: #f8f9fa;
        border-bottom: 1px solid #e9ecef;
    }

    .panel-subheader h4 {
        margin: 0;
        font-size: 1rem;
        font-weight: 600;
    }

    .panel-content {
        flex: 1;
        overflow-y: auto;
        overflow-x: hidden;
    }

    .panel-footer {
        flex: 0 0 auto;
        padding: 1rem;
        text-align: right;
        border-top: 1px solid #ddd;
        background-color: #f8f9fa;
    }

    .detail-section {
        padding: 1rem;
    }

    .section-divider {
        height: 8px;
        background-color: #f8f9fa;
        border-top: 1px solid #e9ecef;
        border-bottom: 1px solid #e9ecef;
    }

    /* List Items */
    .list {
        display: flex;
        flex-direction: column;
    }

    .list-item {
        display: flex;
        align-items: center;
        padding: 0.75rem 1rem;
        border-bottom: 1px solid #e9ecef;
        cursor: pointer;
        transition: background-color 0.2s;
    }

    .list-item:hover {
        background-color: #f8f9fa;
    }

    .list-item.selected {
        background-color: #e7f3ff;
        border-left: 3px solid #007bff;
    }

    .list-item-content {
        flex: 1;
        min-width: 0;
    }

    .list-item-title {
        font-weight: 500;
        margin-bottom: 0.25rem;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .list-item-description,
    .list-item-meta {
        font-size: 0.875rem;
        color: #666;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    .drag-handle {
        margin-right: 0.5rem;
        color: #999;
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
        color: #999;
        cursor: pointer;
        padding: 0 0.5rem;
        margin-left: 0.5rem;
        line-height: 1;
    }

    .list-item-delete:hover {
        color: #dc3545;
    }

    /* Empty States */
    .empty-state,
    .loading-state {
        padding: 2rem;
        text-align: center;
        color: #666;
    }

    .empty-state-panel {
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100%;
        color: #999;
        font-style: italic;
    }

    .empty-state p {
        margin: 0.5rem 0;
    }

    /* Form Elements */
    .form-group {
        margin-bottom: 1rem;
    }

    .form-group label {
        display: block;
        margin-bottom: 0.25rem;
        font-weight: 500;
        font-size: 0.875rem;
    }

    .form-group input,
    .form-group select,
    .form-group textarea {
        width: 100%;
        padding: 0.5rem;
        border: 1px solid #ddd;
        border-radius: 4px;
        font-family: inherit;
        font-size: 0.875rem;
    }

    .form-group input:focus,
    .form-group select:focus,
    .form-group textarea:focus {
        outline: none;
        border-color: #007bff;
        box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.1);
    }

    .form-group input:disabled,
    .form-group select:disabled,
    .form-group textarea:disabled {
        background-color: #f8f9fa;
        cursor: not-allowed;
    }

    .form-group textarea {
        resize: vertical;
    }

    .form-group small {
        display: block;
        margin-top: 0.25rem;
        color: #666;
        font-size: 0.75rem;
    }

    /* Validation feedback */
    .validation-error {
        border-color: #dc3545 !important;
        background-color: #fff5f5 !important;
    }

    .validation-error:focus {
        border-color: #dc3545 !important;
        box-shadow: 0 0 0 2px rgba(220, 53, 69, 0.2) !important;
    }

    .validation-message {
        margin-top: 0.5rem;
        padding: 0.5rem;
        border-radius: 4px;
        font-size: 0.875rem;
    }

    .validation-message.error {
        background-color: #fee;
        border: 1px solid #fcc;
        color: #c33;
    }

    .validation-message.warning {
        background-color: #fff8e1;
        border: 1px solid #ffe082;
        color: #856404;
    }

    .validation-details {
        margin-top: 0.25rem;
        font-size: 0.8125rem;
        opacity: 0.9;
    }

    /* Rules */
    .rules-list {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
        padding: 0.5rem;
    }

    .rule-card {
        border: 1px solid #ddd;
        border-radius: 4px;
        background-color: #fff;
        overflow: hidden;
    }

    .rule-card.expanded {
        border-color: #007bff;
    }

    .rule-header {
        display: flex;
        align-items: center;
        padding: 0.75rem;
        cursor: pointer;
        background-color: #f8f9fa;
        gap: 0.5rem;
    }

    .rule-header:hover {
        background-color: #e9ecef;
    }

    .rule-number {
        flex: 0 0 auto;
        width: 1.5rem;
        height: 1.5rem;
        display: flex;
        align-items: center;
        justify-content: center;
        background-color: #007bff;
        color: white;
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
    }

    .rule-severity {
        flex: 0 0 auto;
        padding: 0.25rem 0.5rem;
        border-radius: 3px;
        font-size: 0.75rem;
        font-weight: 600;
        text-transform: uppercase;
    }

    .severity-info {
        background-color: #d1ecf1;
        color: #0c5460;
    }

    .severity-warning {
        background-color: #fff3cd;
        color: #856404;
    }

    .severity-critical {
        background-color: #f8d7da;
        color: #721c24;
    }

    .rule-controls {
        flex: 0 0 auto;
        display: flex;
        gap: 0.25rem;
    }

    .rule-controls button {
        background: #fff;
        border: 1px solid #ddd;
        border-radius: 3px;
        padding: 0.25rem 0.5rem;
        cursor: pointer;
        font-size: 0.875rem;
    }

    .rule-controls button:hover:not(:disabled) {
        background-color: #f8f9fa;
        border-color: #aaa;
    }

    .rule-controls button:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .rule-controls .btn-delete {
        color: #dc3545;
        border-color: #dc3545;
    }

    .rule-controls .btn-delete:hover {
        background-color: #dc3545;
        color: white;
    }

    .rule-editor {
        padding: 1rem;
        border-top: 1px solid #ddd;
        background-color: #fff;
    }

    /* Buttons */
    .btn-primary {
        padding: 0.5rem 1rem;
        background-color: #007bff;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.875rem;
        font-weight: 500;
    }

    .btn-primary:hover:not(:disabled) {
        background-color: #0056b3;
    }

    .btn-primary:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .btn-secondary {
        padding: 0.5rem 1rem;
        background-color: #6c757d;
        color: white;
        border: none;
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.875rem;
        font-weight: 500;
    }

    .btn-secondary:hover:not(:disabled) {
        background-color: #5a6268;
    }

    .btn-secondary:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }

    .btn-small {
        padding: 0.375rem 0.75rem;
        font-size: 0.8125rem;
    }

    /* Threshold Rules */
    .threshold-rules-list {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        margin-top: 0.5rem;
        margin-bottom: 0.75rem;
    }

    .threshold-rule-item {
        border: 1px solid #ddd;
        border-radius: 4px;
        padding: 0.75rem;
        background-color: #f8f9fa;
    }

    .threshold-rule-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.5rem;
    }

    .threshold-rule-number {
        font-weight: 600;
        font-size: 0.875rem;
        color: #495057;
    }

    .threshold-rule-controls {
        display: flex;
        gap: 0.25rem;
        align-items: center;
    }

    .btn-control {
        background: #fff;
        border: 1px solid #ddd;
        border-radius: 3px;
        padding: 0.125rem 0.375rem;
        cursor: pointer;
        font-size: 0.875rem;
        line-height: 1;
        color: #495057;
    }

    .btn-control:hover:not(:disabled) {
        background-color: #f8f9fa;
        border-color: #aaa;
    }

    .btn-control:disabled {
        opacity: 0.3;
        cursor: not-allowed;
    }

    .btn-delete-small {
        background: transparent;
        border: none;
        color: #dc3545;
        font-size: 1.5rem;
        line-height: 1;
        cursor: pointer;
        padding: 0;
        width: 1.5rem;
        height: 1.5rem;
    }

    .btn-delete-small:hover {
        color: #a71d2a;
    }

    .threshold-rule-fields {
        display: flex;
        flex-direction: column;
        gap: 0.5rem;
    }

    .form-group-inline {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
    }

    .form-group-inline label {
        font-size: 0.8125rem;
        font-weight: 600;
        color: #495057;
    }

    .form-group-inline input,
    .form-group-inline select {
        padding: 0.375rem 0.5rem;
        border: 1px solid #ced4da;
        border-radius: 4px;
        font-size: 0.875rem;
    }

    .form-group-inline input:focus,
    .form-group-inline select:focus {
        outline: none;
        border-color: #80bdff;
        box-shadow: 0 0 0 0.2rem rgba(0, 123, 255, 0.25);
    }

    /* Input with Button Layout */
    .input-with-button {
        display: flex;
        gap: 0.5rem;
        align-items: center;
    }

    .input-with-button input {
        flex: 1;
    }

    .btn-test {
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
    }

    .btn-test:hover {
        background-color: #218838;
        border-color: #1e7e34;
    }

    .btn-test:active {
        transform: translateY(1px);
    }

    .btn-test-small {
        padding: 0.25rem 0.5rem;
        border: 1px solid #28a745;
        background-color: #28a745;
        color: white;
        border-radius: 3px;
        cursor: pointer;
        font-size: 0.75rem;
        white-space: nowrap;
        transition: all 0.2s ease;
    }

    .btn-test-small:hover {
        background-color: #218838;
        border-color: #1e7e34;
    }

    .help-button {
        background: none;
        border: none;
        cursor: pointer;
        padding: 0;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: opacity 0.2s;
    }

    .help-button:hover {
        opacity: 0.7;
    }

    /* RPN Help Modal Content */
    .rpn-help-content {
        font-size: 0.9375rem;
    }

    .rpn-intro {
        margin-bottom: 1.5rem;
        padding: 0.75rem;
        background-color: #f8f9fa;
        border-left: 3px solid #007bff;
        line-height: 1.6;
    }

    .rpn-help-content h4 {
        margin-top: 1.5rem;
        margin-bottom: 0.75rem;
        font-size: 1.125rem;
        font-weight: 600;
        color: #343a40;
    }

    .rpn-help-content h4:first-of-type {
        margin-top: 0;
    }

    .operator-list,
    .example-list {
        display: flex;
        flex-direction: column;
        gap: 0.75rem;
        margin-bottom: 1rem;
    }

    .operator-item,
    .example-item {
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        padding: 0.75rem;
        background-color: #f8f9fa;
        border-radius: 4px;
        border: 1px solid #dee2e6;
    }

    .operator-item code,
    .example-item code {
        font-family: "Courier New", monospace;
        font-size: 0.875rem;
        font-weight: 600;
        color: #0056b3;
        background-color: #e7f1ff;
        padding: 0.25rem 0.5rem;
        border-radius: 3px;
        align-self: flex-start;
    }

    .operator-item span,
    .example-item span {
        color: #495057;
        line-height: 1.5;
    }
</style>
