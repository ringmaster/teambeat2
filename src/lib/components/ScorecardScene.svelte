<script lang="ts">
import { onMount } from "svelte";
import { toastStore } from "$lib/stores/toast";
import type { Board, Scene } from "$lib/types";
import type {
	SceneScorecard,
	SceneScorecardResult,
} from "$lib/types/scorecard";
import {
	type DataFormat,
	needsArrayWrapping,
	parseData,
	parseFile,
	wrapArray,
} from "$lib/utils/data-parser";
import Icon from "./ui/Icon.svelte";

interface Props {
	sceneId: string;
	boardId: string;
	board: Board;
	scene: Scene;
	canEdit: boolean;
	userRole: string;
}

let { sceneId, boardId, board, scene, canEdit, userRole }: Props = $props();

let sceneScorecards = $state<SceneScorecard[]>([]);
let allResults = $state<SceneScorecardResult[]>([]);
let loading = $state(true);
let processing = $state(false);
let error = $state<string | null>(null);
let showDataDialog = $state(false);
let dataInputs = $state<Record<string, string>>({});
let uploadedFiles = $state<Record<string, File | null>>({});
let parsedData = $state<Record<string, any>>({});
let parseErrors = $state<Record<string, string | null>>({});
let dragOver = $state<Record<string, boolean>>({});
let processedAt = $state<string | null>(null);
let collectedDataByScorecard = $state<Record<string, Record<string, any>>>({});
let dropdownOpen = $state<string | null>(null);

// Combine results from all scorecards, grouping by section
let resultsBySection = $derived(() => {
	const grouped: Record<string, SceneScorecardResult[]> = {};

	allResults.forEach((result) => {
		if (!grouped[result.section]) {
			grouped[result.section] = [];
		}
		grouped[result.section].push(result);
	});

	return grouped;
});

// Get visible columns for dropdown
const visibleColumns = $derived(() => {
	if (!board.columns || !scene.id) return [];
	const hiddenColumnIds = board.hiddenColumnsByScene?.[scene.id] || [];
	return board.columns.filter((col) => !hiddenColumnIds.includes(col.id));
});

async function loadSceneScorecards() {
	try {
		loading = true;
		error = null;
		const response = await fetch(`/api/scenes/${sceneId}/scorecards`);
		const data = await response.json();

		if (data.success) {
			sceneScorecards = data.sceneScorecards;
			if (sceneScorecards.length > 0) {
				await loadAllResults();
			}
		} else {
			error = data.error || "Failed to load scorecards";
		}
	} catch (e) {
		error = "Failed to load scorecards";
		console.error("Error loading scorecards:", e);
	} finally {
		loading = false;
	}
}

async function loadAllResults() {
	try {
		const allResultsTemp: SceneScorecardResult[] = [];
		const collectedDataTemp: Record<string, Record<string, any>> = {};
		let latestProcessedAt: string | null = null;

		for (const sceneScorecard of sceneScorecards) {
			const response = await fetch(
				`/api/scene-scorecards/${sceneScorecard.id}/results`,
			);
			const data = await response.json();

			if (data.success) {
				allResultsTemp.push(...data.results);

				if (data.collectedData) {
					collectedDataTemp[sceneScorecard.id] = JSON.parse(data.collectedData);
				}

				// Track the latest processedAt
				if (data.processedAt) {
					if (
						!latestProcessedAt ||
						new Date(data.processedAt) > new Date(latestProcessedAt)
					) {
						latestProcessedAt = data.processedAt;
					}
				}
			}
		}

		allResults = allResultsTemp;
		collectedDataByScorecard = collectedDataTemp;
		processedAt = latestProcessedAt;
	} catch (e) {
		error = "Failed to load results";
		console.error("Error loading results:", e);
	}
}

function openDataDialog() {
	if (sceneScorecards.length === 0) return;

	// Initialize data inputs for all datasources across all scorecards
	const inputs: Record<string, string> = {};
	sceneScorecards.forEach((ss) => {
		ss.datasources?.forEach((ds) => {
			inputs[`${ss.id}-${ds.id}`] = "";
		});
	});
	dataInputs = inputs;
	showDataDialog = true;
}

