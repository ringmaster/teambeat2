<script lang="ts">
import { onMount } from "svelte";
import { toastStore } from "$lib/stores/toast";
import type { Scorecard, ScorecardDatasource } from "$lib/types/scorecard";

interface Props {
	scorecardId: string;
	seriesId: string;
	canEdit: boolean;
}

let { scorecardId, seriesId, canEdit }: Props = $props();

let scorecard = $state<Scorecard | null>(null);
let datasources = $state<ScorecardDatasource[]>([]);
let loading = $state(true);
let error = $state<string | null>(null);
let saving = $state(false);
let editMode = $state(false);
let editedName = $state("");
let editedDescription = $state("");
let draggedIndex = $state<number | null>(null);

async function loadScorecard() {
	try {
		loading = true;
		error = null;
		const response = await fetch(
			`/api/series/${seriesId}/scorecards/${scorecardId}`,
		);
		const data = await response.json();

		if (data.success) {
			scorecard = data.scorecard;
			datasources = data.scorecard.datasources || [];
			editedName = scorecard.name;
			editedDescription = scorecard.description || "";
		} else {
			error = data.error || "Failed to load scorecard";
		}
	} catch (e) {
		error = "Failed to load scorecard";
		console.error("Error loading scorecard:", e);
	} finally {
		loading = false;
	}
}

