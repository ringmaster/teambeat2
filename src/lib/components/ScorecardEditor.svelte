<script lang="ts">
  import { onMount } from 'svelte';
  import type { Scorecard, ScorecardDatasource } from '$lib/types/scorecard';

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
  let editedName = $state('');
  let editedDescription = $state('');
  let draggedIndex = $state<number | null>(null);

  async function loadScorecard() {
    try {
      loading = true;
      error = null;
      const response = await fetch(`/api/series/${seriesId}/scorecards/${scorecardId}`);
      const data = await response.json();

      if (data.success) {
        scorecard = data.scorecard;
        datasources = data.scorecard.datasources || [];
        editedName = scorecard.name;
        editedDescription = scorecard.description || '';
      } else {
        error = data.error || 'Failed to load scorecard';
      }
    } catch (e) {
      error = 'Failed to load scorecard';
      console.error('Error loading scorecard:', e);
    } finally {
      loading = false;
    }
  }

  async function saveScorecard() {
    if (!editedName.trim()) return;

    try {
      saving = true;
      error = null;
      const response = await fetch(`/api/series/${seriesId}/scorecards/${scorecardId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editedName,
          description: editedDescription || null
        })
      });

      const data = await response.json();

      if (data.success) {
        scorecard = data.scorecard;
        editMode = false;
      } else {
        error = data.error || 'Failed to save scorecard';
      }
    } catch (e) {
      error = 'Failed to save scorecard';
      console.error('Error saving scorecard:', e);
    } finally {
      saving = false;
    }
  }

  function cancelEdit() {
    if (scorecard) {
      editedName = scorecard.name;
      editedDescription = scorecard.description || '';
    }
    editMode = false;
  }

  async function deleteDatasource(datasourceId: string) {
    if (!confirm('Are you sure you want to delete this datasource?')) {
      return;
    }

    try {
      const response = await fetch(`/api/scorecards/${scorecardId}/datasources/${datasourceId}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (data.success) {
        datasources = datasources.filter(d => d.id !== datasourceId);
      } else {
        error = data.error || 'Failed to delete datasource';
      }
    } catch (e) {
      error = 'Failed to delete datasource';
      console.error('Error deleting datasource:', e);
    }
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
      const response = await fetch(`/api/scorecards/${scorecardId}/datasources/reorder`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          datasource_ids: reordered.map(d => d.id)
        })
      });

      const data = await response.json();

      if (data.success) {
        datasources = data.datasources;
      } else {
        error = data.error || 'Failed to reorder datasources';
        // Reload to get correct order
        await loadScorecard();
      }
    } catch (e) {
      error = 'Failed to reorder datasources';
      console.error('Error reordering datasources:', e);
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

<style>
  .scorecard-editor {
    padding: 1.5rem;
    max-width: 1200px;
    margin: 0 auto;
  }

  .loading {
    text-align: center;
    padding: 3rem;
    color: #666;
  }

  .editor-header {
    margin-bottom: 2rem;
  }

  .scorecard-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }

  .scorecard-header h2 {
    margin: 0 0 0.5rem 0;
    font-size: 1.75rem;
  }

  .scorecard-header .description {
    margin: 0;
    color: #666;
  }

  .edit-form {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .name-input,
  .description-input {
    width: 100%;
    padding: 0.5rem;
    border: 1px solid #ddd;
    border-radius: 4px;
    font-family: inherit;
    font-size: 1rem;
  }

  .name-input {
    font-size: 1.25rem;
    font-weight: 500;
  }

  .description-input {
    resize: vertical;
  }

  .edit-actions {
    display: flex;
    gap: 0.5rem;
  }

  .error-message {
    padding: 0.75rem;
    background-color: #fee;
    border: 1px solid #fcc;
    border-radius: 4px;
    color: #c33;
    margin-bottom: 1rem;
  }

  .datasources-section {
    margin-top: 2rem;
  }

  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .section-header h3 {
    margin: 0;
    font-size: 1.25rem;
  }

  .empty-state {
    text-align: center;
    padding: 3rem;
    color: #666;
    border: 1px dashed #ccc;
    border-radius: 6px;
  }

  .empty-state p {
    margin: 0.5rem 0;
  }

  .datasource-list {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .datasource-card {
    border: 1px solid #ddd;
    border-radius: 6px;
    padding: 1rem;
    display: flex;
    align-items: center;
    gap: 1rem;
    background-color: #fff;
    cursor: grab;
  }

  .datasource-card:active {
    cursor: grabbing;
  }

  .datasource-handle {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    color: #999;
  }

  .drag-handle {
    cursor: grab;
    font-size: 1.25rem;
  }

  .datasource-number {
    font-weight: 600;
    color: #666;
  }

  .datasource-info {
    flex: 1;
  }

  .datasource-info h4 {
    margin: 0 0 0.25rem 0;
    font-size: 1rem;
  }

  .datasource-info .meta {
    margin: 0;
    font-size: 0.875rem;
    color: #999;
  }

  .datasource-actions {
    display: flex;
    gap: 0.5rem;
  }

  .btn-primary,
  .btn-secondary,
  .btn-danger {
    padding: 0.5rem 1rem;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    font-size: 0.875rem;
    font-weight: 500;
    text-decoration: none;
    display: inline-block;
  }

  .btn-primary {
    background-color: #007bff;
    color: white;
  }

  .btn-primary:hover:not(:disabled) {
    background-color: #0056b3;
  }

  .btn-primary:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .btn-secondary {
    background-color: #6c757d;
    color: white;
  }

  .btn-secondary:hover {
    background-color: #545b62;
  }

  .btn-danger {
    background-color: #dc3545;
    color: white;
  }

  .btn-danger:hover {
    background-color: #bd2130;
  }
</style>