function loadPreviousData() {
	if (Object.keys(collectedDataByScorecard).length === 0) return;

	const inputs: Record<string, string> = {};
	sceneScorecards.forEach((ss) => {
		const collectedData = collectedDataByScorecard[ss.id];
		ss.datasources?.forEach((ds) => {
			if (collectedData?.[ds.id]) {
				inputs[`${ss.id}-${ds.id}`] = JSON.stringify(
					collectedData[ds.id],
					null,
					2,
				);
			} else {
				inputs[`${ss.id}-${ds.id}`] = "";
			}
		});
	});
	dataInputs = inputs;
}

async function handleFileUpload(key: string, file: File) {
	uploadedFiles[key] = file;
	parseErrors[key] = null;

	// Parse the file
	const result = await parseFile(file);

	if (result.success && result.data) {
		parsedData[key] = result.data;
		dataInputs[key] = ""; // Clear text input when file is uploaded
	} else {
		parseErrors[key] = result.error || "Failed to parse file";
		uploadedFiles[key] = null;
	}
}

async function handleFileDrop(key: string, event: DragEvent) {
	event.preventDefault();
	dragOver[key] = false;

	const files = event.dataTransfer?.files;
	if (files && files.length > 0) {
		await handleFileUpload(key, files[0]);
	}
}

function handleDragOver(key: string, event: DragEvent) {
	event.preventDefault();
	dragOver[key] = true;
}

function handleDragLeave(key: string) {
	dragOver[key] = false;
}

function clearFile(key: string) {
	uploadedFiles[key] = null;
	parsedData[key] = undefined;
	parseErrors[key] = null;
}

async function handleTextInput(key: string, value: string) {
	dataInputs[key] = value;

	// Clear file if text is entered
	if (value.trim() && uploadedFiles[key]) {
		uploadedFiles[key] = null;
		parsedData[key] = undefined;
	}

	// Try to parse the text input
	if (value.trim()) {
		const result = parseData(value);
		if (result.success && result.data) {
			parsedData[key] = result.data;
			parseErrors[key] = null;
		} else {
			parseErrors[key] = result.error || null;
		}
	} else {
		parsedData[key] = undefined;
		parseErrors[key] = null;
	}
}

async function processData() {
	try {
		processing = true;
		error = null;

		// Process each scorecard separately
		for (const ss of sceneScorecards) {
			const datasourceData: Record<string, any> = {};

			ss.datasources?.forEach((ds) => {
				const key = `${ss.id}-${ds.id}`;

				// Use parsed data if available (from file upload or text input)
				if (parsedData[key]) {
					datasourceData[ds.id] = parsedData[key];
				} else {
					// Fallback to raw text input for backward compatibility
					const jsonStr = dataInputs[key];
					if (jsonStr?.trim()) {
						try {
							datasourceData[ds.id] = JSON.parse(jsonStr);
						} catch (e) {
							throw new Error(
								`Invalid JSON for ${ss.scorecard.name} - ${ds.name}`,
							);
						}
					}
				}
			});

			const response = await fetch(
				`/api/scene-scorecards/${ss.id}/collect-data`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						datasource_data: datasourceData,
					}),
				},
			);

			const data = await response.json();

			if (!data.success) {
				throw new Error(data.error || `Failed to process ${ss.scorecard.name}`);
			}
		}

		showDataDialog = false;
		await loadAllResults();
		toastStore.success("Data processed successfully");
	} catch (e) {
		error = e instanceof Error ? e.message : "Failed to process data";
		toastStore.error(error);
		console.error("Error processing data:", e);
	} finally {
		processing = false;
	}
}