async function saveScorecard() {
	if (!editedName.trim()) return;

	try {
		saving = true;
		error = null;
		const response = await fetch(
			`/api/series/${seriesId}/scorecards/${scorecardId}`,
			{
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					name: editedName,
					description: editedDescription || null,
				}),
			},
		);

		const data = await response.json();

		if (data.success) {
			scorecard = data.scorecard;
			editMode = false;
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

function cancelEdit() {
	if (scorecard) {
		editedName = scorecard.name;
		editedDescription = scorecard.description || "";
	}
	editMode = false;
}

async function deleteDatasource(datasourceId: string) {
	toastStore.warning("Are you sure you want to delete this datasource?", {
		autoHide: false,
		actions: [
			{
				label: "Delete",
				onClick: async () => {
					try {
						const response = await fetch(
							`/api/scorecards/${scorecardId}/datasources/${datasourceId}`,
							{
								method: "DELETE",
							},
						);

						const data = await response.json();

						if (data.success) {
							datasources = datasources.filter((d) => d.id !== datasourceId);
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

function handleDragStart(index: number) {
	draggedIndex = index;
}

function handleDragOver(e: DragEvent) {
	e.preventDefault();
}

async function handleDrop(e: DragEvent, dropIndex: number) {
	e.preventDefault();
	if (draggedIndex === null || draggedIndex === dropIndex) {
		draggedIndex = null;
		return;
	}

	// Reorder datasources array
	const reordered = [...datasources];
	const [movedItem] = reordered.splice(draggedIndex, 1);
	reordered.splice(dropIndex, 0, movedItem);
	datasources = reordered;

	// Save new order to server
	try {
		const response = await fetch(
			`/api/scorecards/${scorecardId}/datasources/reorder`,
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
			await loadScorecard();
		}
	} catch (e) {
		error = "Failed to reorder datasources";
		console.error("Error reordering datasources:", e);
		// Reload to get correct order
		await loadScorecard();
	} finally {
		draggedIndex = null;
	}
}

onMount(() => {
	loadScorecard();
});
</script>

<div class="scorecard-editor">
  {#if loading}
    <div class="loading">Loading scorecard...</div>
  {:else if scorecard}
    <div class="editor-header">
      {#if editMode}
        <div class="edit-form">
          <input
            type="text"
            bind:value={editedName}
            placeholder="Scorecard name"
            class="name-input"
          />
          <textarea
            bind:value={editedDescription}
            placeholder="Description (optional)"
            rows="2"
            class="description-input"
          ></textarea>
          <div class="edit-actions">
            <button onclick={saveScorecard} disabled={saving} class="btn-primary">
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button onclick={cancelEdit} class="btn-secondary">
              Cancel
            </button>
          </div>
        </div>
      {:else}
        <div class="scorecard-header">
          <div>
            <h2>{scorecard.name}</h2>
            {#if scorecard.description}
              <p class="description">{scorecard.description}</p>
            {/if}
          </div>
          {#if canEdit}
            <button onclick={() => editMode = true} class="btn-secondary">
              Edit Details
            </button>
          {/if}
        </div>
      {/if}
    </div>

    {#if error}
      <div class="error-message">{error}</div>
    {/if}

    <div class="datasources-section">
      <div class="section-header">
        <h3>Datasources</h3>
        {#if canEdit}
          <a href="/series/{seriesId}/scorecards/{scorecardId}/datasources/new" class="btn-primary">
            + Add Datasource
          </a>
        {/if}
      </div>

      {#if datasources.length === 0}
        <div class="empty-state">
          <p>No datasources configured.</p>
          {#if canEdit}
            <p>Add your first datasource to start tracking metrics.</p>
          {/if}
        </div>
      {:else}
        <div class="datasource-list">
          {#each datasources as datasource, index}
            <div
              class="datasource-card"
              draggable={canEdit}
              ondragstart={() => handleDragStart(index)}
              ondragover={handleDragOver}
              ondrop={(e) => handleDrop(e, index)}
            >
              <div class="datasource-handle">
                {#if canEdit}
                  <span class="drag-handle">⋮⋮</span>
                {/if}
                <span class="datasource-number">{index + 1}</span>
              </div>
              <div class="datasource-info">
                <h4>{datasource.name}</h4>
                <p class="meta">
                  Source: {datasource.sourceType === 'paste' ? 'Manual Paste' : 'API'}
                  • {JSON.parse(datasource.rules).length} rule(s)
                </p>
              </div>
              <div class="datasource-actions">
                <a href="/series/{seriesId}/scorecards/{scorecardId}/datasources/{datasource.id}" class="btn-secondary">
                  Edit
                </a>
                {#if canEdit}
                  <button onclick={() => deleteDatasource(datasource.id)} class="btn-danger">
                    Delete
                  </button>
                {/if}
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>
  {/if}
</div>

<style lang="less">
  .scorecard-editor {
    padding: 1.5rem;
    max-width: 1200px;
    margin: 0 auto;
    width: 100%;

    @media (min-width: 768px) {
      padding: 2rem;
    }
  }

  .loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem 2rem;
    color: var(--color-text-secondary);
    font-size: 1.125rem;
    font-weight: 500;
  }

  .editor-header {
    margin-bottom: var(--spacing-8);
  }

  .scorecard-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: var(--spacing-4);

    @media (max-width: 767px) {
      flex-direction: column;
    }

    h2 {
      margin: 0 0 var(--spacing-2) 0;
      font-size: 1.75rem;
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

    .description {
      margin: 0;
      font-size: 0.875rem;
      color: var(--color-text-secondary);
      line-height: 1.5;
    }
  }

  .edit-form {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-4);
  }

  .name-input,
  .description-input {
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
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--color-primary) 15%, transparent);
    }

    &::placeholder {
      color: var(--color-text-muted);
    }
  }

  .name-input {
    font-size: 1.25rem;
    font-weight: 600;
  }

  .description-input {
    resize: vertical;
    min-height: 120px;
    line-height: 1.6;
  }

  .edit-actions {
    display: flex;
    gap: var(--spacing-2);
  }

  .error-message {
    padding: var(--spacing-4);
    background-color: var(--status-error-bg);
    border: 1px solid color-mix(in srgb, var(--color-danger) 30%, transparent);
    border-radius: var(--radius-lg);
    color: var(--status-error-text);
    margin-bottom: var(--spacing-4);
    font-size: 0.875rem;
    font-weight: 500;
  }

  .datasources-section {
    margin-top: var(--spacing-8);
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: var(--spacing-4);
    flex-wrap: wrap;
    gap: var(--spacing-3);

    h3 {
      margin: 0;
      font-size: 1.25rem;
      font-weight: 600;
      color: var(--color-text-primary);
    }
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem 2rem;
    color: var(--color-text-muted);
    border: 2px dashed var(--color-border);
    border-radius: var(--radius-lg);
    background: linear-gradient(
      135deg,
      color-mix(in srgb, var(--color-primary) 2%, transparent),
      color-mix(in srgb, var(--color-secondary) 2%, transparent)
    );
    text-align: center;

    p {
      margin: 0.5rem 0;
      font-size: 0.9375rem;
      font-style: italic;
    }
  }

  .datasource-list {
    display: flex;
    flex-direction: column;
    gap: var(--spacing-3);
  }

  .datasource-card {
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    padding: 1.25rem;
    display: flex;
    align-items: center;
    gap: var(--spacing-4);
    background-color: white;
    cursor: grab;
    transition: all 0.2s ease;
    box-shadow: var(--shadow-sm);
    position: relative;

    &::before {
      content: '';
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 4px;
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
      box-shadow: var(--shadow-md);

      &::before {
        opacity: 1;
      }
    }

    &:active {
      cursor: grabbing;
      transform: scale(0.98);
    }

    @media (max-width: 767px) {
      flex-direction: column;
      align-items: flex-start;
      gap: var(--spacing-3);
    }
  }

  .datasource-handle {
    display: flex;
    align-items: center;
    gap: var(--spacing-2);
    color: var(--color-text-muted);
  }

  .drag-handle {
    cursor: grab;
    font-size: 1.25rem;
    user-select: none;
  }

  .datasource-number {
    font-weight: 600;
    font-size: 0.875rem;
    color: var(--color-text-secondary);
    min-width: 1.5rem;
    text-align: center;
  }

  .datasource-info {
    flex: 1;

    h4 {
      margin: 0 0 var(--spacing-1) 0;
      font-size: 1rem;
      font-weight: 600;
      color: var(--color-text-primary);
    }

    .meta {
      margin: 0;
      font-size: 0.8125rem;
      color: var(--color-text-secondary);
      font-weight: 500;
    }
  }

  .datasource-actions {
    display: flex;
    gap: var(--spacing-2);
    flex-wrap: wrap;
  }

  .btn-primary,
  .btn-secondary,
  .btn-danger {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: 0.625rem 1.5rem;
    border: none;
    border-radius: var(--radius-md);
    cursor: pointer;
    font-size: 0.875rem;
    font-weight: 600;
    text-decoration: none;
    transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    box-shadow: var(--shadow-sm);
    min-height: 44px;
    white-space: nowrap;

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  }

  .btn-primary {
    background: var(--btn-primary-bg);
    color: var(--btn-primary-text);

    &:hover:not(:disabled) {
      background: var(--btn-primary-bg-hover);
      transform: translateY(-1px);
      box-shadow: var(--shadow-md);
    }

    &:active:not(:disabled) {
      transform: translateY(0);
      box-shadow: var(--shadow-sm);
    }
  }

  .btn-secondary {
    background: var(--btn-secondary-bg);
    color: var(--btn-secondary-text);

    &:hover:not(:disabled) {
      background: var(--btn-secondary-bg-hover);
      transform: translateY(-1px);
      box-shadow: var(--shadow-md);
    }

    &:active:not(:disabled) {
      transform: translateY(0);
      box-shadow: var(--shadow-sm);
    }
  }

  .btn-danger {
    background: var(--btn-danger-bg);
    color: var(--btn-danger-text);

    &:hover:not(:disabled) {
      background: var(--btn-danger-bg-hover);
      transform: translateY(-1px);
      box-shadow: var(--shadow-md);
    }

    &:active:not(:disabled) {
      transform: translateY(0);
      box-shadow: var(--shadow-sm);
    }
  }
</style>