async function rerunProcessing() {
	if (Object.keys(collectedDataByScorecard).length === 0) {
		toastStore.error("No previous data to reprocess");
		return;
	}

	try {
		processing = true;
		error = null;

		for (const ss of sceneScorecards) {
			const collectedData = collectedDataByScorecard[ss.id];
			if (!collectedData) continue;

			const response = await fetch(
				`/api/scene-scorecards/${ss.id}/collect-data`,
				{
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						datasource_data: collectedData,
					}),
				},
			);

			const data = await response.json();

			if (!data.success) {
				throw new Error(
					data.error || `Failed to reprocess ${ss.scorecard.name}`,
				);
			}
		}

		await loadAllResults();
		toastStore.success("Data reprocessed successfully");
	} catch (e) {
		error = e instanceof Error ? e.message : "Failed to reprocess data";
		toastStore.error(error);
		console.error("Error reprocessing data:", e);
	} finally {
		processing = false;
	}
}

async function copyToCard(result: SceneScorecardResult, columnId: string) {
	try {
		const response = await fetch(
			`/api/scene-scorecard-results/${result.id}/flag`,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ column_id: columnId }),
			},
		);

		const data = await response.json();

		if (data.success) {
			toastStore.success("Result copied to card");
			dropdownOpen = null;
		} else {
			toastStore.error(data.error || "Failed to copy to card");
		}
	} catch (e) {
		toastStore.error("Failed to copy to card");
		console.error("Error copying to card:", e);
	}
}

function closeDropdown() {
	dropdownOpen = null;
}

function clickOutside(node: HTMLElement, handler: () => void) {
	const handleClick = (event: MouseEvent) => {
		if (node && !node.contains(event.target as Node)) {
			handler();
		}
	};

	document.addEventListener("click", handleClick, true);

	return {
		destroy() {
			document.removeEventListener("click", handleClick, true);
		},
	};
}

onMount(() => {
	loadSceneScorecards();
});
</script>

<div class="scorecard-scene-wrapper">
    {#if loading}
        <div class="loading">Loading scorecards...</div>
    {:else if sceneScorecards.length === 0}
        <div class="empty-state">
            <p>No scorecard attached to this scene.</p>
            {#if canEdit}
                <p>Attach a scorecard in the board configuration.</p>
            {/if}
        </div>
    {:else}
        <!-- Toolbar -->
        <div class="scorecard-toolbar">
            <div class="scorecard-toolbar-content page-width page-container">
                <div class="toolbar-left">
                    {#if processedAt}
                        <span class="processed-info">
                            Last processed: {new Date(
                                processedAt,
                            ).toLocaleString()}
                        </span>
                    {/if}
                </div>

                <div class="toolbar-right">
                    {#if canEdit}
                        <a
                            href="/series/{board.seriesId}/scorecards?boardId={boardId}"
                            class="toolbar-btn"
                        >
                            <Icon name="settings" size="sm" />
                            <span>Configure Scorecards</span>
                        </a>
                        {#if Object.keys(collectedDataByScorecard).length > 0}
                            <button
                                onclick={rerunProcessing}
                                disabled={processing}
                                class="toolbar-btn"
                            >
                                {#if processing}
                                    <Icon name="loading" size="sm" />
                                {:else}
                                    <Icon name="reset" size="sm" />
                                {/if}
                                <span>Re-Run Processing</span>
                            </button>
                        {/if}
                        <button
                            onclick={openDataDialog}
                            class="toolbar-btn primary"
                        >
                            Collect Data
                        </button>
                    {/if}
                </div>
            </div>
        </div>

        {#if error}
            <div class="error-message">{error}</div>
        {/if}

        <!-- Results Container -->
        <div class="scorecard-scene">
            {#if allResults.length === 0}
                <div class="empty-state">
                    <p>No data collected yet.</p>
                    {#if canEdit}
                        <p>
                            Click "Collect Data" to paste data and process
                            rules.
                        </p>
                    {/if}
                </div>
            {:else}
                {#each Object.entries(resultsBySection()) as [section, sectionResults]}
                    <div class="section">
                        <h3>{section}</h3>
                        <div class="results-grid">
                            {#each sectionResults as result}
                                <div
                                    class="result-card severity-{result.severity}"
                                >
                                    <div class="result-header">
                                        <span class="result-title"
                                            >{result.title}</span
                                        >
                                        <div class="result-severity-container">
                                            <span class="result-severity"
                                                >{result.severity}</span
                                            >
                                            {#if canEdit && visibleColumns().length > 0}
                                                <div
                                                    class="result-menu"
                                                    use:clickOutside={closeDropdown}
                                                >
                                                    <button
                                                        class="icon-button"
                                                        onclick={() =>
                                                            (dropdownOpen =
                                                                dropdownOpen ===
                                                                result.id
                                                                    ? null
                                                                    : result.id)}
                                                        title="Copy to column"
                                                    >
                                                        <Icon
                                                            name="menu"
                                                            size="sm"
                                                        />
                                                    </button>
                                                    {#if dropdownOpen === result.id}
                                                        <div
                                                            class="dropdown-menu"
                                                        >
                                                            <div
                                                                class="dropdown-header"
                                                            >
                                                                Copy to column:
                                                            </div>
                                                            {#each visibleColumns() as column}
                                                                <button
                                                                    class="dropdown-item"
                                                                    onclick={() =>
                                                                        copyToCard(
                                                                            result,
                                                                            column.id,
                                                                        )}
                                                                >
                                                                    {column.title}
                                                                </button>
                                                            {/each}
                                                        </div>
                                                    {/if}
                                                </div>
                                            {/if}
                                        </div>
                                    </div>
                                    {#if result.primaryValue}
                                        <div class="result-value">
                                            {result.primaryValue}
                                        </div>
                                    {/if}
                                    {#if result.secondaryValues}
                                        <div class="result-secondary">
                                            {#each JSON.parse(result.secondaryValues) as value}
                                                <span class="secondary-value"
                                                    >{value}</span
                                                >
                                            {/each}
                                        </div>
                                    {/if}
                                </div>
                            {/each}
                        </div>
                    </div>
                {/each}
            {/if}
        </div>
    {/if}

    {#if showDataDialog}
        <div class="dialog-overlay" onclick={() => (showDataDialog = false)}>
            <div class="dialog" onclick={(e) => e.stopPropagation()}>
                <div class="dialog-header">
                    <h3>Collect Data</h3>
                    {#if Object.keys(collectedDataByScorecard).length > 0}
                        <button
                            type="button"
                            onclick={loadPreviousData}
                            class="btn-secondary btn-small"
                        >
                            Load Previous Data
                        </button>
                    {/if}
                </div>
                <p>
                    Paste or upload JSON, CSV, or YAML data for each datasource
                    below:
                </p>

                <form
                    onsubmit={(e) => {
                        e.preventDefault();
                        processData();
                    }}
                >
                    {#each sceneScorecards as ss}
                        {#if sceneScorecards.length > 1}
                            <div class="scorecard-section-header">
                                <h4>{ss.scorecard.name}</h4>
                            </div>
                        {/if}
                        {#each ss.datasources || [] as datasource}
                            {@const key = `${ss.id}-${datasource.id}`}
                            <div class="form-group">
                                <label>
                                    {datasource.name}
                                    {#if uploadedFiles[key]}
                                        <span class="file-badge">
                                            <Icon name="file" size="sm" />
                                            {uploadedFiles[key].name} ({(
                                                uploadedFiles[key].size / 1024
                                            ).toFixed(1)} KB)
                                            <button
                                                type="button"
                                                class="clear-file-btn"
                                                onclick={() => clearFile(key)}
                                                title="Clear file"
                                            >
                                                <Icon name="close" size="xs" />
                                            </button>
                                        </span>
                                    {/if}
                                </label>

                                <div class="textarea-wrapper">
                                    <textarea
                                        value={dataInputs[key] || ""}
                                        oninput={(e) =>
                                            handleTextInput(
                                                key,
                                                e.currentTarget.value,
                                            )}
                                        ondrop={(e) => handleFileDrop(key, e)}
                                        ondragover={(e) =>
                                            handleDragOver(key, e)}
                                        ondragleave={() => handleDragLeave(key)}
                                        class:drag-over={dragOver[key]}
                                        placeholder="Paste or drag & drop JSON, CSV, or YAML data here"
                                        rows="6"
                                        disabled={!!uploadedFiles[key]}
                                    ></textarea>
                                    {#if !uploadedFiles[key]}
                                        <div class="file-upload-overlay">
                                            <input
                                                type="file"
                                                accept=".json,.csv,.yaml,.yml"
                                                id="file-{key}"
                                                onchange={(e) => {
                                                    const file =
                                                        e.currentTarget
                                                            .files?.[0];
                                                    if (file)
                                                        handleFileUpload(
                                                            key,
                                                            file,
                                                        );
                                                }}
                                                style="display: none"
                                            />
                                            <label
                                                for="file-{key}"
                                                class="btn-secondary btn-small"
                                            >
                                                Choose File
                                            </label>
                                        </div>
                                    {/if}
                                </div>

                                <small class="help-text"
                                    >Supports JSON, CSV, YAML (max 10 MB)</small
                                >

                                {#if parseErrors[key]}
                                    <div class="parse-error">
                                        <Icon name="alert" size="sm" />
                                        {parseErrors[key]}
                                    </div>
                                {/if}
                            </div>
                        {/each}
                    {/each}

                    <div class="dialog-actions">
                        <button
                            type="button"
                            onclick={() => (showDataDialog = false)}
                            class="btn-secondary"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={processing}
                            class="btn-primary"
                        >
                            {processing ? "Processing..." : "Process Data"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    {/if}
</div>

<style lang="less">
    @import "$lib/styles/_mixins.less";

    .scorecard-scene-wrapper {
        .page-container();
        display: flex;
        flex-direction: column;
        height: 100%;
    }

    .scorecard-toolbar {
        background-color: var(--surface-secondary);
        border-top: 1px solid var(--surface-tertiary);
        border-bottom: 1px solid var(--surface-tertiary);
        padding: var(--spacing-3) var(--spacing-4);
        flex-shrink: 0;
    }

    .scorecard-toolbar-content {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: var(--spacing-4);
    }

    .toolbar-left {
        display: flex;
        align-items: center;
        gap: var(--spacing-3);
    }

    .toolbar-right {
        display: flex;
        align-items: center;
        gap: var(--spacing-2);
    }

    .processed-info {
        font-size: var(--text-sm);
        color: var(--text-secondary);
    }

    .toolbar-btn {
        display: flex;
        align-items: center;
        gap: var(--spacing-2);
        padding: var(--spacing-2) var(--spacing-3);
        border: 1px solid var(--surface-tertiary);
        background-color: var(--surface-primary);
        color: var(--text-primary);
        border-radius: var(--radius-md);
        cursor: pointer;
        font-size: var(--text-sm);
        font-weight: 500;
        transition: all 0.2s ease;
        text-decoration: none;

        &:hover:not(:disabled) {
            background-color: var(--surface-secondary);
            border-color: var(--color-primary);
        }

        &:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }

        &.primary {
            background-color: var(--color-primary);
            color: white;
            border-color: var(--color-primary);

            &:hover:not(:disabled) {
                background-color: color-mix(
                    in srgb,
                    var(--color-primary) 90%,
                    black
                );
            }
        }
    }

    .scorecard-scene {
        padding: 0 var(--spacing-6) var(--spacing-6) var(--spacing-6);
        overflow-y: auto;
    }

    .loading,
    .empty-state {
        text-align: center;
        padding: 3rem;
        color: var(--text-secondary);
    }

    .error-message {
        padding: var(--spacing-3);
        background-color: color-mix(
            in srgb,
            var(--color-danger) 10%,
            transparent
        );
        border: 1px solid
            color-mix(in srgb, var(--color-danger) 30%, transparent);
        border-radius: var(--radius-md);
        color: var(--color-danger);
        margin: var(--spacing-4);
    }

    .section {
        margin-bottom: var(--spacing-8);

        h3 {
            position: sticky;
            top: 0;
            margin: 0 0 var(--spacing-4) 0;
            font-size: var(--text-xl);
            padding-bottom: var(--spacing-2);
            padding-top: var(--spacing-2);
            border-bottom: 2px solid var(--color-primary);
            background-color: var(--surface-primary);
            z-index: 10;
        }
    }

    .results-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(min(100%, 400px), 1fr));
        gap: var(--spacing-4);
    }

    .result-card {
        border: 2px solid var(--surface-tertiary);
        border-radius: var(--radius-lg);
        padding: var(--spacing-4);
        background-color: var(--surface-primary);
        transition:
            transform 0.2s ease,
            box-shadow 0.2s ease;

        &:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
        }

        &.severity-warning {
            border-color: var(--color-warning);
            background-color: color-mix(
                in srgb,
                var(--color-warning) 5%,
                var(--surface-primary)
            );
        }

        &.severity-critical {
            border-color: var(--color-danger);
            background-color: color-mix(
                in srgb,
                var(--color-danger) 5%,
                var(--surface-primary)
            );
        }
    }

    .result-header {
        display: flex;
        justify-content: space-between;
        align-items: flex-start;
        margin-bottom: var(--spacing-2);
        gap: var(--spacing-2);
    }

    .result-title {
        font-weight: 600;
        font-size: var(--text-base);
        flex: 1;
    }

    .result-severity-container {
        display: flex;
        align-items: center;
        gap: var(--spacing-1);
        flex-shrink: 0;
    }

    .result-severity {
        padding: 0.25rem 0.5rem;
        border-radius: var(--radius-sm);
        font-size: var(--text-xs);
        font-weight: 600;
        text-transform: uppercase;
        white-space: nowrap;
    }

    .severity-info .result-severity {
        background-color: color-mix(
            in srgb,
            var(--color-info) 20%,
            transparent
        );
        color: var(--color-info);
    }

    .severity-warning .result-severity {
        background-color: color-mix(
            in srgb,
            var(--color-warning) 20%,
            transparent
        );
        color: color-mix(in srgb, var(--color-warning) 70%, black);
    }

    .severity-critical .result-severity {
        background-color: color-mix(
            in srgb,
            var(--color-danger) 20%,
            transparent
        );
        color: var(--color-danger);
    }

    .result-value {
        font-size: var(--text-2xl);
        font-weight: normal;
        margin: var(--spacing-2) 0;
        color: var(--text-primary);
    }

    .result-secondary {
        display: flex;
        flex-wrap: wrap;
        gap: var(--spacing-2);
        margin: var(--spacing-2) 0;
    }

    .secondary-value {
        padding: 0.25rem 0.5rem;
        background-color: var(--surface-secondary);
        border-radius: var(--radius-sm);
        font-size: var(--text-sm);
    }

    .result-menu {
        position: relative;
    }

    .icon-button {
        background: none;
        border: none;
        padding: var(--spacing-1);
        cursor: pointer;
        color: var(--text-secondary);
        border-radius: var(--radius-sm);
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s ease;

        &:hover {
            background: var(--surface-secondary);
            color: var(--text-primary);
        }
    }

    .dropdown-menu {
        position: absolute;
        top: 100%;
        right: 0;
        background: var(--surface-primary);
        border: 1px solid var(--surface-tertiary);
        border-radius: var(--radius-md);
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        min-width: 180px;
        z-index: 1000;
        margin-top: var(--spacing-1);
    }

    .dropdown-header {
        padding: var(--spacing-2) var(--spacing-3);
        font-size: var(--text-xs);
        font-weight: 600;
        color: var(--text-secondary);
        text-transform: uppercase;
        border-bottom: 1px solid var(--surface-tertiary);
    }

    .dropdown-item {
        display: block;
        width: 100%;
        padding: var(--spacing-2) var(--spacing-3);
        background: none;
        border: none;
        text-align: left;
        cursor: pointer;
        font-size: var(--text-sm);
        color: var(--text-primary);
        transition: background-color 0.2s ease;

        &:hover {
            background: var(--surface-secondary);
        }
    }

    // Dialog styles
    .dialog-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: rgba(0, 0, 0, 0.5);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
    }

    .dialog {
        background-color: var(--surface-primary);
        border-radius: var(--radius-lg);
        padding: var(--spacing-6);
        max-width: 700px;
        width: 90%;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    .dialog-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: var(--spacing-2);

        h3 {
            margin: 0;
            font-size: var(--text-xl);
        }
    }

    .dialog > p {
        margin: 0 0 var(--spacing-4) 0;
        color: var(--text-secondary);
    }

    .scorecard-section-header {
        margin: var(--spacing-4) 0 var(--spacing-2) 0;
        padding-bottom: var(--spacing-2);
        border-bottom: 1px solid var(--surface-tertiary);

        h4 {
            margin: 0;
            font-size: var(--text-base);
            font-weight: 600;
            color: var(--text-primary);
        }
    }

    .form-group {
        margin-bottom: var(--spacing-4);

        label {
            display: flex;
            align-items: center;
            gap: var(--spacing-2);
            margin-bottom: var(--spacing-1);
            font-weight: 500;
            font-size: var(--text-sm);
            color: var(--text-primary);
        }

        .file-badge {
            display: inline-flex;
            align-items: center;
            gap: var(--spacing-1);
            padding: var(--spacing-1) var(--spacing-2);
            background-color: var(--surface-secondary);
            border: 1px solid var(--surface-tertiary);
            border-radius: var(--radius-sm);
            font-size: var(--text-xs);
            font-weight: 400;
            color: var(--text-secondary);

            .clear-file-btn {
                background: none;
                border: none;
                padding: 0;
                margin-left: var(--spacing-1);
                cursor: pointer;
                color: var(--text-tertiary);
                display: flex;
                align-items: center;
                transition: color 0.2s ease;

                &:hover {
                    color: var(--text-primary);
                }
            }
        }

        .help-text {
            display: block;
            margin-top: var(--spacing-1);
            font-size: var(--text-xs);
            color: var(--text-tertiary);
        }
    }

    .textarea-wrapper {
        position: relative;

        textarea {
            width: 100%;
            padding: var(--spacing-2);
            border: 1px solid var(--surface-tertiary);
            border-radius: var(--radius-md);
            font-family: "Courier New", monospace;
            font-size: var(--text-sm);
            resize: vertical;
            background-color: var(--surface-primary);
            color: var(--text-primary);
            transition: all 0.2s ease;

            &:focus {
                outline: none;
                border-color: var(--color-primary);
            }

            &.drag-over {
                border-color: var(--color-primary);
                border-style: dashed;
                background-color: color-mix(
                    in srgb,
                    var(--color-primary) 5%,
                    var(--surface-primary)
                );
            }

            &:disabled {
                background-color: var(--surface-secondary);
                color: var(--text-secondary);
                cursor: not-allowed;
            }
        }

        .file-upload-overlay {
            position: absolute;
            bottom: var(--spacing-2);
            right: var(--spacing-2);
            pointer-events: none;

            label {
                pointer-events: auto;
                cursor: pointer;
            }
        }
    }

    .parse-error {
        display: flex;
        align-items: center;
        gap: var(--spacing-2);
        margin-top: var(--spacing-2);
        padding: var(--spacing-2) var(--spacing-3);
        background-color: color-mix(
            in srgb,
            var(--color-error) 10%,
            var(--surface-primary)
        );
        border: 1px solid var(--color-error);
        border-radius: var(--radius-md);
        color: var(--color-error);
        font-size: var(--text-sm);
    }

    .dialog-actions {
        display: flex;
        justify-content: flex-end;
        gap: var(--spacing-2);
        margin-top: var(--spacing-6);
    }

    .btn-primary,
    .btn-secondary {
        padding: var(--spacing-2) var(--spacing-4);
        border: none;
        border-radius: var(--radius-md);
        cursor: pointer;
        font-size: var(--text-sm);
        font-weight: 500;
        transition: all 0.2s ease;
    }

    .btn-primary {
        background-color: var(--color-primary);
        color: white;

        &:hover:not(:disabled) {
            background-color: color-mix(
                in srgb,
                var(--color-primary) 90%,
                black
            );
        }

        &:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }
    }

    .btn-secondary {
        background-color: var(--surface-secondary);
        color: var(--text-primary);
        border: 1px solid var(--surface-tertiary);

        &:hover {
            background-color: var(--surface-tertiary);
        }
    }

    .btn-small {
        padding: var(--spacing-1) var(--spacing-3);
        font-size: var(--text-xs);
    }
</style>
